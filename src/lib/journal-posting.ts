/**
 * กติกาการอนุมัติลงบัญชี — ใช้ร่วมกันทั้งหน้าจอ (แสดงปุ่ม/ข้อความ) และ API (บังคับใช้)
 */

/** บทบาทที่อนุมัติลงบัญชีได้ */

/** วันที่ของรายการเป็น YYYY-MM-DD ตามเวลาไทย (รองรับ string / Timestamp / Date) */
export function journalDateStr(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  const secs = value.seconds ?? value._seconds;
  const ms = secs !== undefined ? secs * 1000 : value instanceof Date ? value.getTime() : typeof value.toDate === "function" ? value.toDate().getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : "";
}

export function journalTotals(j: any): { debit: number; credit: number; lineCount: number } {
  const lines: any[] = Array.isArray(j?.items) ? j.items : Array.isArray(j?.lines) ? j.lines : [];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    debit: r2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)),
    credit: r2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)),
    lineCount: lines.length,
  };
}

/** รายการนี้ผู้ใช้คนนี้เป็นผู้สร้างหรือไม่ (createdBy เก็บได้ทั้ง uid และอีเมล) */
export function isOwnJournal(j: any, uid?: string | null, email?: string | null): boolean {
  const who = [j?.createdBy, j?.createdByUid].filter(Boolean).map((x: any) => String(x).toLowerCase());
  return who.some((w) => (uid && w === uid.toLowerCase()) || (email && w === email.toLowerCase()));
}
