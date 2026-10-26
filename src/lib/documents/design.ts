/**
 * การออกแบบหน้าเอกสารของบริษัท (ฟังก์ชันล้วน — ใช้ทั้งหน้าตั้งค่า, server และตัวสร้าง PDF)
 * เก็บที่ companies/{id}.documentDesign = { theme, perDoc }
 *  - theme: ธีมกลางของทุกเอกสาร (แม่แบบ ฟอนต์ สี หัวเอกสาร ตาราง ยอดรวม ช่องลงนาม ระยะขอบ ลายน้ำ)
 *    ออกแบบครั้งเดียว เอกสารทุกชนิดของบริษัทใช้ธีมเดียวกันอัตโนมัติ
 *  - perDoc: ปรับเฉพาะชนิดเอกสาร (ชื่อเอกสาร ข้อความท้าย ซ่อนคอลัมน์ ช่องลงนาม และผังลากวางอิสระ)
 * ช่องข้อมูลที่กฎหมายบังคับ (ผู้ขาย ผู้ซื้อ เลขผู้เสียภาษี เลขที่ วันที่ รายการ ยอดภาษี) แสดงเสมอ ปิดไม่ได้
 */

export type FontFamily = "Sarabun" | "THSarabunNew" | "THSarabunIT9";
export type HeaderLayout = "logo-left" | "logo-right" | "centered" | "banner";
export type PartyStyle = "accent-bar" | "boxed" | "plain" | "none";
export type TableStyle = "tint" | "solid" | "lines" | "grid" | "zebra";
export type TotalsStyle = "solid" | "outline" | "plain" | "grid";
export type SignatureStyle = "line" | "box";

export interface DocTheme {
  templateId: string;
  font: FontFamily;
  /** ขนาดตัวอักษรเนื้อหา (pt) — ฟอนต์ TH Sarabun ถูกขยายอัตโนมัติให้อ่านง่ายเท่ากัน */
  fontSize: number;
  primary: string;
  accent: string;
  text: string;
  muted: string;
  header: HeaderLayout;
  logoSize: number;
  party: PartyStyle;
  table: TableStyle;
  rounded: boolean;
  totals: TotalsStyle;
  signatures: SignatureStyle;
  margin: number;
  showPageNumber: boolean;
  watermark: string;
  /** ป้ายกำกับสองภาษา (ไทย + อังกฤษตัวเล็ก) เช่น ชื่อลูกค้า / Customer Name */
  bilingual: boolean;
  /** รูปแบบฟอร์ม: ข้อมูลลูกค้า/เลขที่ แสดงเป็นแถว "ป้าย : ค่า" */
  formStyle: boolean;
}

export interface PerDocDesign {
  title?: string;
  titleEn?: string;
  extraNote?: string;
  hideColumns?: string[];
  signatures?: string[];
  free?: FreeLayout;
  /** หัวกระดาษที่ใช้ (id ใน letterheads) — ว่าง = หัวเอกสารตามธีม */
  letterhead?: string;
}

/**
 * หัวกระดาษ (ใช้ร่วมหลายเอกสาร) เช่น หัวกระดาษเอกสารการค้า (ใบเสนอราคา ใบวางบิล ใบเสร็จ) / หัวกระดาษหนังสือ (ขอเข้าพื้นที่ ส่งมอบงาน)
 * กล่องวางตำแหน่งบนหน้าแรกเหมือนผังลากวาง เนื้อหาเอกสารเริ่มใต้ความสูง height
 */
export interface Letterhead { id: string; name: string; height: number; blocks: FreeBlock[] }

export interface DocumentDesign { theme: DocTheme; perDoc: Record<string, PerDocDesign>; letterheads: Letterhead[] }

// ---------- ผังลากวางอิสระ ----------
export type BlockKind = "logo" | "seller" | "title" | "meta" | "party" | "info" | "items" | "totals" | "words" | "notes" | "payment" | "signatures" | "field" | "text" | "line" | "rect" | "shape" | "image" | "stamp" | "sign";
export type ItemColumn = "no" | "code" | "description" | "detail" | "qty" | "unit" | "qtyUnit" | "price" | "discount" | "discountText" | "gross" | "amount";
/** คอลัมน์ตารางที่ตั้งเอง: ลำดับตามรายการ · หัวคอลัมน์ · จัดวาง · ความกว้าง (% ของตาราง ว่าง = อัตโนมัติ) */
export interface ColumnSpec { key: ItemColumn; label?: string; align?: "left" | "center" | "right"; width?: number }
export interface FreeBlock {
  id: string;
  kind: BlockKind;
  x: number; y: number; w: number; h: number; // pt บนกระดาษ A4 (595 x 842)
  /** รูปทรง (kind "shape"): วงรี/วงกลม · สามเหลี่ยม */
  shape?: "ellipse" | "triangle";
  /** มุมโค้งแยกแต่ละมุม [บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย] (pt) — มีค่านี้ใช้แทน radius */
  radii?: [number, number, number, number];
  /** ระยะห่างขอบในกล่อง (pt) */
  pad?: number;
  /** กล่องข้อมูล: เรียงหัวข้อแนวตั้ง (ค่าเดิม) หรือเป็นแถวแนวนอน */
  flow?: "column" | "row";
  text?: string;       // text: รองรับ {{number}} {{date}} {{customer}} {{total}}
  src?: string;        // image: data URL
  /** ขนาดตัวอักษร (pt) — กล่องข้อมูลระบบ: ขนาดเนื้อหาของกล่อง (หัวข้อในกล่องขยายตามสัดส่วน) */
  fontSize?: number;
  /** ระยะบรรทัด (เท่าของขนาดตัวอักษร) */
  lineHeight?: number;
  color?: string;
  bg?: string;
  border?: string;
  align?: "left" | "center" | "right" | "justify";
  bold?: boolean;
  /** ข้อความ: ตัวเอียง · ขีดเส้นใต้ · ขีดฆ่า · ระยะห่างตัวอักษร (pt) · ฟอนต์ของกล่อง (ว่าง = ตามธีม) */
  italic?: boolean; underline?: boolean; strike?: boolean; letterSpacing?: number; font?: FontFamily;
  /** ความทึบ 0.1–1 (กรอบ รูปทรง รูปภาพ ข้อความ) */
  opacity?: number;
  /** ส่วนย่อยที่ซ่อน (คีย์ตาม BLOCK_PARTS) */
  hide?: string[];
  /** ตารางรายการ: คอลัมน์ที่แสดง (แบบเดิม — ใช้ colSpec ถ้ามี) */
  cols?: ItemColumn[];
  /** ตารางรายการ: คอลัมน์ที่ตั้งเอง (ลำดับ หัวคอลัมน์ จัดวาง ความกว้าง) */
  colSpec?: ColumnSpec[];
  /** กล่องข้อมูล: เน้นแถวแรก (เช่น ชื่อบริษัท/ลูกค้า ตัวหนาใหญ่) · ความกว้างป้าย (pt) */
  emphasizeFirst?: boolean;
  labelWidth?: number;
  /** กล่องที่มีป้าย (ข้อมูล ช่องข้อมูล เลขที่/วันที่ ลูกค้า): ระยะป้าย→ข้อมูล · ระยะระหว่างแถว (pt) */
  labelGap?: number;
  rowGap?: number;
  /** ลายเซ็นอิเล็กทรอนิกส์ (kind=sign): ลายเซ็นของช่องลงนามนี้ (ตามผู้ลงนามที่กำหนด/ลายเซ็นจริง) หรือของผู้ลงนามคนนี้เสมอ (id) */
  slot?: string;
  signer?: string;
  /** จัดแนวตั้งในกล่อง (ไม่ตั้ง = ชิดบน) */
  valign?: "middle" | "bottom";
  /** กล่องข้อมูล: ชื่อหัวข้อที่ตั้งเอง ตามคีย์ข้อมูล (ว่าง = ชื่อตั้งต้น) */
  names?: Record<string, string>;
  /** ช่องลงนาม: ชื่อช่อง */
  labels?: string[];
  /** ช่องลงนาม: ระยะห่างระหว่างช่อง (pt) เช่น เว้นกลางไว้วางโลโก้/ตราประทับ */
  gap?: number;
  /** ตารางรายการ: ยืดตารางเต็มความสูงกล่อง (เส้นคอลัมน์ลากถึงล่าง แบบฟอร์ม) */
  fill?: boolean;
  /** ช่องข้อมูล (kind=field): คีย์ข้อมูล number | date | m:<ป้าย> | f:<คีย์> */
  field?: string;
  /** ช่องข้อมูล: ไม่แสดงป้าย (แสดงเฉพาะค่า) */
  hideLabel?: boolean;
  /** กล่องเลขที่/วันที่: ข้อมูลเพิ่มที่แสดงเป็นแถว (f:<คีย์>) · กล่องข้อมูล (info): หัวข้อที่เลือกแสดง ตามลำดับ */
  fields?: string[];
  /** รัศมีมุม (pt) 0 = เหลี่ยม — กรอบ/พื้นของกล่อง และกรอบตาราง/ยอดรวม/ลูกค้าในกล่อง */
  radius?: number;
  /** ความหนาเส้นกรอบ (pt) · เส้น: ใช้ความสูง/ความกว้างเป็นความหนา */
  borderWidth?: number;
  /** รูปแบบเส้น */
  dash?: "solid" | "dashed" | "dotted";
  /** ตาราง/ยอดรวม/ลูกค้า: รูปแบบเฉพาะกล่อง (ไม่ตั้ง = ตามธีม) */
  table?: TableStyle;
  totalsStyle?: TotalsStyle;
  partyStyle?: PartyStyle;
  /** ตาราง: สีพื้นหัวตาราง · สีเส้นในตาราง/กรอบ */
  headBg?: string;
  lineColor?: string;
  /** ล็อกตำแหน่ง (ลาก/ปรับขนาดไม่ได้ จนกว่าจะปลดล็อก) */
  locked?: boolean;
  /** กลุ่ม: กล่องที่มีรหัสกลุ่มเดียวกันเลือกและย้ายไปพร้อมกัน */
  group?: string;
}
export interface FreeLayout {
  enabled: boolean; blocks: FreeBlock[];
  /** ขอบกระดาษที่ใช้จัดวาง (pt) — เส้นนำ/ดูดติด/ตรวจขอบ · margins = แยกแต่ละด้าน [บน ขวา ล่าง ซ้าย] */
  margin?: number; margins?: Margins;
  /** ขนาดกระดาษ (ไม่ตั้ง = A4) · แนวนอน */
  paper?: PaperSize; landscape?: boolean;
}

