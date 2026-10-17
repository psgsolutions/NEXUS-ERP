import { bahttext } from "bahttext";

/**
 * รูปแบบข้อความบนเอกสาร (ใช้ได้ทั้ง client และ server)
 */

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** วันที่จากค่าใด ๆ (YYYY-MM-DD, ISO, Timestamp ของ Firestore, Date) -> "YYYY-MM-DD" ตามเวลาไทย */
export function toDateStr(value: any): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t + 7 * 3600e3).toISOString().slice(0, 10) : "";
  }
  const secs = value.seconds ?? value._seconds;
  const ms = secs !== undefined ? secs * 1000 : value instanceof Date ? value.getTime() : typeof value.toDate === "function" ? value.toDate().getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : "";
}

/** "17 ตุลาคม 2569" */
export function thaiDate(value: any): string {
  const d = toDateStr(value);
  if (!d) return "-";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

/** 1,234.50 */
export const money = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** จำนวนเป็นข้อความ: ทศนิยมเท่าที่มี สูงสุด 3 ตำแหน่ง */
export const qtyText = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });

/** "(หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์)" — ยอดติดลบใส่ "ลบ" นำหน้า */
export function amountInWords(n: any): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const text = bahttext(Math.abs(v));
  return v < 0 ? `ลบ${text}` : text;
}

/** สาขาตามรูปแบบกรมสรรพากร: 00000 = สำนักงานใหญ่, อื่น ๆ = สาขาที่ 00001 */
export function branchLabel(code: any, name?: any): string {
  const c = String(code ?? "").replace(/\D/g, "");
  const n = String(name ?? "").trim();
  if (!c || /^0+$/.test(c)) return n && !/สำนักงานใหญ่/.test(n) ? n : "สำนักงานใหญ่";
  return `สาขาที่ ${c.padStart(5, "0")}${n && n !== c ? ` (${n})` : ""}`;
}

/** เลขประจำตัวผู้เสียภาษี 13 หลัก "0-1055-64000-00-0" */
export function formatTaxId(raw: any): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length === 13 ? `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}` : String(raw ?? "");
}
