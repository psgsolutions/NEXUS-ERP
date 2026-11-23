import { describe, expect, it } from "vitest";
import { computeDocTotals, sanitizeLines } from "@/lib/doc-totals";

describe("sales order totals: bill discount + per-line withholding tax", () => {
  const lines = [
    { name: "สินค้า", qty: 2, price: 1000, itemType: "PRODUCT" },
    { name: "ค่าติดตั้ง", qty: 1, price: 5000, itemType: "SERVICE", whtRate: 3 },
  ];

  it("matches the quotation after a 500 bill discount (VAT exclusive)", () => {
    const t = computeDocTotals(lines, "exclusive", "lines", 500);
    expect(t.subTotal).toBe(6500);
    expect(t.vatAmount).toBe(455);
    expect(t.grandTotal).toBe(6955);
    // ส่วนลดท้ายบิลกระจายตามสัดส่วน: 5,000 × 6,500/7,000 × 3%
    expect(t.whtAmount).toBe(139.29);
    expect(t.netPayable).toBe(6815.71);
  });

  it("uses the pre-VAT base when prices include VAT", () => {
    const t = computeDocTotals([{ name: "บริการ", qty: 1, price: 1070, whtRate: 3 }], "inclusive", "lines");
    expect(t.subTotal).toBe(1000);
    expect(t.whtAmount).toBe(30);
  });

  it("keeps the old behaviour for callers that pass a document rate (purchase requests)", () => {
    expect(computeDocTotals(lines, "exclusive").whtAmount).toBe(0);
    expect(computeDocTotals(lines, "exclusive", 3).whtAmount).toBe(210);
  });
});

describe("BOM flags carried QT → SO → invoice", () => {
  it("keeps priceManual / bomRounding only when set", () => {
    const out = sanitizeLines([
      { name: "LAN PB", qty: 20, price: 5000, itemType: "SERVICE", priceManual: true, recipe: { materials: [{ productId: "U", qty: 1 }], bom: { kind: "LAN", variant: "PB" }, bomInputs: { routeM: 30 } } },
      { name: "ส่วนต่างปัดทั้งงาน", qty: 1, price: 6.93, itemType: "PRODUCT", bomRounding: true },
      { name: "สินค้า", qty: 1, price: 10 },
    ]);
    expect(out.map((l) => [l.priceManual, l.bomRounding])).toEqual([[true, undefined], [undefined, true], [undefined, undefined]]);
    expect(out[0].price).toBe(5000);
  });
});
