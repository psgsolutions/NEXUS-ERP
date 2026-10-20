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
export type PartyStyle = "accent-bar" | "boxed" | "plain";
export type TableStyle = "tint" | "solid" | "lines" | "grid" | "zebra";
export type TotalsStyle = "solid" | "outline" | "plain";
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
export type BlockKind = "logo" | "seller" | "title" | "meta" | "party" | "items" | "totals" | "words" | "notes" | "payment" | "signatures" | "text" | "line" | "rect" | "image";
export type ItemColumn = "no" | "code" | "description" | "qty" | "unit" | "price" | "discount" | "amount";
export interface FreeBlock {
  id: string;
  kind: BlockKind;
  x: number; y: number; w: number; h: number; // pt บนกระดาษ A4 (595 x 842)
  text?: string;       // text: รองรับ {{number}} {{date}} {{customer}} {{total}}
  src?: string;        // image: data URL
  /** ขนาดตัวอักษร (pt) — กล่องข้อมูลระบบ: ขนาดเนื้อหาของกล่อง (หัวข้อในกล่องขยายตามสัดส่วน) */
  fontSize?: number;
  /** ระยะบรรทัด (เท่าของขนาดตัวอักษร) */
  lineHeight?: number;
  color?: string;
  bg?: string;
  border?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  /** ส่วนย่อยที่ซ่อน (คีย์ตาม BLOCK_PARTS) */
  hide?: string[];
  /** ตารางรายการ: คอลัมน์ที่แสดง */
  cols?: ItemColumn[];
  /** ช่องลงนาม: ชื่อช่อง */
  labels?: string[];
}
export interface FreeLayout { enabled: boolean; blocks: FreeBlock[] }

export const A4 = { w: 595.28, h: 841.89 };
/** กล่องที่เอกสารภาษีต้องมี (ลบไม่ได้ในผังอิสระ) */
export const REQUIRED_BLOCKS: BlockKind[] = ["seller", "title", "meta", "party", "items", "totals"];
export const BLOCK_LABELS: Record<BlockKind, string> = {
  logo: "โลโก้", seller: "ข้อมูลผู้ขาย", title: "ชื่อเอกสาร", meta: "เลขที่/วันที่", party: "ข้อมูลลูกค้า/คู่ค้า", items: "ตารางรายการ",
  totals: "ยอดรวม", words: "จำนวนเงินตัวอักษร", notes: "หมายเหตุ", payment: "ข้อมูลการชำระเงิน", signatures: "ช่องลงนาม",
  text: "ข้อความ", line: "เส้น", rect: "กรอบ/พื้นหลัง", image: "รูปภาพ",
};
/** ส่วนย่อยในกล่องที่เลือกซ่อนได้ (ชื่อ ที่อยู่ เลขผู้เสียภาษีของผู้ขาย/ผู้ซื้อ แสดงเสมอ ตามกฎหมาย) */
export const BLOCK_PARTS: Partial<Record<BlockKind, { key: string; label: string }[]>> = {
  seller: [{ key: "nameEn", label: "ชื่อภาษาอังกฤษ" }, { key: "contact", label: "โทร · อีเมล · เว็บไซต์" }],
  title: [{ key: "en", label: "ชื่อภาษาอังกฤษ" }, { key: "copy", label: "ป้ายต้นฉบับ/สำเนา" }],
  meta: [{ key: "extra", label: "ครบกำหนด / อ้างอิง" }],
  party: [{ key: "contact", label: "ผู้ติดต่อ · โทร · อีเมล" }],
  items: [{ key: "detail", label: "รายละเอียดใต้รายการ" }, { key: "heading", label: "หัวข้อหมวด" }],
  signatures: [{ key: "date", label: "บรรทัดวันที่" }],
};
export const ITEM_COLUMNS: { key: ItemColumn; label: string }[] = [
  { key: "no", label: "ลำดับ" }, { key: "code", label: "รหัส" }, { key: "description", label: "รายการ" }, { key: "qty", label: "จำนวน" },
  { key: "unit", label: "หน่วย" }, { key: "price", label: "ราคา/หน่วย" }, { key: "discount", label: "ส่วนลด" }, { key: "amount", label: "จำนวนเงิน" },
];
/** กล่องที่มีตัวอักษร (ปรับขนาด/ระยะบรรทัด/สีได้) */
export const TEXT_BLOCKS: BlockKind[] = ["seller", "title", "meta", "party", "items", "totals", "words", "notes", "payment", "signatures", "text"];
/** กล่องที่วางในหัวกระดาษได้ */
export const HEAD_KINDS: BlockKind[] = ["logo", "seller", "title", "meta", "text", "line", "rect", "image"];

