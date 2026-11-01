/**
 * รายงานผู้บริหาร (ฟังก์ชันล้วน ใช้ที่ server และทดสอบได้)
 * - งบกระแสเงินสด (วิธีทางตรง) จากรายการบัญชีที่ลงบัญชีแล้ว
 * - ยอดขายและกำไรขั้นต้น รายลูกค้า / รายสินค้า จากใบกำกับภาษี (หักใบลดหนี้ บวกใบเพิ่มหนี้)
 */
import { accountTypeOf, type PostingLine } from "./financial-reports";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- งบกระแสเงินสด ----------
/** เงินสดและเงินฝากธนาคาร (111x ยกเว้นลูกหนี้บัตรเครดิต 1113) */
export const isCashAccount = (code: string) => /^111[0-29]/.test(code);
export type CashActivity = "operating" | "investing" | "financing";
/**
 * จัดหมวดตามบัญชีคู่ของเงินสด: สินทรัพย์ไม่หมุนเวียน (1500 ขึ้นไป) = ลงทุน ·
 * ส่วนของเจ้าของ (3xxx) และหนี้สินไม่หมุนเวียน (2200 ขึ้นไป เช่น เงินกู้ระยะยาว) = จัดหาเงิน · อื่น ๆ = ดำเนินงาน
 */
export function cashActivityOf(code: string): CashActivity {
  const t = accountTypeOf(code);
  if (t === "asset" && code >= "1500") return "investing";
  if (t === "equity" || (t === "liability" && code >= "2200")) return "financing";
  return "operating";
}

export interface CashFlowLine { code: string; name: string; inflow: number; outflow: number; net: number }
/**
 * งบกระแสเงินสดช่วง from..to: แต่ละรายการบัญชีที่มีเงินสดเคลื่อนไหว กระจายเงินสดเข้า/ออกไปที่บัญชีคู่
 * (โอนระหว่างบัญชีเงินสดด้วยกันไม่นับ) — ยอดยกมา + สุทธิ = ยอดคงเหลือ ตรงกับบัญชีเงินสดในงบทดลอง
 */
export function cashFlow(lines: PostingLine[], from: string, to: string) {
  let opening = 0;
  const byJournal = new Map<string, PostingLine[]>();
  for (const l of lines) {
    if (l.date > to) continue;
    if (l.date < from) { if (isCashAccount(l.code)) opening += l.debit - l.credit; continue; }
    const k = l.journalId || `${l.date}|${l.docNo}`;
    byJournal.set(k, [...(byJournal.get(k) || []), l]);
  }
  const acc = new Map<string, CashFlowLine & { activity: CashActivity }>();
  let unbalanced = 0;
  for (const js of byJournal.values()) {
    const cashNet = js.filter((l) => isCashAccount(l.code)).reduce((s, l) => s + l.debit - l.credit, 0);
    if (Math.abs(cashNet) < 0.005) continue;
    const others = js.filter((l) => !isCashAccount(l.code));
    // ผลของบัญชีคู่ต่อเงินสด = ด้านตรงข้าม (เครดิตรายได้/ลูกหนี้ = เงินเข้า)
    const effects = others.map((l) => ({ l, e: l.credit - l.debit }));
    const sum = effects.reduce((s, x) => s + x.e, 0);
    if (Math.abs(sum) < 0.005) { unbalanced += cashNet; continue; }
    // รายการที่บัญชีคู่ไม่สมดุลพอดีกับเงินสด: ปรับสัดส่วนให้รวมเท่าเงินสดสุทธิ
    const k = cashNet / sum;
    for (const { l, e } of effects) {
      const v = e * k;
      if (Math.abs(v) < 0.005) continue;
      const cur = acc.get(l.code) || { code: l.code, name: l.name, inflow: 0, outflow: 0, net: 0, activity: cashActivityOf(l.code) };
      if (v > 0) cur.inflow += v; else cur.outflow += -v;
      cur.net += v;
      acc.set(l.code, cur);
    }
  }
  const section = (a: CashActivity) => {
    const rows = [...acc.values()].filter((x) => x.activity === a).map(({ activity: _a, ...x }) => ({ ...x, inflow: r2(x.inflow), outflow: r2(x.outflow), net: r2(x.net) })).filter((x) => x.inflow || x.outflow).sort((x, y) => x.code.localeCompare(y.code));
    return { rows, total: r2(rows.reduce((s, x) => s + x.net, 0)) };
  };
  const operating = section("operating"), investing = section("investing"), financing = section("financing");
  const net = r2(operating.total + investing.total + financing.total + unbalanced);
  return { opening: r2(opening), operating, investing, financing, unallocated: r2(unbalanced), net, closing: r2(opening + net) };
}

