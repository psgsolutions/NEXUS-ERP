import { adminDb } from "@/lib/firebase-admin";
import { ApiAuthError } from "@/lib/api-auth";

/** ลูกค้าของบริษัท (ที่เก็บหลัก หรือ root รุ่นเก่าของบริษัทเดียวกัน) */
export async function getCompanyCustomer(companyId: string, customerId: string) {
  let cust = await adminDb.doc(`companies/${companyId}/customers/${customerId}`).get();
  if (!cust.exists) {
    const legacy = await adminDb.doc(`customers/${customerId}`).get();
    if (legacy.exists && legacy.data()!.companyId === companyId) cust = legacy;
  }
  return cust.exists ? cust : null;
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
