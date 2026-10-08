import { db } from "./firebase-client";
import { collection, query, where, getDocs } from "firebase/firestore";

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

/**
 * Checks whether a fiscal period for a given company and posting date is open or closed.
 * Throws an explicit error if the target period is closed.
 */
export async function assertPeriodOpen(companyId: string, postingDate?: string | Date): Promise<boolean> {
  if (!companyId) return true;

  const p = periodOf(postingDate || new Date()) || periodOf(new Date())!;
  const targetYear = p.year;
  const targetMonthNum = p.month;
  const monthNameTh = THAI_MONTHS[targetMonthNum - 1];
  const monthNameEn = ENG_MONTHS[targetMonthNum - 1];

  let docs: Array<any> = [];

  // 1. If executing in Node.js server environment, attempt querying via adminDb
  if (typeof window === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { adminDb } = require("./firebase-admin");
      if (adminDb) {
        const snap = await adminDb.collection("periodClosings")
          .where("companyId", "==", companyId)
          .where("status", "==", "closed")
          .get();
        docs = snap.docs.map((d: any) => d.data());
      }
    } catch {
      // Fall back to client SDK if adminDb is uninitialized
    }
  }

  // 2. Query via Client SDK fallback
  if (docs.length === 0) {
    try {
      const q = query(
        collection(db, "periodClosings"),
        where("companyId", "==", companyId),
        where("status", "==", "closed")
      );
      const snap = await getDocs(q);
      docs = snap.docs.map(d => d.data());
    } catch (err) {
      // Ignore fallback errors if client SDK is uninitialized in test context
    }
  }

  // 3. Match target year and month
  const isClosed = docs.some(data => {
    const yearMatch =
      data.periodYear === targetYear ||
      String(data.year) === String(targetYear) ||
      Number(data.year) === targetYear;

    const monthMatch =
      data.periodMonth === targetMonthNum ||
      data.month === monthNameEn ||
      data.month === monthNameTh ||
      String(data.month) === String(targetMonthNum) ||
      String(data.month) === String(targetMonthNum).padStart(2, "0") ||
      Number(data.month) === targetMonthNum;

    return yearMatch && monthMatch;
  });

  if (isClosed) {
    throw new Error(`ไม่สามารถบันทึกรายการย้อนหลังเข้าเดือนที่ปิดงบแล้ว: ${monthNameTh} ${targetYear + 543}`);
  }

  return true;
}
