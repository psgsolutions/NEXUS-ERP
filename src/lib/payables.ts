/**
 * เจ้าหนี้ / ค่าใช้จ่ายค้างจ่าย — ใช้ร่วมกันทั้งหน้าจอและ server
 */

/** กลุ่มผู้รับเงิน: ผู้จำหน่าย (supplierId) / พนักงาน (เบิกค่าใช้จ่าย) / ชื่อผู้รับ */
export function payeeKeyOf(e: any): string {
  if (e.supplierId) return `SUP:${e.supplierId}`;
  if (e.employeeId) return `EMP:${e.employeeId}`;
  return `NAME:${String(e.supplierName || e.vendor || "-").trim()}`;
}

export const EXPENSE_ACCOUNTS = [
  { code: "5300-00", name: "ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป" },
  { code: "5301-00", name: "ค่าเดินทางและพาหนะ" },
  { code: "5302-00", name: "ค่ารับรองลูกค้า" },
  { code: "5303-00", name: "ค่าวัสดุสิ้นเปลืองสำนักงาน" },
];

// รหัสรูปแบบเก่า 53000-0X (5 หลัก) -> 530X-00 ให้ตรงผังบัญชีของระบบ
const LEGACY_CODE = /^53000-0(\d)$/;

/** บัญชีค่าใช้จ่ายของรายการ (กรณียังไม่ได้ตั้งเจ้าหนี้ไว้) */
export function expenseAccountOf(e: any): { code: string; name: string } {
  const raw = String(e.expenseAccountCode || "").trim();
  const m = raw.match(LEGACY_CODE);
  const code = m ? `530${m[1]}-00` : raw;
  return EXPENSE_ACCOUNTS.find((a) => a.code === code) || (code ? { code, name: "ค่าใช้จ่าย" } : EXPENSE_ACCOUNTS[0]);
}
