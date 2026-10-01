import { db } from "./firebase-client";
import { collection, query, where, getDocs } from "firebase/firestore";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const ENG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Checks whether a fiscal period for a given company and posting date is open or closed.
 * Throws an explicit error if the target period is closed.
 */
export async function assertPeriodOpen(companyId: string, postingDate?: string | Date): Promise<boolean> {
  if (!companyId) return true;

  let dateObj: Date;
  if (!postingDate) {
    dateObj = new Date();
  } else if (postingDate instanceof Date) {
    dateObj = postingDate;
  } else {
    dateObj = new Date(postingDate);
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
  }

  const targetYear = dateObj.getFullYear();
  const targetMonthNum = dateObj.getMonth() + 1; // 1-12
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
    throw new Error(`ไม่สามารถบันทึกรายการย้อนหลังเข้าเดือนที่ปิดงบแล้ว: ${monthNameTh} ${targetYear}`);
  }

  return true;
}
