import { adminDb } from "@/lib/firebase-admin";
import { DOC_COLUMN_LABELS } from "./build";
import { ApiAuthError } from "@/lib/api-auth";
import type { DocumentModel, DocumentParty } from "./model";
import { documentProfileOf } from "./profile";
import { mergeSeller } from "./seller.server";
import { quotationLines, totalsRows } from "./build";
import { thaiDate, toDateStr } from "./format";
import { customerDocProfile } from "./customer-profile.server";
import { showDocDate } from "@/lib/customer-doc-profile";

/**
 * เอกสารภาษีฝั่งขาย -> DocumentModel
 * ใบกำกับภาษี (ม.86/4), ใบวางบิล, ใบเสร็จรับเงิน, ใบลดหนี้/ใบเพิ่มหนี้ (ม.86/9, 86/10), บิลขายหน้าร้าน
 * ข้อมูลผู้ขายใช้ค่าที่บันทึกไว้ ณ วันที่ออก (sellerSnapshot) ถ้ามี
 */

const num = (v: any) => Number(v) || 0;
const str = (v: any) => String(v ?? "").trim();
const r2 = (n: number) => Math.round(n * 100) / 100;

async function companyAndDoc(companyId: string, path: string, notFound: string) {
  const [company, snap] = await Promise.all([adminDb.doc(`companies/${companyId}`).get(), adminDb.doc(path).get()]);
  if (!snap.exists || snap.data()!.isDeleted === true && !snap.data()!.cancelReason) throw new ApiAuthError(404, notFound);
  const d = snap.data()!;
  return { d, seller: mergeSeller(documentProfileOf(company.data()), d.sellerSnapshot) };
}

/** ลูกค้าจาก snapshot (รองรับทั้งรูปแบบใบสั่งขายและใบเสนอราคา) */
export function partyOf(label: string, snap: any, fallbackName = ""): DocumentParty {
  const c = snap || {};
  const branch = str(c.branch ?? c.customerBranch ?? c.branchName);
  return {
    label,
    name: str(c.name || c.customerName) || fallbackName,
    taxId: str(c.taxId || c.customerTaxId),
    branchCode: str(c.branchCode || c.customerBranchCode) || (branch.match(/\d{5}/) || [""])[0],
    branchName: branch,
    address: str(c.address || c.customerAddress || c.billingAddress),
  };
}

const cancelled = (d: any) => String(d.status || "").toLowerCase() === "cancelled";
const cancelNote = (d: any) => (cancelled(d) ? [`ยกเลิกเมื่อ ${thaiDate(d.cancelDate || d.cancelledAt)}: ${str(d.cancelReason) || "-"}${d.replacedByNo ? ` (ออกฉบับใหม่แทน เลขที่ ${d.replacedByNo})` : ""}`] : []);

export function taxTypeOf(vatType: any) {
  const v = String(vatType || "").toLowerCase();
  return v.includes("include") ? "INCLUSIVE" : v.includes("non") ? "NONE" : "EXCLUSIVE";
}

