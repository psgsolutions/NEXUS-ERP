import { describe, expect, it } from "vitest";
import { EXPENSE_ACCOUNTS, suggestExpenseAccount } from "@/lib/payables";

const [a0, a1, a2] = EXPENSE_ACCOUNTS.map((a) => a.code);

describe("suggest expense account from company history", () => {
  const history = [
    { expenseAccountCode: a1, description: "ค่าน้ำมันรถ ไปหน้างาน", vendor: "ปตท. สาขาลาดกระบัง" },
    { expenseAccountCode: a1, description: "ค่าน้ำมันรถ", vendor: "บางจาก" },
    { expenseAccountCode: a2, description: "กระดาษ A4 หมึกพิมพ์", vendor: "ออฟฟิศเมท" },
    { expenseAccountCode: "9999-99", description: "ค่าน้ำมัน", vendor: "x" }, // รหัสที่ไม่มีในผังค่าใช้จ่าย ไม่นับ
  ];

  it("matches by words in the description", () => {
    expect(suggestExpenseAccount(history, { description: "ค่าน้ำมันรถ เดินทาง" })).toMatchObject({ code: a1, matches: 2 });
  });
  it("same vendor outweighs loose word matches", () => {
    expect(suggestExpenseAccount(history, { vendor: "ออฟฟิศเมท", description: "ของใช้" })?.code).toBe(a2);
  });
  it("no match → no suggestion", () => {
    expect(suggestExpenseAccount(history, { description: "zzz" })).toBeNull();
    void a0;
  });
});
