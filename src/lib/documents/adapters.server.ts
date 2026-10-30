import { adminDb } from "@/lib/firebase-admin";
import type { Permission } from "@/lib/permissions";
import { loadBillingNote, loadCnDn, loadInvoice, loadPosSale, loadReceipt } from "./tax-adapters.server";
import { loadDeliveryNote, loadSalesOrder, loadWorkOrder } from "./sales-adapters.server";
import { loadGoodsReceipt, loadJournal, loadPayment, loadPayslip, loadPurchaseOrder, loadPurchaseRequest, loadWht } from "./finance-adapters.server";
import { ApiAuthError } from "@/lib/api-auth";
import type { DocumentModel } from "./model";
import { quotationLines, quotationModel, sampleModel } from "./build";
import { documentProfileOf } from "./profile";
import { toDateStr } from "./format";
import { LETTER_LABELS, type LetterKind } from "@/lib/letters";
import { TICKET_PRIORITY, TICKET_STATUS, ticketCategoryLabel, ticketChannelLabel, type TicketPriority } from "@/lib/service-tickets";
import { thaiDate } from "./format";
import { normalizeInboxData } from "@/lib/expense-inbox";

/**
 * แปลงเอกสารแต่ละประเภทในฐานข้อมูล -> DocumentModel (ใช้กับ PDF / ลิงก์ลูกค้า / อีเมล / แอปอื่น)
 * เพิ่มประเภทใหม่: เพิ่ม entry ใน DOCUMENT_TYPES
 */
export interface DocumentTypeDef {
  label: string;
  /** สิทธิ์ที่ต้องมีเพื่อเปิด/พิมพ์ (มีข้อใดข้อหนึ่ง) */
  permission: Permission | Permission[];
  load: (companyId: string, id: string) => Promise<DocumentModel>;
  /** เอกสารภายใน (ไม่ส่งลิงก์/อีเมลให้บุคคลภายนอก) */
  internal?: boolean;
}

const num = (v: any) => Number(v) || 0;
const str = (v: any) => String(v ?? "").trim();

async function sellerOf(companyId: string) {
  return documentProfileOf((await adminDb.doc(`companies/${companyId}`).get()).data());
}

const quotation: DocumentTypeDef = {
  label: "ใบเสนอราคา",
  permission: "sales:view",
  async load(companyId, id) {
    const ref = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const [snap, linesSnap, seller] = await Promise.all([ref.get(), ref.collection("lines").get(), sellerOf(companyId)]);
    if (!snap.exists || snap.data()!.isDeleted === true) throw new ApiAuthError(404, "ไม่พบใบเสนอราคา");
    const q = snap.data()!;
    const c = q.customerSnapshot || {};
    const raw = linesSnap.empty ? (Array.isArray(q.items) ? q.items : []) : linesSnap.docs.map((d) => d.data()).sort((a, b) => num(a.sequence) - num(b.sequence));
    const billDiscount = num(q.docDiscountAmount ?? q.discountTotal);
    return quotationModel({
      number: str(q.documentNo || q.quotationNumber || id), date: toDateStr(q.docDate || q.createdAt), validUntil: str(q.validUntil), status: str(q.status),
      seller,
      customer: {
        name: str(c.customerName || q.customerName), taxId: str(c.customerTaxId || q.customerTaxId),
        branchCode: str(c.customerBranchCode || q.customerBranchCode), branchName: str(c.customerBranch || q.customerBranch),
        address: str(c.customerAddress || q.customerAddress), contact: str(q.contactPerson), phone: str(q.contactPhone), email: str(q.contactEmail),
      },
      lines: quotationLines(raw),
      lineTotal: num(q.subTotal) + billDiscount, billDiscount, net: num(q.netTotal ?? q.subTotal), vat: num(q.vatAmount), grand: num(q.grandTotal),
      taxType: str(q.taxType) || "EXCLUSIVE", wht: num(q.whtAmount), payable: num(q.netPayable),
      paymentTerms: str(q.paymentTerms), deliveryDays: str(q.expectedDeliveryDays), terms: str(q.termsAndConditions), remark: str(q.remark),
      customerPoNo: str(q.customerPoNo), projectName: str(q.projectName), salesperson: str(q.salespersonName),
      noStamp: q.useStamp === false, noSign: q.useSignature === false,
    });
  },
};

