import { adminDb } from "./firebase-admin";
import type { ApiUser } from "./api-auth";
import { PROJECT_TYPE_CONFIGS, ProjectTypeCode } from "@/types/database";
import { computeProjectBudget, normalizeItemLine, normalizeLaborLine } from "./project-budget";
import { milestoneStatus } from "./project-milestones";
import { normalizeSpecChoices } from "./spec-library";
import {
  ALL_DOC_KEYS, BUDGET_SOURCES, PROCUREMENT_METHODS, fiscalYearOf, legalReferences, normalizeExpenses,
  normalizeStage, normalizeTimeline, timelineError,
} from "./project-templates";

/**
 * [SERVER-ONLY] สร้างข้อมูลโครงการจากฟอร์ม (ใช้ทั้งสร้างใหม่และแก้ไขฉบับร่าง)
 * ตรวจข้อมูล ลูกค้า ผู้ใช้ และคำนวณงบประมาณที่ server
 */

const str = (v: any, max = 500) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

/** ตัดค่า undefined ออก (Firestore ไม่รับ undefined) */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as any;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as any).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)])
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

export type BuildResult =
  | { ok: false; error: string }
  | {
      ok: true;
      fields: Record<string, any>;
      budget: ReturnType<typeof computeProjectBudget>;
      hasLines: boolean;
      /** ลูกค้าใหม่ที่พิมพ์ชื่อเข้ามา — route สร้างในทรานแซกชันแล้วใส่ customerId */
      newCustomer: { name: string } | null;
    };

