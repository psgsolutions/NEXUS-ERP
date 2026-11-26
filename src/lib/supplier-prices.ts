/**
 * นำเข้าราคาผู้ขาย (Supplier Matrix) — 1 แถว = ผู้ขาย × สินค้า × ราคา ณ วันที่
 * เก็บที่ product.supplierConfig (ของบริษัท) แยก 2 ชนิด ไม่ปนกัน:
 *  - LIST  ราคา List/ราคาตั้งของผู้ขาย (ก่อนส่วนลด — ไม่ใช่ต้นทุน) → listPrice / listPriceAt / listPriceRef
 *  - QUOTE ราคาจากใบเสนอราคา/ไฟล์ต้นทุนงาน (ราคาที่ได้จริง) → quotedCost / quotedAt / quoteRef
 *          และเป็น "ต้นทุนล่าสุด" (latestCost) เฉพาะเมื่อยังไม่เคยรับสินค้าจากผู้ขายรายนั้น (ราคารับจริงสำคัญกว่า)
 * ราคาเดิมที่ใหม่กว่า (วันที่ราคาหลังกว่า) ไม่ถูกทับ
 */

export type SupplierPriceKind = "LIST" | "QUOTE";
export interface SupplierPriceRow {
  rowNo: number; supplierName: string; sku: string; supplierSku: string; name: string; unit: string;
  price: number; kind: SupplierPriceKind; priceDate: string; project: string; ref: string; note: string; errors: string[];
}
export interface SupplierPriceItem { productId: string; supplierId: string; supplierSku?: string; kind: SupplierPriceKind; price: number; priceDate?: string; ref?: string; note?: string; project?: string }

