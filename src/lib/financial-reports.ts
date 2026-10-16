/**
 * รายงานทางการเงินจากสมุดรายวัน (ฟังก์ชันล้วน ใช้ที่ server และทดสอบได้)
 * - ใช้เฉพาะรายการที่ "ลงบัญชีแล้ว" (posted) ตามหลักการทำงบ — รายการร่างแจ้งจำนวนแยกไว้
 * - งบทดลอง / บัญชีแยกประเภท / งบกำไรขาดทุน / งบแสดงฐานะการเงิน
 */
import { CHART_OF_ACCOUNTS, type AccountType } from "./chart-of-accounts";
import { journalDateStr } from "./journal-posting";

const r2 = (n: number) => Math.round(n * 100) / 100;
const linesOf = (j: any): any[] => (Array.isArray(j.items) ? j.items : Array.isArray(j.lines) ? j.lines : []);

// รหัสรุ่นเก่า 6 หลัก -> XXXX-XX (ภาษีขาย/ภาษีซื้อรุ่นเก่าใช้รหัสพิเศษ)
const LEGACY_CODES: Record<string, string> = { "213100": "2121-00", "115100": "1151-00" };
export function normalizeAccountCode(raw: any): string {
  const c = String(raw ?? "").trim();
  if (LEGACY_CODES[c]) return LEGACY_CODES[c];
  if (/^\d{6}$/.test(c)) return `${c.slice(0, 4)}-${c.slice(4)}`;
  return c;
}

const ACCOUNT_MAP = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
export function accountTypeOf(code: string): AccountType | null {
  const known = ACCOUNT_MAP.get(code);
  if (known) return known.type;
  const head = code.charAt(0);
  return head === "1" ? "asset" : head === "2" ? "liability" : head === "3" ? "equity" : head === "4" ? "revenue" : head === "5" ? "expense" : null;
}
export function accountName(code: string, fallback = ""): string {
  return ACCOUNT_MAP.get(code)?.name || fallback || code;
}
/** ยอดปกติด้านเดบิต: สินทรัพย์ ค่าใช้จ่าย */
const debitNormal = (t: AccountType | null) => t === "asset" || t === "expense";

export interface PostingLine {
  date: string; // YYYY-MM-DD (เวลาไทย)
  journalId: string;
  docNo: string;
  description: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
}

/** แตกรายการบัญชีเป็นบรรทัด (เฉพาะ posted ไม่รวมยกเลิก/ตัวอย่าง) */
export function postingLines(journals: any[]): { lines: PostingLine[]; draftCount: number; undatedCount: number } {
  const lines: PostingLine[] = [];
  let draftCount = 0, undatedCount = 0;
  for (const j of journals) {
    if (j.isDeleted === true || j.isSample === true) continue;
    const st = String(j.status || "posted").toLowerCase();
    if (st === "cancelled" || st === "void" || st === "voided") continue;
    if (st === "draft") { draftCount++; continue; }
    const date = journalDateStr(j.date || j.postingDate || j.createdAt);
    if (!date) { undatedCount++; continue; }
    const docNo = String(j.reference || j.documentNo || j.referenceNo || j.journalNo || j.id || "");
    for (const l of linesOf(j)) {
      const code = normalizeAccountCode(l.accountCode || l.accountId || l.code);
      const debit = r2(Number(l.debit ?? l.dr) || 0);
      const credit = r2(Number(l.credit ?? l.cr) || 0);
      if (!code || (!debit && !credit)) continue;
      lines.push({ date, journalId: String(j.id || ""), docNo, description: String(l.description || j.description || ""), code, name: accountName(code, l.accountName), debit, credit });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.docNo.localeCompare(b.docNo));
  return { lines, draftCount, undatedCount };
}

export interface TrialBalanceRow {
  code: string; name: string; type: AccountType | null;
  openingDebit: number; openingCredit: number;
  periodDebit: number; periodCredit: number;
  closingDebit: number; closingCredit: number;
}

const splitBalance = (net: number) => (net >= 0 ? { d: r2(net), c: 0 } : { d: 0, c: r2(-net) });

/** งบทดลอง: ยกมา (ก่อน from) / ระหว่างงวด / คงเหลือ */
export function trialBalance(lines: PostingLine[], from: string, to: string) {
  const acc = new Map<string, { name: string; open: number; dr: number; cr: number }>();
  for (const l of lines) {
    if (l.date > to) continue;
    const a = acc.get(l.code) || { name: l.name, open: 0, dr: 0, cr: 0 };
    if (l.date < from) a.open += l.debit - l.credit;
    else { a.dr += l.debit; a.cr += l.credit; }
    acc.set(l.code, a);
  }
  const rows: TrialBalanceRow[] = Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, a]) => {
      const o = splitBalance(a.open);
      const c = splitBalance(a.open + a.dr - a.cr);
      return { code, name: a.name, type: accountTypeOf(code), openingDebit: o.d, openingCredit: o.c, periodDebit: r2(a.dr), periodCredit: r2(a.cr), closingDebit: c.d, closingCredit: c.c };
    })
    .filter((r) => r.openingDebit || r.openingCredit || r.periodDebit || r.periodCredit || r.closingDebit || r.closingCredit);
  const sum = (k: keyof TrialBalanceRow) => r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  const totals = {
    openingDebit: sum("openingDebit"), openingCredit: sum("openingCredit"),
    periodDebit: sum("periodDebit"), periodCredit: sum("periodCredit"),
    closingDebit: sum("closingDebit"), closingCredit: sum("closingCredit"),
  };
  return { rows, totals, balanced: Math.abs(totals.closingDebit - totals.closingCredit) < 0.01 && Math.abs(totals.periodDebit - totals.periodCredit) < 0.01 };
}

