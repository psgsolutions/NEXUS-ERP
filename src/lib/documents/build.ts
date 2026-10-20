import type { DocumentLine, DocumentModel, DocumentParty, DocumentProfile, DocumentTotalRow } from "./model";
import { thaiDate } from "./format";

/**
 * ตัวสร้าง DocumentModel ที่ใช้ร่วมกันทั้งฝั่ง server (PDF จากข้อมูลที่บันทึก) และหน้าจอ (ตัวอย่างก่อนบันทึก)
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * แถวยอดรวมมาตรฐาน
 * lineTotal = ผลรวมรายการ (หลังส่วนลดรายบรรทัด), billDiscount = ส่วนลดท้ายบิล,
 * net = ยอดหลังหักส่วนลด (ก่อน VAT สำหรับ EXCLUSIVE / รวม VAT สำหรับ INCLUSIVE)
 */
export function totalsRows(t: { lineTotal: number; billDiscount: number; net: number; vat: number; grand: number; taxType: string; wht?: number; payable?: number }): DocumentTotalRow[] {
  const rows: DocumentTotalRow[] = [{ label: "รวมเป็นเงิน", amount: r2(t.lineTotal) }];
  if (t.billDiscount) rows.push({ label: "ส่วนลดท้ายบิล", amount: -r2(t.billDiscount) }, { label: "ยอดหลังหักส่วนลด", amount: r2(t.net) });
  const tax = String(t.taxType || "").toUpperCase();
  if (tax === "INCLUSIVE") rows.push({ label: "มูลค่าก่อนภาษี", amount: r2(t.grand - t.vat) }, { label: "ภาษีมูลค่าเพิ่ม 7% (รวมในราคา)", amount: r2(t.vat) });
  else if (tax !== "NONE" && tax !== "EXEMPT") rows.push({ label: "ภาษีมูลค่าเพิ่ม 7%", amount: r2(t.vat) });
  rows.push({ label: "จำนวนเงินรวมทั้งสิ้น", amount: r2(t.grand), strong: !t.wht });
  if (t.wht) rows.push({ label: "หัก ณ ที่จ่าย", amount: -r2(t.wht) }, { label: "ยอดชำระสุทธิ", amount: r2(t.payable ?? t.grand - t.wht), strong: true });
  return rows;
}

export interface QuotationInput {
  number: string;
  date: string;
  validUntil?: string;
  status?: string;
  seller: DocumentProfile;
  customer: Omit<DocumentParty, "label">;
  lines: DocumentLine[];
  lineTotal: number;
  billDiscount: number;
  net: number;
  vat: number;
  grand: number;
  taxType: string;
  wht?: number;
  payable?: number;
  paymentTerms?: string;
  deliveryDays?: string | number;
  terms?: string;
  remark?: string;
  customerPoNo?: string;
  projectName?: string;
  salesperson?: string;
}

export function quotationModel(q: QuotationInput): DocumentModel {
  const status = String(q.status || "").toUpperCase();
  return {
    type: "quotation", title: "ใบเสนอราคา", titleEn: "QUOTATION",
    number: q.number, date: q.date,
    meta: [
      { label: "ยืนราคาถึง", value: q.validUntil ? thaiDate(q.validUntil) : "-" },
      ...(q.customerPoNo ? [{ label: "อ้างอิง", value: q.customerPoNo }] : []),
      ...(q.projectName ? [{ label: "โครงการ", value: q.projectName }] : []),
      ...(q.salesperson ? [{ label: "ผู้เสนอราคา", value: q.salesperson }] : []),
    ],
    seller: q.seller,
    party: { label: "เสนอราคาให้", ...q.customer },
    columns: ["no", "description", "qty", "unit", "price", "discount", "amount"],
    lines: q.lines,
    totals: totalsRows(q),
    amountInWords: q.wht ? q.payable ?? q.grand - q.wht : q.grand,
    notes: [
      q.paymentTerms ? `เงื่อนไขการชำระเงิน: ${q.paymentTerms}` : "",
      q.deliveryDays ? `กำหนดส่งมอบ: ภายใน ${q.deliveryDays} วัน` : "",
      q.terms || "", q.remark || "",
    ].filter(Boolean),
    signatures: ["ผู้เสนอราคา", "ผู้อนุมัติ", "ลูกค้ายืนยันการสั่งซื้อ"],
    watermark: !q.number || status === "DRAFT" || status === "PENDING_APPROVAL" ? "ฉบับร่าง"
      : status === "REJECTED" || status === "CANCELLED" ? "ยกเลิก" : status === "SUPERSEDED" ? "ถูกแทนที่" : undefined,
  };
}

