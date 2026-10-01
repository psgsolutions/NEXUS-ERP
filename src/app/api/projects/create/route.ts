import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { nextCounterSequence } from "@/lib/sequence-server";
import { generateStockPilotId } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { PROJECT_TYPE_CONFIGS, ProjectTypeCode } from "@/types/database";

/**
 * [API-SERVER] Server-Side Atomic Project Creation API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/projects/create
 * 
 * Obey Master Protocol:
 * - Scoped query & companyId isolation
 * - isDeleted=false flag attached
 * - Atomic Dual-Write via adminDb.batch()
 * - Server-side RBAC check with can(role, "projects:edit")
 * - Audit Log recorded for every creation
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      projectName,
      selectedCustomerId,
      customerName,
      clientReference = "",
      projectTypeCode = 4,
      projectType = "งานขายอุปกรณ์พร้อมติดตั้งครบวงจร",
      sectorType = "Private",
      priority = "ปานกลาง",
      startDate,
      endDate,
      siteLocation = "ไม่ได้ระบุ",
      siteContact = { name: "ไม่ระบุ", phone: "ไม่ระบุ" },
      followers = [],
      projectManager,
      items = [],
      resources = [],
      governmentDetails,
      privateDetails,
      budgetSummary = {}
    } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userRole = apiUser.role;
    const userId = apiUser.email || apiUser.uid;

    // 1. Mandatory Tenant Isolation Check
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }

    // 2. Server-Side RBAC Enforcement (Defense-in-depth)
    if (!can(userRole, "projects:edit")) {
      return NextResponse.json(
        { success: false, error: "สิทธิ์การใช้งานไม่เพียงพอสำหรับการสร้างโครงการ (ต้องเป็น Role Admin/Engineer ขึ้นไป) 🔒" },
        { status: 403 }
      );
    }

    // 3. Field Validations
    if (!projectName || typeof projectName !== "string" || projectName.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร" },
        { status: 400 }
      );
    }
    if (!selectedCustomerId) {
      return NextResponse.json(
        { success: false, error: "กรุณาเลือกชื่อลูกค้าผู้ชำระเงินในโครงการ" },
        { status: 400 }
      );
    }

    // 4. Atomic Sequence ID Generation
    const nextSeq = await nextCounterSequence("PRJ", companyId, projectName);
    const finalProjectId = generateStockPilotId("PRJ", companyId, nextSeq);

    // 5. Build 3-Step Approval Workflow Definition
    const approvalWorkflow = [
      {
        approvalId: `APP-STEP-1`,
        stepOrder: 1,
        role: "Project Director",
        roleNameTh: "หัวหน้าฝ่ายตรวจสอบความถูกต้อง",
        status: "Pending",
        comments: "รอการตรวจสอบขอบเขตและเป้าหมายโครงการ"
      },
      {
        approvalId: `APP-STEP-2`,
        stepOrder: 2,
        role: "Finance Manager",
        roleNameTh: "ฝ่ายการเงินอนุมัติงบประมาณและต้นทุน",
        status: "Pending",
        comments: "รอการอนุมัติกรอบวงเงินและกำไรขั้นต้น (GP %)"
      },
      {
        approvalId: `APP-STEP-3`,
        stepOrder: 3,
        role: "Executive",
        roleNameTh: "ผู้บริหารอนุมัติเปิดโครงการเป็นทางการ",
        status: "Pending",
        comments: "รอการลงนามอนุมัติสั่งการเปิดโครงการ"
      }
    ];

    // 6. Build Document Checklist based on projectTypeCode
    const typeConfig = PROJECT_TYPE_CONFIGS[projectTypeCode as ProjectTypeCode] || PROJECT_TYPE_CONFIGS[4];
    const initialChecklist = typeConfig.requiredDocuments.map((docItem) => ({
      docCode: docItem.docCode,
      docName: docItem.docName,
      isMandatory: docItem.isMandatory,
      isAttached: false,
      category: docItem.category
    }));

    const nowISO = new Date().toISOString();

    // 7. Complete Project Document Payload
    const projectDocData = {
      projectId: finalProjectId,
      projectName: projectName.trim(),
      title: projectName.trim(),
      customerId: selectedCustomerId,
      customerName: customerName || selectedCustomerId,
      clientReference: clientReference,
      projectType: typeConfig.nameTh,
      projectTypeCode: projectTypeCode,
      projectTypeName: typeConfig.nameTh,
      sectorType: sectorType,
      documentChecklist: initialChecklist,
      priority: priority,
      status: "Pending Approval",
      currentApprovalStep: 1,
      startDate: startDate || nowISO.split("T")[0],
      endDate: endDate || nowISO.split("T")[0],
      siteLocation: siteLocation,
      siteContact: siteContact,
      followers: followers,
      projectManager: projectManager || userId,
      budget: Number(budgetSummary.totalRev || 0),
      allocatedCost: Number(budgetSummary.totalCost || 0),
      actualCost: 0,
      grossProfit: Number(budgetSummary.grossProfit || 0),
      gpPercent: Number(budgetSummary.gpPercent || 0),
      items: items,
      resources: resources,
      approvals: approvalWorkflow,
      governmentDetails: sectorType === "Government" ? (governmentDetails || { bankGuarantee: { status: "Active" } }) : undefined,
      privateDetails: sectorType === "Private" ? (privateDetails || { paymentTerms: "มัดจำ 30%, ชำระงวดสุดท้าย 70% หลังส่งมอบ" }) : undefined,
      companyId: companyId,
      isDeleted: false,
      is_deleted: false,
      createdAt: nowISO,
      updatedAt: nowISO,
      createdBy: userId
    };

    // 8. Atomic Dual-Write using Firebase Admin SDK (db.batch)
    const compProjectRef = adminDb.collection("companies").doc(companyId).collection("projects").doc(finalProjectId);
    const rootProjectRef = adminDb.collection("projects").doc(finalProjectId);

    const batch = adminDb.batch();
    batch.set(compProjectRef, projectDocData);
    batch.set(rootProjectRef, projectDocData);

    await batch.commit();

    // 9. Record Audit Log
    await auditServer.logCreate(userId, companyId, "PROJECTS", finalProjectId, {
      projectId: finalProjectId,
      projectName: projectName,
      budget: budgetSummary.totalRev,
      sectorType: sectorType
    });

    return NextResponse.json(
      {
        success: true,
        projectId: finalProjectId,
        message: `สร้างโครงการ ${finalProjectId} และส่งขออนุมัติ 3 ชั้นสำเร็จ! 🎉`,
        data: projectDocData
      },
      { status: 200 }
    );
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SERVER_PROJECT_CREATE_ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ในการสร้างโครงการ"
      },
      { status: 500 }
    );
  }
}
