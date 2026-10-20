import { adminDb } from "@/lib/firebase-admin";
import { effectiveDocProfile } from "@/lib/customer-doc-profile";

/**
 * โปรไฟล์เอกสารของลูกค้า (ของบริษัท) สำหรับสร้างเอกสาร — ไม่มีลูกค้า/อ่านไม่ได้ = ค่าตั้งต้นแบบเอกชน
 * ใช้กำหนด: เว้นวันที่, ข้อความบังคับ, รายการเอกสารแนบบนใบวางบิล
 */
export async function customerDocProfile(companyId: string, customerId: any) {
  const id = String(customerId || "").trim();
  if (!id || id.includes("/")) return effectiveDocProfile(null);
  const snap = await adminDb.doc(`companies/${companyId}/customers/${id}`).get().catch(() => null);
  return effectiveDocProfile(snap?.exists ? snap.data()?.docProfile : null);
}
