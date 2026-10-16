/**
 * บัญชีย่อยและทะเบียน (ฟังก์ชันล้วน ใช้ที่ server และทดสอบได้)
 * - ใบแจ้งยอดลูกค้า / ผู้ขาย (ยอดยกมา + เอกสาร + ยอดคงเหลือสะสม)
 * - สมุดเงินฝาก/เงินสด จากใบเสร็จ ใบสำคัญจ่าย และการคืนเงินลูกค้า
 * - จับคู่รายการกระทบยอดธนาคารกับ statement
 * - บัญชีคุมสินค้า (stock card) และมูลค่าสินค้าคงเหลือ
 * - ทะเบียนสินทรัพย์ถาวร
 */
import { journalDateStr } from "./journal-posting";
import { assetBookValue, assetCost, assetSalvage, monthlyDepreciation } from "./depreciation";
import { payeeKeyOf } from "./payables";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => Number(v) || 0;
const live = (x: any) => x && x.isDeleted !== true && x.isSample !== true && !["cancelled", "void", "voided"].includes(String(x.status || "").toLowerCase());
const day = (v: any) => journalDateStr(v);

export interface StatementEntry { date: string; docNo: string; kind: string; ref: string; debit: number; credit: number; balance: number }

function runStatement(items: Omit<StatementEntry, "balance">[], from: string, to: string) {
  const sorted = items.filter((i) => i.date && i.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.docNo.localeCompare(b.docNo));
  let opening = 0;
  for (const i of sorted) if (i.date < from) opening += i.debit - i.credit;
  let bal = r2(opening);
  const entries: StatementEntry[] = [];
  for (const i of sorted) {
    if (i.date < from) continue;
    bal = r2(bal + i.debit - i.credit);
    entries.push({ ...i, balance: bal });
  }
  return {
    opening: r2(opening), entries,
    totalDebit: r2(entries.reduce((s, e) => s + e.debit, 0)),
    totalCredit: r2(entries.reduce((s, e) => s + e.credit, 0)),
    closing: bal,
  };
}

/** ใบแจ้งยอดลูกค้า: เดบิต = ใบกำกับ/ใบเพิ่มหนี้/คืนเงิน, เครดิต = รับชำระ (รวมภาษีถูกหัก)/ใบลดหนี้ */
export function customerStatement(customerId: string, src: { invoices: any[]; receipts: any[]; cndns: any[]; refunds: any[] }, from: string, to: string) {
  const items: Omit<StatementEntry, "balance">[] = [];
  for (const i of src.invoices) if (live(i) && i.customerId === customerId) items.push({ date: day(i.issueDate || i.date || i.createdAt), docNo: String(i.invoiceNo || i.documentNo || i.id), kind: "ใบกำกับภาษี/ใบแจ้งหนี้", ref: String(i.orderRefNo || ""), debit: r2(num(i.grandTotal ?? i.totalAmount)), credit: 0 });
  for (const r of src.receipts) if (live(r) && r.customerId === customerId) items.push({ date: day(r.paymentDate || r.createdAt), docNo: String(r.receiptNo || r.documentNo || r.id), kind: "รับชำระ", ref: String(r.invoiceNo || ""), debit: 0, credit: r2(num(r.totalApplied ?? r.amount)) });
  for (const d of src.cndns) {
    if (!live(d) || d.customerId !== customerId) continue;
    const cn = String(d.type || "").toUpperCase() === "CN";
    const amt = r2(num(d.totalAmount));
    items.push({ date: day(d.issueDate || d.createdAt), docNo: String(d.cndnNo || d.documentNo || d.id), kind: cn ? "ใบลดหนี้" : "ใบเพิ่มหนี้", ref: String(d.invoiceNo || ""), debit: cn ? 0 : amt, credit: cn ? amt : 0 });
  }
  for (const f of src.refunds) if (live(f) && f.customerId === customerId) items.push({ date: day(f.refundDate || f.createdAt), docNo: String(f.refundNo || f.id), kind: "คืนเงินลูกค้า", ref: String(f.invoiceNo || ""), debit: r2(num(f.amount)), credit: 0 });
  return runStatement(items, from, to);
}

/** คีย์ผู้รับเงิน (รูปแบบเดียวกับใบสำคัญจ่าย: SUP:/EMP:/NAME:) */
export { payeeKeyOf };

