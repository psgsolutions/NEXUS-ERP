/** ค่าเสื่อมราคาวิธีเส้นตรงรายเดือน — ใช้ร่วมกันทั้งหน้าจอ (แสดงตัวอย่าง) และ API (บันทึกจริง) */

export const assetCost = (a: any) => Number(a?.purchasePrice ?? a?.purchaseValue ?? 0) || 0;
export const assetSalvage = (a: any) => Number(a?.salvageValue ?? 0) || 0;
export const assetBookValue = (a: any) =>
  Number(a?.netBookValue ?? a?.bookValue ?? (assetCost(a) - (Number(a?.accumulatedDepreciation) || 0))) || 0;

/** ค่าเสื่อมต่อเดือน: (ทุน − ซาก) ÷ (อายุปี × 12) ไม่เกินมูลค่าคงเหลือเหนือราคาซาก; ทรัพย์สินที่ไม่ active = 0 */
export function monthlyDepreciation(a: any): number {
  const life = Number(a?.usefulLifeYears) || 0;
  if (life <= 0 || String(a?.status || "active") !== "active") return 0;
  const m = (assetCost(a) - assetSalvage(a)) / (life * 12);
  return Math.max(0, Math.min(m, assetBookValue(a) - assetSalvage(a)));
}

/** วันสุดท้ายของงวด YYYY-MM */
export function periodEndDate(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
