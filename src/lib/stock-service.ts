import { db } from "./firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  increment 
} from "firebase/firestore";
import { nexusSequenceEngine } from "./sequence-engine";
import { postToGL, ACCOUNTS } from "./financeEngine";
import { Product } from "@/types";

/**
 * [INV-STRATEGY-V2.0]
 * Double-Entry Stock Movement Logic
 */

export interface StockMovement {
  productId: string;
  type: "IN" | "OUT" | "TRANSFER";
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  referenceId?: string; // PRJ-XX or PO-XX
  snList?: string[];
  userId: string;
  companyId: string;
}

export async function processStockMovement(movement: StockMovement) {
  const { productId, type, quantity, fromLocation, toLocation, companyId, snList } = movement;

  // 1. Generate Transaction ID (NXI-YYMM-XXXX)
  const transactionId = await nexusSequenceEngine("NXI", companyId);

  await runTransaction(db, async (transaction) => {
    // 1.5 Fetch Product Data for WAC and Balance
    const productRef = doc(db, "products", productId);
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) throw new Error("Product not found");
    const product = productSnap.data() as Product;
    const unitCost = product.pricing?.costWAC || 0;
    const totalValue = unitCost * quantity;

    // 2. Update Source Location Balance (if applicable)
    if (fromLocation) {
      const fromBalanceRef = doc(db, `companies/${companyId}/inventory_balance`, `${fromLocation}_${productId}`);
      const fromSnap = await transaction.get(fromBalanceRef);
      const currentFrom = fromSnap.exists() ? fromSnap.data().quantity : 0;
      
      if (currentFrom < quantity) throw new Error("สต็อกไม่เพียงพอในคลังต้นทาง");
      
      transaction.set(fromBalanceRef, { 
        quantity: currentFrom - quantity,
        updatedAt: serverTimestamp() 
      }, { merge: true });
    }

    // 3. Update Destination Location Balance (if applicable)
    if (toLocation) {
      const toBalanceRef = doc(db, `companies/${companyId}/inventory_balance`, `${toLocation}_${productId}`);
      const toSnap = await transaction.get(toBalanceRef);
      const currentTo = toSnap.exists() ? toSnap.data().quantity : 0;
      
      transaction.set(toBalanceRef, { 
        quantity: currentTo + quantity,
        updatedAt: serverTimestamp() 
      }, { merge: true });
    }

    // 4. Update Product Master Balance (Strategic Reservation Link)
    if (type === "OUT") {
      transaction.update(productRef, {
        "stockStatus.onHand": increment(-quantity),
        "stockStatus.available": increment(-quantity), // Assume not from reserved for simple move
        updatedAt: serverTimestamp()
      });
    } else if (type === "IN") {
      transaction.update(productRef, {
        "stockStatus.onHand": increment(quantity),
        "stockStatus.available": increment(quantity),
        updatedAt: serverTimestamp()
      });
    }

    // 5. Automated Double-Entry GL Posting
    if (type === "OUT" && totalValue > 0) {
      const journalRef = doc(collection(db, "journal_entries"));
      transaction.set(journalRef, {
        company_id: companyId,
        date: new Date().toISOString(),
        description: `เบิกพัสดุ: ${product.name} [Ref: ${movement.referenceId || transactionId}]`,
        reference: movement.referenceId || transactionId,
        total_amount: totalValue,
        items: [
          { accountCode: ACCOUNTS.COST_OF_GOODS_SOLD.code, accountName: ACCOUNTS.COST_OF_GOODS_SOLD.name, debit: totalValue, credit: 0 },
          { accountCode: ACCOUNTS.INVENTORY.code, accountName: ACCOUNTS.INVENTORY.name, debit: 0, credit: totalValue }
        ],
        createdAt: serverTimestamp()
      });
    }

    // 6. Update Serial Number Statuses
    if (snList && snList.length > 0) {
      for (const sn of snList) {
        const snRef = doc(db, `companies/${companyId}/serial_numbers`, sn);
        const snStatus = type === "OUT" ? "deployed" : type === "IN" ? "available" : "available";
        transaction.set(snRef, {
          productId,
          status: snStatus,
          lastReference: movement.referenceId,
          lastLocation: toLocation || fromLocation,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    // 7. Log Movement Record
    const moveRef = doc(db, `companies/${companyId}/stock_movements`, transactionId);
    transaction.set(moveRef, {
      ...movement,
      transactionId,
      unitCost,
      totalValue,
      timestamp: serverTimestamp()
    });
  });

  return transactionId;
}
