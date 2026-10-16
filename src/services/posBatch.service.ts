import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase-admin';
import { processStockMovements, StockMovement } from '@/lib/stock-service';
import { nexusSequenceServer } from '@/lib/sequence-server';

/**
 * [SERVER-ONLY: Admin SDK] ใช้ผ่าน POST /api/pos/checkout เท่านั้น
 */

export type POSPaymentMethod = 'CASH' | 'PROMPTPAY' | 'TRANSFER' | 'CARD';
export interface POSCheckoutPayload {
  companyId: string;
  userId: string;
  items: Array<{ id: string; qty: number }>;
  paymentMethod?: POSPaymentMethod;
  cashReceived?: number;
  /** ส่วนลดท้ายบิล (บาท ก่อน VAT) */
  discount?: number;
  /** เลขอ้างอิงการโอน/สลิปบัตร */
  paymentRef?: string;
  /** ลูกค้า (ถ้าขอใบกำกับภาษีเต็มรูป) */
  customer?: { name?: string; taxId?: string; branch?: string; address?: string };
}

export interface POSCheckoutResult {
  success: boolean; transactionId: string; transactionNo: string;
  items: Array<{ productId: string; sku: string; name: string; qty: number; price: number; amount: number }>;
  subTotal: number; discount: number; netBeforeVat: number; vatAmount: number; grandTotal: number;
  paymentMethod: POSPaymentMethod; cashReceived: number; change: number; paymentRef: string;
  customer: { name: string; taxId: string; branch: string; address: string } | null;
  createdAt: string;
}

// บัญชีรับเงินตามช่องทางชำระ
const RECEIPT_ACCOUNT: Record<POSPaymentMethod, { code: string; name: string }> = {
  CASH: { code: '1111-00', name: 'เงินสด' },
  TRANSFER: { code: '1112-00', name: 'เงินฝากธนาคาร' },
  CARD: { code: '1113-00', name: 'ลูกหนี้บัตรเครดิต' },
  PROMPTPAY: { code: '1112-00', name: 'เงินฝากธนาคาร' },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ขายหน้าร้าน (ราคาแยก VAT 7%) ใน transaction เดียว:
 *  - ตัดสต็อกสินค้า (products) ผ่าน stock engine + ลงต้นทุนขาย Dr 5111-00 / Cr 1141-00
 *  - บันทึกบิล (companies/{id}/sales_transactions) + รายได้ Dr เงินสด/ธนาคาร / Cr 4111-00 / Cr ภาษีขาย 2121-00
 * ราคาใช้ราคาขายหน้าร้านจากฐานข้อมูล (ไม่เชื่อราคาที่หน้าเว็บส่งมา)
 */
export async function processPOSBatchCheckout(payload: POSCheckoutPayload): Promise<POSCheckoutResult> {
  const { companyId, userId } = payload;
  const paymentMethod: POSPaymentMethod = payload.paymentMethod && RECEIPT_ACCOUNT[payload.paymentMethod] ? payload.paymentMethod : 'CASH';

  // รวมจำนวนตามสินค้า
  const qtyById = new Map<string, number>();
  for (const it of payload.items || []) {
    const qty = Math.floor(Number(it.qty) || 0);
    if (it.id && qty > 0) qtyById.set(it.id, (qtyById.get(it.id) || 0) + qty);
  }
  if (qtyById.size === 0) throw new Error('ไม่มีรายการสินค้า');

  // ราคาและชื่อจากฐานข้อมูล
  const lines: Array<{ productId: string; sku: string; name: string; qty: number; price: number; amount: number }> = [];
  for (const [productId, qty] of Array.from(qtyById.entries())) {
    const snap = await adminDb.collection('products').doc(productId).get();
    const p = snap.data();
    if (!p || p.companyId !== companyId) throw new Error(`ไม่พบสินค้า ${productId}`);
    const price = Number(p.pricing?.pricePOS ?? p.price ?? p.unitPrice ?? 0);
    lines.push({ productId, sku: p.sku || productId, name: p.name || productId, qty, price, amount: round2(price * qty) });
  }

  const subTotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const discount = round2(Math.max(0, Math.min(subTotal, Number(payload.discount) || 0)));
  const netBeforeVat = round2(subTotal - discount);
  const vatAmount = round2(netBeforeVat * 0.07);
  const grandTotal = round2(netBeforeVat + vatAmount);
  const paymentRef = String(payload.paymentRef || '').trim().slice(0, 60);
  const c = payload.customer || {};
  const customer = c.name || c.taxId ? { name: String(c.name || '').trim().slice(0, 160), taxId: String(c.taxId || '').replace(/\D/g, '').slice(0, 13), branch: String(c.branch || '').trim().slice(0, 40), address: String(c.address || '').trim().slice(0, 300) } : null;
  const cashReceived = paymentMethod === 'CASH' ? Number(payload.cashReceived ?? grandTotal) : grandTotal;
  if (paymentMethod === 'CASH' && cashReceived < grandTotal) throw new Error('ยอดเงินที่รับไม่พอ');
  const change = round2(cashReceived - grandTotal);

  const transactionNo = await nexusSequenceServer('POS', companyId);
  const txRef = adminDb.collection(`companies/${companyId}/sales_transactions`).doc(transactionNo);
  const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const account = RECEIPT_ACCOUNT[paymentMethod];

  const movements: StockMovement[] = lines.map((l) => ({
    companyId,
    productId: l.productId,
    type: 'OUT',
    quantity: l.qty,
    referenceId: transactionNo,
    userId,
  }));

  await processStockMovements(movements, (tx) => {
    tx.set(txRef, {
      companyId,
      transactionNo,
      items: lines,
      subTotal,
      discount,
      netBeforeVat,
      vatAmount,
      grandTotal,
      paymentMethod,
      cashReceived,
      change,
      paymentRef,
      customer,
      createdBy: userId,
      createdAt: now,
      isDeleted: false,
    });
    tx.set(journalRef, {
      companyId,
      date: now,
      bookType: 'JV',
      description: `[AUTO] ขายหน้าร้าน ${transactionNo}`,
      reference: transactionNo,
      totalDebit: grandTotal,
      totalCredit: grandTotal,
      status: 'draft',
      items: [
        { accountCode: account.code, accountName: account.name, debit: grandTotal, credit: 0 },
        { accountCode: '4111-00', accountName: 'รายได้จากการขาย', debit: 0, credit: netBeforeVat },
        { accountCode: '2121-00', accountName: 'ภาษีขาย', debit: 0, credit: vatAmount },
      ],
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    });
  });

  return {
    success: true, transactionId: transactionNo, transactionNo, items: lines,
    subTotal, discount, netBeforeVat, vatAmount, grandTotal,
    paymentMethod, cashReceived, change, paymentRef, customer,
    createdAt: new Date().toISOString(),
  };
}
