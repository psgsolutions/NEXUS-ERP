import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { ApiAuthError } from "./api-auth";

/**
 * [SERVER-ONLY] บัญชีธนาคารและเช็คของเอกสารรับ/จ่ายเงิน
 * - เลือกบัญชีจากทะเบียน (bankAccountId) หรือพิมพ์ชื่อบัญชีแบบเดิม (ข้อมูลรุ่นเก่า)
 * - จ่าย/รับด้วยเช็ค: ต้องมีเลขที่เช็คและวันที่หน้าเช็ค แล้วบันทึกลงทะเบียนเช็ค (companies/{id}/cheques)
 */

const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

export interface BankTarget {
  bankAccountId: string;
  bankAccount: string;
  cheque: { chequeNo: string; chequeDate: string; chequeBank: string } | null;
}

export async function resolveBankTarget(companyId: string, method: string, body: any, purpose: "รับเงิน" | "จ่ายเงิน" | "คืนเงิน"): Promise<BankTarget> {
  if (method === "CASH") return { bankAccountId: "", bankAccount: "", cheque: null };
  let bankAccountId = str(body.bankAccountId);
  let bankAccount = str(body.bankAccount);
  if (bankAccountId) {
    const snap = await adminDb.doc(`companies/${companyId}/bank_accounts/${bankAccountId}`).get();
    const a = snap.data();
    if (!snap.exists || a?.isDeleted === true) throw new ApiAuthError(400, "ไม่พบบัญชีธนาคารที่เลือก");
    if (a?.active === false) throw new ApiAuthError(400, `บัญชี ${a?.name || bankAccountId} ปิดใช้งานแล้ว`);
    bankAccount = [a?.name, a?.accountNo].filter(Boolean).join(" ");
  } else {
    bankAccountId = "";
    if (!bankAccount) throw new ApiAuthError(400, `กรุณาเลือกบัญชีธนาคารที่${purpose}`);
  }
  let cheque: BankTarget["cheque"] = null;
  if (method === "CHEQUE") {
    const chequeNo = str(body.chequeNo, 30);
    if (!chequeNo) throw new ApiAuthError(400, "กรุณาระบุเลขที่เช็ค");
    if (!isDate(body.chequeDate)) throw new ApiAuthError(400, "กรุณาระบุวันที่หน้าเช็ค");
    cheque = { chequeNo, chequeDate: String(body.chequeDate), chequeBank: str(body.chequeBank, 80) };
  }
  return { bankAccountId, bankAccount, cheque };
}

/** บันทึกเช็คลงทะเบียน (เรียกในทรานแซกชันเดียวกับเอกสาร) — รหัสเช็ค = เลขเอกสาร */
export function writeCheque(
  tx: FirebaseFirestore.Transaction,
  companyId: string,
  target: BankTarget,
  doc: { direction: "IN" | "OUT"; docKind: "receipt" | "payment" | "refund"; docNo: string; docDate: string; party: string; amount: number; uid: string },
) {
  if (!target.cheque) return;
  const now = admin.firestore.FieldValue.serverTimestamp();
  tx.create(adminDb.doc(`companies/${companyId}/cheques/${doc.docNo}`), {
    id: doc.docNo, companyId,
    direction: doc.direction, docKind: doc.docKind, docNo: doc.docNo, docDate: doc.docDate,
    chequeNo: target.cheque.chequeNo, chequeDate: target.cheque.chequeDate, chequeBank: target.cheque.chequeBank,
    bankAccountId: target.bankAccountId, bankAccount: target.bankAccount,
    party: doc.party, amount: Math.round(doc.amount * 100) / 100,
    // รับเช็ค: รอนำฝาก -> นำฝากแล้ว -> เรียกเก็บได้ / เด้ง ; จ่ายเช็ค: ยังไม่ขึ้นเงิน -> ขึ้นเงินแล้ว
    status: "PENDING",
    history: [{ status: "PENDING", at: new Date().toISOString(), by: doc.uid }],
    createdBy: doc.uid, createdAt: now, updatedAt: now, isDeleted: false,
  });
}

/** ยกเลิกเอกสาร -> ยกเลิกเช็คที่ผูกอยู่ (ถ้ามีและยังไม่ขึ้นเงิน) — ต้องอ่านเช็คก่อนเขียนในทรานแซกชัน */
export async function readChequeForCancel(tx: FirebaseFirestore.Transaction, companyId: string, docNo: string) {
  const ref = adminDb.doc(`companies/${companyId}/cheques/${docNo}`);
  const snap = await tx.get(ref);
  return snap.exists ? { ref, data: snap.data()! } : null;
}
