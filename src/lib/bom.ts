/**
 * สูตร BOM แบบมีตัวแปร (เฟส 2 ตาม HANDOFF_Nexus_BOM_module.md) — ตรรกะเดียวกับ Template_SOW_BOM (build_template.py)
 *
 * จำนวนต่อ 1 หน่วยงานของแต่ละรายการ:  Q = (คงที่ × เงื่อนไข) + Σ (ตัวคูณ × ค่าที่กรอก)
 *  - คงที่: ตัวเลข หรืออ้างค่าตั้งค่า (เช่น Patch Panel = 1 ÷ พอร์ตต่อแผง, คอนเน็กเตอร์ = จำนวนต่อเส้นทาง)
 *  - เงื่อนไข: ใส่ส่วนคงที่เมื่อช่องกรอกนั้น > 0 (เช่น คอนเน็กเตอร์ Flex เมื่อมีท่อ Flex)
 *  - ตัวคูณ: อ้างค่าตั้งค่าได้ (×, ÷, 1 + เผื่อ) เช่น สาย = (1 + เผื่อสาย) × ระยะสาย, คัปปลิ้ง = ระยะ EMT ÷ ความยาวท่อต่อเส้น
 *  - รหัสสินค้าตามขนาด: 'EMT-{emtSize}' → หาสินค้าที่มี bomCode ตรง (ราคากลาง)
 *  - ปัดขึ้นทั้งงาน: รวมทั้งใบแล้วปัดขึ้น เฉพาะรายการที่นับเป็นชิ้น (ไม่ปัดต่อจุด)
 * ต้นทุน = จำนวน × ราคากลาง (ไม่มีราคากลาง → ต้นทุนเฉลี่ย) · ราคาขาย = ต้นทุน × (1 + markup)
 */
import type { RecipeLabor, RecipeMaterial, ServiceRecipe } from "./service-recipe";

