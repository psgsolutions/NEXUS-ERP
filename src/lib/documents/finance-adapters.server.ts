import { adminDb } from "@/lib/firebase-admin";
import { ApiAuthError } from "@/lib/api-auth";
import { getRecord } from "@/lib/master-store.server";
import type { DocumentLine, DocumentModel, DocumentParty, Wht50Form } from "./model";
import { documentProfileOf } from "./profile";
import { mergeSeller } from "./seller.server";
import { partySnapshot } from "./party";
import { quotationLines, totalsRows } from "./build";
import { thaiDate, toDateStr } from "./format";
import { periodEnd } from "@/lib/payroll";

/**
 * เอกสารฝั่งจัดซื้อ/การเงิน/บุคคล -> DocumentModel
 * ใบขอซื้อ, ใบสั่งซื้อ, ใบรับสินค้า, ใบสำคัญจ่าย, หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ), ใบสำคัญบัญชี, สลิปเงินเดือน
 */

const num = (v: any) => Number(v) || 0;
const str = (v: any) => String(v ?? "").trim();
const r2 = (n: number) => Math.round(n * 100) / 100;

async function load(companyId: string, col: string, id: string, notFound: string) {
  const [company, snap] = await Promise.all([adminDb.doc(`companies/${companyId}`).get(), adminDb.doc(`companies/${companyId}/${col}/${id}`).get()]);
  if (!snap.exists) throw new ApiAuthError(404, notFound);
  const d = snap.data()!;
  if (d.companyId && d.companyId !== companyId) throw new ApiAuthError(404, notFound);
  return { d, company: company.data() || {}, seller: mergeSeller(documentProfileOf(company.data()), d.sellerSnapshot) };
}

/** ผู้ขายจากข้อมูลหลัก (snapshot บนเอกสารก่อน ถ้ามี) */
async function supplierParty(companyId: string, label: string, supplierId: any, name: any, snap?: any): Promise<DocumentParty> {
  if (snap && typeof snap === "object" && snap.name) return { label, name: str(snap.name), taxId: str(snap.taxId), branchCode: str(snap.branchCode), address: str(snap.address) };
  const rec = supplierId ? (await getRecord("suppliers", companyId, str(supplierId)))?.data : null;
  const p = partySnapshot(rec, { name: str(name) });
  return {
    label, name: p.name || str(name) || "-", taxId: p.taxId, branchCode: p.branchCode, address: p.address,
    contact: str(rec?.contact_person || rec?.contactName), phone: str(rec?.phone || rec?.phoneNumber), email: str(rec?.email),
  };
}

const upper = (v: any) => String(v || "").toUpperCase();
const statusMark = (st: string, draft: string[]) =>
  ["CANCELLED", "REJECTED"].includes(st) ? "ยกเลิก" : draft.includes(st) ? "รออนุมัติ" : undefined;

function taxTypeOf(v: any) {
  const t = String(v || "").toLowerCase();
  return t.includes("incl") ? "INCLUSIVE" : t.includes("non") || t === "none" || t === "exempt" ? "NONE" : "EXCLUSIVE";
}

function itemLines(items: any[]): DocumentLine[] {
  return quotationLines((Array.isArray(items) ? items : []).map((l) => ({ ...l, details: l.details || l.remark || "" })));
}

export async function loadPurchaseRequest(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "purchase_requests", id, "ไม่พบใบขอซื้อ");
  const lines = itemLines(d.items);
  const net = num(d.subTotal) || r2(lines.reduce((s, l) => s + num(l.amount), 0));
  const taxType = d.vatMode === "include" ? "INCLUSIVE" : d.vatMode === "none" ? "NONE" : "EXCLUSIVE";
  const st = upper(d.status);
  return {
    type: "purchase_request", title: "ใบขอซื้อ", titleEn: "PURCHASE REQUISITION",
    number: str(d.prCode || d.documentNo || id), date: toDateStr(d.requestDate || d.createdAt),
    meta: [
      { label: "ต้องการภายใน", value: d.requiredDate ? thaiDate(d.requiredDate) : "-" },
      { label: "ผู้ขอซื้อ", value: str(d.requester) },
      ...(d.department ? [{ label: "แผนก", value: str(d.department) }] : []),
      ...(d.projectName ? [{ label: "โครงการ", value: str(d.projectName) }] : []),
    ],
    seller,
    party: d.suggestedSupplierName ? await supplierParty(companyId, "ผู้ขายที่แนะนำ", d.suggestedSupplierId, d.suggestedSupplierName) : undefined,
    columns: ["no", "code", "description", "qty", "unit", "price", "amount"],
    lines,
    totals: totalsRows({ lineTotal: net, billDiscount: 0, net, vat: num(d.vatAmount), grand: num(d.totalAmount ?? d.grandTotal), taxType }),
    notes: [d.reason ? `เหตุผลการขอซื้อ: ${str(d.reason)}` : "", str(d.remarks), d.poCode ? `ออกใบสั่งซื้อแล้ว เลขที่ ${str(d.poCode)}` : ""].filter(Boolean),
    signatures: ["ผู้ขอซื้อ", "หัวหน้าแผนก", "ผู้อนุมัติ"],
    watermark: statusMark(st, ["DRAFT", "PENDING_APPROVAL"]),
  };
}

