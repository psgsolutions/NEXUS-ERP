import { adminDb } from "@/lib/firebase-admin";
import type { Permission } from "@/lib/permissions";
import { loadBillingNote, loadCnDn, loadInvoice, loadPosSale, loadReceipt } from "./tax-adapters.server";
import { ApiAuthError } from "@/lib/api-auth";
import type { DocumentModel } from "./model";
import { quotationLines, quotationModel, sampleModel } from "./build";
import { documentProfileOf } from "./profile";
import { toDateStr } from "./format";

/**
 * แปลงเอกสารแต่ละประเภทในฐานข้อมูล -> DocumentModel (ใช้กับ PDF / ลิงก์ลูกค้า / อีเมล / แอปอื่น)
 * เพิ่มประเภทใหม่: เพิ่ม entry ใน DOCUMENT_TYPES
 */
export interface DocumentTypeDef {
  label: string;
  /** สิทธิ์ที่ต้องมีเพื่อเปิด/พิมพ์ (มีข้อใดข้อหนึ่ง) */
  permission: Permission | Permission[];
  load: (companyId: string, id: string) => Promise<DocumentModel>;
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
    });
  },
};

/** ตัวอย่างสำหรับหน้าตั้งค่าหัวเอกสาร (ข้อมูลบริษัทจริง + รายการตัวอย่าง) */
const sample: DocumentTypeDef = {
  label: "ตัวอย่างเอกสาร",
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
  sample,
};