// ---------------------------------------------------------------------------
// ตั้งค่า BOM ของบริษัท (ชีต "ตั้งค่า") — companies/{id}/settings/bom
// ---------------------------------------------------------------------------
export interface BomSettings {
  markup: number; vat: number;
  cableWaste: number; utpBoxM: number; flexSize: string; emtSize: string;
  emtLen: number; emtStrapSpacing: number; flexClipSpacing: number; emtElbowPerM: number; conduitEnds: number; patchPorts: number;
  fiberWaste: number; fiberCoilM: number; coresPerSnap: number;
  camBitrate: number; recordDays: number; hddTB: number; nvrCh: number; poePorts: number; camsPerPole: number;
  outletsPerCircuit: number; lightsPerCircuit: number; panelW: number; panelsPerString: number;
  hangerSpacing: number; trayElbowPerM: number; trayTeePerM: number;
  minMarkup: number;
}
export const DEFAULT_BOM_SETTINGS: BomSettings = {
  markup: 0.30, vat: 0.07,
  cableWaste: 0.10, utpBoxM: 305, flexSize: '3/4"', emtSize: '3/4"',
  emtLen: 3, emtStrapSpacing: 1.5, flexClipSpacing: 1, emtElbowPerM: 10, conduitEnds: 2, patchPorts: 24,
  fiberWaste: 0.05, fiberCoilM: 5, coresPerSnap: 12,
  camBitrate: 4, recordDays: 30, hddTB: 10, nvrCh: 32, poePorts: 22, camsPerPole: 2,
  outletsPerCircuit: 6, lightsPerCircuit: 10, panelW: 550, panelsPerString: 10,
  hangerSpacing: 1.5, trayElbowPerM: 15, trayTeePerM: 30,
  minMarkup: 0.30,
};
export type BomNumKey = { [K in keyof BomSettings]: BomSettings[K] extends number ? K : never }[keyof BomSettings];
export const PIPE_SIZES = ['1/2"', '3/4"', '1"'];
/** ชื่อและหน่วยของค่าตั้งค่า (หน้าตั้งค่า BOM) — % เก็บเป็นทศนิยม */
export const BOM_SETTING_FIELDS: { key: keyof BomSettings; label: string; unit: string; group: string; pct?: boolean; options?: string[] }[] = [
  { key: "markup", label: "กำไร (Markup) จากต้นทุน", unit: "%", group: "ราคาและภาษี", pct: true },
  { key: "minMarkup", label: "เตือนเมื่อ markup ต่ำกว่า", unit: "%", group: "ราคาและภาษี", pct: true },
  { key: "vat", label: "VAT", unit: "%", group: "ราคาและภาษี", pct: true },
  { key: "cableWaste", label: "เผื่อสายเสีย/สายเหลือ", unit: "%", group: "สาย LAN และท่อ", pct: true },
  { key: "utpBoxM", label: "ความยาวสาย UTP ต่อกล่อง", unit: "ม.", group: "สาย LAN และท่อ" },
  { key: "flexSize", label: "ขนาดท่อ Flex (ค่าเริ่มต้น)", unit: "", group: "สาย LAN และท่อ", options: PIPE_SIZES },
  { key: "emtSize", label: "ขนาดท่อ EMT (ค่าเริ่มต้น)", unit: "", group: "สาย LAN และท่อ", options: PIPE_SIZES },
  { key: "emtLen", label: "ความยาวท่อ EMT ต่อเส้น", unit: "ม.", group: "สาย LAN และท่อ" },
  { key: "emtStrapSpacing", label: "ระยะแคลมป์ยึดท่อ EMT", unit: "ม.", group: "สาย LAN และท่อ" },
  { key: "flexClipSpacing", label: "ระยะกิ๊ปจับท่อ Flex", unit: "ม.", group: "สาย LAN และท่อ" },
  { key: "emtElbowPerM", label: "ข้องอ 90° EMT 1 ตัว ต่อ", unit: "ม.", group: "สาย LAN และท่อ" },
  { key: "conduitEnds", label: "คอนเน็กเตอร์ต่อปลายท่อ", unit: "ตัว/เส้นทาง", group: "สาย LAN และท่อ" },
  { key: "patchPorts", label: "จำนวนพอร์ตต่อ Patch Panel", unit: "พอร์ต", group: "สาย LAN และท่อ" },
  { key: "fiberWaste", label: "เผื่อสายไฟเบอร์", unit: "%", group: "ไฟเบอร์", pct: true },
  { key: "fiberCoilM", label: "สายเผื่อม้วนเก็บต่อปลาย", unit: "ม.", group: "ไฟเบอร์" },
  { key: "coresPerSnap", label: "core ต่อ Snap-in/ถาดต่อสาย", unit: "core", group: "ไฟเบอร์" },
  { key: "camBitrate", label: "Bitrate ต่อกล้อง", unit: "Mbps", group: "กล้องวงจรปิด" },
  { key: "recordDays", label: "จำนวนวันบันทึก", unit: "วัน", group: "กล้องวงจรปิด" },
  { key: "hddTB", label: "ขนาด HDD", unit: "TB", group: "กล้องวงจรปิด" },
  { key: "nvrCh", label: "จำนวนช่อง NVR", unit: "ช่อง", group: "กล้องวงจรปิด" },
  { key: "poePorts", label: "พอร์ตใช้งานต่อ PoE Switch", unit: "พอร์ต", group: "กล้องวงจรปิด" },
  { key: "camsPerPole", label: "กล้องต่อเสา", unit: "ตัว", group: "กล้องวงจรปิด" },
  { key: "outletsPerCircuit", label: "เต้ารับต่อ 1 วงจร", unit: "จุด", group: "ไฟฟ้า" },
  { key: "lightsPerCircuit", label: "จุดไฟต่อ 1 วงจร", unit: "จุด", group: "ไฟฟ้า" },
  { key: "panelW", label: "วัตต์ต่อแผง", unit: "W", group: "โซลาร์" },
  { key: "panelsPerString", label: "แผงต่อ String", unit: "แผง", group: "โซลาร์" },
  { key: "hangerSpacing", label: "ระยะชุดแขวน/ขายึดราง", unit: "ม.", group: "รางและโครงสร้าง" },
  { key: "trayElbowPerM", label: "ข้องอราง 1 ตัว ต่อ", unit: "ม.", group: "รางและโครงสร้าง" },
  { key: "trayTeePerM", label: "สามทางราง 1 ตัว ต่อ", unit: "ม.", group: "รางและโครงสร้าง" },
];