export async function loadPurchaseOrder(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "purchase_orders", id, "ไม่พบใบสั่งซื้อ");
  const lines = itemLines(d.items);
  const lineSum = r2(lines.reduce((s, l) => s + num(l.amount), 0));
  const taxType = taxTypeOf(d.vatType);
  const net = taxType === "INCLUSIVE" ? num(d.totalAmount) : num(d.subTotal) || lineSum;
  const billDiscount = lineSum - net > 0.009 && taxType !== "INCLUSIVE" ? r2(lineSum - net) : 0;
  const st = upper(d.status);
  return {
    type: "purchase_order", title: "ใบสั่งซื้อ", titleEn: "PURCHASE ORDER",
    number: str(d.poCode || d.documentNo || id), date: toDateStr(d.date || d.createdAt),
    meta: [
      { label: "กำหนดส่ง", value: d.expectedDate ? thaiDate(d.expectedDate) : "-" },
      { label: "เงื่อนไขชำระ", value: str(d.paymentTerm) || "-" },
      ...(d.prRef ? [{ label: "อ้างอิงใบขอซื้อ", value: str(d.prRef) }] : []),
      ...(d.projectName ? [{ label: "โครงการ", value: str(d.projectName) }] : []),
      ...(d.warehouseCode ? [{ label: "ส่งที่คลัง", value: str(d.warehouseCode) }] : []),
    ],
    seller,
    party: await supplierParty(companyId, "ผู้ขาย", d.supplierId, d.supplierName, d.supplierSnapshot),
    columns: ["no", "code", "description", "qty", "unit", "price", "discount", "amount"],
    lines,
    totals: totalsRows({ lineTotal: lineSum || net, billDiscount, net, vat: num(d.vatAmount), grand: num(d.totalAmount), taxType }),
    amountInWords: num(d.totalAmount),
    notes: [
      str(d.terms),
      d.currency && d.currency !== "THB" ? `สกุลเงิน ${str(d.currency)} อัตราแลกเปลี่ยน ${num(d.exchangeRate)}` : "",
      "กรุณาแนบสำเนาใบสั่งซื้อนี้พร้อมใบส่งสินค้าและใบกำกับภาษี",
    ].filter(Boolean),
    signatures: ["ผู้สั่งซื้อ", "ผู้อนุมัติ", "ผู้ขายยืนยันรับคำสั่งซื้อ"],
    watermark: statusMark(st, ["DRAFT", "PENDING_APPROVAL", "PENDING"]),
  };
}

