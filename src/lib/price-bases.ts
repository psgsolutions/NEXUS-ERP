/**
 * ฐานราคาขาย (ใช้ทั้ง server และหน้าจอ) — ราคาแนะนำ = ฐาน × (1 + markup) แล้วผู้ขายแก้ได้เสมอ
 * GP% "จริง" คิดจากต้นทุนจริงของ Lot ที่จะถูกตัดแบบเข้าก่อนออกก่อน (FIFO) สำหรับจำนวนที่ขาย
 *
 * ฐาน: lotsAvg (เฉลี่ยจาก Lot ที่หยิบ — ค่าตั้งต้น) · lotsNew (Lot ใหม่สุด) · lotsOld (Lot เก่าสุด) · lotsMax (สูงสุดใน Lot ที่หยิบ)
 *      lastPurchase (ราคาซื้อล่าสุด แม้ไม่มีของ) · list (ราคาตั้ง) · lastSold (ราคาล่าสุดที่ขายลูกค้ารายนี้) · targetGp (ต้นทุน ÷ (1 − GP%))
 */
export type PriceBaseKey = "lotsAvg" | "lotsNew" | "lotsOld" | "lotsMax" | "lastPurchase" | "list" | "lastSold" | "targetGp";
export const PRICE_BASES: { key: PriceBaseKey; label: string; hint: string; costBased: boolean }[] = [
  { key: "lotsAvg", label: "เฉลี่ยจาก Lot ที่หยิบ", hint: "กำไรตรงกับ markup พอดี (ค่าตั้งต้น)", costBased: true },
  { key: "lotsNew", label: "ราคา Lot ใหม่ทั้งหมด", hint: "ราคาตลาดขึ้น ให้สะท้อนต้นทุนเติมของ", costBased: true },
  { key: "lotsOld", label: "ราคา Lot เก่าทั้งหมด", hint: "ลูกค้าประจำ / ราคาที่เคยเสนอ", costBased: true },
  { key: "lotsMax", label: "ราคาสูงสุดใน Lot ที่หยิบ", hint: "กันกำไรหดเมื่อราคาผันผวน", costBased: true },
  { key: "lastPurchase", label: "ราคาซื้อล่าสุด", hint: "ขายของที่ต้องสั่งเติม", costBased: true },
  { key: "list", label: "ราคาตั้งในทะเบียน", hint: "ราคามาตรฐาน", costBased: false },
  { key: "lastSold", label: "ราคาล่าสุดที่ขายลูกค้ารายนี้", hint: "ลูกค้าประจำ ราคาคงที่", costBased: false },
  { key: "targetGp", label: "กำหนด GP% เป้าหมาย", hint: "งานโปรเจกต์ที่คุมกำไรเป็น %", costBased: false },
];

export interface MarkupRule { type: "category" | "brand"; key: string; markupPct: number }
export interface PricingSettings { defaultMarkupPct: number; targetGpPct: number; defaultBase: PriceBaseKey; rules: MarkupRule[] }
export const DEFAULT_PRICING: PricingSettings = { defaultMarkupPct: 25, targetGpPct: 20, defaultBase: "lotsAvg", rules: [] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function normalizePricing(raw: any): PricingSettings {
  const base = PRICE_BASES.some((b) => b.key === raw?.defaultBase) ? raw.defaultBase : DEFAULT_PRICING.defaultBase;
  const pct = (v: any, d: number, max: number) => (v === undefined || v === null || v === "" ? d : Math.min(max, Math.max(0, r2(num(v)))));
  const rules: MarkupRule[] = (Array.isArray(raw?.rules) ? raw.rules : []).slice(0, 200)
    .map((r: any) => ({ type: r?.type === "brand" ? "brand" as const : "category" as const, key: String(r?.key || "").trim().slice(0, 60), markupPct: pct(r?.markupPct, 0, 1000) }))
    .filter((r: MarkupRule) => r.key);
  return { defaultMarkupPct: pct(raw?.defaultMarkupPct, DEFAULT_PRICING.defaultMarkupPct, 1000), targetGpPct: pct(raw?.targetGpPct, DEFAULT_PRICING.targetGpPct, 95), defaultBase: base, rules };
}

/** markup ของสินค้า: กฎยี่ห้อก่อน แล้วหมวด แล้วค่าตั้งต้น (เทียบแบบไม่สนตัวพิมพ์) */
export function markupFor(p: { brand?: string; category?: string }, s: PricingSettings): { pct: number; source: string } {
  const eq = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const brand = s.rules.find((r) => r.type === "brand" && eq(r.key, p.brand));
  if (brand) return { pct: brand.markupPct, source: `ยี่ห้อ ${brand.key}` };
  const cat = s.rules.find((r) => r.type === "category" && eq(r.key, p.category));
  if (cat) return { pct: cat.markupPct, source: `หมวด ${cat.key}` };
  return { pct: s.defaultMarkupPct, source: "ค่าตั้งต้น" };
}

export interface BaseInputs {
  /** ต้นทุนของ Lot ที่จะถูกตัดแบบ FIFO สำหรับจำนวนที่ขาย (รวม) และราคาต่อหน่วยของแต่ละ Lot ที่หยิบ */
  fifoCost: number | null; pickedUnitCosts: number[];
  newestLotCost: number | null; oldestLotCost: number | null; lastPurchaseCost: number | null;
  listPrice: number | null; lastSoldPrice: number | null; qty: number;
}
export interface BaseSuggestion { key: PriceBaseKey; label: string; hint: string; base: number | null; price: number | null; gpPct: number | null; available: boolean }

/** GP% จริงของราคาขายต่อหน่วย เทียบต้นทุนจริงต่อหน่วย */
export const realGp = (price: number, unitCost: number | null) => (unitCost === null || !(price > 0) ? null : r2(((price - unitCost) / price) * 100));

export function priceSuggestions(inp: BaseInputs, markupPct: number, targetGpPct: number): BaseSuggestion[] {
  const qty = Math.max(1, num(inp.qty));
  const avg = inp.fifoCost !== null ? inp.fifoCost / qty : null;
  const max = inp.pickedUnitCosts.length ? Math.max(...inp.pickedUnitCosts) : null;
  const m = 1 + markupPct / 100;
  const baseOf: Record<PriceBaseKey, number | null> = {
    lotsAvg: avg, lotsNew: inp.newestLotCost, lotsOld: inp.oldestLotCost, lotsMax: max, lastPurchase: inp.lastPurchaseCost,
    list: inp.listPrice, lastSold: inp.lastSoldPrice, targetGp: avg ?? inp.lastPurchaseCost,
  };
  return PRICE_BASES.map((b) => {
    const base = baseOf[b.key];
    const ok = base !== null && base > 0;
    const price = !ok ? null : b.key === "targetGp" ? r2(base! / (1 - Math.min(95, targetGpPct) / 100)) : b.costBased ? r2(base! * m) : r2(base!);
    return { key: b.key, label: b.key === "targetGp" ? `GP เป้าหมาย ${targetGpPct}%` : b.label, hint: b.hint, base: ok ? r2(base!) : null, price, gpPct: price === null ? null : realGp(price, avg ?? inp.lastPurchaseCost), available: ok };
  });
}
