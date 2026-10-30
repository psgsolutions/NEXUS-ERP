/**
 * งวดบัญชี: ชื่อเดือนและการหางวดของวันที่ (ใช้ได้ทั้งหน้าจอและ server — ไม่มีโค้ดฐานข้อมูล)
 * ตรวจงวดปิดก่อนลงบัญชีอยู่ที่ period-close-service.ts (server เท่านั้น)
 */
export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export const ENG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * งวด (ปี ค.ศ., เดือน 1-12) ของวันที่ลงบัญชี ตามเวลาประเทศไทย
 * รองรับ "YYYY-MM-DD" (ใช้ตามตัวอักษร), Date, Firestore Timestamp และ ISO string
 */
export function periodOf(raw: any): { year: number; month: number } | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{4})-(\d{2})/);
    if (m && !raw.includes("T")) return { year: Number(m[1]), month: Number(m[2]) };
  }
  const ms =
    raw instanceof Date ? raw.getTime()
    : typeof raw?.toMillis === "function" ? raw.toMillis()
    : typeof raw?.seconds === "number" ? raw.seconds * 1000
    : typeof raw?._seconds === "number" ? raw._seconds * 1000
    : new Date(raw).getTime();
  if (!Number.isFinite(ms)) return null;
  const bkk = new Date(ms + 7 * 3600e3);
  return { year: bkk.getUTCFullYear(), month: bkk.getUTCMonth() + 1 };
}

export const periodIdOf = (companyId: string, year: number, month: number) => `${companyId}_${year}_${String(month).padStart(2, "0")}`;

