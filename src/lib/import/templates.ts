/**
 * แม่แบบนำเข้าข้อมูลจาก Excel (ฟังก์ชันล้วน — ใช้ทั้งหน้าจอและ unit test)
 * แต่ละแถวแปลงเป็นคำขอแบบเดียวกับฟอร์มเพิ่มข้อมูลในระบบ (ลูกค้า/ผู้ขาย/สินค้า: /api/master-data · พนักงาน: /api/hr/employees)
 * จับคอลัมน์ด้วยชื่อหัวตาราง (ไม่สนลำดับ, ตัด * และช่องว่าง) — คอลัมน์ที่ไม่รู้จักถูกข้าม
 * คอลัมน์ "รหัสในระบบ": ว่าง = เพิ่มใหม่ · มีค่า (จากไฟล์ส่งออก) = แก้รายการเดิม — ส่งออก แก้ใน Excel แล้วนำเข้ากลับได้
 * คอลัมน์ครบตามฟอร์มของแต่ละโมดูล (toTemplateRow แปลงข้อมูลในระบบกลับเป็นแถว Excel ด้วยหัวตารางเดียวกัน)
 */

export type ImportEntity = "customers" | "suppliers" | "products" | "employees";
type ColType = "text" | "number" | "int" | "taxId" | "branch" | "email" | "choice" | "date" | "bool";

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
  permission: "sales:edit" | "procurement:edit" | "inventory:edit" | "finance:edit" | "hr:edit";
  columns: ImportColumn[];
  /** คีย์ที่ต้องไม่ซ้ำภายในไฟล์ (และในระบบ — server ตรวจซ้ำอีกชั้น) */
  uniqueKeys: string[][];
  /** ตรวจเพิ่มเติมทั้งแถว (หลังแปลงค่าแต่ละช่องแล้ว) */
  validate?: (values: Record<string, any>) => string[];
}

/** รหัสในระบบ: ว่าง = เพิ่มใหม่ · มีค่า = แก้รายการเดิม */
const SYSTEM_ID: ImportColumn = { key: "_id", header: "รหัสในระบบ", type: "text", example: "", note: "ว่าง = เพิ่มใหม่ · มีค่า (จากไฟล์ส่งออก) = แก้รายการเดิม — ห้ามแก้รหัสนี้" };
const YES_NO = { "ใช่": true, "มี": true, "yes": true, "y": true, "ไม่ใช่": false, "ไม่มี": false, "no": false, "n": false } as Record<string, any>;

