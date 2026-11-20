/**
 * สูตรงานบริการ (สินค้าประเภทงานบริการ): วัสดุต่อ 1 หน่วยงาน + ค่าแรงต่อหน่วย
 *   เช่น "ติดตั้งสายแลน" ต่อ 1 จุด = สาย CAT6 30 ม. + หัว RJ45 2 ตัว + กล่อง 1 + รางขาว 10 ม. + ค่าแรง 300
 * - ต้นทุนต่อหน่วย = Σ(จำนวนวัสดุ × ต้นทุนเฉลี่ยล่าสุดของวัสดุ) + ค่าแรง — คิดใหม่ทุกครั้งที่เลือกลงเอกสาร
 * - ในเอกสารลูกค้า: บรรทัดเดียว + "ประกอบด้วย ..." ใต้รายการ (ไม่แสดงต้นทุน)
 * - บรรทัดเอกสารเก็บสำเนาสูตร (recipe) ไว้ — ใช้ตัดวัสดุตอนส่งของ/เบิกงาน และแจ้งเตือนเมื่อราคาวัสดุเปลี่ยน
 * เก็บที่สินค้า: serviceRecipe (ข้อมูลของบริษัท)
 */
/** cost = ต้นทุนเฉลี่ยของวัสดุ ณ ตอนเลือกลงเอกสาร (เฉพาะสำเนาสูตรในบรรทัดเอกสาร) */
/**
 * qty = จำนวนในหน่วยหลักของสินค้า (ใช้คิดต้นทุนและตัดสต็อก) · unit = หน่วยหลัก
 * หน่วยที่ใช้ในงาน (ถ้าต่างจากหน่วยหลัก): useUnit + perBase (1 หน่วยหลัก = perBase useUnit) + useQty (จำนวนตามหน่วยที่ใช้)
 *   เช่น สายแลนเก็บสต็อกเป็น "กล่อง" ใช้งานเป็น "เมตร": perBase 305, useQty 30 → qty = 30/305 กล่อง
 */
export interface RecipeMaterial { productId: string; sku?: string; name: string; unit?: string; qty: number; cost?: number; useUnit?: string; perBase?: number; useQty?: number }
/** ค่าแรงแต่ละรายการ: ผูกช่าง/อัตราค่าแรงที่สร้างไว้ (productId = รายการ "[ค่าแรง] ..." ของช่าง) หรือพิมพ์ใหม่โดยยังไม่ผูกช่าง */
export interface RecipeLabor { productId?: string; contractorId?: string; contractorName?: string; name: string; unit?: string; qty: number; rate: number }
/** laborCost = ค่าแรงรวมต่อ 1 หน่วยงาน (ถ้ามี labors คิดจาก Σ จำนวน × อัตรา) */
export interface ServiceRecipe { unit?: string; laborCost: number; labors?: RecipeLabor[]; materials: RecipeMaterial[] }
/** กำไรมาตรฐานของงานบริการ (% ของราคาขาย) */
export const SERVICE_MARGIN = 20;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** จำนวน/หน่วยที่แสดง (หน่วยที่ใช้ในงาน ถ้ามี) */
export const matQty = (m: RecipeMaterial) => (m.useUnit && m.perBase ? Number(m.useQty ?? r4(m.qty * m.perBase)) : m.qty);
export const matUnit = (m: RecipeMaterial) => (m.useUnit && m.perBase ? m.useUnit : m.unit || "");
/** ตั้งจำนวนตามหน่วยที่แสดง → คิดจำนวนหน่วยหลักให้ */
export function setMatQty(m: RecipeMaterial, shown: number): RecipeMaterial {
  const v = Math.max(0, n(shown));
  return m.useUnit && m.perBase ? { ...m, useQty: v, qty: r6(v / m.perBase) } : { ...m, qty: v };
}
/** เปลี่ยนหน่วยที่ใช้ (perBase = กี่หน่วยนี้ต่อ 1 หน่วยหลัก · หน่วยหลัก = ไม่ส่ง) — คงปริมาณจริงเดิมไว้ */
export function setMatUnit(m: RecipeMaterial, useUnit?: string, perBase?: number): RecipeMaterial {
  const { useUnit: _u, perBase: _p, useQty: _q, ...base } = m; void _u; void _p; void _q;
  if (!useUnit || !(Number(perBase) > 0) || useUnit === m.unit) return base;
  return { ...base, useUnit, perBase: Number(perBase), useQty: r4(m.qty * Number(perBase)) };
}
const s = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** ทำความสะอาดสูตรที่รับจากหน้าจอ/เอกสาร (null = ไม่มีสูตร) */
export function normalizeRecipe(raw: any): ServiceRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const materials: RecipeMaterial[] = (Array.isArray(raw.materials) ? raw.materials : []).slice(0, 50)
    .map((m: any) => {
      const unit = s(m?.unit, 30), useUnit = s(m?.useUnit, 30), perBase = r6(n(m?.perBase));
      const sub = !!useUnit && useUnit !== unit && perBase > 0 && perBase <= 1e6;
      const useQty = sub ? Math.max(0, r4(m?.useQty !== undefined && m?.useQty !== null ? n(m.useQty) : n(m?.qty) * perBase)) : 0;
      return {
        productId: s(m?.productId, 120), sku: s(m?.sku, 120), name: s(m?.name, 300), unit,
        // ทศนิยม 6 ตำแหน่ง: สัดส่วนเช่น Patch Panel 1/24 ต่อจุด ต้องคิดต้นทุนตรงกับ Excel
        qty: sub ? r6(useQty / perBase) : Math.max(0, r6(n(m?.qty))),
        ...(sub ? { useUnit, perBase, useQty } : {}),
        ...(m?.cost !== undefined && m?.cost !== null ? { cost: Math.max(0, r2(n(m.cost))) } : {}),
      };
    })
    .filter((m: RecipeMaterial) => m.productId && !m.productId.includes("/") && m.qty > 0);
  const labors: RecipeLabor[] = (Array.isArray(raw.labors) ? raw.labors : []).slice(0, 20)
    .map((l: any) => ({
      ...(s(l?.productId, 120) && !s(l?.productId).includes("/") ? { productId: s(l.productId, 120) } : {}),
      ...(s(l?.contractorId, 120) ? { contractorId: s(l.contractorId, 120), contractorName: s(l?.contractorName) } : {}),
      name: s(l?.name, 300), unit: s(l?.unit, 30), qty: Math.max(0, r2(n(l?.qty))), rate: Math.max(0, r2(n(l?.rate))),
    }))
    .filter((l: RecipeLabor) => l.name && l.qty > 0);
  const laborCost = labors.length ? r2(labors.reduce((t, l) => t + l.qty * l.rate, 0)) : Math.max(0, r2(n(raw.laborCost)));
  if (!materials.length && !laborCost && !labors.length) return null;
  return { unit: s(raw.unit, 30) || undefined, laborCost, ...(labors.length ? { labors } : {}), materials };
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
  return `ประกอบด้วย ${recipe.materials.map((m) => `${m.name} ${q(matQty(m))}${matUnit(m) ? ` ${matUnit(m)}` : ""}`).join(", ")}${recipe.unit ? ` (ต่อ 1 ${recipe.unit})` : ""}`;
}

