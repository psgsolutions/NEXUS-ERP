/**
 * ข้อมูลหลักแบบเครือบริษัท (ใช้ได้ทั้ง client และ server — ไม่แตะฐานข้อมูล)
 *
 * ทุกรายการ (สินค้า ลูกค้า ผู้ขาย ผู้รับเหมา) แบ่งข้อมูลเป็น 3 ชั้น
 *  1. ตัวตน (identity)   ใช้ร่วมทั้งเครือ แก้ได้เฉพาะผู้มีสิทธิ์แก้ข้อมูลกลาง เช่น SKU บาร์โค้ด เลขผู้เสียภาษี
 *  2. ค่าเริ่มต้นร่วม (shared) เก็บที่ข้อมูลกลาง แต่ละบริษัทตั้งค่าของตัวเองทับได้ (เว้นว่าง = ใช้ค่ากลาง) เช่น ชื่อบนเอกสาร สเปก หมวด
 *  3. ข้อมูลเฉพาะบริษัท    ฟิลด์อื่นทั้งหมด เช่น ราคา ต้นทุน สต็อก วงเงินเครดิต เก็บที่บริษัทเสมอ
 *
 * ที่เก็บ: ข้อมูลกลาง groups/{groupId}/{entity}/{id}  ·  ข้อมูลของบริษัท companies/{companyId}/{entity}/{id} (id เดียวกัน)
 * บริษัทที่ไม่มี groupId = เครือของตัวเอง (groupId = companyId)
 */

export type MasterEntity = "products" | "customers" | "suppliers" | "contractors";
export const MASTER_ENTITIES: MasterEntity[] = ["products", "customers", "suppliers", "contractors"];

export interface MasterSchema {
  label: string;
  /** ชั้นที่ 1: ต้องเหมือนกันทั้งเครือ */
  identity: string[];
  /** ชั้นที่ 2: ค่ากลางที่บริษัทตั้งทับได้ */
  shared: string[];
  /** คีย์ที่ห้ามซ้ำในเครือ (ค่าว่างไม่ตรวจ) — แต่ละรายการคือชุดฟิลด์ที่รวมกันเป็นคีย์ */
  unique: string[][];
  /** สิทธิ์ที่ใช้แก้ข้อมูลของบริษัทสำหรับประเภทนี้ */
  editPermission: "inventory:edit" | "sales:edit" | "procurement:edit";
}

const PARTY_IDENTITY = ["taxId", "tax_id", "branchCode", "branch_code", "legalName", "entityType"];
// รวมชื่อฟิลด์แบบเดิมของฟอร์ม (snake_case / ที่อยู่แยกช่อง) เพื่อให้ข้อมูลทั่วไปอยู่ที่ข้อมูลกลาง
const PARTY_SHARED = [
  "name", "customerName", "supplierName", "address", "phone", "phoneNumber", "email", "website", "contactName", "contact_name", "contacts", "addresses", "industry",
  "addressNo", "building", "soi", "road", "subDistrict", "district", "province", "zipCode",
  "bankName", "bankAccount", "bankAccountName", "bank_name", "account_number", "account_name",
];

export const MASTER_SCHEMAS: Record<MasterEntity, MasterSchema> = {
  products: {
    label: "สินค้า",
    identity: ["sku", "barcode", "brand", "model", "partNumber", "unit", "itemType"],
    shared: ["name", "description", "specs", "category", "subCategory", "imageUrl", "images", "warrantyMonths", "unitConversions", "isSerialized"],
    unique: [["sku"], ["barcode"]],
    editPermission: "inventory:edit",
  },
  customers: { label: "ลูกค้า", identity: PARTY_IDENTITY, shared: PARTY_SHARED, unique: [["taxId", "branchCode"]], editPermission: "sales:edit" },
  suppliers: { label: "ผู้ขาย", identity: PARTY_IDENTITY, shared: PARTY_SHARED, unique: [["taxId", "branchCode"]], editPermission: "procurement:edit" },
  contractors: { label: "ผู้รับเหมา", identity: PARTY_IDENTITY, shared: [...PARTY_SHARED, "skills", "idCardNo"], unique: [["taxId", "branchCode"]], editPermission: "procurement:edit" },
};

export const isMasterEntity = (v: any): v is MasterEntity => MASTER_ENTITIES.includes(v);

/** เครือของบริษัท (บริษัทเดี่ยว = เครือของตัวเอง) */
export const groupIdOf = (company: { groupId?: string } | null | undefined, companyId: string) =>
  String(company?.groupId || "").trim() || companyId;

const isEmpty = (v: any) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** รวมข้อมูลกลาง + ข้อมูลบริษัท: ฟิลด์ตัวตนมาจากข้อมูลกลางเสมอ ฟิลด์อื่นของบริษัททับได้ถ้าไม่ว่าง */
export function mergeRecord<T extends Record<string, any>>(entity: MasterEntity, master: Record<string, any> | null | undefined, local: Record<string, any> | null | undefined): T {
  const schema = MASTER_SCHEMAS[entity];
  const out: Record<string, any> = { ...(master || {}) };
  for (const [k, v] of Object.entries(local || {})) {
    if (master && schema.identity.includes(k)) continue;
    if (!isEmpty(v)) out[k] = v;
  }
  // บอกที่มาให้หน้าจอรู้ว่าฟิลด์ไหนเป็นค่าของบริษัท (ใช้แสดง "ใช้ค่ากลาง" / "ค่าของบริษัท")
  out._localFields = Object.keys(local || {}).filter((k) => schema.shared.includes(k) && !isEmpty((local as any)[k]));
  out._hasMaster = !!master;
  return out as T;
}

export type EditScope = "group" | "company";

/**
 * แยกฟิลด์ที่จะบันทึก: identity -> ข้อมูลกลาง, shared -> ข้อมูลกลาง (scope group) หรือของบริษัท (scope company),
 * ฟิลด์อื่น -> ของบริษัทเสมอ
 */
export function splitChanges(entity: MasterEntity, changes: Record<string, any>, scope: EditScope) {
  const schema = MASTER_SCHEMAS[entity];
  const master: Record<string, any> = {};
  const local: Record<string, any> = {};
  for (const [k, v] of Object.entries(changes || {})) {
    if (k.startsWith("_") || k === "id" || k === "companyId" || k === "groupId") continue;
    if (schema.identity.includes(k)) master[k] = v;
    else if (schema.shared.includes(k)) (scope === "group" ? master : local)[k] = v;
    else local[k] = v;
  }
  return { master, local };
}

/** ค่าคีย์ห้ามซ้ำแบบปกติ (ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง) — ค่าว่างคืน "" */
export function uniqueKeyValue(fields: string[], data: Record<string, any>): string {
  const parts = fields.map((f) => String(data?.[f] ?? "").trim().toUpperCase().replace(/\s+/g, ""));
  if (!parts[0]) return "";
  // สาขาว่าง = สำนักงานใหญ่
  return parts.map((p, i) => (p || (fields[i] === "branchCode" ? "00000" : ""))).join("|");
}

/** id เอกสารดัชนีห้ามซ้ำใน groups/{g}/unique_keys */
export const uniqueKeyDocId = (entity: MasterEntity, fields: string[], value: string) =>
  `${entity}__${fields.join("+")}__${value}`.replace(/\//g, "_").slice(0, 1400);
