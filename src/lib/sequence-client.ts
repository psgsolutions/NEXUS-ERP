import { apiFetch } from "./api-client";
import type { SequencePrefix } from "./sequence-engine";

/**
 * ขอเลขเอกสารถัดไปจาก server (ตัวนับ companies/{id}/counters เขียนได้ผ่าน API เท่านั้น)
 * ใช้กับเอกสารทั่วไป (ลูกค้า สินค้า SO PR PO WO เบิกค่าใช้จ่าย ใบสำคัญจ่าย หนังสือรับรองหัก ณ ที่จ่าย)
 * เอกสารภาษีที่ต้องเรียงต่อเนื่องออกเลขที่ API ของเอกสารนั้นในทรานแซกชันเดียวกับการบันทึก
 */
export async function nextDocumentNumber(prefix: SequencePrefix, companyId: string): Promise<string> {
  if (!companyId) throw new Error("ไม่พบรหัสบริษัท");
  const res = await apiFetch("/api/sequence/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, prefix }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.number !== "string") throw new Error(data.error || "ออกเลขเอกสารไม่สำเร็จ");
  return data.number;
}