/** หนังสือที่ออกแล้ว (บันทึกจากหน้าโครงการ › ทำหนังสือ) */
const letter: DocumentTypeDef = {
  label: "หนังสือ",
  permission: "projects:view",
  async load(companyId, id) {
    const [snap, seller] = await Promise.all([adminDb.doc(`companies/${companyId}/letters/${id}`).get(), sellerOf(companyId)]);
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบหนังสือ");
    const l = snap.data()!;
    const arr = (v: any) => (Array.isArray(v) ? v.map(String) : []);
    return {
      type: "letter", title: LETTER_LABELS[l.kind as LetterKind] || str(l.title) || "หนังสือ", number: str(l.number), date: str(l.date), meta: [], seller, lines: [], totals: [], signatures: [],
      letter: { to: str(l.to), subject: str(l.subject), refs: arr(l.refs), attachments: arr(l.attachments), body: arr(l.body), signerName: str(l.signerName), signerTitle: str(l.signerTitle) },
    };
  },
};

/** ใบรับแจ้ง/ใบเปิดเคสงานบริการ (ส่งให้ลูกค้ายืนยันเรื่องที่รับแจ้ง) */
const serviceTicket: DocumentTypeDef = {
  label: "ใบเปิดเคส",
  permission: ["sales:view", "projects:view", "inventory:view", "service:field"],
  async load(companyId, id) {
    const [snap, seller] = await Promise.all([adminDb.doc(`companies/${companyId}/service_tickets/${id}`).get(), sellerOf(companyId)]);
    if (!snap.exists || snap.data()!.isDeleted === true) throw new ApiAuthError(404, "ไม่พบใบแจ้ง");
    const t = snap.data()!;
    const st = TICKET_STATUS[t.status as keyof typeof TICKET_STATUS];
    const at = (v: any) => { const d = v?.toDate?.() || (v ? new Date(v) : null); return d && !isNaN(d.getTime()) ? `${thaiDate(d.toISOString().slice(0, 10))} ${new Date(d.getTime() + 7 * 3600e3).toISOString().slice(11, 16)} น.` : "-"; };
    const followUps = (Array.isArray(t.history) ? t.history : []).filter((h: any) => h?.note).slice(-6).map((h: any) => `${at(h.at)} ${str(h.action)}: ${str(h.note)}`);
    return {
      type: "service_ticket", title: "ใบรับแจ้งงานบริการ", titleEn: "SERVICE CASE", number: str(t.ticketNo || id), date: toDateStr(t.createdAt),
      meta: [
        { label: "ประเภทงาน", value: ticketCategoryLabel(str(t.category)) },
        { label: "ความเร่งด่วน", value: TICKET_PRIORITY[t.priority as TicketPriority] || str(t.priority) },
        { label: "กำหนดดำเนินการ", value: at(t.slaDueAt) },
        { label: "ช่องทางที่แจ้ง", value: ticketChannelLabel(str(t.channel)) },
        { label: "สถานะ", value: st?.label || str(t.status) },
      ],
      seller,
      party: { label: "ลูกค้า", name: str(t.customerName) || "-", address: str(t.address), contact: str(t.contact), phone: str(t.phone) },
      columns: ["no", "description"],
      lines: [{ description: `${str(t.productName) || "อุปกรณ์/ระบบที่แจ้ง"}${t.serialNumber ? ` (S/N ${str(t.serialNumber)})` : ""}`, detail: `อาการที่แจ้ง: ${str(t.symptom)}${t.serialNumber ? ` · ${t.inWarranty ? "อยู่ในระยะรับประกัน" : "ไม่อยู่ในระยะรับประกัน"}` : ""}` }],
      totals: [],
      notes: [...followUps.map((f: string) => `ติดตาม: ${f}`), "บริษัทฯ จะติดต่อนัดหมายเข้าดำเนินการตามกำหนดข้างต้น"],
      signatures: ["ผู้รับแจ้ง", "ลูกค้า"],
      watermark: t.status === "CANCELLED" ? "ยกเลิก" : undefined,
    };
  },
};

/**
 * ใบรับรองแทนใบเสร็จรับเงิน — รายจ่ายที่เรียกใบเสร็จจากผู้รับไม่ได้ (บิลเงินสด ค่าจ้างรายย่อย)
 * สร้างจากรูปบิลในกล่องรอยืนยัน · ผู้จ่ายเงินรับรองว่าจ่ายเพื่อกิจการของบริษัทโดยแท้ · ไม่มีภาษีซื้อ
 */