export const A4 = { w: 595.28, h: 841.89 };
export type PaperSize = "A4" | "A5" | "Letter";
export type Margins = [number, number, number, number];
export const PAPERS: Record<PaperSize, { w: number; h: number; label: string }> = {
  A4: { w: 595.28, h: 841.89, label: "A4 (21 × 29.7 ซม.)" },
  A5: { w: 419.53, h: 595.28, label: "A5 (14.8 × 21 ซม.)" },
  Letter: { w: 612, h: 792, label: "Letter (21.6 × 27.9 ซม.)" },
};
/** ด้านยาวสุดของกระดาษที่รองรับ — ขอบเขตตำแหน่งกล่อง (แนวนอนกว้างกว่า A4 แนวตั้ง) */
const PAGE_MAX = 842;
/** ขนาดหน้าของผัง (pt) ตามกระดาษและแนว */
export function pageOf(l?: Pick<FreeLayout, "paper" | "landscape"> | null): { w: number; h: number } {
  const p = PAPERS[l?.paper as PaperSize] || PAPERS.A4;
  return l?.landscape ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}
/** ขอบกระดาษ [บน ขวา ล่าง ซ้าย] */
export function marginsOf(l?: Pick<FreeLayout, "margin" | "margins"> | null): Margins {
  const m = l?.margin ?? 32;
  return l?.margins ? [...l.margins] as Margins : [m, m, m, m];
}
/**
 * เปลี่ยนกระดาษ/แนว/ขอบ: ย้ายกล่องตามสัดส่วน — ส่วนในขอบยืด/หดตามพื้นที่ใหม่ ส่วนที่ชิดขอบกระดาษ (แถบสีเต็มหน้า) ยังชิดขอบ
 * กล่องข้อความคงความสูงเดิม (ตัวอักษรไม่เล็กลง) · เส้นคงความหนา
 */
