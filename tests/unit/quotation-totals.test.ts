import { describe, expect, it } from "vitest";
import { normalizeLines, quotationTotals } from "@/lib/quotation.server";
import { calculateERPDocument } from "@/lib/erp-logic";

const raw = [
  { itemType: "GROUP_HEADER", productName: "หมวด" },
  { productName: "ตู้", qty: 2, unitPrice: 1500, costPrice: 900, discountType: "PERCENT", discountValue: 10 },
  { productName: "สาย", qty: 3, unitPrice: 333.33, costPrice: 200, discountType: "AMOUNT", discountValue: 50 },
];

describe("quotation header totals are recomputed on the server", () => {
  it("ignores tampered totals from the screen", () => {
    const header = { taxType: "EXCLUSIVE", docDiscountType: "AMOUNT", docDiscountValue: 100, grandTotal: 1, subTotal: 1, vatAmount: 0 };
    const t = quotationTotals(header, normalizeLines(raw));
    // (3000 − 300) + (999.99 − 50) − 100 = 3549.99 · VAT 7% = 248.50
    expect(t.subTotal).toBe(3549.99);
    expect(t.vatAmount).toBe(248.5);
    expect(t.grandTotal).toBe(3798.49);
    expect(t.netPayable).toBe(3798.49);
  });

  it("matches the screen calculation for VAT-inclusive prices and percent bill discount", () => {
    const header = { taxType: "INCLUSIVE", docDiscountType: "PERCENT", docDiscountValue: 5 };
    const t = quotationTotals(header, normalizeLines(raw));
    const screen = calculateERPDocument(normalizeLines(raw).map((l, i) => ({ id: String(i), qty: l.qty, costPrice: l.costPrice, projectPrice: l.unitPrice, retailPrice: l.unitPrice, itemType: l.itemType, discountType: l.discountType, discountValue: l.discountValue, isGroupHeader: l.itemType === "GROUP_HEADER" })), "INCLUSIVE", true, 0, 7, "PERCENT", 5);
    expect(t.grandTotal).toBeCloseTo(screen.grandTotal, 2);
    expect(t.vatAmount).toBeCloseTo(screen.vatAmount, 2);
  });

  it("caps withholding tax and recomputes net payable", () => {
    const t = quotationTotals({ taxType: "EXCLUSIVE", whtAmount: 999999 }, normalizeLines([{ productName: "งาน", qty: 1, unitPrice: 1000 }]));
    expect(t.whtAmount).toBe(150);
    expect(t.netPayable).toBe(1070 - 150);
  });
});
