import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { IdType } from "./utils";
import { idService } from "./idService";

/**
 * [SERVER-ONLY] Atomic counter for idService-formatted numbers (INV, BN, PRJ, SKU ...)
 * collection `counters` ถูกล็อกไม่ให้ client อ่าน/เขียน จึงต้องออกเลขผ่าน Admin SDK เท่านั้น
 */
export async function nextCounterSequence(type: IdType, companyId: string, context?: string): Promise<number> {
  if (!companyId) {
    throw new Error("APO ID System Alert: Company ID is strictly required for atomic sequence generation.");
  }

  const yy = new Date().getFullYear().toString().slice(-2);
  const counterRef = adminDb.collection("counters").doc(idService.counterId(type, companyId, context));

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let currentSeq = 0;

    if (snap.exists) {
      const data = snap.data() || {};
      if (type !== "SKU" && data.year && data.year !== yy) {
        currentSeq = 0;
      } else {
        currentSeq = data.currentValue || data.seq || 0;
      }
    }

    const nextSeq = currentSeq + 1;
    const now = admin.firestore.FieldValue.serverTimestamp();

    tx.set(counterRef, {
      currentValue: nextSeq,
      seq: nextSeq,
      updatedAt: now,
      lastUpdated: now,
      type,
      docType: type,
      year: yy,
      companyId,
      is_deleted: false,
      _v: 1
    }, { merge: true });

    return nextSeq;
  });
}