// ---------- ยอดขายและกำไรขั้นต้น ----------
export interface SalesRow { key: string; name: string; docs: number; qty: number; revenue: number; cost: number; profit: number; margin: number | null; costMissing: boolean }
const lineNet = (it: any) => {
  const gross = (Number(it.qty) || 0) * (Number(it.price ?? it.unitPrice) || 0);
  const v = Number(it.discountValue) || 0;
  return Math.max(0, gross - (String(it.discountType).toUpperCase() === "AMOUNT" ? v : (gross * v) / 100));
};
const live = (d: any) => d.isDeleted !== true && d.isSample !== true && String(d.status || "").toLowerCase() !== "cancelled";
const inRange = (d: string, from: string, to: string) => !!d && d >= from && d <= to;

/**
 * ยอดขาย (ก่อน VAT) และกำไรขั้นต้นจากใบกำกับภาษีช่วง from..to
 * - ยอดก่อน VAT ของใบกระจายลงรายการตามสัดส่วนยอดรายการ (ส่วนลดท้ายบิล/ราคารวม VAT แปลงครบ)
 * - ต้นทุน = จำนวน × ต้นทุนต่อหน่วยที่บันทึกในรายการ (ไม่มีต้นทุน = แจ้งว่าต้นทุนไม่ครบ)
 * - ใบลดหนี้/ใบเพิ่มหนี้: ปรับยอดขายของลูกค้า (รายสินค้าแสดงเป็นแถว "ลดหนี้/เพิ่มหนี้")
 * - ใบแจ้งหนี้งานโครงการที่ไม่มีรายการ: ทั้งใบเป็นหนึ่งแถว "งานตามสัญญา/งวดงาน"
 */