/** ใบแจ้งหนี้งวดงาน / เบิกคืนเงินประกันผลงาน (งานบริการ VAT เกิดตอนรับเงิน — ไม่ใช่ใบกำกับภาษี) */
function progressBillModel(d: any, seller: any, id: string): DocumentModel {
  const isRetention = d.docKind === "retention";
  const isAdvance = d.docKind === "advance";
  const money = (n: number) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wht = num(d.expectedWhtRate);
  const totals = isRetention || isAdvance ? [
    { label: isAdvance ? `เงินล่วงหน้า ${num(d.advancePercent)}%` : "เงินประกันผลงานที่เบิกคืน", amount: num(d.subTotal) },
    ...(num(d.vatAmount) ? [{ label: "ภาษีมูลค่าเพิ่ม 7%", amount: num(d.vatAmount) }] : []),
    { label: "จำนวนเงินรวมทั้งสิ้น", amount: num(d.grandTotal), strong: true },
  ] : [
    { label: "มูลค่างานงวดนี้ (ก่อนภาษี)", amount: num(d.workValue) },
    ...(num(d.retentionAmount) ? [{ label: `หักเงินประกันผลงาน ${num(d.retentionPercent)}%`, amount: -num(d.retentionAmount) }] : []),
    ...(num(d.advanceAmount) ? [{ label: "หักคืนเงินล่วงหน้า", amount: -num(d.advanceAmount) }] : []),
    ...(num(d.retentionAmount) || num(d.advanceAmount) ? [{ label: "คงเหลือ", amount: num(d.subTotal) }] : []),
    ...(num(d.vatAmount) ? [{ label: "ภาษีมูลค่าเพิ่ม 7%", amount: num(d.vatAmount) }] : []),
    { label: "จำนวนเงินรวมทั้งสิ้น", amount: num(d.grandTotal), strong: true },
  ];
  return {
    type: "invoice",
    title: isRetention ? "ใบแจ้งหนี้ (เบิกคืนเงินประกันผลงาน)" : isAdvance ? "ใบแจ้งหนี้ (เงินล่วงหน้า)" : "ใบแจ้งหนี้ / ใบวางบิล (งวดงาน)", titleEn: "INVOICE",
    number: str(d.invoiceNo || id), date: toDateStr(d.issueDate || d.createdAt),
    meta: [
      { label: "ครบกำหนด", value: d.dueDate ? thaiDate(d.dueDate) : "-" },
      ...(d.projectName ? [{ label: "โครงการ", value: str(d.projectName) }] : []),
      ...(d.milestoneName ? [{ label: "งวดงาน", value: str(d.milestoneName) }] : []),
    ],
    seller,
    party: partyOf("ลูกค้า", d.customerSnapshot, str(d.customerName)),
    columns: ["no", "description", "amount"],
    lines: (Array.isArray(d.items) ? d.items : []).map((l: any) => ({ description: str(l.name), detail: str(l.details), amount: num(l.price) })),
    totals,
    amountInWords: num(d.grandTotal),
    notes: [
      "เอกสารนี้ไม่ใช่ใบกำกับภาษี — บริษัทจะออกใบเสร็จรับเงิน/ใบกำกับภาษีเมื่อได้รับชำระเงิน (งานบริการตามมาตรา 78/1)",
      ...(wht ? [`หากหักภาษี ณ ที่จ่าย ${wht}% คิดจากยอดก่อนภาษี ${money(num(d.subTotal))} บาท = ${money(num(d.subTotal) * wht / 100)} บาท ยอดชำระสุทธิ ${money(num(d.grandTotal) - num(d.subTotal) * wht / 100)} บาท`] : []),
      str(d.note),
      ...cancelNote(d),
    ].filter(Boolean),
    signatures: ["ผู้วางบิล", "ผู้รับวางบิล"],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}

export async function loadInvoice(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await companyAndDoc(companyId, `companies/${companyId}/invoices/${id}`, "ไม่พบใบกำกับภาษี");
  // ลูกหนี้ยกมา: เอกสารตัวจริงออกจากระบบเดิม ระบบนี้ไม่พิมพ์ซ้ำ
  if (d.docKind === "opening") throw new ApiAuthError(400, `${str(d.invoiceNo || id)} เป็นยอดยกมาจากระบบเดิม — ไม่มีเอกสารให้พิมพ์ในระบบนี้`);
  if (d.vatTiming === "receipt") return progressBillModel(d, seller, id);
  const lines = quotationLines(Array.isArray(d.items) ? d.items : []);
  const lineSum = r2(lines.reduce((s, l) => s + num(l.amount), 0));
  const taxType = taxTypeOf(d.vatType);
  const net = taxType === "INCLUSIVE" ? num(d.grandTotal) : num(d.subTotal);
  const billDiscount = lineSum - net > 0.009 ? r2(lineSum - net) : 0;
  const vatRegistered = d.isVatRegistered !== false && taxType !== "NONE";
  // ใบกำกับภาษีพิมพ์วันที่เสมอ (ม.86/4) — ใช้เฉพาะข้อความที่ลูกค้ากำหนด
  const profile = await customerDocProfile(companyId, d.customerId);
  return {
    type: "invoice",
    title: vatRegistered ? "ใบกำกับภาษี / ใบแจ้งหนี้" : "ใบแจ้งหนี้",
    titleEn: vatRegistered ? "TAX INVOICE / INVOICE" : "INVOICE",
    number: str(d.invoiceNo || d.documentNo || id), date: toDateStr(d.issueDate || d.createdAt),
    meta: [
      { label: "ครบกำหนด", value: d.dueDate ? thaiDate(d.dueDate) : "-" },
      ...(d.orderRefNo ? [{ label: "ใบสั่งขาย", value: str(d.orderRefNo) }] : []),
      ...(d.customerPoNo ? [{ label: "เลขที่ใบสั่งซื้อ", value: str(d.customerPoNo) }] : []),
      ...(d.replacesInvoiceNo ? [{ label: "ออกแทนเลขที่", value: str(d.replacesInvoiceNo) }] : []),
    ],
    seller,
    party: partyOf("ลูกค้า", d.customerSnapshot, str(d.customerName)),
    columns: ["no", "description", "qty", "unit", "price", "discount", "amount"],
    lines,
    totals: totalsRows({ lineTotal: lineSum || net, billDiscount, net, vat: num(d.vatAmount), grand: num(d.grandTotal), taxType }),
    amountInWords: num(d.grandTotal),
    notes: [
      ...(d.replacesInvoiceNo ? [`ใบกำกับภาษีฉบับนี้ออกแทนฉบับเดิมเลขที่ ${d.replacesInvoiceNo}${d.replaceReason ? ` ซึ่งยกเลิกเนื่องจาก ${d.replaceReason}` : ""}`] : []),
      ...cancelNote(d),
      ...(d.billingNoteNo ? [`ใบวางบิลเลขที่ ${d.billingNoteNo}`] : []),
      ...(profile.notes?.invoice ? [profile.notes.invoice] : []),
    ],
    signatures: ["ผู้รับสินค้า / บริการ", "ผู้ส่งสินค้า", "ผู้มีอำนาจลงนาม"],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}

export async function loadBillingNote(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await companyAndDoc(companyId, `companies/${companyId}/billing_notes/${id}`, "ไม่พบใบวางบิล");
  const [inv, profile] = await Promise.all([
    d.invoiceDocId ? adminDb.doc(`companies/${companyId}/invoices/${d.invoiceDocId}`).get().then((s) => s.data()) : Promise.resolve(null),
    customerDocProfile(companyId, d.customerId),
  ]);
  const total = num(d.totalAmount);
  return {
    type: "billing_note", title: "ใบวางบิล", titleEn: "BILLING NOTE",
    number: str(d.billingNoteNo || d.documentNo || id), date: showDocDate(profile, "billingNote") ? toDateStr(d.issueDate || d.createdAt) : "",
    dateOption: { actual: toDateStr(d.issueDate || d.createdAt), profileUndated: !showDocDate(profile, "billingNote"), customerId: str(d.customerId), docKind: "billingNote" },
    meta: [{ label: "กำหนดชำระ", value: d.dueDate ? thaiDate(d.dueDate) : "-" }, ...(d.customerPoNo ? [{ label: "เลขที่ใบสั่งซื้อ", value: str(d.customerPoNo) }] : [])],
    seller,
    party: partyOf("ลูกค้า", d.customerSnapshot, str(d.customerName)),
    // ตารางเป็นรายการเอกสารที่วางบิล: เลขที่เอกสารแยกคอลัมน์
    columns: ["no", "code", "description", "amount"],
    columnLabels: DOC_COLUMN_LABELS.billing_note,
    lines: [{
      code: str(d.invoiceRefNo),
      description: `ใบกำกับภาษี/ใบแจ้งหนี้${inv?.issueDate ? ` ลงวันที่ ${thaiDate(inv.issueDate)}` : ""}`,
      detail: [d.salesOrderRefNo ? `อ้างอิงใบสั่งขาย ${d.salesOrderRefNo}` : "", d.dueDate ? `ครบกำหนด ${thaiDate(d.dueDate)}` : ""].filter(Boolean).join(" · "),
      amount: total,
    }],
    totals: [{ label: "รวมยอดวางบิล", amount: total, strong: true }],
    amountInWords: total,
    notes: [
      ...cancelNote(d),
      ...(profile.notes?.billingNote ? [profile.notes.billingNote] : []),
      ...(profile.attachments.length ? [`เอกสารแนบ: ${profile.attachments.join(", ")}`] : []),
      "กรุณาชำระเงินภายในวันที่กำหนด",
    ],
    signatures: ["ผู้วางบิล", "ผู้รับวางบิล"],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}

export async function loadReceipt(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await companyAndDoc(companyId, `companies/${companyId}/receipts/${id}`, "ไม่พบใบเสร็จรับเงิน");
  const lines: any[] = Array.isArray(d.lines) ? d.lines : [];
  const firstInv = lines[0]?.invoiceDocId ? (await adminDb.doc(`companies/${companyId}/invoices/${lines[0].invoiceDocId}`).get()).data() : null;
  const applied = num(d.totalApplied ?? d.amount);
  const wht = num(d.totalWht);
  const taxInv = d.isTaxInvoice === true;
  const profile = await customerDocProfile(companyId, d.customerId);
  return {
    type: "receipt", title: taxInv ? "ใบเสร็จรับเงิน / ใบกำกับภาษี" : "ใบเสร็จรับเงิน", titleEn: taxInv ? "RECEIPT / TAX INVOICE" : "RECEIPT",
    number: str(d.receiptNo || d.documentNo || id), date: showDocDate(profile, "receipt", { isTaxInvoice: taxInv }) ? toDateStr(d.paymentDate || d.createdAt) : "",
    ...(taxInv ? {} : { dateOption: { actual: toDateStr(d.paymentDate || d.createdAt), profileUndated: !showDocDate(profile, "receipt"), customerId: str(d.customerId), docKind: "receipt" as const } }),
    meta: [
      { label: "ชำระโดย", value: str(d.paymentMethodLabel || d.paymentMethod) },
      ...(d.bankAccount ? [{ label: "บัญชี", value: str(d.bankAccount) }] : []),
      ...(d.cheque?.chequeNo ? [{ label: "เช็คเลขที่", value: `${str(d.cheque.chequeNo)}${d.cheque.chequeDate ? ` (${thaiDate(d.cheque.chequeDate)})` : ""}` }] : []),
      ...(d.reference ? [{ label: "อ้างอิง", value: str(d.reference) }] : []),
    ],
    seller,
    party: partyOf("ได้รับเงินจาก", d.customerSnapshot || firstInv?.customerSnapshot, str(d.customerName)),
    columns: ["no", "code", "description", "amount"],
    columnLabels: DOC_COLUMN_LABELS.receipt,
    lines: lines.map((l) => ({
      code: str(l.invoiceNo),
      description: l.vatOnReceipt
        ? `ค่าบริการตามใบแจ้งหนี้${l.milestoneName ? ` (${str(l.milestoneName)})` : ""}${l.projectName ? ` โครงการ ${str(l.projectName)}` : ""}`
        : "ชำระค่าสินค้า/บริการ ตามใบกำกับภาษี",
      detail: l.whtAmount ? `หัก ณ ที่จ่าย ${num(l.whtRate)}% = ${num(l.whtAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท` : "",
      amount: num(l.amount),
    })),
    totals: [
      ...(taxInv ? [{ label: "มูลค่าก่อนภาษี (ส่วนที่เป็นใบกำกับภาษี)", amount: num(d.taxBase) }, { label: "ภาษีมูลค่าเพิ่ม 7%", amount: num(d.vatAmount) }] : []),
      { label: "รวมรับชำระ", amount: applied, strong: !wht },
      ...(wht ? [{ label: "หัก ณ ที่จ่าย", amount: -wht }, { label: "รับเงินสุทธิ", amount: num(d.cashReceived) || r2(applied - wht), strong: true }] : []),
    ],
    amountInWords: applied,
    notes: [...cancelNote(d), ...(d.cheque ? ["ใบเสร็จนี้สมบูรณ์เมื่อเช็คผ่านบัญชีเรียบร้อยแล้ว"] : []), str(d.note), profile.notes?.receipt || ""].filter(Boolean),
    signatures: ["ผู้จ่ายเงิน", "ผู้รับเงิน"],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}

export async function loadCnDn(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await companyAndDoc(companyId, `companies/${companyId}/cndn/${id}`, "ไม่พบใบลดหนี้/ใบเพิ่มหนี้");
  const isCN = d.type === "CN";
  const amount = num(d.amount);
  const reason = [str(d.reason), str(d.reasonDetail)].filter(Boolean).join(" — ");
  return {
    type: "cndn",
    title: isCN ? "ใบลดหนี้" : "ใบเพิ่มหนี้", titleEn: isCN ? "CREDIT NOTE" : "DEBIT NOTE",
    number: str(d.documentNo || d.cndnNo || id), date: toDateStr(d.issueDate || d.createdAt),
    meta: [
      { label: "อ้างอิงใบกำกับ", value: str(d.invoiceNo) },
      { label: "ลงวันที่", value: d.invoiceDate ? thaiDate(d.invoiceDate) : "-" },
    ],
    seller,
    party: partyOf("ลูกค้า", d.customerSnapshot, str(d.customerName)),
    columns: ["no", "description", "amount"],
    lines: [{ description: `${isCN ? "ลดหนี้" : "เพิ่มหนี้"}ตามใบกำกับภาษีเลขที่ ${str(d.invoiceNo)}`, detail: `เหตุผล: ${reason || "-"}`, amount }],
    totals: [
      { label: "มูลค่าสินค้า/บริการตามใบกำกับเดิม", amount: num(d.originalAmount) },
      { label: "มูลค่าที่ถูกต้อง", amount: num(d.correctAmount) },
      { label: "ผลต่าง", amount },
      { label: `ภาษีมูลค่าเพิ่ม ${num(d.vatRate) || 7}%`, amount: num(d.vatAmount) },
      { label: `รวม${isCN ? "ลดหนี้" : "เพิ่มหนี้"}ทั้งสิ้น`, amount: num(d.totalAmount), strong: true },
    ],
    amountInWords: num(d.totalAmount),
    notes: [`เหตุผลในการออก${isCN ? "ใบลดหนี้" : "ใบเพิ่มหนี้"}: ${reason || "-"}`, ...cancelNote(d)],
    signatures: ["ผู้รับเอกสาร", "ผู้มีอำนาจลงนาม"],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}

export async function loadPosSale(companyId: string, id: string): Promise<DocumentModel> {
  const { d, seller } = await companyAndDoc(companyId, `companies/${companyId}/sales_transactions/${id}`, "ไม่พบบิลขายหน้าร้าน");
  const full = !!d.customer;
  const items: any[] = Array.isArray(d.items) ? d.items : [];
  return {
    type: "pos",
    title: full ? "ใบกำกับภาษี / ใบเสร็จรับเงิน" : "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ",
    titleEn: full ? "TAX INVOICE / RECEIPT" : "RECEIPT / ABBREVIATED TAX INVOICE",
    number: str(d.transactionNo || id), date: toDateStr(d.createdAt),
    meta: [{ label: "ชำระโดย", value: str(d.paymentMethod) }, ...(d.paymentRef ? [{ label: "อ้างอิง", value: str(d.paymentRef) }] : [])],
    seller,
    party: full ? { label: "ลูกค้า", name: str(d.customer.name), taxId: str(d.customer.taxId), branchName: str(d.customer.branch), branchCode: (str(d.customer.branch).match(/\d{5}/) || [""])[0], address: str(d.customer.address) } : undefined,
    columns: ["no", "code", "description", "qty", "price", "amount"],
    lines: items.map((l) => ({ code: str(l.sku), description: str(l.name), qty: num(l.qty), price: num(l.price), amount: num(l.amount) })),
    totals: totalsRows({ lineTotal: num(d.subTotal), billDiscount: num(d.discount), net: num(d.netBeforeVat ?? d.subTotal), vat: num(d.vatAmount), grand: num(d.grandTotal), taxType: "EXCLUSIVE" }),
    amountInWords: num(d.grandTotal),
    notes: [...cancelNote(d)],
    signatures: full ? ["ผู้รับเงิน"] : [],
    watermark: cancelled(d) ? "ยกเลิก" : undefined,
  };
}
