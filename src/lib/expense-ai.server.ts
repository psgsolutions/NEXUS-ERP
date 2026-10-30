import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EXPENSE_ACCOUNTS } from "@/lib/payables";
import { normalizeInboxData, type InboxData } from "@/lib/expense-inbox";
import { aiErrorInfo, geminiConfigured, geminiModel, parseAiJson } from "@/lib/gemini.server";

/**
 * อ่านรูปบิล/ใบเสร็จด้วย Gemini → ข้อมูลรายจ่าย (ผู้ใช้ตรวจ/แก้ และผู้มีสิทธิ์ยืนยันก่อนเป็นรายจ่ายเสมอ)
 * ไม่มีคีย์ AI = คืนข้อมูลว่างให้กรอกเอง
 */
export const aiReady = geminiConfigured;

export async function readReceiptImages(images: { mime: string; data: string }[]): Promise<{ data: InboxData; error?: string }> {
  if (!aiReady()) return { data: normalizeInboxData({}), error: "ยังไม่ได้ตั้งค่า AI (GEMINI_API_KEY) — กรอกข้อมูลเอง" };
  const parts = images.filter((i) => i.mime.startsWith("image/")).slice(0, 3)
    .map((i) => ({ inlineData: { mimeType: i.mime, data: i.data.replace(/^data:[^;]+;base64,/, "") } }));
  if (!parts.length) return { data: normalizeInboxData({}), error: "ไม่มีรูปให้อ่าน (PDF ให้กรอกเอง)" };
  const accounts = EXPENSE_ACCOUNTS.map((a) => `${a.code} ${a.name}`).join("; ");
  const prompt = `อ่านรูปบิล/ใบเสร็จ/ใบกำกับภาษีภาษาไทยนี้ (อาจหลายรูปเป็นบิลเดียว) แล้วตอบเป็น JSON เท่านั้น:
{"docType":"TAX_INVOICE|RECEIPT|CASH_BILL|NONE","vendorName":"ชื่อร้าน/ผู้รับเงิน","vendorTaxId":"เลขผู้เสียภาษี 13 หลัก หรือว่าง","vendorAddress":"","date":"YYYY-MM-DD (ค.ศ.)","docNo":"เลขที่บิล","items":[{"description":"","qty":1,"unitPrice":0,"amount":0}],"subtotal":0,"vat":0,"total":0,"suggestedAccount":"รหัสบัญชี","note":"ข้อสังเกต เช่น อ่านไม่ชัด"}
กติกา:
- TAX_INVOICE = มีคำว่าใบกำกับภาษี และเลขผู้เสียภาษีผู้ขาย และแยก VAT · RECEIPT = ใบเสร็จรับเงินที่ไม่มี VAT · CASH_BILL = บิลเงินสด/ใบส่งของ/ใบรับเงินเขียนมือ ไม่มีเลขผู้เสียภาษี · NONE = ไม่ใช่เอกสารการเงิน (เช่น รูปสินค้า หน้าจอโอนเงิน)
- วันที่ พ.ศ. ให้แปลงเป็น ค.ศ. (ลบ 543) · ตัวเลขไม่มีเครื่องหมายจุลภาค · ไม่แน่ใจให้เว้นว่างและบอกใน note
- suggestedAccount เลือกจาก: ${accounts}`;
  try {
    const res = await geminiModel({ generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }).generateContent([prompt, ...parts]);
    return { data: normalizeInboxData(parseAiJson(res.response.text())) };
  } catch (e: any) {
    const info = aiErrorInfo(e);
    if (info.status >= 500) console.error("[EXPENSE_AI_ERROR]", e);
    return { data: normalizeInboxData({}), error: `${info.message} — กรอกข้อมูลเอง` };
  }
}

/** อ่านรูปที่แนบของรายการด้วย AI แล้วเก็บผล (ใช้ทั้งหน้าจอและ LINE) */
export async function analyzeInbox(companyId: string, id: string) {
  const ref = adminDb.doc(`companies/${companyId}/photo_inbox/${id}`);
  const att = await adminDb.collection(`companies/${companyId}/attachments`).where("ownerType", "==", "photo_inbox").where("ownerId", "==", id).limit(3).get();
  const { data, error } = await readReceiptImages(att.docs.map((d) => ({ mime: String(d.get("mime")), data: String(d.get("data")) })));
  await ref.update({ data, aiError: error || "", status: "REVIEW", analyzedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { data, error };
}