export async function loadGoodsReceipt(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "goods_receipts", id, "ไม่พบใบรับสินค้า");
  const items: any[] = Array.isArray(d.items) ? d.items : [];
  const po = d.poRef ? (await adminDb.doc(`companies/${companyId}/purchase_orders/${str(d.poRef)}`).get()).data() : null;
  const total = num(d.totalAmount);
  return {
    type: "goods_receipt", title: "ใบรับสินค้า", titleEn: "GOODS RECEIPT",
    number: str(d.grNo || d.grId || id), date: toDateStr(d.receiptDate || d.createdAt),
    meta: [
      ...(d.poRef ? [{ label: "ใบสั่งซื้อ", value: str(d.poRef) }] : []),
      ...(d.deliveryNote ? [{ label: "ใบส่งของผู้ขาย", value: str(d.deliveryNote) }] : []),
      { label: "คลัง/ตำแหน่ง", value: [str(d.warehouse), d.location && d.location !== d.warehouse ? str(d.location) : ""].filter(Boolean).join(" / ") || "-" },
    ],
    seller,
    party: await supplierParty(companyId, "ผู้ขาย", po?.supplierId, d.supplier || po?.supplierName),
    columns: ["no", "code", "description", "qty", "unit", "price", "amount"],
    lines: items.map((l) => {
      const qty = num(l.qtyReceived ?? l.qty);
      const price = num(l.unitPrice ?? l.price ?? l.cost);
      return { code: str(l.sku), description: str(l.name || l.productName || l.description), detail: str(l.location || l.lotNo), qty, unit: str(l.unit || l.uom), price, amount: r2(qty * price) };
    }),
    totals: [{ label: "มูลค่ารับเข้า (ก่อนภาษี)", amount: total, strong: true }],
    notes: [str(d.remarks), String(d.status || "").toLowerCase() === "cancelled" ? `ยกเลิก: ${str(d.cancelReason) || "-"}` : ""].filter(Boolean),
    signatures: ["ผู้ส่งสินค้า", `ผู้รับสินค้า${d.receivedBy ? ` (${str(d.receivedBy)})` : ""}`, "ผู้ตรวจรับ"],
    watermark: String(d.status || "").toLowerCase() === "cancelled" ? "ยกเลิก" : undefined,
  };
}