export function salesProfit(invoices: any[], notes: any[], from: string, to: string, by: "customer" | "product" | "salesperson") {
  // พนักงานขายของใบ (ใบลดหนี้ใช้พนักงานขายของใบกำกับที่อ้างถึง)
  const seller = (inv: any) => ({ key: String(inv?.salesPersonId || inv?.salespersonName || "-"), name: String(inv?.salespersonName || "ไม่ระบุพนักงานขาย") });
  const invById = new Map(invoices.map((i) => [String(i.id), i]));
  const rows = new Map<string, SalesRow & { docSet: Set<string> }>();
  const add = (key: string, name: string, doc: string, qty: number, revenue: number, cost: number, costMissing: boolean) => {
    const cur = rows.get(key) || { key, name, docs: 0, qty: 0, revenue: 0, cost: 0, profit: 0, margin: null, costMissing: false, docSet: new Set<string>() };
    cur.docSet.add(doc); cur.qty += qty; cur.revenue += revenue; cur.cost += cost; cur.costMissing ||= costMissing;
    rows.set(key, cur);
  };
  for (const inv of invoices) {
    const date = String(inv.issueDate || inv.docDate || "").slice(0, 10);
    if (!live(inv) || !inRange(date, from, to)) continue;
    const doc = String(inv.invoiceNo || inv.documentNo || inv.id || "");
    const base = Number(inv.subTotal) || 0;
    const cust = { key: String(inv.customerId || inv.customerName || "-"), name: String(inv.customerName || inv.customerSnapshot?.name || "-") };
    const items: any[] = (Array.isArray(inv.items) ? inv.items : []).filter((it: any) => it && it.itemType !== "GROUP_HEADER" && !it.isOptional);
    const nets = items.map(lineNet), total = nets.reduce((s, n) => s + n, 0);
    if (by === "salesperson") {
      const sp = seller(inv);
      const cost = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.cost ?? it.costPrice) || 0), 0);
      add(sp.key, sp.name, doc, 0, base, cost, !items.length || items.some((it) => !(Number(it.cost ?? it.costPrice) > 0)));
      continue;
    }
    if (!items.length || total <= 0) {
      if (by === "customer") add(cust.key, cust.name, doc, 0, base, 0, true);
      else add("contract", "งานตามสัญญา / งวดงาน (ไม่มีรายการสินค้า)", doc, 0, base, 0, true);
      continue;
    }
    items.forEach((it, i) => {
      const revenue = (base * nets[i]) / total, qty = Number(it.qty) || 0, unitCost = Number(it.cost ?? it.costPrice);
      const missing = !(unitCost > 0);
      const cost = missing ? 0 : qty * unitCost;
      if (by === "customer") add(cust.key, cust.name, doc, qty, revenue, cost, missing);
      else add(String(it.productId || it.sku || it.name), String(it.name || it.productName || it.sku || "-"), doc, qty, revenue, cost, missing);
    });
  }
  for (const n of notes) {
    const date = String(n.issueDate || "").slice(0, 10);
    if (!live(n) || !inRange(date, from, to)) continue;
    const amount = (Number(n.amount) || 0) * (n.type === "CN" ? -1 : 1);
    const doc = String(n.documentNo || n.id || "");
    if (by === "salesperson") { const sp = seller(invById.get(String(n.invoiceDocId))); add(sp.key, sp.name, doc, 0, amount, 0, false); }
    else if (by === "customer") add(String(n.customerId || n.customerName || "-"), String(n.customerName || "-"), doc, 0, amount, 0, false);
    else add(n.type === "CN" ? "cn" : "dn", n.type === "CN" ? "ใบลดหนี้ (ลดยอดขาย)" : "ใบเพิ่มหนี้ (เพิ่มยอดขาย)", doc, 0, amount, 0, false);
  }
  const out: SalesRow[] = [...rows.values()].map(({ docSet, ...x }) => {
    const revenue = r2(x.revenue), cost = r2(x.cost), profit = r2(revenue - cost);
    return { ...x, docs: docSet.size, qty: r2(x.qty), revenue, cost, profit, margin: revenue > 0 ? r2((profit / revenue) * 100) : null };
  }).sort((a, b) => b.revenue - a.revenue);
  const totals = { revenue: r2(out.reduce((s, x) => s + x.revenue, 0)), cost: r2(out.reduce((s, x) => s + x.cost, 0)) };
  return { rows: out, totals: { ...totals, profit: r2(totals.revenue - totals.cost), margin: totals.revenue > 0 ? r2(((totals.revenue - totals.cost) / totals.revenue) * 100) : null }, costMissing: out.some((x) => x.costMissing) };
}

// ---------- สินค้าเคลื่อนไหวช้า / มูลค่าสต็อกตามอายุ ----------
export const AGING_BUCKETS = [
  { key: "0-30", label: "0–30 วัน", max: 30 }, { key: "31-90", label: "31–90 วัน", max: 90 },
  { key: "91-180", label: "91–180 วัน", max: 180 }, { key: "181-365", label: "181–365 วัน", max: 365 },
  { key: "365+", label: "เกิน 1 ปี", max: Infinity },
] as const;
export interface AgingRow { productId: string; sku: string; name: string; unit: string; onHand: number; unitCost: number; value: number; lastIn: string; lastOut: string; days: number | null; bucket: string; slow: boolean }
const dayMs = 86_400_000;
const isoDay = (v: any): string => {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : "";
};
/**
 * อายุสต็อก ณ วันที่ asOf: นับจากวันที่เบิกออกล่าสุด (ไม่เคยเบิก = นับจากรับเข้าล่าสุด/วันที่สร้างสินค้า)
 * เคลื่อนไหวช้า = มีของคงเหลือและไม่มีการเบิกออกเกิน slowDays วัน · มูลค่า = คงเหลือ × ต้นทุนเฉลี่ย
 */
