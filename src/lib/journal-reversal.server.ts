import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * ยกเลิกรายการบัญชีที่เอกสารสร้างไว้ (ใช้ใน transaction เดียวกับการยกเลิกเอกสาร)
 *  - ยังเป็น draft (ยังไม่อนุมัติลงบัญชี): ยกเลิกรายการเดิมทิ้ง (status cancelled, isDeleted)
 *  - ลงบัญชีแล้ว: สร้างรายการกลับบัญชี (สลับเดบิต/เครดิต) ลงวันที่ยกเลิก สถานะ draft รออนุมัติ
 * ต้องอ่าน snapshot ของรายการเดิมในช่วง read ของ transaction แล้วส่งเข้ามา
 */
export function voidOrReverseJournal(
  tx: admin.firestore.Transaction,
  companyId: string,
  snap: admin.firestore.DocumentSnapshot | null,
  opts: { date: string; description: string; reference: string; uid: string; reason: string },
): { mode: "voided" | "reversed" | "none"; reversalId?: string } {
  if (!snap || !snap.exists) return { mode: "none" };
  const j = snap.data()!;
  if (j.isDeleted === true || String(j.status || "").toLowerCase() === "cancelled") return { mode: "none" };
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (String(j.status || "posted").toLowerCase() === "draft") {
    tx.update(snap.ref, { status: "cancelled", isDeleted: true, cancelReason: opts.reason, cancelledBy: opts.uid, cancelledAt: now, updatedAt: now });
    return { mode: "voided" };
  }

  const ref = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
  const items = (j.items || j.lines || []).map((l: any) => ({ ...l, debit: Number(l.credit) || 0, credit: Number(l.debit) || 0 }));
  tx.set(ref, {
    companyId,
    date: opts.date,
    bookType: j.bookType || "JV",
    description: opts.description,
    reference: opts.reference,
    items,
    totalDebit: Number(j.totalCredit) || 0,
    totalCredit: Number(j.totalDebit) || 0,
    reversalOf: snap.id,
    status: "draft",
    createdBy: opts.uid,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  });
  tx.update(snap.ref, { reversedBy: ref.id, updatedAt: now });
  return { mode: "reversed", reversalId: ref.id };
}
