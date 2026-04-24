import { db } from "./firebase";
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
