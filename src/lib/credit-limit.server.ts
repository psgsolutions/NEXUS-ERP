import { adminDb } from "@/lib/firebase-admin";
import { ApiAuthError } from "@/lib/api-auth";
import { getRecord } from "@/lib/master-store.server";

/** ลูกค้าของบริษัท (ข้อมูลกลางของเครือ + ของบริษัท, หรือ root รุ่นเก่าของบริษัทเดียวกัน) — คืนรูปแบบเดียวกับ snapshot */
export async function getCompanyCustomer(companyId: string, customerId: string) {
  const rec = await getRecord("customers", companyId, customerId);
  if (rec) return { id: rec.id, ref: rec.ref, exists: true as const, data: () => rec.data };
  const legacy = await adminDb.doc(`customers/${customerId}`).get();
  if (legacy.exists && legacy.data()!.companyId === companyId) return { id: legacy.id, ref: legacy.ref, exists: true as const, data: () => legacy.data()! };
  return null;
}

/**
 * วงเงินเครดิต: ยอดค้างของใบกำกับภาษีที่ยังไม่ชำระครบ + ยอดใหม่ ต้องไม่เกินวงเงิน
 * (วงเงิน 0 หรือไม่ระบุ = ไม่จำกัด)
 */
export async function assertCreditAvailable(companyId: string, customerId: string, customer: any, amount: number) {
  const limit = Number(customer?.creditLimit ?? customer?.credit_limit ?? 0);
  if (!(limit > 0)) return;
  const inv = await adminDb.collection(`companies/${companyId}/invoices`).where("customerId", "==", customerId).get();
  const outstanding = inv.docs.reduce((s, d) => {
    const x = d.data();
    if (x.isDeleted === true || x.isSample === true || String(x.status || "").toLowerCase() === "cancelled") return s;
    return s + (x.balance !== undefined ? Number(x.balance) || 0 : x.paymentStatus === "paid" ? 0 : Number(x.grandTotal) || 0);
  }, 0);
  if (amount > limit - outstanding + 0.009) {
    throw new ApiAuthError(409, `ยอดเกินวงเงินเครดิตคงเหลือ (${(limit - outstanding).toLocaleString("th-TH")} บาท) ยืนยันไม่ได้ — บันทึกเป็นร่างได้`);
  }
}
