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

function alertDoc(ctx: GrContext, it: ReceivedItem, wac: number, a: Affected & { title: string; ownerUid: string; lineCost: number; unitPrice: number; gpBefore: number | null; gpAfter: number | null }) {
  return {
    companyId: ctx.companyId, docType: a.docType, docId: a.docId, docNo: a.docNo, title: a.title, ownerUid: a.ownerUid,
    productId: it.productId, productName: it.name, lineCost: r2(a.lineCost), unitPrice: r2(a.unitPrice), newCost: r2(it.unitCost), wac: r2(wac),
    changePct: changePct(a.lineCost, it.unitCost), gpBefore: a.gpBefore, gpAfter: a.gpAfter,
    grNo: ctx.grNo, supplierId: ctx.supplierId, supplierName: ctx.supplierName,
    status: "open", createdAt: admin.firestore.FieldValue.serverTimestamp(), resolvedAt: null, resolvedBy: "", resolution: "",
  };
}

async function affectedQuotations(ctx: GrContext, it: ReceivedItem, wac: number): Promise<Affected[]> {
  const snap = await adminDb.collection(`companies/${ctx.companyId}/quotations`).where("productIds", "array-contains", it.productId).limit(200).get();
  const out: Affected[] = [];
  for (const d of snap.docs) {
    const q = d.data();
    if (q.isDeleted || !OPEN_QUOTATION_STATUSES.includes(String(q.status))) continue;
    const lines = (await d.ref.collection("lines").get()).docs.map((x) => x.data());
    const mine = lines.filter((l) => l.productId === it.productId && l.itemType !== "GROUP_HEADER");
    if (!mine.length) continue;
    const lineCost = Number(mine[0].costPrice) || 0;
    if (lineCost > 0 && !isSignificant(lineCost, it.unitCost)) continue; // ต้นทุนในใบใกล้ราคาใหม่อยู่แล้ว
    const gpBefore = grossProfitPercent(lines as any, q.docDiscountAmount);
    const gpAfter = grossProfitPercent(lines.map((l) => (l.productId === it.productId ? { ...l, costPrice: it.unitCost } : l)) as any, q.docDiscountAmount);
    const a: Affected = { docType: "quotation", docId: d.id, docNo: String(q.documentNo || q.quotationNumber || d.id) };
    const ownerUid = String(q.createdBy || q.salesPersonId || "");
    await adminDb.doc(`companies/${ctx.companyId}/price_alerts/${a.docType}_${a.docId}_${it.productId}`)
      .set(alertDoc(ctx, it, wac, { ...a, title: String(q.customerName || q.projectName || ""), ownerUid, lineCost, unitPrice: Number(mine[0].unitPrice) || 0, gpBefore, gpAfter }));
    if (ownerUid) await notify(ctx.companyId, {
      type: "PRICE_CHANGE_DOC", title: `ต้นทุนเปลี่ยนในใบเสนอราคา ${a.docNo}`,
      message: `${it.name}: ทุนในใบ ${fmt(lineCost)} → ราคาซื้อล่าสุด ${fmt(it.unitCost)} (${pctText(changePct(lineCost, it.unitCost))}) · GP ${gpBefore}% → ${gpAfter}%`,
      link: `/sales/quotations/${encodeURIComponent(d.id)}`, targetUserId: ownerUid, documentNo: a.docNo,
      dedupeKey: `price_quotation_${d.id}_${it.productId}`.slice(0, 300),
    }, ctx.userUid);
    out.push(a);
  }
  return out;
}

/** บรรทัด BOQ ที่ใช้ต้นทุนใหม่ (ยอดต้นทุนของบรรทัดคำนวณใหม่ด้วย — งบโครงการรวมจาก costAmount) */
const withCost = (l: ProjectLine, cost: number): ProjectLine => ({ ...l, unitCost: cost, costAmount: r2((Number(l.qty) || 0) * cost) });

const projectBudget = (p: any, items: ProjectLine[]) =>
  computeProjectBudget(items, { startDate: p.startDate, endDate: p.endDate, ...(Array.isArray(p.expenses) ? { expenses: p.expenses } : {}) });