/** แปลงรายการจากฟอร์ม/ฐานข้อมูลใบเสนอราคา -> บรรทัดเอกสาร */
export function quotationLines(raw: any[]): DocumentLine[] {
  const num = (v: any) => Number(v) || 0;
  const str = (v: any) => String(v ?? "").trim();
  return raw.map((l) => {
    if (String(l.itemType || "").toUpperCase() === "GROUP_HEADER" || l.isGroupHeader) return { heading: true, description: str(l.productName || l.name || l.description) };
    const qty = num(l.qty ?? l.quantity);
    const price = num(l.unitPrice ?? l.price);
    const gross = qty * price;
    const pct = String(l.discountType || "PERCENT").toUpperCase() === "PERCENT";
    const discount = l.discountAmount !== undefined ? num(l.discountAmount) : Math.min(gross, pct ? gross * (num(l.discountValue) / 100) : num(l.discountValue));
    return {
      code: str(l.sku),
      description: str(l.productName || l.name || l.description) + (l.isOptional ? " (รายการเสริม)" : ""),
      detail: str(l.details || ((l.productName || l.name) ? l.description : "")),
      qty, unit: str(l.uom || l.unit), price,
      discount: r2(discount),
      amount: l.lineTotal !== undefined ? num(l.lineTotal) : r2(Math.max(0, gross - discount)),
    };
  });
}

/** เอกสารตัวอย่างสำหรับหน้าตั้งค่าหัวเอกสาร (ข้อมูลบริษัทจริง + รายการตัวอย่าง) */
export function sampleModel(seller: DocumentProfile, today: string): DocumentModel {
  return {
    type: "sample", title: "ตัวอย่างเอกสาร", titleEn: "SAMPLE", number: "XX-0000-0001", date: today,
    meta: [{ label: "ครบกำหนด", value: "-" }],
    seller,
    party: { label: "ลูกค้า", name: "ชื่อลูกค้าตัวอย่าง จำกัด", taxId: "0000000000000", branchCode: "00000", address: "ที่อยู่ลูกค้า", contact: "ผู้ติดต่อ", phone: "0X-XXX-XXXX" },
    lines: [
      { heading: true, description: "หมวดรายการ" },
      { description: "รายการตัวอย่างที่มีชื่อยาวเพื่อดูการตัดบรรทัดภาษาไทยภายในช่องรายการของตาราง", detail: "รายละเอียดเพิ่มเติม", qty: 2, unit: "ชุด", price: 1500, amount: 3000 },
      { description: "ค่าบริการติดตั้งและทดสอบระบบ", qty: 1, unit: "งาน", price: 2000, amount: 2000 },
    ],
    totals: totalsRows({ lineTotal: 5000, billDiscount: 0, net: 5000, vat: 350, grand: 5350, taxType: "EXCLUSIVE" }),
    amountInWords: 5350,
    notes: ["หมายเหตุตัวอย่าง"],
    signatures: ["ผู้จัดทำ", "ผู้มีอำนาจลงนาม"],
    watermark: "ตัวอย่าง",
  };
}

