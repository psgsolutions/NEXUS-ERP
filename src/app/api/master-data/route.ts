import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { PRODUCT_THUMB_MAX } from "@/lib/attachments";
import { isStockItem } from "@/lib/product-kind";
import { partyUnitKey, taxIdProblem } from "@/lib/party-identity";
import { prepareSequence } from "@/lib/sequence-server";
import { resolveSequenceFormat, type SequencePrefix } from "@/lib/sequence-engine";
import { requireApiUser, authErrorResponse, ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { canEditMaster, companiesInGroup, groupIdOfCompany } from "@/lib/company-group.server";
import { auditServer } from "@/services/audit.server";
import { processStockMovements } from "@/lib/stock-service";
import { LEGACY_ROOT } from "@/lib/master-store.server";
import { normalizeDocProfile } from "@/lib/customer-doc-profile";
import { MASTER_SCHEMAS, isMasterEntity, mergeRecord, splitChanges, uniqueKeyDocId, uniqueKeyValue, type EditScope, type MasterEntity } from "@/lib/master-data";

/**
 * [API-SERVER] ข้อมูลหลักแบบเครือบริษัท — POST /api/master-data
 *  - { action: "get", entity, id }                         ข้อมูลรวม (กลาง + ของบริษัท)
 *  - { action: "context" }                                 เครือของบริษัท จำนวนบริษัท และสิทธิ์แก้ข้อมูลกลาง
 *  - { action: "checkDuplicate", entity, data }            มีรายการที่ SKU/บาร์โค้ด/เลขผู้เสียภาษี ซ้ำในเครือหรือไม่
 *  - { action: "create", entity, id?, data, openingStock? } สร้างใหม่ (ข้อมูลกลาง + ของบริษัท)
 *      autoSku (สินค้า, ใช้ตอนนำเข้าไฟล์): SKU ว่าง = ระบบออกรหัส PRD-ปปดด-001 ให้ (ไม่ซ้ำในเครือ) คืนใน { sku }
 *      openingStock (สินค้า): { qty, unitCost, postJournal? } รับเข้าเป็นยอดยกมา ผ่าน stock engine + บันทึกบัญชีร่าง Dr สินค้าคงเหลือ / Cr กำไรสะสม
 *      (postJournal: false = ไม่บันทึกบัญชี — ใช้เมื่อยอดสินค้าคงเหลือรวมอยู่ในงบทดลองยกมาแล้ว)
 * สินค้าที่ยังอยู่ root products (ก่อนย้ายข้อมูล): get/update ทำงานกับเอกสารเดิม
 *  - { action: "adopt", entity, id, data? }                ใช้รายการกลางที่มีอยู่แล้วในบริษัทนี้ (ตั้งค่าของบริษัทได้)
 *  - { action: "update", entity, id, changes, scope }      scope "group" = แก้ค่ากลาง / "company" = ตั้งค่าของบริษัท
 *      ลูกค้า: changes.docProfile = โปรไฟล์เอกสาร (ของบริษัทเสมอ; แก้เฉพาะ docProfile ได้ด้วยสิทธิ์ finance:edit)
 *  - { action: "resetLocal", entity, id, fields }          ล้างค่าของบริษัท กลับไปใช้ค่ากลาง
 *  - { action: "remove", entity, id }                      ซ่อนรายการของบริษัท (isDeleted) — ข้อมูลกลางของเครือยังอยู่ ใช้ "adopt" นำกลับได้
 * entity: products | customers | suppliers | contractors
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const ID = /^[A-Za-z0-9_.-]{1,120}$/;

/**
 * รหัสคู่ค้าตามมาตรฐาน (รูปแบบตั้งได้ที่ ตั้งค่า → รูปแบบเลขที่ ค่าตั้งต้น PREFIX-YYMM-0000)
 * ออกที่ server ทุกช่องทาง (ฟอร์ม นำเข้า Excel) ในทรานแซกชันเดียวกับการสร้าง — ไม่ข้ามเลข ไม่ซ้ำ
 *  - ลูกค้า CUS-… (รหัสเอกสาร = รหัสลูกค้า) · ผู้ขาย SUP-… (รหัสเอกสาร = รหัสผู้ขาย) · ผู้รับเหมา SUB-…
 */
const PARTY_CODE: Partial<Record<MasterEntity, { prefix: SequencePrefix; field: string; asId: boolean }>> = {
  customers: { prefix: "CUS", field: "customerId", asId: true },
  suppliers: { prefix: "SUP", field: "supplierCode", asId: true },
  contractors: { prefix: "SUB", field: "contractorId", asId: true },
};
/** ฟิลด์ของบริษัทที่ระบบคำนวณเอง (สต็อก ต้นทุน ยอดหนี้) ห้ามแก้ผ่าน API นี้ */
const PROTECTED: Record<MasterEntity, string[]> = {
  products: ["stock", "currentStock", "stockStatus", "cost", "wac", "averageCost", "lastCost", "stockValue"],
  customers: ["arBalance", "outstanding", "balance"],
  suppliers: ["apBalance", "outstanding", "balance"],
  contractors: ["apBalance", "outstanding", "balance"],
};

/** หมายเลขเครื่องจากช่องกรอก (คั่นด้วยขึ้นบรรทัด/จุลภาค) — ใช้เป็นรหัสเอกสาร จึงห้าม / และยาวไม่เกิน 60 */
function parseOpeningSerials(raw: unknown): string[] {
  const list = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[\n,;]+/)).map((v) => String(v ?? "").trim()).filter(Boolean);
  const bad = list.find((sn) => !/^[A-Za-z0-9._-]{1,60}$/.test(sn));
  if (bad) throw new ApiAuthError(400, `หมายเลขเครื่องไม่ถูกต้อง: ${bad.slice(0, 40)} (ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ -)`);
  const seen = new Set<string>(), dup = list.find((sn) => (seen.has(sn.toUpperCase()) ? true : (seen.add(sn.toUpperCase()), false)));
  if (dup) throw new ApiAuthError(400, `หมายเลขเครื่องซ้ำ: ${dup}`);
  if (list.length > 2000) throw new ApiAuthError(400, "หมายเลขเครื่องเกิน 2,000 รายการ");
  return list;
}