export function refitBlocks(blocks: FreeBlock[], from: { w: number; h: number }, fm: Margins, to: { w: number; h: number }, tm: Margins): FreeBlock[] {
  const seg = (v: number, s0: number, e0: number, s1: number, e1: number) => (e0 - s0 < 0.01 ? s1 : s1 + ((v - s0) / (e0 - s0)) * (e1 - s1));
  const map = (v: number, L0: number, A0: number, B0: number, L1: number, A1: number, B1: number) =>
    v <= A0 ? seg(v, 0, A0, 0, A1) : v >= L0 - B0 ? seg(v, L0 - B0, L0, L1 - B1, L1) : seg(v, A0, L0 - B0, A1, L1 - B1);
  const fx = (v: number) => map(v, from.w, fm[3], fm[1], to.w, tm[3], tm[1]);
  const fy = (v: number) => map(v, from.h, fm[0], fm[2], to.h, tm[0], tm[2]);
  const r = (v: number) => Math.round(v * 10) / 10;
  const out = blocks.map((b) => {
    const x1 = fx(b.x), x2 = fx(b.x + b.w), y1 = fy(b.y), y2 = fy(b.y + b.h);
    if (b.kind === "line") return b.w >= b.h ? { ...b, x: x1, w: Math.max(4, x2 - x1), y: y1 } : { ...b, x: x1, y: y1, h: Math.max(4, y2 - y1) };
    const keepH = TEXT_BLOCKS.includes(b.kind) && b.kind !== "items";
    return { ...b, x: x1, w: Math.max(4, x2 - x1), y: y1, h: keepH ? b.h : Math.max(4, y2 - y1) };
  });
  // กล่องข้อความคงความสูง: กล่องที่เคยอยู่ใต้กันในแนวเดียวกันต้องไม่ทับกัน — ดันลงตามลำดับ (ตารางรายการหดรับแทน)
  const DECO = ["rect", "shape", "line", "image"];
  const content = blocks.map((b, i) => i).filter((i) => !DECO.includes(blocks[i].kind)).sort((i, j) => blocks[i].y - blocks[j].y);
  const ry = (to.h - tm[0] - tm[2]) / Math.max(1, from.h - fm[0] - fm[2]);
  const xOverlap = (a: FreeBlock, b: FreeBlock) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2;
  for (const j of content) {
    const ob = blocks[j];
    let top = out[j].y;
    for (const i of content) {
      const oa = blocks[i];
      if (i === j || oa.y + oa.h > ob.y + 0.5 || !xOverlap(oa, ob)) continue;
      top = Math.max(top, out[i].y + out[i].h + Math.max(0, ob.y - (oa.y + oa.h)) * Math.min(1, ry));
    }
    if (top > out[j].y) {
      const bottom = out[j].y + out[j].h;
      out[j] = { ...out[j], y: top, h: ob.kind === "items" ? Math.max(40, bottom - top) : out[j].h };
    }
  }
  // กรอบ/พื้นที่เคยครอบกล่องข้อมูล: ครอบตามตำแหน่งใหม่ (คงระยะขอบใน)
  blocks.forEach((ob, k) => {
    if (ob.kind !== "rect" && ob.kind !== "shape") return;
    const inside = content.filter((i) => { const c = blocks[i]; return c.x >= ob.x - 1 && c.y >= ob.y - 1 && c.x + c.w <= ob.x + ob.w + 1 && c.y + c.h <= ob.y + ob.h + 1; });
    if (!inside.length) return;
    const T = Math.min(...inside.map((i) => blocks[i].y)) - ob.y, B = ob.y + ob.h - Math.max(...inside.map((i) => blocks[i].y + blocks[i].h));
    const y = Math.min(...inside.map((i) => out[i].y)) - T, bottom = Math.max(...inside.map((i) => out[i].y + out[i].h)) + B;
    out[k] = { ...out[k], y, h: Math.max(4, bottom - y) };
  });
  // ยังล้นขอบล่าง: หดตารางรายการ แล้วยกทุกอย่างที่อยู่ใต้ตารางขึ้นตาม
  const ti = out.findIndex((b) => b.kind === "items");
  const over = Math.max(...out.filter((b) => !DECO.includes(b.kind) || b.kind === "rect").map((b) => b.y + b.h)) - (to.h - tm[2]);
  if (ti >= 0 && over > 0) {
    const t = out[ti], cut = Math.min(over, Math.max(0, t.h - 60)), tb = t.y + t.h;
    for (let k = 0; k < out.length; k++) if (k !== ti && out[k].y >= tb - 1) out[k] = { ...out[k], y: out[k].y - cut };
    out[ti] = { ...t, h: t.h - cut };
  }
  // ระยะใต้ตารางห่างเกินเดิม (จากการดัน/หด): ยกส่วนใต้ตารางขึ้นให้ห่างเท่าเดิม แล้วคืนพื้นที่ให้ตาราง
  if (ti >= 0) {
    const ot = blocks[ti], t = out[ti], tb = t.y + t.h;
    const below = out.map((b, k) => k).filter((k) => k !== ti && blocks[k].y >= ot.y + ot.h - 1);
    if (below.length) {
      const was = Math.min(...below.map((k) => blocks[k].y)) - (ot.y + ot.h), now = Math.min(...below.map((k) => out[k].y)) - tb;
      const extra = now - Math.max(0, was) * Math.min(1, ry);
      if (extra > 1) out[ti] = { ...t, h: t.h + extra };
    }
  }
  return out.map((b) => ({ ...b, x: r(b.x), y: r(Math.min(b.y, to.h - 4)), w: r(b.w), h: r(Math.max(0.25, Math.min(b.h, to.h - Math.min(b.y, to.h - 4)))) }));
}
/** กล่องที่เอกสารภาษีต้องมี (ลบไม่ได้ในผังอิสระ) */
export const REQUIRED_BLOCKS: BlockKind[] = ["seller", "title", "meta", "party", "items", "totals"];
export const BLOCK_LABELS: Record<BlockKind, string> = {
  logo: "โลโก้", seller: "ข้อมูลผู้ขาย", title: "ชื่อเอกสาร", meta: "เลขที่/วันที่", party: "ข้อมูลลูกค้า/คู่ค้า", info: "กล่องข้อมูล", stamp: "ตราประทับ", shape: "รูปทรง", items: "ตารางรายการ",
  totals: "ยอดรวม", words: "จำนวนเงินตัวอักษร", notes: "หมายเหตุ", payment: "ข้อมูลการชำระเงิน", signatures: "ช่องลงนาม",
  field: "ข้อมูลเดี่ยว", text: "ข้อความ", line: "เส้น", rect: "กรอบ/พื้นหลัง", image: "รูปภาพ", sign: "ลายเซ็นอิเล็กทรอนิกส์",
};
/** ส่วนย่อยในกล่องที่เลือกซ่อนได้ (ชื่อ ที่อยู่ เลขผู้เสียภาษีของผู้ขาย/ผู้ซื้อ แสดงเสมอ ตามกฎหมาย) */
export const BLOCK_PARTS: Partial<Record<BlockKind, { key: string; label: string }[]>> = {
  seller: [{ key: "nameEn", label: "ชื่อภาษาอังกฤษ" }, { key: "contact", label: "โทร · อีเมล · เว็บไซต์" }],
  title: [{ key: "en", label: "ชื่อภาษาอังกฤษ" }, { key: "copy", label: "ป้ายต้นฉบับ/สำเนา" }],
  sign: [{ key: "name", label: "ชื่อผู้ลงนาม" }, { key: "title", label: "ตำแหน่ง" }, { key: "date", label: "วันที่ลงนาม" }],
  party: [{ key: "contact", label: "ชื่อผู้ติดต่อ" }, { key: "phone", label: "โทรศัพท์" }, { key: "email", label: "อีเมล" }],
  items: [{ key: "detail", label: "รายละเอียดใต้รายการ" }, { key: "heading", label: "หัวข้อหมวด" }],
  signatures: [{ key: "date", label: "บรรทัดวันที่" }],
};
export const ITEM_COLUMNS: { key: ItemColumn; label: string; align: "left" | "center" | "right"; width?: number; extra?: boolean }[] = [
  { key: "no", label: "ลำดับ", align: "center", width: 6 }, { key: "code", label: "รหัส", align: "left", width: 13 }, { key: "description", label: "รายการ", align: "left" },
  { key: "detail", label: "รายละเอียด", align: "left", extra: true },
  { key: "qty", label: "จำนวน", align: "right", width: 9 }, { key: "unit", label: "หน่วย", align: "center", width: 8 },
  { key: "qtyUnit", label: "จำนวน+หน่วย", align: "right", width: 13, extra: true },
  { key: "price", label: "ราคา/หน่วย", align: "right", width: 13 }, { key: "gross", label: "ราคารวมก่อนลด", align: "right", width: 14, extra: true },
  { key: "discount", label: "ส่วนลด", align: "right", width: 10 }, { key: "discountText", label: "ส่วนลด (%)", align: "center", width: 9, extra: true },
  { key: "amount", label: "จำนวนเงิน", align: "right", width: 14 },
];
/** คอลัมน์ตามที่ตั้ง (colSpec) หรือแบบเดิม (cols / ค่าตั้งต้นของเอกสาร) */
export function resolveColumns(b: { colSpec?: ColumnSpec[]; cols?: ItemColumn[] } | undefined, fallback: ItemColumn[]): ColumnSpec[] {
  if (b?.colSpec?.length) return b.colSpec;
  return (b?.cols?.length ? b.cols : fallback).map((key) => ({ key }));
}
/** กล่องที่มีตัวอักษร (ปรับขนาด/ระยะบรรทัด/สีได้) */
/** กล่องที่มีป้าย : ข้อมูล (ตั้งระยะข้อความได้) */
export const LABEL_KINDS: BlockKind[] = ["info", "field", "meta", "party"];
export const TEXT_BLOCKS: BlockKind[] = ["seller", "title", "meta", "party", "info", "items", "totals", "words", "notes", "payment", "signatures", "field", "text"];
/** กล่องที่วางในหัวกระดาษได้ */
export const HEAD_KINDS: BlockKind[] = ["logo", "seller", "title", "meta", "info", "field", "text", "line", "rect", "shape", "image", "stamp"];
/** คีย์ช่องข้อมูล: เลขที่ วันที่ แถวข้อมูลของเอกสาร (m:ป้าย) ข้อมูลเพิ่ม (f:คีย์) */
/**
 * เอกสารที่ออกเป็นต้นฉบับ/สำเนา (ให้ลูกค้าต้นฉบับ เก็บสำเนา) — แสดงป้ายเสมอในทุกแม่แบบ ปิดไม่ได้
 * เอกสารอื่น (ใบเสนอราคา ใบสั่งขาย ใบสั่งซื้อ ใบสำคัญจ่าย ฯลฯ) ไม่มีป้ายนี้และไม่มีตัวเลือก
 */
export const COPY_DOCS = ["invoice", "receipt", "billing_note", "delivery_note", "cndn", "pos"];
export const docHasCopy = (type?: string) => !!type && COPY_DOCS.includes(type);

const FIELD_KEY = /^(number|date|title|titleEn|copy|m:[^\n]{1,40}|f:[a-zA-Z]{1,30}|seller\.(name|nameEn|address|taxId|contact)|customer\.(name|address|taxId|contact|phone|email))$/;

/**
 * กล่องที่แยกเป็นช่องข้อมูลย่อยได้ (จัดวางหัวข้อในกล่องเองอย่างอิสระ)
 * ข้อมูลที่กฎหมายบังคับครบเมื่อมีช่องย่อยครบตามนี้ — ใช้แทนกล่องเดิมได้
 */
export const SPLIT_EQUIV: Partial<Record<BlockKind, string[]>> = {
  seller: ["seller.name", "seller.address", "seller.taxId"],
  party: ["customer.name", "customer.address", "customer.taxId"],
  meta: ["number", "date"],
  title: ["title"],
};
/** กล่องชนิดนี้ (หรือช่องย่อยที่แทนกันได้) มีครบในผังหรือไม่ */
export function requiredSatisfied(kind: BlockKind, blocks: FreeBlock[]): boolean {
  if (blocks.some((b) => b.kind === kind)) return true;
  const eq = SPLIT_EQUIV[kind];
  return !!eq && eq.every((f) => blocks.some((b) => (b.kind === "field" && b.field === f) || (b.kind === "info" && (b.fields || []).includes(f))));
}

/** เอกสารที่ไม่มียอดเงิน (ไม่ต้องมีกล่องยอดรวม/จำนวนเงินตัวอักษร) */
const NO_AMOUNT_DOCS = ["delivery_note", "work_order"];
export const docHasAmounts = (docType?: string) => !NO_AMOUNT_DOCS.includes(String(docType || ""));
/** กล่องที่เอกสารชนิดนี้ต้องมี */
export const requiredBlocksFor = (docType?: string): BlockKind[] => (docHasAmounts(docType) ? REQUIRED_BLOCKS : REQUIRED_BLOCKS.filter((k) => k !== "totals"));
/** กล่องที่เพิ่มได้ในเอกสารชนิดนี้ */
export const addableBlocksFor = (docType?: string): BlockKind[] =>
  (["info", "text", "line", "rect", "shape", "image", "logo", "stamp", "sign", "field", "words", "notes", "payment", "signatures", "totals"] as BlockKind[]).filter((k) => docHasAmounts(docType) || (k !== "words" && k !== "totals"));
/** คอลัมน์ที่ต้องแสดงเสมอ */
export const requiredColumnsFor = (docType?: string): ItemColumn[] => (docHasAmounts(docType) ? ["description", "amount"] : ["description"]);

