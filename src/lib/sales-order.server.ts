import * as admin from "firebase-admin";
import { recipeRequirement } from "@/lib/service-recipe";
import { adminDb } from "./firebase-admin";
import { prepareSequence } from "./sequence-server";
import { assertPeriodOpen } from "./period-close-service";
import { getProductTx } from "@/lib/product-store.server";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { getCompanyCustomer } from "@/lib/credit-limit.server";
import { computeDocTotals, sanitizeLines, type VatMode } from "@/lib/doc-totals";
import { partyDocName } from "@/lib/party-identity";
import { isStockItem } from "@/lib/product-kind";
import { quotationStage } from "@/lib/quotation-status";
import { ApiAuthError } from "@/lib/api-auth";

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
export const SO_VAT_LABEL: Record<VatMode, string> = { exclusive: "Exclude VAT", inclusive: "Include VAT", none: "Non-VAT" };

/**
 * ข้อมูลอ้างอิง/ผู้ติดต่อของใบสั่งขาย (ใช้ทั้งสร้างเองและแปลงจากใบเสนอราคา) — ส่งต่อไปใบกำกับภาษี/ใบแจ้งหนี้
 */
export function salesOrderRefs(h: any) {
  const po = str(h.customerPoNo || h.referenceNo, 80);
  return {
    customerPoNo: po, referenceNo: po,
    salesPersonId: str(h.salesPersonId, 120), salespersonName: str(h.salespersonName, 120),
    contactPerson: str(h.contactPerson, 120), contactPhone: str(h.contactPhone, 40), contactEmail: str(h.contactEmail, 160),
    remark: str(h.remark, 2000),
    deliveryDate: isDate(h.deliveryDate) ? h.deliveryDate : "",
  };
}

/** ประเภท VAT ของใบเสนอราคา (taxType) → ของใบสั่งขาย */
function quoteVatMode(q: any): VatMode {
  const t = String(q.taxType || q.vatType || q.taxMode || "EXCLUSIVE").toUpperCase();
  if (t.startsWith("INCLUSIVE") || t === "INCLUDE VAT") return "inclusive";
  if (t === "NON_VAT" || t === "NONE" || t === "NON-VAT" || t === "EXEMPT") return "none";
  return "exclusive";
}

/**
 * [SERVER-ONLY] แปลงใบเสนอราคาที่ส่งลูกค้าแล้ว (ได้งาน) เป็นใบสั่งขาย — POST /api/sales/convert-so
 *  - รายการจาก quotations/{id}/lines (ตัดหัวข้อกลุ่ม/รายการทางเลือก) · ส่วนลดท้ายบิล · หัก ณ ที่จ่ายรายบรรทัด
 *  - ส่งต่อ: เลข PO ลูกค้า พนักงานขาย ผู้ติดต่อ ที่อยู่ส่งของ เงื่อนไขชำระ หมายเหตุ โครงการ
 *  - จองสต็อกสินค้าที่คุมสต็อก เมื่อมีพอทุกรายการ (ไม่พอ = สร้างใบสั่งขายได้ แต่ไม่จอง แจ้งกลับ)
 *  - ใบเสนอราคาเปลี่ยนเป็น "ได้งาน" (ACCEPTED) และผูกเลขใบสั่งขาย — แปลงซ้ำไม่ได้
 *  - ไม่ลงบัญชีรายได้ที่นี่: รับรู้ตอนออกใบกำกับภาษี (POST /api/sales/tax-invoice)
 */
