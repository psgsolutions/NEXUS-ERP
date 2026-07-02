import { db } from "./firebase-client";
import { doc, runTransaction, getDoc } from "firebase/firestore";

/**
 * [MASTER-STRATEGY-ID] 
 * Nexus Intelligence Sequence Engine V1.0
 * ระบบรันเลขเอกสารอัจฉริยะสำหรับ Enterprise ERP
 */

export type SequencePrefix = "NXI" | "INV" | "POS" | "QT" | "PRJ" | "SO" | "PO" | "FIN" | "EXP" | "CUS" | "EMP" | "SUP" | "PRD" | "WO" | "DN" | "PR" | "WHT" | "RE" | "RV" | "PV" | "GR" | "IV" | "TAX";

export async function nexusSequenceEngine(
  prefix: SequencePrefix, 
  companyId: string
): Promise<string> {
  try {
    // 1. Fetch custom format (Read outside transaction to avoid lock contention on settings)
    const formatRef = doc(db, `companies/${companyId}/settings`, "sequence_formats");
    const formatDoc = await getDoc(formatRef);
    let formatStr = `${prefix}-[YYMM]-[0000]`; // Fallback default
    if (formatDoc.exists() && formatDoc.data()[prefix]) {
      formatStr = formatDoc.data()[prefix];
    }

    const now = new Date();
    const YYYY = now.getFullYear().toString();
    const YY = YYYY.slice(-2);
    const BBBB = (now.getFullYear() + 543).toString();
    const BB = BBBB.slice(-2);
    const MM = (now.getMonth() + 1).toString().padStart(2, '0');
    const DD = now.getDate().toString().padStart(2, '0');

    // 2. Parse Date Tokens (Case Insensitive)
    let resolvedFormat = formatStr
      .replace(/\[PREFIX\]/gi, prefix)
      .replace(/\[YYYY\]/gi, YYYY)
      .replace(/\[YYMM\]/gi, `${YY}${MM}`) // Legacy support
      .replace(/\[YY\]/gi, YY)
      .replace(/\[BBBB\]/gi, BBBB)
      .replace(/\[BB\]/gi, BB)
      .replace(/\[MM\]/gi, MM)
      .replace(/\[DD\]/gi, DD);

    // 3. Extract Zero Pad Token (e.g. [0000] or 0000)
    const zeroMatch = resolvedFormat.match(/\[(0+)\]/) || resolvedFormat.match(/(0{3,})/);
    let padLength = 4;
    let zeroToken = '[0000]';

    if (zeroMatch) {
      zeroToken = zeroMatch[0];
      padLength = zeroMatch[1] ? zeroMatch[1].length : zeroToken.length;
    }

    const parts = resolvedFormat.split(zeroToken);
    const prefixPart = parts[0];
    const suffixPart = parts.length > 1 ? parts[1] : "";

    // We use prefixPart as the reset condition. If time rolls over, prefixPart changes, sequence resets.
    const dateTag = prefixPart;

    // Path: companies/{companyId}/counters/{prefix}
    const counterRef = doc(db, `companies/${companyId}/counters`, prefix);

    const finalId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextSeq = 1;
      const currentData = counterDoc.data();

      // Reset sequence if the time components change (e.g. month rollover)
      if (counterDoc.exists() && currentData?.lastDate === dateTag) {
        nextSeq = (currentData.lastSeq || 0) + 1;
      }

      // Update counter in DB
      transaction.set(counterRef, { 
        lastSeq: nextSeq, 
        lastDate: dateTag,
        updatedAt: new Date()
      }, { merge: true });

      // Build ID
      const sequenceString = nextSeq.toString().padStart(padLength, '0');
      return `${prefixPart}${sequenceString}${suffixPart}`;
    });

    return finalId;
  } catch (error) {
    console.error("Sequence Engine Error:", error);
    // Fallback ID กรณีระบบขัดข้อง
    return `${prefix}-TEMP-${Math.floor(Math.random() * 1000)}`;
  }
}