/** ตัดค่าที่ Firestore เก็บไม่ได้ และจำกัดขนาด */
function clean(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(k) || v === undefined) continue;
    // รูปสินค้าย่อ (JPEG data URL) ยาวได้ถึง PRODUCT_THUMB_MAX · ลิงก์ชั่วคราว blob: ของเบราว์เซอร์ไม่เก็บ
    if (k === "imageUrl" && typeof v === "string") { out[k] = v.startsWith("data:image/jpeg;base64,") && v.length <= PRODUCT_THUMB_MAX ? v : v.startsWith("blob:") ? "" : v.slice(0, 2000); continue; }
    out[k] = typeof v === "string" ? v.slice(0, 5000) : v;
  }
  if (JSON.stringify(out).length > 200_000) throw new ApiAuthError(400, "ข้อมูลใหญ่เกินไป");
  return out;
}

/** ตัดฟิลด์ที่ระบบคำนวณเอง (สต็อก ต้นทุนเฉลี่ย ยอดหนี้) ออก — แก้ได้ผ่านเอกสารคลัง/บัญชีเท่านั้น */
/** คู่ค้า: ใช้ taxId / branchCode เป็นหลัก (ฟอร์มเก่าใช้ tax_id / branch_code) เพื่อให้ตรวจซ้ำได้ */
function normalizeParty(entity: MasterEntity, data: Record<string, any>) {
  if (entity === "products") return data;
  const out = { ...data };
  const tax = String(out.taxId ?? out.tax_id ?? "").replace(/\D/g, "");
  if (tax) {
    const problem = taxIdProblem(tax);
    if (problem) throw new ApiAuthError(400, problem);
    out.taxId = tax;
  }
  if (!out.branchCode && out.branch_code) out.branchCode = String(out.branch_code);
  if (out.branchCode !== undefined) { const b = String(out.branchCode).replace(/\D/g, ""); out.branchCode = b ? b.padStart(5, "0") : "00000"; }
  for (const k of ["unitName", "taxInvoiceName"]) if (out[k] !== undefined) out[k] = String(out[k] ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  return out;
}

function protectLocal(entity: MasterEntity, local: Record<string, any>): string[] {
  const dropped = Object.keys(local).filter((k) => PROTECTED[entity].includes(k));
  dropped.forEach((k) => delete local[k]);
  if (entity === "products" && local.pricing && typeof local.pricing === "object" && "costWAC" in local.pricing) {
    const { costWAC: _ignored, ...rest } = local.pricing; void _ignored;
    local.pricing = rest;
    dropped.push("pricing.costWAC");
  }
  return dropped;
}

async function findDuplicates(tx: admin.firestore.Transaction | null, groupId: string, entity: MasterEntity, data: Record<string, any>, exceptId = "") {
  const hits: { fields: string[]; value: string; id: string }[] = [];
  for (const fields of MASTER_SCHEMAS[entity].unique) {
    const value = uniqueKeyValue(fields, data);
    if (!value) continue;
    const ref = adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, value)}`);
    const snap = tx ? await tx.get(ref) : await ref.get();
    if (snap.exists && snap.data()!.id !== exceptId) hits.push({ fields, value, id: snap.data()!.id });
    // ดัชนีรูปแบบเดิม (ก่อนใช้ชื่อรายการแทนหน่วยงานว่าง) = "เลข|สาขา|" — ซ้ำเมื่อรายการนั้นชื่อเดียวกัน
    if (fields.includes("unitName") && !hits.some((h) => h.fields === fields)) {
      const parts = value.split("|");
      const legacyValue = fields.map((f, i) => (f === "unitName" ? "" : parts[i])).join("|");
      const lref = adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, legacyValue)}`);
      const lsnap = tx ? await tx.get(lref) : await lref.get();
      const ownerId = lsnap.exists ? String(lsnap.data()!.id) : "";
      if (ownerId && ownerId !== exceptId) {
        const oref = adminDb.doc(`groups/${groupId}/${entity}/${ownerId}`);
        const owner = (tx ? await tx.get(oref) : await oref.get()).data();
        if (owner && owner.isDeleted !== true && uniqueKeyValue(fields, owner) === value) hits.push({ fields, value, id: ownerId });
      }
    }
  }
  return hits;
}

