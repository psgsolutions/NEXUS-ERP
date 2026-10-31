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
export function salesProfit(invoices: any[], notes: any[], from: string, to: string, by: "customer" | "product") {
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
    if (by === "customer") add(String(n.customerId || n.customerName || "-"), String(n.customerName || "-"), doc, 0, amount, 0, false);
    else add(n.type === "CN" ? "cn" : "dn", n.type === "CN" ? "ใบลดหนี้ (ลดยอดขาย)" : "ใบเพิ่มหนี้ (เพิ่มยอดขาย)", doc, 0, amount, 0, false);
  }
  const out: SalesRow[] = [...rows.values()].map(({ docSet, ...x }) => {
    const revenue = r2(x.revenue), cost = r2(x.cost), profit = r2(revenue - cost);
    return { ...x, docs: docSet.size, qty: r2(x.qty), revenue, cost, profit, margin: revenue > 0 ? r2((profit / revenue) * 100) : null };
  }).sort((a, b) => b.revenue - a.revenue);
  const totals = { revenue: r2(out.reduce((s, x) => s + x.revenue, 0)), cost: r2(out.reduce((s, x) => s + x.cost, 0)) };
  return { rows: out, totals: { ...totals, profit: r2(totals.revenue - totals.cost), margin: totals.revenue > 0 ? r2(((totals.revenue - totals.cost) / totals.revenue) * 100) : null }, costMissing: out.some((x) => x.costMissing) };
}