export const FONT_LABELS: Record<FontFamily, string> = { Sarabun: "Sarabun (ทันสมัย)", THSarabunNew: "TH Sarabun New", THSarabunIT9: "TH SarabunIT๙ (หนังสือราชการ)" };
/** ฟอนต์ TH Sarabun ตัวเล็กกว่า Sarabun ที่ขนาดเดียวกัน — ขยายให้ขนาดที่ตั้งดูเท่ากัน */
export const FONT_SCALE: Record<FontFamily, number> = { Sarabun: 1, THSarabunNew: 1.32, THSarabunIT9: 1.32 };

/** ป้ายภาษาอังกฤษของป้ายที่ใช้บ่อย (โหมดสองภาษา) */
export const EN_LABELS: Record<string, string> = {
  "ลำดับ": "Item", "รหัส": "Code", "รายการ": "Description", "จำนวน": "QTY.", "หน่วย": "Unit", "ราคา/หน่วย": "Unit Price", "ส่วนลด": "Discount", "จำนวนเงิน": "Amount",
  "เลขที่": "No.", "วันที่": "Date", "ครบกำหนด": "Due Date", "กำหนดชำระ": "Due Date", "ยืนราคาถึง": "Price Validation", "กำหนดส่งมอบ": "Delivery", "กำหนดส่ง": "Delivery Date",
  "เงื่อนไขการชำระเงิน": "Terms of Payment", "เงื่อนไขชำระ": "Payment Terms", "เครดิต": "Credit Term", "อ้างอิง": "Reference", "โครงการ": "Project", "ผู้เสนอราคา": "Quoted By",
  "เลขที่ใบสั่งซื้อ": "PO No.", "ใบสั่งขาย": "Sales Order", "ใบสั่งซื้อ": "Purchase Order", "อ้างอิงใบเสนอราคา": "Quotation Ref.", "อ้างอิงใบขอซื้อ": "PR Ref.", "อ้างอิงใบกำกับ": "Invoice Ref.",
  "ชำระโดย": "Payment Method", "จ่ายโดย": "Paid By", "บัญชี": "Account", "เช็คเลขที่": "Cheque No.", "ลงวันที่": "Dated", "ส่งที่คลัง": "Ship To", "งวดงาน": "Installment",
  "ช่างผู้รับผิดชอบ": "Technician", "นัดหมาย": "Appointment", "สถานะ": "Status", "ออกแทนเลขที่": "Replaces No.",
  "ลูกค้า": "Customer", "เสนอราคาให้": "Customer", "ผู้ขาย": "Vendor", "ได้รับเงินจาก": "Received From", "ผู้รับเงิน": "Payee", "ผู้ติดต่อ": "Contact", "ชื่อลูกค้า": "Customer Name",
  "เลขประจำตัวผู้เสียภาษี": "Tax ID.", "ที่อยู่": "Address", "โทร": "Tel.", "อีเมล": "Email", "หมายเหตุ": "Remarks",
  "ผู้อนุมัติ": "Approved By", "ผู้สั่งซื้อ": "Accepted By", "ลูกค้ายืนยันการสั่งซื้อ": "Accepted By", "ผู้จัดทำ": "Prepared By", "ผู้มีอำนาจลงนาม": "Authorized Signature",
  "ผู้จ่ายเงิน": "Paid By", "ผู้วางบิล": "Billed By", "ผู้รับวางบิล": "Received By", "ผู้ส่งของ": "Delivered By", "ผู้รับของ": "Received By", "ผู้ตรวจรับ": "Inspected By",
  "ผู้รับสินค้า / บริการ": "Received By", "ผู้ส่งสินค้า": "Delivered By", "ช่างผู้ปฏิบัติงาน": "Technician",
  "รวมเป็นเงิน": "Total Amount", "ส่วนลดท้ายบิล": "Discount", "ยอดหลังหักส่วนลด": "Total After Discount", "มูลค่าก่อนภาษี": "Total Before VAT", "ภาษีมูลค่าเพิ่ม 7%": "VAT 7%",
  "ภาษีมูลค่าเพิ่ม 7% (รวมในราคา)": "VAT 7% (Included)", "จำนวนเงินรวมทั้งสิ้น": "Grand Total", "หัก ณ ที่จ่าย": "Withholding Tax", "ยอดชำระสุทธิ": "Net Payable",
};
export const enLabel = (th: string) => EN_LABELS[th] || "";

/**
 * ข้อมูลที่แทรกในกล่องข้อความได้ (ดึงจากฐานข้อมูลตอนพิมพ์) — {{คีย์}}
 * แถวข้อมูลของเอกสาร {{m:ป้าย}} และข้อมูลเพิ่ม {{f:คีย์}} เพิ่มตามชนิดเอกสาร
 */
export const TEXT_VARIABLES: { key: string; label: string; source: string }[] = [
  { key: "number", label: "เลขที่เอกสาร", source: "เอกสาร" }, { key: "date", label: "วันที่เอกสาร", source: "เอกสาร" },
  { key: "title", label: "ชื่อเอกสาร", source: "เอกสาร" }, { key: "titleEn", label: "ชื่อเอกสารภาษาอังกฤษ", source: "เอกสาร" },
  { key: "total", label: "ยอดรวมทั้งสิ้น (ตัวเลข)", source: "คำนวณจากรายการ" }, { key: "totalWords", label: "ยอดรวม (ตัวอักษร)", source: "คำนวณจากรายการ" },
  { key: "customer", label: "ชื่อลูกค้า/คู่ค้า", source: "ลูกค้าในเอกสาร" }, { key: "customer.address", label: "ที่อยู่ลูกค้า", source: "ลูกค้าในเอกสาร" },
  { key: "customer.taxId", label: "เลขผู้เสียภาษีลูกค้า", source: "ลูกค้าในเอกสาร" }, { key: "customer.contact", label: "ผู้ติดต่อลูกค้า", source: "ลูกค้าในเอกสาร" },
  { key: "customer.phone", label: "โทรลูกค้า", source: "ลูกค้าในเอกสาร" }, { key: "customer.email", label: "อีเมลลูกค้า", source: "ลูกค้าในเอกสาร" },
  { key: "seller.name", label: "ชื่อบริษัท", source: "ข้อมูลนิติบุคคล" }, { key: "seller.nameEn", label: "ชื่อบริษัทภาษาอังกฤษ", source: "ข้อมูลนิติบุคคล" },
  { key: "seller.address", label: "ที่อยู่บริษัท", source: "ข้อมูลนิติบุคคล" }, { key: "seller.taxId", label: "เลขผู้เสียภาษีบริษัท", source: "ข้อมูลนิติบุคคล" },
  { key: "seller.phone", label: "โทรบริษัท", source: "ข้อมูลนิติบุคคล" }, { key: "seller.email", label: "อีเมลบริษัท", source: "ข้อมูลนิติบุคคล" },
  { key: "seller.website", label: "เว็บไซต์บริษัท", source: "ข้อมูลนิติบุคคล" }, { key: "seller.payment", label: "บัญชีรับชำระเงิน", source: "ข้อมูลนิติบุคคล" },
];

/** ชุดสีสำเร็จรูป (สีหลัก · สีรอง) */
export const PALETTES: { id: string; name: string; primary: string; accent: string }[] = [
  { id: "teal", name: "เขียวหยก", primary: "#1f6f5c", accent: "#1f6f5c" },
  { id: "sky", name: "ฟ้าฟอร์ม", primary: "#5b8fd1", accent: "#9dc3e6" },
  { id: "navy", name: "กรมท่า", primary: "#1e3a8a", accent: "#3b5bdb" },
  { id: "ocean", name: "น้ำทะเล", primary: "#0e7490", accent: "#22a3c4" },
  { id: "emerald", name: "มรกต", primary: "#047857", accent: "#10b981" },
  { id: "forest", name: "ป่าไม้", primary: "#3f6212", accent: "#65a30d" },
  { id: "royal", name: "ม่วงหลวง", primary: "#5b21b6", accent: "#8b5cf6" },
  { id: "berry", name: "เบอร์รี่", primary: "#9d174d", accent: "#db2777" },
  { id: "crimson", name: "แดงเลือดนก", primary: "#9f1239", accent: "#e11d48" },
  { id: "sunset", name: "ส้มอาทิตย์", primary: "#c2410c", accent: "#f97316" },
  { id: "gold", name: "น้ำตาลทอง", primary: "#7c2d12", accent: "#b45309" },
  { id: "slate", name: "เทาเข้ม", primary: "#334155", accent: "#64748b" },
  { id: "charcoal", name: "ดำ-เทา", primary: "#111111", accent: "#555555" },
  { id: "navygold", name: "กรมท่า-ทอง", primary: "#1e3a5f", accent: "#c9a227" },
];

const BASE: DocTheme = {
  templateId: "modern", font: "Sarabun", fontSize: 9.5, primary: "#1f6f5c", accent: "#1f6f5c", text: "#1a1a1a", muted: "#666666",
  header: "logo-left", logoSize: 64, party: "accent-bar", table: "tint", rounded: true, totals: "solid", signatures: "line",
  margin: 32, showPageNumber: true, watermark: "", bilingual: false, formStyle: false,
};