/** ชนิดเอกสารที่ออกแบบได้ (หน้าตั้งค่า › ออกแบบเอกสาร) พร้อมชื่อ/คอลัมน์/ช่องลงนามตั้งต้น */
export const DESIGNABLE_DOCS: { type: string; title: string; titleEn: string; columns?: DocumentModel["columns"]; signatures: string[]; partyLabel: string }[] = [
  { type: "quotation", title: "ใบเสนอราคา", titleEn: "QUOTATION", signatures: ["ผู้เสนอราคา", "ผู้อนุมัติ", "ผู้สั่งซื้อ"], partyLabel: "ลูกค้า" },
  { type: "sales_order", title: "ใบสั่งขาย", titleEn: "SALES ORDER", signatures: ["ผู้จัดทำ", "ผู้อนุมัติ"], partyLabel: "ลูกค้า" },
  { type: "invoice", title: "ใบกำกับภาษี / ใบแจ้งหนี้", titleEn: "TAX INVOICE / INVOICE", signatures: ["ผู้รับสินค้า / บริการ", "ผู้ส่งสินค้า", "ผู้มีอำนาจลงนาม"], partyLabel: "ลูกค้า" },
  { type: "billing_note", title: "ใบวางบิล", titleEn: "BILLING NOTE", columns: ["no", "description", "amount"], signatures: ["ผู้วางบิล", "ผู้รับวางบิล"], partyLabel: "ลูกค้า" },
  { type: "receipt", title: "ใบเสร็จรับเงิน", titleEn: "RECEIPT", columns: ["no", "description", "amount"], signatures: ["ผู้จ่ายเงิน", "ผู้รับเงิน"], partyLabel: "ได้รับเงินจาก" },
  { type: "delivery_note", title: "ใบส่งของ", titleEn: "DELIVERY NOTE", columns: ["no", "code", "description", "qty", "unit"], signatures: ["ผู้ส่งของ", "ผู้รับของ", "ผู้ตรวจรับ"], partyLabel: "ลูกค้า" },
  { type: "cndn", title: "ใบลดหนี้", titleEn: "CREDIT NOTE", columns: ["no", "description", "amount"], signatures: ["ผู้จัดทำ", "ผู้มีอำนาจลงนาม"], partyLabel: "ลูกค้า" },
  { type: "purchase_order", title: "ใบสั่งซื้อ", titleEn: "PURCHASE ORDER", signatures: ["ผู้สั่งซื้อ", "ผู้อนุมัติ"], partyLabel: "ผู้ขาย" },
  { type: "payment", title: "ใบสำคัญจ่าย", titleEn: "PAYMENT VOUCHER", columns: ["no", "description", "amount"], signatures: ["ผู้จัดทำ", "ผู้อนุมัติ", "ผู้รับเงิน"], partyLabel: "ผู้รับเงิน" },
  { type: "work_order", title: "ใบสั่งงานบริการ", titleEn: "WORK ORDER", columns: ["no", "description", "qty", "unit"], signatures: ["ช่างผู้ปฏิบัติงาน", "ลูกค้า"], partyLabel: "ลูกค้า" },
];

/** เอกสารตัวอย่างของชนิดที่เลือก (หน้าออกแบบเอกสาร) */
export function sampleModelFor(type: string, seller: DocumentProfile, today: string): DocumentModel {
  const def = DESIGNABLE_DOCS.find((d) => d.type === type) || DESIGNABLE_DOCS[0];
  const base = sampleModel(seller, today);
  return {
    ...base, type: def.type, title: def.title, titleEn: def.titleEn, signatures: def.signatures, watermark: undefined,
    ...(def.columns ? { columns: def.columns } : {}),
    party: base.party ? { ...base.party, label: def.partyLabel } : undefined,
    lines: def.columns && !def.columns.includes("qty") ? base.lines.map((l) => ({ ...l, qty: undefined, unit: undefined, price: undefined })) : base.lines,
  };
}
