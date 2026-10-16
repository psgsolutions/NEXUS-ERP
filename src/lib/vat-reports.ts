/**
 * รายงานภาษีขาย / ภาษีซื้อ รายเดือน จากเอกสารต้นทาง (ฟังก์ชันล้วน)
 * - ภาษีขาย: ใบกำกับภาษี (+) ใบเพิ่มหนี้ (+) ใบลดหนี้ (−) ที่ไม่ถูกยกเลิก ตามวันที่ออกเอกสาร
 * - ภาษีซื้อ: ใบกำกับภาษีซื้อที่บันทึกตั้งหนี้ (ตามวันที่ใบกำกับ) + ภาษีซื้อที่บันทึกตอนจ่ายเงิน (ตามวันที่จ่าย)
 */
import { journalDateStr } from "./journal-posting";

const r2 = (n: number) => Math.round(n * 100) / 100;
const live = (x: any) => x && x.isDeleted !== true && x.isSample !== true && String(x.status || "").toLowerCase() !== "cancelled";

export interface VatRow {
  date: string;
  docNo: string;
  refNo: string;
  name: string;
  taxId: string;
  branch: string;
  base: number;
  vat: number;
  kind: string;
}

const branchLabel = (b: any) => {
  const s = String(b ?? "").trim();
  if (!s || s === "00000" || s === "สำนักงานใหญ่") return "สำนักงานใหญ่";
  return s;
};

export function outputVatRows(invoices: any[], cndns: any[], ym: string): VatRow[] {
  const rows: VatRow[] = [];
  for (const inv of invoices) {
    if (!live(inv)) continue;
    const date = journalDateStr(inv.issueDate || inv.date || inv.createdAt);
    const vat = Number(inv.vatAmount) || 0;
    if (!date.startsWith(ym) || !(vat > 0)) continue;
    const c = inv.customerSnapshot || {};
    rows.push({
      date, docNo: String(inv.invoiceNo || inv.documentNo || inv.id), refNo: String(inv.orderRefNo || ""),
      name: String(c.name || inv.customerName || "-"), taxId: String(c.taxId || inv.customerTaxId || ""), branch: branchLabel(c.branch),
      base: r2(Number(inv.subTotal) || 0), vat: r2(vat), kind: "ใบกำกับภาษี",
    });
  }
  for (const d of cndns) {
    if (!live(d)) continue;
    const date = journalDateStr(d.issueDate || d.date || d.createdAt);
    const vat = Number(d.vatAmount) || 0;
    if (!date.startsWith(ym) || !(vat > 0)) continue;
    const sign = String(d.type || "").toUpperCase() === "CN" ? -1 : 1;
    const c = d.customerSnapshot || {};
    rows.push({
      date, docNo: String(d.cndnNo || d.documentNo || d.id), refNo: String(d.invoiceNo || ""),
      name: String(c.name || d.customerName || "-"), taxId: String(c.taxId || ""), branch: branchLabel(c.branch),
      base: r2(sign * (Number(d.amount) || 0)), vat: r2(sign * vat), kind: sign < 0 ? "ใบลดหนี้" : "ใบเพิ่มหนี้",
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.docNo.localeCompare(b.docNo));
}

export function inputVatRows(expenses: any[], payments: any[], supplierTaxIds: Map<string, string>, ym: string): VatRow[] {
  const rows: VatRow[] = [];
  const byId = new Map(expenses.map((e) => [String(e.id), e]));
  for (const e of expenses) {
    if (!live(e) || !e.supplierTaxInvoiceNo) continue;
    const date = journalDateStr(e.supplierTaxInvoiceDate || e.issuedAt);
    const vat = Number(e.vatAmount) || 0;
    if (!date.startsWith(ym) || !(vat > 0)) continue;
    rows.push({
      date, docNo: String(e.supplierTaxInvoiceNo), refNo: String(e.expenseId || e.id),
      name: String(e.supplierName || e.vendor || "-"), taxId: String(e.supplierTaxId || supplierTaxIds.get(e.supplierId) || ""), branch: branchLabel(e.supplierBranch),
      base: r2(Number(e.subTotal ?? (Number(e.totalAmount) || 0) - vat) || 0), vat: r2(vat), kind: "ใบกำกับภาษีซื้อ",
    });
  }
  for (const p of payments) {
    if (!live(p)) continue;
    const date = journalDateStr(p.paymentDate || p.date || p.createdAt);
    if (!date.startsWith(ym)) continue;
    for (const l of Array.isArray(p.lines) ? p.lines : []) {
      const vat = Number(l.vat) || 0;
      if (!(vat > 0)) continue;
      const e = byId.get(String(l.expenseDocId)) || {};
      if (e.supplierTaxInvoiceNo) continue; // ภาษีซื้อบันทึกจากใบกำกับแล้ว
      rows.push({
        date, docNo: String(e.supplierTaxInvoiceNo || l.expenseNo || l.expenseDocId || ""), refNo: String(p.paymentNo || p.documentNo || p.id),
        name: String(p.payeeName || e.supplierName || "-"), taxId: String(e.supplierTaxId || supplierTaxIds.get(e.supplierId || p.supplierId) || ""), branch: branchLabel(e.supplierBranch),
        base: r2(Number(l.preVat) || 0), vat: r2(vat), kind: "ภาษีซื้อตอนจ่าย",
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.docNo.localeCompare(b.docNo));
}

export function vatTotals(rows: VatRow[]) {
  return { base: r2(rows.reduce((s, r) => s + r.base, 0)), vat: r2(rows.reduce((s, r) => s + r.vat, 0)), count: rows.length };
}
