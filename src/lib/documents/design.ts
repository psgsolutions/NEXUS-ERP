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
}

export interface DocumentDesign { theme: DocTheme; perDoc: Record<string, PerDocDesign> }

// ---------- ผังลากวางอิสระ ----------
export type BlockKind = "logo" | "seller" | "title" | "meta" | "party" | "items" | "totals" | "words" | "notes" | "payment" | "signatures" | "text" | "line" | "rect" | "image";
export interface FreeBlock {
  id: string;
  kind: BlockKind;
  x: number; y: number; w: number; h: number; // pt บนกระดาษ A4 (595 x 842)
  text?: string;       // text: รองรับ {{number}} {{date}} {{customer}} {{total}}
  src?: string;        // image: data URL
  fontSize?: number;
  color?: string;
  bg?: string;
  border?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
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
export function normalizeFreeLayout(raw: any): FreeLayout | undefined {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.blocks)) return undefined;
  const blocks: FreeBlock[] = [];
  for (const b of raw.blocks.slice(0, 60)) {
    if (!b || !KINDS.includes(b.kind)) continue;
    const w = num(b.w, 4, A4.w, 100), h = num(b.h, 1, A4.h, 40);
    blocks.push({
      id: str(b.id, 40) || `${b.kind}-${blocks.length}`, kind: b.kind,
      x: num(b.x, 0, A4.w - 4, 0), y: num(b.y, 0, A4.h - 1, 0), w, h,
      ...(b.text !== undefined ? { text: str(b.text, 1000) } : {}),
      ...(b.kind === "image" && /^data:image\/(png|jpeg);base64,/.test(String(b.src || "")) && String(b.src).length < 400_000 ? { src: String(b.src) } : {}),
      ...(b.fontSize !== undefined ? { fontSize: num(b.fontSize, 6, 40, 10) } : {}),
      ...(HEX.test(String(b.color || "")) ? { color: b.color } : {}),
      ...(HEX.test(String(b.bg || "")) ? { bg: b.bg } : {}),
      ...(HEX.test(String(b.border || "")) ? { border: b.border } : {}),
      ...(["left", "center", "right"].includes(b.align) ? { align: b.align } : {}),
      ...(b.bold ? { bold: true } : {}),
    });
  }
  // กล่องที่กฎหมายบังคับต้องอยู่ครบ: ขาดตัวไหนเติมกลับจากผังมาตรฐาน
  for (const k of REQUIRED_BLOCKS) if (!blocks.some((b) => b.kind === k)) blocks.push(defaultFreeLayout().blocks.find((b) => b.kind === k)!);
  return { enabled: !!raw.enabled, blocks };
}

export function normalizeDesign(raw: any, brandColor?: string): DocumentDesign {
  const r = raw && typeof raw === "object" ? raw : {};
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
    const free = normalizeFreeLayout(x.free);
    if (free) d.free = free;
    if (Object.keys(d).length) perDoc[k] = d;
  }
  return { theme: normalizeTheme(r.theme, brandColor), perDoc };
}

/** ผังมาตรฐาน (จุดเริ่มต้นของโหมดลากวาง) — ตำแหน่งเทียบเท่าเอกสารมาตรฐาน */
export function defaultFreeLayout(): FreeLayout {
  const m = 32, W = A4.w - m * 2;
  return {
    enabled: false,
    blocks: [
      { id: "logo", kind: "logo", x: m, y: 30, w: 64, h: 64 },
      { id: "seller", kind: "seller", x: m + 74, y: 30, w: W * 0.58 - 74, h: 78 },
      { id: "title", kind: "title", x: m + W * 0.58, y: 30, w: W * 0.42, h: 62, align: "right" },
      { id: "meta", kind: "meta", x: m + W * 0.58, y: 96, w: W * 0.42, h: 46 },
      { id: "party", kind: "party", x: m, y: 150, w: W, h: 64 },
      { id: "items", kind: "items", x: m, y: 224, w: W, h: 356 },
      { id: "words", kind: "words", x: m, y: 590, w: W * 0.57, h: 22 },
      { id: "notes", kind: "notes", x: m, y: 618, w: W * 0.57, h: 50 },
      { id: "totals", kind: "totals", x: m + W * 0.6, y: 590, w: W * 0.4, h: 80 },
      { id: "payment", kind: "payment", x: m, y: 672, w: W * 0.57, h: 22 },
      { id: "signatures", kind: "signatures", x: m, y: 712, w: W, h: 80 },
    ],
  };
}

/** ใช้ผังลากวางของเอกสารหนึ่งกับเอกสารอื่น (ตำแหน่ง/สไตล์กล่องเดียวกัน ข้อมูลเป็นของแต่ละเอกสาร) */
export function applyLayoutToAll(design: DocumentDesign, sourceDoc: string, targets: string[]): DocumentDesign {
  const src = design.perDoc[sourceDoc]?.free;
  if (!src) return design;
  const perDoc = { ...design.perDoc };
  for (const t of targets) if (t !== sourceDoc) perDoc[t] = { ...(perDoc[t] || {}), free: { enabled: src.enabled, blocks: src.blocks.map((b) => ({ ...b })) } };
  return { ...design, perDoc };
}

/** ธีม + การปรับของเอกสารชนิดนี้ (ใช้ตอนสร้าง PDF) */
export function resolveDesign(design: DocumentDesign | undefined, docType: string, brandColor?: string): { theme: DocTheme; doc: PerDocDesign } {
  const d = design || normalizeDesign(null, brandColor);
  return { theme: d.theme, doc: d.perDoc[docType] || {} };
}
