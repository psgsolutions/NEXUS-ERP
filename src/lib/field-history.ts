/**
 * ข้อมูลเก่าที่เคยบันทึก (ต่อช่องกรอก) — ใช้แสดงให้เลือกแล้วแก้ต่อ
 * เก็บที่ companies/{companyId}/field_history/{key}: values = ล่าสุดก่อน ไม่ซ้ำ สูงสุด MAX_VALUES
 * ทุกคนในบริษัทเห็นชุดเดียวกัน (ตัดสินใจ 2026-11-16) · ไม่ใช้กับเลขภาษี เบอร์โทร จำนวนเงิน รหัสผ่าน
 */
export const MAX_VALUES = 40;
export const MAX_LEN = 1500;
export const KEY_RE = /^[a-z][a-z0-9_.-]{1,60}$/;

export interface HistoryValue { v: string; n: number; at: number }

export const cleanValue = (v: unknown) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_LEN);

/** ใส่ค่าใหม่ไว้หน้าสุด (ซ้ำ = ย้ายขึ้นหน้า นับครั้งเพิ่ม) */
export function pushValue(list: HistoryValue[], value: string, now = Date.now()): HistoryValue[] {
  const v = cleanValue(value);
  if (v.length < 2) return list;
  const old = list.find((x) => x.v === v);
  return [{ v, n: (old?.n || 0) + 1, at: now }, ...list.filter((x) => x.v !== v)].slice(0, MAX_VALUES);
}

/** ค่าที่แสดงให้เลือก: ไม่รวมค่าที่อยู่ในช่องแล้ว · พิมพ์อยู่ = กรองตามคำ (ทุกคำต้องเจอ) */
export function matchHistory(list: string[], typed: string, limit = 8): string[] {
  const cur = cleanValue(typed);
  const words = cur.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  return list.filter((v) => v !== cur && (!words.length || words.every((w) => v.toLowerCase().includes(w)))).slice(0, limit);
}
