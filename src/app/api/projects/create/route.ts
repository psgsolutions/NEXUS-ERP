import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { nexusSequenceServer } from "@/lib/sequence-server";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { PROJECT_TYPE_CONFIGS, ProjectTypeCode } from "@/types/database";
import { computeProjectBudget, normalizeItemLine, normalizeLaborLine } from "@/lib/project-budget";

/**
 * [API-SERVER] สร้างโครงการ
 * Endpoint: POST /api/projects/create
 *
 * - เลขโครงการออกที่ server ครั้งเดียว ตามรูปแบบเลขเอกสาร PRJ ของบริษัท
 * - เก็บที่ companies/{companyId}/projects/{projectId} ที่เดียว
 * - งบประมาณคำนวณใหม่จากรายการ (ไม่เชื่อตัวเลขสรุปจาก browser)
 * - asDraft = true -> สถานะ "Draft" (ยังไม่ส่งอนุมัติ)
 */

const str = (v: any, max = 500) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

// ตัดค่า undefined ออก (Firestore ไม่รับ undefined)
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as any;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as any).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)])
    ) as any;
  }
  return value;
}

async function findCustomer(companyId: string, customerId: string) {
  const own = await adminDb.doc(`companies/${companyId}/customers/${customerId}`).get();
  if (own.exists) return own.data()!;
  const legacy = await adminDb.doc(`customers/${customerId}`).get();
  if (legacy.exists && legacy.data()?.companyId === companyId) return legacy.data()!;
  return null;
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) return badRequest("ไม่พบรหัสบริษัท");

    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "projects:edit")) {
      return NextResponse.json(
        { success: false, error: "สิทธิ์การใช้งานไม่เพียงพอสำหรับการสร้างโครงการ" },
        { status: 403 }
      );
    }
    const userId = apiUser.uid;

    // ---- ตรวจข้อมูล ----
    const projectName = str(body.projectName, 200);
    if (projectName.length < 3) return badRequest("กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร");

    const customerId = str(body.selectedCustomerId, 120);
    if (!customerId) return badRequest("กรุณาเลือกลูกค้าของโครงการ");
    const customer = await findCustomer(companyId, customerId);
    if (!customer) return badRequest("ไม่พบลูกค้านี้ในบริษัท");

    const startDate = isDate(body.startDate) ? body.startDate : new Date().toISOString().slice(0, 10);
    const endDate = isDate(body.endDate) ? body.endDate : startDate;
    if (endDate < startDate) return badRequest("วันสิ้นสุดโครงการต้องไม่อยู่ก่อนวันที่เริ่ม");

    const typeCode = ([1, 2, 3, 4].includes(Number(body.projectTypeCode)) ? Number(body.projectTypeCode) : 4) as ProjectTypeCode;
    const typeConfig = PROJECT_TYPE_CONFIGS[typeCode];
    const sectorType = body.sectorType === "Government" ? "Government" : "Private";
    const asDraft = body.asDraft === true;

    // ---- รายการ BOQ + งบประมาณ (คำนวณที่ server) ----
    const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
    const rawLabors: any[] = Array.isArray(body.labors)
      ? body.labors
      : rawItems.filter((i) => i && (i.type === "lump-sum" || i.type === "per-point"));
    const itemLines = rawItems
      .filter((i) => i && i.type !== "lump-sum" && i.type !== "per-point")
      .map(normalizeItemLine);
    const laborLines = rawLabors.map(normalizeLaborLine);
    const lines = [...itemLines, ...laborLines].filter((l) => l.kind === "GROUP" || l.name);
    if (!asDraft && !lines.some((l) => l.kind !== "GROUP")) {
      return badRequest("กรุณาเพิ่มรายการสินค้าหรืองานบริการอย่างน้อย 1 รายการ");
    }
    const budget = computeProjectBudget(lines, { startDate, endDate });

    // ---- ผู้จัดการโครงการ/ทีมงาน ต้องเป็นผู้ใช้ของบริษัทนี้ ----
    const pmUid = str(body.projectManagerUid, 128) || userId;
    const rawResources: any[] = (Array.isArray(body.resources) ? body.resources : []).filter((r: any) => str(r?.userId));
    const uids = Array.from(new Set([pmUid, ...rawResources.map((r: any) => str(r.userId, 128))]));
    const userDocs = await adminDb.getAll(...uids.map((u) => adminDb.doc(`users/${u}`)));
    const members = new Map<string, any>();
    userDocs.forEach((d) => { if (d.exists && d.data()?.companyId === companyId) members.set(d.id, d.data()); });
    const pm = members.get(pmUid);
    if (!pm && pmUid !== userId) return badRequest("ผู้จัดการโครงการต้องเป็นผู้ใช้ของบริษัท");
    const pmName = str(pm?.name || pm?.displayName || pm?.email || apiUser.email || pmUid, 120);
    const resources = rawResources
      .filter((r: any) => members.has(str(r.userId, 128)))
      .map((r: any) => {
        const u = members.get(str(r.userId, 128));
        return {
          userId: str(r.userId, 128),
          name: str(u?.name || u?.displayName || u?.email || r.name, 120),
          role: str(r.role, 120),
          allocation: Math.min(100, Math.max(0, Number(r.allocation) || 0)),
        };
      });

    // ---- เลขโครงการ (ครั้งเดียว ตามรูปแบบของบริษัท) ----
    const projectId = await nexusSequenceServer("PRJ", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const approvals = [
      { stepOrder: 1, role: "Project Director", roleNameTh: "หัวหน้าฝ่าย: ตรวจขอบเขตและเป้าหมายโครงการ", status: "Pending" },
      { stepOrder: 2, role: "Finance Manager", roleNameTh: "ฝ่ายการเงิน: อนุมัติกรอบวงเงินและกำไรขั้นต้น", status: "Pending" },
      { stepOrder: 3, role: "Executive", roleNameTh: "ผู้บริหาร: อนุมัติเปิดโครงการ", status: "Pending" },
    ];

    const projectDoc = clean({
      projectId,
      projectName,
      title: projectName,
      customerId,
      customerName: str(customer.customerName || customer.name || customer.companyName || customerId, 200),
      clientReference: str(body.clientReference, 120),
      projectTypeCode: typeCode,
      projectType: typeConfig.nameTh,
      sectorType,
      priority: str(body.priority || "ปานกลาง", 30),
      status: asDraft ? "Draft" : "Pending Approval",
      currentApprovalStep: asDraft ? 0 : 1,
      approvals,
      documentChecklist: typeConfig.requiredDocuments.map((d) => ({
        docCode: d.docCode,
        docName: d.docName,
        isMandatory: d.isMandatory,
        isAttached: false,
        category: d.category,
      })),
      startDate,
      endDate,
      siteLocation: str(body.siteLocation, 500),
      siteContact: { name: str(body.siteContact?.name, 120), phone: str(body.siteContact?.phone, 40) },
      followers: (Array.isArray(body.followers) ? body.followers : [])
        .filter((f: any) => str(f?.name))
        .map((f: any) => ({ name: str(f.name, 120), role: str(f.role, 120), phone: str(f.phone, 40), note: str(f.note, 300) })),
      projectManager: pmName,
      projectManagerUid: pmUid,
      resources,
      teamUids: resources.map((r) => r.userId),
      items: lines,
      budget: budget.totalRev,
      allocatedCost: budget.totalCost,
      actualCost: 0,
      grossProfit: budget.grossProfit,
      gpPercent: budget.gpPercent,
      progress: 0,
      budgetSummary: budget,
      governmentDetails: sectorType === "Government" ? {
        torDocNo: str(body.governmentDetails?.torDocNo, 120),
        referencePrice: Math.max(0, Number(body.governmentDetails?.referencePrice) || 0),
        govContractNo: str(body.governmentDetails?.govContractNo, 120),
      } : undefined,
      privateDetails: sectorType === "Private" ? {
        customerPO: str(body.privateDetails?.customerPO, 120),
        paymentTerms: str(body.privateDetails?.paymentTerms, 500),
      } : undefined,
      companyId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      ...(asDraft ? {} : { submittedAt: now, submittedBy: userId }),
    });

    // create(): ถ้าเลขซ้ำ (ไม่ควรเกิด) จะล้มเหลวแทนการเขียนทับโครงการเดิม
    await adminDb.doc(`companies/${companyId}/projects/${projectId}`).create(projectDoc);

    await auditServer.logCreate(userId, companyId, "PROJECTS", projectId, {
      projectId,
      projectName,
      status: projectDoc.status,
      budget: budget.totalRev,
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
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการสร้างโครงการ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