export function normalizeBomSettings(raw: any): BomSettings {
  const out: any = { ...DEFAULT_BOM_SETTINGS };
  if (!raw || typeof raw !== "object") return out;
  for (const f of BOM_SETTING_FIELDS) {
    const v = raw[f.key];
    if (v === undefined || v === null || v === "") continue;
    if (f.options) { if (f.options.includes(String(v))) out[f.key] = String(v); continue; }
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= (f.pct ? 5 : 100000)) out[f.key] = n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// โครงสร้างสูตร
// ---------------------------------------------------------------------------
/** ตัวคูณของช่องกรอก: ค่า × k × (mul) ÷ (div) × (1 + plus1) */
export interface BomTerm { input: string; k?: number; mul?: BomNumKey; div?: BomNumKey; plus1?: BomNumKey }
export interface BomComp {
  /** รหัสราคากลาง หรือแม่แบบตามขนาด เช่น 'EMT-{emtSize}' */
  code: string;
  group?: string;
  /** ส่วนคงที่ต่อหน่วย: ตัวเลข · { setting } = ค่าตั้งค่า · { setting, inv: true } = 1 ÷ ค่าตั้งค่า */
  fixed?: number | { setting: BomNumKey; inv?: boolean };
  /** ใส่ส่วนคงที่เมื่อช่องกรอกนี้ > 0 */
  when?: string;
  terms?: BomTerm[];
  /** ปัดขึ้นที่ยอดรวมทั้งงาน (นับเป็นชิ้น) */
  roundJob?: boolean;
  /** ค่าแรง/บริการ (ไม่ตัดสต็อก) */
  labor?: boolean;
}
export interface BomInputDef { key: string; label: string; unit?: string; kind?: "number" | "size"; sizeSetting?: "flexSize" | "emtSize" }
export interface BomSpec { kind: string; variant?: string; inputs: BomInputDef[]; comps: BomComp[] }
export type BomInputs = Record<string, number | string>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** แทนที่ {key} ในแม่แบบรหัสด้วยค่าที่กรอก (ขนาด) หรือค่าตั้งค่า */
export function resolveCode(tpl: string, inputs: BomInputs, s: BomSettings): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(inputs[k] ?? (s as any)[k] ?? ""));
}

/** จำนวนต่อ 1 หน่วยงาน (ไม่ปัด) */
export function compQty(c: BomComp, inputs: BomInputs, s: BomSettings): number {
  let q = 0;
  const cond = !c.when || num(inputs[c.when]) > 0;
  if (cond && c.fixed !== undefined) {
    if (typeof c.fixed === "number") q += c.fixed;
    else { const v = num((s as any)[c.fixed.setting]); q += c.fixed.inv ? (v > 0 ? 1 / v : 0) : v; }
  }
  for (const t of c.terms || []) {
    let f = t.k ?? 1;
    if (t.mul) f *= num((s as any)[t.mul]);
    if (t.div) { const d = num((s as any)[t.div]); f = d > 0 ? f / d : 0; }
    if (t.plus1) f *= 1 + num((s as any)[t.plus1]);
    q += f * num(inputs[t.input]);
  }
  return q;
}

export interface ResolvedItem { productId: string; sku?: string; name: string; unit?: string; cost: number; status?: string }
/** รหัสราคากลาง → สินค้า (จาก bomCode) */
export type CodeResolver = (code: string) => ResolvedItem | null;

export interface BomLineItem { code: string; productId: string; name: string; unit: string; qtyPerUnit: number; unitCost: number; costPerUnit: number; labor: boolean; roundJob: boolean; group: string; status?: string; missing?: boolean }