const TAX_IDENTITY = ["taxId", "branchCode", "unitName", "taxInvoiceName", "legalName"];

/** คู่ค้ารายนี้มีเอกสารภาษีในบริษัทใดของเครือแล้วหรือยัง (ลูกค้า: ใบกำกับภาษี · ผู้ขาย/ผู้รับเหมา: ค่าใช้จ่าย/หนังสือรับรองหัก ณ ที่จ่าย) */
async function hasTaxDocuments(entity: MasterEntity, groupId: string, companyId: string, id: string): Promise<boolean> {
  const companies = new Set<string>([companyId]);
  (await adminDb.collection("companies").where("groupId", "==", groupId).get()).docs.forEach((d) => companies.add(d.id));
  companies.add(groupId);
  const checks = entity === "customers" ? [["invoices", "customerId"]] : [["withholding_taxes", "supplierId"], ["expenses", "supplierId"]];
  for (const c of companies) for (const [col, field] of checks) {
    if (!(await adminDb.collection(`companies/${c}/${col}`).where(field, "==", id).limit(1).get()).empty) return true;
  }
  return false;
}

/** รายการนี้ถูกอ้างถึงในเอกสารของบริษัทใดในเครือแล้วหรือยัง — คืนชื่อเอกสาร หรือ "" */
async function usedInDocuments(entity: MasterEntity, groupId: string, companyId: string, id: string): Promise<string> {
  const companies = new Set<string>([companyId, groupId]);
  (await adminDb.collection("companies").where("groupId", "==", groupId).get()).docs.forEach((d) => companies.add(d.id));
  const checks: [string, string, string][] =
    entity === "customers" ? [["quotations", "customerId", "ใบเสนอราคา"], ["sales_orders", "customerId", "ใบสั่งขาย"], ["invoices", "customerId", "ใบกำกับภาษี/ใบแจ้งหนี้"], ["projects", "customerId", "โครงการ"]]
    : entity === "products" ? [["stock_movements", "productId", "ความเคลื่อนไหวสต็อก"]]
    : [["purchase_orders", "supplierId", "ใบสั่งซื้อ"], ["expenses", "supplierId", "ค่าใช้จ่าย"], ["withholding_taxes", "supplierId", "หนังสือรับรองหัก ณ ที่จ่าย"], ["goods_receipts", "supplierId", "ใบรับสินค้า"]];
  for (const c of companies) for (const [col, field, label] of checks) {
    if (entity === "products" && col === "stock_movements") {
      // ยอดยกมาตอนสร้าง/นำเข้าสินค้า (OPEN-{id}) ไม่นับเป็นการใช้งาน — ลบสินค้าแล้วกลับรายการให้ (ดู openingReversal)
      const moves = await adminDb.collection(`companies/${c}/${col}`).where(field, "==", id).limit(50).get();
      if (moves.docs.some((d) => d.get("isDeleted") !== true && d.get("referenceId") !== `OPEN-${id}`)) return label;
      continue;
    }
    if (!(await adminDb.collection(`companies/${c}/${col}`).where(field, "==", id).limit(1).get()).empty) return label;
  }
  return "";
}

/**
 * สินค้าที่มีแค่ยอดยกมา (สร้าง/นำเข้าพร้อมจำนวนคงเหลือ แล้วยังไม่มีการเคลื่อนไหวอื่น) — สิ่งที่ต้องกลับรายการเมื่อลบ
 * ใบสำคัญยอดยกมาที่ลงบัญชีแล้ว = ลบไม่ได้ (ให้ฝ่ายบัญชีกลับรายการก่อน) · ฉบับร่าง = ยกเลิกให้
 */
async function openingReversal(companyId: string, id: string, onHand: number, reserved: number) {
  const ref = `OPEN-${id}`;
  const moves = (await adminDb.collection(`companies/${companyId}/stock_movements`).where("productId", "==", id).limit(50).get()).docs.filter((d) => d.get("isDeleted") !== true);
  const opening = moves.filter((d) => d.get("referenceId") === ref);
  const qty = opening.reduce((s, d) => s + (d.get("type") === "IN" ? Number(d.get("quantity")) || 0 : 0), 0);
  if (onHand > 0 || reserved > 0) {
    if (!opening.length || opening.length !== moves.length || reserved > 0 || Math.abs(onHand - qty) > 1e-9) {
      throw new ApiAuthError(409, "ยังมีสต็อกหรือยอดจองอยู่ ลบไม่ได้ — ตัดจำหน่าย/เบิกออกก่อน");
    }
  }
  if (!opening.length) return null;
  const journals = (await adminDb.collection(`companies/${companyId}/journal_entries`).where("reference", "==", ref).get()).docs.filter((d) => d.get("isDeleted") !== true && d.get("status") !== "cancelled");
  const posted = journals.find((d) => d.get("status") !== "draft");
  if (posted) throw new ApiAuthError(409, `ยอดยกมาของสินค้านี้ลงบัญชีแล้ว (${posted.get("journalNo") || posted.id}) ลบไม่ได้ — ให้ฝ่ายบัญชีกลับรายการก่อน หรือตั้งสถานะเป็นระงับใช้งานแทน`);
  const serials = (await adminDb.collection(`companies/${companyId}/serial_numbers`).where("productId", "==", id).get()).docs.filter((d) => d.get("isDeleted") !== true && d.get("lastReference") === ref);
  return { moves: opening.map((d) => d.ref), journals: journals.map((d) => d.ref), serials: serials.map((d) => d.ref), qty };
}

