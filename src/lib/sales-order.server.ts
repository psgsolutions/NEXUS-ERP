import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { nexusSequenceServer } from "./sequence-server";
import { assertPeriodOpen } from "./period-close-service";
import type { Quotation } from "./sales-service";

/**
 * [SERVER-ONLY: Admin SDK] แปลงใบเสนอราคาเป็นใบสั่งขาย (ใช้ผ่าน POST /api/sales/convert-so)
 * จองสต็อก (3-State Lock), สร้าง SO และอัปเดตใบเสนอราคาใน transaction เดียว
 * ไม่ลงบัญชีรายได้ที่นี่: รายได้และภาษีขายรับรู้ตอนออกใบกำกับภาษี (DocumentFlowService.issueTaxInvoiceAndBillingNoteFromSO)
 */
export async function convertToSalesOrder(quoteId: string, companyId: string) {
  await assertPeriodOpen(companyId);
  const quoteRef = adminDb.doc(`companies/${companyId}/quotations/${quoteId}`);
  const soId = await nexusSequenceServer("SO", companyId);
  const now = () => admin.firestore.FieldValue.serverTimestamp();

  await adminDb.runTransaction(async (transaction) => {
    // 1. Fetch original Quotation document
    const quoteSnap = await transaction.get(quoteRef);
    if (!quoteSnap.exists) throw new Error("ไม่พบใบเสนอราคา");

    const quoteData = quoteSnap.data() as Quotation & { totalRevenue: number };
    if (quoteData.companyId !== companyId) {
      throw new Error("SECURITY_BREACH: Access to unauthorized company records.");
    }

    if ((quoteData as any).isCompetitorQuote || (quoteData as any).isComparisonOnly || (quoteData as any).documentMode === 'competitor' || !quoteData.customerId) {
      throw new Error("ห้ามแปลงใบเสนอราคาโหมดเอกสารคู่เทียบเป็นใบสั่งขายจริง เนื่องจากไม่มีข้อมูลลูกค้าหลักและเลขประจำตัวผู้เสียภาษีผูกไว้ 🔒");
    }

    // 2. Read phase: all products first (Firestore requires every read before any write)
    const reservedByProduct = new Map<string, number>();
    for (const item of quoteData.items) {
      if (!item.productId) continue; // Skip custom/free-text items
      reservedByProduct.set(item.productId, (reservedByProduct.get(item.productId) || 0) + item.quantity);
    }

    const productUpdates: Array<{ ref: admin.firestore.DocumentReference; reserved: number; available: number }> = [];
    for (const [productId, qty] of Array.from(reservedByProduct.entries())) {
      const productRef = adminDb.collection("products").doc(productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) {
        console.warn(`PRODUCT_NOT_FOUND: ข้ามการตัดสต็อกสำหรับพัสดุรหัส ${productId} เนื่องจากไม่มีในฐานข้อมูลหลัก`);
        continue; // Skip items that were deleted from master data
      }

      const productData = productSnap.data() || {};
      if (productData.companyId !== companyId) {
        throw new Error("SECURITY_BREACH: Product mapping is scoped to a different tenant.");
      }

      const currentReserved = productData.stockStatus?.reserved || 0;
      const currentOnHand = productData.stockStatus?.onHand || 0;
      const newReserved = currentReserved + qty;
      const newAvailable = currentOnHand - newReserved;

      // Soft Reserve Guard: Assert stock sufficiency
      if (newAvailable < 0) {
        throw new Error(`STOCK_INSUFFICIENT: พัสดุ ${productData.name || productId} มีสต็อกว่างไม่เพียงพอสำหรับการจอง (มีอยู่ ${currentOnHand - currentReserved})`);
      }
      productUpdates.push({ ref: productRef, reserved: newReserved, available: newAvailable });
    }

    // 3. Write phase: 3-State Stock Lock (Allocate Inventory Statuses)
    for (const u of productUpdates) {
      transaction.update(u.ref, {
        "stockStatus.reserved": u.reserved,
        "stockStatus.available": u.available,
        updatedAt: now()
      });
    }

    // 4. Create Sales Order Document
    const rawVatType = String((quoteData as any).vatType || quoteData.taxMode || 'Exclude VAT');
    let normalizedVatType = rawVatType;
    if (rawVatType === 'Inclusive' || rawVatType === 'Include VAT') {
      normalizedVatType = 'Include VAT';
    } else if (rawVatType === 'Exclusive' || rawVatType === 'Exclude VAT') {
      normalizedVatType = 'Exclude VAT';
    } else if (rawVatType === 'Non-VAT') {
      normalizedVatType = 'Non-VAT';
    }

    transaction.set(adminDb.doc(`companies/${companyId}/sales_orders/${soId}`), {
      ...quoteData,
      soId,
      vatType: normalizedVatType,
      taxMode: normalizedVatType,
      isVatRegistered: (quoteData as any).isVatRegistered ?? true,
      status: "Confirmed",
      stockReserved: true, // สินค้าถูกจองแล้ว: ตอนเบิกให้ลดยอดจองแทนยอดพร้อมใช้
      convertedAt: now()
    });

    // 5. Update Quotation Status
    transaction.update(quoteRef, {
      status: "Approved",
      linkedSo: soId,
      updatedAt: now()
    });
  });

  return soId;
}
