import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { getRecords } from "@/lib/master-store.server";
import { getProduct } from "@/lib/product-store.server";
import { notify } from "@/lib/notifications.server";
import { grossProfitPercent } from "@/lib/quotation.server";
import { computeProjectBudget, type ProjectLine } from "@/lib/project-budget";
import { CLOSED_PROJECT_STATUSES, OPEN_QUOTATION_STATUSES, changePct, isSignificant, type PriceAlertDocType } from "@/lib/price-alerts";

/**
 * ราคาทุนเปลี่ยนหลังรับสินค้า (เรียกหลังบันทึกรับสินค้าสำเร็จ — ล้มเหลวไม่กระทบใบรับสินค้า)
 *  1) อัปเดต "ราคาทุนล่าสุด" ของผู้ขายรายนั้นที่สินค้า (supplierConfig ของบริษัท)
 *  2) ราคาล็อตใหม่ต่างจากต้นทุนเฉลี่ยเดิมเกินเกณฑ์ → หาใบเสนอราคาที่ยังเปิด/โครงการที่ยังไม่จบที่ใช้สินค้านั้น
 *     ที่ต้นทุนในเอกสารต่างจากราคาซื้อล่าสุดเกินเกณฑ์ → บันทึก price_alerts + แจ้งผู้สร้างเอกสาร
 *  3) แจ้งฝ่ายจัดซื้อและผู้บริหาร (สรุปต่อสินค้า)
 * price_alerts/{docType}_{docId}_{productId} — เอกสารเดียวต่อคู่ เหตุการณ์ใหม่เขียนทับ (สถานะกลับเป็น open)
 */
export interface ReceivedItem { productId: string; name: string; unitCost: number }
export interface GrContext { companyId: string; grNo: string; supplierId: string; supplierName: string; userUid: string }

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctText = (p: number | null) => (p === null ? "" : `${p > 0 ? "+" : ""}${p.toFixed(1)}%`);

/** ต้นทุนเฉลี่ยก่อนรับเข้า (อ่านก่อนบันทึกรับสินค้า) */
export async function costsBefore(companyId: string, productIds: string[]): Promise<Map<string, number>> {
  const recs = await getRecords("products", companyId, productIds);
  return new Map(Array.from(recs.entries()).map(([id, p]) => [id, Number(p.pricing?.costWAC ?? p.costPrice) || 0]));
}

export async function afterGoodsReceipt(ctx: GrContext, items: ReceivedItem[], before: Map<string, number>) {
  // รายการเดียวกันหลายบรรทัด: ใช้ราคาล่าสุด
  const byProduct = new Map<string, ReceivedItem>();
  for (const it of items) if (it.productId && it.unitCost > 0) byProduct.set(it.productId, it);
  for (const it of Array.from(byProduct.values())) {
    try {
      if (ctx.supplierId) await updateSupplierCost(ctx, it);
      const prev = before.get(it.productId) || 0;
      if (!isSignificant(prev, it.unitCost)) continue;
      const after = await getProduct(ctx.companyId, it.productId);
      const wac = Number(after?.data.pricing?.costWAC ?? after?.data.costPrice) || it.unitCost;
      const affected = [...(await affectedQuotations(ctx, it, wac)), ...(await affectedProjects(ctx, it, wac))];
      const move = changePct(prev, it.unitCost);
      const qn = affected.filter((a) => a.docType === "quotation").length, pn = affected.length - qn;
      await notify(ctx.companyId, {
        type: "PRICE_CHANGE",
        title: `ราคาทุน ${it.name || it.productId} ${move! > 0 ? "ขึ้น" : "ลง"} ${pctText(move)}`,
        message: `ล็อตใหม่ ${fmt(it.unitCost)} บาท (เดิมเฉลี่ย ${fmt(prev)}) จาก ${ctx.supplierName || "ผู้ขาย"} ใบรับ ${ctx.grNo}`
          + (affected.length ? ` · กระทบใบเสนอราคา ${qn} ใบ โครงการ ${pn} โครงการ` : " · ไม่มีเอกสารที่เปิดอยู่ได้รับผล"),
        link: `/inventory/${encodeURIComponent(it.productId)}`,
        targetRoles: ["PURCHASING", "EXECUTIVE"],
        documentNo: ctx.grNo,
        dedupeKey: `price_${ctx.grNo}_${it.productId}`.replace(/[/\s]/g, "_").slice(0, 300),
      }, ctx.userUid);
    } catch (err) {
      console.error("[PRICE_ALERT_FAILED]", it.productId, err);
    }
  }
}

