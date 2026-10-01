import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase-admin';
import { calculateERPDocument, VatTypeV3 } from '@/lib/erp-logic';

/**
 * [SERVER-ONLY: Admin SDK] ใช้ผ่าน POST /api/pos/checkout เท่านั้น
 */

export interface POSCheckoutPayload {
  companyId: string;
  userId: string;
  items: Array<{
    id: string;
    qty: number;
    costPrice: number;
    projectPrice: number;
    retailPrice: number;
  }>;
  vatType: VatTypeV3;
  cashAccountId: string;
}

/**
 * ดำเนินการยิง WriteBatch เพื่อลงบันทึกธุรกรรมขายหน้าร้าน, ปรับปรุงสต๊อก, และลงบัญชีคู่พร้อมกันแบบเบ็ดเสร็จ
 * โยน error เมื่อบันทึกไม่สำเร็จ (ไม่มีอะไรถูกบันทึกเพราะเป็น batch เดียว)
 */
export async function processPOSBatchCheckout(payload: POSCheckoutPayload): Promise<{ success: boolean; transactionId: string }> {
  const { companyId, userId, items, vatType, cashAccountId } = payload;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 1. คำนวณภาษีและยอดเงินผ่าน Centralized Engine ป้องกันเศษปัดไม่ตรงบัญชีหลังบ้าน
  const calc = calculateERPDocument(items, vatType, false); // false = ใช้ราคาขายหน้าร้าน

  const batch = adminDb.batch();

  // สร้าง Reference IDs สำหรับการเขียนข้อมูล
  const txRef = adminDb.collection(`companies/${companyId}/sales_transactions`).doc();
  const auditRef = adminDb.collection(`companies/${companyId}/auditLogs`).doc();
  const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();

  try {
    // 2. วนลูป Line Items เพื่อบันทึกคำสั่งปรับปรุงสต๊อกคลังสินค้าลดลงรายตัว
    for (const item of items) {
      const productRef = adminDb.collection(`companies/${companyId}/products`).doc(item.id);

      batch.update(productRef, {
        // หักลบจำนวน field แบบอะตอมิก
        'stockStatus.onHand': admin.firestore.FieldValue.increment(-item.qty),
        updatedAt: now
      });
    }

    // 3. บันทึกประวัติรายการคำสั่งซื้อหน้าร้าน
    batch.set(txRef, {
      companyId,
      transactionNo: `POS-${Date.now().toString().slice(-6)}`,
      items,
      subTotal: calc.subTotal,
      vatAmount: calc.vatAmount,
      grandTotal: calc.grandTotal,
      createdBy: userId,
      createdAt: now,
      isDeleted: false
    });

    // 4. บันทึกบัญชีคู่ Double-Entry ลงสมุดรายวันทั่วไปทันที
    // โครงสร้างเดียวกับ AccountingEngine.postJournalEntry
    const journalItems = [
      {
        accountCode: cashAccountId,
        accountName: 'เงินสด/ธนาคาร',
        debit: calc.grandTotal,
        credit: 0
      },
      {
        accountCode: '4111-00', // รายได้จากการขาย
        accountName: 'รายได้จากการขาย',
        debit: 0,
        credit: calc.subTotal
      }
    ];

    if (calc.vatAmount > 0) {
      journalItems.push({
        accountCode: '2121-00', // ภาษีขาย
        accountName: 'ภาษีขาย',
        debit: 0,
        credit: calc.vatAmount
      });
    }

    batch.set(journalRef, {
      companyId,
      date: now,
      bookType: 'JV',
      description: `[AUTO] POS Sale Transaction: ${txRef.id}`,
      totalDebit: calc.grandTotal,
      totalCredit: calc.grandTotal,
      status: 'draft',
      items: journalItems,
      createdAt: now,
      updatedAt: now
    });

    // 5. ลงบันทึกประวัติการตรวจสอบการทำงานระบบ
    batch.set(auditRef, {
      companyId,
      userId,
      action: 'POS_BATCH_CHECKOUT',
      details: `ทำการประมวลผลคำสั่งซื้อหน้าร้าน Transaction: ${txRef.id}`,
      timestamp: now
    });

    // 🚀 ยิงคำสั่ง Batch บันทึกข้อมูลทั้งหมดลง Firestore พร้อมกันในก้อนเดียว
    await batch.commit();
    return { success: true, transactionId: txRef.id };

  } catch (error: any) {
    console.error('❌ [POS BATCH TRANSACTION ERROR]:', error.message);
    throw error;
  }
}
