import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { voidOrReverseJournal } from "@/lib/journal-reversal.server";
import { auditServer } from "@/services/audit.server";
import { readChequeForCancel, resolveBankTarget, writeCheque } from "@/lib/bank-cheque.server";
import { applyArDelta, arPaymentStatus } from "@/lib/cndn";

/**
 * [API-SERVER] คืนเงินลูกค้า (ใบคืนเงิน RF)
 * Endpoint: POST /api/finance/customer-refunds
 *  - { companyId, action: "create", invoiceDocId, amount, refundDate?, paymentMethod: CASH|TRANSFER|CHEQUE, bankAccount?, reference?, note? }
 *  - { companyId, action: "cancel", refundNo, reason }
 *
 * ยอดค้างคืนลูกค้า (invoice.refundDue) เกิดจากใบลดหนี้หลังลูกค้าชำระแล้ว หรือยกเลิกใบเพิ่มหนี้/ส่วนที่ชำระเกิน
 * ทำในทรานแซกชันเดียว:
 *  - คืนได้ไม่เกินยอดค้างคืน, เลขที่ RF ออกพร้อมการบันทึก (ไม่ซ้ำ ไม่ข้าม)
 *  - บันทึกบัญชี (รออนุมัติ): Dr ลูกหนี้การค้า 1131-00 / Cr เงินสด 1111-00 หรือ เงินฝากธนาคาร 1112-00
 *  - ยกเลิก: ยอดค้างคืนกลับมา, รายการบัญชียังไม่อนุมัติ -> ยกเลิกทิ้ง, ลงบัญชีแล้ว -> กลับรายการลงวันที่ยกเลิก
 */

const METHODS = {
  CASH: { label: "เงินสด", account: { code: "1111-00", name: "เงินสด" } },
  TRANSFER: { label: "โอนเงิน", account: { code: "1112-00", name: "เงินฝากธนาคาร" } },
  CHEQUE: { label: "เช็ค", account: { code: "1112-00", name: "เงินฝากธนาคาร" } },
} as const;
type Method = keyof typeof METHODS;

