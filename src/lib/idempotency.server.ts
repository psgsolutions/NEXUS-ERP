import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * กันบันทึกซ้ำเมื่อเน็ตหลุด: เซิร์ฟเวอร์บันทึกแล้วแต่หน้าจอไม่ได้รับคำตอบ ผู้ใช้กดบันทึกอีกครั้ง
 * หน้าจอส่ง requestKey (สุ่มครั้งเดียวต่อการกรอกฟอร์ม) — คีย์เดิม = คืนผลของครั้งแรก ไม่สร้างเอกสาร/ไม่ออกเลขที่ใหม่
 * เก็บที่ companies/{id}/request_keys/{scope}_{key} เขียนในธุรกรรมเดียวกับเอกสาร (สำเร็จพร้อมกันหรือไม่สำเร็จทั้งคู่)
 * client อ่าน/เขียนไม่ได้ (firestore.rules) · ไม่ส่งคีย์ (หน้าจอเก่า) = ทำงานแบบเดิม
 */
const KEY = /^[A-Za-z0-9_-]{16,64}$/;

export const requestKeyOf = (v: unknown) => (KEY.test(String(v ?? "")) ? String(v) : "");

const keyRef = (companyId: string, scope: string, key: string) => adminDb.doc(`companies/${companyId}/request_keys/${scope}_${key}`);

/** ผลของคำขอเดิม (อ่านก่อนเขียนในธุรกรรม) — null = คำขอใหม่ */
export async function priorResult<T>(tx: admin.firestore.Transaction, companyId: string, scope: string, key: string): Promise<T | null> {
  if (!key) return null;
  const snap = await tx.get(keyRef(companyId, scope, key));
  return snap.exists ? (snap.get("result") as T) : null;
}

/** จำผลของคำขอนี้ (ในธุรกรรมเดียวกับเอกสาร) */
export function rememberResult(tx: admin.firestore.Transaction, companyId: string, scope: string, key: string, uid: string, result: Record<string, any>) {
  if (!key) return;
  tx.set(keyRef(companyId, scope, key), { scope, uid, result, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}
