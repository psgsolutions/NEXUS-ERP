/**
 * มาตรฐานรหัสตำแหน่งจัดเก็บ (ใช้เป็นเนื้อหาบาร์โค้ดที่ติดชั้นวางด้วย)
 *
 *   WH-01-A1-L2   = คลัง WH-01 / ชั้นวาง A1 / ชั้นย่อยที่ 2
 *   WH-01-RECV    = พื้นที่รับสินค้า (สินค้ารับเข้าแล้ว รอจัดเก็บ)
 *
 * ยอดคงเหลือตามตำแหน่งอยู่ที่ companies/{companyId}/inventory_balance/{location}_{productId}
 * สต็อกที่ยังไม่มีตำแหน่ง = stockStatus.onHand ของสินค้า - ผลรวมยอดคงเหลือทุกตำแหน่งของสินค้านั้น
 */

export const RECEIVING_SUFFIX = "RECV";
export const UNASSIGNED = "UNASSIGNED";

export interface WarehouseDoc {
  id: string;
  code?: string;
  name?: string;
  racks?: Array<{ id: string; level?: number }>;
}

export interface LocationOption {
  code: string;      // WH-01-A1-L2
  label: string;     // คลังสินค้าหลัก • A1 ชั้น 2
  warehouseCode: string;
  rackId?: string;
  level?: number;
  isReceiving?: boolean;
}

export const warehouseCode = (w: WarehouseDoc) => w.code || w.id;
export const receivingLocation = (whCode: string) => `${whCode}-${RECEIVING_SUFFIX}`;
export const rackLevelLocation = (whCode: string, rackId: string, level: number) => `${whCode}-${rackId}-L${level}`;

/** ตำแหน่งทั้งหมดของคลัง: พื้นที่รับสินค้า + ทุกชั้นย่อยของทุกชั้นวาง */
export function listLocations(warehouses: WarehouseDoc[]): LocationOption[] {
  const out: LocationOption[] = [];
  for (const w of warehouses) {
    const code = warehouseCode(w);
    const name = w.name || code;
    out.push({ code: receivingLocation(code), label: `${name} • พื้นที่รับสินค้า`, warehouseCode: code, isReceiving: true });
    for (const rack of w.racks || []) {
      const levels = Math.max(1, Number(rack.level) || 1);
      for (let level = 1; level <= levels; level++) {
        out.push({
          code: rackLevelLocation(code, rack.id, level),
          label: `${name} • ${rack.id} ชั้น ${level}`,
          warehouseCode: code,
          rackId: rack.id,
          level,
        });
      }
    }
  }
  return out;
}

/** แปลงข้อความที่ยิง/คีย์ให้เป็นรูปแบบมาตรฐาน (ตัวพิมพ์ใหญ่ ตัดช่องว่าง) */
export const normalizeScan = (raw: string) => String(raw || "").trim().toUpperCase().replace(/\s+/g, "");

/** หา location จากข้อความที่ยิง (รองรับยิงชั้นวางแบบไม่ระบุชั้นย่อย → ชั้น 1) */
export function findLocation(options: LocationOption[], raw: string): LocationOption | undefined {
  const code = normalizeScan(raw);
  return options.find((o) => o.code === code) || options.find((o) => o.code === `${code}-L1`);
}

/** จับคู่สินค้าจากบาร์โค้ด/รหัส: barcode, sku, productCode หรือ id */
export function findProductByScan<T extends Record<string, any>>(products: T[], raw: string): T | undefined {
  const code = normalizeScan(raw);
  return products.find((p) =>
    [p.barcode, p.sku, p.productCode, p.id].some((v) => v && normalizeScan(String(v)) === code)
  );
}
