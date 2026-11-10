import { describe, expect, it } from "vitest";
import { normalizeRecipe, recipeCost, recipeDetails, recipeMargin, recipeRequirement } from "@/lib/service-recipe";
import { soPickRemaining } from "@/lib/picking";

const lan = { unit: "จุด", laborCost: 300, materials: [{ productId: "CAT6", name: "สาย CAT6", unit: "ม.", qty: 30 }, { productId: "RJ45", name: "หัว RJ45", unit: "ตัว", qty: 2 }, { productId: "BOX", name: "กล่อง", unit: "ใบ", qty: 1 }] };

describe("service recipe (materials + labour per unit)", () => {
  it("cleans input: drops bad materials, keeps per-line material cost", () => {
    const r = normalizeRecipe({ unit: "จุด", laborCost: "300", materials: [...lan.materials, { productId: "", qty: 1 }, { productId: "a/b", qty: 1 }, { productId: "X", qty: 0 }, { productId: "Y", name: "y", qty: 1, cost: 12.345 }] })!;
    expect(r.materials.map((m) => m.productId)).toEqual(["CAT6", "RJ45", "BOX", "Y"]);
    expect(r.laborCost).toBe(300);
    expect(r.materials[3].cost).toBe(12.35);
    expect(normalizeRecipe({ laborCost: 0, materials: [] })).toBeNull();
  });
  it("cost = materials × latest average cost + labour; margin on a fixed price", () => {
    const cost = recipeCost(normalizeRecipe(lan), (id) => ({ CAT6: 5, RJ45: 3, BOX: 45 } as Record<string, number>)[id] || 0);
    expect(cost).toEqual({ material: 201, labor: 300, total: 501 });
    expect(recipeMargin(1200, cost.total)).toBe(58.25);
    expect(recipeMargin(0, 501)).toBeNull();
  });
  it("customer documents show one line with the materials under it, no costs", () => {
    expect(recipeDetails(normalizeRecipe(lan))).toBe("ประกอบด้วย สาย CAT6 30 ม., หัว RJ45 2 ตัว, กล่อง 1 ใบ (ต่อ 1 จุด)");
  });
  it("material requirement = recipe × units, and a sales order must pick it (rounded up)", () => {
    expect(recipeRequirement(normalizeRecipe(lan), 4)).toEqual([{ productId: "CAT6", name: "สาย CAT6", qty: 120 }, { productId: "RJ45", name: "หัว RJ45", qty: 8 }, { productId: "BOX", name: "กล่อง", qty: 4 }]);
    const so = { items: [
      { itemType: "SERVICE", productId: "SVC", qty: 3, recipe: { ...lan, materials: [{ productId: "CAT6", name: "สาย", qty: 2.5 }, { productId: "RJ45", name: "หัว", qty: 2 }] } },
      { itemType: "PRODUCT", productId: "RJ45", qty: 10 },
      { itemType: "SERVICE", productId: "SVC2", qty: 1 },
    ], picked: { RJ45: 6 } };
    const left = soPickRemaining(so);
    expect(left.get("CAT6")).toBe(8); // 7.5 → 8
    expect(left.get("RJ45")).toBe(10); // 6 + 10 − 6
    expect(left.has("SVC")).toBe(false);
    expect(left.has("SVC2")).toBe(false);
  });
});