export function stockAging(products: any[], movements: any[], asOf: string, slowDays = 90) {
  const last = new Map<string, { in: string; out: string }>();
  for (const m of movements) {
    if (m.isDeleted === true) continue;
    const d = isoDay(m.timestamp || m.createdAt), id = String(m.productId || "");
    if (!d || !id || d > asOf) continue;
    const cur = last.get(id) || { in: "", out: "" };
    if (m.type === "OUT" && d > cur.out) cur.out = d;
    if (m.type === "IN" && d > cur.in) cur.in = d;
    last.set(id, cur);
  }
  const ref = new Date(`${asOf}T00:00:00Z`).getTime();
  const rows: AgingRow[] = [];
  for (const p of products) {
    if (p.isDeleted === true) continue;
    const onHand = Number(p.stockStatus?.onHand ?? 0);
    if (!(onHand > 0)) continue;
    const id = String(p.id), l = last.get(id) || { in: "", out: "" };
    const since = l.out || l.in || isoDay(p.createdAt);
    const days = since ? Math.max(0, Math.floor((ref - new Date(`${since}T00:00:00Z`).getTime()) / dayMs)) : null;
    const unitCost = Number(p.pricing?.costWAC ?? p.costPrice ?? 0) || 0;
    const bucket = AGING_BUCKETS.find((b) => (days ?? Infinity) <= b.max)!.key;
    rows.push({ productId: id, sku: String(p.sku || ""), name: String(p.name || "-"), unit: String(p.unit || p.uom || ""), onHand, unitCost, value: r2(onHand * unitCost), lastIn: l.in, lastOut: l.out, days, bucket, slow: days === null || days > slowDays });
  }
  rows.sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9) || b.value - a.value);
  const buckets = AGING_BUCKETS.map((b) => { const xs = rows.filter((r) => r.bucket === b.key); return { key: b.key, label: b.label, items: xs.length, value: r2(xs.reduce((s, r) => s + r.value, 0)) }; });
  const total = r2(rows.reduce((s, r) => s + r.value, 0));
  const slow = rows.filter((r) => r.slow);
  return { rows, buckets, total, slowItems: slow.length, slowValue: r2(slow.reduce((s, r) => s + r.value, 0)), slowDays };
}

// ---------- ตรวจรายการผิดปกติ ----------
export interface Anomaly { kind: string; severity: "high" | "medium"; date: string; docNo: string; detail: string; amount: number; link: string }
const dayOf = (v: any) => (typeof v === "string" ? v.slice(0, 10) : isoDay(v));
const daysBetween = (a: string, b: string) => Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / dayMs;
/**
 * ตรวจตามกฎที่อธิบายได้ (ไม่ใช่ AI) ช่วง from..to:
 * ค่าใช้จ่ายซ้ำ (ผู้รับเงิน+ยอดเดียวกันภายใน 7 วัน) · จ่ายเงินซ้ำ (ผู้รับ+ยอดเดียวกันวันเดียวกัน) · ขายต่ำกว่าทุน ·
 * ส่วนลดต่อรายการ ≥ 30% · ภาษีขายไม่ตรง 7% ของฐาน (ต่างเกิน 1 บาท) · รายการบัญชีร่างค้างเกิน 30 วัน (นับถึง to)
 */
