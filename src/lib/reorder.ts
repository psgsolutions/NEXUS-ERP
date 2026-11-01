/**
 * จุดสั่งซื้อ → ใบขอซื้ออัตโนมัติ (ฟังก์ชันล้วน ทดสอบได้)
 * สินค้าที่ "พร้อมใช้ + กำลังสั่ง" ไม่เกินจุดสั่งซื้อ (ไม่ตั้ง = สต็อกขั้นต่ำ) → เสนอสั่งให้ถึงสต็อกสูงสุด (ไม่ตั้ง = 2 เท่าของจุดสั่งซื้อ)
 * กำลังสั่ง = ใบขอซื้อที่ยังไม่ปิด + ใบสั่งซื้อที่ยังไม่รับของ/ยกเลิก (ไม่นับซ้ำใบขอซื้อที่แปลงเป็นใบสั่งซื้อแล้ว)
 */
export interface ReorderLine {
  productId: string; sku: string; name: string; unit: string;
  available: number; onOrder: number; reorderPoint: number; maxStock: number;
  qty: number; unitCost: number; supplierId: string; supplierName: string; leadTimeDays: number;
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const OPEN_PR = ["PENDING_APPROVAL", "APPROVED"];
const CLOSED_PO = ["CANCELLED", "RECEIVED", "COMPLETED", "CLOSED"];

/** จำนวนที่กำลังสั่งต่อสินค้า (ใบขอซื้อที่ยังไม่แปลง + ใบสั่งซื้อที่ยังไม่รับครบ) */
export function onOrderByProduct(prs: any[], pos: any[]): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: any, q: number) => { if (id && q > 0) out.set(String(id), (out.get(String(id)) || 0) + q); };
  for (const pr of prs) {
    if (pr.isDeleted === true || !OPEN_PR.includes(String(pr.status || "").toUpperCase())) continue;
    for (const it of pr.items || []) add(it.productId, num(it.qty));
  }
  for (const po of pos) {
    if (po.isDeleted === true || CLOSED_PO.includes(String(po.status || "").toUpperCase())) continue;
    for (const it of po.items || []) add(it.productId, num(it.qty ?? it.quantity) - num(it.receivedQty));
  }
  return out;
}

export function reorderSuggestions(products: any[], prs: any[], pos: any[]): ReorderLine[] {
  const onOrder = onOrderByProduct(prs, pos);
  const out: ReorderLine[] = [];
  for (const p of products) {
    if (p.isDeleted === true || p.isActive === false) continue;
    if (["SERVICE", "LABOR"].includes(String(p.productType || p.itemType || "").toUpperCase())) continue;
    // จุดสั่งซื้อ/ขั้นต่ำ/สูงสุด เก็บที่ inventoryControl (รุ่นเก่าอยู่ที่ตัวสินค้า)
    const ic = p.inventoryControl || {};
    const rp = num(ic.reorderPoint ?? p.reorderPoint), mn = num(ic.minStock ?? p.minStock), mx = num(ic.maxStock ?? p.maxStock);
    const reorderPoint = rp > 0 ? rp : mn;
    if (!(reorderPoint > 0)) continue;
    const s = p.stockStatus || {};
    const available = s.available !== undefined ? num(s.available) : num(s.onHand) - num(s.reserved);
    const ordered = onOrder.get(String(p.id)) || 0;
    if (available + ordered > reorderPoint) continue;
    const maxStock = mx > reorderPoint ? mx : reorderPoint * 2;
    // ผู้จำหน่ายหลัก: ราคาทุนล่าสุด ระยะรอสินค้า และสั่งขั้นต่ำ (MOQ)
    const sup = Array.isArray(p.supplierConfig) ? p.supplierConfig.find((x: any) => x?.isPrimary) || p.supplierConfig[0] : null;
    const qty = Math.max(1, num(sup?.moq), Math.ceil(maxStock - available - ordered));
    out.push({
      productId: String(p.id), sku: String(p.sku || ""), name: String(p.name || "-"), unit: String(p.unit || p.uom || "ชิ้น"),
      available, onOrder: ordered, reorderPoint, maxStock, qty,
      unitCost: num(sup?.latestCost) || num(p.pricing?.costWAC ?? p.costPrice),
      supplierId: String(sup?.supplierId || p.supplierId || ""), supplierName: String(sup?.supplierName || p.supplierName || ""),
      leadTimeDays: num(sup?.leadTimeDays ?? p.leadTimeDays),
    });
  }
  return out.sort((a, b) => a.available - a.reorderPoint - (b.available - b.reorderPoint) || a.name.localeCompare(b.name, "th"));
}
