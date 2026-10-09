/** ชื่อภาษาไทยของโมดูลและการกระทำในบันทึกการใช้งาน */

const MODULE_TH: Record<string, string> = {
  CRM: "ลูกค้าสัมพันธ์",
  SALES_QUOTATION: "ใบเสนอราคา",
  SALES_ORDER: "ใบสั่งขาย",
  TAX_INVOICE: "ใบกำกับภาษี",
  BILLING_NOTE: "ใบวางบิล",
  RECEIPT: "ใบเสร็จรับเงิน",
  PAYMENT: "ใบสำคัญจ่าย",
  PURCHASE_TAX_INVOICE: "ใบกำกับภาษีซื้อ",
  FINANCE_JOURNAL: "บันทึกบัญชี",
  FINANCE_CLOSE: "ปิดงวดบัญชี",
  FINANCE_PERIOD_REOPEN: "เปิดงวดบัญชี",
  FINANCE_TAX: "ภาษี",
  PROJECTS: "โครงการ",
  HR_EMPLOYEE: "พนักงาน",
  HR_PAYROLL: "เงินเดือน",
  INVENTORY_KIT: "ชุดสินค้า",
  PROCURE_WHT: "หนังสือรับรองหัก ณ ที่จ่าย",
};

const COLLECTION_TH: Record<string, string> = {
  QUOTATIONS: "ใบเสนอราคา",
  PRODUCTS: "สินค้า",
  INVOICES: "ใบแจ้งหนี้",
  EXPENSES: "ค่าใช้จ่าย",
  EMPLOYEES: "พนักงาน",
  CUSTOMERS: "ลูกค้า",
  SUPPLIERS: "ผู้จำหน่าย",
};

export const ACTION_TH: Record<string, string> = { CREATE: "สร้าง", UPDATE: "แก้ไข", DELETE: "ลบ" };

export function moduleLabel(module: string): string {
  const m = String(module || "").toUpperCase();
  if (MODULE_TH[m]) return MODULE_TH[m];
  // บันทึกการลบรุ่นเก่า: DELETE_COMPANIES/{id}/QUOTATIONS, DELETE_PRODUCTS
  if (m.startsWith("DELETE_")) {
    const col = m.split("/").pop()!.replace(/^DELETE_/, "");
    return COLLECTION_TH[col] || col.toLowerCase();
  }
  return m || "-";
}
