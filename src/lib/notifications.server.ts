import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * แจ้งเตือนในระบบ: companies/{companyId}/notifications
 * ส่งถึงผู้ใช้คนเดียว (targetUserId) หรือทุกคนในบทบาท (targetRoles) — ถ้าไม่ระบุทั้งคู่ = ทุกคนในบริษัท
 * สถานะอ่านแล้วเก็บต่อคนใน readBy (ส่งถึงหลายคนได้โดยไม่ทับกัน)
 */
export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string;
  targetUserId?: string;
  targetRoles?: string[];
  documentNo?: string;
  /** ID คงที่ เพื่อไม่สร้างซ้ำเมื่อเหตุการณ์เดิมเกิดซ้ำ */
  dedupeKey?: string;
}

export function notificationPayload(companyId: string, n: NotificationInput, createdBy = "SYSTEM") {
  return {
    companyId,
    type: n.type,
    title: n.title.slice(0, 200),
    message: n.message.slice(0, 500),
    link: n.link || "",
    targetUserId: n.targetUserId || "",
    targetRoles: (n.targetRoles || []).map((r) => r.toUpperCase()),
    documentNo: n.documentNo || "",
    readBy: [] as string[],
    createdBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isDeleted: false,
  };
}

/** เขียนในทรานแซกชันเดียวกับเอกสาร (แจ้งเตือนเกิดก็ต่อเมื่อบันทึกสำเร็จ) */
export function notifyInTx(tx: admin.firestore.Transaction, companyId: string, n: NotificationInput, createdBy?: string) {
  const col = adminDb.collection(`companies/${companyId}/notifications`);
  const ref = n.dedupeKey ? col.doc(n.dedupeKey) : col.doc();
  tx.set(ref, notificationPayload(companyId, n, createdBy));
}

/** เขียนนอกทรานแซกชัน — ไม่ให้การแจ้งเตือนที่ล้มเหลวทำให้งานหลักล้มเหลว */
export async function notify(companyId: string, n: NotificationInput, createdBy?: string) {
  try {
    const col = adminDb.collection(`companies/${companyId}/notifications`);
    const ref = n.dedupeKey ? col.doc(n.dedupeKey) : col.doc();
    await ref.set(notificationPayload(companyId, n, createdBy));
  } catch (err) {
    console.error("[NOTIFY_FAILED]", err);
  }
}
