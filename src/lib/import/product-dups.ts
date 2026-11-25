import { createDuplicateFinder, type MatchCandidate } from "@/lib/product-match";
import type { DupRow } from "./party-dups";

/**
 * ตรวจสินค้าที่อาจซ้ำกับของเดิมก่อนนำเข้า (ชื่อเรียกต่างกัน / รหัส / รุ่นตรงกัน) — ไม่บล็อก ให้คนตัดสินใจ
 *  - เป็นตัวเดียวกัน → "ใช้สินค้าเดิม" (แถวนี้กลายเป็นแก้ไขสินค้าเดิม ไม่สร้างใหม่)
 *  - ไม่ใช่ → ปล่อยผ่าน (สร้างใหม่) · ไม่ต้องการ → ลบแถว
 * แถวที่มีรหัสในระบบแล้ว (แก้รายการเดิม) และแถวที่ไม่ผ่านรูปแบบ ไม่ตรวจ
 */
export function markProductDuplicates<R extends DupRow & { dupOf?: MatchCandidate[] }>(rows: R[], existing: Array<Record<string, any>>, synonyms: string[][] = [], nameHeader = "ชื่อสินค้า") {
  if (!existing.length) return;
  const find = createDuplicateFinder(existing, { synonyms, limit: 3 });
  for (const r of rows) {
    if (r.status === "invalid" || r.values._id) continue;
    const v = r.values;
    const cands = find({ name: v.name, category: v.category, brand: v.brand, model: v.model, sku: v.sku, barcode: v.barcode, supplierSku: v.supplierSku });
    if (!cands.length) continue;
    const c = cands[0];
    const more = cands.length > 1 ? ` (และอีก ${cands.length - 1} รายการ: ${cands.slice(1).map((x) => x.sku || x.name).join(", ")})` : "";
    r.dupOf = cands;
    r.fixes = [...(r.fixes || []), {
      key: "name", header: nameHeader, from: `dup:product:${c.id}`, to: "",
      message: `อาจซ้ำกับสินค้าเดิม ${c.sku ? `${c.sku} ` : ""}${c.name} — ${c.reason}${more} · ตัวเดียวกันกด "ใช้สินค้าเดิม" · ไม่ใช่กดปล่อยผ่าน`,
    }];
  }
}
