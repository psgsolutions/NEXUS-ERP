import { describe, expect, it } from "vitest";
import { matQty, matUnit, normalizeRecipe, recipeCost, recipeDetails, recipeRequirement, setMatQty, setMatUnit } from "@/lib/service-recipe";

describe("วัสดุในสูตรใช้หน่วยย่อย (สายแลนกล่อง → เมตร)", () => {
  const box = { productId: "LAN", name: "สายแลน CAT6", unit: "กล่อง", qty: 1 };
  it("เปลี่ยนเป็นเมตร: 1 กล่อง = 305 เมตร ใส่ 30 เมตร → 30/305 กล่อง", () => {
    const m = setMatQty(setMatUnit(box, "เมตร", 305), 30);
    expect(matQty(m)).toBe(30);
    expect(matUnit(m)).toBe("เมตร");
    expect(m.qty).toBeCloseTo(30 / 305, 6);
  });
  it("ต้นทุนคิดจากต้นทุนต่อกล่อง · เอกสารลูกค้าแสดงเป็นเมตร · ตัดสต็อกเป็นกล่อง", () => {
    const r = normalizeRecipe({ unit: "จุด", materials: [setMatQty(setMatUnit(box, "เมตร", 305), 30)] })!;
    expect(r.materials[0].useQty).toBe(30);
    expect(recipeCost(r, () => 3050).material).toBe(300); // 3050 / 305 × 30
    expect(recipeDetails(r)).toBe("ประกอบด้วย สายแลน CAT6 30 เมตร (ต่อ 1 จุด)");
    expect(recipeRequirement(r, 10)[0].qty).toBeCloseTo(0.9836, 4); // 10 จุด = 300 ม. ≈ 0.98 กล่อง
  });
  it("กลับเป็นหน่วยหลักได้ และหน่วยเดียวกับหน่วยหลักไม่นับเป็นหน่วยย่อย", () => {
    const back = setMatUnit(setMatUnit(box, "เมตร", 305), undefined);
    expect(back.useUnit).toBeUndefined();
    expect(normalizeRecipe({ materials: [{ ...box, useUnit: "กล่อง", perBase: 2, useQty: 4 }] })!.materials[0]).toEqual({ productId: "LAN", sku: "", name: "สายแลน CAT6", unit: "กล่อง", qty: 1 });
  });
});
