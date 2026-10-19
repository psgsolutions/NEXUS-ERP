/**
 * แม่แบบนำเข้าข้อมูลจาก Excel (ฟังก์ชันล้วน — ใช้ทั้งหน้าจอและ unit test)
 * แต่ละแถวแปลงเป็นคำขอ /api/master-data { action: "create" } แบบเดียวกับฟอร์มเพิ่มข้อมูลในระบบ
 * จับคอลัมน์ด้วยชื่อหัวตาราง (ไม่สนลำดับ, ตัด * และช่องว่าง) — คอลัมน์ที่ไม่รู้จักถูกข้าม
 */

export type ImportEntity = "customers" | "suppliers" | "products";
type ColType = "text" | "number" | "int" | "taxId" | "branch" | "email" | "choice" | "date";

export interface ImportColumn {
  key: string;
  header: string;
  required?: boolean;
  type: ColType;
  example: string;
  note?: string;
  choices?: Record<string, string>; // ข้อความในไฟล์ -> ค่าที่เก็บ
  leadingZero?: boolean; // เบอร์โทรที่ Excel แปลงเป็นตัวเลขจนเลข 0 หาย
}

export interface ImportTemplate {
  entity: string;
  label: string;
  permission: "sales:edit" | "procurement:edit" | "inventory:edit" | "finance:edit";
  columns: ImportColumn[];
  /** คีย์ที่ต้องไม่ซ้ำภายในไฟล์ (และในระบบ — server ตรวจซ้ำอีกชั้น) */
  uniqueKeys: string[][];
  /** ตรวจเพิ่มเติมทั้งแถว (หลังแปลงค่าแต่ละช่องแล้ว) */
  validate?: (values: Record<string, any>) => string[];
}

const ADDRESS: ImportColumn[] = [
  { key: "address", header: "ที่อยู่ (เลขที่ อาคาร ซอย ถนน)", type: "text", example: "99/1 ถนนพระราม 9" },
  { key: "subDistrict", header: "ตำบล/แขวง", type: "text", example: "ห้วยขวาง" },
  { key: "district", header: "อำเภอ/เขต", type: "text", example: "ห้วยขวาง" },
  { key: "province", header: "จังหวัด", type: "text", example: "กรุงเทพมหานคร" },
  { key: "zipCode", header: "รหัสไปรษณีย์", type: "text", example: "10310" },
];

const PARTY_TAX: ImportColumn[] = [
  { key: "taxId", header: "เลขประจำตัวผู้เสียภาษี", type: "taxId", example: "0105561234567", note: "13 หลัก (ไม่มีขีดก็ได้) — ใช้ตรวจข้อมูลซ้ำ" },
  { key: "branchCode", header: "รหัสสาขา", type: "branch", example: "00000", note: "00000 = สำนักงานใหญ่ / ว่าง = สำนักงานใหญ่" },
];