/** หัวตาราง → ช่อง (ตรงต้นคำ ไม่สนช่องว่าง/ตัวพิมพ์) */
const HEADERS: [string, keyof SupplierPriceRow][] = [
  ["ผู้ขาย", "supplierName"], ["รหัสสินค้า NEXUS", "sku"], ["SKU", "sku"], ["รหัสสินค้าของผู้ขาย", "supplierSku"], ["รายการ", "name"],
  ["หน่วย", "unit"], ["ต้นทุน/หน่วย", "price"], ["ราคา", "price"], ["ประเภทราคา", "kind"], ["วันที่ราคา", "priceDate"],
  ["งาน/โครงการ", "project"], ["ไฟล์/หน้าอ้างอิง", "ref"], ["อ้างอิง", "ref"], ["หมายเหตุ", "note"],
];
const nh = (v: unknown) => String(v ?? "").replace(/\s+/g, "").replace(/\*/g, "").toLowerCase();

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pad = (n: number) => String(n).padStart(2, "0");
/** วันที่ราคา: "1 ก.ค. 2569" / 01/07/2569 / 2026-07-01 / เลขวันที่ของ Excel → YYYY-MM-DD ("" = อ่านไม่ได้) */
export function parsePriceDate(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400e3)); return d.toISOString().slice(0, 10); }
  // ตัดหมายเหตุในวงเล็บท้ายวันที่ เช่น "1 ก.ค. 2569 (Price List 2569)"
  const s = String(v).trim().replace(/\s*\(.*\)\s*$/, "");
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const y = Number(m[1]) > 2400 ? Number(m[1]) - 543 : Number(m[1]); return `${y}-${m[2]}-${m[3]}`; }
  m = s.match(/^(\d{1,2})\s*([ก-๙.]+)\s*(\d{2,4})$/);
  if (m) {
    const mi = TH_MONTHS.findIndex((x) => x.replace(/\./g, "") === m![2].replace(/\./g, ""));
    if (mi >= 0) { let y = Number(m[3]); if (y < 100) y += 2500; if (y > 2400) y -= 543; return `${y}-${pad(mi + 1)}-${pad(Number(m[1]))}`; }
  }
  // เดือน + ปี ("ส.ค. 2569") = วันที่ 1 ของเดือน · ปีอย่างเดียว ("2568") = 1 ม.ค. ของปี
  m = s.match(/^([ก-๙.]+)\s*(\d{4})$/);
  if (m) {
    const mi = TH_MONTHS.findIndex((x) => x.replace(/\./g, "") === m![1].replace(/\./g, ""));
    if (mi >= 0) { let y = Number(m[2]); if (y > 2400) y -= 543; return `${y}-${pad(mi + 1)}-01`; }
  }
  m = s.match(/^(\d{4})$/);
  if (m) { let y = Number(m[1]); if (y > 2400) y -= 543; return y > 1990 && y < 2100 ? `${y}-01-01` : ""; }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { let y = Number(m[3]); if (y < 100) y += 2500; if (y > 2400) y -= 543; return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`; }
  return "";
}

/** ชนิดราคาจากข้อความ: มีคำว่า List / ราคาตั้ง / ก่อนส่วนลด = LIST · อื่น ๆ (ใบเสนอราคา ไฟล์ต้นทุน) = QUOTE */
export const priceKindOf = (v: unknown): SupplierPriceKind => (/list|ราคาตั้ง|ก่อนส่วนลด|price ?list/i.test(String(v ?? "")) ? "LIST" : "QUOTE");

/** อ่านชีตราคาผู้ขาย (แถวแรก = หัวตาราง) */
export function parseSupplierPriceSheet(aoa: unknown[][]): { rows: SupplierPriceRow[]; missing: string[] } {
  const head = (aoa[0] || []).map(nh);
  const idx: Partial<Record<keyof SupplierPriceRow, number>> = {};
  for (const [h, key] of HEADERS) {
    if (idx[key] !== undefined) continue;
    const i = head.findIndex((x) => x.startsWith(nh(h)));
    if (i >= 0 && !Object.values(idx).includes(i)) idx[key] = i;
  }
  const missing = (["supplierName", "sku", "price"] as const).filter((k) => idx[k] === undefined).map((k) => ({ supplierName: "ผู้ขาย", sku: "รหัสสินค้า NEXUS (SKU)", price: "ต้นทุน/หน่วย" }[k]));
  if (missing.length) return { rows: [], missing };
  const cell = (r: unknown[], k: keyof SupplierPriceRow) => (idx[k] === undefined ? "" : r[idx[k]!]);
  const txt = (r: unknown[], k: keyof SupplierPriceRow, max = 300) => String(cell(r, k) ?? "").trim().slice(0, max);
  const rows: SupplierPriceRow[] = [];
  aoa.slice(1).forEach((r, i) => {
    if (!r || r.every((c) => c === "" || c === null || c === undefined)) return;
    const raw = cell(r, "price");
    const price = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[,\s฿บาท]/g, ""));
    const errors: string[] = [];
    const supplierName = txt(r, "supplierName", 200), sku = txt(r, "sku", 120);
    if (!supplierName) errors.push("ไม่มีชื่อผู้ขาย");
    if (!sku) errors.push("ไม่มีรหัสสินค้า (SKU)");
    if (!(Number.isFinite(price) && price > 0)) errors.push("ราคาไม่ถูกต้อง");
    const dateRaw = cell(r, "priceDate");
    const priceDate = parsePriceDate(dateRaw);
    if (dateRaw !== "" && dateRaw !== undefined && !priceDate) errors.push(`วันที่ราคาอ่านไม่ได้ ("${String(dateRaw)}")`);
    rows.push({
      rowNo: i + 2, supplierName, sku, supplierSku: txt(r, "supplierSku", 120), name: txt(r, "name"), unit: txt(r, "unit", 30),
      price: Number.isFinite(price) ? Math.round(price * 10000) / 10000 : 0, kind: priceKindOf(cell(r, "kind")), priceDate,
      project: txt(r, "project", 200), ref: txt(r, "ref", 300), note: txt(r, "note", 300), errors,
    });
  });
  return { rows, missing: [] };
}

const nn = (v: unknown) => String(v ?? "").toLowerCase().replace(/บริษัท|จำกัด|\(มหาชน\)|ห้างหุ้นส่วน|หจก\.?|บจก\.?|co\.?,?\s*ltd\.?|company|limited|[\s.,()\-&]/g, "");
/**
 * ผู้ขายจากชื่อในไฟล์: ชื่อ / ชื่อบนใบกำกับ / ชื่อนิติบุคคล / ชื่อย่อ / ชื่อที่เคยจับคู่ไว้ (nameAliases)
 * ตรงกันแบบไม่สนคำนำหน้า (บริษัท จำกัด ฯลฯ) และตัวพิมพ์
 */
export function matchSupplierId(name: string, suppliers: Array<Record<string, any>>): string {
  const n = nn(name);
  if (!n) return "";
  const names = (s: Record<string, any>) => [s.name, s.supplierName, s.legalName, s.taxInvoiceName, s.shortName, ...(Array.isArray(s.nameAliases) ? s.nameAliases : [])];
  const hit = (suppliers || []).find((s) => !s.isDeleted && names(s).some((x) => x && nn(x) === n));
  return hit ? String(hit.id) : "";
}

/** ชื่อในไฟล์ → ผู้ขายที่เลือกเอง: เก็บเป็นชื่อเรียกของผู้ขาย (ครั้งหน้าจับคู่ให้เอง) */
export function normalizeAliases(raw: any): { name: string; supplierId: string }[] {
  const out = new Map<string, { name: string; supplierId: string }>();
  for (const a of Array.isArray(raw) ? raw.slice(0, 100) : []) {
    const name = String(a?.name ?? "").trim().slice(0, 120), supplierId = String(a?.supplierId ?? "").trim().slice(0, 120);
    if (name && nn(name) && supplierId && !supplierId.includes("/") && !out.has(`${supplierId}|${nn(name)}`)) out.set(`${supplierId}|${nn(name)}`, { name, supplierId });
  }
  return Array.from(out.values());
}

const UNIT_ALIAS: Record<string, string> = { "ม": "เมตร", "m": "เมตร", "meter": "เมตร", "pcs": "ชิ้น", "pc": "ชิ้น", "ea": "ชิ้น", "box": "กล่อง", "set": "ชุด", "roll": "ม้วน" };
const nu = (v: unknown) => { const x = String(v ?? "").trim().toLowerCase().replace(/[.\s]/g, ""); return UNIT_ALIAS[x] || x; };
/**
 * หน่วยราคาในไฟล์เทียบกับสินค้า → ราคาต่อหน่วยหลักของสินค้า
 *  ไม่ระบุหน่วย / ตรงหน่วยหลัก = ใช้ราคาเดิม · ตรงหน่วยซื้อ/แพ็ค (มีจำนวนต่อแพ็ค) = หารเป็นราคาต่อหน่วยหลัก
 *  ไม่ตรง (เช่น ไฟล์คิดต่อเมตร แต่สินค้าขายเป็นกล่อง) = null — ไม่นำเข้า กันราคาต่อหน่วยย่อยทับราคากล่อง
 */
export function priceInProductUnit(price: number, rowUnit: string, product: Record<string, any>): number | null {
  const u = nu(rowUnit);
  if (!u) return price;
  if ([product.unit, product.baseUnit].some((x) => x && nu(x) === u)) return price;
  const rate = Number(product.conversionRate) || 0;
  if (product.packageUnit && nu(product.packageUnit) === u && rate > 0) return r4(price / rate);
  return null;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
/** รวมราคาเข้า supplierConfig ของสินค้า (คืนรายการใหม่ ไม่แก้ของเดิม) */
export function mergeSupplierPrice(list: any[], it: SupplierPriceItem): any[] {
  const cur = (Array.isArray(list) ? list : []).filter((c) => c && c.supplierId);
  const i = cur.findIndex((c) => c.supplierId === it.supplierId);
  const base = i >= 0 ? { ...cur[i] } : { supplierId: it.supplierId, latestCost: 0, leadTimeDays: 7, isPrimary: cur.length === 0 };
  const date = it.priceDate || "";
  const newer = (prev?: string) => !prev || !date || date >= prev;
  if (it.supplierSku) base.supplierSku = it.supplierSku;
  if (it.kind === "LIST") {
    if (newer(base.listPriceAt)) Object.assign(base, { listPrice: r4(it.price), listPriceAt: date, listPriceRef: String(it.ref || "").slice(0, 300) });
  } else if (newer(base.quotedAt)) {
    Object.assign(base, { quotedCost: r4(it.price), quotedAt: date, quoteRef: String(it.ref || "").slice(0, 300), ...(it.project ? { quoteProject: String(it.project).slice(0, 200) } : {}) });
    // ยังไม่เคยรับสินค้าจากผู้ขายนี้ = ใช้ราคาเสนอเป็นต้นทุนล่าสุด (รับจริงแล้ว ราคารับจริงสำคัญกว่า)
    if (!base.lastReceivedAt) base.latestCost = r4(it.price);
  }
  return i >= 0 ? cur.map((c, k) => (k === i ? base : c)) : [...cur, base];
}

export function normalizeSupplierPriceItem(raw: any): SupplierPriceItem | null {
  const id = (v: any) => { const x = String(v ?? "").trim().slice(0, 120); return x && !x.includes("/") ? x : ""; };
  const productId = id(raw?.productId), supplierId = id(raw?.supplierId), price = Number(raw?.price);
  if (!productId || !supplierId || !(price > 0) || price > 1e9) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.priceDate || "")) ? String(raw.priceDate) : "";
  return {
    productId, supplierId, kind: raw?.kind === "LIST" ? "LIST" : "QUOTE", price, priceDate: date,
    supplierSku: String(raw?.supplierSku ?? "").trim().slice(0, 120), ref: String(raw?.ref ?? "").slice(0, 300), note: String(raw?.note ?? "").slice(0, 300), project: String(raw?.project ?? "").slice(0, 200),
  };
}