const FIELD_LABEL: Record<string, string> = { taxId: "เลขผู้เสียภาษี", branchCode: "สาขา", unitName: "ชื่อ/หน่วยงาน", sku: "รหัสสินค้า", barcode: "บาร์โค้ด" };
const dupMessage = (entity: MasterEntity, hits: { fields: string[]; value: string; id: string }[]) =>
  `${MASTER_SCHEMAS[entity].label}ที่มี ${hits.map((h) => h.fields.map((f, i) => `${FIELD_LABEL[f] || f} ${h.value.split("|")[i] || (f === "unitName" ? "(หน่วยงานหลัก)" : "-")}`).join(" · ")).join(", ")} มีอยู่แล้วในเครือ (รหัส ${hits.map((h) => h.id).join(", ")})` +
  (MASTER_SCHEMAS[entity].unique.some((u) => u.includes("unitName")) ? " — ใช้รายการเดิม หรือถ้าเป็นหน่วยงานแยกภายใต้เลขเดียวกัน ให้ระบุชื่อหน่วยงาน" : " — ใช้รายการเดิมแล้วตั้งชื่อเฉพาะบริษัทแทน");

function writeUniqueKeys(tx: admin.firestore.Transaction, groupId: string, entity: MasterEntity, id: string, before: Record<string, any> | null, after: Record<string, any>) {
  for (const fields of MASTER_SCHEMAS[entity].unique) {
    const oldV = before ? uniqueKeyValue(fields, before) : "";
    const newV = uniqueKeyValue(fields, after);
    if (oldV === newV) continue;
    if (oldV) tx.delete(adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, oldV)}`));
    if (newV) tx.set(adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, newV)}`), { entity, fields, value: newV, id });
  }
}

/** รายการรุ่นเก่า (ยังไม่มีดัชนีห้ามซ้ำ) ที่ SKU/บาร์โค้ด หรือเลขผู้เสียภาษี+สาขา ชนกัน */
async function legacyDuplicates(entity: MasterEntity, companyId: string, data: Record<string, any>, exceptId = "") {
  const hits: { fields: string[]; value: string; id: string }[] = [];
  const live = (d: admin.firestore.QueryDocumentSnapshot) => d.id !== exceptId && d.data().isDeleted !== true;
  if (entity === "products") {
    for (const f of ["sku", "barcode"]) {
      const v = String(data?.[f] ?? "").trim();
      if (!v) continue;
      const q = await adminDb.collection("products").where("companyId", "==", companyId).where(f, "==", v).limit(3).get();
      q.docs.filter(live).forEach((d) => hits.push({ fields: [f], value: v.toUpperCase(), id: d.id }));
    }
    return hits;
  }
  const taxId = String(data?.taxId ?? data?.tax_id ?? "").replace(/\D/g, "");
  if (!taxId) return hits;
  const branchOf = (x: any) => String(x?.branchCode ?? x?.branch_code ?? "").trim() || "00000";
  const branch = branchOf(data);
  const col = LEGACY_ROOT[entity] ? adminDb.collection(LEGACY_ROOT[entity]!).where("companyId", "==", companyId) : adminDb.collection(`companies/${companyId}/${entity}`);
  const [a, b] = await Promise.all([col.where("taxId", "==", taxId).limit(5).get(), col.where("tax_id", "==", taxId).limit(5).get()]);
  const seen = new Set<string>();
  // ชื่อเดียวกันเท่านั้นถึงซ้ำ (เลขเดียวกัน ต่างชื่อ = คนละรายการ) · สำเนาของบริษัทที่ไม่มีชื่อ ตรวจที่ดัชนีข้อมูลกลางแทน
  const unit = partyUnitKey(data);
  [...a.docs, ...b.docs].filter(live).filter((d) => branchOf(d.data()) === branch && !!partyUnitKey(d.data()) && partyUnitKey(d.data()) === unit).forEach((d) => {
    if (!seen.has(d.id)) { seen.add(d.id); hits.push({ fields: ["taxId", "branchCode"], value: `${taxId}|${branch}`, id: d.id }); }
  });
  return hits;
}

/** เอกสารรุ่นเก่าของบริษัทนี้ที่ยังไม่ย้ายเข้าข้อมูลกลาง: root (สินค้า ผู้ขาย ผู้รับเหมา) หรือเอกสารลูกค้าใต้บริษัท */
async function legacyDoc(entity: MasterEntity, id: string, companyId: string) {
  const root = LEGACY_ROOT[entity];
  const snap = await adminDb.doc(root ? `${root}/${id}` : `companies/${companyId}/${entity}/${id}`).get();
  if (!snap.exists || (root && snap.data()!.companyId !== companyId)) return null;
  return snap;
}

