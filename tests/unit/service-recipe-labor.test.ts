import { describe, expect, it } from "vitest";
import { addKitMaterials, isLaborItem, normalizeRecipe, recipeCost, suggestServicePrice } from "@/lib/service-recipe";

describe("งานบริการ: ค่าแรงหลายรายการ ชุดอุปกรณ์ ราคามาตรฐาน", () => {
  it("ค่าแรงรวม = Σ อัตรา × จำนวน (ผูกช่างหรือพิมพ์เอง)", () => {
    const r = normalizeRecipe({ unit: "จุด", labors: [
      { productId: "L1", contractorId: "C1", contractorName: "ช่างเอ", name: "เดินสายแลน", qty: 1, rate: 250 },
      { name: "เข้าหัว Outlet", qty: 2, rate: 25 },
      { name: "", qty: 1, rate: 99 },
    ], materials: [{ productId: "P1", name: "สาย CAT6", unit: "เมตร", qty: 30 }] })!;
    expect(r.labors).toHaveLength(2);
    expect(r.laborCost).toBe(300);
    expect(r.labors![1].contractorId).toBeUndefined();
    expect(recipeCost(r, () => 5)).toEqual({ material: 150, labor: 300, total: 450 });
  });
  it("สูตรเก่า (ค่าแรงตัวเลขเดียว) ยังใช้ได้", () => {
    expect(normalizeRecipe({ laborCost: 300, materials: [] })!.laborCost).toBe(300);
  });
  it("ราคามาตรฐานกำไร 20% ของราคาขาย ปัดขึ้นบาทเต็ม", () => {
    expect(suggestServicePrice(450)).toBe(563); // 450 / 0.8 = 562.5
    expect(suggestServicePrice(400)).toBe(500);
    expect(suggestServicePrice(0)).toBe(0);
  });
  it("เพิ่มชุดอุปกรณ์ × จำนวนชุด รวมสินค้าเดียวกัน", () => {
    const m = addKitMaterials([{ productId: "P1", name: "สาย", qty: 10 }], [{ productId: "P1", qty: 5 }, { productId: "P2", name: "หัว RJ45", qty: 2 }], 2);
    expect(m).toEqual([{ productId: "P1", name: "สาย", qty: 20 }, { productId: "P2", sku: "", name: "หัว RJ45", unit: "", qty: 4 }]);
  });
  it("รายการค่าแรง = งานบริการที่ผูกช่าง หรือชื่อขึ้นต้น [ค่าแรง]", () => {
    expect(isLaborItem({ itemType: "SERVICE", subcontractorId: "C1", name: "x" })).toBe(true);
    expect(isLaborItem({ itemType: "SERVICE", name: "[ค่าแรง] เดินสาย (ช่างเอ)" })).toBe(true);
    expect(isLaborItem({ itemType: "SERVICE", name: "เดินสายแลน" })).toBe(false);
    expect(isLaborItem({ itemType: "PRODUCT", subcontractorId: "C1" })).toBe(false);
  });
});
