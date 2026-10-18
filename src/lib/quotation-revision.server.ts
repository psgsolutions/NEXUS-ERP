import * as admin from "firebase-admin";

/**
 * ออกใบเสนอราคาฉบับแก้ไข (-R{n}) ในทรานแซกชันที่เรียก (ใช้ร่วม: หน้าใบเสนอราคา และคำขอเปลี่ยนแปลงโครงการ)
 * ใบเดิมเป็น superseded + สร้างใบใหม่ (ร่าง) + รายการ (คัดลอกเดิม หรือรายการใหม่ที่ส่งมา)
 */

export const REVISABLE = ["SENT", "ACCEPTED"];
// ข้อมูลของรอบการส่ง/อนุมัติเดิม ไม่ติดไปฉบับใหม่
const RESET_FIELDS = ["linkedSo", "approvedAt", "approvedBy", "sentAt", "sentBy", "sentChannel", "supersededBy", "supersededAt", "lastSentAt"];

export const quotationDocNo = (q: any, id: string) => q.documentNo || q.quotationNumber || q.quoteId || id;

/** เหตุผลที่ออกฉบับแก้ไขไม่ได้ (null = ออกได้) */
export function revisionBlockReason(orig: any, docNo: string): string | null {
  const status = String(orig.status || "DRAFT").toUpperCase();
  if (orig.isSample) return `${docNo} เป็นเอกสารตัวอย่าง`;
  if (status === "SUPERSEDED" || orig.supersededBy) return `${docNo} ถูกแทนที่ด้วยฉบับใหม่แล้ว กรุณาออกฉบับแก้ไขจากฉบับล่าสุด`;
  if (orig.linkedSo || ["APPROVED", "WON", "CONVERTED"].includes(status)) return `${docNo} แปลงเป็นใบสั่งขายแล้ว ออกฉบับแก้ไขไม่ได้ ให้แก้ที่ใบสั่งขายหรือออกใบลดหนี้/เพิ่มหนี้`;
  if (!REVISABLE.includes(status)) return `${docNo} ยังไม่ได้ส่งลูกค้า แก้ไขบนใบเดิมได้โดยไม่ต้องออกฉบับแก้ไข`;
  return null;
}

export function writeQuotationRevision(tx: admin.firestore.Transaction, a: {
  companyId: string;
  origRef: admin.firestore.DocumentReference;
  orig: any;
  origId: string;
  newRef: admin.firestore.DocumentReference;
  oldLines: Record<string, any>[];
  uid: string;
  changeSummary: string;
  /** รายการใหม่ (normalize แล้ว) และยอดใหม่ — ไม่ส่ง = คัดลอกของเดิม */
  lines?: Record<string, any>[];
  totals?: Record<string, any>;
  extra?: Record<string, any>;
}) {
  const { orig } = a;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const docNo = quotationDocNo(orig, a.origId);
  const currentRev = Number(orig.revisionNumber) || 1;
  const newRev = currentRev + 1;
  const baseDocNo = String(docNo).replace(/-R\d+$/, "");
  const newDocNo = `${baseDocNo}-R${newRev}`;
  const createdIso = orig.createdAt?.toDate ? orig.createdAt.toDate().toISOString() : String(orig.createdAt || new Date().toISOString());
  const history: any[] = Array.isArray(orig.revisionHistory) && orig.revisionHistory.length
    ? orig.revisionHistory.map((h: any) => (h.revisionNumber === currentRev && !h.quotationId ? { ...h, quotationId: a.origId } : h))
    : [{ revisionNumber: currentRev, documentNumber: docNo, quotationId: a.origId, grandTotal: orig.grandTotal || 0, createdAt: createdIso, createdBy: orig.createdBy || "", changeSummary: "ฉบับเริ่มต้น" }];
  history.push({
    revisionNumber: newRev, documentNumber: newDocNo, quotationId: a.newRef.id,
    grandTotal: a.totals?.grandTotal ?? orig.grandTotal ?? 0,
    createdAt: new Date().toISOString(), createdBy: a.uid, changeSummary: a.changeSummary,
  });

  tx.update(a.origRef, { status: "SUPERSEDED", supersededBy: a.newRef.id, supersededByNo: newDocNo, supersededAt: now, revisionHistory: history, updatedAt: now, updatedBy: a.uid });
  const payload: Record<string, any> = { ...orig };
  RESET_FIELDS.forEach((f) => delete payload[f]);
  tx.set(a.newRef, {
    ...payload,
    ...(a.totals || {}),
    ...(a.extra || {}),
    id: a.newRef.id,
    companyId: a.companyId,
    documentNo: newDocNo,
    quotationNumber: newDocNo,
    revisionNumber: newRev,
    parentQuotationId: orig.parentQuotationId || a.origId,
    previousRevisionId: a.origId,
    revisionHistory: history,
    status: "DRAFT",
    createdBy: a.uid,
    createdAt: now,
    updatedAt: now,
    updatedBy: a.uid,
    isDeleted: false,
  });
  (a.lines || a.oldLines).forEach((line) => {
    const ref = a.newRef.collection("lines").doc();
    tx.set(ref, { ...line, id: ref.id });
  });
  return { docNo, newDocNo, newRev };
}
