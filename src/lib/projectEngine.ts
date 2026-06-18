// @ts-nocheck
import { db } from "./firebase-client";
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

/**
 * [LOG-03] Auto-Bidding Engine
 * Evaluates Project BOQ to determine if it exceeds bidding threshold
 */
export const evaluateAutoBidding = async (
  companyId: string,
  projectId: string,
  boqTotal: number
) => {
  const companyRef = doc(db, "companies", companyId);
  const projectRef = doc(db, "projects", projectId);

  await runTransaction(db, async (transaction) => {
    const companySnap = await transaction.get(companyRef);
    if (!companySnap.exists()) throw new Error("Company not found");
    const companyData = companySnap.data();
    
    // Default threshold is 500,000 if not set in config
    const threshold = companyData.settings?.biddingThreshold || 500000;

    if (boqTotal > threshold) {
      transaction.update(projectRef, {
        isBidding: true,
        biddingStatus: 'preparing_tor',
        updatedAt: Timestamp.now()
      });
    } else {
      transaction.update(projectRef, {
        isBidding: false,
        updatedAt: Timestamp.now()
      });
    }
  });

  return true;
};

/**
 * [LOG-04] Mobile Survey Wishlist
 * Adds items to project survey wishlist
 */
export const addSurveyWishlist = async (
  projectId: string,
  items: { itemDescription: string; quantity: number; estimatedPrice?: number }[]
) => {
  const projectRef = doc(db, "projects", projectId);
  
  await runTransaction(db, async (transaction) => {
    const projectSnap = await transaction.get(projectRef);
    if (!projectSnap.exists()) throw new Error("Project not found");
    
    const existingWishlist = projectSnap.data().surveyWishlist || [];
    
    transaction.update(projectRef, {
      surveyWishlist: [...existingWishlist, ...items],
      updatedAt: Timestamp.now()
    });
  });

  return true;
};