/** แตกสูตร BOM ของ 1 บรรทัด (ต่อ 1 หน่วยงาน) พร้อมต้นทุน */
export function expandBom(spec: BomSpec, inputs: BomInputs, s: BomSettings, resolve: CodeResolver): { items: BomLineItem[]; costPerUnit: number; missing: string[] } {
  const items: BomLineItem[] = [];
  const missing: string[] = [];
  for (const c of spec.comps) {
    const q = compQty(c, inputs, s);
    if (!(q > 0)) continue;
    const code = resolveCode(c.code, inputs, s);
    const p = resolve(code);
    if (!p) missing.push(code);
    const unitCost = p?.cost || 0;
    items.push({ code, productId: p?.productId || "", name: p?.name || code, unit: p?.unit || "", qtyPerUnit: q, unitCost, costPerUnit: q * unitCost, labor: !!c.labor, roundJob: !!c.roundJob, group: c.group || "", status: p?.status, ...(p ? {} : { missing: true }) });
  }
  return { items, costPerUnit: items.reduce((t, i) => t + i.costPerUnit, 0), missing };
}

/** สูตรงานบริการธรรมดา (วัสดุ + ค่าแรงต่อหน่วย) จากผลแตก BOM — ใช้กับระบบเดิม (ตัดวัสดุ แจ้งเตือนราคา เอกสารลูกค้า) */
export function bomToRecipe(spec: BomSpec, items: BomLineItem[], unit = "จุด"): ServiceRecipe {
  const materials: RecipeMaterial[] = items.filter((i) => !i.labor && i.productId).map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, qty: r6(i.qtyPerUnit), cost: r2(i.unitCost) }));
  const labors: RecipeLabor[] = items.filter((i) => i.labor).map((i) => ({ ...(i.productId ? { productId: i.productId } : {}), name: i.name, unit: i.unit || unit, qty: r6(i.qtyPerUnit), rate: i.unitCost }));
  return { unit, laborCost: r2(labors.reduce((t, l) => t + l.qty * l.rate, 0)), ...(labors.length ? { labors } : {}), materials, bom: spec } as ServiceRecipe;
}

// ---------------------------------------------------------------------------
// BOM ทั้งงาน (หลายบรรทัด): รวมตามรหัส แล้วปัดขึ้นเฉพาะรายการนับชิ้น
// ---------------------------------------------------------------------------
export interface JobLine { units: number; items: BomLineItem[] }
export interface JobBomRow { code: string; productId: string; name: string; unit: string; qty: number; rawQty: number; unitCost: number; cost: number; labor: boolean; group: string; status?: string; missing?: boolean }
export function jobBom(lines: JobLine[]): { rows: JobBomRow[]; cost: number; unroundedCost: number } {
  const map = new Map<string, JobBomRow & { roundJob: boolean }>();
  for (const l of lines) for (const i of l.items) {
    const cur = map.get(i.code);
    const add = i.qtyPerUnit * num(l.units);
    if (cur) cur.rawQty += add;
    else map.set(i.code, { code: i.code, productId: i.productId, name: i.name, unit: i.unit, qty: 0, rawQty: add, unitCost: i.unitCost, cost: 0, labor: i.labor, group: i.group, status: i.status, roundJob: i.roundJob, ...(i.missing ? { missing: true } : {}) });
  }
  const rows = [...map.values()].map(({ roundJob, ...r }) => {
    const qty = roundJob ? Math.ceil(r.rawQty - 1e-9) : r2(r.rawQty);
    return { ...r, qty, cost: r2(qty * r.unitCost) };
  });
  return { rows, cost: r2(rows.reduce((t, r) => t + r.cost, 0)), unroundedCost: r2(rows.reduce((t, r) => t + r.rawQty * r.unitCost, 0)) };
}

export const salePrice = (cost: number, markup: number) => cost * (1 + markup);
/** markup จริงของราคาที่ปรับเอง (null = ไม่มีต้นทุน) */
export const markupOf = (price: number, cost: number): number | null => (cost > 0 ? price / cost - 1 : null);

