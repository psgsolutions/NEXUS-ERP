/**
 * ตรวจสินค้าที่อาจเป็นตัวเดียวกันแต่เรียกต่างกัน (ใช้ทั้งหน้าเพิ่มสินค้าและหน้านำเข้า Excel)
 *  1) รหัสที่ระบุตัวสินค้า: SKU / บาร์โค้ด / Part number / MPN / รหัสผู้ขาย / ยี่ห้อ+รุ่น ตรงกัน = ซ้ำแน่นอน
 *  2) ชื่อ: แปลงเป็นคำกลางก่อนเทียบ — คำพ้องไทย/อังกฤษ (สาย = cable, ตัวผู้ = plug, แลน = UTP)
 *     สเปกเขียนต่างกัน (CAT 6 = cat6, 305 ม. = 305m, 12C = 12 core, 1/2 นิ้ว = 1/2in) · ตัดคำที่ไม่ช่วยแยกสินค้า
 *  3) สเปกตัวเลขชนิดเดียวกันแต่ค่าต่าง (12 core กับ 24 core, CAT6 กับ CAT5e, ถุง 50 ตัว กับ 100 ตัว) = ไม่ใช่ตัวเดียวกัน
 *  4) หมวดเดียวกันได้ก่อน · ข้ามหมวดต้องคล้ายมากกว่า
 * คำพ้องเพิ่มเองได้ (ตั้งค่าของบริษัท) — ไม่บล็อกการบันทึก ให้คนตัดสินใจ
 */

export interface MatchInput {
  name?: string; category?: string; brand?: string; model?: string; partNumber?: string; mpn?: string; supplierSku?: string; sku?: string; barcode?: string;
}
export interface MatchCandidate { id: string; name: string; sku: string; category: string; score: number; reason: string; sameCategory: boolean; exact: boolean }

/** กลุ่มคำพ้องเริ่มต้น: [คำกลาง, ...คำที่ใช้เรียก] */
export const DEFAULT_SYNONYMS: string[][] = [
  ["cabletie", "เคเบิ้ลไทร์", "เคเบิลไทร์", "หนวดกุ้ง", "cable tie"],
  ["patchcord", "สายแพทช์คอร์ด", "สายแพทช์", "patch cord", "patchcord"],
  ["patchpanel", "แผงกระจายสาย", "patch panel"],
  ["fiber", "ไฟเบอร์ออปติก", "ไฟเบอร์", "ใยแก้วนำแสง", "ใยแก้ว", "fiber optic", "fibre", "fiber", "fo"],
  ["wire", "สายไฟฟ้า", "สายไฟ", "wire"],
  ["cable", "สายสัญญาณ", "สาย", "cable"],
  ["lan", "แลน", "utp", "ethernet", "lan"],
  ["plug", "ตัวผู้", "male", "plug"],
  ["jack", "ตัวเมีย", "female", "modular jack", "jack"],
  ["box", "กล่อง", "box"],
  ["bag", "ถุง", "ซอง", "bag", "pack"],
  ["roll", "ม้วน", "roll", "reel"],
  ["conduit", "ท่อร้อยสาย", "ท่อ", "conduit", "pipe"],
  ["screw", "สกรู", "screw"],
  ["bolt", "น็อต", "นอต", "น๊อต", "bolt", "nut"],
  ["anchor", "พุก", "anchor"],
  ["breaker", "เบรกเกอร์", "เบรคเกอร์", "breaker"],
  ["camera", "กล้องวงจรปิด", "กล้อง", "camera", "cctv", "ipc"],
  ["outlet", "เต้ารับ", "ปลั๊ก", "outlet", "socket", "receptacle"],
  ["panel", "ตู้ไฟ", "ตู้คอนซูมเมอร์", "consumer unit", "load center"],
  ["cabinet", "ตู้แร็ค", "ตู้แร็ก", "ตู้", "rack", "cabinet"],
  ["hdd", "ฮาร์ดดิสก์", "hard disk", "harddisk", "hdd"],
  ["battery", "แบตเตอรี่", "แบต", "battery"],
  ["adapter", "อะแดปเตอร์", "อแดปเตอร์", "adapter", "adaptor"],
  ["label", "ฉลาก", "ป้าย", "label", "sticker"],
  ["switch", "สวิตช์", "สวิทช์", "สวิตซ์", "switch"],
  ["lamp", "หลอดไฟ", "หลอด", "lamp", "bulb"],
];

