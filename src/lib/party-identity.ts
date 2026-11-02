/**
 * ตัวตนของคู่ค้า (ลูกค้า/ผู้ขาย/ผู้รับเหมา) — ใช้ได้ทั้ง client และ server
 *
 * ผู้เสียภาษี 1 ราย (เลขผู้เสียภาษี + สาขา) มีได้หลายหน่วยงาน เช่น กรุงเทพมหานคร → สำนักงานเขตต่าง ๆ,
 * กองทัพอากาศ → กองบิน/กรม, บริษัทในเครือที่แยกการบริหาร — แต่ละหน่วยงานเป็นคู่ค้า 1 รายการ
 * มีที่อยู่ ผู้ติดต่อ วงเงิน และลูกหนี้ของตัวเอง
 *  - ห้ามซ้ำ: เลขผู้เสียภาษี + สาขา + ชื่อหน่วยงาน (ไม่กรอกชื่อหน่วยงาน = ใช้ชื่อรายการ)
 *    → เลขเดียวกัน ต่างชื่อ = คนละรายการ (1 ชื่อ 1 ที่อยู่) · เลขเดียวกัน ชื่อเดียวกัน = ซ้ำ
 *  - ชื่อบนใบกำกับภาษี: ตั้งได้ต่อหน่วยงาน (taxInvoiceName) ไม่ตั้ง = "ชื่อนิติบุคคล (ชื่อหน่วยงาน)"
 */

const str = (v: unknown) => String(v ?? "").trim();

/** ชื่อที่ใช้แยกรายการภายใต้เลขผู้เสียภาษี+สาขาเดียวกัน: ชื่อหน่วยงาน หรือชื่อรายการ (ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง) */
export const partyUnitKey = (r: Record<string, any> | null | undefined) =>
  (str(r?.unitName) || str(r?.name) || str(r?.customerName) || str(r?.supplierName) || str(r?.legalName) || str(r?.companyName)).toUpperCase().replace(/\s+/g, "");

/** เลขประจำตัวผู้เสียภาษี/บัตรประชาชน 13 หลัก: ตรวจหลักสุดท้ายตามสูตรกรมสรรพากร (mod 11) */
export function isValidThaiTaxId(raw: unknown): boolean {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

/** ข้อความเตือนเลขผู้เสียภาษี ("" = ใช้ได้ หรือไม่ได้กรอก) */
export function taxIdProblem(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length !== 13) return "เลขผู้เสียภาษีต้องมี 13 หลัก";
  if (!isValidThaiTaxId(d)) return "เลขผู้เสียภาษีไม่ถูกต้อง (หลักสุดท้ายไม่ตรงสูตรตรวจ) — ตรวจเลขอีกครั้ง";
  return "";
}

/** ชื่อนิติบุคคล/ชื่อหลักของรายการ */
export const partyBaseName = (r: Record<string, any> | null | undefined) =>
  str(r?.legalName || r?.name || r?.customerName || r?.supplierName || r?.companyName);

/** ชื่อที่ใช้บนเอกสาร (ใบเสนอราคา ใบกำกับภาษี ใบเสร็จ ฯลฯ) และในรายการเลือก */
export function partyDocName(r: Record<string, any> | null | undefined): string {
  const custom = str(r?.taxInvoiceName);
  if (custom) return custom;
  const base = partyBaseName(r), unit = str(r?.unitName);
  return unit && !base.includes(unit) ? `${base} (${unit})` : base;
}

const normBranch = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d ? d.padStart(5, "0") : "00000";
};

export interface SameTaxEntry { id: string; name: string; branchCode: string; unitName: string; key: string }

/** รายการอื่นที่ใช้เลขผู้เสียภาษีเดียวกัน (ทุกสาขาและหน่วยงาน) — ใช้เตือนตอนเพิ่ม/แก้ */
export function sameTaxIdRecords(list: Array<Record<string, any>>, taxId: unknown, exceptId = ""): SameTaxEntry[] {
  const t = String(taxId ?? "").replace(/\D/g, "");
  if (t.length !== 13) return [];
  return (list || [])
    .filter((r) => r && r.id !== exceptId && !r.isDeleted && String(r.taxId ?? r.tax_id ?? "").replace(/\D/g, "") === t)
    .map((r) => ({ id: String(r.id), name: partyDocName(r), branchCode: normBranch(r.branchCode ?? r.branch_code), unitName: str(r.unitName), key: partyUnitKey(r) }));
}

/** ซ้ำจริง = เลข + สาขา + ชื่อหน่วยงาน/ชื่อรายการ ตรงกัน (ไม่สนตัวพิมพ์และช่องว่าง) */
export function exactDuplicate(entries: SameTaxEntry[], branchCode: unknown, record: { unitName?: string; name?: string }): SameTaxEntry | null {
  const b = normBranch(branchCode), k = partyUnitKey(record);
  return entries.find((e) => e.branchCode === b && e.key === k) || null;
}