// ---------------------------------------------------------------------------
// LAN 3 รูปแบบ (ชีต "สูตรต่อจุด")
// ---------------------------------------------------------------------------
export const LAN_INPUTS: BomInputDef[] = [
  { key: "routeM", label: "ระยะสายเฉลี่ย/จุด", unit: "ม." },
  { key: "flexM", label: "ท่อ Flex/จุด", unit: "ม." },
  { key: "emtM", label: "ท่อ EMT/จุด", unit: "ม." },
  { key: "flexSize", label: "ขนาดท่อ Flex", kind: "size", sizeSetting: "flexSize" },
  { key: "emtSize", label: "ขนาดท่อ EMT", kind: "size", sizeSetting: "emtSize" },
];
type LanVariant = "PB" | "PLUG2" | "PPLUG";
/** [รหัส, กลุ่ม, คงที่ PB, PLUG2, PPLUG, ตัวคูณ, เงื่อนไข, ปัดขึ้นทั้งงาน, ค่าแรง] */
const PP = { setting: "patchPorts" as const, inv: true };
const ENDS = { setting: "conduitEnds" as const };
const LAN_TABLE: [string, string, BomComp["fixed"], BomComp["fixed"], BomComp["fixed"], BomTerm[], string | undefined, boolean, boolean][] = [
  ["UTP-CAT6", "สาย", 0, 0, 0, [{ input: "routeM", plus1: "cableWaste" }], undefined, false, false],
  ["RJ45-PLUG", "ปลายสาย", 0, 2, 1, [], undefined, true, false],
  ["RJ45-BOOT", "ปลายสาย", 0, 2, 1, [], undefined, true, false],
  ["JACK-CAT6", "ปลายทาง", 1, 0, 0, [], undefined, true, false],
  ["BOX-2x4", "ปลายทาง", 1, 0, 0, [], undefined, true, false],
  ["FP-1P", "ปลายทาง", 1, 0, 0, [], undefined, true, false],
  ["PC-2M", "ปลายทาง", 1, 0, 0, [], undefined, true, false],
  ["PP-24", "ต้นทาง", PP, 0, PP, [], undefined, true, false],
  ["PC-1M", "ต้นทาง", 1, 0, 1, [], undefined, true, false],
  ["FLEX-{flexSize}", "ท่อ Flex", 0, 0, 0, [{ input: "flexM" }], undefined, false, false],
  ["FLEXCON-{flexSize}", "ท่อ Flex", ENDS, ENDS, ENDS, [], "flexM", true, false],
  ["FLEXCLIP-{flexSize}", "ท่อ Flex", 0, 0, 0, [{ input: "flexM", div: "flexClipSpacing" }], undefined, true, false],
  ["EMT-{emtSize}", "ท่อ EMT", 0, 0, 0, [{ input: "emtM" }], undefined, false, false],
  ["EMTCOUP-{emtSize}", "ท่อ EMT", 0, 0, 0, [{ input: "emtM", div: "emtLen" }], undefined, true, false],
  ["EMTCON-{emtSize}", "ท่อ EMT", ENDS, ENDS, ENDS, [], "emtM", true, false],
  ["EMTSTRAP-{emtSize}", "ท่อ EMT", 0, 0, 0, [{ input: "emtM", div: "emtStrapSpacing" }], undefined, true, false],
  ["EMTELB-{emtSize}", "ท่อ EMT", 0, 0, 0, [{ input: "emtM", div: "emtElbowPerM" }], undefined, true, false],
  ["ANCHOR", "สิ้นเปลือง", 0, 0, 0, [{ input: "flexM", div: "flexClipSpacing" }, { input: "emtM", div: "emtStrapSpacing" }], undefined, true, false],
  ["CONSUM", "สิ้นเปลือง", 1, 1, 1, [], undefined, true, false],
  ["LABEL", "สิ้นเปลือง", 2, 2, 2, [], undefined, true, false],
  ["LAB-UTP", "ค่าแรง", 1, 1, 1, [], undefined, false, true],
  ["LAB-FLEX-{flexSize}", "ค่าแรง", 0, 0, 0, [{ input: "flexM" }], undefined, false, true],
  ["LAB-EMT-{emtSize}", "ค่าแรง", 0, 0, 0, [{ input: "emtM" }], undefined, false, true],
  ["TEST", "ทดสอบ", 1, 1, 1, [], undefined, false, true],
];
export function lanBomSpec(variant: LanVariant): BomSpec {
  const col = variant === "PB" ? 2 : variant === "PLUG2" ? 3 : 4;
  return {
    kind: "LAN", variant, inputs: LAN_INPUTS,
    comps: LAN_TABLE.map((r): BomComp => {
      const fixed = r[col] as BomComp["fixed"];
      const hasFixed = typeof fixed === "number" ? fixed > 0 : !!fixed;
      return { code: r[0], group: r[1], ...(hasFixed ? { fixed } : {}), ...(r[6] ? { when: r[6] } : {}), ...(r[5].length ? { terms: r[5] } : {}), ...(r[7] ? { roundJob: true } : {}), ...(r[8] ? { labor: true } : {}) };
    }).filter((c) => c.fixed !== undefined || !!c.terms?.length),
  };
}
/** รหัสราคากลางทั้งหมดที่สูตร LAN ใช้ (ตามขนาดท่อทุกขนาด) */
export const LAN_CODES = Array.from(new Set(LAN_TABLE.flatMap((r) => (r[0].includes("{") ? PIPE_SIZES.map((sz) => r[0].replace(/\{\w+\}/, sz)) : [r[0]]))));