/** คำที่ไม่ช่วยแยกสินค้า */
const STOP = new Set(["ชุด", "อัน", "ชิ้น", "ตัว", "หัว", "ยี่ห้อ", "รุ่น", "ขนาด", "แบบ", "สำหรับ", "และ", "พร้อม", "with", "for", "the", "of", "and", "type", "model", "set", "pcs", "unit"]);

/** หน่วยสเปก → หน่วยกลาง (ยาวก่อนสั้น) */
const UNITS: [string, string][] = [
  ["ตร.มม.", "sqmm"], ["ตร.มม", "sqmm"], ["ตรมม", "sqmm"], ["sq.mm", "sqmm"], ["sqmm", "sqmm"], ["mm2", "sqmm"],
  ["เมตร", "m"], ["meter", "m"], ["metre", "m"], ["ม.", "m"], ["ม", "m"], ["mm", "mm"], ["มม.", "mm"], ["มม", "mm"], ["มิล", "mm"], ["m", "m"],
  ["ล้านพิกเซล", "mp"], ["mp", "mp"],
  ["core", "core"], ["คอร์", "core"], ["c", "core"],
  ["พอร์ต", "port"], ["port", "port"], ["p", "port"],
  ["channel", "ch"], ["ช่อง", "ch"], ["ch", "ch"],
  ["วัตต์", "w"], ["w", "w"], ["แอมป์", "a"], ["amp", "a"], ["a", "a"], ["โวลต์", "v"], ["v", "v"],
  ["kva", "kva"], ["kwp", "kwp"], ["kwh", "kwh"], ["kw", "kw"],
  ["tb", "tb"], ["gb", "gb"], ["u", "u"],
  ["นิ้ว", "in"], ["inch", "in"], ['"', "in"], ["in", "in"],
  ["กก.", "kg"], ["kg", "kg"],
  ["ตัว", "pcs"], ["ชิ้น", "pcs"], ["pcs", "pcs"], ["pc", "pcs"], ["ea", "pcs"],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT_RE = new RegExp(`(?<![a-z0-9ก-๙/.])(\\d+(?:\\.\\d+)?(?:/\\d+)?)\\s*(${[...UNITS].sort((a, b) => b[0].length - a[0].length).map((u) => esc(u[0])).join("|")})(?![a-z0-9ก-๙])`, "g");
const UNIT_OF = new Map(UNITS);

const synCache = new Map<string, [string, string][]>();
function synonymList(extra: string[][] = []): [string, string][] {
  const key = JSON.stringify(extra);
  const hit = synCache.get(key);
  if (hit) return hit;
  const out: [string, string][] = [];
  for (const g of [...extra, ...DEFAULT_SYNONYMS]) {
    const canon = String(g[0] || "").toLowerCase().replace(/\s+/g, "");
    if (!canon) continue;
    for (const w of g) { const x = String(w || "").toLowerCase().trim(); if (x && !out.some(([k]) => k === x)) out.push([x, canon]); }
  }
  out.sort((a, b) => b[0].length - a[0].length);
  if (synCache.size > 20) synCache.clear();
  synCache.set(key, out);
  return out;
}

/** ชื่อสินค้า → คำกลาง (สเปกเป็นรูปเดียวกัน คำพ้องเป็นคำเดียวกัน) */
export function canonTokens(name: string, extra: string[][] = []): string[] {
  let s = ` ${String(name || "").toLowerCase().replace(/[,()[\]{}+*_|;:]/g, " ")} `;
  s = s.replace(/\bcat(?:egory)?[\s.\-]*(\d+[a-z]?)\b/g, " cat$1 ");
  s = s.replace(UNIT_RE, (_, n: string, u: string) => ` ${n}${UNIT_OF.get(u) || u} `);
  for (const [w, canon] of synonymList(extra)) {
    if (/^[a-z0-9 ]+$/.test(w)) s = s.replace(new RegExp(`(?<![a-z0-9])${esc(w)}(?![a-z0-9])`, "g"), ` ${canon} `);
    else s = s.split(w).join(` ${canon} `);
  }
  // ไม่ตัดที่ . และ / เพื่อคงสเปก 2.5sqmm, 1/2in · ตัดเครื่องหมายที่หัว/ท้ายคำแทน
  const tokens = s.split(/[\s\-–'"]+/).map((t) => t.replace(/^[./]+|[./]+$/g, "")).flatMap((t) => (/^\d+(\.\d+)?(\/\d+)?[a-z]+$/.test(t) || /^[a-z]*\d*[a-z0-9]*$/.test(t) ? [t] : t.match(/[ก-๙]+|[a-z0-9]+/g) || []));
  return tokens.filter((t) => t && !STOP.has(t));
}

/** สเปกตัวเลข: หน่วย → ค่า (cat6 ถือเป็นหน่วย cat) */
function specsOf(tokens: string[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const t of tokens) {
    const x = t.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)([a-z]+)$/) || (t.startsWith("cat") ? ["", t.slice(3), "cat"] : null);
    if (!x || !x[1]) continue;
    const set = m.get(x[2]) || new Set<string>();
    set.add(x[1]);
    m.set(x[2], set);
  }
  return m;
}
/** หน่วยที่มีทั้งสองฝั่งแต่ค่าไม่ตรงกันเลย */
function specConflict(a: Map<string, Set<string>>, b: Map<string, Set<string>>): string {
  for (const [u, va] of a) {
    const vb = b.get(u);
    const fmt = (v: Set<string>) => [...v].map((x) => (u === "cat" ? `CAT${x}` : `${x}${u}`)).join("/");
    if (vb && ![...va].some((v) => vb.has(v))) return `${fmt(va)} ≠ ${fmt(vb)}`;
  }
  return "";
}

const bigrams = (s: string) => { const out: string[] = []; for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2)); return out; };
function dice<T>(a: T[], b: T[]): number {
  if (!a.length || !b.length) return 0;
  const pool = new Map<T, number>();
  for (const x of b) pool.set(x, (pool.get(x) || 0) + 1);
  let hit = 0;
  for (const x of a) { const n = pool.get(x) || 0; if (n) { hit++; pool.set(x, n - 1); } }
  return (2 * hit) / (a.length + b.length);
}

