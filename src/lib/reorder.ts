/**
 * จุดสั่งซื้อ → ใบขอซื้ออัตโนมัติ (ฟังก์ชันล้วน ทดสอบได้)
 * สินค้าที่ "พร้อมใช้ + กำลังสั่ง" ไม่เกินจุดสั่งซื้อ (ไม่ตั้ง = สต็อกขั้นต่ำ) → เสนอสั่งให้ถึงสต็อกสูงสุด (ไม่ตั้ง = 2 เท่าของจุดสั่งซื้อ)
 * กำลังสั่ง = ใบขอซื้อที่ยังไม่ปิด + ใบสั่งซื้อที่ยังไม่รับของ/ยกเลิก (ไม่นับซ้ำใบขอซื้อที่แปลงเป็นใบสั่งซื้อแล้ว)
 */
export interface ReorderLine {
  productId: string; sku: string; name: string; unit: string;
  available: number; onOrder: number; reorderPoint: number; maxStock: number;
  qty: number; unitCost: number; supplierId: string; supplierName: string; leadTimeDays: number;
  /** ที่มาของผู้ขาย: primary = ผู้ขายหลักของสินค้า · lot = ผู้ขายของ Lot ล่าสุด · "" = ยังไม่รู้ */
  supplierSource: "primary" | "lot" | "";
  /** ยังไม่ได้ตั้งจุดสั่งซื้อ (แสดงเพราะสต็อกหมดและเคยมีของ) */
  unset?: boolean;
}

export interface ReorderOptions {
  /** รวมสินค้าที่ไม่ได้ตั้งจุดสั่งซื้อ แต่พร้อมใช้ + กำลังสั่ง ≤ 0 และเคยมีของ (อยู่ใน everStocked) */
  includeUnset?: boolean;
  everStocked?: Set<string>;
  /** ผู้ขายของ Lot ล่าสุดต่อสินค้า — ใช้เมื่อสินค้ายังไม่มีผู้ขายหลัก */
  lotSupplier?: Map<string, { supplierId: string; supplierName: string; unitCost: number }>;
}

export interface SupplierGroup { supplierId: string; supplierName: string; lines: ReorderLine[] }

/** ผู้ขายของ Lot ล่าสุดต่อสินค้า (Lot ที่ไม่มีทั้งรหัสและชื่อผู้ขายข้ามไป) */
export function latestLotSupplier(lots: any[]): Map<string, { supplierId: string; supplierName: string; unitCost: number }> {
  const best = new Map<string, { at: string; supplierId: string; supplierName: string; unitCost: number }>();
  for (const l of lots) {
    if (!l || l.isDeleted === true || !l.productId) continue;
    const supplierId = String(l.supplierId || "").trim(), supplierName = String(l.supplierName || "").trim();
    if (!supplierId && !supplierName) continue;
    const at = String(l.receivedDate || "") + String(l.lotNo || "");
    const cur = best.get(String(l.productId));
    if (!cur || at > cur.at) best.set(String(l.productId), { at, supplierId, supplierName, unitCost: num(l.unitCost) });
  }
  return new Map([...best].map(([k, { at: _at, ...v }]) => [k, v]));
}

/** จัดกลุ่มตามผู้ขาย (ใบสั่งซื้อละผู้ขาย) — กลุ่มที่ยังไม่มีรหัสผู้ขายอยู่ท้ายสุด แยกตามชื่อที่รู้ */
export function groupBySupplier(lines: ReorderLine[]): SupplierGroup[] {
  const m = new Map<string, SupplierGroup>();
  for (const l of lines) {
    const key = l.supplierId ? `id:${l.supplierId}` : `name:${l.supplierName}`;
    if (!m.has(key)) m.set(key, { supplierId: l.supplierId, supplierName: l.supplierName, lines: [] });
    m.get(key)!.lines.push(l);
  }
  return [...m.values()].sort((a, b) => Number(!a.supplierId) - Number(!b.supplierId) || b.lines.length - a.lines.length || a.supplierName.localeCompare(b.supplierName, "th"));
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

export function reorderSuggestions(products: any[], prs: any[], pos: any[], opts: ReorderOptions = {}): ReorderLine[] {
  const onOrder = onOrderByProduct(prs, pos);
  const out: ReorderLine[] = [];
  for (const p of products) {
    if (p.isDeleted === true || p.isActive === false) continue;
    if (["SERVICE", "LABOR"].includes(String(p.productType || p.itemType || "").toUpperCase())) continue;
    // จุดสั่งซื้อ/ขั้นต่ำ/สูงสุด เก็บที่ inventoryControl (รุ่นเก่าอยู่ที่ตัวสินค้า)
    const ic = p.inventoryControl || {};
    const rp = num(ic.reorderPoint ?? p.reorderPoint), mn = num(ic.minStock ?? p.minStock), mx = num(ic.maxStock ?? p.maxStock);
    const reorderPoint = rp > 0 ? rp : mn;
    const s = p.stockStatus || {};
    const available = s.available !== undefined ? num(s.available) : num(s.onHand) - num(s.reserved);
    const ordered = onOrder.get(String(p.id)) || 0;
    const unset = !(reorderPoint > 0);
    if (unset) {
      if (!opts.includeUnset || available + ordered > 0 || !opts.everStocked?.has(String(p.id))) continue;
    } else if (available + ordered > reorderPoint) continue;
    const maxStock = unset ? 0 : mx > reorderPoint ? mx : reorderPoint * 2;
    // ผู้จำหน่ายหลัก: ราคาทุนล่าสุด ระยะรอสินค้า และสั่งขั้นต่ำ (MOQ) · ไม่มี → ผู้ขายของ Lot ล่าสุด
    const sup = Array.isArray(p.supplierConfig) ? p.supplierConfig.find((x: any) => x?.isPrimary && x?.supplierId) || p.supplierConfig.find((x: any) => x?.supplierId) : null;
    const lot = opts.lotSupplier?.get(String(p.id));
    const supplierId = String(sup?.supplierId || p.supplierId || lot?.supplierId || "");
    const supplierSource: ReorderLine["supplierSource"] = sup?.supplierId || p.supplierId ? "primary" : lot ? "lot" : "";
    const qty = Math.max(1, num(sup?.moq), Math.ceil(maxStock - available - ordered));
    out.push({
      productId: String(p.id), sku: String(p.sku || ""), name: String(p.name || "-"), unit: String(p.unit || p.uom || "ชิ้น"),
      available, onOrder: ordered, reorderPoint, maxStock, qty,
      unitCost: num(sup?.latestCost) || num(lot?.unitCost) || num(p.pricing?.costWAC ?? p.costPrice),
      supplierId, supplierName: String(sup?.supplierName || p.supplierName || lot?.supplierName || ""), supplierSource,
      leadTimeDays: num(sup?.leadTimeDays ?? p.leadTimeDays),
      ...(unset ? { unset: true } : {}),
    });
  }
  return out.sort((a, b) => a.available - a.reorderPoint - (b.available - b.reorderPoint) || a.name.localeCompare(b.name, "th"));
}