/**
 * แม่แบบสำเร็จรูป (เลือกแล้วแก้ต่อได้ทุกค่า)
 * layout: ผังลากวางของแม่แบบ (layout-templates.ts) — เลือกแล้วทุกเอกสารได้ผังนี้ ลากปรับต่อได้อิสระ · ไม่มี = จัดเนื้อตามธีม
 */
/**
 * ตระกูลผัง — สรุปจากรูปแบบแม่แบบเอกสารธุรกิจที่พบบ่อย (Modern · Clean · Formal · Bold · Minimalist · Traditional,
 * หัวแถบสี แถบข้าง หัวกระดาษ/ท้ายกระดาษ) ผังจริงอยู่ที่ layout-templates.ts
 */
export const ARCHETYPES: { id: string; name: string; desc: string }[] = [
  { id: "standard", name: "มาตรฐาน", desc: "โลโก้ซ้าย ชื่อเอกสารขวา อ่านง่าย" },
  { id: "form", name: "ฟอร์มสองภาษา", desc: "กล่องข้อมูลมีกรอบ ตารางยาวถึงยอดรวม" },
  { id: "sidebar", name: "แถบข้าง", desc: "แถบสีด้านซ้ายเต็มหน้า" },
  { id: "centerBand", name: "หัวกลาง", desc: "บริษัทกึ่งกลาง แถบชื่อเอกสาร" },
  { id: "cards", name: "การ์ด", desc: "ลูกค้า/เลขที่เป็นการ์ดพื้นอ่อน" },
  { id: "banner", name: "หัวแถบสีเต็ม", desc: "หัวกระดาษพื้นสีเต็มความกว้าง ตัวอักษรขาว" },
  { id: "split", name: "หัวแบ่งสองฝั่ง", desc: "บล็อกสีชื่อเอกสาร คู่โลโก้และบริษัท" },
  { id: "minimalLine", name: "มินิมอลเส้นบาง", desc: "ไม่มีกรอบ เส้นบางแบ่งส่วน" },
  { id: "frame", name: "กรอบทั้งหน้า", desc: "กรอบเส้นรอบหน้า แบบฟอร์มทางการ" },
  { id: "footerBand", name: "แถบท้ายกระดาษ", desc: "แถบสีท้ายหน้าพร้อมข้อมูลติดต่อ" },
  { id: "mirror", name: "โลโก้ขวา", desc: "บริษัทชิดขวา ชื่อเอกสารชิดซ้าย" },
  { id: "compact", name: "กะทัดรัด", desc: "หัวเล็ก ตารางยาว เหมาะรายการเยอะ" },
];
/** รูปแบบตาราง/ยอดรวม/ฟอนต์ ที่ใช้คู่กับทุกตระกูลผัง */
const VARIANTS: { id: string; name: string; patch: Partial<DocTheme> }[] = [
  { id: "a", name: "หัวตารางทึบ", patch: { table: "solid", totals: "solid", rounded: true } },
  { id: "b", name: "ทางการเส้นครบ", patch: { table: "grid", totals: "grid", rounded: false, font: "THSarabunNew", formStyle: true } },
  { id: "c", name: "แถวสลับสี", patch: { table: "zebra", totals: "outline", rounded: true } },
  { id: "d", name: "เส้นบาง", patch: { table: "lines", totals: "plain", rounded: false } },
  { id: "e", name: "สองภาษา", patch: { table: "tint", totals: "solid", bilingual: true, formStyle: true } },
];
/** แม่แบบที่สร้างจากตระกูลผัง × รูปแบบ (12 × 5 = 60 แบบต่อชนิดเอกสาร) สลับชุดสีให้หลากหลาย — เปลี่ยนชุดสีภายหลังได้ทุกแบบ */
const GENERATED_TEMPLATES = ARCHETYPES.flatMap((a, ai) => VARIANTS.map((v, vi) => {
  const p = PALETTES[(ai * 3 + vi * 5) % PALETTES.length];
  const id = `${a.id}-${v.id}`;
  return {
    id, name: `${a.name} · ${v.name}`, description: `${a.desc} · ชุดสี${p.name}`, family: a.id, layout: a.id,
    theme: { ...BASE, templateId: id, primary: p.primary, accent: p.accent, party: (a.id === "form" ? "none" : "accent-bar") as PartyStyle, ...v.patch, ...(a.id === "form" ? { formStyle: true } : {}) },
  };
}));

