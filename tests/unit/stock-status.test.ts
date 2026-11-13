import { describe, expect, it } from "vitest";
import { reorderPointOf, stockState, stockValue } from "@/lib/stock-status";

describe("stock status by each product's reorder point", () => {
  it("out only when the product is meant to be stocked (reorder point set)", () => {
    expect(stockState({ stockStatus: { onHand: 0 }, inventoryConfig: { reorderPoint: 5 } })).toBe("out");
    expect(stockState({ stockStatus: { onHand: 0 } })).toBe("none");
  });
  it("low at or below the product's own reorder point, falling back to min stock", () => {
    expect(stockState({ stockStatus: { onHand: 5 }, inventoryConfig: { reorderPoint: 5 } })).toBe("low");
    expect(stockState({ stockStatus: { onHand: 6 }, inventoryConfig: { reorderPoint: 5 } })).toBe("ok");
    expect(stockState({ stockStatus: { onHand: 2 }, minStock: 2 })).toBe("low");
    expect(reorderPointOf({ inventoryConfig: { minStock: 3 } })).toBe(3);
    expect(stockState({ stockStatus: { onHand: 1 } })).toBe("ok");
  });
  it("services have no stock state; value = on hand × average cost", () => {
    expect(stockState({ itemType: "SERVICE", stockStatus: { onHand: 0 } })).toBe("service");
    expect(stockValue({ stockStatus: { onHand: 260 }, pricing: { costWAC: 79.62 } })).toBe(20701.2);
  });
});