export function findAnomalies(d: { invoices: any[]; expenses: any[]; payments: any[]; journals: any[] }, from: string, to: string, companyId: string): Anomaly[] {
  const out: Anomaly[] = [];
  const inR = (x: string) => !!x && x >= from && x <= to;
  const jl = (id: string) => `/finance/journal/${encodeURIComponent(`companies/${companyId}/journal_entries/${id}`)}`;
  // ค่าใช้จ่ายซ้ำ
  const exps = d.expenses.filter(live).map((e) => ({ e, date: dayOf(e.createdAt || e.docDate), who: String(e.vendor || e.supplierName || e.employeeName || "").trim(), amt: r2(Number(e.totalAmount) || 0) }))
    .filter((x) => x.who && x.amt > 0).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < exps.length; i++) for (let j = i + 1; j < exps.length; j++) {
    const a = exps[i], b = exps[j];
    if (daysBetween(a.date, b.date) > 7) break;
    if (a.who === b.who && a.amt === b.amt && inR(b.date)) out.push({ kind: "ค่าใช้จ่ายอาจบันทึกซ้ำ", severity: "high", date: b.date, docNo: String(b.e.expenseId || b.e.id || ""), detail: `${b.who} ยอดเดียวกับ ${a.e.expenseId || a.e.id} (${a.date})`, amount: b.amt, link: "/procurement" });
  }
  // จ่ายเงินซ้ำ
  const pays = d.payments.filter(live).filter((p) => String(p.status || "").toLowerCase() !== "cancelled");
  const seen = new Map<string, any>();
  for (const p of pays) {
    const date = String(p.paymentDate || ""), key = `${String(p.payeeName || p.payeeKey || "")}|${r2(Number(p.totalAmount) || 0)}|${date}`;
    if (!inR(date)) continue;
    if (seen.has(key)) out.push({ kind: "จ่ายเงินซ้ำวันเดียวกัน", severity: "high", date, docNo: String(p.paymentNo || p.id), detail: `${p.payeeName || "-"} ยอดเดียวกับ ${seen.get(key).paymentNo || seen.get(key).id}`, amount: r2(Number(p.totalAmount) || 0), link: "/finance" });
    else seen.set(key, p);
  }
  // ใบกำกับภาษี: ขายต่ำกว่าทุน · ส่วนลดสูง · VAT ไม่ตรง
  for (const inv of d.invoices.filter(live)) {
    const date = String(inv.issueDate || "").slice(0, 10), no = String(inv.invoiceNo || inv.documentNo || inv.id);
    if (!inR(date) || String(inv.status || "").toLowerCase() === "cancelled") continue;
    for (const it of Array.isArray(inv.items) ? inv.items : []) {
      const price = Number(it.price ?? it.unitPrice) || 0, cost = Number(it.cost ?? it.costPrice) || 0, qty = Number(it.qty) || 0;
      if (cost > 0 && price > 0 && price < cost) out.push({ kind: "ขายต่ำกว่าทุน", severity: "medium", date, docNo: no, detail: `${it.name || it.productName || "-"} ราคา ${price.toLocaleString("th-TH")} ทุน ${cost.toLocaleString("th-TH")}`, amount: r2((cost - price) * qty), link: "/sales" });
      const gross = qty * price, v = Number(it.discountValue) || 0;
      const pct = gross > 0 ? (String(it.discountType).toUpperCase() === "AMOUNT" ? (v / gross) * 100 : v) : 0;
      if (pct >= 30) out.push({ kind: "ส่วนลดสูงผิดปกติ", severity: "medium", date, docNo: no, detail: `${it.name || it.productName || "-"} ลด ${Math.round(pct)}%`, amount: r2((gross * pct) / 100), link: "/sales" });
    }
    const sub = Number(inv.subTotal) || 0, vat = Number(inv.vatAmount) || 0;
    if (vat > 0 && Math.abs(vat - sub * 0.07) > 1) out.push({ kind: "ภาษีขายไม่ตรง 7%", severity: "high", date, docNo: no, detail: `ฐาน ${sub.toLocaleString("th-TH")} ภาษี ${vat.toLocaleString("th-TH")} (ควรเป็น ${r2(sub * 0.07).toLocaleString("th-TH")})`, amount: r2(vat - sub * 0.07), link: "/sales" });
  }
  // รายการบัญชีร่างค้างนาน
  for (const j of d.journals) {
    if (j.isDeleted === true || String(j.status || "").toLowerCase() !== "draft") continue;
    const date = dayOf(j.date || j.createdAt);
    if (!date || date > to || daysBetween(date, to) <= 30) continue;
    const amt = r2((Array.isArray(j.items) ? j.items : []).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0));
    out.push({ kind: "รายการบัญชีรออนุมัติเกิน 30 วัน", severity: "medium", date, docNo: String(j.reference || j.id), detail: String(j.description || "").slice(0, 120), amount: amt, link: jl(String(j.id)) });
  }
  return out.sort((a, b) => (a.severity === b.severity ? b.date.localeCompare(a.date) : a.severity === "high" ? -1 : 1));
}

