/**
 * BOM ในใบเสนอราคา (เฟส 3 ตาม HANDOFF_Nexus_BOM_module.md)
 *  - กรอกระยะ/ขนาดท่อต่อบรรทัด → แตกสูตรใหม่ ต้นทุน/ราคาต่อจุดเปลี่ยนทันที (ราคาที่ปรับเองไม่ถูกทับ)
 *  - BOM รวมทั้งใบ: รวมตามรหัส ปัดขึ้นเฉพาะรายการนับชิ้น + ส่วนต่างจากการปัด (บรรทัดเหมาต่องาน)
 *  - เตือน: ราคาต่อจุดต่ำกว่า markup ตั้งค่า (30%) · มีราคาประมาณการ (Y) · ไม่พบราคากลาง
 *  - สินค้ากลาง (ราคากลาง ไม่ระบุยี่ห้อ) → รุ่นที่ซื้อจริง (realModels) สำหรับขอซื้อ/ตัดสต็อก
 *  - ค่าแรงกลาง (LAB-…) ↔ อัตราของช่างแต่ละคน (laborCode) เทียบต้นทุนจริงกับที่เสนอ
 */
import { bomToRecipe, defaultInputs, expandBom, jobBom, markupOf, salePrice, type BomInputs, type BomLineItem, type BomSettings, type BomSpec, type CodeResolver, type JobBomRow } from "./bom";
import { normalizeRecipe, type ServiceRecipe } from "./service-recipe";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** บรรทัดเอกสารที่เป็นงานบริการแบบสูตร BOM มีตัวแปร */
export const lineSpec = (item: any): BomSpec | null => (item?.itemType !== "GROUP_HEADER" && item?.recipe?.bom ? (item.recipe.bom as BomSpec) : null);

/** ค่าที่กรอกของบรรทัด: ค่าเริ่มต้นของสูตร ← ค่าที่บันทึกไว้ที่งานบริการ ← ค่าที่กรอกในบรรทัดนี้ */
export function lineInputs(item: any, s: BomSettings): BomInputs {
  const spec = lineSpec(item);
  if (!spec) return {};
  return { ...defaultInputs(spec, s), ...(item.recipe?.bomInputs || {}), ...(item.bomInputs || {}) };
}

/** แตกสูตรของบรรทัด (ต่อ 1 หน่วยงาน) */
export function lineBom(item: any, s: BomSettings, resolve: CodeResolver) {
  const spec = lineSpec(item);
  if (!spec) return null;
  const inputs = lineInputs(item, s);
  return { spec, inputs, ...expandBom(spec, inputs, s, resolve) };
}

/**
 * ค่าที่ต้องแก้ในบรรทัดเมื่อกรอกระยะใหม่ (หรือราคากลางเปลี่ยน): ค่าที่กรอก สำเนาสูตรที่แตกแล้ว (ใช้ตัดวัสดุตอนเบิก) ต้นทุนต่อหน่วย
 * ราคาขายตาม markup เฉพาะบรรทัดที่ยังไม่ได้ปรับราคาเอง (priceManual)
 */
export function applyLineInputs(item: any, inputs: BomInputs, s: BomSettings, resolve: CodeResolver): Record<string, any> {
  const spec = lineSpec(item);
  if (!spec) return {};
  const res = expandBom(spec, inputs, s, resolve);
  const recipe: ServiceRecipe = { ...bomToRecipe(spec, res.items, item.recipe?.unit || item.unit || "จุด"), bomInputs: inputs };
  const cost = r2(res.costPerUnit);
  return {
    bomInputs: inputs, recipe: normalizeRecipe(recipe) || recipe, cost, costPrice: cost,
    ...(item.priceManual ? {} : { price: r2(salePrice(res.costPerUnit, s.markup)) }),
  };
}

