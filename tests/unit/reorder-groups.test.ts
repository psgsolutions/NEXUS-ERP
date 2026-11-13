import { describe, expect, it } from "vitest";
import { groupBySupplier, latestLotSupplier, reorderSuggestions } from "@/lib/reorder";

const prod = (id: string, extra: any = {}) => ({ id, name: id, sku: id, unit: "ชิ้น", itemType: "PRODUCT", stockStatus: { onHand: 0 }, ...extra });

describe("reorder: ผู้ขายสำรองจาก Lot + จัดกลุ่มใบละผู้ขาย", () => {
  const lots = [
    { productId: "A", supplierId: "SUP-1", supplierName: "ร้านหนึ่ง", receivedDate: "2026-01-01", lotNo: "LOT-1", unitCost: 90 },
    { productId: "A", supplierId: "SUP-2", supplierName: "ร้านสอง", receivedDate: "2026-03-01", lotNo: "LOT-2", unitCost: 100 },
    { productId: "B", supplierId: "", supplierName: "ดีลเลอร์เก่า", receivedDate: "2026-02-01", lotNo: "LOT-3", unitCost: 50 },
    { productId: "C", supplierId: "", supplierName: "", receivedDate: "2026-02-01", lotNo: "LOT-4", unitCost: 10 },
  ];

  it("ผู้ขายของ Lot ล่าสุด (ข้าม Lot ที่ไม่มีผู้ขาย)", () => {
    const m = latestLotSupplier(lots);
    expect(m.get("A")).toEqual({ supplierId: "SUP-2", supplierName: "ร้านสอง", unitCost: 100 });
    expect(m.get("B")?.supplierName).toBe("ดีลเลอร์เก่า");
    expect(m.has("C")).toBe(false);
  });

  it("ผู้ขายหลักมาก่อน Lot · ไม่ตั้งจุดสั่งซื้อแสดงเฉพาะเมื่อขอ และต้องเคยมีของ", () => {
    const products = [
      prod("A", { inventoryControl: { reorderPoint: 5 }, supplierConfig: [{ supplierId: "SUP-9", isPrimary: true, latestCost: 80 }] }),
      prod("B", { inventoryControl: { reorderPoint: 2 } }),
      prod("C"), prod("D"),
      prod("E", { inventoryControl: { reorderPoint: 2 }, stockStatus: { onHand: 10 } }),
    ];
    const opts = { lotSupplier: latestLotSupplier(lots), everStocked: new Set(["A", "B", "C"]) };
    const base = reorderSuggestions(products, [], [], opts);
    expect(base.map((l) => l.productId).sort()).toEqual(["A", "B"]);
    const a = base.find((l) => l.productId === "A")!;
    expect([a.supplierId, a.supplierSource, a.unitCost]).toEqual(["SUP-9", "primary", 80]);
    const b = base.find((l) => l.productId === "B")!;
    expect([b.supplierId, b.supplierName, b.supplierSource]).toEqual(["", "ดีลเลอร์เก่า", "lot"]);

    const all = reorderSuggestions(products, [], [], { ...opts, includeUnset: true });
    const c = all.find((l) => l.productId === "C")!;
    expect(c.unset).toBe(true);
    expect(c.qty).toBe(1);
    expect(all.some((l) => l.productId === "D")).toBe(false); // ไม่เคยมีของ
  });

  it("จัดกลุ่ม: มีรหัสผู้ขายก่อน กลุ่มที่ยังไม่จับคู่อยู่ท้าย", () => {
    const products = [
      prod("A", { inventoryControl: { reorderPoint: 1 }, supplierConfig: [{ supplierId: "SUP-1", isPrimary: true }] }),
      prod("A2", { inventoryControl: { reorderPoint: 1 }, supplierConfig: [{ supplierId: "SUP-1", isPrimary: true }] }),
      prod("B", { inventoryControl: { reorderPoint: 1 } }),
      prod("X", { inventoryControl: { reorderPoint: 1 }, supplierConfig: [{ supplierId: "SUP-2", isPrimary: true }] }),
    ];
    const g = groupBySupplier(reorderSuggestions(products, [], [], { lotSupplier: latestLotSupplier(lots) }));
    expect(g.map((x) => [x.supplierId, x.lines.length])).toEqual([["SUP-1", 2], ["SUP-2", 1], ["", 1]]);
    expect(g[2].supplierName).toBe("ดีลเลอร์เก่า");
  });
});