async function updateSupplierCost(ctx: GrContext, it: ReceivedItem) {
  const h = await getProduct(ctx.companyId, it.productId);
  if (!h) return;
  const list: any[] = Array.isArray(h.data.supplierConfig) ? h.data.supplierConfig.filter((c: any) => c && c.supplierId) : [];
  const i = list.findIndex((c) => c.supplierId === ctx.supplierId);
  const entry = { ...(i >= 0 ? list[i] : { supplierId: ctx.supplierId, leadTimeDays: 7, isPrimary: list.length === 0 }), latestCost: r2(it.unitCost), lastReceivedAt: new Date().toISOString(), lastGrNo: ctx.grNo };
  const next = i >= 0 ? list.map((c, k) => (k === i ? entry : c)) : [...list, entry];
  await h.ref.update({ supplierConfig: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
}

interface Affected { docType: PriceAlertDocType; docId: string; docNo: string }

/**
 * บรรทัดเอกสารเมื่อวัสดุ/สินค้า pid มีต้นทุนใหม่ matCost (null = บรรทัดนี้ไม่เกี่ยว)
 *  - สินค้าตัวนั้นเอง: ต้นทุน = matCost
 *  - งานบริการที่มีวัสดุนี้ในสูตร: ต้นทุน + จำนวนวัสดุต่อหน่วย × (matCost − ทุนวัสดุตอนเลือกลงเอกสาร)
 */
function reprice(line: any, pid: string, matCost: number, costKey: "costPrice" | "unitCost"): any | null {
  if (!line || line.itemType === "GROUP_HEADER" || line.kind === "GROUP") return null;
  if (line.productId === pid) return { ...line, [costKey]: r2(matCost) };
  const mats: any[] = Array.isArray(line.recipe?.materials) ? line.recipe.materials : [];
  const m = mats.find((x) => x.productId === pid);
  if (!m || m.cost === undefined || m.cost === null) return null;
  const cost = r2(Math.max(0, (Number(line[costKey]) || 0) + (Number(m.qty) || 0) * (matCost - (Number(m.cost) || 0))));
  return { ...line, [costKey]: cost, recipe: { ...line.recipe, materials: mats.map((x) => (x.productId === pid ? { ...x, cost: r2(matCost) } : x)) } };
}

function alertDoc(ctx: GrContext, it: ReceivedItem, wac: number, a: Affected & { title: string; ownerUid: string; line: any; next: any; costKey: "costPrice" | "unitCost"; gpBefore: number | null; gpAfter: number | null }) {
  const lineCost = Number(a.line[a.costKey]) || 0, newCost = Number(a.next[a.costKey]) || 0;
  const viaRecipe = a.line.productId !== it.productId;
  return {
    companyId: ctx.companyId, docType: a.docType, docId: a.docId, docNo: a.docNo, title: a.title, ownerUid: a.ownerUid,
    productId: it.productId, productName: viaRecipe ? String(a.line.productName || a.line.name || "") : it.name,
    // วัสดุในสูตรงานบริการ: ชื่อวัสดุและราคาซื้อล่าสุดของวัสดุ
    viaRecipe, materialName: it.name, materialCost: r2(it.unitCost),
    lineCost: r2(lineCost), unitPrice: r2(Number(a.line.unitPrice) || 0), newCost: r2(newCost), wac: r2(wac),
    changePct: changePct(lineCost, newCost), gpBefore: a.gpBefore, gpAfter: a.gpAfter,
    grNo: ctx.grNo, supplierId: ctx.supplierId, supplierName: ctx.supplierName,
    status: "open", createdAt: admin.firestore.FieldValue.serverTimestamp(), resolvedAt: null, resolvedBy: "", resolution: "",
  };
}

const describe = (al: ReturnType<typeof alertDoc>) => al.viaRecipe
  ? `${al.productName}: วัสดุ ${al.materialName} ราคาใหม่ ${fmt(al.materialCost)} → ต้นทุนงาน ${fmt(al.lineCost)} → ${fmt(al.newCost)} (${pctText(al.changePct)})`
  : `${al.productName}: ทุนในเอกสาร ${fmt(al.lineCost)} → ราคาซื้อล่าสุด ${fmt(al.newCost)} (${pctText(al.changePct)})`;

/** บรรทัดแรกที่ต้นทุนเปลี่ยนเกินเกณฑ์ (ต้นทุนเดิม 0 = เทียบไม่ได้ ถือว่าเปลี่ยน) */
function firstImpact(lines: any[], it: ReceivedItem, costKey: "costPrice" | "unitCost") {
  for (const l of lines) {
    const next = reprice(l, it.productId, it.unitCost, costKey);
    if (!next) continue;
    const before = Number(l[costKey]) || 0, after = Number(next[costKey]) || 0;
    if (before > 0 ? isSignificant(before, after) : after > 0) return { line: l, next };
  }
  return null;
}

async function affectedQuotations(ctx: GrContext, it: ReceivedItem, wac: number): Promise<Affected[]> {
  const snap = await adminDb.collection(`companies/${ctx.companyId}/quotations`).where("productIds", "array-contains", it.productId).limit(200).get();
  const out: Affected[] = [];
  for (const d of snap.docs) {
    const q = d.data();
    if (q.isDeleted || !OPEN_QUOTATION_STATUSES.includes(String(q.status))) continue;
    const lines = (await d.ref.collection("lines").get()).docs.map((x) => x.data());
    const hit = firstImpact(lines, it, "costPrice");
    if (!hit) continue; // ต้นทุนในใบใกล้ราคาใหม่อยู่แล้ว
    const gpBefore = grossProfitPercent(lines as any, q.docDiscountAmount);
    const gpAfter = grossProfitPercent(lines.map((l) => reprice(l, it.productId, it.unitCost, "costPrice") || l) as any, q.docDiscountAmount);
    const a: Affected = { docType: "quotation", docId: d.id, docNo: String(q.documentNo || q.quotationNumber || d.id) };
    const ownerUid = String(q.createdBy || q.salesPersonId || "");
    const al = alertDoc(ctx, it, wac, { ...a, title: String(q.customerName || q.projectName || ""), ownerUid, ...hit, costKey: "costPrice", gpBefore, gpAfter });
    await adminDb.doc(`companies/${ctx.companyId}/price_alerts/${a.docType}_${a.docId}_${it.productId}`).set(al);
    if (ownerUid) await notify(ctx.companyId, {
      type: "PRICE_CHANGE_DOC", title: `ต้นทุนเปลี่ยนในใบเสนอราคา ${a.docNo}`,
      message: `${describe(al)} · GP ${gpBefore}% → ${gpAfter}%`,
      link: `/sales/quotations/${encodeURIComponent(d.id)}`, targetUserId: ownerUid, documentNo: a.docNo,
      dedupeKey: `price_quotation_${d.id}_${it.productId}`.slice(0, 300),
    }, ctx.userUid);
    out.push(a);
  }
  return out;
}

/** บรรทัด BOQ ที่ต้นทุนเปลี่ยน: ยอดต้นทุนของบรรทัดคำนวณใหม่ด้วย (งบโครงการรวมจาก costAmount) */
const withCostAmount = (l: ProjectLine): ProjectLine => ({ ...l, costAmount: r2((Number(l.qty) || 0) * (Number(l.unitCost) || 0)) });
const repriceProject = (items: ProjectLine[], pid: string, cost: number) => items.map((l) => { const n = reprice(l, pid, cost, "unitCost"); return n ? withCostAmount(n) : l; });

const projectBudget = (p: any, items: ProjectLine[]) =>
  computeProjectBudget(items, { startDate: p.startDate, endDate: p.endDate, ...(Array.isArray(p.expenses) ? { expenses: p.expenses } : {}) });

async function affectedProjects(ctx: GrContext, it: ReceivedItem, wac: number): Promise<Affected[]> {
  const snap = await adminDb.collection(`companies/${ctx.companyId}/projects`).where("productIds", "array-contains", it.productId).limit(200).get();
  const out: Affected[] = [];
  for (const d of snap.docs) {
    const p = d.data();
    if (p.isDeleted || CLOSED_PROJECT_STATUSES.includes(String(p.status))) continue;
    const items: ProjectLine[] = Array.isArray(p.items) ? p.items : [];
    const hit = firstImpact(items, it, "unitCost");
    if (!hit) continue;
    const gpBefore = r2(projectBudget(p, items).gpPercent);
    const gpAfter = r2(projectBudget(p, repriceProject(items, it.productId, it.unitCost)).gpPercent);
    const a: Affected = { docType: "project", docId: d.id, docNo: String(p.projectId || d.id) };
    const ownerUid = String(p.projectManagerUid || p.createdBy || "");
    const al = alertDoc(ctx, it, wac, { ...a, title: String(p.projectName || p.name || ""), ownerUid, ...hit, costKey: "unitCost", gpBefore, gpAfter });
    await adminDb.doc(`companies/${ctx.companyId}/price_alerts/${a.docType}_${a.docId}_${it.productId}`).set(al);
    if (ownerUid) await notify(ctx.companyId, {
      type: "PRICE_CHANGE_DOC", title: `ต้นทุนเปลี่ยนในโครงการ ${a.docNo}`,
      message: `${describe(al)} · GP ${gpBefore}% → ${gpAfter}%`,
      link: `/projects/${encodeURIComponent(d.id)}`, targetUserId: ownerUid, documentNo: a.docNo,
      dedupeKey: `price_project_${d.id}_${it.productId}`.slice(0, 300),
    }, ctx.userUid);
    out.push(a);
  }
  return out;
}

/** ใช้ราคาซื้อล่าสุดเป็นต้นทุนในเอกสาร (สินค้าตัวนั้น และงานบริการที่ใช้เป็นวัสดุ) — ราคาขายคงเดิม */
export async function applyAlert(companyId: string, alertId: string, uid: string): Promise<{ gpAfter: number | null }> {
  const alertRef = adminDb.doc(`companies/${companyId}/price_alerts/${alertId}`);
  return adminDb.runTransaction(async (tx) => {
    const a = (await tx.get(alertRef)).data();
    if (!a) throw new Error("ไม่พบรายการแจ้งเตือน");
    if (a.status !== "open") throw new Error("รายการนี้จัดการไปแล้ว");
    const matCost = Number(a.materialCost ?? a.newCost) || 0;
    let gpAfter: number | null = null;
    if (a.docType === "quotation") {
      const ref = adminDb.doc(`companies/${companyId}/quotations/${a.docId}`);
      const [q, lines] = await Promise.all([tx.get(ref), tx.get(ref.collection("lines"))]);
      if (!q.exists) throw new Error("ไม่พบใบเสนอราคา");
      if (!OPEN_QUOTATION_STATUSES.includes(String(q.data()!.status))) throw new Error("ใบเสนอราคานี้ปิดแล้ว แก้ต้นทุนไม่ได้");
      const all = lines.docs.map((d) => ({ ref: d.ref, data: d.data(), next: reprice(d.data(), a.productId, matCost, "costPrice") }));
      gpAfter = grossProfitPercent(all.map((l) => l.next || l.data) as any, q.data()!.docDiscountAmount);
      all.forEach((l) => { if (l.next) tx.update(l.ref, { costPrice: l.next.costPrice, margin: r2((Number(l.next.unitPrice) || 0) - l.next.costPrice), ...(l.next.recipe ? { recipe: l.next.recipe } : {}) }); });
      tx.update(ref, { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: uid });
      tx.set(ref.collection("audit_logs").doc(), { action: "COST_UPDATED", productId: a.productId, from: a.lineCost, to: a.newCost, reason: `ราคาซื้อล่าสุด ${a.materialName || ""} (${a.grNo})`, by: uid, at: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      const ref = adminDb.doc(`companies/${companyId}/projects/${a.docId}`);
      const p = (await tx.get(ref)).data();
      if (!p) throw new Error("ไม่พบโครงการ");
      if (CLOSED_PROJECT_STATUSES.includes(String(p.status))) throw new Error("โครงการนี้ปิดแล้ว แก้ต้นทุนไม่ได้");
      const items = repriceProject(Array.isArray(p.items) ? p.items : [], a.productId, matCost);
      const b = projectBudget(p, items);
      gpAfter = r2(b.gpPercent);
      tx.update(ref, { items, budget: b.totalRev, allocatedCost: b.totalCost, grossProfit: b.grossProfit, gpPercent: b.gpPercent, budgetSummary: b, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: uid });
    }
    tx.update(alertRef, { status: "applied", resolution: "cost_updated", gpAfter, resolvedAt: admin.firestore.FieldValue.serverTimestamp(), resolvedBy: uid });
    return { gpAfter };
  });
}
