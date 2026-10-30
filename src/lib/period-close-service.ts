import { ENG_MONTHS, THAI_MONTHS, periodOf } from "./period";

// ชื่อเดือน/งวด อยู่ที่ period.ts (หน้าจอ import จากที่นั่น) — ส่งต่อให้ API เดิมที่ import จากไฟล์นี้
export { ENG_MONTHS, THAI_MONTHS, periodIdOf, periodOf } from "./period";

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
