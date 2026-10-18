import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { voidOrReverseJournal } from "@/lib/journal-reversal.server";
import { getCompanyCustomer } from "@/lib/credit-limit.server";
import { sellerSnapshot } from "@/lib/documents/seller.server";
import { addressText } from "@/lib/documents/party";
import { advanceBillAmounts, advanceRecovery, billingSummary, progressBillAmounts, retentionReleaseAmounts, type BillRecord } from "@/lib/project-billing";
import { auditServer } from "@/services/audit.server";
import { normalizeProjectStatus, PROJECT_STATUS_TH } from "@/lib/project-status";

/** เรียกเก็บเงินได้เมื่อโครงการอนุมัติแล้ว (อนุมัติ / กำลังดำเนินการ / ปิดโครงการ — เบิกคืนเงินประกันหลังปิด) */
const BILLABLE = ["Approved", "In Progress", "Completed"];

/**
 * [API-SERVER] เรียกเก็บเงินตามงวดงานของโครงการ
 * POST /api/projects/billing
 *  - { action: "status", projectDocId }                                   งวดงาน + ใบแจ้งหนี้ + สรุปยอด
 *  - { action: "settings", projectDocId, retentionPercent, advancePercent?, whtRate? }  เงินประกันผลงาน % เงินล่วงหน้า % และอัตราหัก ณ ที่จ่ายที่คาดว่าลูกค้าหัก
 *  - { action: "billAdvance", projectDocId, issueDate?, dueDays?, note? }   ใบแจ้งหนี้เงินล่วงหน้า (ก่อนเรียกเก็บงวดแรก) หักคืนในแต่ละงวดตาม %
 *  - { action: "bill", projectDocId, milestoneId, issueDate?, dueDays?, note? }   ออกใบแจ้งหนี้งวดงาน (PB)
 *  - { action: "releaseRetention", projectDocId, issueDate?, dueDays?, note? }  ใบแจ้งหนี้เบิกคืนเงินประกันผลงาน
 *  - { action: "cancel", projectDocId, invoiceDocId, reason }              ยกเลิกใบที่ยังไม่รับชำระ
 *
 * งานโครงการเป็นงานบริการ/จ้างทำของ (ม.78/1): ใบแจ้งหนี้ไม่ใช่ใบกำกับภาษี
 *   VAT บันทึกเป็น "ภาษีขายยังไม่ถึงกำหนด" (2123-00) แล้วโอนเป็นภาษีขายตอนรับชำระ (ใบเสร็จรับเงิน/ใบกำกับภาษี)
 * บัญชีตอนออกใบงวดงาน: Dr ลูกหนี้ 1131 (G) + Dr ลูกหนี้เงินประกันผลงาน 1133 (R) / Cr รายได้ค่าบริการ 4112 (W) + Cr ภาษีขายยังไม่ถึงกำหนด 2123 (V)
 *   งวดที่หักคืนเงินล่วงหน้า (D): เพิ่ม Dr เงินรับล่วงหน้าจากลูกค้า 2151 (D) และ VAT คิดจากยอดหลังหัก
 * บัญชีตอนออกใบเงินล่วงหน้า: Dr ลูกหนี้ 1131 (G) / Cr เงินรับล่วงหน้าจากลูกค้า 2151 (B) + Cr ภาษีขายยังไม่ถึงกำหนด 2123 (V)
 * บัญชีตอนเบิกคืนเงินประกัน:  Dr ลูกหนี้ 1131 (G) / Cr ลูกหนี้เงินประกันผลงาน 1133 (B) + Cr ภาษีขายยังไม่ถึงกำหนด 2123 (V)
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400e3).toISOString().slice(0, 10);
const WHT_RATES = [0, 1, 2, 3, 5];

async function projectBills(companyId: string, projectDocId: string) {
  const q = await adminDb.collection(`companies/${companyId}/invoices`).where("projectDocId", "==", projectDocId).get();
  return q.docs.map((d) => ({ docId: d.id, ...d.data() }) as any).filter((b) => ["progress", "retention", "advance"].includes(b.docKind));
}

const asRecord = (b: any): BillRecord => ({
  invoiceNo: b.invoiceNo, docKind: b.docKind, milestoneId: b.milestoneId, retentionAmount: Number(b.retentionAmount) || 0,
  workValue: Number(b.workValue) || 0, grandTotal: Number(b.grandTotal) || 0, paidAmount: Number(b.paidAmount) || 0, status: b.status,
  advanceAmount: Number(b.advanceAmount) || 0, advancePercent: Number(b.advancePercent) || 0,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 30);
    const projectDocId = str(body.projectDocId, 120);
    if (!projectDocId || projectDocId.includes("/")) throw new ApiAuthError(400, "ไม่พบโครงการ");
    const projectRef = adminDb.doc(`companies/${companyId}/projects/${projectDocId}`);
    const canView = ["projects:view", "finance:view", "sales:view"].some((p) => can(apiUser.roles, p as any));
    const canBill = can(apiUser.roles, "finance:edit") || can(apiUser.roles, "sales:edit");
    if (!canView) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    if (action === "status") {
      const [p, bills] = await Promise.all([projectRef.get(), projectBills(companyId, projectDocId)]);
      if (!p.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
      const d = p.data()!;
      const milestones = (Array.isArray(d.milestones) ? d.milestones : []).map((m: any) => ({ id: str(m.id), name: str(m.name), endDate: str(m.endDate), progress: Number(m.progress) || 0, amount: Number(m.amount) || 0 }));
      const billing = { retentionPercent: Number(d.billing?.retentionPercent) || 0, advancePercent: Number(d.billing?.advancePercent) || 0, whtRate: Number(d.billing?.whtRate) || 0 };
      const s = billingSummary(milestones, bills.map(asRecord));
      const ps = normalizeProjectStatus(d.status);
      return NextResponse.json({
        success: true, canBill, billing, milestones, billable: BILLABLE.includes(ps), projectStatus: PROJECT_STATUS_TH[ps],
        summary: { ...s, billedMilestones: Array.from(s.billedMilestones) },
        bills: bills.map((b) => ({
          docId: b.docId, invoiceNo: b.invoiceNo, docKind: b.docKind, milestoneId: b.milestoneId || "", milestoneName: b.milestoneName || "",
          issueDate: b.issueDate, dueDate: b.dueDate, workValue: b.workValue || 0, retentionAmount: b.retentionAmount || 0, advanceAmount: b.advanceAmount || 0, subTotal: b.subTotal, vatAmount: b.vatAmount,
          grandTotal: b.grandTotal, paidAmount: b.paidAmount || 0, balance: b.balance ?? b.grandTotal, paymentStatus: b.paymentStatus, status: b.status,
          receiptRefs: b.receiptRefs || [],
        })).sort((a, b) => String(a.issueDate).localeCompare(String(b.issueDate)) || String(a.invoiceNo).localeCompare(String(b.invoiceNo))),
      });
    }

    if (!canBill) throw new ApiAuthError(403, "การเรียกเก็บเงินต้องมีสิทธิ์ฝ่ายขายหรือฝ่ายบัญชี");
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "settings") {
      const retentionPercent = Number(body.retentionPercent);
      const advancePercent = Number(body.advancePercent ?? 0);
      const whtRate = Number(body.whtRate ?? 0);
      if (!Number.isFinite(retentionPercent) || retentionPercent < 0 || retentionPercent > 20) throw new ApiAuthError(400, "เงินประกันผลงานต้องอยู่ระหว่าง 0–20%");
      if (!Number.isFinite(advancePercent) || advancePercent < 0 || advancePercent > 50) throw new ApiAuthError(400, "เงินล่วงหน้าต้องอยู่ระหว่าง 0–50%");
      if (!WHT_RATES.includes(whtRate)) throw new ApiAuthError(400, "อัตราหัก ณ ที่จ่ายไม่ถูกต้อง");
      const p = await projectRef.get();
      if (!p.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
      // ออกใบเงินล่วงหน้าแล้ว: เปลี่ยน % ไม่ได้ (การหักคืนใช้ % ตามใบเงินล่วงหน้า)
      const prev = Number(p.data()!.billing?.advancePercent) || 0;
      if (r2(advancePercent) !== prev && (await projectBills(companyId, projectDocId)).some((b) => b.docKind === "advance" && String(b.status).toLowerCase() !== "cancelled")) {
        throw new ApiAuthError(409, "ออกใบแจ้งหนี้เงินล่วงหน้าแล้ว เปลี่ยน % เงินล่วงหน้าไม่ได้");
      }
      await projectRef.update({ "billing.retentionPercent": r2(retentionPercent), "billing.advancePercent": r2(advancePercent), "billing.whtRate": whtRate, updatedAt: now, updatedBy: apiUser.uid });
      await auditServer.logUpdate(apiUser.uid, companyId, "PROJECT_BILLING", projectDocId, p.data()!.billing || null, { retentionPercent, advancePercent, whtRate });
      return NextResponse.json({ success: true });
    }

    if (action === "bill" || action === "releaseRetention" || action === "billAdvance") {
      const issueDate = isDate(body.issueDate) ? body.issueDate : todayBkk();
      const dueDays = Math.min(180, Math.max(0, Math.round(Number(body.dueDays ?? 30))));
      await assertPeriodOpen(companyId, issueDate);
      const pre = await projectRef.get();
      if (!pre.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
      const pd = pre.data()!;
      const ps = normalizeProjectStatus(pd.status);
      if (!BILLABLE.includes(ps)) throw new ApiAuthError(409, `โครงการสถานะ "${PROJECT_STATUS_TH[ps]}" ยังเรียกเก็บเงินไม่ได้ (ต้องอนุมัติโครงการก่อน)`);
      if (!pd.customerId) throw new ApiAuthError(400, "โครงการยังไม่ได้ระบุลูกค้า");
      const [cust, company, seller, take] = await Promise.all([
        getCompanyCustomer(companyId, String(pd.customerId)), adminDb.doc(`companies/${companyId}`).get(), sellerSnapshot(companyId), prepareSequence("PB", companyId),
      ]);
      const c = cust?.data() || {};
      const customerSnapshot = {
        name: str(c.name || c.customerName || pd.customerName, 200), taxId: str(c.taxId || c.tax_id).replace(/\D/g, ""),
        branch: str(c.branch || c.branchName || (c.branchCode && c.branchCode !== "00000" ? c.branchCode : "สำนักงานใหญ่")), branchCode: str(c.branchCode || c.branch_code),
        address: addressText(c),
      };
      const vatRegistered = company.data()?.vatRegistered !== false;
      const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();

      const result = await adminDb.runTransaction(async (tx) => {
        const p = await tx.get(projectRef);
        const d = p.data()!;
        const bills = (await tx.get(adminDb.collection(`companies/${companyId}/invoices`).where("projectDocId", "==", projectDocId))).docs
          .map((x) => x.data()).filter((b) => ["progress", "retention", "advance"].includes(b.docKind));
        const milestones = (Array.isArray(d.milestones) ? d.milestones : []).map((m: any) => ({ ...m, id: str(m.id), amount: Number(m.amount) || 0 }));
        const summary = billingSummary(milestones, bills.map(asRecord));
        const retentionPercent = Number(d.billing?.retentionPercent) || 0;
        let amounts, milestone: any = null, lineText = "", advancePercent = 0;
        if (action === "bill") {
          milestone = milestones.find((m: any) => m.id === str(body.milestoneId, 120));
          if (!milestone) throw new ApiAuthError(404, "ไม่พบงวดงาน");
          if (summary.billedMilestones.has(milestone.id)) throw new ApiAuthError(409, `งวด "${milestone.name}" ออกใบแจ้งหนี้แล้ว`);
          if (!(milestone.amount > 0)) throw new ApiAuthError(400, `งวด "${milestone.name}" ยังไม่ได้กำหนดจำนวนเงิน`);
          // หักคืนเงินล่วงหน้าตาม % ในใบเงินล่วงหน้า งวดสุดท้ายที่ยังไม่เรียกเก็บหักที่เหลือทั้งหมด
          const unbilledOthers = milestones.filter((m: any) => m.id !== milestone.id && !summary.billedMilestones.has(m.id) && m.amount > 0).length;
          const w = progressBillAmounts(milestone.amount, 0, vatRegistered).workValue;
          const deduct = advanceRecovery(w, summary.advancePercent, summary.advanceOutstanding, unbilledOthers === 0);
          amounts = progressBillAmounts(milestone.amount, retentionPercent, vatRegistered, deduct);
          lineText = `ค่างานตามสัญญา งวด: ${str(milestone.name, 200)}`;
        } else if (action === "billAdvance") {
          advancePercent = Number(d.billing?.advancePercent) || 0;
          if (!(advancePercent > 0)) throw new ApiAuthError(400, "ยังไม่ได้กำหนด % เงินล่วงหน้า");
          if (bills.some((b) => b.docKind === "advance" && String(b.status).toLowerCase() !== "cancelled")) throw new ApiAuthError(409, "ออกใบแจ้งหนี้เงินล่วงหน้าไปแล้ว");
          if (bills.some((b) => b.docKind === "progress" && String(b.status).toLowerCase() !== "cancelled")) throw new ApiAuthError(409, "เรียกเก็บงวดงานไปแล้ว ออกใบเงินล่วงหน้าไม่ได้ (ต้องออกก่อนงวดแรก)");
          if (!(summary.contract > 0)) throw new ApiAuthError(400, "ยังไม่ได้กำหนดยอดเงินของงวดงาน");
          amounts = advanceBillAmounts(summary.contract, advancePercent, vatRegistered);
          lineText = `เงินล่วงหน้าตามสัญญา ${advancePercent}% ของมูลค่างาน`;
        } else {
          if (!(summary.retentionOutstanding > 0.009)) throw new ApiAuthError(409, "ไม่มีเงินประกันผลงานคงค้างให้เบิกคืน");
          amounts = retentionReleaseAmounts(summary.retentionOutstanding, vatRegistered);
          lineText = "เบิกคืนเงินประกันผลงาน";
        }
        const seq = await take(tx);
        const no = seq.number;
        seq.commit();
        const projectName = str(d.projectName || d.title, 200);
        tx.create(adminDb.doc(`companies/${companyId}/invoices/${no}`), {
          id: no, companyId,
          invoiceId: no, invoiceNo: no, documentNo: no,
          docKind: action === "bill" ? "progress" : action === "billAdvance" ? "advance" : "retention",
          // ใบแจ้งหนี้งานบริการ: ไม่ใช่ใบกำกับภาษี VAT เกิดตอนรับชำระ
          vatTiming: "receipt", isTaxInvoice: false, vatRealized: 0,
          projectDocId, projectId: str(d.projectId || projectDocId), projectName,
          ...(milestone ? { milestoneId: milestone.id, milestoneName: str(milestone.name, 200), milestoneAmount: milestone.amount } : {}),
          customerSnapshot, customerId: str(pd.customerId), customerName: customerSnapshot.name,
          sellerSnapshot: seller,
          issueDate, dueDate: addDays(issueDate, dueDays),
          items: [{ name: lineText, details: projectName ? `โครงการ ${projectName}` : "", qty: 1, unit: "งาน", price: action === "bill" ? amounts.workValue : amounts.base, itemType: "SERVICE" }],
          isVatRegistered: vatRegistered, vatType: vatRegistered ? "Exclude VAT" : "Non-VAT",
          workValue: amounts.workValue, retentionPercent: action === "bill" ? retentionPercent : 0, retentionAmount: amounts.retention,
          // ใบเงินล่วงหน้า: ยอดเงินล่วงหน้า / ใบงวดงาน: ยอดหักคืนเงินล่วงหน้า
          advanceAmount: action === "billAdvance" ? amounts.base : amounts.advanceDeduct,
          ...(action === "billAdvance" ? { advancePercent } : {}),
          subTotal: amounts.base, vatAmount: amounts.vat, grandTotal: amounts.total,
          expectedWhtRate: Number(d.billing?.whtRate) || 0,
          paidAmount: 0, balance: amounts.total, paymentStatus: "unpaid",
          note: str(body.note, 500),
          journalId: journalRef.id, status: "issued",
          createdBy: apiUser.uid, updatedBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        const items = action === "bill" ? [
          { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: amounts.total, credit: 0 },
          ...(amounts.retention > 0 ? [{ accountCode: "1133-00", accountName: "ลูกหนี้เงินประกันผลงาน", debit: amounts.retention, credit: 0 }] : []),
          ...(amounts.advanceDeduct > 0 ? [{ accountCode: "2151-00", accountName: "เงินรับล่วงหน้าจากลูกค้า", debit: amounts.advanceDeduct, credit: 0 }] : []),
          { accountCode: "4112-00", accountName: "รายได้จากการให้บริการ", debit: 0, credit: amounts.workValue },
          ...(amounts.vat > 0 ? [{ accountCode: "2123-00", accountName: "ภาษีขายยังไม่ถึงกำหนด", debit: 0, credit: amounts.vat }] : []),
        ] : action === "billAdvance" ? [
          { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: amounts.total, credit: 0 },
          { accountCode: "2151-00", accountName: "เงินรับล่วงหน้าจากลูกค้า", debit: 0, credit: amounts.base },
          ...(amounts.vat > 0 ? [{ accountCode: "2123-00", accountName: "ภาษีขายยังไม่ถึงกำหนด", debit: 0, credit: amounts.vat }] : []),
        ] : [
          { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: amounts.total, credit: 0 },
          { accountCode: "1133-00", accountName: "ลูกหนี้เงินประกันผลงาน", debit: 0, credit: amounts.base },
          ...(amounts.vat > 0 ? [{ accountCode: "2123-00", accountName: "ภาษีขายยังไม่ถึงกำหนด", debit: 0, credit: amounts.vat }] : []),
        ];
        const totalDebit = r2(items.reduce((s, i) => s + i.debit, 0));
        tx.set(journalRef, {
          companyId, date: issueDate, bookType: "SV",
          description: `[AUTO] ใบแจ้งหนี้${action === "bill" ? "งวดงาน" : action === "billAdvance" ? "เงินล่วงหน้า" : "เบิกคืนเงินประกันผลงาน"} ${no} โครงการ ${projectName} (${customerSnapshot.name})`,
          reference: no, items, totalDebit, totalCredit: r2(items.reduce((s, i) => s + i.credit, 0)),
          status: "draft", createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        return { invoiceNo: no, ...amounts };
      });
      await auditServer.logCreate(apiUser.uid, companyId, "PROJECT_BILL", result.invoiceNo, { projectDocId, action, ...result });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "cancel") {
      const reason = str(body.reason, 300);
      if (!reason) throw new ApiAuthError(400, "กรุณาระบุเหตุผลการยกเลิก");
      const invRef = adminDb.doc(`companies/${companyId}/invoices/${str(body.invoiceDocId, 120)}`);
      const cancelDate = todayBkk();
      await assertPeriodOpen(companyId, cancelDate);
      const out = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(invRef);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบแจ้งหนี้");
        const inv = snap.data()!;
        if (inv.projectDocId !== projectDocId || !["progress", "retention", "advance"].includes(inv.docKind)) throw new ApiAuthError(400, "ไม่ใช่ใบแจ้งหนี้ของโครงการนี้");
        if (String(inv.status).toLowerCase() === "cancelled") throw new ApiAuthError(409, "ยกเลิกไปแล้ว");
        if ((Number(inv.paidAmount) || 0) > 0) throw new ApiAuthError(409, `${inv.invoiceNo} รับชำระแล้ว ยกเลิกใบเสร็จก่อน`);
        const others = (await tx.get(adminDb.collection(`companies/${companyId}/invoices`).where("projectDocId", "==", projectDocId))).docs
          .map((x) => x.data()).filter((x) => x.invoiceNo !== inv.invoiceNo && String(x.status).toLowerCase() !== "cancelled");
        // เบิกคืนเงินประกันไปแล้ว: ยกเลิกงวดที่หักเงินประกันไม่ได้ (ยอดคืนจะเกินที่หักไว้)
        if (inv.docKind === "progress" && (Number(inv.retentionAmount) || 0) > 0 && others.some((x) => x.docKind === "retention")) {
          throw new ApiAuthError(409, "มีใบเบิกคืนเงินประกันผลงานแล้ว ยกเลิกใบเบิกคืนก่อน");
        }
        // ใบเงินล่วงหน้าที่ถูกหักคืนในงวดงานแล้ว: ยกเลิกงวดเหล่านั้นก่อน
        if (inv.docKind === "advance" && others.some((x) => x.docKind === "progress" && (Number(x.advanceAmount) || 0) > 0)) {
          throw new ApiAuthError(409, "มีงวดงานที่หักคืนเงินล่วงหน้าแล้ว ยกเลิกงวดเหล่านั้นก่อน");
        }
        const j = inv.journalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${inv.journalId}`)) : null;
        const journal = voidOrReverseJournal(tx, companyId, j, { date: cancelDate, description: `[AUTO] ยกเลิกใบแจ้งหนี้ ${inv.invoiceNo}: ${reason}`, reference: inv.invoiceNo, uid: apiUser.uid, reason });
        tx.update(invRef, { status: "cancelled", balance: 0, cancelReason: reason, cancelDate, cancelledBy: apiUser.uid, cancelledAt: now, updatedAt: now, ...(journal.reversalId ? { reversalJournalId: journal.reversalId } : {}) });
        return { invoiceNo: inv.invoiceNo, journal: journal.mode };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "PROJECT_BILL", out.invoiceNo, null, { status: "cancelled", reason });
      return NextResponse.json({ success: true, ...out });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (String(err?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    console.error("[PROJECT_BILLING]", err);
    return NextResponse.json({ success: false, error: "ทำรายการไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
