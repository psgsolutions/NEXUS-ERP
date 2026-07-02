import { db } from "./firebase-client";
import { 
  doc, 
  runTransaction, 
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { nexusSequenceEngine } from "./sequence-engine";

/**
 * [PROC-STRATEGY-V2.0]
 * Procurement & Approval Intelligence
 */

export async function approvePurchaseOrder(poId: string, userId: string, companyId: string) {
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
    const role = userData?.role?.toUpperCase();

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
  const expId = await nexusSequenceEngine("EXP", companyId);
  const expRef = doc(db, `companies/${companyId}/expenses`, expId);

  await setDoc(expRef, {
    ...poData,
    id: expId,
    expenseId: expId,
    poRef: poId,
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
  const whtId = await nexusSequenceEngine("WHT", companyId);
  const whtRef = doc(db, `companies/${companyId}/withholding_taxes`, whtId);

  // Parse total string if necessary, fallback to 0
  let baseAmount = 0;
  if (typeof expData.totalAmount === 'number') {
    baseAmount = expData.totalAmount;
  } else if (typeof expData.amount === 'string') {
    baseAmount = parseFloat(expData.amount.replace(/[^0-9.-]+/g,"")) || 0;
  }

  const whtAmount = (baseAmount * whtRate) / 100;

  // Run in transaction to update Expense status and create WHT
  await runTransaction(db, async (transaction) => {
    transaction.set(whtRef, {
      id: whtId,
      whtId,
      expRef: expId,
      vendor: expData.vendor || expData.supplier || "Unknown",
      documentType: "Withholding Tax (50 Tawi)",
      whtRate,
      baseAmount,
      whtAmount,
      status: "Issued",
      issuedAt: serverTimestamp(),
      companyId,
      createdAt: serverTimestamp(),
    });

    transaction.update(expRef, {
      status: "Paid (WHT Deducted)",
      paymentDate: serverTimestamp(),
      whtRef: whtId
    });
  });

  return whtId;
}
