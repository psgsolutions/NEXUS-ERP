/**
 * กันสองคนบันทึกทับกัน (C-13)
 * เวอร์ชันของเอกสาร = updatedAt เป็นมิลลิวินาที — รับได้ทั้ง Firestore Timestamp (ฝั่ง client/admin), ISO string, Date, ตัวเลข
 * หน้าจอเก็บเวอร์ชันตอนเปิด แล้วส่งกลับมาตอนบันทึก · เซิร์ฟเวอร์เทียบกับค่าปัจจุบันในธุรกรรม ไม่ตรง = มีคนอื่นบันทึกไปก่อน (409)
 */
export function versionOf(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v.seconds === "number") return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return 0;
}

/** true = มีคนบันทึกหลังจากที่หน้าจอเปิดเอกสาร · ไม่ส่งเวอร์ชันมา (หน้าจอเก่า) หรือเอกสารไม่มี updatedAt = ไม่ตรวจ */
export function isStaleVersion(expected: unknown, current: unknown): boolean {
  const want = Number(expected) || 0;
  const have = versionOf(current);
  return want > 0 && have > 0 && want !== have;
}

export const STALE_MESSAGE = "มีผู้อื่นบันทึกเอกสารนี้หลังจากที่คุณเปิด — โหลดหน้าใหม่เพื่อดูฉบับล่าสุดก่อนบันทึก";
