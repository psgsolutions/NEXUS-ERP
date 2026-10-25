/**
 * กล่องรูปบิลรอยืนยัน (ถ่ายรูปบิล/ใบเสร็จ → AI อ่านข้อมูล → ผู้มีสิทธิ์ยืนยัน → เป็นใบเบิกค่าใช้จ่าย)
 * ฟังก์ชันล้วน (ใช้ทั้ง client, server และ unit test)
 *  - ไม่มีใบกำกับภาษี/ใบเสร็จ (บิลเงินสด ใบรับเงินเขียนมือ ค่าจ้างรายย่อย): ระบบออก "ใบรับรองแทนใบเสร็จรับเงิน" ให้
 *    (ผู้จ่ายรับรองว่าเรียกใบเสร็จไม่ได้ และจ่ายเพื่อกิจการของบริษัท) — ไม่มีภาษีซื้อ
 */
export type InboxDocType = "TAX_INVOICE" | "RECEIPT" | "CASH_BILL" | "NONE";
export type InboxStatus = "DRAFT" | "REVIEW" | "CONFIRMED" | "REJECTED";

export const INBOX_DOC_TYPES: Record<InboxDocType, string> = {
  TAX_INVOICE: "ใบกำกับภาษี (มี VAT)",
  RECEIPT: "ใบเสร็จรับเงิน (ไม่มี VAT)",
  CASH_BILL: "บิลเงินสด/ใบรับเงินเขียนมือ",
  NONE: "ไม่มีเอกสาร (ออกใบรับรองแทน)",
};
export const INBOX_STATUS: Record<InboxStatus, string> = { DRAFT: "กำลังอ่านรูป", REVIEW: "รอยืนยัน", CONFIRMED: "ยืนยันเป็นรายจ่ายแล้ว", REJECTED: "ไม่อนุมัติ" };

export interface InboxLine { description: string; qty: number; unitPrice: number; amount: number }
export interface InboxData {
  docType: InboxDocType;
  vendorName: string; vendorTaxId: string; vendorAddress: string;
  date: string; docNo: string;
  items: InboxLine[];
  subtotal: number; vat: number; total: number;
  /** หมวดค่าใช้จ่ายที่ AI แนะนำ (รหัสบัญชีค่าใช้จ่าย) */
  suggestedAccount: string;
  note: string;
}

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const num = (v: any) => { const n = Number(String(v ?? "").replace(/[,฿\s]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** ตรวจ/แปลงข้อมูลบิล (จาก AI หรือจากการแก้บนหน้าจอ) — ยอดรวมคำนวณใหม่ให้สอดคล้อง */
export function normalizeInboxData(raw: any): InboxData {
  const r = raw && typeof raw === "object" ? raw : {};
  const docType: InboxDocType = (["TAX_INVOICE", "RECEIPT", "CASH_BILL", "NONE"] as const).includes(r.docType) ? r.docType : "CASH_BILL";
  const items: InboxLine[] = (Array.isArray(r.items) ? r.items : []).slice(0, 30).map((x: any) => {
    const qty = num(x?.qty) || 1, unitPrice = num(x?.unitPrice), amount = num(x?.amount) || r2(qty * unitPrice);
    return { description: str(x?.description, 200), qty, unitPrice: unitPrice || r2(amount / qty), amount };
  }).filter((x: InboxLine) => x.description || x.amount);
  const itemsSum = r2(items.reduce((s, x) => s + x.amount, 0));
  // ไม่มีใบกำกับภาษี = ไม่มีภาษีซื้อ
  const vat = docType === "TAX_INVOICE" ? num(r.vat) : 0;
  let subtotal = num(r.subtotal) || (docType === "TAX_INVOICE" && num(r.total) ? r2(num(r.total) - vat) : itemsSum);
  if (!subtotal && num(r.total)) subtotal = r2(num(r.total) - vat);
  const tax = String(r.vendorTaxId ?? "").replace(/\D/g, "");
  // วันที่ ค.ศ. (ปี พ.ศ. ที่หลุดมาแปลงให้)
  const rawDate = str(r.date, 10);
  const year = Number(rawDate.slice(0, 4));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? (year > 2400 ? `${year - 543}${rawDate.slice(4)}` : rawDate) : "";
  return {
    docType, vendorName: str(r.vendorName, 160), vendorTaxId: tax.length === 13 ? tax : "", vendorAddress: str(r.vendorAddress, 300),
    date, docNo: str(r.docNo, 60), items, subtotal, vat, total: r2(subtotal + vat),
    suggestedAccount: /^\d{4}-\d{2}$/.test(str(r.suggestedAccount, 10)) ? str(r.suggestedAccount, 10) : "", note: str(r.note, 500),
  };
}

/** ต้องออกใบรับรองแทนใบเสร็จรับเงิน */
export const needsSubstitute = (d: Pick<InboxData, "docType">) => d.docType === "CASH_BILL" || d.docType === "NONE";

/** รายละเอียดสำหรับใบเบิก (สรุปร้านค้าและรายการ) */
export function claimDescription(d: InboxData): string {
  const what = d.items.map((x) => x.description).filter(Boolean).slice(0, 4).join(", ");
  return [d.vendorName || "ค่าใช้จ่าย", what && `(${what}${d.items.length > 4 ? " ฯลฯ" : ""})`, d.docNo && `บิล ${d.docNo}`, needsSubstitute(d) && "— ใบรับรองแทนใบเสร็จ"].filter(Boolean).join(" ");
}
