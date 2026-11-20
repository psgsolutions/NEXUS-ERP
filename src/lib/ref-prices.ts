/**
 * ราคากลาง (BOM) — ราคาอ้างอิงต่อหน่วยของอุปกรณ์/ค่าแรง จาก Template_SOW_BOM (ชีต "ราคากลาง")
 * เก็บที่สินค้า (ข้อมูลของบริษัท): bomCode (รหัสในสูตร เช่น EMT-3/4"), refCost (ต่อหน่วยหลักของสินค้า),
 *   refCostUnit/refCostPer (หน่วยในราคากลาง และกี่หน่วยนั้นต่อ 1 หน่วยหลัก), refCostSource, refCostStatus ("" บริษัท / WEB / Y ประมาณการ)
 * ตัดสินใจ 2026-11-20: คิด BOM ด้วยราคากลางก่อน (ไม่มี → ต้นทุนเฉลี่ยจริง) · จับคู่กับสินค้าเดิมให้คนตรวจก่อนบันทึก
 */

export type RefStatus = "" | "WEB" | "Y";
export const REF_STATUS_TH: Record<RefStatus, string> = { "": "ไฟล์บริษัท", WEB: "ราคาเว็บ", Y: "ประมาณการ (ต้องยืนยัน)" };
export interface RefPriceRow { code: string; name: string; nameEn: string; category: string; unit: string; cost: number; source: string; status: RefStatus }

/** หมวดในราคากลางที่เป็นงานบริการ/ค่าแรง (ไม่นับสต็อก) */
const SERVICE_CATEGORIES = ["ค่าแรง", "ทดสอบ/ส่งมอบ", "บริหารโครงการ", "เครื่องมือ", "งานโครงสร้าง", "โยธา"];
export const isServiceCategory = (cat: string) => SERVICE_CATEGORIES.includes(String(cat || "").trim());

const s = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** แถวจากชีต (header แถวแรก: รหัส, รายการ (ไทย), Description (EN), หมวด, หน่วย, ต้นทุน/หน่วย, ที่มาของราคา, สถานะราคา) */
export function parseRefRows(rows: unknown[][]): RefPriceRow[] {
  const head = (rows[0] || []).map((h) => s(h));
  const idx = (re: RegExp, d: number) => { const i = head.findIndex((h) => re.test(h)); return i >= 0 ? i : d; };
  const c = { code: idx(/^รหัส/, 0), name: idx(/รายการ/, 1), en: idx(/Description/i, 2), cat: idx(/หมวด/, 3), unit: idx(/หน่วย$/, 4), cost: idx(/ต้นทุน/, 5), src: idx(/ที่มา/, 6), st: idx(/สถานะ/, 7) };
  const seen = new Set<string>();
  return rows.slice(1).map((r) => {
    const st = s(r[c.st], 10).toUpperCase();
    return { code: s(r[c.code], 40), name: s(r[c.name]), nameEn: s(r[c.en]), category: s(r[c.cat], 60), unit: s(r[c.unit], 20), cost: Math.max(0, Math.round(n(r[c.cost]) * 100) / 100), source: s(r[c.src], 500), status: (st === "WEB" || st === "Y" ? st : "") as RefStatus };
  }).filter((r) => r.code && r.name && !seen.has(r.code) && (seen.add(r.code), true)).slice(0, 2000);
}