async function affectedProjects(ctx: GrContext, it: ReceivedItem, wac: number): Promise<Affected[]> {
  const snap = await adminDb.collection(`companies/${ctx.companyId}/projects`).where("productIds", "array-contains", it.productId).limit(200).get();
  const out: Affected[] = [];
  for (const d of snap.docs) {
    const p = d.data();
    if (p.isDeleted || CLOSED_PROJECT_STATUSES.includes(String(p.status))) continue;
    const items: ProjectLine[] = Array.isArray(p.items) ? p.items : [];
    const mine = items.find((l) => l.productId === it.productId);
    if (!mine) continue;
    const lineCost = Number(mine.unitCost) || 0;
    if (lineCost > 0 && !isSignificant(lineCost, it.unitCost)) continue;
    const gpBefore = projectBudget(p, items).gpPercent;
    const gpAfter = projectBudget(p, items.map((l) => (l.productId === it.productId ? withCost(l, it.unitCost) : l))).gpPercent;
    const a: Affected = { docType: "project", docId: d.id, docNo: String(p.projectId || d.id) };
    const ownerUid = String(p.projectManagerUid || p.createdBy || "");
    await adminDb.doc(`companies/${ctx.companyId}/price_alerts/${a.docType}_${a.docId}_${it.productId}`)
      .set(alertDoc(ctx, it, wac, { ...a, title: String(p.projectName || p.name || ""), ownerUid, lineCost, unitPrice: Number(mine.unitPrice) || 0, gpBefore: r2(gpBefore), gpAfter: r2(gpAfter) }));
    if (ownerUid) await notify(ctx.companyId, {
      type: "PRICE_CHANGE_DOC", title: `ต้นทุนเปลี่ยนในโครงการ ${a.docNo}`,
      message: `${it.name}: ทุนใน BOQ ${fmt(lineCost)} → ราคาซื้อล่าสุด ${fmt(it.unitCost)} (${pctText(changePct(lineCost, it.unitCost))}) · GP ${r2(gpBefore)}% → ${r2(gpAfter)}%`,
      link: `/projects/${encodeURIComponent(d.id)}`, targetUserId: ownerUid, documentNo: a.docNo,
      dedupeKey: `price_project_${d.id}_${it.productId}`.slice(0, 300),
    }, ctx.userUid);
    out.push(a);
  }
  return out;
}

/** ใช้ราคาซื้อล่าสุดเป็นต้นทุนในเอกสาร (ราคาขายคงเดิม) — คืนข้อความผลลัพธ์ */
export async function applyAlert(companyId: string, alertId: string, uid: string): Promise<{ gpAfter: number | null }> {
  const alertRef = adminDb.doc(`companies/${companyId}/price_alerts/${alertId}`);
  return adminDb.runTransaction(async (tx) => {
    const a = (await tx.get(alertRef)).data();
    if (!a) throw new Error("ไม่พบรายการแจ้งเตือน");
    if (a.status !== "open") throw new Error("รายการนี้จัดการไปแล้ว");
    const newCost = Number(a.newCost) || 0;
    let gpAfter: number | null = null;
    if (a.docType === "quotation") {
      const ref = adminDb.doc(`companies/${companyId}/quotations/${a.docId}`);
      const [q, lines] = await Promise.all([tx.get(ref), tx.get(ref.collection("lines"))]);
      if (!q.exists) throw new Error("ไม่พบใบเสนอราคา");
      if (!OPEN_QUOTATION_STATUSES.includes(String(q.data()!.status))) throw new Error("ใบเสนอราคานี้ปิดแล้ว แก้ต้นทุนไม่ได้");
      const all = lines.docs.map((d) => ({ ref: d.ref, data: d.data() }));
      const next = all.map((l) => (l.data.productId === a.productId && l.data.itemType !== "GROUP_HEADER" ? { ...l.data, costPrice: newCost, margin: r2((Number(l.data.unitPrice) || 0) - newCost) } : l.data));
      gpAfter = grossProfitPercent(next as any, q.data()!.docDiscountAmount);
      all.forEach((l, i) => { if (l.data.productId === a.productId) tx.update(l.ref, { costPrice: next[i].costPrice, margin: next[i].margin }); });
      tx.update(ref, { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: uid });
      tx.set(ref.collection("audit_logs").doc(), { action: "COST_UPDATED", productId: a.productId, from: a.lineCost, to: newCost, reason: `ราคาซื้อล่าสุด (${a.grNo})`, by: uid, at: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      const ref = adminDb.doc(`companies/${companyId}/projects/${a.docId}`);
      const p = (await tx.get(ref)).data();
      if (!p) throw new Error("ไม่พบโครงการ");
      if (CLOSED_PROJECT_STATUSES.includes(String(p.status))) throw new Error("โครงการนี้ปิดแล้ว แก้ต้นทุนไม่ได้");
      const items: ProjectLine[] = (Array.isArray(p.items) ? p.items : []).map((l: ProjectLine) => (l.productId === a.productId ? withCost(l, newCost) : l));
      const b = projectBudget(p, items);
      gpAfter = r2(b.gpPercent);
      tx.update(ref, { items, budget: b.totalRev, allocatedCost: b.totalCost, grossProfit: b.grossProfit, gpPercent: b.gpPercent, budgetSummary: b, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: uid });
    }
    tx.update(alertRef, { status: "applied", resolution: "cost_updated", gpAfter, resolvedAt: admin.firestore.FieldValue.serverTimestamp(), resolvedBy: uid });
    return { gpAfter };
  });
}
