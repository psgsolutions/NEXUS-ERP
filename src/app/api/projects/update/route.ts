import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { buildProjectFields } from "@/lib/project.server";
import { createCustomerInTx } from "@/lib/quotation.server";
import { EDITABLE_STATUSES, approverRolesForStep, initialApprovals, normalizeProjectStatus } from "@/lib/project-status";
import { notifyInTx } from "@/lib/notifications.server";

/**
 * [API-SERVER] แก้ไขโครงการที่ยังเป็นฉบับร่าง หรือถูกตีกลับ (Rejected)
 * Endpoint: POST /api/projects/update  { companyId, projectDocId, asDraft, ...ข้อมูลฟอร์ม }
 * asDraft = false -> ส่งขออนุมัติใหม่ (เริ่มขั้นอนุมัติที่ 1)
 */

const badRequest = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const docId = String(body.projectDocId || "").trim();
    if (!companyId || !docId) return badRequest("ข้อมูลไม่ครบ");

    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "projects:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const built = await buildProjectFields(body, apiUser, companyId);
    if (!built.ok) return badRequest(built.error);
    const asDraft = body.asDraft === true;
    if (!asDraft && !built.hasLines) return badRequest("กรุณาเพิ่มรายการสินค้าหรืองานบริการอย่างน้อย 1 รายการ");
    if (!asDraft && built.fields.projectStage !== "CONTRACTED") return badRequest("โครงการที่ยังไม่ได้งานบันทึกเป็นแผนโครงการได้เท่านั้น — เปลี่ยนขั้นเป็น 'ได้งาน / ลงนามสัญญาแล้ว' ก่อนส่งขออนุมัติ");

    const ref = adminDb.doc(`companies/${companyId}/projects/${docId}`);
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
      const cur = snap.data()!;
      const status = normalizeProjectStatus(cur.status);
      if (!EDITABLE_STATUSES.includes(status)) {
        throw new ApiAuthError(409, "แก้ไขได้เฉพาะโครงการฉบับร่างหรือที่ถูกตีกลับ");
      }
      const isOwner = cur.createdBy === apiUser.uid;
      if (!isOwner && apiUser.role !== "ADMIN" && apiUser.role !== "SUPERADMIN") {
        throw new ApiAuthError(403, "แก้ไขได้เฉพาะผู้สร้างโครงการหรือผู้ดูแลระบบ");
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      const del = admin.firestore.FieldValue.delete();
      if (built.newCustomer) built.fields.customerId = createCustomerInTx(tx, companyId, built.newCustomer);
      tx.update(ref, {
        ...built.fields,
        // เปลี่ยนประเภทลูกค้า: ลบข้อมูลสัญญาของอีกประเภททิ้ง
        ...(built.fields.governmentDetails ? { privateDetails: del } : { governmentDetails: del }),
        ...(asDraft
          ? { status: status === "Rejected" ? "Rejected" : "Draft" }
          : { status: "Pending Approval", currentApprovalStep: 1, approvals: initialApprovals(), submittedAt: now, submittedBy: apiUser.uid }),
        updatedAt: now,
        updatedBy: apiUser.uid,
      });
      if (!asDraft) {
        notifyInTx(tx, companyId, {
          type: "PROJECT_PENDING_APPROVAL",
          title: `โครงการ ${cur.projectId || docId} ส่งขออนุมัติใหม่`,
          message: String(built.fields.projectName || cur.projectName || ""),
          link: `/projects/${docId}`,
          targetRoles: approverRolesForStep(1),
          documentNo: cur.projectId || docId,
        }, apiUser.uid);
      }
      return { projectId: cur.projectId || docId, status: asDraft ? status : "Pending Approval" };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "PROJECTS", result.projectId, {}, { status: result.status, budget: built.budget.totalRev });

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      status: result.status,
      message: asDraft ? `บันทึกการแก้ไขโครงการ ${result.projectId} แล้ว` : `ส่งขออนุมัติโครงการ ${result.projectId} แล้ว`,
    });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SERVER_PROJECT_UPDATE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