export async function loadPayment(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "payments", id, "ไม่พบใบสำคัญจ่าย");
  const lines: any[] = Array.isArray(d.lines) ? d.lines : [];
  const cancelled = String(d.status || "").toLowerCase() === "cancelled";
  const total = num(d.totalAmount), wht = num(d.totalWht);
  return {
    type: "payment", title: "ใบสำคัญจ่าย", titleEn: "PAYMENT VOUCHER",
    number: str(d.paymentNo || d.documentNo || id), date: toDateStr(d.paymentDate || d.createdAt),
    meta: [
      { label: "จ่ายโดย", value: str(d.paymentMethodLabel || d.paymentMethod) },
      ...(d.bankAccount ? [{ label: "บัญชี", value: str(d.bankAccount) }] : []),
      ...(d.cheque?.chequeNo ? [{ label: "เช็คเลขที่", value: `${str(d.cheque.chequeNo)}${d.cheque.chequeDate ? ` (${thaiDate(d.cheque.chequeDate)})` : ""}` }] : []),
      ...(d.reference ? [{ label: "อ้างอิง", value: str(d.reference) }] : []),
    ],
    seller,
    party: await supplierParty(companyId, "จ่ายให้", d.supplierId, d.payeeName, d.payeeSnapshot),
    columns: ["no", "description", "amount"],
    lines: lines.map((l) => ({
      description: `ชำระตามรายการค่าใช้จ่าย ${str(l.expenseNo)}`,
      detail: [
        num(l.vat) ? `ก่อนภาษี ${num(l.preVat).toLocaleString("th-TH", { minimumFractionDigits: 2 })} · VAT ${num(l.vat).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "",
        num(l.whtAmount) ? `หัก ณ ที่จ่าย ${num(l.whtRate)}% = ${num(l.whtAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "",
      ].filter(Boolean).join(" · "),
      amount: num(l.amount),
    })),
    totals: [
      { label: "รวมจ่ายชำระ", amount: total, strong: !wht },
      ...(wht ? [{ label: "หัก ณ ที่จ่าย", amount: -wht }, { label: "จ่ายสุทธิ", amount: num(d.netPaid), strong: true }] : []),
    ],
    amountInWords: num(d.netPaid ?? total),
    notes: [
      Array.isArray(d.whtCertificates) && d.whtCertificates.length ? `หนังสือรับรองหัก ณ ที่จ่าย: ${d.whtCertificates.join(", ")}` : "",
      str(d.note),
      cancelled ? `ยกเลิกเมื่อ ${thaiDate(d.cancelDate || d.cancelledAt)}: ${str(d.cancelReason) || "-"}` : "",
    ].filter(Boolean),
    signatures: ["ผู้จัดทำ", "ผู้อนุมัติจ่าย", "ผู้รับเงิน"],
    watermark: cancelled ? "ยกเลิก" : undefined,
  };
}

/** ประเภทเงินได้ตามอัตราหัก (คำสั่งกรมสรรพากร ท.ป.4/2528): แถว 5 ของแบบ */
export function whtIncomeOf(rate: number, override?: any): { row: 1 | 2 | 3 | 4 | 5 | 6; label: string } {
  const o = str(override);
  if (o && !/ค่าบริการ \/ ค่าจ้าง/.test(o)) return { row: 5, label: o };
  return { row: 5, label: rate === 1 ? "ค่าขนส่ง" : rate === 2 ? "ค่าโฆษณา" : rate === 5 ? "ค่าเช่า" : "ค่าบริการ / ค่าจ้างทำของ" };
}

export async function loadWht(companyId: string, id: string): Promise<DocumentModel> {
  const { d, company } = await load(companyId, "withholding_taxes", id, "ไม่พบหนังสือรับรองการหักภาษี ณ ที่จ่าย");
  const payerProfile = mergeSeller(documentProfileOf(company), d.payerSnapshot);
  let payee = d.payee && d.payee.name ? d.payee : null;
  if (!payee) {
    const rec = d.supplierId ? (await getRecord("suppliers", companyId, str(d.supplierId)))?.data : null;
    payee = partySnapshot(rec, { name: str(d.vendor || d.vendorName), taxId: str(d.taxId) });
  }
  const corporate = payee.corporate ?? (String(payee.taxId || "").startsWith("0") || d.vendorType === "CORPORATE");
  const rate = num(d.whtRate);
  const income = whtIncomeOf(rate, d.incomeType);
  const date = toDateStr(d.filingDate || d.issuedAt || d.createdAt);
  const form: Wht50Form = {
    bookNo: str(d.bookNo),
    payer: { name: payerProfile.name, taxId: payerProfile.taxId, branchCode: payerProfile.branchCode, address: payerProfile.address },
    payee: { name: str(payee.name), taxId: str(payee.taxId), branchCode: str(payee.branchCode), address: str(payee.address) },
    form: corporate ? "PND53" : "PND3",
    rows: [{ ...income, label: `${income.label} ${rate}%`, date, amount: num(d.baseAmount), tax: num(d.whtAmount ?? d.taxAmount) }],
    payCondition: 1,
    issueDate: date,
    references: [d.paymentRef ? `ใบสำคัญจ่าย ${str(d.paymentRef)}` : "", d.expenseId ? `รายการค่าใช้จ่าย ${str(d.expenseId)}` : ""].filter(Boolean).join(" · "),
  };
  const cancelled = String(d.status || "").toLowerCase() === "cancelled";
  return {
    type: "wht", title: "หนังสือรับรองการหักภาษี ณ ที่จ่าย", number: str(d.whtId || id), date,
    meta: [], seller: payerProfile, lines: [], totals: [], signatures: [],
    notes: cancelled ? [`ยกเลิก: ${str(d.cancelReason) || "-"}`] : [],
    watermark: cancelled ? "ยกเลิก" : undefined,
    wht50: form,
  };
}

export async function loadJournal(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await load(companyId, "journal_entries", id, "ไม่พบใบสำคัญบัญชี");
  const raw: any[] = Array.isArray(d.items) ? d.items : Array.isArray(d.lines) ? d.lines : [];
  const lines: DocumentLine[] = raw.map((l) => ({
    code: str(l.accountCode || l.accountId), description: str(l.accountName), detail: str(l.description || l.memo),
    debit: num(l.debit), credit: num(l.credit),
  }));
  const dr = r2(lines.reduce((s, l) => s + num(l.debit), 0)), cr = r2(lines.reduce((s, l) => s + num(l.credit), 0));
  const st = String(d.status || "").toLowerCase();
  const BOOK: Record<string, string> = { JV: "สมุดรายวันทั่วไป", PV: "สมุดรายวันจ่าย", RV: "สมุดรายวันรับ", SV: "สมุดรายวันขาย", PV_INTERNAL: "สมุดรายวันซื้อ" };
  return {
    type: "journal", title: "ใบสำคัญบัญชี", titleEn: "JOURNAL VOUCHER",
    number: str(d.jvId || d.journalNo || d.documentNo || id), date: toDateStr(d.date || d.createdAt),
    meta: [
      { label: "สมุดบัญชี", value: BOOK[str(d.bookType)] || str(d.bookType) || "สมุดรายวันทั่วไป" },
      ...(d.reference || d.referenceId ? [{ label: "อ้างอิง", value: str(d.reference || d.referenceId) }] : []),
      { label: "สถานะ", value: st === "posted" ? "ผ่านรายการแล้ว" : st === "voided" || st === "cancelled" ? "ยกเลิก" : "ร่าง (รอผ่านรายการ)" },
    ],
    seller,
    columns: ["no", "code", "description", "debit", "credit"],
    lines,
    totals: [{ label: "รวมเดบิต", amount: dr }, { label: "รวมเครดิต", amount: cr, strong: true }],
    notes: [`คำอธิบาย: ${str(d.description).replace(/^\[AUTO\]\s*/, "") || "-"}`, ...(d.reversalOf ? [`กลับรายการของใบสำคัญ ${str(d.reversalOf)}`] : []), ...(Math.abs(dr - cr) > 0.009 ? ["⚠ ยอดเดบิตและเครดิตไม่เท่ากัน"] : [])],
    signatures: ["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ"],
    watermark: st === "voided" || st === "cancelled" ? "ยกเลิก" : undefined,
  };
}

/** สลิปเงินเดือน: id = "{YYYY-MM}~{employeeDocId}" */
export async function loadPayslip(companyId: string, id: string): Promise<DocumentModel> {
  const [period, empId] = id.split("~");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || "") || !empId) throw new ApiAuthError(400, "รหัสสลิปเงินเดือนไม่ถูกต้อง");
  const { d, seller } = await load(companyId, "payrolls", period, "ไม่พบงวดเงินเดือน");
  const l = (Array.isArray(d.lines) ? d.lines : []).find((x: any) => x.employeeDocId === empId);
  if (!l) throw new ApiAuthError(404, "ไม่พบพนักงานในงวดนี้");
  const daily = l.employmentType === "daily";
  const income: DocumentLine[] = [
    { description: daily ? `ค่าจ้างรายวัน (${num(l.workDays)} วัน × ${num(l.rate).toLocaleString("th-TH")} บาท)` : "เงินเดือน", amount: num(l.base) },
    ...(num(l.overtime) ? [{ description: "ค่าล่วงเวลา", amount: num(l.overtime) }] : []),
    ...(num(l.allowance) ? [{ description: "เบี้ยเลี้ยง / ค่าตอบแทนอื่น", amount: num(l.allowance) }] : []),
    ...(num(l.otherIncome) ? [{ description: "รายได้อื่น", amount: num(l.otherIncome) }] : []),
  ];
  const deduct: DocumentLine[] = [
    { description: "เงินสมทบประกันสังคม", amount: num(l.sso) },
    { description: "ภาษีเงินได้หัก ณ ที่จ่าย", amount: num(l.wht) },
    ...(num(l.otherDeduction) ? [{ description: "รายการหักอื่น", amount: num(l.otherDeduction) }] : []),
  ];
  const totalDeduct = r2(deduct.reduce((s, x) => s + num(x.amount), 0));
  const status = String(d.status || "");
  return {
    type: "payslip", title: "ใบแจ้งเงินเดือน", titleEn: "PAY SLIP",
    number: `${period}-${str(l.employeeId) || empId}`, date: toDateStr(d.payDate) || periodEnd(period),
    meta: [
      { label: "งวด", value: str(d.periodLabel) || period },
      { label: "วันที่จ่าย", value: d.payDate ? thaiDate(d.payDate) : "ยังไม่จ่าย" },
      ...(l.bankAccount ? [{ label: "โอนเข้าบัญชี", value: `${str(l.bankName)} ${str(l.bankAccount)}`.trim() }] : []),
    ],
    seller,
    party: { label: "พนักงาน", name: str(l.name), contactLabel: "รหัส / ตำแหน่ง", contact: [str(l.employeeId), str(l.position)].filter(Boolean).join(" · ") },
    columns: ["no", "description", "amount"],
    lines: [{ heading: true, description: "รายได้" }, ...income, { heading: true, description: "รายการหัก" }, ...deduct],
    totals: [
      { label: "รวมรายได้", amount: num(l.gross) },
      { label: "รวมรายการหัก", amount: -totalDeduct },
      { label: "รับสุทธิ", amount: num(l.net), strong: true },
    ],
    amountInWords: num(l.net),
    notes: ["เอกสารนี้เป็นความลับเฉพาะบุคคล", ...(num(l.employerSso) ? [`นายจ้างสมทบประกันสังคม ${num(l.employerSso).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`] : [])],
    signatures: ["ผู้จ่ายเงิน", "ผู้รับเงิน"],
    watermark: status === "draft" ? "ฉบับร่าง" : status === "cancelled" ? "ยกเลิก" : undefined,
  };
}