const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const now = admin.firestore.FieldValue.serverTimestamp();
    const action = str(body.action, 20);

    if (action === "create") {
      const invoiceDocId = str(body.invoiceDocId, 120);
      const amount = r2(Number(body.amount) || 0);
      const refundDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.refundDate || "")) ? body.refundDate : todayBkk();
      const method = (str(body.paymentMethod).toUpperCase() || "TRANSFER") as Method;
      if (!invoiceDocId) throw new ApiAuthError(400, "ไม่พบใบกำกับภาษีที่อ้างอิง");
      if (!(amount > 0)) throw new ApiAuthError(400, "กรุณาระบุจำนวนเงินที่คืน");
      if (!METHODS[method]) throw new ApiAuthError(400, "วิธีคืนเงินไม่ถูกต้อง");
      if (refundDate > todayBkk()) throw new ApiAuthError(400, "ลงวันที่คืนเงินล่วงหน้าไม่ได้");
      await assertPeriodOpen(companyId, refundDate);
      const bank = await resolveBankTarget(companyId, method, body, "คืนเงิน");

      const invRef = adminDb.doc(`companies/${companyId}/invoices/${invoiceDocId}`);
      const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
      const take = await prepareSequence("RF", companyId);

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(invRef);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบกำกับภาษี");
        const inv = snap.data()!;
        const invNo = inv.invoiceNo || inv.documentNo || invoiceDocId;
        if (inv.isSample) throw new ApiAuthError(400, `${invNo} เป็นเอกสารตัวอย่าง`);
        const due = r2(Number(inv.refundDue) || 0);
        if (due <= 0.009) throw new ApiAuthError(409, `${invNo} ไม่มียอดค้างคืนลูกค้า`);
        if (amount > due + 0.009) throw new ApiAuthError(400, `คืนได้ไม่เกินยอดค้างคืน ${due.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);
        const seq = await take(tx);
        const refundNo = seq.number;
        const customerName = inv.customerName || inv.customerSnapshot?.name || "";
        const account = METHODS[method].account;
        const ar = applyArDelta(Number(inv.balance) || 0, due, amount);

        seq.commit();
        writeCheque(tx, companyId, bank, { direction: "OUT", docKind: "refund", docNo: refundNo, docDate: refundDate, party: customerName, amount, uid: apiUser.uid });
        tx.create(adminDb.doc(`companies/${companyId}/customer_refunds/${refundNo}`), {
          id: refundNo, refundNo, documentNo: refundNo, companyId,
          invoiceDocId, invoiceNo: invNo, customerId: inv.customerId || "", customerName,
          refundDate, amount, paymentMethod: method, paymentMethodLabel: METHODS[method].label,
          bankAccountId: bank.bankAccountId, bankAccount: bank.bankAccount, ...(bank.cheque ? { cheque: bank.cheque } : {}),
          reference: str(body.reference, 120), note: str(body.note, 500),
          journalId: journalRef.id, status: "issued",
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        tx.update(invRef, {
          balance: ar.balance,
          refundDue: ar.refundDue,
          refundedTotal: r2((Number(inv.refundedTotal) || 0) + amount),
          refundRefs: admin.firestore.FieldValue.arrayUnion(refundNo),
          paymentStatus: arPaymentStatus(ar.balance, Number(inv.paidAmount) || 0),
          updatedAt: now, updatedBy: apiUser.uid,
        });
        tx.set(journalRef, {
          companyId, date: refundDate, bookType: "PV",
          description: `[AUTO] คืนเงินลูกค้า ${refundNo} อ้างอิง ${invNo} (${customerName})`,
          reference: refundNo,
          items: [
            { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: amount, credit: 0 },
            { accountCode: account.code, accountName: account.name, debit: 0, credit: amount },
          ],
          totalDebit: amount, totalCredit: amount, status: "draft",
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        return { refundNo, invoiceNo: invNo, amount, refundDue: ar.refundDue };
      });
      await auditServer.logCreate(apiUser.uid, companyId, "CUSTOMER_REFUND", result.refundNo, { invoice: result.invoiceNo, amount });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "cancel") {
      const refundNo = str(body.refundNo, 120);
      const reason = str(body.reason, 300);
      if (!refundNo) throw new ApiAuthError(400, "ไม่พบใบคืนเงิน");
      if (reason.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลการยกเลิก");
      const cancelDate = todayBkk();
      await assertPeriodOpen(companyId, cancelDate);
      const ref = adminDb.doc(`companies/${companyId}/customer_refunds/${refundNo}`);

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบคืนเงิน");
        const d = snap.data()!;
        if (d.status === "cancelled") throw new ApiAuthError(409, `${refundNo} ถูกยกเลิกไปแล้ว`);
        const invRef = adminDb.doc(`companies/${companyId}/invoices/${d.invoiceDocId}`);
        const invSnap = await tx.get(invRef);
        const journalSnap = d.journalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${d.journalId}`)) : null;
        const cheque = await readChequeForCancel(tx, companyId, refundNo);
        const amount = r2(Number(d.amount) || 0);
        if (cheque && !["CANCELLED", "BOUNCED"].includes(String(cheque.data.status))) {
          tx.update(cheque.ref, { status: "CANCELLED", history: admin.firestore.FieldValue.arrayUnion({ status: "CANCELLED", at: new Date().toISOString(), by: apiUser.uid, note: "ยกเลิกเอกสาร" }), updatedAt: now });
        }

        if (invSnap.exists) {
          const inv = invSnap.data()!;
          const ar = applyArDelta(Number(inv.balance) || 0, Number(inv.refundDue) || 0, -amount);
          tx.update(invRef, {
            balance: ar.balance,
            refundDue: ar.refundDue,
            refundedTotal: r2(Math.max(0, (Number(inv.refundedTotal) || 0) - amount)),
            refundRefs: admin.firestore.FieldValue.arrayRemove(refundNo),
            paymentStatus: arPaymentStatus(ar.balance, Number(inv.paidAmount) || 0),
            updatedAt: now, updatedBy: apiUser.uid,
          });
        }
        const journal = voidOrReverseJournal(tx, companyId, journalSnap, {
          date: cancelDate,
          description: `[AUTO] ยกเลิกใบคืนเงิน ${refundNo} (${d.customerName || ""}): ${reason}`,
          reference: refundNo, uid: apiUser.uid, reason,
        });
        tx.update(ref, {
          status: "cancelled", cancelReason: reason, cancelDate, cancelledBy: apiUser.uid, cancelledAt: now,
          journalAction: journal.mode, ...(journal.reversalId ? { reversalJournalId: journal.reversalId } : {}),
          updatedAt: now,
        });
        return { refundNo, journal: journal.mode, reversalJournalId: journal.reversalId || null };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "CUSTOMER_REFUND", refundNo, { status: "issued" }, { status: "cancelled", reason });
      return NextResponse.json({ success: true, ...result });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[CUSTOMER_REFUND_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกการคืนเงินไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
