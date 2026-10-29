export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const ENG_MONTHS = [
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

/** เอกสารปิดงวดที่ตรงปี/เดือนนี้หรือไม่ (รองรับรูปแบบเดิม: เดือนเป็นชื่อไทย/อังกฤษ/ตัวเลข) */
function matchesPeriod(data: any, year: number, month: number): boolean {
  const yearMatch = data.periodYear === year || String(data.year) === String(year) || Number(data.year) === year;
  const monthMatch =
    data.periodMonth === month || data.month === ENG_MONTHS[month - 1] || data.month === THAI_MONTHS[month - 1] ||
    String(data.month) === String(month) || String(data.month) === String(month).padStart(2, "0") || Number(data.month) === month;
  return yearMatch && monthMatch;
}

/** อ่านงวดที่ปิดแล้วของบริษัท (ทดสอบได้โดยส่งตัวอ่านเอง) */
export type ClosedPeriodLoader = (companyId: string) => Promise<any[]>;

const loadClosedPeriods: ClosedPeriodLoader = async (companyId) => {
  if (typeof window !== "undefined") throw new Error("ตรวจงวดบัญชีได้เฉพาะฝั่ง server");
  const { adminDb } = await import("./firebase-admin");
  const snap = await adminDb.collection("periodClosings").where("companyId", "==", companyId).where("status", "==", "closed").get();
  return snap.docs.map((d) => d.data());
};

/**
 * ตรวจว่างวดของวันที่ลงบัญชีเปิดอยู่ — งวดปิดแล้ว: โยน error
 * ล้มแบบปิด: อ่านข้อมูลงวดไม่สำเร็จ (Firestore ช้า/โควตาเต็ม/สิทธิ์ผิด) ก็ไม่ให้บันทึก แทนการปล่อยผ่านเงียบ ๆ
 */
export async function assertPeriodOpen(companyId: string, postingDate?: string | Date, load: ClosedPeriodLoader = loadClosedPeriods): Promise<boolean> {
  if (!companyId) throw new Error("ไม่พบรหัสบริษัทสำหรับตรวจงวดบัญชี");
  const p = periodOf(postingDate || new Date()) || periodOf(new Date())!;
  let docs: any[];
  try {
    docs = await load(companyId);
  } catch (err) {
    console.error("[PERIOD_CHECK_FAILED]", err);
    throw new Error("ตรวจสอบงวดบัญชีไม่สำเร็จ ยังไม่ได้บันทึกรายการ กรุณาลองใหม่อีกครั้ง");
  }
  if (docs.some((d) => matchesPeriod(d, p.year, p.month))) {
    throw new Error(`ไม่สามารถบันทึกรายการย้อนหลังเข้าเดือนที่ปิดงบแล้ว: ${THAI_MONTHS[p.month - 1]} ${p.year + 543}`);
  }
  return true;
}
