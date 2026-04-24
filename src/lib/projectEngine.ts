import { db } from "./firebase";
import { 
  doc, 
  runTransaction, 
  increment,
  Timestamp 
} from "firebase/firestore";
import { postToGL, ACCOUNTS } from "./financeEngine";
import { issueStock } from "./inventoryEngine";

/**
 * [LOG-01/02] Project Resource Logic
 * Issues materials to a project and records the cost.
 */
export const issueMaterialToProject = async (
  companyId: string,
  projectId: string,
  data: {
    productId: string;
    sku: string;
    qty: number;
    avgCost: number;
    name: string;
  }
) => {
  const { productId, qty, avgCost, name } = data;
  const totalCost = qty * avgCost;

  // 1. Atomic Stock Deduction
  await issueStock(productId, qty, false); // Direct issue to project

  // 2. Automated Financial Posting (Project Cost)
  // [LOG-02] Double-Entry GL
  await postToGL(companyId, {
    description: `เบิกพัสดุเข้าโครงการ: ${name} (Qty: ${qty})`,
    reference: projectId,
    items: [
      { account_code: "512100", account_name: "ต้นทุนวัสดุโครงการ", debit: totalCost, credit: 0 },
      { ...ACCOUNTS.INVENTORY, debit: 0, credit: totalCost }
    ]
  });

  // 3. Update Project Cost Accumulation
  const projectRef = doc(db, "projects", projectId);
  await runTransaction(db, async (transaction) => {
    transaction.update(projectRef, {
      total_material_cost: increment(totalCost),
      updatedAt: Timestamp.now()
    });
  });

  return true;
};