/** ราคาตาม markup ของบรรทัด (ใช้ปุ่ม "คืนราคาตามสูตร") */
export function linePriceByMarkup(item: any, s: BomSettings, resolve: CodeResolver): number {
  const b = lineBom(item, s, resolve);
  return b ? r2(salePrice(b.costPerUnit, s.markup)) : num(item?.price);
}

// ---------------------------------------------------------------------------
// เตือนในบรรทัด/ทั้งใบ
// ---------------------------------------------------------------------------
export type BomWarnKind = "lowMarkup" | "estimated" | "missing";
export interface BomWarning { kind: BomWarnKind; itemId: any; name: string; text: string; markup?: number | null; codes?: string[] }

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** ราคาต่อหน่วยหลังส่วนลดของบรรทัด (ใช้เทียบ markup) */
export function netUnitPrice(item: any): number {
  const qty = num(item?.qty) || 1, price = num(item?.price), disc = num(item?.discountValue);
  const lineDisc = item?.discountType === "PERCENT" ? price * qty * (disc / 100) : disc;
  return Math.max(0, price - lineDisc / qty);
}

export function lineWarnings(item: any, s: BomSettings, resolve: CodeResolver): BomWarning[] {
  const b = lineBom(item, s, resolve);
  if (!b) return [];
  const out: BomWarning[] = [];
  const name = String(item.name || "");
  if (b.missing.length) out.push({ kind: "missing", itemId: item.id, name, codes: b.missing, text: `ไม่พบราคากลาง ${b.missing.join(", ")} (ต้นทุนต่ำกว่าจริง)` });
  const est = b.items.filter((i) => i.status === "Y").map((i) => i.code);
  if (est.length) out.push({ kind: "estimated", itemId: item.id, name, codes: est, text: `มีราคาประมาณการ (ต้องยืนยัน) ${est.join(", ")}` });
  const m = markupOf(netUnitPrice(item), b.costPerUnit);
  // เกณฑ์เตือน = "เตือนเมื่อ markup ต่ำกว่า" ในตั้งค่า BOM · เผื่อปัดเศษสตางค์: ราคาที่ตั้งตามเกณฑ์พอดี ไม่ถือว่าต่ำ
  const floor = Number.isFinite(s.minMarkup) ? s.minMarkup : s.markup;
  if (m !== null && m < floor - 0.0005) out.push({ kind: "lowMarkup", itemId: item.id, name, markup: m, text: `กำไร (markup) ${pct(m)} ต่ำกว่าเกณฑ์ ${pct(floor)}` });
  return out;
}

// ---------------------------------------------------------------------------
// BOM รวมทั้งใบ
// ---------------------------------------------------------------------------
export interface QuoteBom {
  rows: JobBomRow[];
  /** ต้นทุนวัสดุ+ค่าแรงหลังปัดขึ้นทั้งงาน */
  cost: number;
  /** ต้นทุนรวมของบรรทัด (ต้นทุนต่อจุด × จำนวน ก่อนปัด) */
  lineCost: number;
  /** ส่วนต่างจากการปัดเศษ (ควรเพิ่มเป็นบรรทัดเหมาต่องาน) */
  roundingDiff: number;
  /** ราคาขายรวมของบรรทัด BOM (หลังส่วนลด) */
  sale: number;
  lines: { itemId: any; name: string; qty: number; costPerUnit: number; items: BomLineItem[] }[];
  warnings: BomWarning[];
}

export function quoteBom(items: any[], s: BomSettings, resolve: CodeResolver): QuoteBom {
  const lines: QuoteBom["lines"] = [];
  const warnings: BomWarning[] = [];
  let sale = 0;
  for (const it of items || []) {
    const b = lineBom(it, s, resolve);
    if (!b) continue;
    const qty = num(it.qty);
    if (!(qty > 0)) continue;
    lines.push({ itemId: it.id, name: String(it.name || ""), qty, costPerUnit: b.costPerUnit, items: b.items });
    sale += netUnitPrice(it) * qty;
    warnings.push(...lineWarnings(it, s, resolve));
  }
  const job = jobBom(lines.map((l) => ({ units: l.qty, items: l.items })));
  return { rows: job.rows, cost: job.cost, lineCost: job.unroundedCost, roundingDiff: r2(job.cost - job.unroundedCost), sale: r2(sale), lines, warnings };
}

