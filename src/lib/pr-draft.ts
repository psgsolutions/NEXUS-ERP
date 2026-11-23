/**
 * ร่างใบขอซื้อที่ส่งต่อจากหน้าอื่น (เช่น BOM ทั้งใบในใบเสนอราคา) ไปหน้าสร้างใบขอซื้อ
 * เก็บชั่วคราวใน localStorage ของเครื่องนี้ (เปิดแท็บใหม่ได้ ไม่เสียงานที่ค้างในใบเสนอราคา) · ใช้ได้ครั้งเดียว หมดอายุ 30 นาที
 * ไม่มี storage (โหมดส่วนตัว/ปิดกั้น) = ส่งต่อไม่ได้ แจ้งผู้ใช้แทน
 */
const KEY = "nx_pr_draft";
const TTL_MS = 30 * 60 * 1000;

export interface PrDraft { items: Record<string, any>[]; reason?: string; source?: string; at?: number }

export function savePrDraft(d: PrDraft): boolean {
  try { localStorage.setItem(KEY, JSON.stringify({ ...d, at: Date.now() })); return true; } catch { return false; }
}

/** อ่านแล้วลบทิ้งทันที (เปิดหน้าซ้ำไม่เติมรายการซ้ำ) */
export function takePrDraft(now = Date.now()): PrDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.items) || !d.items.length || !(now - Number(d.at) < TTL_MS)) return null;
    return d;
  } catch { return null; }
}
