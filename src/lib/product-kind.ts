/**
 * สินค้าที่นับสต็อก vs งานบริการ/ไลเซนส์ (ไม่ตัดสต็อก ไม่นับมูลค่าคงคลัง ไม่เสนอสั่งซื้อซ้ำ)
 * ดูจาก itemType (ข้อมูลกลาง) ก่อน แล้วจึง productType ของฟอร์มสินค้า
 */
const NON_STOCK = ["SERVICE", "LABOR"];

export function isStockItem(p: { itemType?: unknown; productType?: unknown } | null | undefined): boolean {
  const kind = String(p?.itemType || p?.productType || "PRODUCT").toUpperCase();
  return !NON_STOCK.includes(kind);
}