/** ออกรหัสสินค้า PRD-ปปดด-NNN (รูปแบบเดียวกับฟอร์มเพิ่มสินค้า) จากตัวนับของเครือ ข้ามรหัสที่มีคนใช้แล้ว */
async function nextAutoSku(groupId: string, companyId: string): Promise<string> {
  // รูปแบบตาม ตั้งค่า → รูปแบบเลขที่ (ค่าตั้งต้น PRD-YYMM-0000) · ตัวนับใช้ร่วมทั้งเครือ เพราะสินค้าเป็นข้อมูลกลาง
  const th = new Date(Date.now() + 7 * 3600_000);
  const fmt = (await adminDb.doc(`companies/${companyId}/settings/sequence_formats`).get()).data()?.PRD;
  const { prefixPart: prefix, suffixPart, padLength } = resolveSequenceFormat("PRD", fmt, new Date(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate()));
  const counterRef = adminDb.doc(`counters/${groupId}_${prefix.replace(/[^A-Za-z0-9_-]/g, "").replace(/-$/, "")}`);
  for (let tries = 0; tries < 50; tries++) {
    const n = await adminDb.runTransaction(async (tx) => {
      const seq = ((await tx.get(counterRef)).data()?.seq || 0) + 1;
      tx.set(counterRef, { seq, currentValue: seq, type: "PRD", groupId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return seq;
    });
    const sku = `${prefix}${String(n).padStart(padLength, "0")}${suffixPart}`;
    const used = (await findDuplicates(null, groupId, "products", { sku })).length || (await legacyDuplicates("products", companyId, { sku })).length;
    if (!used) return sku;
  }
  throw new ApiAuthError(409, "ออกรหัสสินค้าอัตโนมัติไม่สำเร็จ — ใส่รหัสสินค้าเองแล้วลองใหม่");
}

const historyEntry = (u: ApiUser, companyId: string, action: string, changes: Record<string, any>) => ({
  at: admin.firestore.FieldValue.serverTimestamp(), by: u.uid, byName: u.email || u.uid, companyId, action, changes,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 30);
    const groupId = await groupIdOfCompany(companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "context") {
      const companies = await companiesInGroup(groupId);
      const rights = Object.fromEntries(await Promise.all((["products", "customers", "suppliers", "contractors"] as MasterEntity[]).map(async (e) => [e, await canEditMaster(apiUser, companyId, e, groupId)])));
      return NextResponse.json({ success: true, groupId, companyCount: companies.length, canEditMaster: rights });
    }

    const entity = body.entity;
    if (!isMasterEntity(entity)) throw new ApiAuthError(400, "ประเภทข้อมูลไม่ถูกต้อง");
    const schema = MASTER_SCHEMAS[entity];
    const viewPerm = schema.editPermission.replace(":edit", ":view") as any;
    if (!can(apiUser.roles, viewPerm) && !can(apiUser.roles, schema.editPermission)) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const masterCol = adminDb.collection(`groups/${groupId}/${entity}`);
    const localCol = adminDb.collection(`companies/${companyId}/${entity}`);

    if (action === "get") {
      const id = str(body.id, 120);
      if (!ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");
      const [m, l, legacy] = await Promise.all([masterCol.doc(id).get(), localCol.doc(id).get(), legacyDoc(entity, id, companyId)]);
      if (!m.exists && !l.exists && !legacy) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
      const record = m.exists || !legacy ? mergeRecord(entity, m.data(), l.data()) : { ...legacy.data(), ...mergeRecord(entity, null, l.data()), _legacy: true };
      return NextResponse.json({ success: true, groupId, record: { id, ...record } });
    }

    if (action === "checkDuplicate") {
      const exceptId = str(body.exceptId, 120);
      const hits = [...(await findDuplicates(null, groupId, entity, body.data || {}, exceptId)), ...(await legacyDuplicates(entity, companyId, body.data || {}, exceptId))];
      return NextResponse.json({ success: true, duplicates: hits });
    }

    // โปรไฟล์เอกสารลูกค้า (เฉพาะฟิลด์ docProfile ของบริษัท): แอดมินการเงินตั้งรูปแบบวางบิล/รับเงินได้ แม้ไม่มีสิทธิ์งานขาย
    const changeKeys = body.changes && typeof body.changes === "object" ? Object.keys(body.changes) : [];
    const profileOnly = action === "update" && entity === "customers" && changeKeys.length === 1 && changeKeys[0] === "docProfile";
    if (!can(apiUser.roles, schema.editPermission) && !(profileOnly && can(apiUser.roles, "finance:edit"))) throw new ApiAuthError(403, `ไม่มีสิทธิ์แก้ไขข้อมูล${schema.label}`);
    if (entity === "customers" && body.changes?.docProfile !== undefined) {
      // ตรวจค่าที่ server และบันทึกผู้แก้ล่าสุด (โปรไฟล์อยู่ที่ข้อมูลของบริษัทเสมอ)
      body.changes.docProfile = { ...normalizeDocProfile(body.changes.docProfile), updatedBy: apiUser.email || apiUser.uid, updatedAt: new Date().toISOString() };
      body.scope = "company";
    }

    if (action === "create") {
      const data = normalizeParty(entity, clean(body.data || {}));
      if (!str(data.name)) throw new ApiAuthError(400, `กรุณาระบุชื่อ${schema.label}`);
      if (entity === "products" && body.autoSku === true && !str(data.sku)) data.sku = data.productCode = await nextAutoSku(groupId, companyId);
      let id = str(body.id, 120);
      if (id && !ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");
      // สร้างรายการใหม่ = ค่าที่กรอกเป็นค่ากลาง (identity + shared) ส่วนที่เหลือเป็นของบริษัท
      const { master, local } = splitChanges(entity, data, "group");
      protectLocal(entity, local);
      const opening = entity === "products" ? { qty: Math.floor(Number(body.openingStock?.qty) || 0), unitCost: Math.max(0, Number(body.openingStock?.unitCost) || 0) } : { qty: 0, unitCost: 0 };
      const postOpeningJournal = body.openingStock?.postJournal !== false;
      if (opening.qty < 0 || opening.qty > 10_000_000) throw new ApiAuthError(400, "จำนวนยกมาไม่ถูกต้อง");
      if (opening.qty > 0 && !isStockItem(data)) throw new ApiAuthError(400, "งานบริการไม่มียอดสต็อกยกมา");
      // หมายเลขเครื่องของยอดยกมา (สินค้าคุม S/N): ต้องครบเท่าจำนวน ไม่ซ้ำ และยังไม่มีในระบบ
      const openingSerials = entity === "products" ? parseOpeningSerials(body.openingStock?.serials) : [];
      if (openingSerials.length) {
        if (openingSerials.length !== opening.qty) throw new ApiAuthError(400, `หมายเลขเครื่อง ${openingSerials.length} รายการ ไม่เท่ากับจำนวนยกมา ${opening.qty}`);
        const existing = await adminDb.getAll(...openingSerials.map((sn) => adminDb.doc(`companies/${companyId}/serial_numbers/${sn}`)));
        const taken = existing.filter((d) => d.exists && d.get("isDeleted") !== true).map((d) => d.id);
        if (taken.length) throw new ApiAuthError(409, `หมายเลขเครื่องมีในระบบแล้ว: ${taken.slice(0, 5).join(", ")}`);
      }
      if (entity === "products") local.stockStatus = { onHand: 0, reserved: 0, available: 0 };
      const legacyHits = await legacyDuplicates(entity, companyId, master);
      if (legacyHits.length) throw new ApiAuthError(409, dupMessage(entity, legacyHits));
      const codeSpec = PARTY_CODE[entity];
      const takeCode = codeSpec && !str(local[codeSpec.field]) ? await prepareSequence(codeSpec.prefix, companyId) : null;
      const fixedId = id;
      id = await adminDb.runTransaction(async (tx) => {
        // รหัสมาตรฐาน: อ่านตัวนับก่อนการเขียน (ทรานแซกชันลองใหม่ได้เลขใหม่ที่ถูกต้อง)
        const seq = takeCode ? await takeCode(tx) : null;
        const id = fixedId || (seq && codeSpec?.asId ? seq.number : masterCol.doc().id);
        if (seq && codeSpec) local[codeSpec.field] = seq.number;
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        const legacy = LEGACY_ROOT[entity] ? await tx.get(adminDb.doc(`${LEGACY_ROOT[entity]}/${id}`)) : null;
        if (m.exists || l.exists || legacy?.exists) throw new ApiAuthError(409, `รหัส ${id} มีอยู่แล้ว`);
        const hits = await findDuplicates(tx, groupId, entity, master);
        if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
        writeUniqueKeys(tx, groupId, entity, id, null, master);
        tx.create(masterCol.doc(id), { ...master, groupId, createdBy: apiUser.uid, createdByCompany: companyId, createdAt: now, updatedAt: now, isDeleted: false });
        tx.create(localCol.doc(id), { ...local, companyId, groupId, createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false });
        tx.create(masterCol.doc(id).collection("history").doc(), historyEntry(apiUser, companyId, "create", master));
        seq?.commit();
        return id;
      });
      if (opening.qty > 0) {
        const amount = Math.round(opening.qty * opening.unitCost * 100) / 100;
        await processStockMovements([{ companyId, productId: id, type: "IN", quantity: opening.qty, unitCost: opening.unitCost, referenceId: `OPEN-${id}`, userId: apiUser.email || apiUser.uid, ...(openingSerials.length ? { snList: openingSerials } : {}) }], (tx) => {
          if (amount <= 0 || !postOpeningJournal) return;
          tx.set(adminDb.collection(`companies/${companyId}/journal_entries`).doc(), {
            companyId, date: now, bookType: "JV", status: "draft",
            description: `[AUTO] ยอดยกมาสินค้า ${master.sku || id} ${opening.qty} หน่วย`,
            reference: `OPEN-${id}`, totalDebit: amount, totalCredit: amount, isOfficialTax: false,
            items: [
              { accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: amount, credit: 0 },
              { accountCode: "3211-00", accountName: "กำไร (ขาดทุน) สะสม", debit: 0, credit: amount },
            ],
            createdBy: apiUser.uid, createdAt: now, updatedAt: now,
          });
        });
      }
      await auditServer.logCreate(apiUser.uid, companyId, `MASTER_${entity.toUpperCase()}`, id, { name: master.name ?? data.name, ...(entity === "products" ? { sku: master.sku } : {}), openingStock: opening.qty || undefined });
      return NextResponse.json({ success: true, id, groupId, openingStock: opening.qty, ...(entity === "products" ? { sku: master.sku } : {}), ...(codeSpec ? { code: local[codeSpec.field] } : {}) });
    }

    const id = str(body.id, 120);
    if (!ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");

    if (action === "adopt") {
      const local = splitChanges(entity, clean(body.data || {}), "company").local;
      protectLocal(entity, local);
      await adminDb.runTransaction(async (tx) => {
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        if (!m.exists || m.data()!.isDeleted === true) throw new ApiAuthError(404, `ไม่พบ${schema.label}กลางรหัส ${id}`);
        if (l.exists && l.data()!.isDeleted !== true) throw new ApiAuthError(409, `บริษัทนี้ใช้${schema.label}รหัส ${id} อยู่แล้ว`);
        tx.set(localCol.doc(id), { ...local, companyId, groupId, isDeleted: false, createdBy: apiUser.uid, createdAt: now, updatedAt: now });
      });
      return NextResponse.json({ success: true, id });
    }

    if (action === "update") {
      const scope: EditScope = body.scope === "group" ? "group" : "company";
      const { master, local } = splitChanges(entity, normalizeParty(entity, clean(body.changes || {})), scope);
      const ignored = protectLocal(entity, local);
      // ส่งมาเฉพาะฟิลด์ที่ระบบคำนวณเอง (สต็อก ต้นทุน) = ไม่มีอะไรให้บันทึก แจ้งชัดเจนแทนการตอบสำเร็จเงียบ ๆ
      if (ignored.length && !Object.keys(master).length && !Object.keys(local).length) {
        throw new ApiAuthError(400, `แก้ ${ignored.join(", ")} ผ่านหน้านี้ไม่ได้ (สต็อกและต้นทุนเปลี่ยนผ่านการรับ/เบิก/ปรับปรุงสต็อกเท่านั้น)`);
      }
      const legacy = await legacyDoc(entity, id, companyId);
      if (legacy && !(await masterCol.doc(id).get()).exists) {
        // ยังไม่ย้ายเข้าข้อมูลกลาง: เครือมีบริษัทเดียวเท่านั้นที่มีรายการแบบนี้ -> แก้ที่เอกสารเดิมทั้งหมด
        const all = { ...master, ...local };
        const hits = [...(await findDuplicates(null, groupId, entity, { ...legacy.data(), ...all }, id)), ...(await legacyDuplicates(entity, companyId, all, id))];
        if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
        await legacy.ref.set({ ...all, updatedAt: now, updatedBy: apiUser.uid }, { merge: true });
        return NextResponse.json({ success: true, id, legacy: true, updated: Object.keys(all), ignored });
      }
      // ตัวตนทางภาษี (เลข สาขา หน่วยงาน ชื่อบนใบกำกับ) ของคู่ค้าที่มีเอกสารภาษีแล้ว แก้ได้เฉพาะฝ่ายบัญชี
      // (เอกสารเก่าเก็บข้อมูล ณ วันที่ออกไว้แล้ว ไม่เปลี่ยนตาม) — กันภาษีขาย/ซื้อและ 50 ทวิ เพี้ยนจากการแก้โดยไม่ตั้งใจ
      if (entity !== "products" && TAX_IDENTITY.some((k) => k in master) && !can(apiUser.roles, "finance:edit")) {
        const current = (await masterCol.doc(id).get()).data() || {};
        const changed = TAX_IDENTITY.filter((k) => k in master && String(master[k] ?? "").trim() !== String(current[k] ?? "").trim());
        if (changed.length && (await hasTaxDocuments(entity, groupId, companyId, id))) {
          throw new ApiAuthError(403, `${schema.label}นี้มีเอกสารภาษีแล้ว — เลขผู้เสียภาษี สาขา หน่วยงาน และชื่อบนใบกำกับภาษี แก้ได้เฉพาะฝ่ายบัญชี`);
        }
      }
      if (Object.keys(master).length && !(await canEditMaster(apiUser, companyId, entity, groupId))) {
        throw new ApiAuthError(403, `ข้อมูลกลางของ${schema.label} (${Object.keys(master).join(", ")}) แก้ได้เฉพาะผู้ดูแลเครือ — ตั้งชื่อ/รายละเอียดเฉพาะบริษัทแทนได้`);
      }
      await adminDb.runTransaction(async (tx) => {
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        if (!m.exists && !l.exists) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
        if (Object.keys(master).length) {
          if (!m.exists) throw new ApiAuthError(409, `${schema.label}นี้ยังไม่ได้ย้ายเข้าข้อมูลกลาง`);
          const after = { ...m.data(), ...master };
          const hits = await findDuplicates(tx, groupId, entity, after, id);
          if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
          writeUniqueKeys(tx, groupId, entity, id, m.data()!, after);
          tx.update(masterCol.doc(id), { ...master, updatedAt: now, updatedBy: apiUser.uid });
          tx.create(masterCol.doc(id).collection("history").doc(), historyEntry(apiUser, companyId, "update", master));
        }
        if (Object.keys(local).length) {
          const localData = { ...local, companyId, groupId, updatedAt: now, updatedBy: apiUser.uid };
          // docProfile แทนที่ทั้งก้อน (merge ปกติจะเก็บค่าย่อยที่ผู้ใช้ลบออกไว้)
          tx.set(localCol.doc(id), localData, "docProfile" in local ? { mergeFields: Object.keys(localData) } : { merge: true });
        }
      });
      return NextResponse.json({ success: true, id, updatedMaster: Object.keys(master), updatedLocal: Object.keys(local), ignored });
    }

    if (action === "resetLocal") {
      const fields = (Array.isArray(body.fields) ? body.fields : []).map((f: any) => str(f, 60)).filter((f: string) => schema.shared.includes(f));
      if (!fields.length) throw new ApiAuthError(400, "ไม่มีฟิลด์ที่ล้างได้");
      const ref = localCol.doc(id);
      if (!(await ref.get()).exists) throw new ApiAuthError(404, `ไม่พบ${schema.label}ของบริษัท`);
      await ref.update({ ...Object.fromEntries(fields.map((f: string) => [f, admin.firestore.FieldValue.delete()])), updatedAt: now, updatedBy: apiUser.uid });
      return NextResponse.json({ success: true, id, reset: fields });
    }

    if (action === "remove") {
      const perm = entity === "products" ? "inventory:delete" : entity === "customers" ? "sales:delete" : "procurement:edit";
      const [m, l, legacy] = await Promise.all([masterCol.doc(id).get(), localCol.doc(id).get(), legacyDoc(entity, id, companyId)]);
      const target = m.exists ? (l.exists ? l.ref : null) : legacy?.ref || null;
      // รายการที่นำเข้าจาก Excel: ผู้มีสิทธิ์นำเข้าข้อมูลชนิดนั้นลบได้ (แก้การนำเข้าผิด) — ยังต้องไม่ถูกใช้ในเอกสาร
      const importedRecord = [m.data(), l.data(), legacy?.data()].some((d) => d?.importedFrom === "excel");
      if (!can(apiUser.roles, perm as any) && !(importedRecord && can(apiUser.roles, schema.editPermission))) throw new ApiAuthError(403, `ไม่มีสิทธิ์ลบ${schema.label}`);
      if (!target) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
      let opening: Awaited<ReturnType<typeof openingReversal>> = null;
      if (entity === "products") {
        const st = (m.exists ? l.data() : legacy?.data())?.stockStatus || {};
        // สต็อกที่มาจากยอดยกมาอย่างเดียว (นำเข้าผิด) = กลับรายการให้ตอนลบ · มีการเคลื่อนไหวอื่น = ลบไม่ได้
        opening = await openingReversal(companyId, id, Number(st.onHand) || 0, Number(st.reserved) || 0);
      }
      // รายการที่ยังไม่เคยใช้ในเอกสารใด และไม่มีบริษัทอื่นในเครือใช้อยู่ (เช่น นำเข้าผิด) = ลบจริงจากข้อมูลกลางด้วย
      // และคืนคีย์ห้ามซ้ำ (เลขผู้เสียภาษี/รหัสสินค้า) ให้นำเข้าใหม่ได้ · ถูกใช้แล้ว = ลบไม่ได้ ให้ระงับใช้งานแทน
      const used = await usedInDocuments(entity, groupId, companyId, id);
      if (used) throw new ApiAuthError(409, `${schema.label}นี้ถูกใช้ใน${used}แล้ว ลบไม่ได้ — ตั้งสถานะเป็นระงับใช้งานแทน`);
      const otherCompanies = m.exists ? (await adminDb.collection("companies").where("groupId", "==", groupId).get()).docs.map((c) => c.id).filter((c) => c !== companyId) : [];
      const othersUsing = otherCompanies.length > 0 && (await Promise.all(otherCompanies.map((c) => adminDb.doc(`companies/${c}/${entity}/${id}`).get())))
        .some((d) => d.exists && d.get("isDeleted") !== true);
      const stamp = { isDeleted: true, deletedAt: now, deletedBy: apiUser.uid, updatedAt: now };
      await adminDb.runTransaction(async (tx) => {
        tx.set(target, stamp, { merge: true });
        if (opening) {
          const reason = { isDeleted: true, deletedAt: now, deletedBy: apiUser.uid, deleteReason: "ลบสินค้าที่สร้าง/นำเข้าผิด — กลับรายการยอดยกมา" };
          tx.set(target, { stockStatus: { onHand: 0, reserved: 0, available: 0 } }, { merge: true });
          opening.moves.forEach((x) => tx.set(x, reason, { merge: true }));
          opening.serials.forEach((x) => tx.set(x, { ...reason, status: "removed" }, { merge: true }));
          opening.journals.forEach((x) => tx.set(x, { ...reason, status: "cancelled", cancelReason: reason.deleteReason, updatedAt: now }, { merge: true }));
        }
        if (m.exists && !othersUsing) {
          tx.set(masterCol.doc(id), stamp, { merge: true });
          writeUniqueKeys(tx, groupId, entity, id, m.data()!, {});
          tx.create(masterCol.doc(id).collection("history").doc(), historyEntry(apiUser, companyId, "remove", {}));
        }
      });
      await auditServer.logDelete(apiUser.uid, companyId, `MASTER_${entity.toUpperCase()}`, id);
      return NextResponse.json({ success: true, id, released: m.exists && !othersUsing, ...(opening ? { reversedOpeningQty: opening.qty } : {}) });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[MASTER_DATA_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
