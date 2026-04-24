import { db } from "./firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp,
  getDoc,
  setDoc
} from "firebase/firestore";
import { nexusSequenceEngine } from "./sequence-engine";

/**
 * [SALES-STRATEGY-V2.0]
 * Dynamic Quotation & Sales Order Engine
 */

export interface Quotation {
  customerId: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
    cost: number;
  }[];
  discount?: number;
  companyId: string;
}

export async function createQuotation(quote: Quotation) {
  const { companyId, items } = quote;

  // 1. Calculate Margin & Validation
  let totalRevenue = 0;
  let totalCost = 0;
  items.forEach(item => {
    totalRevenue += item.price * item.quantity;
    totalCost += item.cost * item.quantity;
  });

  const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  
  // Rule: Reject if margin < 10% (unless override by superadmin)
  if (margin < 10 && totalRevenue > 0) {
    throw new Error(`กำไรต่ำกว่าเกณฑ์ (${margin.toFixed(2)}%) กรุณาขออนุมัติจาก Superadmin`);
  }

  // 2. Generate QT ID
  const quoteId = await nexusSequenceEngine("QT", companyId);

  // 3. Save to Firestore
  const quoteRef = doc(db, `companies/${companyId}/quotations`, quoteId);
  await setDoc(quoteRef, {
    ...quote,
    quoteId,
    totalRevenue,
    margin,
    status: "Draft",
    createdAt: serverTimestamp()
  });

  return quoteId;
}

export async function convertToSalesOrder(quoteId: string, companyId: string) {
  const quoteRef = doc(db, `companies/${companyId}/quotations`, quoteId);
  const soId = await nexusSequenceEngine("SO", companyId);
  const jvId = await nexusSequenceEngine("FIN", companyId);

  await runTransaction(db, async (transaction) => {
    // 1. Fetch original Quotation document
    const quoteSnap = await transaction.get(quoteRef);
    if (!quoteSnap.exists()) throw new Error("ไม่พบใบเสนอราคา");
    
    const quoteData = quoteSnap.data() as Quotation & { totalRevenue: number };
    if (quoteData.companyId !== companyId) {
      throw new Error("SECURITY_BREACH: Access to unauthorized company records.");
    }

    // 2. 3-State Stock Lock Logic (Allocate Inventory Statuses)
    for (const item of quoteData.items) {
      const productRef = doc(db, "products", item.productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) {
        throw new Error(`PRODUCT_NOT_FOUND: ไม่พบพัสดุรหัส ${item.productId}`);
      }

      const productData = productSnap.data();
      if (productData.companyId !== companyId) {
        throw new Error("SECURITY_BREACH: Product mapping is scoped to a different tenant.");
      }

      const currentReserved = productData.stockStatus?.reserved || 0;
      const currentOnHand = productData.stockStatus?.onHand || 0;

      const newReserved = currentReserved + item.quantity;
      const newAvailable = currentOnHand - newReserved;

      // Soft Reserve Guard: Assert stock sufficiency
      if (newAvailable < 0) {
        throw new Error(`STOCK_INSUFFICIENT: พัสดุ ${productData.name} มีสต็อกว่างไม่เพียงพอสำหรับการเบิกใช้งาน (มีอยู่ ${currentOnHand - currentReserved})`);
      }

      transaction.update(productRef, {
        "stockStatus.reserved": newReserved,
        "stockStatus.available": newAvailable,
        updatedAt: serverTimestamp()
      });
    }

    // 3. Create Sales Order Document
    const soRef = doc(db, `companies/${companyId}/sales_orders`, soId);
    transaction.set(soRef, {
      ...quoteData,
      soId,
      status: "Confirmed",
      convertedAt: serverTimestamp()
    });

    // 4. Update Quotation Status
    transaction.update(quoteRef, { 
      status: "Approved", 
      linkedSo: soId,
      updatedAt: serverTimestamp() 
    });

    // 5. Automated Double-Entry GL Bookkeeping (Balanced Postings)
    const jvRef = doc(db, `companies/${companyId}/journal_entries`, jvId);
    const totalAmount = quoteData.totalRevenue || 0;

    // Strict Balance Check (Dr == Cr)
    const journalEntry = {
      jvId,
      date: new Date().toISOString(),
      description: `บันทึกรับรู้รายได้จากใบสั่งขายเลขที่ ${soId} (อ้างอิงใบเสนอราคา ${quoteId})`,
      referenceId: soId,
      companyId,
      totalAmount,
      lines: [
        { accountId: "11300", accountName: "ลูกหนี้การค้า", debit: totalAmount, credit: 0 },
        { accountId: "41100", accountName: "รายได้จากการขาย", debit: 0, credit: totalAmount }
      ],
      createdAt: serverTimestamp()
    };

    transaction.set(jvRef, journalEntry);
  });

  return soId;
}
