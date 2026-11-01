/**
 * NEXUS ERP — กฎป้ายภาษาไทย (C-19): ป้ายไทยไม่ต่อท้ายด้วยคำแปลภาษาอังกฤษในวงเล็บ
 * เช่น "ชื่อลูกค้า (Customer Name)" → "ชื่อลูกค้า"
 * ยกเว้นตัวย่อ/ศัพท์ที่ผู้ใช้รู้จักในรูปอังกฤษ (PO, VAT, TOR, e-GP), คีย์ลัด (Ctrl+Z, F10, Enter),
 * หน่วยและรูปแบบไฟล์ (pt, PNG/JPG, PDF / Word / Excel), รหัสตัวอย่าง (WH-01, PO-XXXXX)
 */

/** ข้อความไทย ตามด้วยวงเล็บที่ขึ้นต้นด้วยอักษรอังกฤษ (กลุ่มที่ 1 = ข้อความในวงเล็บ) */
const THAI_THEN_EN = /[฀-๿][^"'{}<>`\n]{0,40}?\s?\(([A-Za-z][A-Za-z0-9 /&.,'+-]{1,40})\)/g;

const KEEP = new Set([
  "Enter", "Delete", "data URL", "TH Sarabun", "SUPERADMIN", "Log", "statement",
]);

/** วงเล็บนี้เป็นคำแปลอังกฤษที่ซ้ำกับป้ายไทย (ควรตัด) หรือไม่ */
function redundantEnglish(en) {
  const s = en.trim();
  if (KEEP.has(s)) return false;
  if (/^[a-z]/.test(s)) return false;                       // โค้ด/ตัวแปร (err.message, lineId) หรือ e-GP, pt
  if (/\b(Ctrl|Shift|Alt)\b|^F\d+$/.test(s)) return false;  // คีย์ลัด
  if (/^[A-Z]{1,4}-[A-Z0-9-]+$/.test(s) || /^Rev \d/.test(s)) return false; // รหัสตัวอย่าง WH-01, PO-XXXXX, Rev 1
  // ตัวย่อ: ทุกส่วนที่คั่นด้วย / ยาวไม่เกิน 5 ตัว (PO, CN/DN, PNG/JPG, COA / CE / ISO, S/N) — คำเต็มตัวพิมพ์ใหญ่ (SUBTOTAL) ไม่ใช่ตัวย่อ
  if (s.split("/").every((p) => /^[A-Z0-9&.+-]{1,5}$/.test(p.trim()))) return false;
  if (/^(PDF|Word|Excel|CSV|PNG|JPG)( ?\/ ?(PDF|Word|Excel|CSV|PNG|JPG))*$/.test(s)) return false;
  return true;
}

module.exports = { THAI_THEN_EN, redundantEnglish };
