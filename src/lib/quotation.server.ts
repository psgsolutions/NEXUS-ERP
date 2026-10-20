import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { canWriteBackToProductMaster } from "@/lib/erp-logic";
import { notifyInTx } from "@/lib/notifications.server";
import { ENGINEER_QUOTATION_LIMIT, quotationApprovalLimit } from "@/lib/permissions";

/**
 * ส่วนกลางของการบันทึกใบเสนอราคาฝั่งเซิร์ฟเวอร์ (ใช้ทั้งสร้างใหม่และแก้ไข)
 * - กรองฟิลด์ระบบที่ห้ามรับจากหน้าจอ
 * - จัดรูปรายการสินค้า (คำนวณส่วนลดและยอดรวมบรรทัดใหม่ ไม่เชื่อค่าจากหน้าจอ)
 * - ตัดสินสถานะเมื่อส่ง: GP ต่ำกว่าเกณฑ์บริษัท หรือหน้าจอแจ้งว่าต้องขออนุมัติ -> รออนุมัติ, มิฉะนั้น -> ส่งลูกค้าแล้ว
 */

export const QUOTATION_PROTECTED_FIELDS = [
  "id", "companyId", "documentNo", "quotationNumber", "revision", "revisionNumber", "parentQuotationId", "previousRevisionId",
  "revisionHistory", "supersededBy", "supersededByNo", "supersededAt", "linkedSo", "status", "createdAt", "createdBy",
  "isDeleted", "isSample", "approvedAt", "approvedBy", "sentAt", "sentBy", "updatedAt", "updatedBy", "auditLogs",
];

const r2 = (n: number) => Math.round(n * 100) / 100;
export const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const str = (v: any, max = 500) => String(v ?? "").slice(0, max);

export function cleanHeader(raw: any): Record<string, any> {
  const h = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.entries(h).filter(([k, v]) => !QUOTATION_PROTECTED_FIELDS.includes(k) && v !== undefined));
}

export function normalizeLines(raw: any): Record<string, any>[] {
  const list: any[] = Array.isArray(raw) ? raw.slice(0, 500) : [];
  return list.map((l, i) => {
    const qty = num(l.qty);
    const unitPrice = num(l.unitPrice);
    const costPrice = num(l.costPrice);
    const isHeader = l.itemType === "GROUP_HEADER";
    const gross = qty * unitPrice;
    const discountType = l.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT";
    const discountValue = num(l.discountValue);
    const discountAmount = isHeader ? 0 : r2(Math.min(gross, discountType === "PERCENT" ? gross * (discountValue / 100) : discountValue));
    const whtRate = num(l.whtRate);
    return {
      sequence: i + 1,
      itemType: str(l.itemType || "PRODUCT", 30),
      productId: str(l.productId, 120),
      sku: str(l.sku, 120),
      productName: str(l.productName, 300),
      description: str(l.description, 2000),
      details: str(l.details, 4000),
      qty,
      uom: str(l.uom || "ชิ้น", 40),
      uomConversionFactor: 1,
      costPrice,
      unitPrice,
      discountString: str(l.discountString, 40),
      discountType,
      discountValue,
      discountAmount,
      whtRate,
      lineTotal: isHeader ? 0 : r2(Math.max(0, gross - discountAmount)),
      isVatable: true,
      whtApplicable: whtRate > 0,
      glAccountId: str(l.glAccountId || "411100", 20),
      isOptional: !!l.isOptional,
      margin: r2(unitPrice - costPrice),
    };
  });
}

/** GP% จากรายการ (ไม่นับหัวข้อกลุ่มและรายการทางเลือก) หักส่วนลดท้ายบิล */
export function grossProfitPercent(lines: Record<string, any>[], docDiscountAmount: any): number {
  const billable = lines.filter((l) => l.itemType !== "GROUP_HEADER" && !l.isOptional);
  const revenue = billable.reduce((s, l) => s + l.lineTotal, 0) - num(docDiscountAmount);
  const cost = billable.reduce((s, l) => s + l.costPrice * l.qty, 0);
  return revenue > 0 ? r2(((revenue - cost) / revenue) * 100) : 0;
}

export async function companyGpThreshold(tx: admin.firestore.Transaction, companyId: string): Promise<number> {
  const company = (await tx.get(adminDb.doc(`companies/${companyId}`))).data() || {};
  return num(company.settings?.minGpPercentForAutoSend ?? 15);
}

export function submitStatus(gp: number, threshold: number, requiresApproval: boolean, overLimit = false): "PENDING_APPROVAL" | "SENT" {
  return requiresApproval || overLimit || gp < threshold ? "PENDING_APPROVAL" : "SENT";
}

/**
 * ยอดที่ใช้ตรวจวงเงินอนุมัติ: คำนวณจากรายการที่ server (ไม่เชื่อยอดรวมที่หน้าจอส่งมาอย่างเดียว)
 * = รายการที่ไม่ใช่ทางเลือก − ส่วนลดท้ายบิล (+ VAT 7% เมื่อราคาไม่รวม VAT) แล้วใช้ค่าที่มากกว่ากับยอดที่ส่งมา
 */