/** บัญชีแยกประเภทรายบัญชี: ยอดยกมา + รายการ + ยอดคงเหลือสะสม (ตามด้านปกติของบัญชี) */
export function generalLedger(lines: PostingLine[], code: string, from: string, to: string) {
  const type = accountTypeOf(code);
  const sign = debitNormal(type) ? 1 : -1;
  let balance = 0;
  const entries: (PostingLine & { balance: number })[] = [];
  for (const l of lines) {
    if (l.code !== code || l.date > to) continue;
    const net = (l.debit - l.credit) * sign;
    if (l.date < from) { balance += net; continue; }
    if (!entries.length) balance = r2(balance);
    balance = r2(balance + net);
    entries.push({ ...l, balance });
  }
  const opening = r2(entries.length ? entries[0].balance - (entries[0].debit - entries[0].credit) * sign : balance);
  return {
    code, name: accountName(code), type, normalSide: sign > 0 ? "debit" : "credit",
    opening, entries,
    totalDebit: r2(entries.reduce((s, e) => s + e.debit, 0)),
    totalCredit: r2(entries.reduce((s, e) => s + e.credit, 0)),
    closing: entries.length ? entries[entries.length - 1].balance : opening,
  };
}

export interface StatementLine { code: string; name: string; amount: number }

/** งบกำไรขาดทุนช่วง from..to (หมวด 4 รายได้, หมวด 5 ต้นทุนและค่าใช้จ่าย; 51xx = ต้นทุนขาย/บริการ) */
export function profitAndLoss(lines: PostingLine[], from: string, to: string) {
  const by = new Map<string, StatementLine>();
  for (const l of lines) {
    if (l.date < from || l.date > to) continue;
    const t = accountTypeOf(l.code);
    if (t !== "revenue" && t !== "expense") continue;
    const cur = by.get(l.code) || { code: l.code, name: l.name, amount: 0 };
    cur.amount += t === "revenue" ? l.credit - l.debit : l.debit - l.credit;
    by.set(l.code, cur);
  }
  const all = Array.from(by.values()).map((x) => ({ ...x, amount: r2(x.amount) })).filter((x) => x.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
  const revenue = all.filter((x) => x.code.startsWith("4"));
  const costOfSales = all.filter((x) => x.code.startsWith("51"));
  const expenses = all.filter((x) => x.code.startsWith("5") && !x.code.startsWith("51"));
  const total = (xs: StatementLine[]) => r2(xs.reduce((s, x) => s + x.amount, 0));
  const totalRevenue = total(revenue), totalCost = total(costOfSales), totalExpense = total(expenses);
  const grossProfit = r2(totalRevenue - totalCost);
  return { revenue, costOfSales, expenses, totalRevenue, totalCost, grossProfit, totalExpense, netProfit: r2(grossProfit - totalExpense) };
}

/** งบแสดงฐานะการเงิน ณ วันที่ asOf — กำไรขาดทุนสะสมที่ยังไม่ปิดบัญชีแสดงรวมในส่วนของเจ้าของ */
export function balanceSheet(lines: PostingLine[], asOf: string) {
  const by = new Map<string, StatementLine & { type: AccountType | null }>();
  let unclosedProfit = 0;
  for (const l of lines) {
    if (l.date > asOf) continue;
    const t = accountTypeOf(l.code);
    if (t === "revenue") { unclosedProfit += l.credit - l.debit; continue; }
    if (t === "expense") { unclosedProfit -= l.debit - l.credit; continue; }
    const cur = by.get(l.code) || { code: l.code, name: l.name, amount: 0, type: t };
    cur.amount += debitNormal(t) ? l.debit - l.credit : l.credit - l.debit;
    by.set(l.code, cur);
  }
  const pick = (t: AccountType) => Array.from(by.values()).filter((x) => x.type === t).map(({ code, name, amount }) => ({ code, name, amount: r2(amount) })).filter((x) => x.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
  const assets = pick("asset"), liabilities = pick("liability"), equity = pick("equity");
  const profit = r2(unclosedProfit);
  if (profit !== 0) equity.push({ code: "", name: "กำไร (ขาดทุน) ที่ยังไม่ปิดบัญชี", amount: profit });
  const total = (xs: StatementLine[]) => r2(xs.reduce((s, x) => s + x.amount, 0));
  const currentAssets = assets.filter((x) => x.code < "1500"), nonCurrentAssets = assets.filter((x) => x.code >= "1500");
  const currentLiabilities = liabilities.filter((x) => x.code < "2200"), nonCurrentLiabilities = liabilities.filter((x) => x.code >= "2200");
  const totalAssets = total(assets), totalLiabilities = total(liabilities), totalEquity = total(equity);
  return {
    currentAssets, nonCurrentAssets, currentLiabilities, nonCurrentLiabilities, equity,
    totalCurrentAssets: total(currentAssets), totalNonCurrentAssets: total(nonCurrentAssets),
    totalCurrentLiabilities: total(currentLiabilities), totalNonCurrentLiabilities: total(nonCurrentLiabilities),
    totalAssets, totalLiabilities, totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

/** วันสุดท้ายของเดือน YYYY-MM */
export function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
