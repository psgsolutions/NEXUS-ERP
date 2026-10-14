import { db } from "./firebase-client";
import { 
  doc, 
  runTransaction, 
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { nextDocumentNumber } from "./sequence-client";

/**
 * [PROC-STRATEGY-V2.0]
 * Procurement & Approval Intelligence
 */

export async function approvePurchaseOrder(poId: string, userId: string, companyId: string, sessionRole?: string) {
  const poRef = doc(db, `companies/${companyId}/purchase_orders`, poId);
  const userRef = doc(db, "users", userId);

  await runTransaction(db, async (transaction) => {
    const poSnap = await transaction.get(poRef);
    const userSnap = await transaction.get(userRef);

    if (!poSnap.exists()) throw new Error("ไม่พบใบสั่งซื้อ");
    const poData = poSnap.data();
    const userData = userSnap.data();

    // Multi-level Approval Logic
    const amount = poData.totalAmount;
    // role จากโปรไฟล์ ถ้าไม่มี (เช่น SUPERADMIN ที่ไม่มีเอกสาร users) ใช้ role จาก session
    const role = (userData?.role || sessionRole || "").toUpperCase();

    if (amount > 50000 && role !== "SUPERADMIN") {
      throw new Error("ยอดเกิน 50,000 บาท ต้องให้ Superadmin อนุมัติเท่านั้น");
    }

    transaction.update(poRef, { 
      status: "Approved", 
      approvedBy: userId,
      approvedAt: serverTimestamp() 
    });
  });
}

export async function processGoodsReceipt(poId: string, items: any[], companyId: string) {
  const poRef = doc(db, `companies/${companyId}/purchase_orders`, poId);
  
  await runTransaction(db, async (transaction) => {
    // 1. Update PO Status
    transaction.update(poRef, { status: "Received", receivedAt: serverTimestamp() });

    // 2. Trigger Inventory Update (Call stock-service logic here in real app)
    // For each item, update location balance
  });
}

// ==========================================
// THAI ACCOUNTING EXPENSE FLOW (PHASE 2)
// ==========================================

import { setDoc } from "firebase/firestore";

/**
 * Creates an Expense Document (บันทึกรายจ่าย / ใบสำคัญจ่าย) from an existing PO
 */
export async function createExpenseFromPO(poId: string, companyId: string) {
  const poRef = doc(db, `companies/${companyId}/purchase_orders`, poId);
  const poSnap = await getDoc(poRef);

  if (!poSnap.exists()) {
    throw new Error(`Purchase Order ${poId} not found`);
  }

  const poData = poSnap.data();
  const expId = await nextDocumentNumber("EXP", companyId);
  const expRef = doc(db, `companies/${companyId}/expenses`, expId);

  await setDoc(expRef, {
    ...poData,
    id: expId,
    expenseId: expId,
    poRef: poId,
    vendor: poData.supplierName || poData.vendor || "",
    documentType: "Expense",
    status: "Awaiting Payment", // รอจ่ายเงิน
    issuedAt: serverTimestamp(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default credit term
    companyId,
    createdAt: serverTimestamp(),
  });

  return expId;
}

/**
 * Creates a Withholding Tax Certificate (หนังสือรับรองการหักภาษี ณ ที่จ่าย) from an Expense
 */
export async function createWHTFromExpense(expId: string, companyId: string, whtRate: number = 3) {
  const expRef = doc(db, `companies/${companyId}/expenses`, expId);
  const expSnap = await getDoc(expRef);

  if (!expSnap.exists()) {
    throw new Error(`Expense ${expId} not found`);
  }

  const expData = expSnap.data();
  const whtId = await nextDocumentNumber("WHT", companyId);
  const whtRef = doc(db, `companies/${companyId}/withholding_taxes`, whtId);

  // Parse total string if necessary, fallback to 0
  let baseAmount = 0;
  // ฐานภาษีหัก ณ ที่จ่าย = ยอดก่อน VAT (ไม่ใช่ยอดรวม VAT)
  if (typeof expData.subTotal === 'number') {
    baseAmount = expData.subTotal;
  } else if (typeof expData.totalAmount === 'number') {
    baseAmount = expData.totalAmount - (Number(expData.vatAmount) || 0);
  } else if (typeof expData.amount === 'string') {
    baseAmount = parseFloat(expData.amount.replace(/[^0-9.-]+/g,"")) || 0;
  }

  const whtAmount = Math.round(baseAmount * whtRate) / 100;

  // Run in transaction to update Expense status and create WHT
  await runTransaction(db, async (transaction) => {
    transaction.set(whtRef, {
      id: whtId,
      whtId,
      expRef: expId,
      vendor: expData.supplierName || expData.vendor || expData.supplier || "",
      supplierId: expData.supplierId || "",
      taxAmount: whtAmount,
      documentType: "Withholding Tax (50 Tawi)",
      whtRate,
      baseAmount,
      whtAmount,
      status: "Issued",
      issuedAt: serverTimestamp(),
      companyId,
      createdAt: serverTimestamp(),
    });

    // ผูกหนังสือรับรองฯ กับค่าใช้จ่ายเท่านั้น: การจ่ายเงินจริงทำผ่าน POST /api/finance/payments
    // (ซึ่งจะหักภาษีตามหนังสือนี้และตัดยอดเจ้าหนี้)
    transaction.update(expRef, {
      whtRef: whtId,
      whtId,
      whtAmount,
      whtRate,
    });
  });

  return whtId;
}

export interface SupplierPriceRecord {
  supplierId: string;
  supplierName: string;
  price: number;
  poCode?: string;
  date?: string;
  isPrimary?: boolean;
}

/**
 * Fetches recent 2-3 supplier prices for a given product from historical purchase orders
 * and product supplier configuration. Scopes every query with companyId and isDeleted: false.
 */
export async function fetchSupplierPriceHistory(productId: string, companyId: string): Promise<SupplierPriceRecord[]> {
  if (!productId || !companyId) return [];

  const results: SupplierPriceRecord[] = [];
  const seenSuppliers = new Set<string>();

  try {
    const { getDocs, query, collection, where, doc, getDoc } = await import("firebase/firestore");
    
    // 1. Query past purchase_orders with companyId + isDeleted: false
    const posRef = collection(db, "purchase_orders");
    const q = query(
      posRef,
      where("companyId", "==", companyId),
      where("isDeleted", "==", false)
    );
    
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
      const poData = docSnap.data();
      const items = poData.items || [];
      const supplierName = poData.supplierName || poData.supplier || poData.vendor || "ผู้จำหน่ายไม่ระบุชื่อ";
      const supplierId = poData.supplierId || supplierName;

      for (const item of items) {
        if (
          item.productId === productId || 
          item.sku === productId || 
          (item.name && productId && item.name.toLowerCase() === productId.toLowerCase())
        ) {
          const unitPrice = Number(item.price || item.unitPrice || item.cost || 0);
          const sKey = supplierId + ":" + supplierName;
          
          if (!seenSuppliers.has(sKey)) {
            seenSuppliers.add(sKey);
            results.push({
              supplierId,
              supplierName,
              price: unitPrice,
              poCode: poData.poCode || poData.id || docSnap.id,
              date: poData.expectedDate || poData.date || (poData.createdAt?.toDate ? poData.createdAt.toDate().toISOString().split('T')[0] : "")
            });
          }
        }
      }
    });

    // Subcollection query with companyId + isDeleted: false fallback
    if (results.length === 0) {
      const subPosRef = collection(db, `companies/${companyId}/purchase_orders`);
      const subQ = query(
        subPosRef, 
        where("companyId", "==", companyId),
        where("isDeleted", "==", false)
      );
      const subSnap = await getDocs(subQ);
      
      subSnap.forEach((docSnap) => {
        const poData = docSnap.data();
        const items = poData.items || [];
        const supplierName = poData.supplierName || poData.supplier || poData.vendor || "ผู้จำหน่ายไม่ระบุชื่อ";
        const supplierId = poData.supplierId || supplierName;

        for (const item of items) {
          if (
            item.productId === productId || 
            item.sku === productId || 
            (item.name && productId && item.name.toLowerCase() === productId.toLowerCase())
          ) {
            const unitPrice = Number(item.price || item.unitPrice || item.cost || 0);
            const sKey = supplierId + ":" + supplierName;

            if (!seenSuppliers.has(sKey)) {
              seenSuppliers.add(sKey);
              results.push({
                supplierId,
                supplierName,
                price: unitPrice,
                poCode: poData.poCode || poData.id || docSnap.id,
                date: poData.expectedDate || poData.date || (poData.createdAt?.toDate ? poData.createdAt.toDate().toISOString().split('T')[0] : "")
              });
            }
          }
        }
      });
    }

    // Fallback to Product.supplierConfig if purchase order history < 3
    if (results.length < 3) {
      try {
        const prodRef = doc(db, "products", productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          if (prodData.companyId === companyId && prodData.isDeleted !== true && Array.isArray(prodData.supplierConfig)) {
            for (const cfg of prodData.supplierConfig) {
              const sKey = cfg.supplierId + ":" + (cfg.supplierName || cfg.supplierId);
              if (!seenSuppliers.has(sKey)) {
                seenSuppliers.add(sKey);
                results.push({
                  supplierId: cfg.supplierId,
                  supplierName: cfg.supplierName || cfg.supplierId,
                  price: cfg.latestCost || 0,
                  isPrimary: cfg.isPrimary
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("Product supplierConfig lookup warning:", err);
      }
    }
  } catch (err) {
    console.error("Error fetching supplier price history:", err);
  }

  return results.slice(0, 3);
}

