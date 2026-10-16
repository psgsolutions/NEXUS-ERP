import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { nexusSequenceServer } from "@/lib/sequence-server";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { buildProjectFields } from "@/lib/project.server";
import { approverRolesForStep, initialApprovals } from "@/lib/project-status";
import { notify } from "@/lib/notifications.server";
import { createCustomerInTx } from "@/lib/quotation.server";

/**
 * [API-SERVER] สร้างโครงการ
 * Endpoint: POST /api/projects/create
 *
 * - เลขโครงการออกที่ server ครั้งเดียว ตามรูปแบบเลขเอกสาร PRJ ของบริษัท
 * - เก็บที่ companies/{companyId}/projects/{projectId} ที่เดียว
 * - งบประมาณคำนวณใหม่จากรายการ (ไม่เชื่อตัวเลขสรุปจาก browser)
 * - asDraft = true -> สถานะ "Draft" (ยังไม่ส่งอนุมัติ)
 */

const badRequest = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) return badRequest("ไม่พบรหัสบริษัท");

    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "projects:edit")) {
      return NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอสำหรับการสร้างโครงการ" }, { status: 403 });
    }

    const built = await buildProjectFields(body, apiUser, companyId);
    if (!built.ok) return badRequest(built.error);
    const asDraft = body.asDraft === true;
    if (!asDraft && !built.hasLines) return badRequest("กรุณาเพิ่มรายการสินค้าหรืองานบริการอย่างน้อย 1 รายการ");
    if (!asDraft && built.fields.projectStage !== "CONTRACTED") return badRequest("โครงการที่ยังไม่ได้งานบันทึกเป็นแผนโครงการได้เท่านั้น — เปลี่ยนขั้นเป็น 'ได้งาน / ลงนามสัญญาแล้ว' ก่อนส่งขออนุมัติ");

    const projectId = await nexusSequenceServer("PRJ", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const projectDoc = {
      ...built.fields,
      projectId,
      status: asDraft ? "Draft" : "Pending Approval",
      currentApprovalStep: asDraft ? 0 : 1,
      approvals: initialApprovals(),
      progress: 0,
      actualCost: 0,
      companyId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: apiUser.uid,
      ...(asDraft ? {} : { submittedAt: now, submittedBy: apiUser.uid }),
    };

    // create(): ถ้าเลขซ้ำ (ไม่ควรเกิด) จะล้มเหลวแทนการเขียนทับโครงการเดิม
    // ลูกค้าใหม่ (พิมพ์ชื่อเข้ามา) สร้างพร้อมโครงการในทรานแซกชันเดียว
    await adminDb.runTransaction(async (tx) => {
      if (built.newCustomer) (projectDoc as Record<string, any>).customerId = createCustomerInTx(tx, companyId, built.newCustomer);
      tx.create(adminDb.doc(`companies/${companyId}/projects/${projectId}`), projectDoc);
    });
    if (!asDraft) {
      await notify(companyId, {
        type: "PROJECT_PENDING_APPROVAL",
        title: `โครงการ ${projectId} รออนุมัติขั้นที่ 1`,
        message: String(built.fields.projectName || ""),
        link: `/projects/${projectId}`,
        targetRoles: approverRolesForStep(1),
        documentNo: projectId,
      }, apiUser.uid);
    }

    await auditServer.logCreate(apiUser.uid, companyId, "PROJECTS", projectId, {
      projectId,
      projectName: built.fields.projectName,
      status: projectDoc.status,
      budget: built.budget.totalRev,
    });

    return NextResponse.json({
      success: true,
      projectId,
      status: projectDoc.status,
      message: asDraft ? `บันทึกฉบับร่างโครงการ ${projectId} แล้ว` : `สร้างโครงการ ${projectId} และส่งขออนุมัติแล้ว`,
    });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SERVER_PROJECT_CREATE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดในการสร้างโครงการ กรุณาลองใหม่" }, { status: 500 });
  }
}
