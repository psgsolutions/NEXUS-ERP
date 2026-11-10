/**
 * สูตรงานบริการ (สินค้าประเภทงานบริการ): วัสดุต่อ 1 หน่วยงาน + ค่าแรงต่อหน่วย
 *   เช่น "ติดตั้งสายแลน" ต่อ 1 จุด = สาย CAT6 30 ม. + หัว RJ45 2 ตัว + กล่อง 1 + รางขาว 10 ม. + ค่าแรง 300
 * - ต้นทุนต่อหน่วย = Σ(จำนวนวัสดุ × ต้นทุนเฉลี่ยล่าสุดของวัสดุ) + ค่าแรง — คิดใหม่ทุกครั้งที่เลือกลงเอกสาร
 * - ในเอกสารลูกค้า: บรรทัดเดียว + "ประกอบด้วย ..." ใต้รายการ (ไม่แสดงต้นทุน)
 * - บรรทัดเอกสารเก็บสำเนาสูตร (recipe) ไว้ — ใช้ตัดวัสดุตอนส่งของ/เบิกงาน และแจ้งเตือนเมื่อราคาวัสดุเปลี่ยน
 * เก็บที่สินค้า: serviceRecipe (ข้อมูลของบริษัท)
 */
/** cost = ต้นทุนเฉลี่ยของวัสดุ ณ ตอนเลือกลงเอกสาร (เฉพาะสำเนาสูตรในบรรทัดเอกสาร) */
export interface RecipeMaterial { productId: string; sku?: string; name: string; unit?: string; qty: number; cost?: number }
export interface ServiceRecipe { unit?: string; laborCost: number; materials: RecipeMaterial[] }

const r2 = (n: number) => Math.round(n * 100) / 100;
const s = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** ทำความสะอาดสูตรที่รับจากหน้าจอ/เอกสาร (null = ไม่มีสูตร) */
export function normalizeRecipe(raw: any): ServiceRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const materials: RecipeMaterial[] = (Array.isArray(raw.materials) ? raw.materials : []).slice(0, 50)
    .map((m: any) => ({ productId: s(m?.productId, 120), sku: s(m?.sku, 120), name: s(m?.name, 300), unit: s(m?.unit, 30), qty: Math.max(0, r2(n(m?.qty) * 100) / 100), ...(m?.cost !== undefined && m?.cost !== null ? { cost: Math.max(0, r2(n(m.cost))) } : {}) }))
    .filter((m: RecipeMaterial) => m.productId && !m.productId.includes("/") && m.qty > 0);
  const laborCost = Math.max(0, r2(n(raw.laborCost)));
  if (!materials.length && !laborCost) return null;
  return { unit: s(raw.unit, 30) || undefined, laborCost, materials };
}

/** ต้นทุนวัสดุต่อหน่วยงาน + ค่าแรง (costOf = ต้นทุนเฉลี่ยของวัสดุ) */
export function recipeCost(recipe: ServiceRecipe | null | undefined, costOf: (productId: string) => number): { material: number; labor: number; total: number } {
  if (!recipe) return { material: 0, labor: 0, total: 0 };
  const material = r2(recipe.materials.reduce((t, m) => t + m.qty * Math.max(0, n(costOf(m.productId))), 0));
  const labor = r2(recipe.laborCost);
  return { material, labor, total: r2(material + labor) };
}

/** ข้อความใต้รายการในเอกสารลูกค้า: "ประกอบด้วย สาย CAT6 30 ม., หัว RJ45 2 ตัว" (ต่อ 1 หน่วยงาน) */
export function recipeDetails(recipe: ServiceRecipe | null | undefined): string {
  if (!recipe?.materials.length) return "";
  const q = (x: number) => (Number.isInteger(x) ? String(x) : x.toLocaleString("th-TH", { maximumFractionDigits: 2 }));
  return `ประกอบด้วย ${recipe.materials.map((m) => `${m.name} ${q(m.qty)}${m.unit ? ` ${m.unit}` : ""}`).join(", ")}${recipe.unit ? ` (ต่อ 1 ${recipe.unit})` : ""}`;
}

/** วัสดุที่ต้องใช้ทั้งหมดของบรรทัด = สูตร × จำนวนหน่วยงาน (ใช้ตัดสต็อก) */
export function recipeRequirement(recipe: ServiceRecipe | null | undefined, units: number): { productId: string; name: string; qty: number }[] {
  if (!recipe || !(units > 0)) return [];
  return recipe.materials.map((m) => ({ productId: m.productId, name: m.name, qty: r2(m.qty * units) }));
}

/** % กำไรขั้นต้นต่อหน่วย (ราคาขายคงที่ เทียบต้นทุนตามสูตร) */
export function recipeMargin(price: number, cost: number): number | null {
  return price > 0 ? r2(((price - cost) / price) * 100) : null;
}