export const IMPORT_TEMPLATES: Record<ImportEntity, ImportTemplate> = {
  customers: {
    entity: "customers", label: "ลูกค้า", permission: "sales:edit",
    uniqueKeys: [["taxId", "branchCode"]],
    columns: [
      { key: "name", header: "ชื่อลูกค้า", required: true, type: "text", example: "บริษัท ตัวอย่าง จำกัด" },
      ...PARTY_TAX, ...ADDRESS,
      { key: "phone", header: "โทรศัพท์", type: "text", example: "02-123-4567", leadingZero: true },
      { key: "email", header: "อีเมล", type: "email", example: "account@example.com" },
      { key: "contactPerson", header: "ผู้ติดต่อ", type: "text", example: "คุณสมชาย" },
      { key: "creditLimit", header: "วงเงินเครดิต (บาท)", type: "number", example: "100000", note: "0 หรือว่าง = ไม่จำกัด" },
      { key: "creditTermDays", header: "เครดิต (วัน)", type: "int", example: "30" },
    ],
  },
  suppliers: {
    entity: "suppliers", label: "ผู้ขาย", permission: "procurement:edit",
    uniqueKeys: [["taxId", "branchCode"]],
    columns: [
      { key: "name", header: "ชื่อผู้ขาย", required: true, type: "text", example: "บริษัท ซัพพลาย จำกัด" },
      { key: "category", header: "ประเภท", type: "choice", example: "บริษัท", note: "บริษัท / ห้าง-ร้าน / ทีมช่าง", choices: { "บริษัท": "COMPANY", "ห้าง-ร้าน": "STORE", "ห้าง/ร้าน": "STORE", "ร้าน": "STORE", "ทีมช่าง": "TEAM", "บุคคล": "TEAM" } },
      ...PARTY_TAX, ...ADDRESS,
      { key: "phone", header: "โทรศัพท์", type: "text", example: "02-987-6543", leadingZero: true },
      { key: "email", header: "อีเมล", type: "email", example: "sales@supply.co.th" },
      { key: "contactPerson", header: "ผู้ติดต่อ", type: "text", example: "คุณวิภา" },
      { key: "creditTermDays", header: "เครดิต (วัน)", type: "int", example: "30" },
      { key: "bankName", header: "ธนาคาร", type: "text", example: "กสิกรไทย" },
      { key: "bankAccount", header: "เลขที่บัญชี", type: "text", example: "123-4-56789-0" },
      { key: "bankAccountName", header: "ชื่อบัญชี", type: "text", example: "บริษัท ซัพพลาย จำกัด" },
    ],
  },
  products: {
    entity: "products", label: "สินค้า/บริการ", permission: "inventory:edit",
    uniqueKeys: [["sku"], ["barcode"]],
    columns: [
      { key: "sku", header: "รหัสสินค้า (SKU)", required: true, type: "text", example: "CAM-4MP-01", note: "ห้ามซ้ำ" },
      { key: "name", header: "ชื่อสินค้า", required: true, type: "text", example: "กล้อง IP 4MP" },
      { key: "itemType", header: "ประเภท", type: "choice", example: "สินค้า", note: "สินค้า / บริการ (บริการไม่มีสต็อก)", choices: { "สินค้า": "PRODUCT", "บริการ": "SERVICE", "ค่าแรง": "SERVICE" } },
      { key: "unit", header: "หน่วย", required: true, type: "text", example: "ตัว" },
      { key: "barcode", header: "บาร์โค้ด", type: "text", example: "8850000000017", note: "ห้ามซ้ำ (ว่างได้)" },
      { key: "category", header: "หมวดหมู่", type: "text", example: "CCTV" },
      { key: "brand", header: "ยี่ห้อ", type: "text", example: "Hikvision" },
      { key: "model", header: "รุ่น", type: "text", example: "DS-2CD1043" },
      { key: "price", header: "ราคาขาย (ก่อน VAT)", type: "number", example: "2500" },
      { key: "cost", header: "ต้นทุนต่อหน่วย", type: "number", example: "1800", note: "ใช้เป็นต้นทุนของยอดยกมา" },
      { key: "reorderPoint", header: "จุดสั่งซื้อ", type: "int", example: "5" },
      { key: "openingQty", header: "จำนวนคงเหลือยกมา", type: "int", example: "20", note: "รับเข้าคลังเป็นยอดยกมา (สินค้าเท่านั้น)" },
    ],
  },
};

export const normHeader = (h: any) => String(h ?? "").replace(/\*/g, "").replace(/\s+/g, "").trim().toLowerCase();

