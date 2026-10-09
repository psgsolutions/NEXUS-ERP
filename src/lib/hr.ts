/** ข้อมูลกลางของงานบุคคล (พนักงานเก็บที่ collection "employees" ระดับบนพร้อม companyId) */

export const PREFIXES = [
  { value: "Mr.", label: "นาย" },
  { value: "Mrs.", label: "นาง" },
  { value: "Ms.", label: "นางสาว" },
];

export const DEPARTMENTS = ["บริหาร", "ขาย", "วิศวกรรม", "ติดตั้ง/ช่าง", "บัญชี/การเงิน", "จัดซื้อ", "คลังสินค้า", "บุคคล"];

export const EMPLOYMENT_TYPES: Record<string, string> = {
  permanent: "พนักงานประจำ",
  contract: "สัญญาจ้าง",
  daily: "รายวัน",
  parttime: "พาร์ตไทม์",
};

export const EMPLOYEE_STATUS: Record<string, { label: string; badge: "active" | "inactive" | "warning" }> = {
  active: { label: "ปฏิบัติงาน", badge: "active" },
  probation: { label: "ทดลองงาน", badge: "warning" },
  resigned: { label: "ลาออก", badge: "inactive" },
};

export const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา", "ทหารไทยธนชาต", "ออมสิน", "อื่น ๆ"];

/** เวลาเข้างานปกติ (ลงเวลาเข้าหลังเวลานี้ = สาย) */
export const WORK_START = "08:30";

export function employeeName(e: any): string {
  if (!e) return "";
  if (e.firstName || e.lastName) {
    const prefix = PREFIXES.find((p) => p.value === e.prefix)?.label || "";
    return `${prefix}${e.firstName || ""} ${e.lastName || ""}`.trim();
  }
  return String(e.name || e.employeeId || e.id || "");
}

export function employeeStatus(e: any): string {
  const s = String(e?.status || "active").toLowerCase();
  return EMPLOYEE_STATUS[s] ? s : "active";
}

/** วันและเวลาประเทศไทยของ timestamp (ms) */
export function bkkParts(ms: number) {
  const iso = new Date(ms + 7 * 3600e3).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