export const TEMPLATES: { id: string; name: string; description: string; theme: DocTheme; layout?: string; family?: string }[] = [
  { id: "modern", name: "โมเดิร์น", description: "แถบสีด้านข้าง หัวตารางสีอ่อน ยอดรวมเต็มสี", theme: BASE },
  { id: "classic", name: "คลาสสิก", description: "เส้นตารางครบ ตัวอักษร TH Sarabun เหมาะงานทางการ", theme: { ...BASE, templateId: "classic", font: "THSarabunNew", primary: "#1e3a8a", accent: "#1e3a8a", party: "boxed", table: "grid", rounded: false, totals: "outline", signatures: "box" } },
  { id: "government", name: "ราชการ", description: "TH SarabunIT๙ สีดำล้วน หัวเอกสารกึ่งกลาง", theme: { ...BASE, templateId: "government", font: "THSarabunIT9", primary: "#111111", accent: "#111111", header: "centered", party: "plain", table: "grid", rounded: false, totals: "outline", signatures: "line", margin: 40 } },
  { id: "minimal", name: "มินิมอล", description: "เส้นบาง พื้นที่ว่างมาก ดูสะอาดตา", theme: { ...BASE, templateId: "minimal", primary: "#334155", accent: "#64748b", party: "plain", table: "lines", totals: "plain", margin: 40 } },
  { id: "bold", name: "แถบสีเด่น", description: "แถบหัวเอกสารเต็มสี หัวตารางทึบ", theme: { ...BASE, templateId: "bold", primary: "#0d9488", accent: "#0f766e", header: "banner", table: "solid", party: "boxed" } },
  { id: "elegant", name: "หรูเรียบ", description: "โทนน้ำตาลทอง ตารางสลับสี โลโก้ด้านขวา", theme: { ...BASE, templateId: "elegant", primary: "#7c2d12", accent: "#b45309", header: "logo-right", table: "zebra", party: "accent-bar", totals: "solid" } },
  { id: "psg-form", name: "ฟอร์มสองภาษา (แบบเดิมของบริษัท)", description: "ป้ายไทย/อังกฤษ แถบ Quotation สีฟ้า ตารางยาวถึงยอดรวม ช่องลงนาม 2 ช่องมีโลโก้กลาง", layout: "form", theme: { ...BASE, templateId: "psg-form", primary: "#5b8fd1", accent: "#9dc3e6", text: "#111111", muted: "#555555", party: "none", table: "grid", rounded: true, totals: "grid", signatures: "box", margin: 26, bilingual: true, formStyle: true } },
  { id: "form-navy", name: "ฟอร์มสองภาษา กรมท่า", description: "ผังฟอร์มเดียวกัน โทนกรมท่า มุมเหลี่ยม", layout: "form", theme: { ...BASE, templateId: "form-navy", primary: "#1e3a8a", accent: "#6d83c9", text: "#111111", party: "none", table: "grid", rounded: false, totals: "grid", signatures: "box", margin: 26, bilingual: true, formStyle: true } },
  { id: "sidebar", name: "แถบข้างสีเข้ม", description: "แถบสีด้านซ้ายเต็มหน้า ชื่อเอกสารตัวใหญ่ ยอดรวมกรอบสี", layout: "sidebar", theme: { ...BASE, templateId: "sidebar", primary: "#1e3a5f", accent: "#c9a227", party: "plain", table: "lines", totals: "outline", margin: 32 } },
  { id: "center-band", name: "หัวกลาง แถบชื่อเอกสาร", description: "บริษัทกึ่งกลาง แถบชื่อเอกสารเต็มความกว้าง ตารางทึบ", layout: "centerBand", theme: { ...BASE, templateId: "center-band", primary: "#0e7490", accent: "#22a3c4", party: "boxed", table: "solid", totals: "solid", signatures: "line" } },
  { id: "cards", name: "การ์ดมน", description: "กล่องมุมมนแยกส่วน ลูกค้า/เลขที่เป็นการ์ดคู่ ยอดรวมการ์ดสี", layout: "cards", theme: { ...BASE, templateId: "cards", primary: "#5b21b6", accent: "#8b5cf6", party: "plain", table: "zebra", totals: "solid", signatures: "box", formStyle: true } },
  { id: "bilingual-minimal", name: "มินิมอลสองภาษา", description: "เส้นบาง ป้ายไทย/อังกฤษ เหมาะส่งลูกค้าต่างชาติ", theme: { ...BASE, templateId: "bilingual-minimal", primary: "#111111", accent: "#555555", party: "plain", table: "lines", totals: "plain", margin: 40, bilingual: true } },
  { id: "sunset", name: "ส้มสดใส", description: "หัวแถบสีส้ม ตารางสลับสี ดูเป็นมิตร", theme: { ...BASE, templateId: "sunset", primary: "#c2410c", accent: "#f97316", header: "banner", table: "zebra", party: "accent-bar", totals: "solid" } },
  { id: "emerald-grid", name: "มรกตทางการ", description: "TH Sarabun เส้นตารางครบ ยอดรวมแบบตาราง", theme: { ...BASE, templateId: "emerald-grid", font: "THSarabunNew", primary: "#047857", accent: "#a7f3d0", party: "boxed", table: "grid", rounded: false, totals: "grid", signatures: "box", formStyle: true } },
  { id: "berry", name: "เบอร์รี่โมเดิร์น", description: "โลโก้ขวา แถบสีด้านข้างลูกค้า หัวตารางสีอ่อน", theme: { ...BASE, templateId: "berry", primary: "#9d174d", accent: "#db2777", header: "logo-right", table: "tint", party: "accent-bar", totals: "solid" } },
  ...GENERATED_TEMPLATES,
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** ผสมสีกับขาว (t = สัดส่วนสีขาว 0–1) */
export function tint(hex: string, t: number): string {
  if (!HEX.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/**
 * สีอ้างอิงธีม — กล่องในผัง/แม่แบบเก็บเป็นคำอ้างอิง เปลี่ยนชุดสีแล้วทุกส่วน (แถบ กรอบ หัวตาราง เส้น) เปลี่ยนตามกันทั้งเอกสาร
 */
export const COLOR_TOKENS: Record<string, string> = { "@primary": "สีหลัก", "@accent": "สีรอง", "@soft": "สีอ่อน", "@line": "สีเส้น" };
/** สีเส้นตาราง/กรอบตั้งต้น: สีหลักแบบอ่อน (เดิมเป็นเทาคงที่ ไม่ตามธีม) */
export const themeLine = (t: DocTheme) => tint(t.primary, 0.72);
export function resolveColor(v: string | undefined, t: DocTheme): string | undefined {
  if (!v) return v;
  switch (v) {
    case "@primary": return t.primary;
    case "@accent": return t.accent;
    case "@soft": return tint(t.accent, 0.88);
    case "@line": return themeLine(t);
    default: return v;
  }
}
/** แปลงสีอ้างอิงธีมของกล่องเป็นสีจริง */
export function resolveBlockColors(b: FreeBlock, t: DocTheme): FreeBlock {
  if (![b.color, b.bg, b.border, b.headBg, b.lineColor].some((v) => v?.startsWith("@"))) return b;
  return { ...b, color: resolveColor(b.color, t), bg: resolveColor(b.bg, t), border: resolveColor(b.border, t), headBg: resolveColor(b.headBg, t), lineColor: resolveColor(b.lineColor, t) };
}
const colorOk = (v: any) => HEX.test(String(v || "")) || String(v || "") in COLOR_TOKENS;
const pick = <T extends string>(v: any, list: readonly T[], d: T): T => (list.includes(v) ? v : d);
const num = (v: any, min: number, max: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const color = (v: any, d: string) => (HEX.test(String(v || "")) ? String(v) : d);
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export function normalizeTheme(raw: any, brandColor?: string): DocTheme {
  const r = raw && typeof raw === "object" ? raw : {};
  const base = { ...BASE, ...(brandColor && HEX.test(brandColor) ? { primary: brandColor, accent: brandColor } : {}) };
  return {
    templateId: str(r.templateId, 40) || base.templateId,
    font: pick(r.font, ["Sarabun", "THSarabunNew", "THSarabunIT9"] as const, base.font),
    fontSize: num(r.fontSize, 7.5, 12, base.fontSize),
    primary: color(r.primary, base.primary),
    accent: color(r.accent, base.accent),
    text: color(r.text, base.text),
    muted: color(r.muted, base.muted),
    header: pick(r.header, ["logo-left", "logo-right", "centered", "banner"] as const, base.header),
    logoSize: num(r.logoSize, 32, 200, base.logoSize),
    party: pick(r.party, ["accent-bar", "boxed", "plain", "none"] as const, base.party),
    table: pick(r.table, ["tint", "solid", "lines", "grid", "zebra"] as const, base.table),
    rounded: r.rounded === undefined ? base.rounded : !!r.rounded,
    totals: pick(r.totals, ["solid", "outline", "plain", "grid"] as const, base.totals),
    signatures: pick(r.signatures, ["line", "box"] as const, base.signatures),
    margin: num(r.margin, 20, 60, base.margin),
    showPageNumber: r.showPageNumber === undefined ? true : !!r.showPageNumber,
    watermark: str(r.watermark, 30),
    bilingual: !!r.bilingual,
    formStyle: !!r.formStyle,
  };
}

const KINDS = Object.keys(BLOCK_LABELS) as BlockKind[];
const COLUMN_KEYS = ITEM_COLUMNS.map((c) => c.key);

function normalizeBlock(b: any, index: number): FreeBlock | null {
  if (!b || !KINDS.includes(b.kind)) return null;
  // เส้นแนวตั้ง/แนวนอนบางได้ถึง 0.25pt
  const w = num(b.w, 0.25, PAGE_MAX, 100), h = num(b.h, 0.25, PAGE_MAX, 40);
  const parts = (BLOCK_PARTS[b.kind as BlockKind] || []).map((p) => p.key);
  // แถวของกล่องเลขที่ (number/date/m:ป้าย) และแถวยอดรวม (t:ป้าย) เป็นคีย์ตามข้อมูลของเอกสาร
  const okHide = (k: string) => parts.includes(k) || (b.kind === "meta" && (k === "number" || k === "date" || /^m:[^\n]{1,40}$/.test(k))) || (b.kind === "totals" && /^t:[^\n]{1,60}$/.test(k));
  const hide: string[] = Array.isArray(b.hide) ? [...new Set<string>(b.hide.map(String))].filter(okHide).slice(0, 30) : [];
  const fields: string[] = !Array.isArray(b.fields) ? []
    : b.kind === "meta" ? [...new Set<string>(b.fields.map(String))].filter((k) => /^f:[a-zA-Z]{1,30}$/.test(k)).slice(0, 10)
    : b.kind === "info" ? [...new Set<string>(b.fields.map(String))].filter((k) => FIELD_KEY.test(k)).slice(0, 20) : [];
  const colSpec: ColumnSpec[] = b.kind === "items" && Array.isArray(b.colSpec)
    ? b.colSpec.filter((x: any, i: number, a: any[]) => x && COLUMN_KEYS.includes(x.key) && a.findIndex((y: any) => y?.key === x.key) === i).slice(0, 12).map((x: any) => ({
      key: x.key,
      ...(str(x.label, 30) ? { label: str(x.label, 30) } : {}),
      ...(["left", "center", "right"].includes(x.align) ? { align: x.align } : {}),
      ...(x.width !== undefined && x.width !== null && x.width !== "" ? { width: num(x.width, 3, 80, 10) } : {}),
    })) : [];
  if (colSpec.length && !colSpec.some((x) => x.key === "description")) colSpec.unshift({ key: "description" });
  const cols = b.kind === "items" && Array.isArray(b.cols) ? COLUMN_KEYS.filter((k) => b.cols.includes(k)) : [];
  const labels = b.kind === "signatures" && Array.isArray(b.labels) ? b.labels.map((s: any) => str(s, 40)).filter(Boolean).slice(0, 4) : [];
  return {
    id: str(b.id, 40) || `${b.kind}-${index}`, kind: b.kind,
    x: num(b.x, 0, PAGE_MAX - 4, 0), y: num(b.y, 0, PAGE_MAX - 1, 0), w, h,
    ...(b.text !== undefined ? { text: str(b.text, 1000) } : {}),
    ...(b.kind === "image" && /^data:image\/(png|jpeg);base64,/.test(String(b.src || "")) && String(b.src).length < 400_000 ? { src: String(b.src) } : {}),
    ...(b.fontSize !== undefined && b.fontSize !== null ? { fontSize: num(b.fontSize, 6, 40, 10) } : {}),
    ...(b.lineHeight !== undefined && b.lineHeight !== null ? { lineHeight: num(b.lineHeight, 1, 2.5, 1.35) } : {}),
    ...(colorOk(b.color) ? { color: b.color } : {}),
    ...(colorOk(b.bg) ? { bg: b.bg } : {}),
    ...(colorOk(b.border) ? { border: b.border } : {}),
    ...(["left", "center", "right", "justify"].includes(b.align) ? { align: b.align } : {}),
    ...(b.bold ? { bold: true } : {}),
    ...(b.italic ? { italic: true } : {}), ...(b.underline ? { underline: true } : {}), ...(b.strike ? { strike: true } : {}),
    ...(b.letterSpacing !== undefined && b.letterSpacing !== null && Number(b.letterSpacing) !== 0 ? { letterSpacing: num(b.letterSpacing, -2, 10, 0) } : {}),
    ...(b.font && (Object.keys(FONT_SCALE) as string[]).includes(b.font) ? { font: b.font } : {}),
    ...(b.opacity !== undefined && b.opacity !== null && Number(b.opacity) < 1 ? { opacity: num(b.opacity, 0.1, 1, 1) } : {}),
    ...(hide.length ? { hide } : {}),
    ...(cols.length ? { cols: cols.includes("description") ? cols : (["description", ...cols] as ItemColumn[]) } : {}),
    ...(labels.length ? { labels } : {}),
    ...(fields.length || b.kind === "info" ? { fields } : {}),
    ...(colSpec.length ? { colSpec } : {}),
    ...(b.kind === "info" && b.emphasizeFirst ? { emphasizeFirst: true } : {}),
    ...(() => {
      if (b.kind !== "info" || !b.names || typeof b.names !== "object") return {};
      const names = Object.fromEntries(fields.map((k) => [k, str(b.names[k], 40)]).filter(([, v]) => v));
      return Object.keys(names).length ? { names } : {};
    })(),
    ...(LABEL_KINDS.includes(b.kind) && b.labelWidth !== undefined && b.labelWidth !== null ? { labelWidth: num(b.labelWidth, 20, 300, 90) } : {}),
    ...(LABEL_KINDS.includes(b.kind) && b.labelGap !== undefined && b.labelGap !== null ? { labelGap: num(b.labelGap, 0, 60, 4) } : {}),
    ...(LABEL_KINDS.includes(b.kind) && b.rowGap !== undefined && b.rowGap !== null ? { rowGap: num(b.rowGap, 0, 30, 1.5) } : {}),
    ...(b.valign === "middle" || b.valign === "bottom" ? { valign: b.valign } : {}),
    ...(b.kind === "sign" && str(b.signer, 40) ? { signer: str(b.signer, 40) } : b.kind === "sign" && str(b.slot, 60) ? { slot: str(b.slot, 60) } : {}),
    ...(b.kind === "signatures" && b.gap !== undefined && b.gap !== null ? { gap: num(b.gap, 0, 300, 16) } : {}),
    ...(b.kind === "items" && b.fill ? { fill: true } : {}),
    ...(b.kind === "field" ? { field: FIELD_KEY.test(String(b.field || "")) ? String(b.field) : "number" } : {}),
    ...((b.kind === "field" || b.kind === "info") && b.hideLabel ? { hideLabel: true } : {}),
    ...(b.radius !== undefined && b.radius !== null ? { radius: num(b.radius, 0, 40, 4) } : {}),
    ...(b.borderWidth !== undefined && b.borderWidth !== null ? { borderWidth: num(b.borderWidth, 0.25, 8, 1) } : {}),
    ...(["dashed", "dotted"].includes(b.dash) ? { dash: b.dash } : {}),
    ...(b.kind === "shape" ? { shape: b.shape === "triangle" ? "triangle" : "ellipse" } : {}),
    ...(Array.isArray(b.radii) && b.radii.length === 4 ? { radii: b.radii.map((v: any) => num(v, 0, 60, 0)) as [number, number, number, number] } : {}),
    ...(b.pad !== undefined && b.pad !== null ? { pad: num(b.pad, 0, 30, 4) } : {}),
    ...(b.kind === "info" && b.flow === "row" ? { flow: "row" as const } : {}),
    ...(["tint", "solid", "lines", "grid", "zebra"].includes(b.table) ? { table: b.table } : {}),
    ...(["solid", "outline", "plain", "grid"].includes(b.totalsStyle) ? { totalsStyle: b.totalsStyle } : {}),
    ...(["accent-bar", "boxed", "plain", "none"].includes(b.partyStyle) ? { partyStyle: b.partyStyle } : {}),
    ...(colorOk(b.headBg) ? { headBg: b.headBg } : {}),
    ...(colorOk(b.lineColor) ? { lineColor: b.lineColor } : {}),
    ...(b.locked ? { locked: true } : {}),
    ...(/^[a-z0-9-]{1,40}$/.test(String(b.group || "")) ? { group: String(b.group) } : {}),
  };
}

/** เลขที่/วันที่ต้องปรากฏเสมอ (ม.86/4): ดูจากกล่องเลขที่ ช่องข้อมูล หรือข้อความที่มี {{number}}/{{date}} */
export function legalFieldVisible(blocks: FreeBlock[], key: "number" | "date"): boolean {
  return blocks.some((b) => (b.kind === "meta" && !(b.hide || []).includes(key)) || (b.kind === "field" && b.field === key) || (b.kind === "info" && (b.fields || []).includes(key)) || (b.kind === "text" && (b.text || "").includes(`{{${key}}}`)));
}
/** คืนเลขที่/วันที่ที่ถูกซ่อนโดยไม่มีที่แสดงอื่น (แก้ในกล่องเลขที่ของผังเอกสารก่อน ไม่มีจึงแก้ในหัวกระดาษ) */
function restoreLegalFields(free: FreeLayout | undefined, lh: Letterhead | undefined) {
  for (const key of ["number", "date"] as const) {
    const all = [...(free?.enabled ? free.blocks : []), ...(lh?.blocks || [])];
    if (!all.length || legalFieldVisible(all, key)) continue;
    const target = (free?.enabled ? free.blocks : []).find((b) => b.kind === "meta") || lh?.blocks.find((b) => b.kind === "meta");
    if (target) target.hide = (target.hide || []).filter((k) => k !== key);
  }
}

export function normalizeFreeLayout(raw: any, docType?: string): FreeLayout | undefined {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.blocks)) return undefined;
  const blocks: FreeBlock[] = [];
  for (const b of raw.blocks.slice(0, 60)) { const n = normalizeBlock(b, blocks.length); if (n) blocks.push(n); }
  // กล่องที่กฎหมายบังคับต้องอยู่ครบ: ขาดตัวไหนเติมกลับจากผังมาตรฐาน
  const defaults = defaultFreeLayout().blocks;
  // (กล่องที่แยกเป็นช่องย่อยครบแล้วนับว่ามี)
  for (const k of requiredBlocksFor(docType)) if (!requiredSatisfied(k, blocks)) blocks.push(defaults.find((b) => b.kind === k)!);
  return {
    enabled: !!raw.enabled, blocks,
    ...(raw.margin !== undefined && raw.margin !== null ? { margin: num(raw.margin, 0, 80, 32) } : {}),
    ...(Array.isArray(raw.margins) && raw.margins.length === 4 ? { margins: raw.margins.map((v: any) => num(v, 0, 120, 32)) as Margins } : {}),
    ...(raw.paper && raw.paper !== "A4" && raw.paper in PAPERS ? { paper: raw.paper as PaperSize } : {}),
    ...(raw.landscape ? { landscape: true } : {}),
  };
}

export function normalizeLetterhead(raw: any, index = 0): Letterhead | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.blocks)) return null;
  const id = /^[a-z0-9-]{1,40}$/.test(String(raw.id || "")) ? String(raw.id) : `lh-${index + 1}`;
  const blocks: FreeBlock[] = [];
  for (const b of raw.blocks.slice(0, 30)) { const n = HEAD_KINDS.includes(b?.kind) ? normalizeBlock(b, blocks.length) : null; if (n) blocks.push(n); }
  return { id, name: str(raw.name, 40) || `หัวกระดาษ ${index + 1}`, height: num(raw.height, 40, 320, 150), blocks };
}

