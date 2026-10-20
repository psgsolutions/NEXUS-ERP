import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { normalizeProjectStatus } from "@/lib/project-status";
import { normalizeContract } from "@/lib/gov-contract";

/**
 * [API-SERVER] สัญญาและหลักประกันของโครงการ (วิธีจัดซื้อ เลขที่สัญญา/ใบสั่ง วันส่งมอบ ค่าปรับ อากรแสตมป์ หลักประกัน)
 * Endpoint: POST /api/projects/contract  { companyId, projectDocId, contract }
 * - วิศวกร/ผู้ดูแลโครงการ (projects:edit) หรือแอดมินการเงิน (finance:edit — ดูแลหลักประกัน/อากร)
 * - ตรวจค่าที่ server (normalizeContract) แทนที่ทั้งก้อน · โครงการที่ยกเลิกแล้วแก้ไม่ได้
 * - วันส่งมอบจริงที่บันทึกที่นี่ใช้เริ่มนับระยะรับประกัน และหยุดนับค่าปรับ
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const docId = str(body.projectDocId, 120);
    if (!companyId || !docId || docId.includes("/")) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "projects:edit") && !can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const ref = adminDb.doc(`companies/${companyId}/projects/${docId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
    const p = snap.data()!;
    if (normalizeProjectStatus(p.status) === "Cancelled") throw new ApiAuthError(409, "โครงการถูกยกเลิกแล้ว");

    const contract = normalizeContract(body.contract, {
      sector: p.sectorType,
      value: Number(p.governmentDetails?.budgetAmount) || Number(p.budgetSummary?.grandTotalWithVat) || 0,
      warrantyMonths: p.warrantyMonths,
    });
    if (contract.dueDate && contract.startDate && contract.dueDate < contract.startDate) throw new ApiAuthError(400, "วันครบกำหนดส่งมอบอยู่ก่อนวันเริ่มงาน");
    for (const g of contract.guarantees) {
      if (g.expiryDate && g.issueDate && g.expiryDate < g.issueDate) throw new ApiAuthError(400, `${g.number || "หลักประกัน"}: วันหมดอายุอยู่ก่อนวันออก`);
    }

    await ref.update({
      contract: { ...contract, updatedBy: apiUser.email || apiUser.uid, updatedAt: new Date().toISOString() },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: apiUser.uid,
    });
    await auditServer.logUpdate(apiUser.uid, companyId, "PROJECT_CONTRACT", String(p.projectCode || p.projectNo || docId), {}, { method: contract.method, contractNo: contract.contractNo || "", guarantees: contract.guarantees.length });
    return NextResponse.json({ success: true, contract });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PROJECT_CONTRACT_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกข้อมูลสัญญาไม่สำเร็จ" }, { status: 500 });
  }
}
