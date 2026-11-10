/**
 * แจ้งเตือนราคาทุนเปลี่ยน (ใช้ทั้ง server และหน้าจอ)
 * - รับสินค้าเข้าแล้วราคาล็อตใหม่ต่างจากต้นทุนเดิมเกินเกณฑ์ → หาใบเสนอราคา/โครงการที่ยังเปิดอยู่ที่ใช้สินค้านั้น
 * - เทียบต้นทุนในเอกสาร (คัดลอกไว้ตอนสร้าง) กับราคาซื้อล่าสุด แล้วแสดง GP เดิม/ใหม่
 */

/** ต่างเกินกี่ % จึงแจ้ง (ผู้ใช้เลือก 5% ทั้งขึ้นและลง — 10 พ.ย. 2569) */
export const PRICE_ALERT_THRESHOLD_PCT = 5;

/** ใบเสนอราคาที่ยังไม่ปิด (ยังแก้ราคา/ต่อรองได้) */
export const OPEN_QUOTATION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"];
/** โครงการที่ยังไม่จบ */
export const CLOSED_PROJECT_STATUSES = ["Completed", "Cancelled", "Rejected"];

export type PriceAlertDocType = "quotation" | "project";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** % การเปลี่ยนจาก before → after (before ≤ 0 = เทียบไม่ได้ คืน null) */
export function changePct(before: number, after: number): number | null {
  if (!(before > 0) || !Number.isFinite(after)) return null;
  return r2(((after - before) / before) * 100);
}

/** ต่างเกินเกณฑ์ทั้งขึ้นและลง */
export function isSignificant(before: number, after: number, threshold = PRICE_ALERT_THRESHOLD_PCT): boolean {
  const p = changePct(before, after);
  return p !== null && Math.abs(p) >= threshold;
}

export interface CostLine { productId?: string | null; qty: number; cost: number; revenue: number; skip?: boolean }

/** GP% ของรายการ (revenue = ยอดขายสุทธิของบรรทัด) — ใช้ต้นทุนใหม่ของสินค้าที่ระบุใน override */
export function gpPercent(lines: CostLine[], override?: { productId: string; cost: number }, docDiscount = 0): number | null {
  const use = lines.filter((l) => !l.skip);
  const revenue = use.reduce((s, l) => s + l.revenue, 0) - docDiscount;
  if (!(revenue > 0)) return null;
  const cost = use.reduce((s, l) => s + l.qty * (override && l.productId === override.productId ? override.cost : l.cost), 0);
  return r2(((revenue - cost) / revenue) * 100);
}

/** ราคาขายใหม่ที่คงกำไรต่อหน่วย (markup) เดิม: price × newCost / oldCost ปัดขึ้นทีละ 1 บาท */
export function keepMarginPrice(price: number, oldCost: number, newCost: number): number {
  if (!(oldCost > 0) || !(price > 0)) return price;
  return Math.ceil((price * newCost) / oldCost);
}