/** ใบแจ้งยอดผู้ขาย: เครดิต = ตั้งหนี้ (ยอดรวม), เดบิต = จ่ายชำระ (รวมภาษีหัก ณ ที่จ่าย) — ยอดคงเหลือ = ค้างจ่าย */
export function supplierStatement(payeeKey: string, src: { expenses: any[]; payments: any[] }, from: string, to: string) {
  const items: Omit<StatementEntry, "balance">[] = [];
  for (const e of src.expenses) if (live(e) && payeeKeyOf(e) === payeeKey) items.push({ date: day(e.issuedAt || e.date || e.createdAt), docNo: String(e.expenseId || e.id), kind: e.documentType === "Subcontract" ? "ค่าแรงผู้รับเหมา" : "ตั้งหนี้ค่าใช้จ่าย", ref: String(e.supplierTaxInvoiceNo || e.poRef || ""), debit: r2(num(e.totalAmount ?? e.amount)), credit: 0 });
  for (const p of src.payments) {
    if (!live(p)) continue;
    if (p.payeeKey !== payeeKey) continue;
    items.push({ date: day(p.paymentDate || p.createdAt), docNo: String(p.paymentNo || p.documentNo || p.id), kind: "จ่ายชำระ", ref: String(p.expenseNos || ""), debit: 0, credit: r2(num(p.totalAmount)) });
  }
  // แสดงแบบ "ยอดค้างจ่าย": ตั้งหนี้เพิ่มยอด จ่ายลดยอด
  return runStatement(items, from, to);
}

export interface BankAccount { id: string; name: string; bankName?: string; accountNo?: string; openingBalance?: number; openingDate?: string; legacyLabels?: string[] }
export interface BookEntry { key: string; date: string; docNo: string; kind: string; party: string; method: string; inAmount: number; outAmount: number; balance: number }

/** เอกสารนี้เข้าบัญชีไหน: บัญชีธนาคารตามรหัส / ข้อความเดิมที่ตรงกับบัญชี / เงินสด */
export function bookOf(doc: any, accounts: BankAccount[]): string {
  if (String(doc.paymentMethod || "").toUpperCase() === "CASH") return "CASH";
  if (doc.bankAccountId && accounts.some((a) => a.id === doc.bankAccountId)) return doc.bankAccountId;
  const label = String(doc.bankAccount || "").trim().toLowerCase();
  if (label) {
    const hit = accounts.find((a) => [a.name, a.accountNo, ...(a.legacyLabels || [])].filter(Boolean).some((t) => label.includes(String(t).toLowerCase())));
    if (hit) return hit.id;
  }
  return "UNASSIGNED";
}

/** สมุดเงินฝาก/เงินสดของบัญชีหนึ่ง (bookId = รหัสบัญชีธนาคาร หรือ "CASH" / "UNASSIGNED") */
export function bankBook(bookId: string, accounts: BankAccount[], src: { receipts: any[]; payments: any[]; refunds: any[] }, from: string, to: string) {
  const acc = accounts.find((a) => a.id === bookId);
  const startDate = acc?.openingDate || "";
  const items: Omit<BookEntry, "balance">[] = [];
  const push = (doc: any, kind: string, date: string, party: string, inAmount: number, outAmount: number, docNo: string) => {
    if (!live(doc) || bookOf(doc, accounts) !== bookId || !date) return;
    if (startDate && date < startDate) return;
    items.push({ key: `${kind}:${docNo}`, date, docNo, kind, party, method: String(doc.paymentMethodLabel || doc.paymentMethod || ""), inAmount: r2(inAmount), outAmount: r2(outAmount) });
  };
  for (const r of src.receipts) push(r, "รับเงิน", day(r.paymentDate || r.createdAt), String(r.customerName || ""), num(r.cashReceived ?? r.amount), 0, String(r.receiptNo || r.id));
  for (const p of src.payments) push(p, "จ่ายเงิน", day(p.paymentDate || p.createdAt), String(p.payeeName || ""), 0, num(p.netPaid ?? p.totalAmount), String(p.paymentNo || p.id));
  for (const f of src.refunds) push(f, "คืนเงินลูกค้า", day(f.refundDate || f.createdAt), String(f.customerName || ""), 0, num(f.amount), String(f.refundNo || f.id));
  items.sort((a, b) => a.date.localeCompare(b.date) || a.docNo.localeCompare(b.docNo));
  let opening = num(acc?.openingBalance);
  for (const i of items) if (i.date < from) opening += i.inAmount - i.outAmount;
  let bal = r2(opening);
  const entries: BookEntry[] = [];
  for (const i of items) {
    if (i.date < from || i.date > to) continue;
    bal = r2(bal + i.inAmount - i.outAmount);
    entries.push({ ...i, balance: bal });
  }
  return {
    opening: r2(opening), entries,
    totalIn: r2(entries.reduce((s, e) => s + e.inAmount, 0)),
    totalOut: r2(entries.reduce((s, e) => s + e.outAmount, 0)),
    closing: bal,
  };
}

