/**
 * สถานะสต็อกของสินค้า (ใช้ร่วมทุกหน้า): หมด · ใกล้หมด · ปกติ
 * เกณฑ์ใกล้หมด = จุดสั่งซื้อซ้ำรายสินค้า (reorderPoint) ถ้าไม่ตั้ง ใช้ขั้นต่ำ (minStock) — ไม่ใช้ค่าเดียวทั้งคลัง
 * หมด = ตั้งจุดสั่งซื้อซ้ำไว้ (ตั้งใจเก็บสต็อก) แต่ไม่มีของ · ไม่มีสต็อก = สินค้าในทะเบียนที่ไม่ได้ตั้งจุดสั่งซื้อ (สั่งตามงาน) — ไม่นับเป็นปัญหา
 * งานบริการไม่มีสถานะสต็อก
 */
export type StockState = "out" | "low" | "ok" | "none" | "service";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function reorderPointOf(p: any): number {
  const ic = p?.inventoryConfig || {};
  const rp = n(ic.reorderPoint ?? p?.reorderPoint);
  return rp > 0 ? rp : n(ic.minStock ?? p?.minStock);
}

export function stockState(p: any): StockState {
  if (String(p?.itemType || "PRODUCT").toUpperCase() === "SERVICE") return "service";
  const onHand = n(p?.stockStatus?.onHand);
  const rp = reorderPointOf(p);
  if (onHand <= 0) return rp > 0 ? "out" : "none";
  return rp > 0 && onHand <= rp ? "low" : "ok";
}

export const STOCK_STATE_LABEL: Record<StockState, string> = { out: "หมด", low: "ใกล้หมด", ok: "ปกติ", none: "ไม่มีสต็อก", service: "งานบริการ" };
/** สีป้ายตาม StatusBadge */
export const STOCK_STATE_BADGE: Record<StockState, "danger" | "pending" | "active" | "inactive"> = { out: "danger", low: "pending", ok: "active", none: "inactive", service: "inactive" };

/** มูลค่าคงเหลือ (จำนวน × ต้นทุนเฉลี่ยของที่เหลือ) */
export const stockValue = (p: any) => Math.round(n(p?.stockStatus?.onHand) * n(p?.pricing?.costWAC ?? p?.costPrice) * 100) / 100;
