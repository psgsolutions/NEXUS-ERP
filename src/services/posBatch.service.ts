import { db } from '@/lib/firebase-client';
import { collection, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { calculateERPDocument, VatTypeV3 } from '@/lib/erp-logic';
import { AccountingEngine } from './accountingEngine';

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
 */
export async function processPOSBatchCheckout(payload: POSCheckoutPayload): Promise<{ success: boolean; transactionId: string }> {
  const { companyId, userId, items, vatType, cashAccountId } = payload;
  
  // 1. คำนวณภาษีและยอดเงินผ่าน Centralized Engine ป้องกันเศษปัดไม่ตรงบัญชีหลังบ้าน
  const calc = calculateERPDocument(items, vatType, false); // false = ใช้ราคาขายหน้าร้าน
  
  const batch = writeBatch(db);
  
  // สร้าง Reference IDs สำหรับการเขียนข้อมูล
  const txRef = doc(collection(db, `companies/${companyId}/sales_transactions`));
  const auditRef = doc(collection(db, `companies/${companyId}/auditLogs`));

  try {
    // 2. วนลูป Line Items เพื่อบันทึกคำสั่งปรับปรุงสต๊อกคลังสินค้าลดลงรายตัว
    for (const item of items) {
      const productRef = doc(db, `companies/${companyId}/products`, item.id);
      
      batch.update(productRef, {
        // หักลบจำนวน field แบบอะตอมิก
        'stockStatus.onHand': increment(-item.qty),
        updatedAt: serverTimestamp()
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
      createdAt: serverTimestamp(),
      isDeleted: false
    });

    // 4. บันทึกบัญชีคู่ Double-Entry ลงสมุดรายวันทั่วไปทันที
    // ใช้ AccountingEngine ของระบบเพื่อให้โครงสร้างข้อมูลถูกต้องตาม Schema 100%
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

    await AccountingEngine.postJournalEntry({
      companyId,
      description: `[AUTO] POS Sale Transaction: ${txRef.id}`,
      totalAmount: calc.grandTotal,
      items: journalItems
    }, batch);

    // 5. ลงบันทึกประวัติการตรวจสอบการทำงานระบบ
    batch.set(auditRef, {
      companyId,
      userId,
      action: 'POS_BATCH_CHECKOUT',
      details: `ทำการประมวลผลคำสั่งซื้อหน้าร้าน Transaction: ${txRef.id}`,
      timestamp: serverTimestamp()
    });

    // 🚀 ยิงคำสั่ง Batch บันทึกข้อมูลทั้งหมดลง Firestore พร้อมกันในก้อนเดียว
    await batch.commit();
    return { success: true, transactionId: txRef.id };

  } catch (error: any) {
    console.error('❌ [POS BATCH TRANSACTION ERROR]:', error.message);
    return { success: false, transactionId: '' };
  }
}