/** ตัวเลขจาก Excel: 1,234.50 / "1 234" / ตัวเลขไทย */
export function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))).replace(/[,\s฿บาท]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export interface ParsedRow {
  rowNo: number; // แถวใน Excel (หัวตาราง = แถว 1)
  values: Record<string, any>;
  errors: string[];
}

/** จับคู่หัวตาราง -> คอลัมน์ของแม่แบบ */
export function mapHeaders(template: ImportTemplate, headers: any[]): { index: Record<string, number>; missing: string[]; unknown: string[] } {
  const byNorm = new Map(template.columns.map((c) => [normHeader(c.header), c.key]));
  const index: Record<string, number> = {};
  const unknown: string[] = [];
  headers.forEach((h, i) => {
    const key = byNorm.get(normHeader(h));
    if (key && index[key] === undefined) index[key] = i;
    else if (String(h ?? "").trim()) unknown.push(String(h));
  });
  const missing = template.columns.filter((c) => c.required && index[c.key] === undefined).map((c) => c.header);
  return { index, missing, unknown };
}

/** วันที่จาก Excel: เลขลำดับวันของ Excel / 2026-09-30 / 30/09/2026 / 30/09/2569 (พ.ศ.) -> YYYY-MM-DD */
export function parseDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  let y: number, m: number, d: number;
  if (typeof v === "number") {
    if (!(v > 1 && v < 2958466)) return null;
    const dt = new Date(Math.round((v - 25569) * 86400e3));
    return dt.toISOString().slice(0, 10);
  }
  const s = String(v).trim().replace(/[๐-๙]/g, (x) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(x)));
  let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else return null;
  if (y > 2400) y -= 543;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1990 || y > 2100) return null;
  return dt.toISOString().slice(0, 10);
}

/** ตรวจและแปลงค่าแต่ละแถว (แถวว่างทั้งแถวถูกข้าม) */
export function parseRows(template: ImportTemplate, rows: any[][], index: Record<string, number>): ParsedRow[] {
  const out: ParsedRow[] = [];
  const seen = template.uniqueKeys.map(() => new Map<string, number>());
  rows.forEach((raw, i) => {
    if (!raw || raw.every((v) => v === null || v === undefined || String(v).trim() === "")) return;
    const rowNo = i + 2;
    const values: Record<string, any> = {};
    const errors: string[] = [];
    for (const c of template.columns) {
      const at = index[c.key];
      const rawVal = at === undefined ? undefined : raw[at];
      const text = rawVal === undefined || rawVal === null ? "" : String(rawVal).trim();
      if (!text) {
        if (c.required) errors.push(`ไม่มี${c.header}`);
        continue;
      }
      switch (c.type) {
        case "number": case "int": {
          const n = parseNumber(rawVal);
          if (n === null) break;
          if (Number.isNaN(n) || n < 0) { errors.push(`${c.header} ต้องเป็นตัวเลขไม่ติดลบ ("${text}")`); break; }
          if (c.type === "int" && !Number.isInteger(n)) { errors.push(`${c.header} ต้องเป็นจำนวนเต็ม ("${text}")`); break; }
          values[c.key] = n;
          break;
        }
        case "taxId": {
          // Excel เก็บเลขเป็นตัวเลข เลข 0 นำหน้าหาย (0105... -> 105...)
          const d = typeof rawVal === "number" ? String(rawVal).padStart(13, "0") : text.replace(/\D/g, "");
          if (d.length !== 13) errors.push(`${c.header} ต้องมี 13 หลัก ("${text}")`); else values[c.key] = d;
          break;
        }
        case "branch": {
          const d = text.replace(/\D/g, "");
          if (!d || d.length > 5 || /สำนักงานใหญ่/.test(text)) values[c.key] = "00000"; else values[c.key] = d.padStart(5, "0");
          break;
        }
        case "date": {
          const d = parseDate(rawVal);
          if (!d) errors.push(`${c.header} ไม่ใช่วันที่ (ใช้ 30/09/2026 หรือ 30/09/2569) ("${text}")`); else values[c.key] = d;
          break;
        }
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors.push(`${c.header} ไม่ถูกต้อง ("${text}")`); else values[c.key] = text.toLowerCase();
          break;
        case "choice": {
          const v = c.choices?.[text] ?? Object.entries(c.choices || {}).find(([k]) => normHeader(k) === normHeader(text))?.[1];
          if (!v) errors.push(`${c.header} ต้องเป็น ${Object.keys(c.choices || {}).join(" / ")} ("${text}")`); else values[c.key] = v;
          break;
        }
        default:
          values[c.key] = (c.leadingZero && typeof rawVal === "number" ? "0" + text : text).slice(0, 500);
      }
    }
    if ((template.entity === "customers" || template.entity === "suppliers") && values.taxId && !values.branchCode) values.branchCode = "00000";
    if (template.entity === "products" && values.itemType === "SERVICE" && values.openingQty) errors.push("บริการไม่มีจำนวนคงเหลือยกมา");
    if (template.validate && !errors.length) errors.push(...template.validate(values));
    // ซ้ำภายในไฟล์
    template.uniqueKeys.forEach((keys, k) => {
      if (!keys.every((key) => values[key])) return;
      const v = keys.map((key) => String(values[key]).trim().toLowerCase()).join("|");
      const first = seen[k].get(v);
      if (first) errors.push(`${keys.map((key) => template.columns.find((c) => c.key === key)?.header).join("+")} ซ้ำกับแถว ${first}`);
      else seen[k].set(v, rowNo);
    });
    out.push({ rowNo, values, errors });
  });
  return out;
}

