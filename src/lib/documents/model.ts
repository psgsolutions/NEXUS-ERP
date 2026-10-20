/**
 * โครงสร้างเอกสารกลาง — ทุกประเภทเอกสารแปลงข้อมูลของตัวเองเป็น DocumentModel แล้วใช้เทมเพลตเดียวกันพิมพ์
 * (แยกจากหน้าตา เพื่อให้ใช้ซ้ำได้กับ PDF / อีเมล / ลิงก์ให้ลูกค้า / แอปอื่น)
 */

export interface DocumentProfile {
  name: string;
  nameEn?: string;
  address: string;
  taxId: string;
  branchCode: string; // 00000 = สำนักงานใหญ่
  branchName?: string;
  phone?: string;
  email?: string;
  website?: string;
  /** data URL (PNG/JPEG) ขนาดเล็ก */
  logo?: string;
  /** สีหลักของเอกสาร (#RRGGBB) */
  brandColor?: string;
  /** ข้อความท้ายเอกสาร เช่น เงื่อนไขทั่วไป */
  footerNote?: string;
  /** ข้อมูลการชำระเงิน เช่น บัญชีธนาคาร */
  paymentInfo?: string;
}

export interface DocumentParty {
  /** หัวข้อ เช่น "ลูกค้า" / "ผู้ขาย" / "ผู้รับเงิน" */
  label: string;
  name: string;
  taxId?: string;
  branchCode?: string;
  branchName?: string;
  address?: string;
  contact?: string;
  /** หัวข้อช่องผู้ติดต่อ (ค่าเริ่มต้น "ผู้ติดต่อ") */
  contactLabel?: string;
  phone?: string;
  email?: string;
}

export type ColumnKey = "no" | "code" | "description" | "qty" | "unit" | "price" | "discount" | "amount" | "debit" | "credit";

export interface DocumentLine {
  /** บรรทัดหัวข้อกลุ่ม (ไม่มีจำนวน/ราคา) */
  heading?: boolean;
  code?: string;
  description: string;
  /** รายละเอียดย่อยใต้รายการ */
  detail?: string;
  qty?: number;
  unit?: string;
  price?: number;
  discount?: number;
  amount?: number;
  /** ใบสำคัญบัญชี */
  debit?: number;
  credit?: number;
}

export interface DocumentTotalRow {
  label: string;
  amount: number;
  /** เน้น (ยอดสุทธิ) */
  strong?: boolean;
}

export interface DocumentModel {
  /** ประเภทเอกสาร (ใช้กับสิทธิ์/ชื่อไฟล์) */
  type: string;
  title: string;
  titleEn?: string;
  number: string;
  date: string; // YYYY-MM-DD ("" = พิมพ์เว้นวันที่ให้ลูกค้าลงเอง ตามโปรไฟล์เอกสารของลูกค้า)
  /** แถวข้อมูลด้านขวาเพิ่มเติม เช่น ครบกำหนด อ้างอิง */
  meta: { label: string; value: string }[];
  seller: DocumentProfile;
  party?: DocumentParty;
  /** คอลัมน์ตารางรายการ (ค่าเริ่มต้นตามประเภท) */
  columns?: ColumnKey[];
  lines: DocumentLine[];
  totals: DocumentTotalRow[];
  /** ยอดที่แสดงเป็นตัวอักษร (ไม่ระบุ = ไม่แสดง) */
  amountInWords?: number;
  notes?: string[];
  /** ช่องลงนามด้านล่าง เช่น ["ผู้รับเงิน", "ผู้มีอำนาจลงนาม"] */
  signatures: string[];
  /** ลายเซ็นที่เก็บไว้แล้ว (data URL) และชื่อผู้ลงนาม ตามหัวข้อช่องลงนาม */
  signed?: Record<string, { image?: string; name?: string; date?: string }>;
  /** รูปประกอบ เช่น ก่อน/หลังทำงาน (data URL) */
  photos?: { label: string; src: string }[];
  /** ลายน้ำ เช่น "ยกเลิก" / "ฉบับร่าง" */
  watermark?: string;
  /** แบบฟอร์มทางราชการที่ต้องพิมพ์ตามแบบ (แทนเทมเพลตมาตรฐาน) */
  wht50?: Wht50Form;
}

/** ผู้จ่าย/ผู้รับเงินบนหนังสือรับรองการหักภาษี ณ ที่จ่าย */
export interface Wht50Party {
  name: string;
  taxId: string;
  branchCode?: string;
  address: string;
}

/**
 * หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
 * rows: แถวประเภทเงินได้ตามแบบ (1–6) ที่มียอด
 */
export interface Wht50Form {
  bookNo?: string;
  payer: Wht50Party;
  payee: Wht50Party;
  /** ภ.ง.ด. ที่ยื่น */
  form: "PND1A" | "PND1A_SPECIAL" | "PND2" | "PND3" | "PND2A" | "PND3A" | "PND53";
  /** ลำดับที่ในแบบ (ถ้ามี) */
  sequenceInForm?: string;
  rows: { row: 1 | 2 | 3 | 4 | 5 | 6; label: string; date: string; amount: number; tax: number }[];
  /** เงินสมทบกองทุน (เงินเดือน) */
  sso?: number;
  providentFund?: number;
  /** 1 หัก ณ ที่จ่าย, 2 ออกให้ตลอดไป, 3 ออกให้ครั้งเดียว, 4 อื่น ๆ */
  payCondition: 1 | 2 | 3 | 4;
  issueDate: string;
  references?: string;
}

export type CopyMode = "original" | "copy";
