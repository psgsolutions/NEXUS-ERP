import { describe, expect, it } from "vitest";
import { projectItemsToQuotationLines, quotationTotals } from "@/lib/project-quotation";
import { normalizeLines } from "@/lib/quotation.server";

const items = [
  { kind: "GROUP", name: "หมวดอุปกรณ์" },
  { lineId: "a", kind: "PRODUCT", name: "กล้อง", qty: 3, unit: "ตัว", unitPrice: 1000, unitCost: 600, discountType: "PERCENT", discountValue: 0, whtRate: 0 },
  { lineId: "b", kind: "LABOR", name: "ค่าติดตั้ง", qty: 1, unitPrice: 500, unitCost: 300, whtRate: 3 },
  { lineId: "c", kind: "PRODUCT", name: "ทางเลือก", qty: 1, unitPrice: 9999, isOptional: true },
];

describe("project items -> quotation", () => {
  it("maps kinds and keeps optional lines", () => {
    const lines = normalizeLines(projectItemsToQuotationLines(items));
    expect(lines.map((l) => l.itemType)).toEqual(["GROUP_HEADER", "PRODUCT", "LABOR", "PRODUCT"]);
    expect(lines[1]).toMatchObject({ productName: "กล้อง", qty: 3, uom: "ตัว", unitPrice: 1000, costPrice: 600, lineTotal: 3000 });
  });

  it("totals: exclusive VAT, optional excluded, WHT from line rate", () => {
    const lines = normalizeLines(projectItemsToQuotationLines(items));
    expect(quotationTotals(lines, "EXCLUSIVE")).toEqual({ subTotal: 3500, netTotal: 3500, docDiscountAmount: 0, discountTotal: 0, vatAmount: 245, grandTotal: 3745, whtAmount: 15, netPayable: 3730 });
    expect(quotationTotals(lines, "INCLUSIVE").vatAmount).toBe(228.97);
    expect(quotationTotals(lines, "EXCLUSIVE", 500)).toMatchObject({ subTotal: 3000, vatAmount: 210, grandTotal: 3210 });
  });
});
