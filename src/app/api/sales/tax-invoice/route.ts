import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareCounter } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ออกใบกำกับภาษี/ใบแจ้งหนี้ + ใบวางบิล จากใบสั่งขาย
 * Endpoint: POST /api/sales/tax-invoice  { companyId, salesOrderId }
 *
 * ทำในทรานแซกชันเดียว:
 *  - เลขใบกำกับภาษี (INV) และใบวางบิล (BN) ออกพร้อมการบันทึก -> เลขเรียงต่อเนื่อง ไม่ข้าม (ข้อกำหนดสรรพากร)
 *  - ใบสั่งขายออกใบกำกับได้ครั้งเดียว (กดซ้ำ/สองคนพร้อมกันไม่ได้ใบซ้ำ)
 *  - บันทึกบัญชี (รออนุมัติ) ลงวันที่ออกใบ: Dr ลูกหนี้ 1131-00 / Cr รายได้ 4111-00, Cr ภาษีขาย 2121-00
 *  - ใบแจ้งหนี้มียอดค้าง (balance) ให้รับชำระผ่าน /api/finance/receipts
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function amounts(so: any) {
  const raw = String(so.vatType || so.taxMode || "Exclude VAT");
  const vatType = raw === "Inclusive" || raw === "Include VAT" ? "Include VAT" : raw === "Non-VAT" ? "Non-VAT" : "Exclude VAT";
  // ฐาน: แยกภาษี = ยอดก่อน VAT, รวมภาษี/ไม่มีภาษี = ยอดสุทธิ (ใช้ยอดที่บันทึกไว้ก่อน กันคิด VAT ซ้ำ)
  const base = vatType === "Exclude VAT"
    ? Number(so.subTotal ?? so.netTotal ?? so.totalAmount ?? so.totalRevenue ?? 0)
    : Number(so.grandTotal ?? so.totalAmount ?? so.netTotal ?? so.totalRevenue ?? 0);
  if (vatType === "Include VAT") {
    const grandTotal = r2(base);
    const subTotal = r2(grandTotal / 1.07);
    return { vatType, subTotal, vatAmount: r2(grandTotal - subTotal), grandTotal };
  }
  if (vatType === "Exclude VAT") {
    const subTotal = r2(base);
    const vatAmount = r2(subTotal * 0.07);
    return { vatType, subTotal, vatAmount, grandTotal: r2(subTotal + vatAmount) };
  }
  return { vatType, subTotal: r2(base), vatAmount: 0, grandTotal: r2(base) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const soId = String(body.salesOrderId || "").trim();
    if (!companyId || !soId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "sales:edit") && !can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const issueDate = todayBkk();
    await assertPeriodOpen(companyId, issueDate);

    const soRef = adminDb.doc(`companies/${companyId}/sales_orders/${soId}`);
    const invRef = adminDb.collection(`companies/${companyId}/invoices`).doc();
    const bnRef = adminDb.collection(`companies/${companyId}/billing_notes`).doc();
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    const takeInv = prepareCounter("INV", companyId);
    const takeBn = prepareCounter("BN", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const snap = await tx.get(soRef);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งขาย");
      const so = snap.data()!;
      const soNo = so.documentNo || so.soId || so.orderId || soId;
      if (so.isSample) throw new ApiAuthError(400, `${soNo} เป็นเอกสารตัวอย่าง`);
      if (so.isDeleted === true || String(so.status || "").toUpperCase() === "CANCELLED") throw new ApiAuthError(409, `${soNo} ถูกยกเลิกแล้ว`);
      if (so.invoiceNo || String(so.status || "").toUpperCase() === "COMPLETED") throw new ApiAuthError(409, `${soNo} ออกใบกำกับภาษีไปแล้ว (${so.invoiceNo || "-"})`);
      const inv = await takeInv(tx);
      const bn = await takeBn(tx);

      // ---- คำนวณ ----
      const { vatType, subTotal, vatAmount, grandTotal } = amounts(so);
      if (!(grandTotal > 0)) throw new ApiAuthError(400, `${soNo} ไม่มียอดขาย`);
      const termDays = Number(so.paymentTermDays ?? so.paymentTermDay ?? 30);
      const dueDate = new Date(Date.now() + 7 * 3600e3 + (Number.isFinite(termDays) ? termDays : 30) * 86400e3).toISOString().slice(0, 10);
      const customerName = so.customerName || so.customerSnapshot?.name || "";
      const isVatRegistered = (so.isVatRegistered ?? true) && vatType !== "Non-VAT";
      const ref = { referenceNo: so.referenceNo || so.customerPoNo || so.quotationRefNo || "", customerPoNo: so.customerPoNo || so.referenceNo || "" };

      // ---- เขียน ----
      inv.commit();
      bn.commit();
      tx.create(invRef, {
        id: invRef.id, companyId,
        invoiceId: inv.number, invoiceNo: inv.number, documentNo: inv.number, docNumber: inv.number,
        orderRefNo: soNo, salesOrderId: soId, ...ref,
        customerSnapshot: so.customerSnapshot || null, customerId: so.customerId || "", customerName,
        issueDate, dueDate,
        items: so.items || [],
        isVatRegistered, vatType,
        subTotal, vatAmount, grandTotal,
        paidAmount: 0, balance: grandTotal, paymentStatus: "unpaid",
        billingNoteNo: bn.number, journalId: journalRef.id,
        status: "issued",
        createdBy: apiUser.uid, updatedBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      tx.create(bnRef, {
        id: bnRef.id, companyId,
        billingNoteNo: bn.number, documentNo: bn.number, docNumber: bn.number,
        invoiceRefNo: inv.number, invoiceDocId: invRef.id, salesOrderRefNo: soNo, ...ref,
        customerSnapshot: so.customerSnapshot || null, customerId: so.customerId || "", customerName,
        issueDate, dueDate, totalAmount: grandTotal,
        status: "issued",
        createdBy: apiUser.uid, updatedBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      tx.update(soRef, { status: "COMPLETED", invoiceNo: inv.number, invoiceDocId: invRef.id, billingNoteNo: bn.number, updatedAt: now, updatedBy: apiUser.uid });
      const items = [
        { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: grandTotal, credit: 0 },
        { accountCode: "4111-00", accountName: "รายได้จากการขาย", debit: 0, credit: subTotal },
        ...(vatAmount > 0 ? [{ accountCode: "2121-00", accountName: "ภาษีขาย", debit: 0, credit: vatAmount }] : []),
      ];
      tx.set(journalRef, {
        companyId, date: issueDate, bookType: "SV",
        description: `[AUTO] ใบกำกับภาษี ${inv.number} ขายให้ ${customerName}`,
        reference: inv.number, items, totalDebit: grandTotal, totalCredit: r2(subTotal + vatAmount),
        isOfficialTax: isVatRegistered, status: "draft",
        createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      return { taxInvoiceId: invRef.id, taxInvoiceNo: inv.number, billingNoteId: bnRef.id, billingNoteNo: bn.number, subTotal, vatAmount, grandTotal, vatType, soNo };
    });

    await auditServer.logCreate(apiUser.uid, companyId, "TAX_INVOICE", result.taxInvoiceNo, { salesOrder: result.soNo, grandTotal: result.grandTotal });
    await auditServer.logCreate(apiUser.uid, companyId, "BILLING_NOTE", result.billingNoteNo, { invoice: result.taxInvoiceNo });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[TAX_INVOICE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ออกใบกำกับภาษีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