// ---------- สรุปผลประกอบการรายเดือน ----------
export interface MonthFacts {
  month: string; prevMonth: string;
  sales: number; salesPrev: number; invoices: number; grossProfit: number; grossMargin: number | null; costMissing: boolean;
  postedRevenue: number; postedExpense: number; postedNet: number; drafts: number;
  cashNet: number; cashClosing: number; arOverdue: number; arOverdueCount: number;
  topCustomers: { name: string; revenue: number }[]; topProducts: { name: string; revenue: number }[]; anomaliesHigh: number;
}
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null);
const bahtTh = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;
/** สรุปเป็นข้อความไทยแบบกฎ (ใช้เมื่อไม่มี AI) — ทุกประโยคมาจากตัวเลขใน facts */
export function monthSummaryText(f: MonthFacts, monthLabel: string): string {
  const g = pct(f.sales, f.salesPrev);
  const lines = [
    `ยอดขาย${monthLabel} ${bahtTh(f.sales)} จากใบกำกับภาษี ${f.invoices} ใบ${g === null ? "" : ` ${g >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(g)}% จากเดือนก่อน`}`,
    f.sales ? `กำไรขั้นต้นประมาณ ${bahtTh(f.grossProfit)}${f.grossMargin === null ? "" : ` (${f.grossMargin}%)`}${f.costMissing ? " — บางรายการไม่มีต้นทุน ตัวเลขจริงอาจต่ำกว่านี้" : ""}` : "",
    `ตามบัญชีที่ลงแล้ว: รายได้ ${bahtTh(f.postedRevenue)} ค่าใช้จ่าย ${bahtTh(f.postedExpense)} กำไรสุทธิ ${bahtTh(f.postedNet)}${f.drafts ? ` (ยังมีรายการรออนุมัติ ${f.drafts} รายการ ไม่รวมในตัวเลขนี้)` : ""}`,
    `เงินสดและเงินฝาก${f.cashNet >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${bahtTh(Math.abs(f.cashNet))} คงเหลือปลายเดือน ${bahtTh(f.cashClosing)}`,
    f.arOverdueCount ? `ลูกหนี้เกินกำหนด ${f.arOverdueCount} ใบ รวม ${bahtTh(f.arOverdue)} ควรติดตาม` : "ไม่มีลูกหนี้เกินกำหนด",
    f.topCustomers.length ? `ลูกค้าหลัก: ${f.topCustomers.map((c) => `${c.name} ${bahtTh(c.revenue)}`).join(", ")}` : "",
    f.topProducts.length ? `สินค้า/บริการขายดี: ${f.topProducts.map((p) => p.name).join(", ")}` : "",
    f.anomaliesHigh ? `มีรายการผิดปกติระดับสูง ${f.anomaliesHigh} รายการ — ดูที่ รายงาน › ตรวจความผิดปกติ` : "",
  ].filter(Boolean);
  return lines.map((l) => `• ${l}`).join("\n");
}