export function normalizeDesign(raw: any, brandColor?: string): DocumentDesign {
  const r = raw && typeof raw === "object" ? raw : {};
  const letterheads: Letterhead[] = [];
  for (const x of Array.isArray(r.letterheads) ? r.letterheads.slice(0, 6) : []) {
    const lh = normalizeLetterhead(x, letterheads.length);
    if (lh && !letterheads.some((l) => l.id === lh.id)) letterheads.push(lh);
  }
  const perDoc: Record<string, PerDocDesign> = {};
  for (const [k, v] of Object.entries(r.perDoc && typeof r.perDoc === "object" ? r.perDoc : {}).slice(0, 40)) {
    if (!/^[a-z_]{2,30}$/.test(k) || !v || typeof v !== "object") continue;
    const x: any = v;
    const d: PerDocDesign = {};
    if (str(x.title, 80)) d.title = str(x.title, 80);
    if (str(x.titleEn, 80)) d.titleEn = str(x.titleEn, 80);
    if (str(x.extraNote, 500)) d.extraNote = str(x.extraNote, 500);
    if (Array.isArray(x.hideColumns)) d.hideColumns = x.hideColumns.filter((c: any) => ["code", "unit", "discount", "price"].includes(c));
    if (Array.isArray(x.signatures)) d.signatures = x.signatures.map((s: any) => str(s, 40)).filter(Boolean).slice(0, 4);
    const free = normalizeFreeLayout(x.free, k);
    if (free) d.free = free;
    if (letterheads.some((l) => l.id === x.letterhead)) d.letterhead = x.letterhead;
    restoreLegalFields(d.free, letterheads.find((l) => l.id === d.letterhead));
    if (Object.keys(d).length) perDoc[k] = d;
  }
  return { theme: normalizeTheme(r.theme, brandColor), perDoc, letterheads };
}