export interface StatementRow { date: string; description: string; amount: number } // + เงินเข้า, − เงินออก

/**
 * จับคู่รายการในสมุดกับ statement ธนาคาร: ยอดเท่ากัน (ทิศทางเดียวกัน) และวันที่ห่างไม่เกิน windowDays
 * เลือกคู่ที่วันที่ใกล้ที่สุดก่อน แต่ละรายการจับคู่ได้ครั้งเดียว
 */
export function matchStatement(book: BookEntry[], rows: StatementRow[], windowDays = 3) {
  const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const candidates: { b: number; s: number; gap: number }[] = [];
  book.forEach((e, bi) => {
    const signed = r2(e.inAmount - e.outAmount);
    rows.forEach((r, si) => {
      if (Math.abs(r2(r.amount) - signed) > 0.009) return;
      const gap = Math.abs(toMs(e.date) - toMs(r.date)) / 86400000;
      if (gap <= windowDays) candidates.push({ b: bi, s: si, gap });
    });
  });
  candidates.sort((a, b) => a.gap - b.gap);
  const usedB = new Set<number>(), usedS = new Set<number>();
  const matches: { bookKey: string; rowIndex: number }[] = [];
  for (const c of candidates) {
    if (usedB.has(c.b) || usedS.has(c.s)) continue;
    usedB.add(c.b); usedS.add(c.s);
    matches.push({ bookKey: book[c.b].key, rowIndex: c.s });
  }
  return {
    matches,
    unmatchedBook: book.filter((_, i) => !usedB.has(i)).map((e) => e.key),
    unmatchedRows: rows.map((_, i) => i).filter((i) => !usedS.has(i)),
  };
}