const uniq = (t: string[]) => [...new Set(t)];
/** ความคล้ายของคำกลาง 2 ชุด 0–1 · สเปกขัดกัน = ลดเหลือ 40% */
function tokensMatch(ta: string[], tb: string[]): { score: number; conflict: string } {
  if (!ta.length || !tb.length) return { score: 0, conflict: "" };
  const tokenScore = dice(uniq(ta), uniq(tb));
  const charScore = dice(bigrams([...ta].sort().join("")), bigrams([...tb].sort().join("")));
  const conflict = specConflict(specsOf(ta), specsOf(tb));
  const score = Math.max(tokenScore, charScore * 0.95);
  return { score: conflict ? score * 0.4 : score, conflict };
}
/** ความคล้ายของชื่อหลังแปลงเป็นคำกลาง 0–1 · สเปกขัดกัน = ลดเหลือ 40% */
export function nameMatch(a: string, b: string, extra: string[][] = []) {
  return tokensMatch(canonTokens(a, extra), canonTokens(b, extra));
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[\s\-_/.,()]+/g, "").trim();
const listOf = (p: Record<string, any>, key: string) => [p[key], ...(Array.isArray(p.supplierConfig) ? p.supplierConfig.map((s: any) => s?.[key]) : [])].map(norm).filter(Boolean);

export interface FinderOptions { synonyms?: string[][]; limit?: number; companyId?: string }
/**
 * ตัวค้นสินค้าซ้ำที่สร้างดัชนีครั้งเดียว (หน้านำเข้า: หลายพันแถว × สินค้าทั้งหมด)
 *  - รหัส: ตารางค้นตรง · ชื่อ: เทียบเฉพาะสินค้าที่มีคำกลางร่วมกันอย่างน้อย 1 คำ
 * เกณฑ์: หมวดเดียวกัน (หรือไม่ระบุหมวด) ≥ 0.6 · ข้ามหมวด ≥ 0.75 · สเปกขัดกัน = ไม่นับ
 */
