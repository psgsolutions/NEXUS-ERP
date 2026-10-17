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
  phone?: string;
  email?: string;
}

export type ColumnKey = "no" | "code" | "description" | "qty" | "unit" | "price" | "discount" | "amount";

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
  date: string; // YYYY-MM-DD
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
  /** ลายน้ำ เช่น "ยกเลิก" / "ฉบับร่าง" */
  watermark?: string;
}

export type CopyMode = "original" | "copy";
