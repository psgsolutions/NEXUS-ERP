import { db } from "./firebase";
import { 
  doc, 
  runTransaction, 
  increment,
  Timestamp 
} from "firebase/firestore";
import { Product } from "@/types";

/**
 * [LOG-01] Stock Reservation Logic
 * Reserves stock for a Sales Order without deducting from On-Hand quantity.
 */
export const reserveStock = async (
  productId: string, 
  requestQty: number
) => {
  const productRef = doc(db, "products", productId);

  return await runTransaction(db, async (transaction) => {
    const productDoc = await transaction.get(productRef);
    if (!productDoc.exists()) throw new Error("Product not found.");

    const product = productDoc.data() as Product;
    const available = product.stock_status.qty_available;

    if (available < requestQty) {
      throw new Error(`Insufficient stock. Available: ${available}`);
    }

    transaction.update(productRef, {
      "stock_status.qty_reserved": increment(requestQty),
      "stock_status.qty_available": increment(-requestQty),
      updatedAt: Timestamp.now()
    });
  });
};

/**
 * [LOG-03] Weighted Average Cost (WAC) Valuation
 * Calculates new average cost upon Goods Receipt (GRN).
 */
export const calculateWAC = (
  currentQty: number,
  currentAvgCost: number,
  newQty: number,
  newUnitCost: number
): number => {
  if (currentQty + newQty === 0) return 0;
  const totalValue = (currentQty * currentAvgCost) + (newQty * newUnitCost);
  return totalValue / (currentQty + newQty);
};

/**
 * [DAT-03] Atomic Stock Deduction
 * Final deduction of stock when items are actually issued or sold.
 */
export const issueStock = async (
  productId: string, 
  qty: number,
  isFromReserved: boolean = true
) => {
  const productRef = doc(db, "products", productId);

  return await runTransaction(db, async (transaction) => {
    transaction.update(productRef, {
      "stock_status.qty_on_hand": increment(-qty),
      ...(isFromReserved ? { "stock_status.qty_reserved": increment(-qty) } : { "stock_status.qty_available": increment(-qty) }),
      "currentQty": increment(-qty),
      updatedAt: Timestamp.now()
    });
  });
};