export function createDuplicateFinder(products: Array<Record<string, any>>, opts: FinderOptions = {}) {
  const syn = opts.synonyms || [];
  const list = (products || []).filter((p) => p && !p.isDeleted && !(opts.companyId && p.companyId && p.companyId !== opts.companyId));
  const tokensOf = new Map<string, string[]>();
  const byToken = new Map<string, number[]>();
  list.forEach((p, i) => {
    const t = uniq(canonTokens(String(p.name || p.productName || ""), syn));
    tokensOf.set(String(p.id), t);
    for (const k of t) { const a = byToken.get(k); if (a) a.push(i); else byToken.set(k, [i]); }
  });
  return (input: MatchInput, excludeId?: string, limit = opts.limit ?? 3): MatchCandidate[] => {
    const name = String(input.name || "").trim();
    const cat = norm(input.category);
    const ids = { sku: norm(input.sku), barcode: norm(input.barcode), part: norm(input.partNumber), mpn: norm(input.mpn), supSku: norm(input.supplierSku) };
    const brandModel = input.brand && input.model ? `${norm(input.brand)}|${norm(input.model)}` : "";
    const inTokens = name.length >= 3 ? uniq(canonTokens(name, syn)) : [];
    const near = new Set<number>();
    for (const k of inTokens) for (const i of byToken.get(k) || []) near.add(i);
    const out: MatchCandidate[] = [];
    list.forEach((p, i) => {
      if (String(p.id) === excludeId) return;
      const pName = String(p.name || p.productName || "");
      const sameCategory = !cat || !norm(p.category) || norm(p.category) === cat;
      let score = 0, reason = "", exact = false;
      if (ids.sku && norm(p.sku) === ids.sku) { score = 1.5; reason = "รหัสสินค้าตรงกัน"; exact = true; }
      else if (ids.barcode && norm(p.barcode) === ids.barcode) { score = 1.5; reason = "บาร์โค้ดตรงกัน"; exact = true; }
      else if (ids.mpn && [...listOf(p, "mpn"), norm(p.partNumber)].includes(ids.mpn)) { score = 1.4; reason = "MPN ตรงกัน"; exact = true; }
      else if (ids.part && [norm(p.partNumber), ...listOf(p, "mpn"), norm(p.model)].includes(ids.part)) { score = 1.4; reason = "Part number ตรงกัน"; exact = true; }
      else if (ids.supSku && listOf(p, "supplierSku").includes(ids.supSku)) { score = 1.3; reason = "รหัสผู้ขายตรงกัน"; exact = true; }
      else if (brandModel && `${norm(p.brand)}|${norm(p.model || p.mainModel)}` === brandModel) { score = 1.2; reason = "ยี่ห้อและรุ่นเดียวกัน"; exact = true; }
      else if (inTokens.length && near.has(i)) {
        const m = tokensMatch(inTokens, tokensOf.get(String(p.id)) || []);
        if (m.conflict) return;
        if (m.score >= (sameCategory ? 0.6 : 0.75)) { score = m.score; reason = m.score >= 0.999 ? "ชื่อเดียวกัน" : `ชื่อคล้ายกัน ${Math.round(m.score * 100)}%`; }
      }
      if (score > 0) out.push({ id: String(p.id), name: pName || String(p.sku || p.id), sku: String(p.sku || ""), category: String(p.category || ""), score: Math.round(score * 1000) / 1000, reason: reason + (!sameCategory ? " (ต่างหมวด)" : ""), sameCategory, exact });
    });
    return out.sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.sameCategory) - Number(a.sameCategory) || b.score - a.score).slice(0, limit);
  };
}

/** สินค้าเดิมที่อาจเป็นตัวเดียวกัน (เรียงคะแนนมาก → น้อย · หมวดเดียวกันก่อน) — ใช้ครั้งเดียว */
export function findDuplicateCandidates(input: MatchInput, products: Array<Record<string, any>>, opts: FinderOptions & { excludeId?: string } = {}): MatchCandidate[] {
  return createDuplicateFinder(products, opts)(input, opts.excludeId);
}

/** ทำความสะอาดคำพ้องที่บริษัทตั้งเอง: กลุ่มละ 2–12 คำ ไม่เกิน 200 กลุ่ม */
export function normalizeSynonyms(raw: any): string[][] {
  return (Array.isArray(raw) ? raw : []).slice(0, 200)
    .map((g: any) => (Array.isArray(g) ? g : String(g || "").split(/[,=|]/)).map((w: any) => String(w ?? "").trim().slice(0, 40)).filter(Boolean).slice(0, 12))
    .filter((g: string[]) => g.length >= 2);
}
