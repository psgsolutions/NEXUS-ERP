/**
 * เงินทดรองจ่าย (ฟังก์ชันล้วน) — วิศวกร/พนักงานเบิกเงินสดไปซื้อของหน้างานก่อน แล้วเคลียร์ด้วยใบเสร็จ
 *  ขอเบิก (REQUESTED) → แอดมินจ่ายเงิน (PAID: Dr เงินทดรองจ่าย 1134 / Cr เงินสด-ธนาคาร)
 *  → เคลียร์ (CLEARED): Dr ค่าใช้จ่าย หรือ งานระหว่างทำ 1161 (ถ้าเป็นของโครงการ) + Dr ภาษีซื้อ 1151 (มีใบกำกับภาษี)
 *                       Cr เงินทดรองจ่าย 1134 · ส่วนต่าง: ใช้ไม่หมดคืนเงิน (Dr เงินสด) / ใช้เกินจ่ายเพิ่ม (Cr เงินสด)
 */

export type AdvanceStatus = "REQUESTED" | "PAID" | "CLEARED" | "REJECTED";
export const ADVANCE_STATUS_TH: Record<AdvanceStatus, string> = { REQUESTED: "รอจ่ายเงิน", PAID: "รอเคลียร์", CLEARED: "เคลียร์แล้ว", REJECTED: "ไม่อนุมัติ" };
export const ADVANCE_ACCOUNT = { code: "1134-00", name: "เงินทดรองจ่าย" };
export const CASH_ACCOUNTS = { CASH: { code: "1111-00", name: "เงินสด" }, TRANSFER: { code: "1112-00", name: "เงินฝากธนาคาร" } } as const;

export interface ClearItem { description: string; amount: number; vat: number; taxInvoiceNo?: string }
export interface JournalLine { accountCode: string; accountName: string; debit: number; credit: number; description?: string }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function normalizeClearItems(raw: any): ClearItem[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 50).map((x: any) => {
    const taxInvoiceNo = String(x?.taxInvoiceNo ?? "").trim().slice(0, 60);
    // ไม่ใส่คีย์ที่ว่าง (Firestore ไม่รับค่า undefined)
    return {
      description: String(x?.description ?? "").trim().slice(0, 200),
      amount: r2(Math.max(0, Number(x?.amount) || 0)),
      vat: r2(Math.max(0, Number(x?.vat) || 0)),
      ...(taxInvoiceNo ? { taxInvoiceNo } : {}),
    } as ClearItem;
  }).filter((x) => x.description && x.amount > 0);
}

/**
 * รายการบัญชีตอนเคลียร์ (amount = ยอดรวมที่จ่ายจริงตามใบเสร็จ, vat = ภาษีซื้อที่อยู่ในยอดนั้น)
 * expenseAccount: บัญชีค่าใช้จ่าย หรือ งานระหว่างทำ (โครงการ)
 */
export function clearingJournal(advance: number, items: ClearItem[], expenseAccount: { code: string; name: string }, method: keyof typeof CASH_ACCOUNTS = "CASH") {
  const spent = r2(items.reduce((s, i) => s + i.amount, 0));
  const vat = r2(items.reduce((s, i) => s + Math.min(i.vat, i.amount), 0));
  const net = r2(spent - vat);
  const diff = r2(advance - spent); // >0 คืนเงิน, <0 จ่ายเพิ่ม
  const cash = CASH_ACCOUNTS[method];
  const lines: JournalLine[] = [
    { accountCode: expenseAccount.code, accountName: expenseAccount.name, debit: net, credit: 0 },
    ...(vat > 0 ? [{ accountCode: "1151-00", accountName: "ภาษีซื้อ", debit: vat, credit: 0 }] : []),
    ...(diff > 0 ? [{ accountCode: cash.code, accountName: cash.name, debit: diff, credit: 0, description: "คืนเงินทดรองที่ใช้ไม่หมด" }] : []),
    { accountCode: ADVANCE_ACCOUNT.code, accountName: ADVANCE_ACCOUNT.name, debit: 0, credit: r2(advance) },
    ...(diff < 0 ? [{ accountCode: cash.code, accountName: cash.name, debit: 0, credit: -diff, description: "จ่ายเพิ่มส่วนที่ใช้เกินเงินทดรอง" }] : []),
  ].filter((l) => l.debit > 0 || l.credit > 0);
  const totalDebit = r2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = r2(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, spent, vat, net, diff, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}
