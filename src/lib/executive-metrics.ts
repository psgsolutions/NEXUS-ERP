/**
 * ตัวเลขภาพรวมสำหรับผู้บริหาร (ฟังก์ชันล้วน ใช้ได้ทั้ง server และทดสอบ)
 * - เงินสด/เงินฝาก จากรายการบัญชีหมวด 111x
 * - ลูกหนี้/เจ้าหนี้คงค้าง แยกตามอายุหนี้นับจากวันครบกำหนด
 */
import { lastMonthKeys, monthlyProfitAndLoss, toMillis, type MonthlyPL } from "./dashboard-metrics";

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 24 * 3600 * 1000;
const lines = (j: any): any[] => (Array.isArray(j.items) ? j.items : Array.isArray(j.lines) ? j.lines : []);
const isVoid = (x: any) => x.isDeleted === true || x.isSample === true || ["cancelled", "void", "voided"].includes(String(x.status || "").toLowerCase());

/** รายการบัญชีที่ใช้คำนวณ (ไม่รวมที่ยกเลิก/ตัวอย่าง) */
export function liveJournals(journals: any[]): any[] {
  return journals.filter((j) => !isVoid(j));
}

/** ยอดคงเหลือบัญชีเงินสดและเงินฝาก (ผังบัญชี 111x) */
export function cashBalance(journals: any[]): { cash: number; bank: number; total: number } {
  let cash = 0, bank = 0;
  for (const j of liveJournals(journals)) {
    for (const l of lines(j)) {
      const code = String(l.accountCode || l.accountId || l.code || "");
      const net = (Number(l.debit) || 0) - (Number(l.credit) || 0);
      if (code.startsWith("1111")) cash += net;
      else if (code.startsWith("111")) bank += net;
    }
  }
  return { cash: r2(cash), bank: r2(bank), total: r2(cash + bank) };
}

export const AGING_BUCKETS = [
  { key: "current", label: "ยังไม่ถึงกำหนด" },
  { key: "d30", label: "เกิน 1–30 วัน" },
  { key: "d60", label: "เกิน 31–60 วัน" },
  { key: "d90", label: "เกิน 61–90 วัน" },
  { key: "over90", label: "เกิน 90 วัน" },
] as const;
export type AgingKey = (typeof AGING_BUCKETS)[number]["key"];

export interface AgingSummary {
  total: number;
  overdue: number;
  count: number;
  buckets: { key: AgingKey; label: string; amount: number; count: number }[];
  /** คู่ค้าที่ค้างมากสุด */
  top: { name: string; amount: number; overdue: number; oldestDays: number }[];
}

function bucketOf(daysPast: number): AgingKey {
  if (daysPast <= 0) return "current";
  if (daysPast <= 30) return "d30";
  if (daysPast <= 60) return "d60";
  if (daysPast <= 90) return "d90";
  return "over90";
}

/** สรุปอายุหนี้จากรายการที่มียอดค้าง (outstanding > 0) */
export function agingSummary(rows: { name: string; outstanding: number; dueMs: number }[], now = Date.now(), topN = 5): AgingSummary {
  const buckets = AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: 0, count: 0 }));
  const byName = new Map<string, { amount: number; overdue: number; oldestDays: number }>();
  let total = 0, overdue = 0, count = 0;
  for (const r of rows) {
    if (!(r.outstanding > 0.009)) continue;
    const days = r.dueMs > 0 ? Math.floor((now - r.dueMs) / DAY) : 0;
    const b = buckets.find((x) => x.key === bucketOf(days))!;
    b.amount += r.outstanding; b.count += 1;
    total += r.outstanding; count += 1;
    if (days > 0) overdue += r.outstanding;
    const cur = byName.get(r.name) || { amount: 0, overdue: 0, oldestDays: 0 };
    cur.amount += r.outstanding;
    if (days > 0) cur.overdue += r.outstanding;
    cur.oldestDays = Math.max(cur.oldestDays, days);
    byName.set(r.name, cur);
  }
  const top = Array.from(byName.entries())
    .map(([name, v]) => ({ name, amount: r2(v.amount), overdue: r2(v.overdue), oldestDays: v.oldestDays }))
    .sort((a, b) => b.overdue - a.overdue || b.amount - a.amount)
    .slice(0, topN);
  return { total: r2(total), overdue: r2(overdue), count, buckets: buckets.map((b) => ({ ...b, amount: r2(b.amount) })), top };
}

/** ลูกหนี้: ใบแจ้งหนี้/ใบกำกับภาษีที่ยังค้างรับ */
export function receivableRows(invoices: any[]) {
  return invoices
    .filter((inv) => !isVoid(inv))
    .map((inv) => {
      const total = Number(inv.grandTotal ?? inv.totalAmount ?? 0) || 0;
      const paid = String(inv.paymentStatus || "").toLowerCase() === "paid";
      const outstanding = inv.balance !== undefined ? Number(inv.balance) || 0 : paid ? 0 : total;
      return { name: String(inv.customerName || inv.customerSnapshot?.name || "ไม่ระบุลูกค้า"), outstanding: r2(outstanding), dueMs: toMillis(inv.dueDate) };
    });
}

/** เจ้าหนี้: รายการค่าใช้จ่ายที่ยังค้างจ่าย */
export function payableRows(expenses: any[]) {
  return expenses
    .filter((e) => !isVoid(e))
    .map((e) => {
      const total = Number(e.totalAmount ?? e.amount ?? 0) || 0;
      const outstanding = e.balance !== undefined ? Number(e.balance) || 0 : total - (Number(e.paidAmount) || 0);
      return { name: String(e.supplierName || e.vendor || e.employeeName || "ไม่ระบุผู้รับเงิน"), outstanding: r2(outstanding), dueMs: toMillis(e.dueDate) };
    });
}

/** รายได้ ค่าใช้จ่าย กำไร 12 เดือน + สะสมปีนี้ (ปีปฏิทิน) */
export function profitOverview(journals: any[], now = Date.now()): { months: MonthlyPL[]; ytdRevenue: number; ytdExpense: number; ytdProfit: number } {
  const keys = lastMonthKeys(12, now);
  const months = monthlyProfitAndLoss(liveJournals(journals), keys);
  const year = new Date(now + 7 * 3600e3).getUTCFullYear();
  const thisYear = monthlyProfitAndLoss(liveJournals(journals), keys.filter((k) => Number(k.slice(0, 4)) === year));
  const ytdRevenue = r2(thisYear.reduce((s, m) => s + m.revenue, 0));
  const ytdExpense = r2(thisYear.reduce((s, m) => s + m.expense, 0));
  return { months, ytdRevenue, ytdExpense, ytdProfit: r2(ytdRevenue - ytdExpense) };
}
