import { describe, expect, it } from "vitest";
import { onOrderByProduct, reorderSuggestions } from "@/lib/reorder";

describe("reorder point → purchase request", () => {
  const products = [
    { id: "A", name: "ต่ำกว่าจุด", inventoryControl: { reorderPoint: 10, maxStock: 20 }, stockStatus: { onHand: 3, available: 3 }, supplierConfig: [{ supplierId: "S1", latestCost: 50, leadTimeDays: 10, isPrimary: true }] },
    { id: "B", name: "สั่งไว้แล้วพอ", inventoryControl: { reorderPoint: 10, maxStock: 20 }, stockStatus: { onHand: 2 } },
    { id: "C", name: "ไม่ตั้งจุด", stockStatus: { onHand: 0 } },
    { id: "D", name: "ใช้ขั้นต่ำ + MOQ", inventoryControl: { minStock: 5 }, stockStatus: { onHand: 5, reserved: 1 }, supplierConfig: [{ supplierId: "S2", latestCost: 9, moq: 50, isPrimary: true }] },
    { id: "E", name: "บริการ", productType: "SERVICE", inventoryControl: { reorderPoint: 5 }, stockStatus: { onHand: 0 } },
  ];
  const prs = [{ status: "PENDING_APPROVAL", items: [{ productId: "A", qty: 2 }] }, { status: "CONVERTED", items: [{ productId: "A", qty: 99 }] }];
  const pos = [{ status: "Approved", items: [{ productId: "B", qty: 10, receivedQty: 0 }] }, { status: "CANCELLED", items: [{ productId: "A", qty: 50 }] }];

  it("counts only open requests/orders as on order", () => {
    const m = onOrderByProduct(prs, pos);
    expect(m.get("A")).toBe(2);
    expect(m.get("B")).toBe(10);
  });

  it("suggests products at or below the reorder point with a top-up quantity", () => {
    const r = reorderSuggestions(products, prs, pos);
    expect(r.map((x) => x.productId).sort()).toEqual(["A", "D"]);
    expect(r.find((x) => x.productId === "A")).toMatchObject({ available: 3, onOrder: 2, qty: 15, unitCost: 50, supplierId: "S1", leadTimeDays: 10 });
    // ขั้นต่ำ 5 → สูงสุด 10 · พร้อมใช้ 4 → ควรสั่ง 6 แต่ผู้ขายสั่งขั้นต่ำ 50
    expect(r.find((x) => x.productId === "D")).toMatchObject({ reorderPoint: 5, available: 4, qty: 50 });
  });
});
