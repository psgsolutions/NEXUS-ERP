import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { voidOrReverseJournal } from "@/lib/journal-reversal.server";
import { processStockMovements } from "@/lib/stock-service";
import { isStockItem } from "@/lib/product-kind";
import { auditServer } from "@/services/audit.server";
import { CNDN_TYPE_TH, applyArDelta, arPaymentStatus } from "@/lib/cndn";

/**
 * [API-SERVER] ยกเลิกใบลดหนี้ / ใบเพิ่มหนี้
 * Endpoint: POST /api/sales/cndn/cancel
 * body: { companyId, cndnId, reason, cancelDate? (YYYY-MM-DD, ค่าเริ่มต้นวันนี้) }
 *
 * ทำในทรานแซกชันเดียว:
 *  - คืนผลต่อใบกำกับภาษี: ใบลดหนี้ -> ยอดค้างเพิ่มกลับ, ใบเพิ่มหนี้ -> ยอดค้างลดลง
 *    ยอดค้างชำระกับยอดค้างคืนลูกค้า (refundDue) หักกลบกัน — ใบเพิ่มหนี้ที่ลูกค้าชำระแล้ว ส่วนที่ชำระเกินเป็นยอดค้างคืน
 *  - รายการบัญชีเดิม: ยังไม่อนุมัติ -> ยกเลิกทิ้ง, ลงบัญชีแล้ว -> รายการกลับบัญชีลงวันที่ยกเลิก (ภาษีขายปรับในเดือนที่ยกเลิก)
 *  - เอกสารคงอยู่พร้อมสถานะ cancelled (เลขที่ไม่ถูกนำกลับมาใช้ ตามข้อกำหนดเลขเรียงต่อเนื่อง)
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:billing") && !can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ออกเอกสารเรียกเก็บเงินได้เฉพาะฝ่ายบัญชี/การเงินหรือฝ่ายขายที่มีสิทธิ์วางบิล");

    const cndnId = str(body.cndnId, 120);
    const reason = str(body.reason, 300);
    const cancelDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.cancelDate || "")) ? body.cancelDate : todayBkk();
    if (!cndnId) throw new ApiAuthError(400, "ไม่พบเอกสารที่ต้องการยกเลิก");
    if (reason.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลการยกเลิก");
    if (cancelDate > todayBkk()) throw new ApiAuthError(400, "ยกเลิกล่วงหน้าไม่ได้");
    await assertPeriodOpen(companyId, cancelDate);

    const docRef = adminDb.doc(`companies/${companyId}/cndn/${cndnId}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    // ใบลดหนี้ที่รับสินค้าคืนเข้าคลัง: ยกเลิก = ตัดสินค้าออกจากคลังกลับ (ทรานแซกชันเดียวกับการยกเลิก)
    const pre = (await docRef.get()).data() || {};
    const backOut = pre.stockReturned === true && String(pre.status || "").toLowerCase() !== "cancelled"
      ? (Array.isArray(pre.items) ? pre.items : []).filter((l: any) => l.productId && isStockItem({ itemType: l.itemType }) && Number(l.qty) > 0)
      : [];

    let result: any;
    let pending: ((tx: admin.firestore.Transaction) => void) | null = null;
    const reads = async (tx: admin.firestore.Transaction) => {
      // ---- อ่าน ----
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบลดหนี้/ใบเพิ่มหนี้");
      const d = snap.data()!;
      const type: "CN" | "DN" = d.type === "DN" ? "DN" : "CN";
      const label = CNDN_TYPE_TH[type];
      const docNo = d.documentNo || cndnId;
      if (d.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง`);
      if (String(d.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, `${docNo} ถูกยกเลิกไปแล้ว`);
      if (cancelDate < String(d.issueDate || "").slice(0, 10)) throw new ApiAuthError(400, `วันที่ยกเลิกต้องไม่ก่อนวันที่ออก${label}`);

      const invRef = adminDb.doc(`companies/${companyId}/invoices/${d.invoiceDocId}`);
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists) throw new ApiAuthError(404, `ไม่พบใบกำกับภาษี ${d.invoiceNo || ""} ที่อ้างอิง`);
      const inv = invSnap.data()!;
      if (inv.isDeleted === true || String(inv.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, `ใบกำกับภาษี ${d.invoiceNo} ถูกยกเลิกแล้ว`);
      const journalSnap = d.journalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${d.journalId}`)) : null;
      const cogsSnap = d.cogsJournalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${d.cogsJournalId}`)) : null;

      // ---- คำนวณ ----
      const amount = r2(Number(d.amount) || 0);          // ก่อน VAT
      const total = r2(Number(d.totalAmount) || 0);      // รวม VAT
      const paid = r2(Number(inv.paidAmount) || 0);
      const balanceBefore = r2(inv.balance !== undefined ? Number(inv.balance) : (Number(inv.grandTotal) || 0) - paid);
      const ar = applyArDelta(balanceBefore, Number(inv.refundDue) || 0, type === "CN" ? total : -total);
      const balanceAfter = ar.balance;

      // ---- เขียน (หลังการอ่านของการตัดสต็อก) ----
      pending = (tx) => {
      tx.update(invRef, {
        balance: balanceAfter,
        refundDue: ar.refundDue,
        paymentStatus: arPaymentStatus(balanceAfter, paid),
        ...(type === "CN"
          ? { creditNoteTotal: r2(Math.max(0, (Number(inv.creditNoteTotal) || 0) - amount)) }
          : { debitNoteTotal: r2(Math.max(0, (Number(inv.debitNoteTotal) || 0) - amount)) }),
        adjustmentRefs: admin.firestore.FieldValue.arrayRemove(docNo),
        ...(type === "CN" ? Object.fromEntries((Array.isArray(d.items) ? d.items : []).map((l: any) => [`returnedQty.${l.lineNo}`, admin.firestore.FieldValue.increment(-(Number(l.qty) || 0))])) : {}),
        updatedAt: now, updatedBy: apiUser.uid,
      });
      const cogs = cogsSnap ? voidOrReverseJournal(tx, companyId, cogsSnap, { date: cancelDate, description: `[AUTO] ยกเลิกการรับคืนสินค้าตาม${label} ${docNo}`, reference: docNo, uid: apiUser.uid, reason }) : null;
      const journal = voidOrReverseJournal(tx, companyId, journalSnap, {
        date: cancelDate,
        description: `[AUTO] ยกเลิก${label} ${docNo} อ้างอิง ${d.invoiceNo || ""} (${d.customerName || ""}): ${reason}`,
        reference: docNo,
        uid: apiUser.uid,
        reason,
      });
      tx.update(docRef, {
        status: "cancelled",
        cancelReason: reason,
        cancelDate,
        cancelledBy: apiUser.uid,
        cancelledAt: now,
        journalAction: journal.mode,
        ...(journal.reversalId ? { reversalJournalId: journal.reversalId } : {}),
        ...(cogs?.reversalId ? { cogsReversalJournalId: cogs.reversalId } : {}),
        ...(backOut.length ? { stockReversed: true } : {}),
        updatedAt: now,
      });
      result = { docNo, type, invoiceNo: d.invoiceNo, balanceAfter, refundDue: ar.refundDue, journal: journal.mode, reversalJournalId: journal.reversalId || null, stockReversed: backOut.length > 0 };
      };
    };
    const writes = (tx: admin.firestore.Transaction) => pending!(tx);
    if (backOut.length) {
      await processStockMovements(backOut.map((l: any) => ({
        companyId, productId: l.productId, type: "OUT" as const, quantity: Number(l.qty), unitCost: Number(l.unitCost) || 0,
        referenceId: `CN-CANCEL:${cndnId}`, userId: apiUser.email || apiUser.uid, skipGl: true,
      })), writes, reads);
    } else {
      await adminDb.runTransaction(async (tx) => { await reads(tx); writes(tx); });
    }

    await auditServer.logUpdate(apiUser.uid, companyId, result.type === "CN" ? "CREDIT_NOTE" : "DEBIT_NOTE", result.docNo, { status: "issued" }, { status: "cancelled", reason, journal: result.journal });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[CNDN_CANCEL_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ยกเลิกเอกสารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