/** บรรทัดเหมาต่องานสำหรับส่วนต่างจากการปัดเศษ (ราคาขาย = ต้นทุน × (1 + markup)) */
export const ROUNDING_LINE_NAME = "วัสดุส่วนเพิ่มจากการปัดเศษทั้งงาน (เหมา)";
export function roundingLine(diff: number, s: BomSettings) {
  const cost = r2(Math.max(0, diff));
  return { name: ROUNDING_LINE_NAME, qty: 1, unit: "งาน", cost, costPrice: cost, price: r2(salePrice(cost, s.markup)), itemType: "PRODUCT", whtRate: 0, discountType: "PERCENT", discountValue: 0, bomRounding: true };
}

// ---------------------------------------------------------------------------
// สินค้ากลาง → รุ่นที่ซื้อจริง
// ---------------------------------------------------------------------------
/** per = จำนวนหน่วยของสินค้ากลางใน 1 หน่วยของรุ่นจริง (เช่น สายกลางหน่วย ม. · รุ่นจริงขายเป็นกล่อง 305 ม. → 305) */
export interface RealModel { productId: string; primary?: boolean; per?: number }

export function normalizeRealModels(raw: unknown, selfId?: string): RealModel[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list = raw.slice(0, 20).map((m: any) => ({ productId: String(m?.productId ?? "").trim().slice(0, 120), primary: !!m?.primary, per: num(m?.per) > 0 ? Math.round(num(m.per) * 10000) / 10000 : 1 }))
    .filter((m) => m.productId && m.productId !== selfId && !m.productId.includes("/") && !seen.has(m.productId) && (seen.add(m.productId), true));
  // รุ่นหลักมีได้รุ่นเดียว (ไม่ได้เลือก = รุ่นแรก)
  const pi = Math.max(0, list.findIndex((m) => m.primary));
  return list.map((m, i) => ({ productId: m.productId, ...(i === pi ? { primary: true } : {}), ...(m.per !== 1 ? { per: m.per } : {}) }));
}

export const primaryModel = (p: any): RealModel | null => {
  const list = normalizeRealModels(p?.realModels, p?.id);
  return list.find((m) => m.primary) || null;
};

export interface PurchaseRow { code: string; genericId: string; genericName: string; genericQty: number; genericUnit: string; productId: string; sku: string; name: string; unit: string; qty: number; unitCost: number; mapped: boolean; missing?: boolean }

/**
 * รายการขอซื้อจาก BOM ทั้งใบ (ไม่รวมค่าแรง): แปลงสินค้ากลางเป็นรุ่นหลักที่ซื้อจริง ปัดขึ้นตามหน่วยซื้อ
 * ยังไม่ผูกรุ่น = ซื้อตามสินค้ากลาง (mapped=false ให้หน้าจอเตือน) · รุ่นเดียวกันจากหลายรหัสรวมเป็นบรรทัดเดียว
 */