/** ตำแหน่งส่วนหัว/ลูกค้า/ตาราง ตามขนาดฟอนต์ (TH Sarabun ใหญ่กว่า 1.32 เท่า ต้องเว้นที่มากกว่า) */
function topRows(font?: FontFamily, metaRows = 3) {
  const k = FONT_SCALE[font || "Sarabun"];
  const r = (n: number) => Math.round(n);
  const titleH = r(62 * (1 + (k - 1) * 0.7)), metaY = 30 + titleH + 4, metaH = Math.max(r(46 * k), r(metaRows * 15 * k) + 8);
  const partyY = metaY + metaH + 8, partyH = r(64 * k), itemsY = partyY + partyH + 10;
  return { titleH, metaY, metaH, partyY, partyH, itemsY, sellerH: r(78 * k) };
}

/**
 * ผังมาตรฐาน (จุดเริ่มต้นของโหมดลากวาง) — ตำแหน่งเทียบเท่าเอกสารมาตรฐาน; เอกสารที่ไม่มียอดเงินไม่มีกล่องยอดรวม
 * metaLabels: แถวข้อมูลของเอกสาร — แสดง 2 แถวแรกในกล่องเลขที่ (ที่เหลือเปิดได้จาก "ข้อมูลในเอกสาร") และสูงพอดีจำนวนแถว
 */
export function defaultFreeLayout(docType?: string, font?: FontFamily, metaLabels: string[] = []): FreeLayout {
  const m = 32, W = A4.w - m * 2;
  const amounts = docHasAmounts(docType);
  const t = topRows(font, 2 + Math.min(2, metaLabels.length));
  const metaHide = metaLabels.slice(2).map((l) => `m:${l}`);
  const blocks: FreeBlock[] = [
    { id: "logo", kind: "logo", x: m, y: 30, w: 64, h: 64 },
    { id: "seller", kind: "seller", x: m + 74, y: 30, w: W * 0.58 - 74, h: t.sellerH },
    { id: "title", kind: "title", x: m + W * 0.58, y: 30, w: W * 0.42, h: t.titleH, align: "right" },
    { id: "meta", kind: "meta", x: m + W * 0.58, y: t.metaY, w: W * 0.42, h: t.metaH, ...(metaHide.length ? { hide: metaHide } : {}) },
    { id: "party", kind: "party", x: m, y: t.partyY, w: W, h: t.partyH },
    { id: "items", kind: "items", x: m, y: t.itemsY, w: W, h: (amounts ? 580 : 664) - t.itemsY },
    ...(amounts ? [
      { id: "words", kind: "words", x: m, y: 590, w: W * 0.57, h: 22 },
      { id: "totals", kind: "totals", x: m + W * 0.6, y: 590, w: W * 0.4, h: 80 },
    ] as FreeBlock[] : []),
    { id: "notes", kind: "notes", x: m, y: amounts ? 618 : 674, w: W * 0.57, h: amounts ? 50 : 30 },
    { id: "payment", kind: "payment", x: m, y: 672, w: W * 0.57, h: 22 },
    { id: "signatures", kind: "signatures", x: m, y: 712, w: W, h: 80 },
  ];
  return { enabled: false, blocks: amounts ? blocks : blocks.filter((b) => b.kind !== "payment") };
}

/** แม่แบบหัวกระดาษ: การค้า (ใบเสนอราคา ใบวางบิล ใบเสร็จ) · หนังสือ (ขอเข้าพื้นที่ ส่งมอบงาน) · แถบสี */
export const LETTERHEAD_TEMPLATES: { id: "trade" | "letter" | "banner"; name: string; description: string }[] = [
  { id: "trade", name: "หัวกระดาษเอกสารการค้า", description: "โลโก้ + ข้อมูลบริษัทซ้าย · ชื่อเอกสาร เลขที่ วันที่ขวา" },
  { id: "letter", name: "หัวกระดาษหนังสือ", description: "โลโก้และชื่อบริษัทกึ่งกลาง เส้นคั่นใต้หัว (หนังสือขอเข้าพื้นที่ ส่งมอบงาน)" },
  { id: "banner", name: "หัวกระดาษแถบสี", description: "แถบสีเต็มความกว้าง ตัวอักษรสีขาว" },
];
export function letterheadTemplate(kind: "trade" | "letter" | "banner", id: string, primary = "#1f6f5c", font?: FontFamily): Letterhead {
  const m = 32, W = A4.w - m * 2;
  const k = FONT_SCALE[font || "Sarabun"];
  const r = (n: number) => Math.round(n);
  const name = LETTERHEAD_TEMPLATES.find((t) => t.id === kind)!.name;
  if (kind === "letter") {
    const sellerH = r(64 * k), lineY = 86 + sellerH + 6;
    return { id, name, height: lineY + 12, blocks: [
      { id: "logo", kind: "logo", x: (A4.w - 56) / 2, y: 26, w: 56, h: 56 },
      { id: "seller", kind: "seller", x: m, y: 86, w: W, h: sellerH, align: "center", hide: ["nameEn"] },
      { id: "line", kind: "line", x: m, y: lineY, w: W, h: 1, color: "@primary" },
    ] };
  }
  if (kind === "banner") {
    const bandH = r(112 * k), metaH = r(46 * k);
    return { id, name, height: bandH + metaH + 10, blocks: [
      { id: "band", kind: "rect", x: 0, y: 0, w: A4.w, h: bandH, bg: "@primary", radius: 0 },
      { id: "logo", kind: "logo", x: m, y: 20, w: 64, h: 64 },
      { id: "seller", kind: "seller", x: m + 74, y: 16, w: W * 0.58 - 74, h: bandH - 24, color: "#ffffff" },
      { id: "title", kind: "title", x: m + W * 0.58, y: 18, w: W * 0.42, h: bandH - 26, align: "right", color: "#ffffff" },
      { id: "meta", kind: "meta", x: m + W * 0.58, y: bandH + 6, w: W * 0.42, h: metaH },
    ] };
  }
  const t = topRows(font);
  return { id, name, height: t.partyY - 4, blocks: defaultFreeLayout(undefined, font).blocks.filter((b) => ["logo", "seller", "title", "meta"].includes(b.kind)).map((b) => ({ ...b })) };
}

/** ใช้ผังลากวางของเอกสารหนึ่งกับเอกสารอื่น (ตำแหน่ง/สไตล์กล่อง และหัวกระดาษเดียวกัน ข้อมูลเป็นของแต่ละเอกสาร) */
export function applyLayoutToAll(design: DocumentDesign, sourceDoc: string, targets: string[]): DocumentDesign {
  const srcDoc = design.perDoc[sourceDoc];
  const src = srcDoc?.free;
  if (!src) return design;
  const perDoc = { ...design.perDoc };
  for (const t of targets) {
    if (t === sourceDoc) continue;
    // คอลัมน์ตารางเป็นของแต่ละเอกสาร (ใบวางบิลไม่มีจำนวน/ราคา) — ไม่คัดลอก; เอกสารไม่มียอดเงินไม่รับกล่องยอดรวม
    const blocks = src.blocks
      .filter((b) => docHasAmounts(t) || (b.kind !== "totals" && b.kind !== "words"))
      .map((b) => { const { cols: _cols, ...rest } = b; return b.kind === "items" ? rest : { ...b }; });
    perDoc[t] = { ...(perDoc[t] || {}), free: { enabled: src.enabled, blocks }, ...(srcDoc.letterhead ? { letterhead: srcDoc.letterhead } : {}) };
  }
  return { ...design, perDoc };
}

/** ธีม + การปรับของเอกสารชนิดนี้ + หัวกระดาษที่เลือก (ใช้ตอนสร้าง PDF) */
export function resolveDesign(design: DocumentDesign | undefined, docType: string, brandColor?: string): { theme: DocTheme; doc: PerDocDesign; letterhead?: Letterhead } {
  const d = design || normalizeDesign(null, brandColor);
  const doc = d.perDoc[docType] || {};
  const letterhead = doc.letterhead ? (d.letterheads || []).find((l) => l.id === doc.letterhead) : undefined;
  return { theme: d.theme, doc, ...(letterhead ? { letterhead } : {}) };
}
