import { describe, expect, it } from "vitest";
import { allocateLots, allocationCost, costMethodOf, fifoOrder, spreadOtherCosts } from "@/lib/stock-lots";

const A = { lotNo: "LOT-2611-0001", remaining: 3, unitCost: 1000, receivedDate: "2026-11-01" };
const B = { lotNo: "LOT-2611-0002", remaining: 5, unitCost: 1200, receivedDate: "2026-11-05" };

describe("stock lots", () => {
  it("company cost method defaults to FIFO", () => {
    expect(costMethodOf(undefined)).toBe("FIFO");
    expect(costMethodOf({ settings: { costMethod: "wac" } })).toBe("WAC");
  });
  it("FIFO takes the oldest lot first and can mix lots on one line (A 3 + B 2 = 5,400)", () => {
    const r = allocateLots([B, A], 5);
    expect(r.allocations).toEqual([{ lotNo: A.lotNo, qty: 3, unitCost: 1000 }, { lotNo: B.lotNo, qty: 2, unitCost: 1200 }]);
    expect(r.short).toBe(0);
    expect(allocationCost(r.allocations)).toBe(5400);
  });
  it("same receive date: lower lot number first", () => {
    expect(fifoOrder([{ ...B, receivedDate: A.receivedDate }, A]).map((l) => l.lotNo)).toEqual([A.lotNo, B.lotNo]);
  });
  it("manual picks are used first, the rest is filled FIFO", () => {
    const r = allocateLots([A, B], 5, [{ lotNo: B.lotNo, qty: 4 }]);
    expect(r.allocations).toEqual([{ lotNo: A.lotNo, qty: 1, unitCost: 1000 }, { lotNo: B.lotNo, qty: 4, unitCost: 1200 }]);
  });
  it("rejects a pick beyond the lot's remaining, an unknown lot, or more than the line quantity", () => {
    expect(() => allocateLots([A, B], 5, [{ lotNo: A.lotNo, qty: 4 }])).toThrow(/ไม่พอ/);
    expect(() => allocateLots([A, B], 5, [{ lotNo: "LOT-X", qty: 1 }])).toThrow(/ไม่พบ Lot/);
    expect(() => allocateLots([A, B], 2, [{ lotNo: B.lotNo, qty: 3 }])).toThrow(/เกินจำนวน/);
  });
  it("stock without lots (before lot tracking) is reported as short, not an error", () => {
    const r = allocateLots([A], 5);
    expect(r.allocations).toEqual([{ lotNo: A.lotNo, qty: 3, unitCost: 1000 }]);
    expect(r.short).toBe(2);
  });
  it("other costs of a bill are spread by value into unit cost", () => {
    // 2 × 1,000 = 2,000 (40%) และ 10 × 300 = 3,000 (60%) ค่าส่ง 500
    expect(spreadOtherCosts([{ qty: 2, unitCost: 1000 }, { qty: 10, unitCost: 300 }], 500)).toEqual([1100, 330]);
    expect(spreadOtherCosts([{ qty: 2, unitCost: 1000 }], 0)).toEqual([1000]);
    // ของแถมราคา 0 ทั้งบิล: กระจายตามจำนวน
    expect(spreadOtherCosts([{ qty: 1, unitCost: 0 }, { qty: 3, unitCost: 0 }], 100)).toEqual([25, 25]);
  });
});
