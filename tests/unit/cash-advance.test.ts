import { describe, expect, it } from "vitest";
import { clearingJournal, normalizeClearItems } from "@/lib/cash-advance";

const WIP = { code: "1161-00", name: "งานระหว่างทำ (WIP)" };

describe("cash advance clearing", () => {
  it("spent less than advance: refund cash, VAT to input tax, project cost to WIP", () => {
    const items = normalizeClearItems([{ description: "สายไฟ", amount: 1070, vat: 70, taxInvoiceNo: "IV1" }, { description: "ค่าน้ำมัน", amount: 500, vat: 0 }, { description: "", amount: 9 }]);
    const j = clearingJournal(2000, items, WIP);
    expect(items).toHaveLength(2);
    expect(j).toMatchObject({ spent: 1570, vat: 70, net: 1500, diff: 430, balanced: true, totalDebit: 2000 });
    expect(j.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([["1161-00", 1500, 0], ["1151-00", 70, 0], ["1111-00", 430, 0], ["1134-00", 0, 2000]]);
  });

  it("spent more than advance: pay the difference", () => {
    const j = clearingJournal(1000, normalizeClearItems([{ description: "อุปกรณ์", amount: 1200, vat: 0 }]), { code: "5300-00", name: "ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป" }, "TRANSFER");
    expect(j.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([["5300-00", 1200, 0], ["1134-00", 0, 1000], ["1112-00", 0, 200]]);
    expect(j.balanced).toBe(true);
  });
});