/** แปลง CSV statement ธนาคาร: หาคอลัมน์ วันที่ / รายละเอียด / ถอน / ฝาก หรือ จำนวนเงิน (รองรับ dd/mm/yyyy พ.ศ.) */
export function parseStatementCsv(text: string): { rows: StatementRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const split = (l: string) => {
    const out: string[] = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === "," || ch === "\t") { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const errors: string[] = [];
  const headerIdx = lines.findIndex((l) => /วันที่|date/i.test(l));
  if (headerIdx < 0) return { rows: [], errors: ["ไม่พบหัวคอลัมน์ 'วันที่' ในไฟล์"] };
  const head = split(lines[headerIdx]).map((h) => h.toLowerCase());
  const find = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iDate = find(/วันที่|date/), iDesc = find(/รายละเอียด|รายการ|description|detail|memo/);
  const iOut = find(/ถอน|withdraw|debit|จ่าย/), iIn = find(/ฝาก|deposit|credit|รับ/), iAmt = find(/จำนวนเงิน|amount/);
  if (iOut < 0 && iIn < 0 && iAmt < 0) return { rows: [], errors: ["ไม่พบคอลัมน์จำนวนเงิน (ถอน/ฝาก หรือ จำนวนเงิน)"] };
  const toNum = (s: string) => { const n = Number(String(s || "").replace(/[,\s฿]/g, "").replace(/^\((.*)\)$/, "-$1")); return Number.isFinite(n) ? n : 0; };
  const toDate = (s: string) => {
    const t = String(s || "").trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) { const y = Number(m[1]) > 2400 ? Number(m[1]) - 543 : Number(m[1]); return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`; }
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) { let y = Number(m[3]); if (y < 100) y += y > 50 ? 2500 : 2000; if (y > 2400) y -= 543; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    return "";
  };
  const rows: StatementRow[] = [];
  lines.slice(headerIdx + 1).forEach((l, i) => {
    const c = split(l);
    const date = toDate(c[iDate]);
    if (!date) { errors.push(`แถว ${headerIdx + i + 2}: อ่านวันที่ไม่ได้ (${c[iDate] || "-"})`); return; }
    const amount = iAmt >= 0 && iIn < 0 && iOut < 0 ? toNum(c[iAmt]) : toNum(c[iIn]) - toNum(c[iOut]);
    if (!amount) return;
    rows.push({ date, description: iDesc >= 0 ? c[iDesc] || "" : "", amount: r2(amount) });
  });
  return { rows, errors };
}

/** บัญชีคุมสินค้า: เคลื่อนไหวของสินค้าเดียว พร้อมยอดคงเหลือและต้นทุนเฉลี่ย */
export function stockCard(movements: any[], from: string, to: string) {
  const ms = (m: any) => { const t = m.timestamp || m.createdAt; const s = t?.seconds ?? t?._seconds; return s !== undefined ? s * 1000 : Date.parse(String(t || "")) || 0; };
  const sorted = movements.filter((m) => m && m.isDeleted !== true).sort((a, b) => ms(a) - ms(b));
  let qty = 0, wac = 0, openingQty = 0, openingWac = 0;
  const entries: { date: string; ref: string; type: string; location: string; inQty: number; outQty: number; unitCost: number; balanceQty: number; wac: number; value: number }[] = [];
  for (const m of sorted) {
    const date = journalDateStr(new Date(ms(m)));
    const type = String(m.type || "").toUpperCase();
    const q = Math.abs(num(m.quantity));
    const isIn = type === "IN" || type === "RETURN" || (type === "ADJUST" && num(m.quantity) > 0);
    const isOut = type === "OUT" || type === "SALE" || (type === "ADJUST" && num(m.quantity) < 0);
    const nextQty = m.newOnHand !== undefined ? num(m.newOnHand) : qty + (isIn ? q : isOut ? -q : 0);
    const nextWac = m.newWAC !== undefined ? num(m.newWAC) : wac || num(m.unitCost);
    if (date > to) break;
    if (date < from) { qty = nextQty; wac = nextWac; openingQty = qty; openingWac = wac; continue; }
    qty = nextQty; wac = nextWac;
    entries.push({
      date, ref: String(m.referenceId || m.transactionId || ""), type,
      location: String(m.toLocation || m.fromLocation || ""),
      inQty: isIn ? q : type === "TRANSFER" ? 0 : 0, outQty: isOut ? q : 0,
      unitCost: r2(num(m.unitCost)), balanceQty: r2(qty), wac: r2(wac), value: r2(qty * wac),
    });
  }
  return { openingQty: r2(openingQty), openingValue: r2(openingQty * openingWac), entries, closingQty: r2(qty), closingValue: r2(qty * wac) };
}

/** มูลค่าสินค้าคงเหลือ ณ ปัจจุบัน (ยอดคงเหลือ × ต้นทุนเฉลี่ย) */
export function inventoryValuation(products: any[]) {
  const rows = products
    .filter((p) => p && p.isDeleted !== true && p.isSample !== true && (p.itemType || "PRODUCT") === "PRODUCT")
    .map((p) => {
      const onHand = num(p.stockStatus?.onHand ?? p.currentStock);
      const wac = num(p.pricing?.costWAC ?? p.costPrice ?? p.cost);
      return { id: String(p.id), sku: String(p.sku || ""), name: String(p.name || p.productName || p.id), category: String(p.category || p.categoryName || "-"), unit: String(p.unit || "ชิ้น"), onHand: r2(onHand), reserved: r2(num(p.stockStatus?.reserved)), wac: r2(wac), value: r2(onHand * wac) };
    })
    .sort((a, b) => b.value - a.value);
  const byCategory = Array.from(rows.reduce((m, r) => m.set(r.category, r2((m.get(r.category) || 0) + r.value)), new Map<string, number>()).entries())
    .map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
  return { rows, byCategory, totalValue: r2(rows.reduce((s, r) => s + r.value, 0)), totalItems: rows.length };
}

/** ทะเบียนสินทรัพย์ถาวร */
export function assetRegister(assets: any[]) {
  const rows = assets
    .filter((a) => a && a.isDeleted !== true && a.isSample !== true)
    .map((a) => ({
      id: String(a.id), code: String(a.assetCode || a.code || a.id), name: String(a.name || a.assetName || "-"), category: String(a.category || "-"),
      purchaseDate: journalDateStr(a.purchaseDate || a.acquiredAt || a.createdAt), cost: r2(assetCost(a)), salvage: r2(assetSalvage(a)),
      lifeYears: num(a.usefulLifeYears), monthly: r2(monthlyDepreciation(a)),
      accumulated: r2(num(a.accumulatedDepreciation)), bookValue: r2(assetBookValue(a)),
      lastPeriod: String(a.lastDepreciationPeriod || ""), status: String(a.status || "active"),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const sum = (k: "cost" | "accumulated" | "bookValue" | "monthly") => r2(rows.reduce((s, r) => s + r[k], 0));
  return { rows, totals: { cost: sum("cost"), accumulated: sum("accumulated"), bookValue: sum("bookValue"), monthly: sum("monthly") } };
}
