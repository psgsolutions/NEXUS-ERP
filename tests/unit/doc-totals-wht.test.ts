import { describe, expect, it } from "vitest";
import { computeDocTotals } from "@/lib/doc-totals";

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