/** เอกสารที่ไม่มียอดเงิน (ไม่ต้องมีกล่องยอดรวม/จำนวนเงินตัวอักษร) */
const NO_AMOUNT_DOCS = ["delivery_note", "work_order"];
export const docHasAmounts = (docType?: string) => !NO_AMOUNT_DOCS.includes(String(docType || ""));
/** กล่องที่เอกสารชนิดนี้ต้องมี */
export const requiredBlocksFor = (docType?: string): BlockKind[] => (docHasAmounts(docType) ? REQUIRED_BLOCKS : REQUIRED_BLOCKS.filter((k) => k !== "totals"));
/** กล่องที่เพิ่มได้ในเอกสารชนิดนี้ */
export const addableBlocksFor = (docType?: string): BlockKind[] =>
  (["text", "line", "rect", "image", "logo", "words", "notes", "payment", "signatures", "totals"] as BlockKind[]).filter((k) => docHasAmounts(docType) || (k !== "words" && k !== "totals"));
/** คอลัมน์ที่ต้องแสดงเสมอ */
export const requiredColumnsFor = (docType?: string): ItemColumn[] => (docHasAmounts(docType) ? ["description", "amount"] : ["description"]);

export const FONT_LABELS: Record<FontFamily, string> = { Sarabun: "Sarabun (ทันสมัย)", THSarabunNew: "TH Sarabun New", THSarabunIT9: "TH SarabunIT๙ (หนังสือราชการ)" };
/** ฟอนต์ TH Sarabun ตัวเล็กกว่า Sarabun ที่ขนาดเดียวกัน — ขยายให้ขนาดที่ตั้งดูเท่ากัน */
export const FONT_SCALE: Record<FontFamily, number> = { Sarabun: 1, THSarabunNew: 1.32, THSarabunIT9: 1.32 };

const BASE: DocTheme = {
  templateId: "modern", font: "Sarabun", fontSize: 9.5, primary: "#1f6f5c", accent: "#1f6f5c", text: "#1a1a1a", muted: "#666666",
  header: "logo-left", logoSize: 64, party: "accent-bar", table: "tint", rounded: true, totals: "solid", signatures: "line",
  margin: 32, showPageNumber: true, watermark: "",
};

/** แม่แบบสำเร็จรูป (เลือกแล้วแก้ต่อได้ทุกค่า) */
export const TEMPLATES: { id: string; name: string; description: string; theme: DocTheme }[] = [
  { id: "modern", name: "โมเดิร์น", description: "แถบสีด้านข้าง หัวตารางสีอ่อน ยอดรวมเต็มสี", theme: BASE },
  { id: "classic", name: "คลาสสิก", description: "เส้นตารางครบ ตัวอักษร TH Sarabun เหมาะงานทางการ", theme: { ...BASE, templateId: "classic", font: "THSarabunNew", primary: "#1e3a8a", accent: "#1e3a8a", party: "boxed", table: "grid", rounded: false, totals: "outline", signatures: "box" } },
  { id: "government", name: "ราชการ", description: "TH SarabunIT๙ สีดำล้วน หัวเอกสารกึ่งกลาง", theme: { ...BASE, templateId: "government", font: "THSarabunIT9", primary: "#111111", accent: "#111111", header: "centered", party: "plain", table: "grid", rounded: false, totals: "outline", signatures: "line", margin: 40 } },
  { id: "minimal", name: "มินิมอล", description: "เส้นบาง พื้นที่ว่างมาก ดูสะอาดตา", theme: { ...BASE, templateId: "minimal", primary: "#334155", accent: "#64748b", party: "plain", table: "lines", totals: "plain", margin: 40 } },
  { id: "bold", name: "แถบสีเด่น", description: "แถบหัวเอกสารเต็มสี หัวตารางทึบ", theme: { ...BASE, templateId: "bold", primary: "#0d9488", accent: "#0f766e", header: "banner", table: "solid", party: "boxed" } },
  { id: "elegant", name: "หรูเรียบ", description: "โทนน้ำตาลทอง ตารางสลับสี โลโก้ด้านขวา", theme: { ...BASE, templateId: "elegant", primary: "#7c2d12", accent: "#b45309", header: "logo-right", table: "zebra", party: "accent-bar", totals: "solid" } },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
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
    logoSize: num(r.logoSize, 32, 120, base.logoSize),
    party: pick(r.party, ["accent-bar", "boxed", "plain"] as const, base.party),
    table: pick(r.table, ["tint", "solid", "lines", "grid", "zebra"] as const, base.table),
    rounded: r.rounded === undefined ? base.rounded : !!r.rounded,
    totals: pick(r.totals, ["solid", "outline", "plain"] as const, base.totals),
    signatures: pick(r.signatures, ["line", "box"] as const, base.signatures),
    margin: num(r.margin, 20, 60, base.margin),
    showPageNumber: r.showPageNumber === undefined ? true : !!r.showPageNumber,
    watermark: str(r.watermark, 30),
  };
}

const KINDS = Object.keys(BLOCK_LABELS) as BlockKind[];
const COLUMN_KEYS = ITEM_COLUMNS.map((c) => c.key);

