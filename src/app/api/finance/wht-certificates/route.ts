import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) ล่วงหน้าสำหรับรายการค่าใช้จ่าย
 * Endpoint: POST /api/finance/wht-certificates  { companyId, expenseId, whtRate, baseAmount?, filingDate? }
 *
 * - ใบละหนึ่งฉบับต่อค่าใช้จ่าย (กันออกซ้ำ); ถ้าจ่ายผ่าน /api/finance/payments ระบบออกให้ตอนจ่ายอยู่แล้ว
 * - ฐานภาษี = ยอดก่อน VAT ของค่าใช้จ่าย (ระบุเองได้แต่ไม่เกินยอดก่อน VAT), เลข WHT ออกในทรานแซกชัน (ไม่ข้าม)
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const RATES = [1, 2, 3, 5];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const whtRate = Number(body.whtRate);
    if (!RATES.includes(whtRate)) throw new ApiAuthError(400, "อัตราภาษีหัก ณ ที่จ่ายไม่ถูกต้อง");
    const expRef = adminDb.doc(`companies/${companyId}/expenses/${str(body.expenseId, 120)}`);
    const filingDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.filingDate || "")) ? body.filingDate : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const take = await prepareSequence("WHT", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(expRef);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบรายการค่าใช้จ่าย");
      const e = snap.data()!;
      if (e.isDeleted === true || String(e.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, "รายการนี้ถูกยกเลิกแล้ว");
      if (e.whtId) throw new ApiAuthError(409, `รายการนี้ออกหนังสือรับรองแล้ว (${e.whtId})`);
      if (Array.isArray(e.paymentWhtIds) && e.paymentWhtIds.length) throw new ApiAuthError(409, "ออกหนังสือรับรองไปแล้วตอนจ่ายเงิน");
      const maxBase = r2(Number(e.subTotal ?? (Number(e.totalAmount) || 0) - (Number(e.vatAmount) || 0)) || 0);
      const baseAmount = body.baseAmount !== undefined ? r2(Number(body.baseAmount) || 0) : maxBase;
      if (!(baseAmount > 0)) throw new ApiAuthError(400, "ฐานภาษีต้องมากกว่า 0");
      if (baseAmount > maxBase + 0.009) throw new ApiAuthError(400, `ฐานภาษีเกินยอดก่อน VAT (${maxBase.toLocaleString("th-TH")} บาท)`);
      const whtAmount = r2(baseAmount * whtRate / 100);
      const seq = await take(tx); const whtId = seq.number; seq.commit();
      tx.create(adminDb.doc(`companies/${companyId}/withholding_taxes/${whtId}`), {
        id: whtId, whtId, companyId, expenseId: snap.id, expRef: snap.id,
        vendor: e.supplierName || e.vendor || "", supplierId: e.supplierId || "", taxId: e.taxId || "", vendorType: e.vendorType || "",
        documentType: "Withholding Tax (50 Tawi)", baseAmount, whtRate, whtAmount, taxAmount: whtAmount,
        filingDate, issuedAt: now, status: "Issued",
        createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      tx.update(expRef, { whtId, whtRate, whtAmount, updatedAt: now, updatedBy: apiUser.uid });
      return { whtId, baseAmount, whtAmount };
    });
    await auditServer.logCreate(apiUser.uid, companyId, "WHT_CERTIFICATE", result.whtId, { expense: expRef.id, ...result });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[WHT_CERT_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ออกหนังสือรับรองไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
