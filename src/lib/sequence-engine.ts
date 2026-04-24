import { db } from "./firebase";
import { doc, runTransaction, getDoc } from "firebase/firestore";

/**
 * [MASTER-STRATEGY-ID] 
 * Nexus Intelligence Sequence Engine V1.0
 * ระบบรันเลขเอกสารอัจฉริยะสำหรับ Enterprise ERP
 */

export type SequencePrefix = "NXI" | "POS" | "QT" | "PRJ" | "SO" | "PO" | "FIN" | "EXP";

export async function nexusSequenceEngine(
  prefix: SequencePrefix, 
  companyId: string
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // "26"
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // "04"
  
  const dateTag = `${year}${month}`; // Always YYMM
  const padLength = 4; // Standardized to 4 digits (0001)

  // Path: companies/{companyId}/counters/{prefix}
  const counterRef = doc(db, `companies/${companyId}/counters`, prefix);

  try {
    const finalId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextSeq = 1;
      const currentData = counterDoc.data();

      // Reset sequence if the month/year changes
      if (counterDoc.exists() && currentData?.lastDate === dateTag) {
        nextSeq = currentData.lastSeq + 1;
      }

      // Update counter in DB
      transaction.set(counterRef, { 
        lastSeq: nextSeq, 
        lastDate: dateTag,
        updatedAt: new Date()
      }, { merge: true });

      // Build ID: [PREFIX]-[YYMM]-[SEQUENCE]
      const sequenceString = nextSeq.toString().padStart(padLength, '0');
      return `${prefix}-${dateTag}-${sequenceString}`;
    });

    return finalId;
  } catch (error) {
    console.error("Sequence Engine Error:", error);
    // Fallback ID กรณีระบบขัดข้อง (เพื่อไม่ให้ User ค้าง)
    return `${prefix}-${dateTag}-TEMP-${Math.floor(Math.random() * 1000)}`;
  }
}
