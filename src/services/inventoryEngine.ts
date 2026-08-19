import { db } from "@/lib/firebase-client";
import { doc, runTransaction, increment, serverTimestamp, collection } from "firebase/firestore";
import { Product } from "@/types/database";

export const deductStockForSalesOrder = async (
  companyId: string,
  salesOrderId: string
) => {
  return await runTransaction(db, async (transaction) => {
    // 1. Fetch Sales Order
    const soRef = doc(db, `companies/${companyId}/sales_orders`, salesOrderId);
    const soSnap = await transaction.get(soRef);
    if (!soSnap.exists()) {
      throw new Error("Sales Order not found.");
    }
    
    const soData = soSnap.data();
    if (soData.status === "Delivered" || soData.stockDeducted) {
      throw new Error("Stock already deducted for this Sales Order.");
    }

    const items = soData.items || [];

    // 2. Prepare stock deduction & movement log
    for (const item of items) {
      const productId = item.productId || item.itemCode;
      if (!productId) continue; // Skip if no valid product reference

      const productRef = doc(db, "products", productId);
      const productSnap = await transaction.get(productRef);
      
      if (productSnap.exists()) {
        const product = productSnap.data() as Product;
        
        // We assume stock was previously reserved when SO was created, 
        // so we deduct from both On-Hand and Reserved.
        // If not reserved, we deduct from On-Hand and Available.
        // For safety, let's just deduct from onHand and available.
        transaction.update(productRef, {
          "stockStatus.onHand": increment(-item.quantity),
          "stockStatus.available": increment(-item.quantity),
          updatedAt: serverTimestamp()
        });

        // Add Stock Movement Log
        const movementRef = doc(collection(db, `companies/${companyId}/stock_movements`));
        transaction.set(movementRef, {
          productId,
          transactionType: "OUT",
          referenceType: "SALES_ORDER",
          referenceNo: soData.soCode || salesOrderId,
          quantity: -item.quantity,
          previousOnHand: product.stockStatus?.onHand || 0,
          newOnHand: (product.stockStatus?.onHand || 0) - item.quantity,
          companyId,
          createdAt: serverTimestamp()
        });
      }
    }

    // 3. Mark Sales Order as deducted
    transaction.update(soRef, {
      stockDeducted: true,
      status: "Delivered", // Or keep as is depending on workflow
      updatedAt: serverTimestamp()
    });
  });
};
