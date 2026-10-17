/**
 * มาตรฐานรหัสตำแหน่งจัดเก็บ (ใช้เป็นเนื้อหาบาร์โค้ดที่ติดชั้นวางด้วย)
 *
 *   WH-01-A-R01-L2-B03 = คลัง WH-01 / โซน A / ชั้นวาง R01 / ชั้นที่ 2 / ช่องที่ 3  (ผังแบบใหม่: zones[])
 *   WH-01-A-R01-L2     = ชั้นที่ 2 ของชั้นวางที่ไม่แบ่งช่อง (ช่องเดียวต่อชั้น)
 *   WH-01-A1-L2        = ผังแบบเดิม (racks[] ไม่มีโซน)
 *   WH-01-RECV         = พื้นที่รับสินค้า (สินค้ารับเข้าแล้ว รอจัดเก็บ)
 *
 * ยอดคงเหลือตามตำแหน่งอยู่ที่ companies/{companyId}/inventory_balance/{location}_{productId}
 * สต็อกที่ยังไม่มีตำแหน่ง = stockStatus.onHand ของสินค้า - ผลรวมยอดคงเหลือทุกตำแหน่งของสินค้านั้น
 */

export const RECEIVING_SUFFIX = "RECV";
export const UNASSIGNED = "UNASSIGNED";

/** ชั้นวางในผังแบบใหม่: จำนวนชั้น × จำนวนช่องต่อชั้น */
export interface RackDef { code: string; name?: string; levels: number; bins: number; note?: string }
export interface ZoneDef { code: string; name?: string; color?: string; racks: RackDef[] }

export interface WarehouseDoc {
  id: string;
  code?: string;
  name?: string;
  racks?: Array<{ id: string; level?: number }>;
  zones?: ZoneDef[];
}

export interface LocationOption {
  code: string;      // WH-01-A1-L2
  label: string;     // คลังสินค้าหลัก • A1 ชั้น 2
  warehouseCode: string;
  rackId?: string;
  level?: number;
  isReceiving?: boolean;
  zoneCode?: string;
  bin?: number;
}

export const warehouseCode = (w: WarehouseDoc) => w.code || w.id;
export const receivingLocation = (whCode: string) => `${whCode}-${RECEIVING_SUFFIX}`;
export const rackLevelLocation = (whCode: string, rackId: string, level: number) => `${whCode}-${rackId}-L${level}`;
const pad2 = (n: number) => String(n).padStart(2, "0");
/** รหัสตำแหน่งของผังแบบใหม่ (ชั้นวางที่มีช่องเดียวต่อชั้น ไม่มี -Bxx) */
export const binLocation = (whCode: string, zone: string, rack: string, level: number, bin: number, bins: number) =>
  `${whCode}-${zone}-${rack}-L${level}${bins > 1 ? `-B${pad2(bin)}` : ""}`;
export const rackPrefix = (whCode: string, zone: string, rack: string) => `${whCode}-${zone}-${rack}`;
export const MAX_LEVELS = 20;
export const MAX_BINS = 50;
/** รหัสโซน/ชั้นวาง: ตัวพิมพ์ใหญ่และตัวเลข 1-6 ตัว (ใช้เป็นส่วนหนึ่งของบาร์โค้ด) */
export const isValidPartCode = (c: string) => /^[A-Z0-9]{1,6}$/.test(c);

/** ตำแหน่งทั้งหมดของคลัง: พื้นที่รับสินค้า + ทุกชั้นย่อยของทุกชั้นวาง */
export function listLocations(warehouses: WarehouseDoc[]): LocationOption[] {
  const out: LocationOption[] = [];
  for (const w of warehouses) {
    const code = warehouseCode(w);
    const name = w.name || code;
    out.push({ code: receivingLocation(code), label: `${name} • พื้นที่รับสินค้า`, warehouseCode: code, isReceiving: true });
    for (const zone of w.zones || []) {
      for (const rack of zone.racks || []) {
        const levels = Math.min(MAX_LEVELS, Math.max(1, Number(rack.levels) || 1));
        const bins = Math.min(MAX_BINS, Math.max(1, Number(rack.bins) || 1));
        for (let level = 1; level <= levels; level++) {
          for (let bin = 1; bin <= bins; bin++) {
            out.push({
              code: binLocation(code, zone.code, rack.code, level, bin, bins),
              label: `${name} • โซน ${zone.name || zone.code} • ${rack.name || rack.code} ชั้น ${level}${bins > 1 ? ` ช่อง ${bin}` : ""}`,
              warehouseCode: code, zoneCode: zone.code, rackId: rack.code, level, bin: bins > 1 ? bin : undefined,
            });
          }
        }
      }
    }
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

/** หา location จากข้อความที่ยิง/QR (รองรับ QR แบบ URL "...?loc=CODE" และยิงชั้นวางไม่ระบุชั้น → ชั้น 1 ช่อง 1) */
export function findLocation(options: LocationOption[], raw: string): LocationOption | undefined {
  const fromUrl = String(raw || "").match(/[?&]loc=([^&#\s]+)/i);
  const code = normalizeScan(fromUrl ? decodeURIComponent(fromUrl[1]) : raw);
  return options.find((o) => o.code === code) || options.find((o) => o.code === `${code}-L1`) || options.find((o) => o.code === `${code}-L1-B01`);
}

/** จับคู่สินค้าจากบาร์โค้ด/รหัส: barcode, sku, productCode หรือ id */
export function findProductByScan<T extends Record<string, any>>(products: T[], raw: string): T | undefined {
  const code = normalizeScan(raw);
  return products.find((p) =>
    [p.barcode, p.sku, p.productCode, p.id].some((v) => v && normalizeScan(String(v)) === code)
  );
}