// ---------------------------------------------------------------------------
// จับคู่กับสินค้าเดิม
// ---------------------------------------------------------------------------
const norm = (t: string) => t.toLowerCase().replace(/["'”″]/g, "").replace(/[^a-z0-9ก-๙/.]+/g, " ").trim();
const tokens = (t: string) => new Set(norm(t).split(" ").filter((x) => x.length > 1));
const UNIT_ALIAS: Record<string, string> = { "ม.": "เมตร", "ม": "เมตร", m: "เมตร", "เมตร": "เมตร", "ตัว": "ตัว", "ชิ้น": "ตัว", "ชุด": "ชุด", "เส้น": "เส้น" };
export const sameUnit = (a: string, b: string) => { const x = UNIT_ALIAS[s(a).toLowerCase()] || s(a), y = UNIT_ALIAS[s(b).toLowerCase()] || s(b); return !!x && x === y; };

export interface MatchCandidate { productId: string; sku: string; name: string; unit: string; score: number; reason: string; wac: number }

/** สินค้าที่น่าจะตรงกับรายการราคากลาง (เรียงคะแนนมาก→น้อย) — ผูก bomCode ไว้แล้วได้คะแนนเต็ม */
export function matchCandidates(row: RefPriceRow, products: any[], limit = 5): MatchCandidate[] {
  const a = new Set([...tokens(row.name), ...tokens(row.nameEn), ...tokens(row.code)]);
  const out: MatchCandidate[] = [];
  for (const p of products) {
    if (p.isDeleted === true) continue;
    const wac = n(p.pricing?.costWAC ?? p.costPrice);
    const base = { productId: String(p.id), sku: s(p.sku, 80), name: s(p.name), unit: s(p.unit, 20), wac };
    if (s(p.bomCode, 40) && s(p.bomCode, 40) === row.code) { out.push({ ...base, score: 1, reason: "ผูกรหัสนี้ไว้แล้ว" }); continue; }
    const b = tokens(`${p.name || ""} ${p.sku || ""} ${p.model || ""} ${p.partNumber || ""}`);
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    let score = inter / Math.max(3, a.size);
    if (score <= 0) continue;
    if (sameUnit(row.unit, p.unit)) score += 0.1;
    const svc = String(p.itemType || "PRODUCT").toUpperCase() === "SERVICE";
    if (svc !== isServiceCategory(row.category)) score -= 0.2;
    if (score >= 0.3) out.push({ ...base, score: Math.round(Math.min(0.99, score) * 100) / 100, reason: `คำตรงกัน ${inter} คำ${sameUnit(row.unit, p.unit) ? " · หน่วยเดียวกัน" : ""}` });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** ราคากลางต่อหน่วยหลักของสินค้า: ราคาต่อหน่วยในชีต × จำนวนหน่วยนั้นใน 1 หน่วยหลัก (เช่น 12.46/ม. × 305 ม./กล่อง) */
export const refCostPerBase = (cost: number, per: number) => Math.round(n(cost) * (n(per) > 0 ? n(per) : 1) * 10000) / 10000;

/** ต้นทุนที่ใช้คิด BOM: ราคากลาง (ถ้ามี) ไม่งั้นต้นทุนเฉลี่ยจริง */
export function bomUnitCost(p: any): { cost: number; basis: "ref" | "wac" | "none"; status?: RefStatus } {
  if (p && Number(p.refCost) > 0) return { cost: Number(p.refCost), basis: "ref", status: (p.refCostStatus || "") as RefStatus };
  const wac = n(p?.pricing?.costWAC ?? p?.costPrice ?? p?.cost);
  return wac > 0 ? { cost: wac, basis: "wac" } : { cost: 0, basis: "none" };
}

// ---------------------------------------------------------------------------
// งานบริการ LAN 3 รูปแบบ — สูตร BOM อยู่ที่ lib/bom.ts (lanBomSpec)
// ---------------------------------------------------------------------------
export const LAN_VARIANTS = [
  { key: "PB", bomCode: "SVC-LAN-PB", name: "เดินสาย LAN CAT6 แบบ Patch + Box", desc: "ต้นทางเข้า Patch Panel ปลายทางติดตั้งกล่อง + Modular Jack + Face Plate", col: 0 },
  { key: "PLUG2", bomCode: "SVC-LAN-2PLUG", name: "เดินสาย LAN CAT6 แบบเข้าหัวตัวผู้ 2 ฝั่ง", desc: "เข้าหัว RJ45 ตัวผู้ทั้ง 2 ปลาย", col: 1 },
  { key: "PPLUG", bomCode: "SVC-LAN-PPLUG", name: "เดินสาย LAN CAT6 แบบ Patch + ตัวผู้", desc: "ต้นทางเข้า Patch Panel ปลายทางเข้าหัว RJ45 ตัวผู้", col: 2 },
] as const;
