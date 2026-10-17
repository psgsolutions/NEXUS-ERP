import { describe, expect, it } from "vitest";
import { balanceSheet, monthEnd, normalizeAccountCode, postingLines, profitAndLoss, trialBalance } from "@/lib/financial-reports";

const journals = [
  // ยกมา: ทุนจดทะเบียน 100,000 เข้าบัญชีธนาคาร
  { id: "J0", date: "2026-09-01", status: "posted", items: [{ accountCode: "1112-00", debit: 100000, credit: 0 }, { accountCode: "3110-00", debit: 0, credit: 100000 }] },
  // ขายเงินสด 1,000 + VAT 70 (รหัสรุ่นเก่า 6 หลัก)
  { id: "J1", date: "2026-10-05", status: "posted", items: [{ accountCode: "111100", debit: 1070, credit: 0 }, { accountCode: "411100", debit: 0, credit: 1000 }, { accountCode: "213100", debit: 0, credit: 70 }] },
  // ต้นทุนขาย 600
  { id: "J2", date: "2026-10-05", status: "posted", items: [{ accountCode: "5110-00", debit: 600, credit: 0 }, { accountCode: "1131-00", debit: 0, credit: 600 }] },
  // ค่าเช่า 200
  { id: "J3", date: "2026-10-20", status: "posted", items: [{ accountCode: "5310-00", debit: 200, credit: 0 }, { accountCode: "1112-00", debit: 0, credit: 200 }] },
  // ไม่นับ: ร่าง / ยกเลิก / ตัวอย่าง / ไม่มีวันที่
  { id: "D1", date: "2026-10-06", status: "draft", items: [{ accountCode: "1112-00", debit: 999, credit: 0 }, { accountCode: "4110-00", debit: 0, credit: 999 }] },
  { id: "C1", date: "2026-10-06", status: "cancelled", items: [{ accountCode: "1112-00", debit: 5, credit: 0 }, { accountCode: "4110-00", debit: 0, credit: 5 }] },
  { id: "S1", date: "2026-10-06", isSample: true, items: [{ accountCode: "1112-00", debit: 7, credit: 0 }, { accountCode: "4110-00", debit: 0, credit: 7 }] },
  { id: "U1", status: "posted", items: [{ accountCode: "1112-00", debit: 3, credit: 0 }, { accountCode: "4110-00", debit: 0, credit: 3 }] },
];

describe("รายงานการเงิน", () => {
  it("แปลงรหัสบัญชีรุ่นเก่า", () => {
    expect(normalizeAccountCode("411100")).toBe("4111-00");
    expect(normalizeAccountCode("213100")).toBe("2121-00");
    expect(normalizeAccountCode(" 1112-00 ")).toBe("1112-00");
  });

  it("นับเฉพาะรายการที่ลงบัญชีแล้ว", () => {
    const { lines, draftCount, undatedCount } = postingLines(journals);
    expect(draftCount).toBe(1);
    expect(undatedCount).toBe(1);
    expect(new Set(lines.map((l) => l.journalId))).toEqual(new Set(["J0", "J1", "J2", "J3"]));
  });

  it("งบทดลองสมดุล และแยกยอดยกมา/ระหว่างงวด", () => {
    const { lines } = postingLines(journals);
    const tb = trialBalance(lines, "2026-10-01", "2026-10-31");
    expect(tb.balanced).toBe(true);
    const bank = tb.rows.find((r) => r.code === "1112-00")!;
    expect(bank.openingDebit).toBe(100000);
    expect(bank.periodCredit).toBe(200);
    expect(bank.closingDebit).toBe(99800);
  });

  it("กำไรขาดทุน: รายได้ 1,000 ต้นทุน 600 ค่าใช้จ่าย 200", () => {
    const { lines } = postingLines(journals);
    const pl = profitAndLoss(lines, "2026-10-01", "2026-10-31");
    expect(pl.totalRevenue).toBe(1000);
    expect(pl.totalCost).toBe(600);
    expect(pl.grossProfit).toBe(400);
    expect(pl.netProfit).toBe(200);
  });

  it("งบดุลสมดุล โดยรวมกำไรที่ยังไม่ปิดบัญชีในส่วนของเจ้าของ", () => {
    const { lines } = postingLines(journals);
    const bs = balanceSheet(lines, "2026-10-31");
    expect(bs.balanced).toBe(true);
    expect(bs.totalEquity).toBe(100200);
  });

  it("วันสุดท้ายของเดือน", () => {
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(monthEnd("2026-12")).toBe("2026-12-31");
  });
});
