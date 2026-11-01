import { mapHeaders, type ImportTemplate } from "./templates";

/**
 * นำเข้าหลายไฟล์/หลายชีตพร้อมกัน: ระบุว่าแต่ละชีตเป็นข้อมูลชนิดใด จากหัวตาราง
 *  - ชนิดที่ใช้ได้ = มีคอลัมน์ที่ต้องกรอกครบ · คะแนน = คอลัมน์ที่รู้จัก × 2 − คอลัมน์ที่ไม่รู้จัก
 *  - ชื่อไฟล์/ชื่อชีตที่บอกชนิด (เช่น "ลูกค้า" "สินค้า") ใช้ก่อนคะแนน · ต่อมาเป็นชนิดที่เปิดอยู่ (fallback)
 *  - คะแนนเท่ากันและไม่มีคำบอก = ambiguous (ให้ผู้ใช้เลือกเอง)
 */
export const ENTITY_HINTS: Record<string, string[]> = {
  customers: ["ลูกค้า", "customer"],
  suppliers: ["ผู้ขาย", "ซัพพลายเออร์", "supplier", "vendor"],
  products: ["สินค้า", "บริการ", "product", "item"],
  employees: ["พนักงาน", "employee", "staff"],
  tb: ["งบทดลอง", "trial"],
  ar: ["ลูกหนี้", "receivable"],
  ap: ["เจ้าหนี้", "payable"],
};

export interface Detected { entity: string | null; ambiguous: boolean; candidates: string[] }

export function detectEntity(headers: any[], hints: string[], templates: ImportTemplate[], fallback?: string): Detected {
  const scored = templates
    .map((t) => { const m = mapHeaders(t, headers); return { entity: t.entity, ok: !m.missing.length, score: Object.keys(m.index).length * 2 - m.unknown.length }; })
    .filter((x) => x.ok && x.score > 0)
    .sort((a, b) => b.score - a.score);
  const candidates = scored.map((x) => x.entity);
  if (!scored.length) return { entity: null, ambiguous: false, candidates };
  const text = hints.join(" ").toLowerCase();
  // คำบอกชนิดที่ยาวกว่ามาก่อน ("ลูกหนี้" ไม่ถูก "ลูกค้า" ในชื่อเดียวกันแย่ง) — เลือกชนิดที่ใช้ได้และมีคำบอก
  const hinted = scored.filter((x) => (ENTITY_HINTS[x.entity] || []).some((k) => text.includes(k.toLowerCase())));
  if (hinted.length === 1) return { entity: hinted[0].entity, ambiguous: false, candidates };
  const pool = hinted.length ? hinted : scored;
  const top = pool.filter((x) => x.score === pool[0].score);
  if (top.length === 1) return { entity: top[0].entity, ambiguous: false, candidates };
  if (fallback && top.some((x) => x.entity === fallback)) return { entity: fallback, ambiguous: false, candidates };
  return { entity: top[0].entity, ambiguous: true, candidates };
}

/** ชื่อชีต Excel (≤31 ตัว ห้าม \ / ? * [ ] :) */
export const sheetName = (label: string) => label.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