const ADDRESS: ImportColumn[] = [
  { key: "address", header: "ที่อยู่ (เลขที่ อาคาร ซอย ถนน)", type: "text", example: "99/1 ถนนพระราม 9" },
  { key: "building", header: "อาคาร/หมู่บ้าน", type: "text", example: "อาคารเอ ชั้น 5", note: "ไม่บังคับ (กรอกรวมในช่องที่อยู่ก็ได้)" },
  { key: "soi", header: "ซอย", type: "text", example: "" },
  { key: "road", header: "ถนน", type: "text", example: "" },
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
      SYSTEM_ID,
      { key: "name", header: "ชื่อลูกค้า", required: true, type: "text", example: "บริษัท ตัวอย่าง จำกัด" },
      { key: "orgType", header: "ประเภทลูกค้า", type: "choice", example: "เอกชน", note: "เอกชน / ส่วนราชการ / รัฐวิสาหกิจ / บุคคลธรรมดา — ใช้ตั้งรูปแบบเอกสารที่ลูกค้าต้องการ", choices: { "เอกชน": "PRIVATE", "ส่วนราชการ": "GOV", "ราชการ": "GOV", "หน่วยงานรัฐ": "GOV", "รัฐวิสาหกิจ": "STATE", "บุคคลธรรมดา": "PERSON", "บุคคล": "PERSON" } },
      ...PARTY_TAX,
      { key: "branchName", header: "ชื่อสาขา", type: "text", example: "", note: "ว่าง = สำนักงานใหญ่" },
      ...ADDRESS,
      { key: "phone", header: "โทรศัพท์", type: "text", example: "02-123-4567", leadingZero: true },
      { key: "email", header: "อีเมล", type: "email", example: "account@example.com" },
      { key: "contactPerson", header: "ผู้ติดต่อ", type: "text", example: "คุณสมชาย" },
      { key: "creditLimit", header: "วงเงินเครดิต (บาท)", type: "number", example: "100000", note: "0 หรือว่าง = ไม่จำกัด" },
      { key: "creditTermDays", header: "เครดิต (วัน)", type: "int", example: "30" },
      { key: "note", header: "หมายเหตุ", type: "text", example: "" },
    ],
  },
  suppliers: {
    entity: "suppliers", label: "ผู้ขาย", permission: "procurement:edit",
    uniqueKeys: [["taxId", "branchCode"]],
    columns: [
      SYSTEM_ID,
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
      { key: "paymentMethod", header: "วิธีจ่ายเงิน", type: "choice", example: "โอน", note: "โอน / เช็ค / เงินสด", choices: { "โอน": "TRANSFER", "โอนเงิน": "TRANSFER", "เช็ค": "CHEQUE", "เงินสด": "CASH" } },
      { key: "businessType", header: "ประเภทธุรกิจ", type: "choice", example: "บริการ", note: "บริการ / สินค้า / สินค้าและบริการ", choices: { "บริการ": "SERVICE", "สินค้า": "GOODS", "สินค้าและบริการ": "BOTH", "ทั้งสองอย่าง": "BOTH" } },
      { key: "chequePickupDay", header: "วันรับเช็ค", type: "text", example: "", note: "เช่น ทุกวันศุกร์ (กรณีจ่ายด้วยเช็ค)" },
      { key: "note", header: "หมายเหตุ", type: "text", example: "" },
    ],
  },
  products: {
    entity: "products", label: "สินค้า/บริการ", permission: "inventory:edit",
    uniqueKeys: [["sku"], ["barcode"]],
    columns: [
      SYSTEM_ID,
      { key: "sku", header: "รหัสสินค้า (SKU)", type: "text", example: "", note: "ว่าง = ระบบออกรหัสให้ตอนนำเข้า (PRD-ปปดด-001) · ใส่เองได้ถ้ามีรหัสเดิม (ห้ามซ้ำ) · แก้รายการเดิมแล้วเว้นว่าง = คงรหัสเดิม" },
      { key: "name", header: "ชื่อสินค้า", required: true, type: "text", example: "กล้อง IP 4MP" },
      { key: "itemType", header: "ประเภท", type: "choice", example: "สินค้า", note: "สินค้า / บริการ (บริการไม่มีสต็อก)", choices: { "สินค้า": "PRODUCT", "บริการ": "SERVICE", "ค่าแรง": "SERVICE" } },
      { key: "unit", header: "หน่วย", required: true, type: "text", example: "ตัว" },
      { key: "barcode", header: "บาร์โค้ด", type: "text", example: "8850000000017", note: "ห้ามซ้ำ (ว่างได้)" },
      { key: "category", header: "หมวดหมู่", type: "text", example: "CCTV" },
      { key: "subCategory", header: "หมวดย่อย", type: "text", example: "กล้อง IP" },
      { key: "brand", header: "ยี่ห้อ", type: "text", example: "Hikvision" },
      { key: "model", header: "รุ่น", type: "text", example: "DS-2CD1043" },
      { key: "description", header: "รายละเอียด/สเปก", type: "text", example: "4MP, IR 30m, PoE", note: "แสดงใต้ชื่อในใบเสนอราคา" },
      { key: "taxType", header: "ภาษีขาย", type: "choice", example: "VAT 7%", note: "VAT 7% / ภาษี 0% / ยกเว้นภาษี", choices: { "VAT 7%": "VAT_7", "VAT7%": "VAT_7", "7%": "VAT_7", "ภาษี 0%": "NON_VAT", "0%": "NON_VAT", "ยกเว้นภาษี": "EXEMPT", "ยกเว้น": "EXEMPT" } },
      { key: "packageUnit", header: "หน่วยซื้อ/แพ็ค", type: "text", example: "กล่อง", note: "ว่าง = เท่ากับหน่วย" },
      { key: "conversionRate", header: "จำนวนต่อแพ็ค", type: "number", example: "10", note: "1 หน่วยซื้อ = กี่หน่วยขาย (ว่าง = 1)" },
      { key: "price", header: "ราคาขาย (ก่อน VAT)", type: "number", example: "2500" },
      { key: "priceProject", header: "ราคาโครงการ", type: "number", example: "2800", note: "ว่าง = ราคาขาย" },
      { key: "priceWholesale", header: "ราคาส่ง", type: "number", example: "2300", note: "ว่าง = ราคาขาย" },
      { key: "minimumFloorPrice", header: "ราคาขายต่ำสุด", type: "number", example: "2000", note: "ขายต่ำกว่านี้ต้องขออนุมัติ" },
      { key: "cost", header: "ต้นทุนต่อหน่วย", type: "number", example: "1800", note: "ใช้เป็นต้นทุนของยอดยกมา" },
      { key: "reorderPoint", header: "จุดสั่งซื้อ", type: "int", example: "5" },
      { key: "minStock", header: "สต็อกต่ำสุด", type: "int", example: "5", note: "ว่าง = จุดสั่งซื้อ" },
      { key: "maxStock", header: "สต็อกสูงสุด", type: "int", example: "50" },
      { key: "warehouseId", header: "รหัสคลัง", type: "text", example: "WH-01", note: "ว่าง = WH-01" },
      { key: "rackLocation", header: "ตำแหน่งชั้นวาง", type: "text", example: "A-01-02" },
      { key: "isSerialized", header: "ติดตามซีเรียล", type: "bool", example: "ไม่ใช่", note: "ใช่ / ไม่ใช่" },
      { key: "warrantyMonths", header: "รับประกัน (เดือน)", type: "int", example: "24" },
      { key: "weightKg", header: "น้ำหนัก (กก.)", type: "number", example: "0.5" },
      { key: "supplierSku", header: "รหัสสินค้าของผู้ขาย", type: "text", example: "HK-1043" },
      { key: "leadTimeDays", header: "ระยะเวลาสั่งซื้อ (วัน)", type: "int", example: "7" },
      { key: "lifecycleStatus", header: "สถานะสินค้า", type: "choice", example: "ใช้งาน", note: "ใช้งาน / ร่าง / ทยอยยกเลิก", choices: { "ใช้งาน": "ACTIVE", "ใช้งานปกติ": "ACTIVE", "ร่าง": "DRAFT", "ทยอยยกเลิก": "PHASE_OUT", "เลิกขาย": "PHASE_OUT" } },
      { key: "openingQty", header: "จำนวนคงเหลือยกมา", type: "int", example: "20", note: "รับเข้าคลังเป็นยอดยกมา (สินค้าเท่านั้น · ใช้เฉพาะตอนเพิ่มใหม่)" },
    ],
  },
  employees: {
    entity: "employees", label: "พนักงาน", permission: "hr:edit",
    uniqueKeys: [["citizenId"]],
    columns: [
      SYSTEM_ID,
      { key: "prefix", header: "คำนำหน้า", type: "choice", example: "นาย", note: "นาย / นาง / นางสาว", choices: { "นาย": "Mr.", "นาง": "Mrs.", "นางสาว": "Ms.", "น.ส.": "Ms." } },
      { key: "firstName", header: "ชื่อ", required: true, type: "text", example: "สมชาย" },
      { key: "lastName", header: "นามสกุล", required: true, type: "text", example: "ใจดี" },
      { key: "nickname", header: "ชื่อเล่น", type: "text", example: "ชาย" },
      { key: "citizenId", header: "เลขบัตรประชาชน", type: "taxId", example: "1103700012345", note: "13 หลัก — ใช้ตรวจข้อมูลซ้ำ" },
      { key: "position", header: "ตำแหน่ง", required: true, type: "text", example: "ช่างติดตั้ง" },
      { key: "department", header: "แผนก", type: "text", example: "ติดตั้ง/ช่าง" },
      { key: "employmentType", header: "ประเภทการจ้าง", type: "choice", example: "พนักงานประจำ", note: "พนักงานประจำ / สัญญาจ้าง / รายวัน / พาร์ตไทม์", choices: { "พนักงานประจำ": "permanent", "ประจำ": "permanent", "สัญญาจ้าง": "contract", "รายวัน": "daily", "พาร์ตไทม์": "parttime" } },
      { key: "joinDate", header: "วันที่เริ่มงาน", type: "date", example: "01/06/2568" },
      { key: "status", header: "สถานะ", type: "choice", example: "ปฏิบัติงาน", note: "ปฏิบัติงาน / ทดลองงาน / ลาออก", choices: { "ปฏิบัติงาน": "active", "ทดลองงาน": "probation", "ลาออก": "resigned" } },
      { key: "phone", header: "โทรศัพท์", type: "text", example: "081-234-5678", leadingZero: true },
      { key: "email", header: "อีเมล", type: "email", example: "somchai@example.com" },
      { key: "workLocation", header: "สถานที่ทำงาน", type: "text", example: "สำนักงานใหญ่" },
      { key: "salary", header: "เงินเดือน/ค่าแรง", type: "number", example: "18000", note: "รายวัน = ค่าแรงต่อวัน" },
      { key: "socialSecurity", header: "ประกันสังคม", type: "bool", example: "ใช่", note: "ใช่ / ไม่ใช่ (ว่าง = ใช่)" },
      { key: "bankName", header: "ธนาคาร", type: "text", example: "กสิกรไทย" },
      { key: "bankAccount", header: "เลขที่บัญชี", type: "text", example: "123-4-56789-0" },
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
        case "bool": {
          const v = YES_NO[text.toLowerCase()] ?? YES_NO[text];
          if (v === undefined) errors.push(`${c.header} ต้องเป็น ใช่ / ไม่ใช่ ("${text}")`); else values[c.key] = v;
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
  addressNo: v.address || "", address_detail: v.address || "", building: v.building || "", soi: v.soi || "", road: v.road || "",
  subDistrict: v.subDistrict || "", district: v.district || "", province: v.province || "", zipCode: v.zipCode || "",
  address: [v.address, v.building, v.soi && `ซ.${v.soi}`, v.road && `ถ.${v.road}`, v.subDistrict, v.district, v.province, v.zipCode].filter(Boolean).join(" "),
});

/** คำขอสร้างข้อมูล (รูปแบบเดียวกับฟอร์มในระบบ) */
export interface CreateRequest { data: Record<string, any>; openingStock?: { qty: number; unitCost: number; postJournal: boolean } }

export function toCreateRequest(entity: ImportEntity, v: Record<string, any>, opts: { postOpeningJournal?: boolean } = {}): CreateRequest {
  if (entity === "employees") {
    return { data: {
      prefix: v.prefix || "Mr.", firstName: v.firstName, lastName: v.lastName, nickname: v.nickname || "", citizenId: v.citizenId || "",
      position: v.position, department: v.department || "", employmentType: v.employmentType || "permanent", joinDate: v.joinDate || "",
      status: v.status || "active", phone: v.phone || "", email: v.email || "", workLocation: v.workLocation || "",
      salary: v.salary || 0, socialSecurity: v.socialSecurity !== false, bankName: v.bankName || "", bankAccount: v.bankAccount || "",
    } };
  }
  if (entity === "customers") {
    return { data: {
      name: v.name, customerName: v.name, taxId: v.taxId || "", branchCode: v.branchCode || "00000", ...partyAddress(v),
      phone: v.phone || "", phoneNumber: v.phone || "", email: v.email || "", contactPerson: v.contactPerson || "", contactName: v.contactPerson || "",
      creditLimit: v.creditLimit || 0, creditTermDays: v.creditTermDays ?? 30, status: "ACTIVE", importedFrom: "excel",
      branchName: v.branchName || "", note: v.note || "",
      ...(v.orgType ? { orgType: v.orgType, grade: v.orgType === "GOV" ? "Government" : "Private" } : {}),
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
      payment_method: v.paymentMethod || "TRANSFER", paymentMethod: v.paymentMethod || "TRANSFER", business_type: v.businessType || "SERVICE",
      cheque_pickup_day: v.chequePickupDay || "", note: v.note || "",
      status: "active", isActive: true, importedFrom: "excel",
    } };
  }
  const service = v.itemType === "SERVICE";
  const price = v.price ?? 0, cost = v.cost ?? 0;
  const pack = v.packageUnit || v.unit, rate = v.conversionRate || 1;
  return {
    data: {
      ...(v.sku ? { sku: v.sku, productCode: v.sku } : {}), barcode: v.barcode || "", barcodes: v.barcode ? [v.barcode] : [],
      name: v.name, productName: v.name, itemType: service ? "SERVICE" : "PRODUCT", productType: service ? "SERVICE" : "PHYSICAL",
      category: v.category || "general", subCategory: v.subCategory || "", brand: v.brand || "", model: v.model || "", mainModel: v.model || "",
      description: v.description || "", technicalSpecs: v.description || "",
      unit: v.unit, baseUnit: v.unit, packageUnit: pack, purchaseUnit: pack, conversionRate: rate, conversionFactor: rate,
      taxType: v.taxType || "VAT_7", vatType: v.taxType || "VAT_7", lifecycleStatus: v.lifecycleStatus || "ACTIVE",
      pricing: { pricePOS: price, priceProject: v.priceProject ?? price, priceWholesale: v.priceWholesale ?? price, ...(v.minimumFloorPrice !== undefined ? { minimumFloorPrice: v.minimumFloorPrice } : {}) },
      unitPrice: price, costPrice: cost, wholesalePrice: v.priceWholesale ?? price,
      inventoryControl: { reorderPoint: v.reorderPoint || 0, minStock: v.minStock ?? v.reorderPoint ?? 0, maxStock: v.maxStock || 0, orderUnit: pack },
      warehouseId: v.warehouseId || "WH-01", rackLocation: v.rackLocation || "",
      warehouseLocation: v.rackLocation ? `${v.warehouseId || "WH-01"}:${v.rackLocation}` : v.warehouseId || "WH-01",
      isSerialized: !!v.isSerialized, isSerialTracked: !!v.isSerialized,
      ...(v.warrantyMonths !== undefined ? { warrantyMonths: v.warrantyMonths } : {}),
      ...(v.weightKg !== undefined ? { weightKg: v.weightKg } : {}),
      ...(v.supplierSku || v.leadTimeDays !== undefined ? { supplierConfig: [{ supplierId: "", supplierSku: v.supplierSku || "", mpn: "", latestCost: cost, leadTimeDays: v.leadTimeDays || 0, isPrimary: true }] } : {}),
      importedFrom: "excel",
    },
    ...(!service && v.openingQty ? { openingStock: { qty: v.openingQty, unitCost: cost, postJournal: opts.postOpeningJournal !== false } } : {}),
  };
}

/** ค่าในระบบ → ข้อความในไฟล์ (ตัวเลือกใช้ข้อความแรกที่ตรงกับค่า) */
const choiceText = (c: ImportColumn, v: any) => (v === undefined || v === null || v === "" ? "" : Object.entries(c.choices || {}).find(([, x]) => x === v)?.[0] ?? String(v));

/** ข้อมูลในระบบ → แถว Excel ตามหัวตารางของแม่แบบ (ใช้ส่งออก แก้ แล้วนำเข้ากลับ) */
export function toTemplateRow(entity: ImportEntity, r: Record<string, any>): any[] {
  const pick = (...ks: any[]) => ks.find((x) => x !== undefined && x !== null && x !== "");
  const sup = Array.isArray(r.supplierConfig) ? r.supplierConfig.find((x: any) => x?.isPrimary) || r.supplierConfig[0] : null;
  const v: Record<string, any> = entity === "employees" ? { ...r, _id: r.id }
    : entity === "products" ? {
      _id: r.id, sku: pick(r.sku, r.productCode), name: pick(r.name, r.productName), itemType: r.itemType === "SERVICE" || r.productType === "SERVICE" ? "SERVICE" : "PRODUCT",
      unit: pick(r.unit, r.baseUnit), barcode: r.barcode, category: r.category, subCategory: r.subCategory, brand: r.brand, model: pick(r.model, r.mainModel),
      description: pick(r.description, r.technicalSpecs), taxType: pick(r.taxType, r.vatType), packageUnit: pick(r.packageUnit, r.purchaseUnit), conversionRate: pick(r.conversionRate, r.conversionFactor),
      price: pick(r.unitPrice, r.pricing?.pricePOS), priceProject: r.pricing?.priceProject, priceWholesale: pick(r.pricing?.priceWholesale, r.wholesalePrice), minimumFloorPrice: r.pricing?.minimumFloorPrice,
      cost: pick(r.costPrice, r.pricing?.costWAC), reorderPoint: r.inventoryControl?.reorderPoint, minStock: r.inventoryControl?.minStock, maxStock: r.inventoryControl?.maxStock,
      warehouseId: r.warehouseId, rackLocation: r.rackLocation, isSerialized: r.isSerialized ?? r.isSerialTracked, warrantyMonths: r.warrantyMonths, weightKg: r.weightKg,
      supplierSku: sup?.supplierSku, leadTimeDays: sup?.leadTimeDays, lifecycleStatus: r.lifecycleStatus,
    }
    : {
      _id: r.id, name: pick(r.name, r.customerName, r.supplierName), orgType: pick(r.docProfile?.orgType, r.orgType), category: pick(r.entity_category, r.contractor_type),
      taxId: pick(r.taxId, r.tax_id), branchCode: pick(r.branchCode, r.branch_code), branchName: r.branchName,
      address: pick(r.addressNo, r.address_detail), building: r.building, soi: r.soi, road: r.road, subDistrict: r.subDistrict, district: r.district, province: r.province, zipCode: r.zipCode,
      phone: pick(r.phone, r.phoneNumber), email: r.email, contactPerson: pick(r.contactPerson, r.contactName, r.contact_person),
      creditLimit: r.creditLimit, creditTermDays: pick(r.creditTermDays, r.credit_term_days, parseInt(String(r.payment_term || ""), 10) || undefined),
      bankName: pick(r.bankName, r.bank_name), bankAccount: pick(r.bankAccount, r.account_number), bankAccountName: pick(r.bankAccountName, r.account_name),
      paymentMethod: pick(r.paymentMethod, r.payment_method), businessType: r.business_type, chequePickupDay: r.cheque_pickup_day, note: r.note,
    };
  return IMPORT_TEMPLATES[entity].columns.map((c) => {
    const x = v[c.key];
    if (x === undefined || x === null) return "";
    if (c.type === "choice") return choiceText(c, x);
    if (c.type === "bool") return x ? "ใช่" : "ไม่ใช่";
    if (c.type === "date") return /^\d{4}-\d{2}-\d{2}/.test(String(x)) ? `${String(x).slice(8, 10)}/${String(x).slice(5, 7)}/${Number(String(x).slice(0, 4)) + 543}` : String(x);
    return x;
  });
}
