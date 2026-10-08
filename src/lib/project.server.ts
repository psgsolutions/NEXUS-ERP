import { adminDb } from "./firebase-admin";
import type { ApiUser } from "./api-auth";
import { PROJECT_TYPE_CONFIGS, ProjectTypeCode } from "@/types/database";
import { computeProjectBudget, normalizeItemLine, normalizeLaborLine } from "./project-budget";

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
  | { ok: true; fields: Record<string, any>; budget: ReturnType<typeof computeProjectBudget>; hasLines: boolean };

export async function buildProjectFields(body: any, apiUser: ApiUser, companyId: string): Promise<BuildResult> {
  const projectName = str(body.projectName, 200);
  if (projectName.length < 3) return { ok: false, error: "กรุณาระบุชื่อโครงการอย่างน้อย 3 ตัวอักษร" };

  const customerId = str(body.selectedCustomerId, 120);
  if (!customerId) return { ok: false, error: "กรุณาเลือกลูกค้าของโครงการ" };
  const customer = await findCustomer(companyId, customerId);
  if (!customer) return { ok: false, error: "ไม่พบลูกค้านี้ในบริษัท" };

  const startDate = isDate(body.startDate) ? body.startDate : new Date().toISOString().slice(0, 10);
  const endDate = isDate(body.endDate) ? body.endDate : startDate;
  if (endDate < startDate) return { ok: false, error: "วันสิ้นสุดโครงการต้องไม่อยู่ก่อนวันที่เริ่ม" };

  const typeCode = ([1, 2, 3, 4].includes(Number(body.projectTypeCode)) ? Number(body.projectTypeCode) : 4) as ProjectTypeCode;
  const typeConfig = PROJECT_TYPE_CONFIGS[typeCode];
  const sectorType = body.sectorType === "Government" ? "Government" : "Private";

  // ---- BOQ + งบประมาณ ----
  const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
  const rawLabors: any[] = Array.isArray(body.labors)
    ? body.labors
    : rawItems.filter((i) => i && (i.type === "lump-sum" || i.type === "per-point"));
  const itemLines = rawItems.filter((i) => i && i.type !== "lump-sum" && i.type !== "per-point").map(normalizeItemLine);
  const laborLines = rawLabors.map(normalizeLaborLine);
  const lines = [...itemLines, ...laborLines].filter((l) => l.kind === "GROUP" || l.name);
  const budget = computeProjectBudget(lines, { startDate, endDate });

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
    projectType: typeConfig.nameTh,
    sectorType,
    priority: str(body.priority || "ปานกลาง", 30),
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
    grossProfit: budget.grossProfit,
    gpPercent: budget.gpPercent,
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
  });

  return { ok: true, fields, budget, hasLines: lines.some((l) => l.kind !== "GROUP") };
}