const partyAddress = (v: Record<string, any>) => ({
  addressNo: v.address || "", address_detail: v.address || "",
  subDistrict: v.subDistrict || "", district: v.district || "", province: v.province || "", zipCode: v.zipCode || "",
  address: [v.address, v.subDistrict, v.district, v.province, v.zipCode].filter(Boolean).join(" "),
});

/** คำขอสร้างข้อมูล (รูปแบบเดียวกับฟอร์มในระบบ) */
export interface CreateRequest { data: Record<string, any>; openingStock?: { qty: number; unitCost: number; postJournal: boolean } }

export function toCreateRequest(entity: ImportEntity, v: Record<string, any>, opts: { postOpeningJournal?: boolean } = {}): CreateRequest {
  if (entity === "customers") {
    return { data: {
      name: v.name, customerName: v.name, taxId: v.taxId || "", branchCode: v.branchCode || "00000", ...partyAddress(v),
      phone: v.phone || "", phoneNumber: v.phone || "", email: v.email || "", contactPerson: v.contactPerson || "", contactName: v.contactPerson || "",
      creditLimit: v.creditLimit || 0, creditTermDays: v.creditTermDays ?? 30, status: "ACTIVE", importedFrom: "excel",
    } };
  }
  if (entity === "suppliers") {
    const cat = v.category || "COMPANY";
    return { data: {
      name: v.name, supplierName: v.name, entity_category: cat, contractor_type: cat,
      category: cat === "TEAM" ? "ทีมช่าง" : cat === "STORE" ? "ห้าง/ร้าน" : "บริษัท",
      taxId: v.taxId || "", tax_id: v.taxId || "", branchCode: v.branchCode || "00000", ...partyAddress(v),
      phone: v.phone || "", email: v.email || "", contact_person: v.contactPerson || "", contactName: v.contactPerson || "",
      payment_term: `${v.creditTermDays ?? 30} Days`, creditTermDays: v.creditTermDays ?? 30,
      bankName: v.bankName || "", bank_name: v.bankName || "", bankAccount: v.bankAccount || "", account_number: v.bankAccount || "",
      bankAccountName: v.bankAccountName || "", account_name: v.bankAccountName || "",
      status: "active", isActive: true, importedFrom: "excel",
    } };
  }
  const service = v.itemType === "SERVICE";
  const price = v.price ?? 0, cost = v.cost ?? 0;
  return {
    data: {
      sku: v.sku, productCode: v.sku, barcode: v.barcode || "", barcodes: v.barcode ? [v.barcode] : [],
      name: v.name, productName: v.name, itemType: service ? "SERVICE" : "PRODUCT", productType: service ? "SERVICE" : "PHYSICAL",
      category: v.category || "general", brand: v.brand || "", model: v.model || "",
      unit: v.unit, baseUnit: v.unit, packageUnit: v.unit, purchaseUnit: v.unit, conversionRate: 1,
      taxType: "VAT_7", vatType: "VAT_7", lifecycleStatus: "ACTIVE",
      pricing: { pricePOS: price, priceProject: price, priceWholesale: price },
      unitPrice: price, costPrice: cost,
      inventoryControl: { reorderPoint: v.reorderPoint || 0, minStock: v.reorderPoint || 0, maxStock: 0, orderUnit: v.unit },
      importedFrom: "excel",
    },
    ...(!service && v.openingQty ? { openingStock: { qty: v.openingQty, unitCost: cost, postJournal: opts.postOpeningJournal !== false } } : {}),
  };
}
