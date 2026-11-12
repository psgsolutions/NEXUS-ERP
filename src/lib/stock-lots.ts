/**
 * Lot สินค้า (ใช้ทั้ง server และหน้าจอ) — รับเข้า 1 รายการ = 1 Lot (เลข LOT-YYMM-0001 ออกจากตัวนับ ไม่ผูกชื่อสินค้า)
 * - ตัดออกแบบเข้าก่อนออกก่อน (FIFO) เป็นค่าตั้งต้น · เลือก Lot เองได้ · บรรทัดเดียวตัดได้หลาย Lot
 * - วิธีคิดต้นทุนของบริษัท (companies/{id}.settings.costMethod):
 *     FIFO (ค่าตั้งต้น) = ต้นทุนขายคือต้นทุนจริงของ Lot ที่ตัด · WAC = ต้นทุนถัวเฉลี่ย (Lot ยังติดตามได้เหมือนกัน)
 * - สต็อกเดิมที่ไม่มี Lot (ก่อนเปิดใช้) ตัดด้วยต้นทุนเฉลี่ย ณ ขณะนั้น
 */
export type CostMethod = "FIFO" | "WAC";
export const COST_METHODS: { key: CostMethod; label: string }[] = [
  { key: "FIFO", label: "ราย Lot เข้าก่อนออกก่อน (FIFO)" }, { key: "WAC", label: "ถัวเฉลี่ยถ่วงน้ำหนัก (WAC)" },
];
export const costMethodOf = (company: any): CostMethod => (String(company?.settings?.costMethod || "").toUpperCase() === "WAC" ? "WAC" : "FIFO");

export interface OpenLot { lotNo: string; remaining: number; unitCost: number; receivedDate: string }
export interface LotPick { lotNo: string; qty: number }
export interface LotAllocation { lotNo: string; qty: number; unitCost: number }

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** เรียง FIFO: วันที่รับก่อน แล้วเลข Lot */
export const fifoOrder = <T extends { receivedDate: string; lotNo: string }>(lots: T[]): T[] =>
  [...lots].sort((a, b) => (a.receivedDate === b.receivedDate ? a.lotNo.localeCompare(b.lotNo) : a.receivedDate < b.receivedDate ? -1 : 1));

/**
 * จัดสรร Lot สำหรับการตัดออก qty ชิ้น: ใช้ที่เลือกเองก่อน (manual) ที่เหลือเติมแบบ FIFO
 * short = จำนวนที่ไม่มี Lot รองรับ (สต็อกเดิมก่อนมีระบบ Lot)
 * โยน Error เมื่อเลือก Lot ที่ไม่มี/ไม่พอ หรือเลือกเกินจำนวนที่ตัด
 */
export function allocateLots(lots: OpenLot[], qty: number, manual: LotPick[] = []): { allocations: LotAllocation[]; short: number } {
  const left = new Map(lots.map((l) => [l.lotNo, l.remaining]));
  const byNo = new Map(lots.map((l) => [l.lotNo, l]));
  const out = new Map<string, number>();
  let need = r4(qty);
  for (const m of manual) {
    const q = r4(Number(m?.qty) || 0);
    if (!m?.lotNo || q <= 0) continue;
    const lot = byNo.get(m.lotNo);
    if (!lot) throw new Error(`ไม่พบ Lot ${m.lotNo} ที่ยังมีของสำหรับสินค้านี้`);
    if (q > (left.get(m.lotNo) || 0) + 1e-9) throw new Error(`Lot ${m.lotNo} คงเหลือ ${left.get(m.lotNo)} ไม่พอ (เลือก ${q})`);
    if (q > need + 1e-9) throw new Error("จำนวนที่เลือกจาก Lot เกินจำนวนที่ตัดออก");
    left.set(m.lotNo, r4((left.get(m.lotNo) || 0) - q));
    out.set(m.lotNo, r4((out.get(m.lotNo) || 0) + q));
    need = r4(need - q);
  }
  for (const lot of fifoOrder(lots)) {
    if (need <= 0) break;
    const take = Math.min(need, left.get(lot.lotNo) || 0);
    if (take <= 0) continue;
    left.set(lot.lotNo, r4((left.get(lot.lotNo) || 0) - take));
    out.set(lot.lotNo, r4((out.get(lot.lotNo) || 0) + take));
    need = r4(need - take);
  }
  const allocations = fifoOrder(lots).filter((l) => out.has(l.lotNo)).map((l) => ({ lotNo: l.lotNo, qty: out.get(l.lotNo)!, unitCost: l.unitCost }));
  return { allocations, short: Math.max(0, need) };
}

/** มูลค่าต้นทุนของ Lot ที่จัดสรร */
export const allocationCost = (a: LotAllocation[]) => r2(a.reduce((s, x) => s + x.qty * x.unitCost, 0));

/**
 * กระจาย "ต้นทุนอื่นๆ" ระดับบิล (ค่าส่ง ค่าขนย้าย) เข้าต้นทุนต่อหน่วยตามสัดส่วนมูลค่า
 * มูลค่ารวมเป็น 0 ทั้งบิล = กระจายตามจำนวน
 */
export function spreadOtherCosts(items: { qty: number; unitCost: number }[], other: number): number[] {
  const extra = Math.max(0, Number(other) || 0);
  if (!extra) return items.map((i) => r4(i.unitCost));
  const value = items.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const qtyAll = items.reduce((s, i) => s + i.qty, 0);
  return items.map((i) => {
    if (!(i.qty > 0)) return r4(i.unitCost);
    const share = value > 0 ? (i.qty * i.unitCost) / value : qtyAll > 0 ? i.qty / qtyAll : 0;
    return r4(i.unitCost + (extra * share) / i.qty);
  });
}

/** อายุ Lot (วัน) นับจากวันที่รับ */
export const lotAgeDays = (receivedDate: string, today = new Date()): number =>
  /^\d{4}-\d{2}-\d{2}/.test(receivedDate) ? Math.max(0, Math.floor((today.getTime() - new Date(receivedDate.slice(0, 10) + "T00:00:00+07:00").getTime()) / 86400000)) : 0;
