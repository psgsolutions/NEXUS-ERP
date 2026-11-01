/**
 * ตรรกะของฟอร์มเพิ่มสินค้าใหม่ (แยกจาก UI เพื่อทดสอบได้)
 *  - เตือนสินค้าที่อาจซ้ำขณะพิมพ์ (ชื่อ/MPN/รหัสผู้ขาย/ยี่ห้อ+รุ่น)
 *  - กำไรขั้นต้นเทียบเกณฑ์ GP ของบริษัท
 *  - สร้างจากสินค้าเดิม และค่าที่คงไว้เมื่อ "บันทึกและเพิ่มตัวถัดไป"
 */

export interface SimilarProduct { id: string; name: string; sku: string; reason: string }

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[\s\-_/.,()]+/g, " ").trim();
const bigrams = (v: unknown) => {
  const s = norm(v).replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
};

/**
 * ความคล้ายของชื่อ 0–1 (Dice ของคู่ตัวอักษร) — ใช้ได้กับภาษาไทยที่ไม่เว้นวรรค
 * ชื่อที่สลับคำ เติมคำ หรือพิมพ์ต่างกันเล็กน้อยยังจับได้
 */
export function nameSimilarity(a: string, b: string): number {
  const ga = bigrams(a), gb = bigrams(b);
  if (!ga.length || !gb.length) return 0;
  const pool = new Map<string, number>();
  for (const g of gb) pool.set(g, (pool.get(g) || 0) + 1);
  let hit = 0;
  for (const g of ga) { const n = pool.get(g) || 0; if (n) { hit++; pool.set(g, n - 1); } }
  return (2 * hit) / (ga.length + gb.length);
}

const mpnsOf = (p: Record<string, any>) =>
  [p.mpn, ...(Array.isArray(p.supplierConfig) ? p.supplierConfig.map((s: any) => s?.mpn) : [])].map(norm).filter(Boolean);
const supplierSkusOf = (p: Record<string, any>) =>
  [p.supplierSku, ...(Array.isArray(p.supplierConfig) ? p.supplierConfig.map((s: any) => s?.supplierSku) : [])].map(norm).filter(Boolean);

/** สินค้าที่อาจเป็นตัวเดียวกัน (สูงสุด limit รายการ) — ไม่บล็อกการบันทึก แค่ให้ผู้ใช้เปิดดูก่อน */
export function findSimilarProducts(
  form: { name?: string; mpn?: string; supplierSku?: string; brand?: string; model?: string },
  products: Array<Record<string, any>>,
  companyId: string,
  limit = 3,
): SimilarProduct[] {
  const name = norm(form.name), mpn = norm(form.mpn), supSku = norm(form.supplierSku);
  const brandModel = form.brand && form.model ? `${norm(form.brand)}|${norm(form.model)}` : "";
  if (name.length < 3 && !mpn && !supSku && !brandModel) return [];
  const out: Array<SimilarProduct & { score: number }> = [];
  for (const p of products || []) {
    if (!p || p.isDeleted || (p.companyId && p.companyId !== companyId)) continue;
    const pName = String(p.name || p.productName || "");
    let score = 0, reason = "";
    if (mpn && mpnsOf(p).includes(mpn)) { score = 3; reason = "MPN ตรงกัน"; }
    else if (supSku && supplierSkusOf(p).includes(supSku)) { score = 2.5; reason = "รหัสผู้ขายตรงกัน"; }
    else if (brandModel && `${norm(p.brand)}|${norm(p.model || p.mainModel)}` === brandModel) { score = 2; reason = "ยี่ห้อและรุ่นเดียวกัน"; }
    else if (name.length >= 3) {
      if (norm(pName) === name) { score = 1.9; reason = "ชื่อเดียวกัน"; }
      else {
        const sim = nameSimilarity(name, pName);
        if (sim >= 0.75) { score = sim; reason = `ชื่อคล้ายกัน ${Math.round(sim * 100)}%`; }
      }
    }
    if (score > 0) out.push({ id: String(p.id), name: pName || String(p.sku || p.id), sku: String(p.sku || ""), reason, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _s, ...rest }) => { void _s; return rest; });
}

export type MarginLevel = "none" | "loss" | "low" | "ok";
export interface MarginInfo { profit: number; percent: number; level: MarginLevel }