export function purchaseRows(rows: JobBomRow[], byId: Map<string, any>): PurchaseRow[] {
  const out = new Map<string, PurchaseRow>();
  for (const r of rows) {
    if (r.labor || !(r.qty > 0)) continue;
    const g = byId.get(r.productId);
    const pm = g ? primaryModel(g) : null;
    const real = pm ? byId.get(pm.productId) : null;
    const key = real ? real.id : r.productId || r.code;
    const per = pm?.per || 1;
    const qtyIn = real ? r.qty / per : r.qty;
    // ต้นทุนประมาณการต่อหน่วยซื้อ: ต้นทุนจริงของรุ่นที่ซื้อ ถ้ายังไม่มี = ราคากลาง × จำนวนต่อหน่วยซื้อ
    const realCost = real ? num(real.pricing?.costWAC ?? real.costPrice ?? real.cost) : 0;
    const unitCost = r2(real ? (realCost > 0 ? realCost : num(r.unitCost) * per) : num(r.unitCost));
    const cur = out.get(key);
    if (cur) { cur.qty += qtyIn; cur.genericQty += r.qty; continue; }
    out.set(key, {
      code: r.code, genericId: r.productId, genericName: r.name, genericQty: r.qty, genericUnit: r.unit,
      productId: real?.id || r.productId, sku: String(real?.sku || g?.sku || ""), name: real?.name || r.name, unit: real?.unit || r.unit, qty: qtyIn, unitCost, mapped: !!real, ...(r.missing ? { missing: true } : {}),
    });
  }
  return [...out.values()].map((p) => ({ ...p, qty: p.mapped ? Math.ceil(p.qty - 1e-9) : r2(p.qty) }));
}

/** บรรทัดใบขอซื้อ (PR) จากรายการที่ต้องซื้อ — ราคา = ต้นทุนประมาณการ ให้ฝ่ายจัดซื้อแก้ได้ */
export function prDraftLines(buy: PurchaseRow[]): Record<string, any>[] {
  const base = Date.now();
  return buy.filter((b) => b.qty > 0).map((b, i) => ({
    id: base + i, productId: b.productId || null, sku: b.sku, name: b.name, qty: b.qty, unit: b.unit, price: b.unitCost, cost: b.unitCost,
    itemType: "PRODUCT", discountType: "PERCENT", discountValue: 0, whtRate: 0,
    details: b.mapped ? `ตาม BOM: ${b.genericName} ${r2(b.genericQty)} ${b.genericUnit}` : "ยังไม่ผูกรุ่นที่ซื้อจริง (ซื้อตามสินค้ากลาง)",
  }));
}

// ---------------------------------------------------------------------------
// ค่าแรงกลาง (LAB-…) ↔ อัตราของช่าง
// ---------------------------------------------------------------------------
export interface CrewRate { productId: string; contractorId: string; contractorName: string; rate: number; unit: string }
export interface LaborCompareRow { code: string; name: string; qty: number; unit: string; quotedRate: number; quotedCost: number; crews: (CrewRate & { cost: number; diff: number })[] }

/** อัตราช่างที่ผูกรหัสค่าแรงกลาง (product.laborCode) — สินค้าค่าแรงของช่าง = งานบริการที่มี subcontractorId */
export function crewRatesByCode(products: any[]): Map<string, CrewRate[]> {
  const m = new Map<string, CrewRate[]>();
  for (const p of products || []) {
    const code = String(p?.laborCode || "").trim();
    if (!code || p.isDeleted === true || p.isActive === false) continue;
    const rate = num(p.costPrice ?? p.cost ?? p.pricing?.costWAC);
    if (!(rate > 0)) continue;
    const list = m.get(code) || [];
    list.push({ productId: p.id, contractorId: String(p.subcontractorId || ""), contractorName: String(p.subcontractorName || ""), rate, unit: String(p.unit || "") });
    m.set(code, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.rate - b.rate);
  return m;
}

/** เทียบค่าแรงที่เสนอ (ราคากลาง) กับอัตราช่างแต่ละคน — diff > 0 = จ้างช่างนี้แพงกว่าที่เสนอ */
export function laborCompare(rows: JobBomRow[], crews: Map<string, CrewRate[]>): LaborCompareRow[] {
  return rows.filter((r) => r.labor && r.qty > 0).map((r) => {
    const quotedCost = r2(r.qty * r.unitCost);
    return {
      code: r.code, name: r.name, qty: r.qty, unit: r.unit, quotedRate: r.unitCost, quotedCost,
      crews: (crews.get(r.code) || []).map((c) => { const cost = r2(c.rate * r.qty); return { ...c, cost, diff: r2(cost - quotedCost) }; }),
    };
  });
}
