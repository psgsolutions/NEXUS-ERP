import { describe, expect, it } from "vitest";
import { postingLines, trialBalance } from "@/lib/financial-reports";
import { cashActivityOf, cashFlow, salesProfit } from "@/lib/management-reports";

const j = (id: string, date: string, items: [string, number, number][]) => ({ id, date, status: "posted", items: items.map(([accountCode, debit, credit]) => ({ accountCode, debit, credit })) });

describe("cash flow statement (direct method)", () => {
  const journals = [
    j("open", "2026-09-30", [["1112-00", 10000, 0], ["3111-00", 0, 10000]]),       // ทุนจดทะเบียน (ก่อนงวด)
    j("sale", "2026-10-05", [["1111-00", 1070, 0], ["4111-00", 0, 1000], ["2121-00", 0, 70]]), // ขายสด
    j("ar", "2026-10-06", [["1112-00", 500, 0], ["1131-00", 0, 500]]),             // รับชำระลูกหนี้
    j("asset", "2026-10-10", [["1611-00", 3000, 0], ["1112-00", 0, 3000]]),        // ซื้อสินทรัพย์
    j("loan", "2026-10-12", [["1112-00", 5000, 0], ["2211-00", 0, 5000]]),         // กู้ยืมระยะยาว
    j("move", "2026-10-15", [["1111-00", 0, 200], ["1112-00", 200, 0]]),           // โอนระหว่างบัญชีเงินสด
    j("exp", "2026-10-20", [["5311-00", 400, 0], ["1111-00", 0, 400]]),            // จ่ายค่าใช้จ่าย
    j("later", "2026-11-01", [["1111-00", 999, 0], ["4111-00", 0, 999]]),          // หลังงวด
  ];
  const { lines } = postingLines(journals);
  const cf = cashFlow(lines, "2026-10-01", "2026-10-31");

  it("classifies by the counter account and reconciles with the cash balance", () => {
    expect(cashActivityOf("1611-00")).toBe("investing");
    expect(cashActivityOf("2211-00")).toBe("financing");
    expect(cashActivityOf("4111-00")).toBe("operating");
    expect(cf.opening).toBe(10000);
    expect(cf.operating.total).toBe(1070 + 500 - 400);
    expect(cf.investing.total).toBe(-3000);
    expect(cf.financing.total).toBe(5000);
    expect(cf.net).toBe(1070 + 500 - 3000 + 5000 - 400);
    // ยอดคงเหลือ = เงินสด + เงินฝากในงบทดลอง
    const tb = trialBalance(lines, "2026-10-01", "2026-10-31");
    const cash = tb.rows.filter((r) => r.code.startsWith("111")).reduce((s, r) => s + r.closingDebit - r.closingCredit, 0);
    expect(cf.closing).toBe(Math.round(cash * 100) / 100);
    // โอนระหว่างบัญชีเงินสดไม่ถือเป็นกระแสเงินสด
    expect([...cf.operating.rows, ...cf.investing.rows, ...cf.financing.rows].some((r) => r.code.startsWith("111"))).toBe(false);
  });
});

describe("sales and gross profit", () => {
  const invoices = [
    { id: "i1", invoiceNo: "INV-1", issueDate: "2026-10-05", customerId: "C1", customerName: "ลูกค้า ก", subTotal: 900, items: [
      { productId: "P1", name: "ตู้", qty: 2, price: 300, cost: 200 }, { productId: "P2", name: "สาย", qty: 4, price: 100, cost: 0 }] },
    { id: "i2", invoiceNo: "INV-2", issueDate: "2026-10-09", customerId: "C2", customerName: "ลูกค้า ข", subTotal: 300, items: [{ productId: "P1", name: "ตู้", qty: 1, price: 300, cost: 200 }] },
    { id: "i3", invoiceNo: "INV-3", issueDate: "2026-10-10", customerId: "C1", customerName: "ลูกค้า ก", subTotal: 5000, items: [] },
    { id: "x", invoiceNo: "INV-X", issueDate: "2026-10-11", customerId: "C1", subTotal: 999, status: "cancelled", items: [] },
    { id: "o", invoiceNo: "INV-O", issueDate: "2026-11-01", customerId: "C1", subTotal: 999, items: [] },
  ];
  const notes = [{ id: "n1", documentNo: "CN-1", type: "CN", issueDate: "2026-10-20", customerId: "C2", customerName: "ลูกค้า ข", amount: 50 }];

  it("by customer: allocates the invoice amount to lines, nets credit notes, flags missing cost", () => {
    const r = salesProfit(invoices, notes, "2026-10-01", "2026-10-31", "customer");
    const a = r.rows.find((x) => x.key === "C1")!, b = r.rows.find((x) => x.key === "C2")!;
    expect(a.revenue).toBe(5900);
    expect(a.docs).toBe(2);
    expect(a.cost).toBe(400);
    expect(a.costMissing).toBe(true);
    expect(b.revenue).toBe(250);
    expect(b.profit).toBe(50);
    expect(r.totals.revenue).toBe(6150);
  });

  it("by product: quantity, revenue share and profit per product", () => {
    const r = salesProfit(invoices, notes, "2026-10-01", "2026-10-31", "product");
    const p1 = r.rows.find((x) => x.key === "P1")!;
    // INV-1: ตู้ 600 จาก 1000 → 540 · INV-2: 300
    expect(p1).toMatchObject({ qty: 3, revenue: 840, cost: 600, profit: 240 });
    expect(r.rows.find((x) => x.key === "cn")!.revenue).toBe(-50);
    expect(r.rows.find((x) => x.key === "contract")!.revenue).toBe(5000);
  });
});
