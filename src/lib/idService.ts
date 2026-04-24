import { db } from "./firebase";
import { 
  doc, 
  runTransaction, 
  Timestamp 
} from "firebase/firestore";

/**
 * [DAT-03] Atomic Sequence IDs
 * Service for generating unique, sequential document IDs per company.
 * Format: TYPE-YY-XXXX (e.g., SKU-24-0001)
 */
export const generateNextId = async (
  companyId: string, 
  type: "SKU" | "SO" | "PRJ" | "INV" | "PUR"
): Promise<string> => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const counterRef = doc(db, "companies", companyId, "counters", type);

  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let nextCount = 1;
    if (counterDoc.exists()) {
      const data = counterDoc.data();
      // Reset count if year changes (Optional, usually we keep it sequential)
      nextCount = data.lastCount + 1;
    }

    transaction.set(counterRef, {
      lastCount: nextCount,
      updatedAt: Timestamp.now(),
      year: currentYear
    }, { merge: true });

    const formattedCount = nextCount.toString().padStart(4, "0");
    return `${type}-${currentYear}-${formattedCount}`;
  });
};
