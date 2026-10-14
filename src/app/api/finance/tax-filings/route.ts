import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { buildWhtRecords, computePP30 } from "@/lib/tax-calc";

/**
 * [API-SERVER] บันทึกการยื่นแบบภาษี (ภ.พ.30 / ภ.ง.ด.3 / ภ.ง.ด.53) และล็อกงวด
 * Endpoint: POST /api/finance/tax-filings  { companyId, taxType: "VAT30" | "PND3" | "PND53", period: "YYYY-MM" }
 *
 * - คำนวณยอดที่ server จากข้อมูลจริง (สูตรเดียวกับหน้าจอ: lib/tax-calc) ไม่เชื่อตัวเลขจากหน้าจอ
 * - ล็อกงวด (companies/{id}/tax_filing_locks/{companyId}_{type}_{period}) + ประวัติการยื่น (taxFilings) ในทรานแซกชันเดียว
 * - ยื่นงวดเดียวกันซ้ำไม่ได้
 */

const TYPES = ["VAT30", "PND3", "PND53"] as const;
type TaxType = (typeof TYPES)[number];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const taxType = String(body.taxType || "") as TaxType;
    const period = String(body.period || "");
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    if (!TYPES.includes(taxType)) throw new ApiAuthError(400, "ประเภทแบบภาษีไม่ถูกต้อง");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new ApiAuthError(400, "งวดไม่ถูกต้อง (YYYY-MM)");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    // ---- คำนวณจากข้อมูลจริง ----
    let base = 0, tax = 0, recordCount = 0;
    if (taxType === "VAT30") {
      const [scoped, legacy, inv] = await Promise.all([
        adminDb.collection(`companies/${companyId}/journal_entries`).get(),
        adminDb.collection("journal_entries").where("companyId", "==", companyId).where("isDeleted", "==", false).get(),
        adminDb.collection(`companies/${companyId}/invoices`).where("companyId", "==", companyId).get(),
      ]);
      const r = computePP30(companyId, period, [...scoped.docs, ...legacy.docs].map((d) => d.data()), inv.docs.map((d) => d.data()));
      base = r.salesBase; tax = r.netVatPayable; recordCount = r.journalCount;
    } else {
      const wht = await adminDb.collection(`companies/${companyId}/withholding_taxes`).where("companyId", "==", companyId).get();
      const supplierIds = Array.from(new Set(wht.docs.map((d) => d.data().supplierId).filter(Boolean)));
      const sups = supplierIds.length ? await adminDb.getAll(...supplierIds.map((id) => adminDb.doc(`suppliers/${id}`))) : [];
      const taxIds = new Map(sups.filter((s) => s.exists).map((s) => [s.id, String(s.data()!.taxId || "")]));
      const rows = buildWhtRecords(wht.docs.map((d) => ({ id: d.id, data: d.data() })), taxIds, period, taxType);
      base = rows.reduce((s, r) => s + r.baseAmount, 0); tax = rows.reduce((s, r) => s + r.whtAmount, 0); recordCount = rows.length;
    }

    const lockId = `${companyId}_${taxType}_${period}`;
    const lockRef = adminDb.doc(`companies/${companyId}/tax_filing_locks/${lockId}`);
    const filingRef = adminDb.collection("taxFilings").doc();
    const [year, month] = period.split("-").map(Number);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await adminDb.runTransaction(async (tx) => {
      if ((await tx.get(lockRef)).exists) throw new ApiAuthError(409, `งวด ${period} ยื่นแบบ ${taxType} ไปแล้ว`);
      tx.create(lockRef, { lockId, companyId, reportType: taxType, yearMonth: period, exportedAt: new Date().toISOString(), exportedBy: apiUser.uid, isLocked: true, filingId: filingRef.id });
      tx.create(filingRef, {
        companyId, type: taxType, yearMonth: period, year, month,
        revenue: Math.round(base * 100) / 100, taxAmount: Math.round(tax * 100) / 100, recordCount,
        status: "filed", filedBy: apiUser.email || apiUser.uid, filedByUid: apiUser.uid, createdAt: now, isDeleted: false,
      });
    });

    await auditServer.logCreate(apiUser.uid, companyId, "TAX_FILING", lockId, { base, tax, recordCount });
    return NextResponse.json({ success: true, filingId: filingRef.id, taxType, period, baseAmount: base, taxAmount: tax, recordCount });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[TAX_FILING_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกการยื่นภาษีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
