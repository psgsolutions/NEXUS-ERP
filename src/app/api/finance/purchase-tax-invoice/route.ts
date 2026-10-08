import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { expenseAccountOf } from "@/lib/payables";

/**
 * [API-SERVER] บันทึกรับใบกำกับภาษีซื้อจากผู้จำหน่าย (ตั้งหนี้เต็มจำนวน ณ วันที่ในใบกำกับ)
 * Endpoint: POST /api/finance/purchase-tax-invoice
 * body: { companyId, expenseDocId, taxInvoiceNo, taxInvoiceDate (YYYY-MM-DD), supplierTaxId? }
 *
 * บันทึกบัญชี (draft) ลงวันที่ใบกำกับ -> ภาษีซื้อเข้า ภ.พ.30 เดือนที่ถูกต้อง
 *  - ซื้อตาม PO (เจ้าหนี้ส่วนก่อน VAT ตั้งไว้แล้วตอนรับสินค้า):
 *      Dr ภาษีซื้อ 1151-00 / Cr เจ้าหนี้การค้า 2111-00            (ส่วน VAT)
 *  - ค่าใช้จ่ายตรง / เบิกพนักงาน (ยังไม่ได้ตั้งหนี้):
 *      Dr บัญชีค่าใช้จ่าย + Dr ภาษีซื้อ 1151-00 / Cr เจ้าหนี้การค้า 2111-00 (เต็มจำนวน)
 * หลังบันทึก รายการถูกทำเครื่องหมาย apPosted: การจ่ายชำระจะล้างเจ้าหนี้ทั้งก้อน
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const expenseDocId = str(body.expenseDocId);
    const taxInvoiceNo = str(body.taxInvoiceNo, 60);
    const taxInvoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.taxInvoiceDate || "")) ? body.taxInvoiceDate : "";
    const supplierTaxId = str(body.supplierTaxId, 20).replace(/\D/g, "");
    if (!expenseDocId) throw new ApiAuthError(400, "ไม่พบรายการค่าใช้จ่าย");
    if (!taxInvoiceNo) throw new ApiAuthError(400, "กรุณาระบุเลขที่ใบกำกับภาษี");
    if (!taxInvoiceDate) throw new ApiAuthError(400, "กรุณาระบุวันที่ในใบกำกับภาษี");
    if (supplierTaxId && supplierTaxId.length !== 13) throw new ApiAuthError(400, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");

    await assertPeriodOpen(companyId, taxInvoiceDate);

    const ref = adminDb.doc(`companies/${companyId}/expenses/${expenseDocId}`);
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบรายการค่าใช้จ่าย");
      const e = snap.data()!;
      const docNo = e.expenseId || snap.id;
      if (e.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง`);
      if (e.apPosted) throw new ApiAuthError(409, `${docNo} บันทึกใบกำกับภาษีซื้อแล้ว (${e.supplierTaxInvoiceNo || "-"})`);
      if ((Number(e.paidAmount) || 0) > 0) throw new ApiAuthError(409, `${docNo} มีการจ่ายเงินไปแล้ว จึงบันทึกภาษีซื้อพร้อมการจ่ายตามเดิม`);

      const total = round2(Number(e.totalAmount) || 0);
      const vat = round2(Number(e.vatAmount) || 0);
      const preVat = round2(Number(e.subTotal ?? total - vat) || 0);
      const isPo = !!e.poRef && e.documentType !== "ExpenseClaim";
      const payee = e.supplierName || e.vendor || e.employeeName || "";

      let items: any[];
      if (isPo) {
        if (vat <= 0) throw new ApiAuthError(400, `${docNo} ไม่มีภาษีมูลค่าเพิ่ม ไม่ต้องบันทึกใบกำกับภาษีซื้อ`);
        items = [
          { accountCode: "1151-00", accountName: "ภาษีซื้อ", debit: vat, credit: 0 },
          { accountCode: "2111-00", accountName: "เจ้าหนี้การค้า", debit: 0, credit: vat },
        ];
      } else {
        const acct = expenseAccountOf(e);
        items = [
          { accountCode: acct.code, accountName: acct.name, debit: preVat, credit: 0 },
          ...(vat > 0 ? [{ accountCode: "1151-00", accountName: "ภาษีซื้อ", debit: vat, credit: 0 }] : []),
          { accountCode: "2111-00", accountName: "เจ้าหนี้การค้า", debit: 0, credit: round2(preVat + vat) },
        ];
      }
      const totalDebit = round2(items.reduce((s, l) => s + l.debit, 0));
      const totalCredit = round2(items.reduce((s, l) => s + l.credit, 0));

      tx.set(journalRef, {
        companyId,
        date: taxInvoiceDate,
        bookType: "PJ",
        description: `[AUTO] รับใบกำกับภาษีซื้อ ${taxInvoiceNo} (${docNo}) จาก ${payee}`,
        reference: docNo,
        taxInvoiceNo,
        items,
        totalDebit,
        totalCredit,
        isOfficialTax: true,
        status: "draft",
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      });
      tx.update(ref, {
        apPosted: true,
        apJournalId: journalRef.id,
        supplierTaxInvoiceNo: taxInvoiceNo,
        supplierTaxInvoiceDate: taxInvoiceDate,
        ...(supplierTaxId ? { supplierTaxId } : {}),
        updatedAt: now,
        updatedBy: apiUser.uid,
      });
      return { expenseNo: docNo, vat, journalId: journalRef.id };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "PURCHASE_TAX_INVOICE", result.expenseNo, {}, { taxInvoiceNo, taxInvoiceDate, vat: result.vat });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[PURCHASE_TAX_INVOICE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบกำกับภาษีซื้อไม่สำเร็จ" }, { status: 500 });
  }
}
