import { applyTypoFixes, checkThaiAddress, findTypos, normalizeThaiText, type AddressIndex } from "@/lib/spellcheck";
import type { ImportTemplate } from "./templates";

/** คำแนะนำแก้ค่าของช่องหนึ่ง (กดใช้ได้ทีละช่อง หรือแก้ทั้งชุด) */
export interface FieldFix { key: string; header: string; from: string; to: string; message: string }

/**
 * ตรวจคำผิดของแถวที่ผ่านการตรวจรูปแบบแล้ว (ไม่บล็อกการนำเข้า)
 *  - ช่องข้อความ: ปรับรูปแบบที่ปลอดภัยให้ทันที (ํา→ำ ช่องว่างซ้ำ) แล้วหาคำที่อาจพิมพ์ผิด
 *  - ช่องที่อยู่ (จังหวัด อำเภอ ตำบล รหัสไปรษณีย์): เทียบฐานข้อมูลที่อยู่ไทย (ถ้าโหลดแล้ว)
 */
export function checkRowSpelling(template: ImportTemplate, values: Record<string, any>, addr: AddressIndex | null) {
  const out = { ...values };
  const fixes: FieldFix[] = [];
  let normalized = 0;
  for (const c of template.columns) {
    if (c.type !== "text" || typeof out[c.key] !== "string" || c.key === "_id") continue;
    const n = normalizeThaiText(out[c.key]);
    if (n.changes) { out[c.key] = n.text; normalized += n.changes; }
    if (["zipCode", "phone", "sku", "barcode"].includes(c.key)) continue;
    const typos = findTypos(n.text);
    if (typos.length) {
      const to = applyTypoFixes(n.text, typos);
      if (to !== n.text) fixes.push({ key: c.key, header: c.header, from: n.text, to, message: typos.map((t) => (t.suggest ? `${t.wrong} → ${t.suggest}` : `${t.wrong} (${t.reason})`)).join(", ") });
    }
  }
  if (addr && template.columns.some((c) => c.key === "province")) {
    for (const issue of checkThaiAddress(out, addr)) {
      const header = template.columns.find((c) => c.key === issue.field)?.header || issue.field;
      if (issue.suggest) fixes.push({ key: issue.field, header, from: String(out[issue.field] ?? ""), to: issue.suggest, message: issue.message });
      else fixes.push({ key: issue.field, header, from: String(out[issue.field] ?? ""), to: "", message: issue.message });
    }
  }
  return { values: out, fixes, normalized };
}