export function quoteLimitAmount(header: Record<string, any>, lines: Record<string, any>[]): number {
  const net = lines.filter((l) => l.itemType !== "GROUP_HEADER" && !l.isOptional).reduce((s, l) => s + num(l.lineTotal), 0) - num(header.docDiscountAmount);
  const tax = String(header.taxType || header.vatType || "EXCLUSIVE").toUpperCase();
  const computed = tax.startsWith("INCLUSIVE") || tax === "NONE" ? net : net * 1.07;
  return r2(Math.max(num(header.grandTotal), computed));
}

/** ผู้ส่งที่มีวงเงินอนุมัติจำกัด (เช่น วิศวกร 1 ล้าน) ส่งใบที่ยอดเกินวงเงิน -> ต้องให้ผู้บริหารอนุมัติก่อน */
export function overQuoteLimit(roles: string[], amount: any): boolean {
  const limit = quotationApprovalLimit(roles);
  return limit > 0 && Number.isFinite(limit) && num(amount) > limit;
}

/** ลูกค้าใหม่ที่พิมพ์ชื่อเข้ามา (ยังไม่มีในฐานข้อมูล) — สร้างในทรานแซกชันเดียวกัน คืน customerId */
export function createCustomerInTx(tx: admin.firestore.Transaction, companyId: string, c: any): string {
  const ref = adminDb.collection(`companies/${companyId}/customers`).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  tx.set(ref, {
    customerName: str(c.name, 200), name: str(c.name, 200),
    address: str(c.address, 500), taxId: str(c.taxId, 20),
    companyId, isDeleted: false, createdAt: now, updatedAt: now,
  });
  return ref.id;
}

export function writeProductWritebacks(tx: admin.firestore.Transaction, companyId: string, roles: string[], raw: any) {
  if (!canWriteBackToProductMaster(roles, true)) return;
  const now = admin.firestore.FieldValue.serverTimestamp();
  (Array.isArray(raw) ? raw : []).slice(0, 100).forEach((w: any) => {
    const pid = str(w.productId, 120);
    const patch: Record<string, any> = {};
    if (str(w.technicalSpecs).trim()) patch.technicalSpecs = str(w.technicalSpecs, 4000).trim();
    if (str(w.datasheetUrl).trim()) patch.datasheetUrl = str(w.datasheetUrl, 500).trim();
    if (pid && Object.keys(patch).length) tx.set(adminDb.doc(`companies/${companyId}/products/${pid}`), { ...patch, updatedAt: now }, { merge: true });
  });
}

export function auditEntry(uid: string, userName: string, submit: boolean, status: string, sendChannel: any, gp: number | null, requiresApproval: boolean, created: boolean) {
  return {
    userId: uid,
    userName,
    action: !submit ? (created ? "CREATE_DRAFT" : "SAVE_DRAFT") : status === "PENDING_APPROVAL" ? "SUBMIT_APPROVAL" : `SEND_${str(sendChannel || "MANUAL", 20)}`,
    channel: str(sendChannel || (submit ? "SYSTEM" : "DRAFT"), 20),
    timestamp: new Date().toISOString(),
    details: !submit
      ? (created ? "สร้างใบเสนอราคา (ฉบับร่าง)" : "บันทึกข้อมูลแก้ไขใบเสนอราคา")
      : status === "PENDING_APPROVAL"
        ? (gp !== null && !requiresApproval ? `ส่งขออนุมัติเนื่องจาก GP (${gp}%) ต่ำกว่าเกณฑ์` : "ส่งขออนุมัติ (เกินวงเงินเครดิตหรือเงื่อนไขพิเศษ)")
        : "บันทึกและส่งเอกสารให้ลูกค้า",
  };
}

export function notifyPendingApproval(tx: admin.firestore.Transaction, companyId: string, quotationId: string, docNo: string, customerName: string, grandTotal: any, gp: number | null, by: string) {
  notifyInTx(tx, companyId, {
    type: "QUOTATION_PENDING_APPROVAL",
    title: `ใบเสนอราคา ${docNo} รออนุมัติ`,
    message: `${customerName || "ลูกค้า"} · ยอด ${num(grandTotal).toLocaleString("th-TH")} บาท${gp !== null ? ` · GP ${gp}%` : ""}`,
    link: `/sales/quotations/${quotationId}`,
    // วิศวกรอนุมัติได้ไม่เกินวงเงิน -> แจ้งเฉพาะใบที่อยู่ในวงเงิน
    targetRoles: num(grandTotal) <= ENGINEER_QUOTATION_LIMIT ? ["EXECUTIVE", "SUPERADMIN", "ENGINEER"] : ["EXECUTIVE", "SUPERADMIN"],
    documentNo: docNo,
  }, by);
}
