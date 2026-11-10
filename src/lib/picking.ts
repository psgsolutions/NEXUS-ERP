import { normalizeRecipe, recipeRequirement } from "./service-recipe";

/**
 * จำนวนที่ยังค้างเบิกต่อสินค้าของใบสั่งขาย = จำนวนสั่ง - จำนวนที่เบิกแล้ว (so.picked)
 * ไม่นับบริการ/ค่าแรง/หัวข้อกลุ่ม (ไม่มีสต็อก)
 */
export const soPickRemaining = (so: any): Map<string, number> => {
  const ordered = new Map<string, number>();
  for (const it of so.items || []) {
    // งานบริการที่มีสูตร: ต้องเบิกวัสดุตามสูตร × จำนวน (ตัดสต็อกตอนส่งของ)
    if (it.itemType === "SERVICE" && it.recipe) {
      for (const m of recipeRequirement(normalizeRecipe(it.recipe), Number(it.qty ?? it.quantity) || 0)) ordered.set(m.productId, (ordered.get(m.productId) || 0) + m.qty);
      continue;
    }
    if (!it.productId || it.itemType === "GROUP_HEADER" || it.itemType === "SERVICE" || it.itemType === "LABOR") continue;
    ordered.set(it.productId, (ordered.get(it.productId) || 0) + (Number(it.qty ?? it.quantity) || 0));
  }
  const picked = so.picked || {};
  const remaining = new Map<string, number>();
  ordered.forEach((qty, productId) => {
    // วัสดุตามสูตรอาจเป็นเศษ (เช่น 2.5 ม.) — เบิกเป็นจำนวนเต็มขึ้น
    const left = Math.ceil(qty - 1e-9) - (Number(picked[productId]) || 0);
    if (left > 0) remaining.set(productId, left);
  });
  return remaining;
};