function normalizeBlock(b: any, index: number): FreeBlock | null {
  if (!b || !KINDS.includes(b.kind)) return null;
  const w = num(b.w, 4, A4.w, 100), h = num(b.h, 1, A4.h, 40);
  const parts = (BLOCK_PARTS[b.kind as BlockKind] || []).map((p) => p.key);
  const hide: string[] = Array.isArray(b.hide) ? [...new Set<string>(b.hide.map(String))].filter((k) => parts.includes(k)) : [];
  const cols = b.kind === "items" && Array.isArray(b.cols) ? COLUMN_KEYS.filter((k) => b.cols.includes(k)) : [];
  const labels = b.kind === "signatures" && Array.isArray(b.labels) ? b.labels.map((s: any) => str(s, 40)).filter(Boolean).slice(0, 4) : [];
  return {
    id: str(b.id, 40) || `${b.kind}-${index}`, kind: b.kind,
    x: num(b.x, 0, A4.w - 4, 0), y: num(b.y, 0, A4.h - 1, 0), w, h,
    ...(b.text !== undefined ? { text: str(b.text, 1000) } : {}),
    ...(b.kind === "image" && /^data:image\/(png|jpeg);base64,/.test(String(b.src || "")) && String(b.src).length < 400_000 ? { src: String(b.src) } : {}),
    ...(b.fontSize !== undefined && b.fontSize !== null ? { fontSize: num(b.fontSize, 6, 40, 10) } : {}),
    ...(b.lineHeight !== undefined && b.lineHeight !== null ? { lineHeight: num(b.lineHeight, 1, 2.5, 1.35) } : {}),
    ...(HEX.test(String(b.color || "")) ? { color: b.color } : {}),
    ...(HEX.test(String(b.bg || "")) ? { bg: b.bg } : {}),
    ...(HEX.test(String(b.border || "")) ? { border: b.border } : {}),
    ...(["left", "center", "right"].includes(b.align) ? { align: b.align } : {}),
    ...(b.bold ? { bold: true } : {}),
    ...(hide.length ? { hide } : {}),
    ...(cols.length ? { cols: cols.includes("description") ? cols : (["description", ...cols] as ItemColumn[]) } : {}),
    ...(labels.length ? { labels } : {}),
  };
}

export function normalizeFreeLayout(raw: any, docType?: string): FreeLayout | undefined {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.blocks)) return undefined;
  const blocks: FreeBlock[] = [];
  for (const b of raw.blocks.slice(0, 60)) { const n = normalizeBlock(b, blocks.length); if (n) blocks.push(n); }
  // กล่องที่กฎหมายบังคับต้องอยู่ครบ: ขาดตัวไหนเติมกลับจากผังมาตรฐาน
  const defaults = defaultFreeLayout().blocks;
  for (const k of requiredBlocksFor(docType)) if (!blocks.some((b) => b.kind === k)) blocks.push(defaults.find((b) => b.kind === k)!);
  return { enabled: !!raw.enabled, blocks };
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
    if (Object.keys(d).length) perDoc[k] = d;
  }
  return { theme: normalizeTheme(r.theme, brandColor), perDoc, letterheads };
}

/** ตำแหน่งส่วนหัว/ลูกค้า/ตาราง ตามขนาดฟอนต์ (TH Sarabun ใหญ่กว่า 1.32 เท่า ต้องเว้นที่มากกว่า) */
function topRows(font?: FontFamily) {
  const k = FONT_SCALE[font || "Sarabun"];
  const r = (n: number) => Math.round(n);
  const titleH = r(62 * (1 + (k - 1) * 0.7)), metaY = 30 + titleH + 4, metaH = r(46 * k);
  const partyY = metaY + metaH + 8, partyH = r(64 * k), itemsY = partyY + partyH + 10;
  return { titleH, metaY, metaH, partyY, partyH, itemsY, sellerH: r(78 * k) };
}

/** ผังมาตรฐาน (จุดเริ่มต้นของโหมดลากวาง) — ตำแหน่งเทียบเท่าเอกสารมาตรฐาน; เอกสารที่ไม่มียอดเงินไม่มีกล่องยอดรวม */
export function defaultFreeLayout(docType?: string, font?: FontFamily): FreeLayout {
  const m = 32, W = A4.w - m * 2;
  const amounts = docHasAmounts(docType);
  const t = topRows(font);
  const blocks: FreeBlock[] = [
    { id: "logo", kind: "logo", x: m, y: 30, w: 64, h: 64 },
    { id: "seller", kind: "seller", x: m + 74, y: 30, w: W * 0.58 - 74, h: t.sellerH },
    { id: "title", kind: "title", x: m + W * 0.58, y: 30, w: W * 0.42, h: t.titleH, align: "right" },
    { id: "meta", kind: "meta", x: m + W * 0.58, y: t.metaY, w: W * 0.42, h: t.metaH },
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
      { id: "line", kind: "line", x: m, y: lineY, w: W, h: 1, color: primary },
    ] };
  }
  if (kind === "banner") {
    const bandH = r(112 * k), metaH = r(46 * k);
    return { id, name, height: bandH + metaH + 10, blocks: [
      { id: "band", kind: "rect", x: 0, y: 0, w: A4.w, h: bandH, bg: primary },
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
