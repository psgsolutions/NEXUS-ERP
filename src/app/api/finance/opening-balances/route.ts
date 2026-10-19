import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { listRecords } from "@/lib/master-store.server";
import { partySnapshot } from "@/lib/documents/party";
import { postingLines } from "@/lib/financial-reports";
import { inventoryValuation } from "@/lib/subledgers";
import { payableRows, receivableRows } from "@/lib/executive-metrics";
import { OPENING_DOC_KIND, OPENING_TB_REF, openingDocId, reconcileRow } from "@/lib/import/opening";

/**
 * [API-SERVER] ยอดยกมาเมื่อเริ่มใช้ระบบ
 * Endpoint: POST /api/finance/opening-balances   (สิทธิ์ finance:edit)
 *  - { action: "status" }   ใบสำคัญงบทดลองยกมา (อ้างอิง OPENING-TB) + จำนวน/ยอดลูกหนี้-เจ้าหนี้ยกมา
 *                           + กระทบยอดบัญชีคุม (ลูกหนี้ 1131 / เจ้าหนี้ 2111 / สินค้า 1141) กับยอดรายตัว
 *  - { action: "ar", items: [{ docNo, date, dueDate?, partyName, taxId?, branchCode?, amount, subTotal?, note? }] }
 *        ใบแจ้งหนี้ยกมา companies/{c}/invoices/OBAR-... (docKind "opening") — ไม่บันทึกบัญชี ไม่เข้ารายงานภาษีขาย
 *  - { action: "ap", items: [...เหมือนกัน] }
 *        รายการค้างจ่ายยกมา companies/{c}/expenses/OBAP-... (apPosted: จ่ายแล้ว Dr เจ้าหนี้ 2111 เต็มจำนวน ไม่มีภาษีซื้อ)
 *  - { action: "clear", kind: "ar" | "ap" }   ลบรายการยกมาที่ยังไม่มีการรับ/จ่ายชำระ (นำเข้าใหม่ได้)
 * จับคู่ลูกค้า/ผู้ขาย: เลขผู้เสียภาษี+สาขาก่อน แล้วจึงใช้ชื่อ (ต้องตรงรายการเดียว)
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const normName = (s: any) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const live = (x: any) => x.isDeleted !== true && x.isSample !== true && String(x.status || "").toLowerCase() !== "cancelled";

type Item = { docNo: string; date: string; dueDate: string; partyName: string; taxId: string; branchCode: string; amount: number; subTotal: number; note: string };

function cleanItem(raw: any): Item | string {
  const docNo = str(raw?.docNo, 60);
  const date = DATE.test(String(raw?.date)) ? String(raw.date) : "";
  const dueDate = DATE.test(String(raw?.dueDate)) ? String(raw.dueDate) : date;
  const amount = r2(Number(raw?.amount) || 0);
  const subTotal = raw?.subTotal === undefined || raw?.subTotal === null || raw?.subTotal === "" ? amount : r2(Number(raw.subTotal) || 0);
  if (!docNo) return "ไม่มีเลขที่เอกสาร";
  if (!date) return "วันที่เอกสารไม่ถูกต้อง";
  if (!(amount > 0) || amount > 1e11) return "ยอดค้างไม่ถูกต้อง";
  if (subTotal < 0 || subTotal > amount + 0.009) return "ยอดก่อน VAT ไม่ถูกต้อง";
  return { docNo, date, dueDate, partyName: str(raw?.partyName, 200), taxId: str(raw?.taxId, 13).replace(/\D/g, ""), branchCode: str(raw?.branchCode, 5) || "00000", amount, subTotal, note: str(raw?.note, 300) };
}

function partyMatcher(records: Record<string, any>[]) {
  const byTax = new Map<string, Record<string, any>[]>();
  const byName = new Map<string, Record<string, any>[]>();
  for (const r of records) {
    const tax = String(r.taxId || r.tax_id || "").replace(/\D/g, "");
    if (tax) { const k = `${tax}|${r.branchCode || r.branch_code || "00000"}`; byTax.set(k, [...(byTax.get(k) || []), r]); }
    for (const n of [r.name, r.customerName, r.supplierName, r.legalName]) {
      const k = normName(n);
      if (k && !(byName.get(k) || []).includes(r)) byName.set(k, [...(byName.get(k) || []), r]);
    }
  }
  return (it: Item, label: string): Record<string, any> | string => {
    if (it.taxId) {
      const hit = byTax.get(`${it.taxId}|${it.branchCode}`) || [];
      if (hit.length === 1) return hit[0];
      if (hit.length > 1) return `พบ${label}เลขผู้เสียภาษี ${it.taxId} มากกว่า 1 รายการ`;
    }
    const hit = byName.get(normName(it.partyName)) || [];
    if (hit.length === 1) return hit[0];
    if (hit.length > 1) return `ชื่อ${label} "${it.partyName}" ซ้ำกันในระบบ — ระบุเลขผู้เสียภาษี`;
    return `ไม่พบ${label} "${it.partyName}" ในระบบ — นำเข้า${label}ก่อน`;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ยอดยกมาบันทึกได้เฉพาะฝ่ายบัญชี");
    const action = str(body.action, 20);
    const base = `companies/${companyId}`;
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "status") {
      const col = (c: string) => adminDb.collection(`${base}/${c}`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      const [journals, invoices, expenses, products] = await Promise.all([col("journal_entries"), col("invoices"), col("expenses"), listRecords("products", companyId)]);
      const tb = journals.filter((j) => j.reference === OPENING_TB_REF && live(j))
        .map((j) => ({ id: j.id, journalNo: j.journalNo || j.id, date: j.date, status: j.status || "", total: r2(Number(j.totalDebit) || 0) }));
      // ยอดบัญชีคุม: ลงบัญชีแล้ว และรวมรายการร่าง (ยังไม่อนุมัติ)
      const balanceOf = (lines: { code: string; debit: number; credit: number }[], code: string) => r2(lines.filter((l) => l.code === code).reduce((s, l) => s + l.debit - l.credit, 0));
      const posted = postingLines(journals).lines;
      const withDraft = postingLines(journals.map((j) => (String(j.status || "").toLowerCase() === "draft" ? { ...j, status: "posted" } : j))).lines;
      const ar = receivableRows(invoices).reduce((s, r) => s + Math.max(0, r.outstanding), 0);
      const ap = payableRows(expenses).reduce((s, r) => s + Math.max(0, r.outstanding), 0);
      const inv = inventoryValuation(products).totalValue;
      const rows = [
        { ...reconcileRow("ลูกหนี้การค้า", "1131-00", balanceOf(posted, "1131-00"), ar), glWithDraft: balanceOf(withDraft, "1131-00") },
        { ...reconcileRow("เจ้าหนี้การค้า", "2111-00", -balanceOf(posted, "2111-00"), ap), glWithDraft: -balanceOf(withDraft, "2111-00") },
        { ...reconcileRow("สินค้าคงเหลือ", "1141-00", balanceOf(posted, "1141-00"), inv), glWithDraft: balanceOf(withDraft, "1141-00") },
      ];
      const openAr = invoices.filter((i) => i.docKind === OPENING_DOC_KIND && live(i));
      const openAp = expenses.filter((e) => e.documentType === "Opening" && live(e));
      const sum = (xs: any[], k: string) => r2(xs.reduce((s, x) => s + (Number(x[k]) || 0), 0));
      return NextResponse.json({
        success: true, tb,
        ar: { count: openAr.length, total: sum(openAr, "grandTotal"), outstanding: sum(openAr, "balance") },
        ap: { count: openAp.length, total: sum(openAp, "totalAmount"), outstanding: sum(openAp, "balance") },
        reconcile: rows,
      });
    }

    if (action === "ar" || action === "ap") {
      const raw: any[] = Array.isArray(body.items) ? body.items : [];
      if (!raw.length) throw new ApiAuthError(400, "ไม่มีรายการ");
      if (raw.length > 300) throw new ApiAuthError(400, "ส่งได้ครั้งละไม่เกิน 300 รายการ");
      const label = action === "ar" ? "ลูกค้า" : "ผู้ขาย";
      const match = partyMatcher(await listRecords(action === "ar" ? "customers" : "suppliers", companyId));
      const results: { index: number; ok: boolean; id?: string; error?: string }[] = [];
      const plans: { index: number; id: string; data: Record<string, any> }[] = [];
      raw.forEach((r, index) => {
        const it = cleanItem(r);
        if (typeof it === "string") return results.push({ index, ok: false, error: it });
        const party = match(it, label);
        if (typeof party === "string") return results.push({ index, ok: false, error: party });
        const snap = partySnapshot(party, { name: it.partyName, taxId: it.taxId });
        const id = openingDocId(action, it.docNo, party.id);
        if (plans.some((p) => p.id === id)) return results.push({ index, ok: false, error: `เลขที่ ${it.docNo} ซ้ำในชุดนี้` });
        const common = {
          companyId, docKind: OPENING_DOC_KIND, isOpeningBalance: true, documentNo: it.docNo, issueDate: it.date, dueDate: it.dueDate,
          subTotal: it.subTotal, vatAmount: 0, totalAmount: it.amount, paidAmount: 0, balance: it.amount, paymentStatus: "unpaid",
          remarks: it.note || "ยอดยกมาจากระบบเดิม", isSample: false, isDeleted: false, createdBy: apiUser.uid, createdAt: now, updatedAt: now,
        };
        plans.push({
          index, id,
          data: action === "ar"
            ? { ...common, invoiceNo: it.docNo, customerId: party.id, customerName: snap.name, customerSnapshot: snap, grandTotal: it.amount, status: "issued" }
            : {
              ...common, id, expenseId: id, documentType: "Opening", apPosted: true, supplierId: party.id, supplierName: snap.name, vendor: snap.name,
              taxId: snap.taxId, vendorType: snap.corporate ? "CORPORATE" : "INDIVIDUAL", supplierInvoiceNo: it.docNo, description: `ยอดยกมา ${it.docNo}`,
              issuedAt: it.date, status: "Awaiting Payment",
            },
        });
      });
      const colName = action === "ar" ? "invoices" : "expenses";
      if (plans.length) {
        const snaps = await adminDb.getAll(...plans.map((p) => adminDb.doc(`${base}/${colName}/${p.id}`)));
        const batch = adminDb.batch();
        plans.forEach((p, i) => {
          if (snaps[i].exists) { results.push({ index: p.index, ok: false, error: `มีรายการยกมาเลขที่นี้แล้ว (${p.id})` }); return; }
          batch.create(snaps[i].ref, p.data);
          results.push({ index: p.index, ok: true, id: p.id });
        });
        await batch.commit();
      }
      const created = results.filter((r) => r.ok);
      if (created.length) await auditServer.logCreate(apiUser.uid, companyId, action === "ar" ? "OPENING_AR" : "OPENING_AP", `${created.length} รายการ`, { ids: created.map((r) => r.id), total: r2(plans.filter((p) => created.some((c) => c.id === p.id)).reduce((s, p) => s + p.data.totalAmount, 0)) });
      return NextResponse.json({ success: true, created: created.length, results: results.sort((a, b) => a.index - b.index) });
    }

    if (action === "clear") {
      const kind = str(body.kind, 4);
      if (kind !== "ar" && kind !== "ap") throw new ApiAuthError(400, "ระบุประเภทยอดยกมา");
      const snap = kind === "ar"
        ? await adminDb.collection(`${base}/invoices`).where("docKind", "==", OPENING_DOC_KIND).get()
        : await adminDb.collection(`${base}/expenses`).where("documentType", "==", "Opening").get();
      const paid = snap.docs.filter((d) => (Number(d.data().paidAmount) || 0) > 0 || (d.data().receiptRefs || d.data().paymentRefs || []).length);
      const removable = snap.docs.filter((d) => !paid.includes(d));
      for (let i = 0; i < removable.length; i += 400) {
        const batch = adminDb.batch();
        removable.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      if (removable.length) await auditServer.logDelete(apiUser.uid, companyId, kind === "ar" ? "OPENING_AR" : "OPENING_AP", `${removable.length} รายการ`);
      return NextResponse.json({ success: true, removed: removable.length, kept: paid.length });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[OPENING_BALANCES_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกยอดยกมาไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