/** วัสดุที่ต้องใช้ทั้งหมดของบรรทัด = สูตร × จำนวนหน่วยงาน (ใช้ตัดสต็อก) */
export function recipeRequirement(recipe: ServiceRecipe | null | undefined, units: number): { productId: string; name: string; qty: number }[] {
  if (!recipe || !(units > 0)) return [];
  return recipe.materials.map((m) => ({ productId: m.productId, name: m.name, qty: r4(m.qty * units) }));
}

/** % กำไรขั้นต้นต่อหน่วย (ราคาขายคงที่ เทียบต้นทุนตามสูตร) */
export function recipeMargin(price: number, cost: number): number | null {
  return price > 0 ? r2(((price - cost) / price) * 100) : null;
}

/** ราคาขายมาตรฐาน: กำไร margin% ของราคาขาย (ราคา = ต้นทุน ÷ (1 − margin)) ปัดขึ้นเป็นบาทเต็ม */
export function suggestServicePrice(cost: number, margin = SERVICE_MARGIN): number {
  if (!(cost > 0)) return 0;
  return Math.ceil(r2(cost / (1 - margin / 100)));
}

/** เพิ่มชุดอุปกรณ์ (kit) × จำนวนชุด ลงวัสดุ — สินค้าเดียวกันรวมจำนวน */
export function addKitMaterials(materials: RecipeMaterial[], components: { productId: string; sku?: string; name?: string; unit?: string; qty: number }[], sets = 1): RecipeMaterial[] {
  const out = materials.map((m) => ({ ...m }));
  for (const c of components || []) {
    const qty = r2(n(c.qty) * (sets > 0 ? sets : 1));
    if (!c.productId || !(qty > 0)) continue;
    const hit = out.find((m) => m.productId === c.productId);
    if (hit) hit.qty = r2(hit.qty + qty);
    else out.push({ productId: c.productId, sku: c.sku || "", name: c.name || c.productId, unit: c.unit || "", qty });
  }
  return out;
}

/** รายการค่าแรงที่สร้างไว้ (จากหน้าเพิ่มช่าง: "[ค่าแรง] ..." ผูกช่าง) */
export function isLaborItem(p: any): boolean {
  return String(p?.itemType || p?.type || "").toUpperCase() === "SERVICE" && (!!p?.subcontractorId || /^\[ค่าแรง\]/.test(String(p?.name || "")));
}
