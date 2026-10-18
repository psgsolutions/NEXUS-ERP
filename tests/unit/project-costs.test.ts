import { describe, expect, it } from "vitest";
import { costVsBudget, forecastProfit, projectCostLines } from "@/lib/project-costs";

const input = {
  expenses: [
    { expenseId: "EXP1", documentType: "Expense", poRef: "PO1", subTotal: 30000, vatAmount: 2100 },        // PO โครงการ
    { expenseId: "EXP2", documentType: "Expense", poRef: "PO2", subTotal: 9999 },                          // PO เข้าสต็อก (ไม่นับ)
    { expenseId: "EXP3", documentType: "Subcontract", subTotal: 20000 },
    { expenseId: "EXP4", documentType: "ExpenseClaim", subTotal: 1500, description: "ค่าน้ำมัน" },
    { expenseId: "EXP5", documentType: "ExpenseClaim", subTotal: 800, status: "Cancelled" },
  ],
  purchaseOrders: [
    { poCode: "PO1", orderType: "PROJECT", status: "RECEIVED", subTotal: 30000, expenseId: "EXP1" },
    { poCode: "PO2", orderType: "STOCK", status: "RECEIVED", subTotal: 9999 },
    { poCode: "PO3", orderType: "PROJECT", status: "APPROVED", subTotal: 12000 },
    { poCode: "PO4", orderType: "PROJECT", status: "PENDING_APPROVAL", subTotal: 5000 },
  ],
  siteJournals: [{ reference: "WIP-1", totalDebit: 700, description: "[WIP ASSET] ค่าเดินทาง", status: "draft" }],
  stockIssueJournals: [{ soNo: "SO1", journal: { items: [{ accountCode: "5111-00", debit: 4500, credit: 0 }, { accountCode: "1141-00", debit: 0, credit: 4500 }] } }],
};

describe("project actual cost vs budget", () => {
  it("collects actual lines by category without double counting stock purchases", () => {
    const { lines, committed } = projectCostLines(input);
    expect(lines.map((l) => [l.docNo, l.category, l.amount])).toEqual(expect.arrayContaining([
      ["EXP1", "materials", 30000], ["EXP3", "labor", 20000], ["EXP4", "operating", 1500], ["WIP-1", "operating", 700], ["SO1", "materials", 4500],
    ]));
    expect(lines.find((l) => l.docNo === "EXP2")).toBeUndefined();
    expect(lines.find((l) => l.docNo === "EXP5")).toBeUndefined();
    expect(committed.map((c) => [c.docNo, c.amount])).toEqual([["PO3", 12000]]);
  });

  it("compares with budget and forecasts profit", () => {
    const { lines, committed } = projectCostLines(input);
    const cmp = costVsBudget({ materials: 40000, labor: 25000, operating: 2000 }, lines, committed);
    expect(cmp.rows[0]).toMatchObject({ category: "materials", actual: 34500, committed: 12000, remaining: -6500, usedPercent: 116.3 });
    expect(cmp.total).toMatchObject({ budget: 67000, actual: 56700, committed: 12000, remaining: -1700 });
    // วัสดุเกินงบ 6,500 -> ต้นทุนคาด = 46,500 + 25,000 + 2,200 = 73,700
    expect(forecastProfit(100000, cmp)).toEqual({ expectedCost: 73700, profit: 26300, percent: 26.3 });
  });
});