/** ค่าเริ่มต้นของช่องกรอก (ขนาดท่อจากตั้งค่า) */
export function defaultInputs(spec: BomSpec, s: BomSettings): BomInputs {
  const out: BomInputs = {};
  for (const d of spec.inputs) out[d.key] = d.kind === "size" ? String((s as any)[d.sizeSetting || d.key] || "") : 0;
  return out;
}

// ---------------------------------------------------------------------------
// ทำความสะอาดสูตร BOM ที่รับจากเอกสาร/หน้าจอ
// ---------------------------------------------------------------------------
const SKEYS = new Set(BOM_SETTING_FIELDS.filter((f) => !f.options).map((f) => f.key as string));
export function normalizeBomSpec(raw: any): BomSpec | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.comps)) return null;
  const str = (v: any, m = 60) => String(v ?? "").trim().slice(0, m);
  const sk = (v: any) => (SKEYS.has(String(v)) ? (String(v) as BomNumKey) : undefined);
  const inputs: BomInputDef[] = (Array.isArray(raw.inputs) ? raw.inputs : []).slice(0, 12).map((d: any) => ({
    key: str(d?.key, 30), label: str(d?.label, 80), ...(d?.unit ? { unit: str(d.unit, 10) } : {}),
    ...(d?.kind === "size" ? { kind: "size" as const, sizeSetting: d?.sizeSetting === "emtSize" ? "emtSize" as const : "flexSize" as const } : {}),
  })).filter((d: BomInputDef) => /^\w+$/.test(d.key));
  const comps: BomComp[] = raw.comps.slice(0, 80).map((c: any) => {
    const fixed = typeof c?.fixed === "number" ? Math.max(0, num(c.fixed)) : c?.fixed && sk(c.fixed.setting) ? { setting: sk(c.fixed.setting)!, ...(c.fixed.inv ? { inv: true } : {}) } : undefined;
    const terms: BomTerm[] = (Array.isArray(c?.terms) ? c.terms : []).slice(0, 4).map((t: any) => ({
      input: str(t?.input, 30), ...(t?.k !== undefined ? { k: num(t.k) } : {}), ...(sk(t?.mul) ? { mul: sk(t.mul) } : {}), ...(sk(t?.div) ? { div: sk(t.div) } : {}), ...(sk(t?.plus1) ? { plus1: sk(t.plus1) } : {}),
    })).filter((t: BomTerm) => /^\w+$/.test(t.input));
    return { code: str(c?.code, 60), ...(c?.group ? { group: str(c.group, 40) } : {}), ...(fixed !== undefined ? { fixed } : {}), ...(c?.when && /^\w+$/.test(String(c.when)) ? { when: String(c.when) } : {}), ...(terms.length ? { terms } : {}), ...(c?.roundJob ? { roundJob: true } : {}), ...(c?.labor ? { labor: true } : {}) };
  }).filter((c: BomComp) => c.code && /^[\w\-./"{}]+$/.test(c.code));
  if (!comps.length) return null;
  return { kind: str(raw.kind, 30) || "CUSTOM", ...(raw.variant ? { variant: str(raw.variant, 30) } : {}), inputs, comps };
}
