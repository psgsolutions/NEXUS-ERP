/**
 * คุณลักษณะเฉพาะของสินค้าเป็นข้อ ๆ (specItems) — จาก AI อ่าน datasheet หรือพิมพ์เอง แก้ได้ทุกข้อเสมอ
 * ร่าง TOR ใช้ specItems ก่อน (ไม่มี → technicalSpecs เดิม)
 */
export const SPEC_ITEMS_MAX = 40;

/** ทำความสะอาด: ตัดเลขข้อ/สัญลักษณ์นำหน้า ข้อว่าง และข้อซ้ำ */
export function normalizeSpecItems(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\r?\n/) : [];
  const seen = new Set<string>();
  return list
    .map((x) => String(x ?? "").replace(/^\s*(?:[-•*·]|\d+(?:\.\d+)*[.)]?)\s*/, "").replace(/\s+/g, " ").trim().slice(0, 400))
    .filter((x) => x && !seen.has(x) && (seen.add(x), true))
    .slice(0, SPEC_ITEMS_MAX);
}

/** ข้อความสเปกของสินค้าที่ร่าง TOR ใช้ (บรรทัดละข้อ) */
export function productSpecText(p: any): string {
  const items = normalizeSpecItems(p?.specItems);
  return items.length ? items.join("\n") : String(p?.technicalSpecs || "");
}

/** สินค้ามีเอกสาร datasheet แล้ว (ลิงก์ · แนบ PDF · AI อ่านแล้ว) — กฎตรวจแผนงาน R3 */
export const hasDatasheet = (p: any) => !!(p && (String(p.datasheetUrl || "").trim() || p.hasDatasheet || p.specSource === "datasheet"));