/** กำไรขั้นต้นของราคาขายหนึ่งราคา · ต่ำกว่าเกณฑ์ GP ของบริษัท = low */
export function marginOf(cost: number, price: number, minGp: number): MarginInfo {
  const c = Number(cost) || 0, p = Number(price) || 0;
  if (p <= 0) return { profit: 0, percent: 0, level: "none" };
  const profit = Math.round((p - c) * 100) / 100;
  const percent = Math.round((profit / p) * 1000) / 10;
  return { profit, percent, level: profit < 0 ? "loss" : percent < minGp ? "low" : "ok" };
}

/** ค่าที่คงไว้เมื่อบันทึกแล้วเพิ่มตัวถัดไป (ของที่มักเหมือนกันในสินค้ารุ่นใกล้กัน) */
export const CARRY_OVER_KEYS = [
  "category", "subCategory", "brand", "productType", "lifecycleStatus", "taxType",
  "glIncomeAccount", "glCogsAccount", "glInventoryAccount",
  "packageUnit", "baseUnit", "conversionRate", "conversions",
  "supplierId", "supplierConfig", "leadTimeDays", "warehouseId",
  "isSerialized", "isBatchTracked", "isExpiryTracked",
] as const;

export function carryOver<T extends Record<string, any>>(initial: T, saved: T): T {
  const next: Record<string, any> = { ...initial };
  for (const k of CARRY_OVER_KEYS) if (k in saved) next[k] = saved[k];
  return next as T;
}

const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/**
 * สร้างจากสินค้าเดิม: คัดลอกทุกอย่างที่ใช้ซ้ำได้
 * ไม่คัดลอกตัวตนของสินค้า (รหัส บาร์โค้ด รูป) ยอดยกมา ซีเรียล และเอกสารแนบ
 */
export function productToForm<T extends Record<string, any>>(initial: T, p: Record<string, any>): T {
  const primary = (Array.isArray(p.supplierConfig) ? p.supplierConfig.find((s: any) => s?.isPrimary) || p.supplierConfig[0] : null) || {};
  const pricing = p.pricing || {};
  const inv = p.inventoryControl || {};
  const dims = p.dimensions || {};
  const aliases = Array.isArray(p.aliases) ? p.aliases.map((a: any) => a?.name).filter(Boolean).join(", ") : str(p.aliases);
  const form: Record<string, any> = {
    ...initial,
    name: str(p.name || p.productName),
    category: str(p.category), subCategory: str(p.subCategory),
    brand: str(p.brand), model: str(p.model || p.mainModel), subModel: str(p.subModel),
    productType: str(p.productType), lifecycleStatus: str(p.lifecycleStatus),
    taxType: str(p.taxType || p.vatType),
    glIncomeAccount: str(p.glIncomeAccount), glCogsAccount: str(p.glCogsAccount), glInventoryAccount: str(p.glInventoryAccount),
    packageUnit: str(p.packageUnit || p.purchaseUnit), baseUnit: str(p.baseUnit || p.unit),
    conversionRate: Number(p.conversionRate || p.conversionFactor) || 1,
    conversions: Array.isArray(p.conversions) ? p.conversions.map((c: any) => ({ ...c, barcode: "" })) : [],
    cost: Number(pricing.costWAC ?? p.costPrice) || 0,
    price: Number(pricing.pricePOS ?? p.unitPrice) || 0,
    priceProject: Number(pricing.priceProject) || 0,
    priceWholesale: Number(pricing.priceWholesale ?? p.wholesalePrice) || 0,
    minimumFloorPrice: Number(pricing.minimumFloorPrice) || 0,
    supplierId: str(p.supplierId || primary.supplierId),
    supplierSku: "", mpn: "",
    leadTimeDays: numOrNull(primary.leadTimeDays),
    supplierConfig: Array.isArray(p.supplierConfig) ? p.supplierConfig.map((s: any) => ({ ...s, supplierSku: "", mpn: "" })) : [],
    reorderPoint: numOrNull(inv.reorderPoint), minStock: numOrNull(inv.minStock), maxStock: numOrNull(inv.maxStock),
    warehouseId: str(p.warehouseId), rackLocation: "",
    isSerialized: !!(p.isSerialized ?? p.isSerialTracked), isBatchTracked: !!p.isBatchTracked, isExpiryTracked: !!p.isExpiryTracked,
    weightKg: numOrNull(p.weightKg), dimensionW: numOrNull(dims.w), dimensionL: numOrNull(dims.l), dimensionH: numOrNull(dims.h),
    technicalSpecs: str(p.technicalSpecs), aliases,
    accessories: Array.isArray(p.accessories) ? p.accessories.join(", ") : str(p.accessories),
  };
  // เก็บเฉพาะคีย์ที่ฟอร์มรู้จัก
  for (const k of Object.keys(form)) if (!(k in initial)) delete form[k];
  return form as T;
}
