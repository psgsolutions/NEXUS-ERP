import { describe, expect, it } from "vitest";
import { cndnLines } from "@/lib/cndn";

const invoice = {
  vatType: "Exclude VAT", subTotal: 3500,
  items: [
    { lineNo: 1, productId: "P1", name: "สินค้า", qty: 3, price: 1000, cost: 400, unit: "ชิ้น", itemType: "PRODUCT" },
    { lineNo: 2, name: "ค่าติดตั้ง", qty: 1, price: 500, itemType: "SERVICE" },
  ],
};

describe("credit/debit note lines from the original invoice", () => {
  it("values returned items at the invoice net price, before VAT", () => {
    const r = cndnLines(invoice, [{ lineNo: 1, qty: 2 }], "CN");
    expect(r.error).toBe("");
    expect(r.amount).toBe(2000);
    expect(r.lines[0]).toMatchObject({ productId: "P1", qty: 2, unitPrice: 1000, unitCost: 400 });
  });

  it("allows a lower unit price (partial price reduction)", () => {
    expect(cndnLines(invoice, [{ lineNo: 2, qty: 1, unitPrice: 100 }], "CN").amount).toBe(100);
  });

  it("refuses returning more than sold, counting earlier credit notes", () => {
    const r = cndnLines({ ...invoice, returnedQty: { 1: 2 } }, [{ lineNo: 1, qty: 2 }], "CN");
    expect(r.error).toContain("ไม่เกิน 1");
  });

  it("converts VAT-inclusive prices and spreads the bill discount", () => {
    const inc = { vatType: "Include VAT", subTotal: 900, items: [{ lineNo: 1, name: "A", qty: 1, price: 1070 }] };
    // 1,070 รวม VAT = 1,000 ก่อน VAT · ใบเดิมมีส่วนลดท้ายบิลจนเหลือ 900 → คืน 1 ชิ้น = 900
    expect(cndnLines(inc, [{ lineNo: 1, qty: 1 }], "CN").amount).toBe(900);
  });
});
