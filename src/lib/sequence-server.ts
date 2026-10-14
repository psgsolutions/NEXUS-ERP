import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { IdType } from "./utils";
import { idService } from "./idService";
import { resolveSequenceFormat, SequencePrefix } from "./sequence-engine";

/**
 * [SERVER-ONLY] ออกเลขตามรูปแบบของบริษัท (companies/{id}/counters/{prefix})
 * Path: companies/{companyId}/counters/{prefix}
 */
export async function nexusSequenceServer(prefix: SequencePrefix, companyId: string): Promise<string> {
  const formatSnap = await adminDb.doc(`companies/${companyId}/settings/sequence_formats`).get();
  const formatStr = formatSnap.exists ? formatSnap.data()?.[prefix] : undefined;
  const { prefixPart, suffixPart, padLength } = resolveSequenceFormat(prefix, formatStr);

  const counterRef = adminDb.doc(`companies/${companyId}/counters/${prefix}`);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const data = snap.data();
    const nextSeq = snap.exists && data?.lastDate === prefixPart ? (data.lastSeq || 0) + 1 : 1;

    tx.set(counterRef, { lastSeq: nextSeq, lastDate: prefixPart, updatedAt: new Date() }, { merge: true });
    return `${prefixPart}${nextSeq.toString().padStart(padLength, "0")}${suffixPart}`;
  });
}

/**
 * [SERVER-ONLY] ออกเลขเอกสารภายใน transaction เดียวกับการบันทึกเอกสาร
 * เลขจะถูกใช้เฉพาะเมื่อ transaction สำเร็จ (ตรวจไม่ผ่าน/ล้มเหลว = เลขไม่ข้าม)
 *
 * const take = await prepareSequence("RE", companyId);
 * await adminDb.runTransaction(async (tx) => {
 *   const seq = await take(tx);      // ต้องเรียกในช่วงอ่าน (ก่อน write ใด ๆ)
 *   ... ตรวจข้อมูล ...
 *   seq.commit();                    // เขียนตัวนับพร้อมเอกสาร
 * });
 */
export async function prepareSequence(prefix: SequencePrefix, companyId: string) {
  const formatSnap = await adminDb.doc(`companies/${companyId}/settings/sequence_formats`).get();
  const formatStr = formatSnap.exists ? formatSnap.data()?.[prefix] : undefined;
  const { prefixPart, suffixPart, padLength } = resolveSequenceFormat(prefix, formatStr);
  const counterRef = adminDb.doc(`companies/${companyId}/counters/${prefix}`);
  return async (tx: FirebaseFirestore.Transaction) => {
    const snap = await tx.get(counterRef);
    const data = snap.data();
    const nextSeq = snap.exists && data?.lastDate === prefixPart ? (data.lastSeq || 0) + 1 : 1;
    return {
      number: `${prefixPart}${nextSeq.toString().padStart(padLength, "0")}${suffixPart}`,
      commit: () => tx.set(counterRef, { lastSeq: nextSeq, lastDate: prefixPart, updatedAt: new Date() }, { merge: true }),
    };
  };
}

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

/**
 * [SERVER-ONLY] เหมือน nextCounterSequence (ตัวนับรูปแบบ idService เช่น INV, BN) แต่ออกเลขภายใน transaction ของผู้เรียก
 * เลขถูกใช้เฉพาะเมื่อ transaction สำเร็จ — ใบกำกับภาษีต้องเรียงเลขต่อเนื่อง ห้ามข้าม
 *
 * const take = prepareCounter("INV", companyId);
 * await adminDb.runTransaction(async (tx) => { const seq = await take(tx); ... seq.commit(); });
 */
export function prepareCounter(type: IdType, companyId: string, context?: string) {
  if (!companyId) throw new Error("Company ID is required for sequence generation.");
  const yy = new Date().getFullYear().toString().slice(-2);
  const counterRef = adminDb.collection("counters").doc(idService.counterId(type, companyId, context));
  return async (tx: FirebaseFirestore.Transaction) => {
    const snap = await tx.get(counterRef);
    const data = snap.data() || {};
    const currentSeq = snap.exists && !(type !== "SKU" && data.year && data.year !== yy) ? data.currentValue || data.seq || 0 : 0;
    const nextSeq = currentSeq + 1;
    return {
      number: idService.formatId(type, nextSeq, context),
      commit: () => {
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.set(counterRef, { currentValue: nextSeq, seq: nextSeq, updatedAt: now, lastUpdated: now, type, docType: type, year: yy, companyId, is_deleted: false, _v: 1 }, { merge: true });
      },
    };
  };
}
