import { generateNextId } from "./idService";
import { issueStock } from "./inventoryEngine";
import { postToGL, ACCOUNTS } from "./financeEngine";
import { db } from "./firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

interface CheckoutData {
  companyId: string;
  items: {
    id: string;
    sku: string;
    name: string;
    price: number;
    qty: number;
    avgCost: number; // For COGS calculation
  }[];
  total: number;
  paymentMethod: "CASH" | "TRANSFER";
}

/**
 * [LOG-01/02/03] Unified Checkout Engine
 * Handles ID generation, Stock deduction, and GL Posting in a single flow.
 */
export const processCheckout = async (data: CheckoutData) => {
  const { companyId, items, total } = data;

  // 1. Generate Sales Order ID
  const soId = await generateNextId(companyId, "SO");

  // 2. Atomic Stock Deduction for each item
  // [DAT-03] Ensure data integrity during high-velocity sales
  for (const item of items) {
    await issueStock(item.id, item.qty, false); // Direct sale, not from reserved
  }

  // 3. Financial Posting (Income & COGS)
  // [LOG-02] Double-Entry Automation
  const totalCogs = items.reduce((sum, item) => sum + (item.avgCost * item.qty), 0);

  // Entry A: Sales Recognition
  await postToGL(companyId, {
    description: `ยอดขายจาก POS: ${soId}`,
    reference: soId,
    items: [
      { ...ACCOUNTS.CASH, debit: total, credit: 0 },
      { ...ACCOUNTS.SALES_INCOME, debit: 0, credit: total }
    ]
  });

  // Entry B: Cost of Goods Sold (COGS)
  await postToGL(companyId, {
    description: `ต้นทุนขาย: ${soId}`,
    reference: soId,
    items: [
      { ...ACCOUNTS.COST_OF_GOODS_SOLD, debit: totalCogs, credit: 0 },
      { ...ACCOUNTS.INVENTORY, debit: 0, credit: totalCogs }
    ]
  });

  // 4. Save Sales Record for Reporting
  const salesRef = collection(db, "sales_orders");
  await addDoc(salesRef, {
    so_id: soId,
    company_id: companyId,
    items,
    total_amount: total,
    total_cogs: totalCogs,
    createdAt: Timestamp.now()
  });

  return soId;
};