export async function convertToSalesOrder(quoteId: string, companyId: string, user: { uid: string; email?: string }) {
  await assertPeriodOpen(companyId);
  const quoteRef = adminDb.doc(`companies/${companyId}/quotations/${quoteId}`);
  const first = await quoteRef.get();
  if (!first.exists) throw new ApiAuthError(404, "ไม่พบใบเสนอราคา");
  const q0 = first.data()!;
  if (!q0.customerId) throw new ApiAuthError(400, "ใบเสนอราคานี้ยังไม่ได้ผูกกับลูกค้าในระบบ — เลือกลูกค้าแล้วออกฉบับแก้ไขก่อน");
  const cust = await getCompanyCustomer(companyId, q0.customerId);
  if (!cust) throw new ApiAuthError(400, "ไม่พบลูกค้าของใบเสนอราคานี้ในบริษัท");
  const c = cust.data()!;
  const lineDocs = (await quoteRef.collection("lines").get()).docs.map((d) => d.data()).sort((a, b) => num(a.sequence) - num(b.sequence));
  const raw = lineDocs.length ? lineDocs : Array.isArray(q0.items) ? q0.items : [];
  const items = sanitizeLines(raw.map((l: any) => ({
    ...l, name: l.productName || l.name, price: l.unitPrice ?? l.price, cost: l.costPrice ?? l.cost, unit: l.uom || l.unit,
    details: l.details || l.description, qty: l.qty ?? l.quantity,
  }))).filter((l) => !l.isOptional);
  if (!items.length) throw new ApiAuthError(400, "ใบเสนอราคานี้ไม่มีรายการที่แปลงได้");
  const vatMode = quoteVatMode(q0);
  const t = computeDocTotals(items, vatMode, "lines", num(q0.docDiscountAmount));
  const groupId = await groupIdOfCompany(companyId);
  const take = await prepareSequence("SO", companyId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const name = str(partyDocName(c) || q0.customerName, 200);
  const billing = str(q0.customerAddress || q0.customerSnapshot?.address || c.address, 1000);
  const termDays = (() => { const m = String(q0.paymentTerms || "").match(/(\d+)\s*วัน/); return m ? Number(m[1]) : num(c.creditTermDays ?? c.credit_term_days); })();

  return adminDb.runTransaction(async (tx) => {
    // ---- อ่านทั้งหมดก่อนเขียน ----
    const snap = await tx.get(quoteRef);
    const q = snap.data()!;
    const docNo = q.documentNo || q.quotationNumber || quoteId;
    if (q.linkedSo) throw new ApiAuthError(409, `${docNo} แปลงเป็นใบสั่งขาย ${q.linkedSo} ไปแล้ว`);
    if (q.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง`);
    const stage = quotationStage(q, "0000-00-00");
    if (stage !== "sent") {
      throw new ApiAuthError(409, stage === "draft" || stage === "pending" || stage === "rejected"
        ? `${docNo} ยังไม่ได้อนุมัติ/ส่งลูกค้า — ส่งลูกค้าก่อนจึงแปลงเป็นใบสั่งขายได้`
        : `${docNo} แปลงไม่ได้ (${stage === "superseded" ? "ถูกแทนด้วยฉบับแก้ไข" : stage === "cancelled" ? "ยกเลิกแล้ว" : "ได้งานแล้ว"})`);
    }
    const need = new Map<string, number>();
    for (const it of items) if (it.productId && it.itemType === "PRODUCT") need.set(it.productId, (need.get(it.productId) || 0) + it.qty);
    // วัสดุตามสูตรงานบริการจองพร้อมสินค้า (เบิกตอนส่งของ)
    for (const it of items) for (const m of recipeRequirement(it.recipe, it.qty)) need.set(m.productId, (need.get(m.productId) || 0) + Math.ceil(m.qty - 1e-9));
    const reserve: { ref: admin.firestore.DocumentReference; qty: number }[] = [];
    const short: string[] = [];
    for (const [productId, qty] of Array.from(need.entries())) {
      const h = await getProductTx(tx, companyId, groupId, productId);
      if (!h || !isStockItem(h.data)) continue;
      const st = h.data.stockStatus || {};
      const free = num(st.onHand) - num(st.reserved);
      if (free < qty) short.push(`${h.data.name || productId} (ว่าง ${free})`);
      reserve.push({ ref: h.ref as admin.firestore.DocumentReference, qty });
    }
    const seq = await take(tx);
    const soId = seq.number;

    // ---- เขียน ----
    seq.commit();
    const reserved = short.length === 0 && reserve.length > 0;
    if (reserved) {
      for (const r of reserve) {
        tx.update(r.ref, { "stockStatus.reserved": admin.firestore.FieldValue.increment(r.qty), "stockStatus.available": admin.firestore.FieldValue.increment(-r.qty), updatedAt: now });
      }
    }
    tx.create(adminDb.doc(`companies/${companyId}/sales_orders/${soId}`), {
      soId, documentNo: soId, companyId,
      docDate: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
      quoteId, quotationNo: docNo, quotationRefNo: docNo,
      customerId: q.customerId, customerName: name,
      customerSnapshot: { name, taxId: str(c.taxId || q.customerTaxId, 20), branch: str(c.branchCode || c.branch || q.customerBranch, 40), address: billing },
      billingAddress: billing, deliveryAddress: str(q.deliveryAddress || q.shippingAddress, 1000) || billing,
      projectId: str(q.projectId, 120), projectName: str(q.projectName, 200),
      paymentTermDays: Math.max(0, Math.min(365, termDays || 0)), paymentTerms: str(q.paymentTerms, 200),
      ...salesOrderRefs(q),
      vatType: SO_VAT_LABEL[vatMode], taxMode: SO_VAT_LABEL[vatMode], isVatRegistered: vatMode !== "none",
      items,
      subTotal: t.subTotal, totalDiscount: t.discount, docDiscountAmount: num(q.docDiscountAmount), vatAmount: t.vatAmount,
      grandTotal: t.grandTotal, totalAmount: t.grandTotal, totalRevenue: t.grandTotal, whtAmount: t.whtAmount, netPayable: t.netPayable,
      status: "Confirmed", fulfillmentStatus: "pending", stockReserved: reserved,
      createdBy: user.uid, createdByEmail: user.email || "", updatedBy: user.uid, createdAt: now, updatedAt: now, convertedAt: now, isDeleted: false,
    });
    tx.update(quoteRef, { status: "ACCEPTED", linkedSo: soId, acceptedAt: now, acceptedBy: user.uid, updatedAt: now, updatedBy: user.uid });
    return { soId, quotationNo: docNo, stockReserved: reserved, shortages: short, grandTotal: t.grandTotal };
  });
}
