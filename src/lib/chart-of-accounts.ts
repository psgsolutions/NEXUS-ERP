/**
 * ผังบัญชีมาตรฐานของระบบ (รูปแบบ XXXX-XX) — ครอบคลุมทุกรหัสที่ระบบบันทึกอัตโนมัติ
 * หมวด: 1 สินทรัพย์ · 2 หนี้สิน · 3 ส่วนของเจ้าของ · 4 รายได้ · 5 ต้นทุนและค่าใช้จ่าย
 * (รายงานกำไรขาดทุนอ่านหมวด 4/5 จากรหัสขึ้นต้น)
 */

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
}

export const CHART_OF_ACCOUNTS: Account[] = [
  // 1 สินทรัพย์
  { code: "1111-00", name: "เงินสด", type: "asset" },
  { code: "1112-00", name: "เงินฝากธนาคาร", type: "asset" },
  { code: "1113-00", name: "ลูกหนี้บัตรเครดิต", type: "asset" },
  { code: "1131-00", name: "ลูกหนี้การค้า", type: "asset" },
  { code: "1132-00", name: "ลูกหนี้อื่น", type: "asset" },
  { code: "1133-00", name: "ลูกหนี้เงินประกันผลงาน", type: "asset" },
  { code: "1134-00", name: "เงินทดรองจ่าย", type: "asset" },
  { code: "1141-00", name: "สินค้าคงเหลือ", type: "asset" },
  { code: "1151-00", name: "ภาษีซื้อ", type: "asset" },
  { code: "1152-00", name: "ภาษีซื้อยังไม่ถึงกำหนด", type: "asset" },
  { code: "1154-00", name: "ภาษีเงินได้ถูกหัก ณ ที่จ่าย", type: "asset" },
  { code: "1155-00", name: "ค่าใช้จ่ายจ่ายล่วงหน้า", type: "asset" },
  { code: "1161-00", name: "งานระหว่างทำ (WIP)", type: "asset" },
  { code: "1511-00", name: "อาคารและส่วนปรับปรุง", type: "asset" },
  { code: "1521-00", name: "เครื่องมือและอุปกรณ์", type: "asset" },
  { code: "1531-00", name: "เครื่องใช้สำนักงาน", type: "asset" },
  { code: "1541-00", name: "ยานพาหนะ", type: "asset" },
  { code: "1591-00", name: "ค่าเสื่อมราคาสะสม", type: "asset" },
  // 2 หนี้สิน
  { code: "2111-00", name: "เจ้าหนี้การค้า", type: "liability" },
  { code: "2112-00", name: "เจ้าหนี้อื่น", type: "liability" },
  { code: "2121-00", name: "ภาษีขาย", type: "liability" },
  { code: "2122-00", name: "ภาษีมูลค่าเพิ่มค้างชำระ", type: "liability" },
  { code: "2123-00", name: "ภาษีขายยังไม่ถึงกำหนด", type: "liability" },
  { code: "2131-00", name: "ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.1)", type: "liability" },
  { code: "2132-00", name: "ภาษีหัก ณ ที่จ่ายค้างจ่าย", type: "liability" },
  { code: "2133-00", name: "เงินประกันสังคมค้างจ่าย", type: "liability" },
  { code: "2141-00", name: "ค่าใช้จ่ายค้างจ่าย", type: "liability" },
  { code: "2142-00", name: "เงินเดือนค้างจ่าย", type: "liability" },
  { code: "2151-00", name: "เงินรับล่วงหน้าจากลูกค้า", type: "liability" },
  { code: "2211-00", name: "เงินกู้ยืมระยะยาว", type: "liability" },
  // 3 ส่วนของเจ้าของ
  { code: "3111-00", name: "ทุนจดทะเบียน", type: "equity" },
  { code: "3211-00", name: "กำไร (ขาดทุน) สะสม", type: "equity" },
  // 4 รายได้
  { code: "4111-00", name: "รายได้จากการขาย", type: "revenue" },
  { code: "4112-00", name: "รายได้จากการให้บริการ", type: "revenue" },
  { code: "4113-00", name: "รับคืนและส่วนลดจ่าย", type: "revenue" },
  { code: "4211-00", name: "รายได้อื่น", type: "revenue" },
  { code: "4212-00", name: "ดอกเบี้ยรับ", type: "revenue" },
  // 5 ต้นทุนและค่าใช้จ่าย
  { code: "5111-00", name: "ต้นทุนขาย", type: "expense" },
  { code: "5121-00", name: "ต้นทุนบริการ", type: "expense" },
  { code: "5211-00", name: "เงินเดือนและค่าจ้าง", type: "expense" },
  { code: "5212-00", name: "ประกันสังคม", type: "expense" },
  { code: "5300-00", name: "ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป", type: "expense" },
  { code: "5301-00", name: "ค่าเดินทางและพาหนะ", type: "expense" },
  { code: "5302-00", name: "ค่ารับรองลูกค้า", type: "expense" },
  { code: "5303-00", name: "ค่าวัสดุสิ้นเปลืองสำนักงาน", type: "expense" },
  { code: "5304-00", name: "ค่าเช่า", type: "expense" },
  { code: "5305-00", name: "ค่าสาธารณูปโภค", type: "expense" },
  { code: "5306-00", name: "ค่าธรรมเนียมธนาคาร", type: "expense" },
  { code: "5310-00", name: "ค่าเสื่อมราคา", type: "expense" },
  { code: "5411-00", name: "ดอกเบี้ยจ่าย", type: "expense" },
  { code: "5511-00", name: "ภาษีเงินได้นิติบุคคล", type: "expense" },
];

export const ACCOUNT_TYPE_TH: Record<AccountType, string> = {
  asset: "สินทรัพย์",
  liability: "หนี้สิน",
  equity: "ส่วนของเจ้าของ",
  revenue: "รายได้",
  expense: "ค่าใช้จ่าย",
};

const BY_CODE = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export function findAccount(code: string): Account | undefined {
  return BY_CODE.get(String(code || "").trim());
}

/** สมุดรายวันที่ใช้บันทึกด้วยมือ */
export const BOOK_TYPES = [
  { code: "JV", name: "สมุดรายวันทั่วไป" },
  { code: "RV", name: "สมุดรายวันรับเงิน" },
  { code: "PV", name: "สมุดรายวันจ่ายเงิน" },
  { code: "SV", name: "สมุดรายวันขาย" },
  { code: "PJ", name: "สมุดรายวันซื้อ" },
];
