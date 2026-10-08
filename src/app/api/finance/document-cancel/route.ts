import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { voidOrReverseJournal } from "@/lib/journal-reversal.server";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ยกเลิกใบเสร็จรับเงิน / ใบสำคัญจ่าย
 * Endpoint: POST /api/finance/document-cancel
 * body: { companyId, kind: "receipt" | "payment", docNo, reason, cancelDate? (YYYY-MM-DD, ค่าเริ่มต้นวันนี้) }
 *
 * ทำใน transaction เดียว:
 *  - คืนยอดค้างให้ใบแจ้งหนี้ / รายการค่าใช้จ่าย (paidAmount, balance, สถานะ)
 *  - รายการบัญชีเดิม: ยังไม่อนุมัติ -> ยกเลิกทิ้ง, ลงบัญชีแล้ว -> สร้างรายการกลับบัญชีลงวันที่ยกเลิก
 *  - ใบสำคัญจ่าย: หนังสือรับรองหัก ณ ที่จ่ายที่ออกพร้อมการจ่ายถูกยกเลิก
 *  - เอกสารคงอยู่พร้อมสถานะ cancelled (เลขที่ไม่ถูกนำกลับมาใช้)
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับการยกเลิกเอกสาร");

    const kind = body.kind === "payment" ? "payment" : body.kind === "receipt" ? "receipt" : "";
    const docNo = str(body.docNo, 120);
    const reason = str(body.reason, 300);
    const cancelDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.cancelDate || "")) ? body.cancelDate : todayBkk();
    if (!kind || !docNo) throw new ApiAuthError(400, "ไม่พบเอกสารที่ต้องการยกเลิก");
    if (!reason) throw new ApiAuthError(400, "กรุณาระบุเหตุผลการยกเลิก");

    const isReceipt = kind === "receipt";
    const docRef = adminDb.doc(`companies/${companyId}/${isReceipt ? "receipts" : "payments"}/${docNo}`);
    const label = isReceipt ? "ใบเสร็จ" : "ใบสำคัญจ่าย";
    const now = admin.firestore.FieldValue.serverTimestamp();

    // งวดของวันที่ยกเลิกต้องเปิดอยู่ (รายการกลับบัญชีลงวันนี้)
    await assertPeriodOpen(companyId, cancelDate);

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new ApiAuthError(404, `ไม่พบ${label} ${docNo}`);
      const d = snap.data()!;
      if (d.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง`);
      if (String(d.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, `${docNo} ถูกยกเลิกไปแล้ว`);
      const lines: any[] = Array.isArray(d.lines) ? d.lines : [];
      if (!lines.length) throw new ApiAuthError(400, `${docNo} ไม่มีรายการที่ระบบบันทึกไว้ จึงยกเลิกอัตโนมัติไม่ได้`);

      const targetRefs = lines.map((l) => adminDb.doc(`companies/${companyId}/${isReceipt ? "invoices" : "expenses"}/${isReceipt ? l.invoiceDocId : l.expenseDocId}`));
      const targetSnaps = await tx.getAll(...targetRefs);
      const journalSnap = d.journalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${d.journalId}`)) : null;

      const certs: string[] = isReceipt ? [] : Array.isArray(d.whtCertificates) ? d.whtCertificates : [];

      // ---- เขียน ----
      const restored = lines.map((l, i) => {
        const t = targetSnaps[i];
        const no = isReceipt ? l.invoiceNo : l.expenseNo;
        if (!t.exists) return { no, skipped: true };
        const x = t.data()!;
        const total = round2(Number(isReceipt ? x.grandTotal : x.totalAmount) || 0);
        const paid = round2(Math.max(0, (Number(x.paidAmount) || 0) - (Number(l.amount) || 0)));
        const balance = round2(Math.max(0, total - paid));
        const paymentStatus = paid <= 0.009 ? "unpaid" : balance <= 0.009 ? "paid" : "partial";
        const update: Record<string, any> = {
          paidAmount: paid,
          balance,
          paymentStatus,
          updatedAt: now,
          updatedBy: apiUser.uid,
        };
        if (isReceipt) {
          update.receiptRefs = admin.firestore.FieldValue.arrayRemove(docNo);
        } else {
          update.paymentRefs = admin.firestore.FieldValue.arrayRemove(docNo);
          update.status = paid <= 0.009 ? "Awaiting Payment" : balance <= 0.009 ? "Paid" : "Partially Paid";
          update.whtPaidAmount = round2(Math.max(0, (Number(x.whtPaidAmount) || 0) - (Number(l.whtAmount) || 0)));
          if (certs.length) update.paymentWhtIds = admin.firestore.FieldValue.arrayRemove(...certs);
        }
        tx.update(targetRefs[i], update);
        return { no, paymentStatus };
      });

      const journal = voidOrReverseJournal(tx, companyId, journalSnap, {
        date: cancelDate,
        description: `[AUTO] ยกเลิก${label} ${docNo}${isReceipt ? ` (${d.customerName || ""})` : ` (${d.payeeName || ""})`}: ${reason}`,
        reference: docNo,
        uid: apiUser.uid,
        reason,
      });

      certs.forEach((c) => tx.set(adminDb.doc(`companies/${companyId}/withholding_taxes/${c}`), {
        status: "Cancelled", isDeleted: true, cancelReason: `ยกเลิก${label} ${docNo}: ${reason}`, cancelledBy: apiUser.uid, cancelledAt: now, updatedAt: now,
      }, { merge: true }));

      tx.update(docRef, {
        status: "cancelled",
        cancelReason: reason,
        cancelDate,
        cancelledBy: apiUser.uid,
        cancelledAt: now,
        journalAction: journal.mode,
        ...(journal.reversalId ? { reversalJournalId: journal.reversalId } : {}),
        updatedAt: now,
      });

      return { docNo, journal: journal.mode, reversalJournalId: journal.reversalId || null, restored, cancelledCertificates: certs };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, isReceipt ? "RECEIPT" : "PAYMENT", docNo, { status: "posted" }, { status: "cancelled", reason, journal: result.journal });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[DOCUMENT_CANCEL_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ยกเลิกเอกสารไม่สำเร็จ" }, { status: 500 });
  }
}
