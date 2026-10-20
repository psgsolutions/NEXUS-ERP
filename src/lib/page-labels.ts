/**
 * ชื่อหน้าตามเส้นทาง (ใช้กับแถบบอกตำแหน่งด้านบน และคู่มือการใช้งาน)
 * จับคู่ด้วยคำนำหน้าที่ยาวที่สุด
 */
export const PAGE_LABELS: [prefix: string, label: string][] = [
  ["/dashboard", "ภาพรวม"],
  ["/pos", "ขายหน้าร้าน"],
  ["/support", "งานบริการ"],
  ["/service/dispatch", "ศูนย์จ่ายงาน"],
  ["/service", "งานบริการ"],
  ["/mobile/technician", "งานของฉัน"],
  ["/sales", "งานขาย"],
  ["/customers", "ข้อมูลลูกค้า"],
  ["/projects", "โครงการ"],
  ["/hr", "บุคลากร"],
  ["/inventory", "คลังสินค้า"],
  ["/products", "สินค้า"],
  ["/procurement", "จัดซื้อ"],
  ["/executive", "แดชบอร์ดผู้บริหาร"],
  ["/finance/subledgers", "บัญชีย่อยและทะเบียน"],
  ["/finance/reports", "รายงานบัญชีและภาษี"],
  ["/finance/receipts", "รับชำระเงิน"],
  ["/finance/payments", "จ่ายชำระเงิน"],
  ["/finance/journal", "สมุดรายวัน"],
  ["/finance/period-close", "ปิดงวดบัญชี"],
  ["/finance/advances", "เงินทดรองจ่าย"],
  ["/finance", "การเงินและบัญชี"],
  ["/accounting", "การเงินและบัญชี"],
  ["/ai", "วิเคราะห์ข้อมูล"],
  ["/data-import", "นำเข้าข้อมูล Excel"],
  ["/settings", "ตั้งค่า"],
  ["/logs", "บันทึกการใช้งาน"],
  ["/documents", "เอกสาร"],
];

const BY_LENGTH = [...PAGE_LABELS].sort((a, b) => b[0].length - a[0].length);

/** ชื่อหน้าของเส้นทาง (เช่น /sales/quotations/QT-1 -> งานขาย) */
export function pageLabel(pathname: string | null | undefined): string {
  const p = pathname || "";
  return BY_LENGTH.find(([prefix]) => p === prefix || p.startsWith(prefix + "/"))?.[1] || "";
}

/** หน้ารายการที่ใช้เป็น "หน้าหลักของเมนู" (ปุ่มขึ้นไปหน้ารายการ) — ต้องเป็นหน้าที่มีอยู่จริง */
export const LIST_PAGES = [
  "/dashboard", "/pos", "/support", "/service/dispatch", "/mobile/technician", "/mobile/technician/work-orders",
  "/sales", "/sales/quotations", "/sales/orders", "/customers", "/projects", "/hr", "/inventory", "/inventory/stock-card",
  "/inventory/locations", "/products", "/procurement", "/executive", "/finance", "/finance/subledgers", "/finance/reports",
  "/finance/advances", "/ai", "/data-import", "/settings", "/logs",
];
const LIST_BY_LENGTH = [...LIST_PAGES].sort((a, b) => b.length - a.length);

/** หน้าหลักของเมนูที่อยู่เหนือหน้านี้ (null = อยู่ที่หน้าหลักแล้ว) เช่น /sales/quotations/QT-1 -> /sales/quotations */
export function parentPage(pathname: string | null | undefined): string | null {
  const p = (pathname || "").replace(/\/+$/, "");
  return LIST_BY_LENGTH.find((l) => p !== l && p.startsWith(l + "/")) || null;
}
