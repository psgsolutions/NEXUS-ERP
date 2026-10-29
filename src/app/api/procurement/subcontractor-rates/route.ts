import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] อัตราค่าแรงผู้รับเหมา — POST /api/procurement/subcontractor-rates
 *  - { companyId, action: "create", rate: { subcontractorId, subcontractorName, itemCode, serviceType, unit, ratePerUnit, standardSellingPrice, remarks } }
 * เขียนผ่าน server เท่านั้น (rules: subcontractor_rates เป็น API-only) · ต้องมีสิทธิ์ procurement:edit
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const money = (v: any) => Math.round(Math.max(0, Number(v) || 0) * 100) / 100;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "procurement:edit")) throw new ApiAuthError(403, "ไม่มีสิทธิ์บันทึกอัตราค่าแรง");
    if (str(body.action, 20) !== "create") throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");

    const r = body.rate || {};
    const subcontractorId = str(r.subcontractorId, 120), serviceType = str(r.serviceType), itemCode = str(r.itemCode, 60);
    const ratePerUnit = money(r.ratePerUnit);
    if (!subcontractorId || !serviceType || !itemCode) throw new ApiAuthError(400, "ข้อมูลอัตราค่าแรงไม่ครบ");
    if (!(ratePerUnit > 0)) throw new ApiAuthError(400, "อัตราค่าแรงต้องมากกว่า 0");
    const sub = await adminDb.doc(`companies/${companyId}/contractors/${subcontractorId}`).get();
    if (sub.exists && sub.data()!.isDeleted === true) throw new ApiAuthError(404, "ไม่พบผู้รับเหมา");

    const ref = adminDb.collection(`companies/${companyId}/subcontractor_rates`).doc();
    const data = {
      companyId, subcontractorId, subcontractorName: str(r.subcontractorName), itemCode, serviceType,
      unit: str(r.unit, 30) || "จุด", ratePerUnit, standardSellingPrice: money(r.standardSellingPrice) || ratePerUnit,
      remarks: str(r.remarks, 500), isDeleted: false, createdBy: apiUser.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(data);
    await auditServer.logCreate(apiUser.uid, companyId, "SUBCONTRACTOR_RATE", ref.id, { subcontractorId, itemCode, ratePerUnit });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[SUBCONTRACTOR_RATES_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "บันทึกอัตราค่าแรงไม่สำเร็จ" }, { status: 500 });
  }
}
