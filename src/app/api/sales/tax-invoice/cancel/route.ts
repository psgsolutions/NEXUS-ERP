import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { canAny } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { voidOrReverseJournal } from "@/lib/journal-reversal.server";
import { sellerSnapshot } from "@/lib/documents/seller.server";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ยกเลิกใบกำกับภาษี / ยกเลิกและออกใบแทน
 * POST /api/sales/tax-invoice/cancel
 * body: { companyId, invoiceDocId, reason, replace?: boolean, customer?: { name, taxId, branch, address } }
 *
 *  - ยกเลิกได้เฉพาะใบที่ยังไม่มีการรับชำระ และไม่มีใบลดหนี้/เพิ่มหนี้อ้างอิง (ยกเลิกเอกสารเหล่านั้นก่อน)
 *  - ยกเลิกอย่างเดียว: กลับรายการบัญชี ยกเลิกใบวางบิล และคืนสถานะใบสั่งขายให้ออกใบใหม่ได้
 *  - ยกเลิกและออกใบแทน (แก้ข้อมูลผู้ซื้อ เช่น ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา — ยอดเงินและรายการเหมือนเดิม):
 *      ใบใหม่ได้เลขใหม่ ลงวันที่เดียวกับฉบับเดิม ระบุ "ออกแทนฉบับเดิมเลขที่ ..." พร้อมเหตุผล
 *      รายการบัญชีเดิมยังใช้ต่อ (ยอดไม่เปลี่ยน) และผูกกับใบใหม่ ใบวางบิลออกใหม่ตามใบใหม่
 *    ถ้าต้องแก้ยอดเงิน ให้ใช้ใบลดหนี้/ใบเพิ่มหนี้แทน
 *  - เลขที่ฉบับเดิมไม่ถูกนำกลับมาใช้ เอกสารเดิมคงอยู่พร้อมสถานะยกเลิก
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!canAny(apiUser.roles, ["finance:edit", "sales:approve"])) throw new ApiAuthError(403, "ยกเลิกใบกำกับภาษีได้เฉพาะฝ่ายบัญชีหรือผู้อนุมัติฝ่ายขาย");

    const invoiceDocId = str(body.invoiceDocId, 120);
    const reason = str(body.reason, 300);
    const replace = body.replace === true;
    if (!invoiceDocId || invoiceDocId.includes("/")) throw new ApiAuthError(400, "ไม่พบใบกำกับภาษี");
    if (reason.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลการยกเลิก");
    const cancelDate = todayBkk();
    await assertPeriodOpen(companyId, cancelDate);

    const invRef = adminDb.doc(`companies/${companyId}/invoices/${invoiceDocId}`);
    const pre = await invRef.get();
    if (!pre.exists) throw new ApiAuthError(404, "ไม่พบใบกำกับภาษี");
    const bnSnaps = await adminDb.collection(`companies/${companyId}/billing_notes`).where("invoiceDocId", "==", invoiceDocId).get();
    const [takeInv, takeBn, seller] = replace
      ? await Promise.all([prepareSequence("IV", companyId), prepareSequence("BL", companyId), sellerSnapshot(companyId)])
      : [null, null, null];
    const newInvRef = adminDb.collection(`companies/${companyId}/invoices`).doc();
    const newBnRef = adminDb.collection(`companies/${companyId}/billing_notes`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const snap = await tx.get(invRef);
      const inv = snap.data()!;
      const invNo = str(inv.invoiceNo || inv.documentNo || invoiceDocId);
      if (inv.isSample) throw new ApiAuthError(400, `${invNo} เป็นเอกสารตัวอย่าง`);
      if (String(inv.status || "").toLowerCase() === "cancelled" || inv.isDeleted === true) throw new ApiAuthError(409, `${invNo} ถูกยกเลิกไปแล้ว`);
      if ((Number(inv.paidAmount) || 0) > 0.009) throw new ApiAuthError(409, `${invNo} มีการรับชำระแล้ว — ยกเลิกใบเสร็จก่อน หรือออกใบลดหนี้แทน`);
      if ((Number(inv.creditNoteTotal) || 0) > 0 || (Number(inv.debitNoteTotal) || 0) > 0) throw new ApiAuthError(409, `${invNo} มีใบลดหนี้/ใบเพิ่มหนี้อ้างอิงอยู่ — ยกเลิกเอกสารเหล่านั้นก่อน`);
      const journalSnap = inv.journalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${inv.journalId}`)) : null;
      const soRef = inv.salesOrderId ? adminDb.doc(`companies/${companyId}/sales_orders/${inv.salesOrderId}`) : null;
      const soSnap = soRef ? await tx.get(soRef) : null;
      const bnRefs = bnSnaps.docs.map((d) => d.ref);
      const bns = await Promise.all(bnRefs.map((r) => tx.get(r)));
      const newInv = takeInv ? await takeInv(tx) : null;
      const newBn = takeBn ? await takeBn(tx) : null;

      // ---- เขียน ----
      for (const b of bns) {
        if (b.exists && String(b.data()!.status || "").toLowerCase() !== "cancelled") {
          tx.update(b.ref, { status: "cancelled", cancelReason: `ยกเลิกใบกำกับภาษี ${invNo}: ${reason}`, cancelDate, cancelledBy: apiUser.uid, cancelledAt: now, updatedAt: now });
        }
      }

      if (!replace) {
        const journal = voidOrReverseJournal(tx, companyId, journalSnap, {
          date: cancelDate, description: `[AUTO] ยกเลิกใบกำกับภาษี ${invNo} (${inv.customerName || ""}): ${reason}`,
          reference: invNo, uid: apiUser.uid, reason,
        });
        tx.update(invRef, {
          status: "cancelled", cancelReason: reason, cancelDate, cancelledBy: apiUser.uid, cancelledAt: now,
          balance: 0, paymentStatus: "cancelled", journalAction: journal.mode,
          ...(journal.reversalId ? { reversalJournalId: journal.reversalId } : {}),
          updatedAt: now, updatedBy: apiUser.uid,
        });
        if (soSnap?.exists) {
          const so = soSnap.data()!;
          tx.update(soRef!, {
            status: so.statusBeforeInvoice || (String(so.fulfillmentStatus || "").toLowerCase() === "delivered" ? "DELIVERED" : "Confirmed"),
            invoiceNo: admin.firestore.FieldValue.delete(), invoiceDocId: admin.firestore.FieldValue.delete(), billingNoteNo: admin.firestore.FieldValue.delete(),
            cancelledInvoices: admin.firestore.FieldValue.arrayUnion(invNo), updatedAt: now, updatedBy: apiUser.uid,
          });
        }
        return { invoiceNo: invNo, mode: "cancelled" as const, journal: journal.mode };
      }

      // ยกเลิกและออกใบแทน: ยอด รายการ และวันที่เหมือนเดิม เปลี่ยนเฉพาะข้อมูลผู้ซื้อ (ถ้าระบุ)
      const c = body.customer && typeof body.customer === "object" ? body.customer : null;
      const oldC = inv.customerSnapshot || {};
      const customerSnapshot = c
        ? { name: str(c.name, 200) || str(oldC.name || oldC.customerName || inv.customerName), taxId: str(c.taxId, 20).replace(/\D/g, ""), branch: str(c.branch, 60), address: str(c.address, 1000) }
        : inv.customerSnapshot || null;
      if (c && customerSnapshot?.taxId && customerSnapshot.taxId.length !== 13) throw new ApiAuthError(400, "เลขประจำตัวผู้เสียภาษีของผู้ซื้อต้องมี 13 หลัก");
      const newNo = newInv!.number, newBnNo = newBn!.number;
      newInv!.commit(); newBn!.commit();
      const { id: _id, invoiceId: _a, invoiceNo: _b, documentNo: _c, docNumber: _d, billingNoteNo: _e, createdAt: _f, updatedAt: _g, ...rest } = inv;
      void _id; void _a; void _b; void _c; void _d; void _e; void _f; void _g;
      tx.create(newInvRef, {
        ...rest,
        id: newInvRef.id, invoiceId: newNo, invoiceNo: newNo, documentNo: newNo, docNumber: newNo,
        customerSnapshot, customerName: customerSnapshot?.name || inv.customerName || "",
        sellerSnapshot: seller,
        replacesInvoiceNo: invNo, replacesInvoiceDocId: invoiceDocId, replaceReason: reason,
        billingNoteNo: newBnNo, status: "issued",
        createdBy: apiUser.uid, updatedBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      const oldBn = bns.find((b) => b.exists)?.data() || {};
      tx.create(newBnRef, {
        id: newBnRef.id, companyId, billingNoteNo: newBnNo, documentNo: newBnNo, docNumber: newBnNo,
        invoiceRefNo: newNo, invoiceDocId: newInvRef.id, salesOrderRefNo: inv.orderRefNo || oldBn.salesOrderRefNo || "",
        referenceNo: inv.referenceNo || "", customerPoNo: inv.customerPoNo || "",
        customerSnapshot, customerId: inv.customerId || "", customerName: customerSnapshot?.name || inv.customerName || "",
        sellerSnapshot: seller, issueDate: inv.issueDate, dueDate: inv.dueDate, totalAmount: inv.grandTotal,
        status: "issued", createdBy: apiUser.uid, updatedBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      tx.update(invRef, {
        status: "cancelled", cancelReason: reason, cancelDate, cancelledBy: apiUser.uid, cancelledAt: now,
        balance: 0, paymentStatus: "cancelled", replacedByNo: newNo, replacedByDocId: newInvRef.id, journalAction: "moved",
        updatedAt: now, updatedBy: apiUser.uid,
      });
      if (journalSnap?.exists) tx.update(journalSnap.ref, { reference: newNo, description: `${journalSnap.data()!.description || ""} (ออกแทน ${invNo} → ${newNo})`.slice(0, 500), updatedAt: now });
      if (soSnap?.exists) tx.update(soRef!, { invoiceNo: newNo, invoiceDocId: newInvRef.id, billingNoteNo: newBnNo, updatedAt: now, updatedBy: apiUser.uid });
      return { invoiceNo: invNo, mode: "replaced" as const, newInvoiceNo: newNo, newInvoiceDocId: newInvRef.id, newBillingNoteNo: newBnNo };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "TAX_INVOICE", result.invoiceNo, { status: "issued" }, { status: "cancelled", reason, ...result });
    if (result.mode === "replaced") await auditServer.logCreate(apiUser.uid, companyId, "TAX_INVOICE", result.newInvoiceNo!, { replaces: result.invoiceNo, reason });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[TAX_INVOICE_CANCEL]:", error);
    return NextResponse.json({ success: false, error: "ยกเลิกใบกำกับภาษีไม่สำเร็จ" }, { status: 500 });
  }
}