export async function buildProjectFields(body: any, apiUser: ApiUser, companyId: string): Promise<BuildResult> {
  const projectName = str(body.projectName, 200);
  if (projectName.length < 3) return { ok: false, error: "กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร" };

  // ลูกค้า: เลือกจากรายชื่อ หรือพิมพ์ชื่อใหม่ (สร้างให้ตอนบันทึก)
  let customerId = str(body.selectedCustomerId, 120);
  let customer: any = customerId ? await findCustomer(companyId, customerId) : null;
  const newCustomerName = str(body.newCustomerName, 200);
  let newCustomer: { name: string } | null = null;
  if (!customer) {
    if (newCustomerName.length < 2) return { ok: false, error: customerId ? "ไม่พบลูกค้านี้ในบริษัท" : "กรุณาเลือกลูกค้าของโครงการ" };
    newCustomer = { name: newCustomerName };
    customer = { customerName: newCustomerName };
    customerId = "";
  }

  const startDate = isDate(body.startDate) ? body.startDate : new Date().toISOString().slice(0, 10);
  const endDate = isDate(body.endDate) ? body.endDate : startDate;
  if (endDate < startDate) return { ok: false, error: "วันสิ้นสุดโครงการต้องไม่อยู่ก่อนวันที่เริ่ม" };

  // รูปแบบงาน: ฉบับร่างเว้นว่างได้ (เลือกภายหลังหรือคำนวณจากรายการ) ส่งอนุมัติต้องระบุ
  const typeCode = ([1, 2, 3, 4].includes(Number(body.projectTypeCode)) ? Number(body.projectTypeCode) : null) as ProjectTypeCode | null;
  if (!typeCode && body.asDraft !== true) return { ok: false, error: "กรุณาเลือกรูปแบบงาน" };
  const typeConfig = typeCode ? PROJECT_TYPE_CONFIGS[typeCode] : null;
  const sectorType = body.sectorType === "Private" ? "Private" : "Government";
  const projectStage = normalizeStage(body.projectStage);

  // ---- BOQ + งบประมาณ ----
  const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
  const rawLabors: any[] = Array.isArray(body.labors)
    ? body.labors
    : rawItems.filter((i) => i && (i.type === "lump-sum" || i.type === "per-point"));
  const itemLines = rawItems.filter((i) => i && i.type !== "lump-sum" && i.type !== "per-point").map(normalizeItemLine);
  const laborLines = rawLabors.map(normalizeLaborLine);
  const lines = [...itemLines, ...laborLines].filter((l) => l.kind === "GROUP" || l.name);
  const expenses = normalizeExpenses(body.expenses);
  const budget = computeProjectBudget(lines, { startDate, endDate, expenses });

  // ---- แผนงาน -> งวดงาน (งวดเงิน = สัดส่วน × มูลค่ารวม VAT) ----
  const timeline = normalizeTimeline(body.timeline);
  if (body.asDraft !== true) {
    const tErr = timelineError(timeline);
    if (tErr) return { ok: false, error: tErr };
  }
  const contractValue = budget.grandTotalWithVat;
  const milestones = timeline.map((p, i) => {
    const m = {
      id: p.id, seq: i + 1, name: p.name, startDate: p.startDate, endDate: p.endDate,
      weight: p.weight, amount: Math.round(contractValue * p.weight) / 100, progress: 0, note: "",
    };
    return { ...m, status: milestoneStatus(m) };
  });

  // ---- รายละเอียดโครงการ ----
  const rawDoc = body.docSections && typeof body.docSections === "object" ? body.docSections : {};
  const docSections = Object.fromEntries(ALL_DOC_KEYS.map((k) => [k, str(rawDoc[k], 12000)]));

  // ---- ผู้จัดการโครงการ/ทีมงาน ต้องเป็นผู้ใช้ของบริษัท ----
  const pmUid = str(body.projectManagerUid, 128) || apiUser.uid;
  const rawResources: any[] = (Array.isArray(body.resources) ? body.resources : []).filter((r: any) => str(r?.userId));
  const uids = Array.from(new Set([pmUid, ...rawResources.map((r: any) => str(r.userId, 128))]));
  const userDocs = await adminDb.getAll(...uids.map((u) => adminDb.doc(`users/${u}`)));
  const members = new Map<string, any>();
  userDocs.forEach((d) => { if (d.exists && d.data()?.companyId === companyId) members.set(d.id, d.data()); });
  const pm = members.get(pmUid);
  if (!pm && pmUid !== apiUser.uid) return { ok: false, error: "ผู้จัดการโครงการต้องเป็นผู้ใช้ของบริษัท" };
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

  const fields = stripUndefined({
    projectName,
    title: projectName,
    customerId,
    customerName: str(customer.customerName || customer.name || customer.companyName || customerId, 200),
    clientReference: str(body.clientReference, 120),
    projectTypeCode: typeCode,
    projectType: typeConfig?.nameTh || "",
    typeAuto: body.typeAuto !== false,
    sectorType,
    projectStage,
    isBidding: sectorType === "Government" && projectStage !== "CONTRACTED",
    priority: str(body.priority || "ปานกลาง", 30),
    documentChecklist: (typeConfig?.requiredDocuments || []).map((d) => ({
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
    expenses,
    targetMargin: Math.min(90, Math.max(0, Number(body.targetMargin) || 0)),
    warrantyMonths: Math.min(120, Math.max(0, Math.round(Number(body.warrantyMonths) || 0))),
    milestones,
    docSections,
    aiNotes: str(body.aiNotes, 4000),
    specChoices: normalizeSpecChoices(body.specChoices),
    // โครงการบำรุงรักษาต่อจากโครงการเดิม
    maintenanceOf: body.maintenanceOf?.projectDocId ? {
      projectDocId: str(body.maintenanceOf.projectDocId, 120),
      projectId: str(body.maintenanceOf.projectId, 60),
      projectName: str(body.maintenanceOf.projectName, 200),
      level: [1, 2, 3].includes(Number(body.maintenanceOf.level)) ? Number(body.maintenanceOf.level) : 1,
      rounds: Math.min(52, Math.max(1, Math.round(Number(body.maintenanceOf.rounds) || 1))),
    } : null,
    docSources: Object.fromEntries(Object.entries(body.docSources && typeof body.docSources === "object" ? body.docSources : {})
      .filter(([k, v]) => ALL_DOC_KEYS.includes(k as any) && (v === "edited" || v === "ai"))),
    quotationDocId: str(body.quotationDocId, 120),
    legalRefs: legalReferences(sectorType),
    budget: budget.totalRev,
    allocatedCost: budget.totalCost,
    grossProfit: budget.grossProfit,
    gpPercent: budget.gpPercent,
    budgetSummary: budget,
    governmentDetails: sectorType === "Government" ? {
      torDocNo: str(body.governmentDetails?.torDocNo, 120),
      egpProjectNo: str(body.governmentDetails?.egpProjectNo, 60),
      referencePrice: Math.max(0, Number(body.governmentDetails?.referencePrice) || 0),
      budgetAmount: Math.max(0, Number(body.governmentDetails?.budgetAmount) || 0),
      budgetSource: BUDGET_SOURCES.includes(body.governmentDetails?.budgetSource) ? body.governmentDetails.budgetSource : BUDGET_SOURCES[0],
      fiscalYear: Math.round(Number(body.governmentDetails?.fiscalYear) || fiscalYearOf(startDate)),
      procurementMethod: PROCUREMENT_METHODS.includes(body.governmentDetails?.procurementMethod) ? body.governmentDetails.procurementMethod : PROCUREMENT_METHODS[0],
      govContractNo: str(body.governmentDetails?.govContractNo, 120),
    } : undefined,
    privateDetails: sectorType === "Private" ? {
      customerPO: str(body.privateDetails?.customerPO, 120),
      paymentTerms: str(body.privateDetails?.paymentTerms, 500),
    } : undefined,
  });

  return { ok: true, fields, budget, hasLines: lines.some((l) => l.kind !== "GROUP"), newCustomer };
}