const substituteReceipt: DocumentTypeDef = {
  label: "ใบรับรองแทนใบเสร็จรับเงิน",
  permission: ["finance:view", "projects:edit", "sales:edit", "inventory:edit", "hr:edit", "service:field"],
  async load(companyId, id) {
    const [snap, seller] = await Promise.all([adminDb.doc(`companies/${companyId}/photo_inbox/${id}`).get(), sellerOf(companyId)]);
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบรายการรูปบิล");
    const x = snap.data()!;
    const d = normalizeInboxData(x.data);
    const payer = str(x.payerName || x.createdByName);
    return {
      type: "substitute_receipt", title: "ใบรับรองแทนใบเสร็จรับเงิน", titleEn: "SUBSTITUTE RECEIPT", number: str(x.expenseId) ? `SR-${str(x.expenseId)}` : `SR-${id.slice(0, 8).toUpperCase()}`, date: d.date || toDateStr(x.createdAt),
      meta: [...(x.expenseId ? [{ label: "ใบเบิก", value: str(x.expenseId) }] : []), ...(d.docNo ? [{ label: "เลขที่บิลเดิม", value: d.docNo }] : [])],
      seller,
      party: { label: "ผู้รับเงิน", name: d.vendorName || "-", address: d.vendorAddress, taxId: d.vendorTaxId },
      columns: ["no", "description", "qty", "price", "amount"],
      lines: d.items.length ? d.items.map((l) => ({ description: l.description || "-", qty: l.qty, price: l.unitPrice, amount: l.amount })) : [{ description: "ค่าใช้จ่าย", qty: 1, price: d.total, amount: d.total }],
      totals: [{ label: "รวมเป็นเงิน", amount: d.total, strong: true }],
      amountInWords: d.total,
      notes: [
        `ข้าพเจ้า${payer ? ` ${payer}` : ""} ขอรับรองว่ารายจ่ายข้างต้นนี้ไม่อาจเรียกใบเสร็จรับเงินจากผู้รับได้ และได้จ่ายไปเพื่อกิจการของบริษัทโดยแท้`,
        ...(d.note ? [`หมายเหตุ: ${d.note}`] : []),
      ],
      signatures: ["ผู้จ่ายเงิน (ผู้รับรอง)", "ผู้อนุมัติ"],
      ...(payer ? { signed: { "ผู้จ่ายเงิน (ผู้รับรอง)": { name: payer } } } : {}),
      watermark: x.status === "CONFIRMED" ? undefined : x.status === "REJECTED" ? "ไม่อนุมัติ" : "รอยืนยัน",
    };
  },
};

/** ตัวอย่างสำหรับหน้าตั้งค่าหัวเอกสาร (ข้อมูลบริษัทจริง + รายการตัวอย่าง) */
const sample: DocumentTypeDef = {
  label: "ตัวอย่างเอกสาร",
  internal: true,
  permission: "settings:manage",
  async load(companyId) {
    return sampleModel(await sellerOf(companyId), toDateStr(new Date()));
  },
};

export const DOCUMENT_TYPES: Record<string, DocumentTypeDef> = {
  quotation,
  invoice: { label: "ใบกำกับภาษี", permission: ["sales:view", "finance:view"], load: loadInvoice },
  billing_note: { label: "ใบวางบิล", permission: ["sales:view", "finance:view"], load: loadBillingNote },
  receipt: { label: "ใบเสร็จรับเงิน", permission: ["finance:view", "sales:edit"], load: loadReceipt },
  cndn: { label: "ใบลดหนี้/ใบเพิ่มหนี้", permission: ["sales:view", "finance:view"], load: loadCnDn },
  pos: { label: "บิลขายหน้าร้าน", permission: ["sales:edit", "finance:view"], load: loadPosSale },
  sales_order: { label: "ใบสั่งขาย", permission: ["sales:view", "finance:view"], load: loadSalesOrder },
  delivery_note: { label: "ใบส่งของ", permission: ["sales:view", "inventory:view", "finance:view"], load: loadDeliveryNote },
  // ช่างเปิดใบงานได้ (ทุกคนในบริษัทอ่านใบสั่งงานได้อยู่แล้วตามกฎฐานข้อมูล)
  work_order: { label: "ใบสั่งงานบริการ", permission: ["projects:view", "sales:view", "inventory:view", "service:field"], load: loadWorkOrder },
  purchase_request: { label: "ใบขอซื้อ", permission: ["procurement:view", "finance:view"], load: loadPurchaseRequest, internal: true },
  purchase_order: { label: "ใบสั่งซื้อ", permission: ["procurement:view", "finance:view"], load: loadPurchaseOrder },
  goods_receipt: { label: "ใบรับสินค้า", permission: ["procurement:view", "inventory:view", "finance:view"], load: loadGoodsReceipt, internal: true },
  payment: { label: "ใบสำคัญจ่าย", permission: "finance:view", load: loadPayment },
  wht: { label: "หนังสือรับรองการหักภาษี ณ ที่จ่าย", permission: "finance:view", load: loadWht },
  journal: { label: "ใบสำคัญบัญชี", permission: "finance:view", load: loadJournal, internal: true },
  payslip: { label: "สลิปเงินเดือน", permission: ["hr:edit", "finance:edit"], load: loadPayslip },
  letter,
  service_ticket: serviceTicket,
  substitute_receipt: { ...substituteReceipt, internal: true },
  sample,
};
