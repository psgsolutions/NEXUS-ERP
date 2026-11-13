/**
 * แคตตาล็อกราคาของผู้ขาย (เช่น SiS) — ใช้ค้นหาตอนทำเอกสาร ไม่อยู่ในทะเบียนสินค้า
 * เลือกใช้เมื่อไร ระบบจึงสร้างเป็นสินค้า (รหัสระบบ · ทุน · ผู้ขายหลัก) ทั้งระบบจึงมีเฉพาะสินค้าที่ใช้จริง
 * คีย์สั้นเพื่อให้ไฟล์เล็ก: c รหัสผู้ขาย · s SKU ที่เสนอ · n ชื่อ · b ยี่ห้อ · m รุ่น/Part number · g หมวด · h หมวดย่อย
 *                         u หน่วย · t P=สินค้า S=บริการ · p ราคาขายก่อน VAT · k ทุนก่อน VAT · w รับประกัน (เดือน) · bc บาร์โค้ด
 */
export interface CatalogItem { c: string; s: string; n: string; b: string; m: string; g: string; h: string; u: string; t: "P" | "S"; p: number; k: number; w: number; bc: string }
export interface CatalogMeta { key: string; name: string; supplierId: string; count: number; parts: number; version: string }

const compact = (s: string) => s.toLowerCase().replace(/[\s\-_/.(),:]+/g, "");

/** ค้นทุกคำ (ไม่สนช่องว่าง/ขีด) ในชื่อ รุ่น รหัส ยี่ห้อ — รุ่น/รหัสที่ตรงหรือขึ้นต้นด้วยคำค้นมาก่อน */
export function searchCatalog(items: CatalogItem[], q: string, limit = 30): CatalogItem[] {
  const tokens = String(q || "").toLowerCase().split(/\s+/).map(compact).filter((t) => t.length >= 2);
  if (!tokens.length) return [];
  const whole = compact(q);
  const hits: { it: CatalogItem; score: number }[] = [];
  for (const it of items) {
    const hay = compact(`${it.n} ${it.m} ${it.c} ${it.s} ${it.b}`);
    if (!tokens.every((t) => hay.includes(t))) continue;
    const m = compact(it.m), c = compact(it.c);
    const score = m === whole || c === whole ? 0 : m.startsWith(whole) || c.includes(whole) ? 1 : compact(it.n).includes(whole) ? 2 : 3;
    hits.push({ it, score });
    if (hits.length > 5000) break;
  }
  return hits.sort((a, b) => a.score - b.score || a.it.n.length - b.it.n.length).slice(0, limit).map((h) => h.it);
}

/** รายการแคตตาล็อก → ข้อมูลสร้างสินค้า (ผู้ขายของแคตตาล็อกเป็นผู้ขายหลัก · ทุนล่าสุด = ทุนในแคตตาล็อก) */
export function catalogToProduct(it: CatalogItem, meta: Pick<CatalogMeta, "key" | "supplierId" | "version">): Record<string, any> {
  const service = it.t === "S";
  const price = Math.max(0, Number(it.p) || 0), cost = Math.max(0, Number(it.k) || 0);
  return {
    sku: it.s, productCode: it.s, name: it.n, productName: it.n,
    itemType: service ? "SERVICE" : "PRODUCT", productType: service ? "SERVICE" : "PHYSICAL",
    unit: it.u || "ชิ้น", baseUnit: it.u || "ชิ้น", brand: it.b || "", model: it.m || "", mainModel: it.m || "", partNumber: it.m || "",
    category: it.g || "general", subCategory: it.h || "",
    ...(it.bc ? { barcode: it.bc, barcodes: [it.bc] } : {}),
    pricing: { pricePOS: price, priceProject: price, priceWholesale: price }, unitPrice: price, costPrice: cost,
    taxType: "VAT_7", vatType: "VAT_7", lifecycleStatus: "ACTIVE",
    ...(it.w ? { warrantyMonths: it.w } : {}),
    supplierConfig: [{ supplierId: meta.supplierId, supplierSku: it.c, latestCost: cost, leadTimeDays: 7, isPrimary: true }],
    importedFrom: `catalog:${meta.key}`, sourceCatalog: { key: meta.key, code: it.c, version: meta.version },
  };
}
