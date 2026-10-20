/**
 * ผังลากวางสำเร็จรูปของแม่แบบ (ฟังก์ชันล้วน) — เลือกแม่แบบแล้วเอกสารทุกชนิดได้ผังนี้ ลากปรับต่อได้อิสระ
 *  - form: ฟอร์มสองภาษาตามใบเสนอราคาเดิมของบริษัท (แถบชื่อเอกสาร กล่องเลขที่ ตารางยาวถึงยอดรวม ช่องลงนาม 2 ช่องมีโลโก้กลาง)
 *  - sidebar: แถบสีด้านซ้ายเต็มหน้า · centerBand: หัวกึ่งกลาง + แถบชื่อเอกสาร · cards: กล่องการ์ดมุมมน
 * ความสูงกล่องขยายตามฟอนต์ (TH Sarabun ใหญ่กว่า 1.32 เท่า) และเอกสารที่ไม่มียอดเงินไม่มีกล่องยอดรวม
 */
import { A4, FONT_SCALE, defaultFreeLayout, docHasAmounts, type DocTheme, type FreeBlock, type FreeLayout } from "./design";
import { DESIGNABLE_DOCS } from "./build";

type Gen = (docType: string, theme: DocTheme) => FreeBlock[];

/** ผสมสีกับขาว (t = สัดส่วนสีขาว 0–1) สำหรับพื้นการ์ดอ่อน ๆ */
export function tint(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

const docDef = (docType: string) => DESIGNABLE_DOCS.find((d) => d.type === docType);
/** แสดงแถวข้อมูลของเอกสารเฉพาะ keep แถวแรก (ที่เหลือเปิดได้จากรายการ "ข้อมูลในเอกสาร") */
const metaHide = (docType: string, keep: number) => (docDef(docType)?.meta || []).slice(keep).map((l) => `m:${l}`);
/** ความสูงกล่องเลขที่ตามจำนวนแถว (สองภาษา: ป้ายอังกฤษทำให้แถวสูงขึ้น) */
function metaHeight(docType: string, t: DocTheme, keep: number, extraRows = 0, withNumber = true) {
  const rows = (withNumber ? 2 : 1) + Math.min(keep, docDef(docType)?.meta.length || 0) + extraRows;
  return Math.round(rows * (t.bilingual ? 24 : 15) * FONT_SCALE[t.font]) + 8;
}
const twoSignatures = (docType: string) => { const s = docDef(docType)?.signatures || ["ผู้จัดทำ", "ผู้มีอำนาจลงนาม"]; return s.length > 2 ? [s[0], s[s.length - 1]] : s; };

const form: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font], amounts = docHasAmounts(docType);
  const m = 26, W = A4.w - m * 2, R = m + W;
  const fields = (docDef(docType)?.fields || []).map((f) => `f:${f.key}`);
  const infoY = 140, infoH = Math.max(Math.round(84 * k), metaHeight(docType, t, 1, fields.length, false)), itemsY = infoY + infoH + 6;
  const bottomY = amounts ? 634 : 700;
  const blocks: FreeBlock[] = [
    { id: "logo", kind: "logo", x: 30, y: 18, w: 120, h: 84 },
    { id: "seller", kind: "seller", x: 236, y: 18, w: R - 236, h: Math.round(70 * k), align: "right", fontSize: 8, lineHeight: 1.25 },
    { id: "band", kind: "rect", x: 262, y: 94, w: 156, h: 40, bg: t.accent },
    { id: "bandText", kind: "text", x: 262, y: 99, w: 156, h: 30, text: "{{titleEn}}", fontSize: 14, bold: true, color: "#ffffff", align: "center" },
    { id: "titleBox", kind: "rect", x: 418, y: 94, w: R - 418, h: 40, border: t.primary },
    { id: "title", kind: "title", x: 420, y: 95, w: R - 422, h: 18, align: "center", fontSize: 6.5, hide: ["en", "copy"] },
    { id: "titleLine", kind: "line", x: 418, y: 114, w: R - 418, h: 0.6, color: t.primary },
    { id: "number", kind: "field", field: "number", x: 420, y: 116, w: R - 422, h: 16, align: "center", bold: true, hideLabel: true },
    { id: "party", kind: "party", x: m, y: infoY, w: 330, h: infoH, border: t.primary, hide: ["contact", "phone", "email"] },
    { id: "meta", kind: "meta", x: m + 330, y: infoY, w: W - 330, h: infoH, border: t.primary, hide: ["number", ...metaHide(docType, 1)], ...(fields.length ? { fields } : {}) },
    { id: "items", kind: "items", x: m, y: itemsY, w: W, h: bottomY - 4 - itemsY, fill: true },
    ...(amounts ? [
      { id: "words", kind: "words", x: m, y: bottomY, w: 340, h: 20 },
      { id: "notes", kind: "notes", x: m, y: bottomY + 26, w: 340, h: 60 },
      { id: "totals", kind: "totals", x: m + 346, y: bottomY, w: W - 346, h: 96 },
    ] as FreeBlock[] : [{ id: "notes", kind: "notes", x: m, y: bottomY, w: W, h: 36 } as FreeBlock]),
    { id: "signatures", kind: "signatures", x: m, y: 744, w: W, h: 72, gap: 170, labels: twoSignatures(docType), hide: ["date"] },
    { id: "stamp", kind: "logo", x: m + W / 2 - 45, y: 748, w: 90, h: 64 },
  ];
  return blocks;
};

/** ส่วนกลางหน้า (ลูกค้า ตาราง ยอดรวม ลงนาม) ใช้ร่วมหลายแม่แบบ */
function body(docType: string, t: DocTheme, x: number, W: number, partyY: number, opts: { partyBg?: string; metaBesideParty?: { x: number; w: number } } = {}): FreeBlock[] {
  const k = FONT_SCALE[t.font], amounts = docHasAmounts(docType);
  const partyH = Math.max(Math.round((t.formStyle ? 60 : 70) * k), opts.metaBesideParty ? metaHeight(docType, t, 2) : 0);
  const partyW = opts.metaBesideParty ? opts.metaBesideParty.x - x - 8 : W;
  const itemsY = partyY + partyH + 10;
  const bottomY = amounts ? 590 : 670;
  return [
    { id: "party", kind: "party", x, y: partyY, w: partyW, h: partyH, ...(opts.partyBg ? { bg: opts.partyBg } : {}), ...(opts.metaBesideParty && t.formStyle ? { hide: ["contact", "phone", "email"] } : {}) },
    ...(opts.metaBesideParty ? [{ id: "meta", kind: "meta", x: opts.metaBesideParty.x, y: partyY, w: opts.metaBesideParty.w, h: partyH, hide: metaHide(docType, 2), ...(opts.partyBg ? { bg: opts.partyBg } : {}) } as FreeBlock] : []),
    { id: "items", kind: "items", x, y: itemsY, w: W, h: bottomY - 8 - itemsY },
    ...(amounts ? [
      { id: "words", kind: "words", x, y: bottomY, w: W * 0.56, h: 22 },
      { id: "notes", kind: "notes", x, y: bottomY + 28, w: W * 0.56, h: 50 },
      { id: "payment", kind: "payment", x, y: bottomY + 82, w: W * 0.56, h: 22 },
      { id: "totals", kind: "totals", x: x + W * 0.6, y: bottomY, w: W * 0.4, h: 84, ...(opts.partyBg ? { bg: opts.partyBg } : {}) },
    ] as FreeBlock[] : [{ id: "notes", kind: "notes", x, y: bottomY, w: W, h: 30 } as FreeBlock]),
    { id: "signatures", kind: "signatures", x, y: 716, w: W, h: 80 },
  ];
}

const sidebar: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font];
  const x = 46, W = A4.w - x - 30;
  const metaY = 30 + Math.round(66 * k), metaH = metaHeight(docType, t, 2);
  const partyY = Math.max(30 + Math.round(80 * k), metaY + metaH) + 14;
  return [
    { id: "stripe", kind: "rect", x: 0, y: 0, w: 22, h: A4.h, bg: t.primary },
    { id: "logo", kind: "logo", x, y: 30, w: 60, h: 60 },
    { id: "seller", kind: "seller", x: x + 70, y: 30, w: W * 0.55 - 70, h: Math.round(80 * k) },
    { id: "title", kind: "title", x: x + W * 0.55, y: 26, w: W * 0.45, h: Math.round(66 * k), align: "right", fontSize: 12 },
    { id: "meta", kind: "meta", x: x + W * 0.55, y: metaY, w: W * 0.45, h: metaH, hide: metaHide(docType, 2) },
    { id: "rule", kind: "line", x, y: partyY - 8, w: W, h: 1.2, color: t.accent },
    ...body(docType, t, x, W, partyY),
  ];
};

const centerBand: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font];
  const m = 32, W = A4.w - m * 2;
  const sellerH = Math.round(66 * k), bandY = 86 + sellerH + 4, bandH = 30;
  const partyY = bandY + bandH + 10;
  return [
    { id: "logo", kind: "logo", x: (A4.w - 60) / 2, y: 22, w: 60, h: 60 },
    { id: "seller", kind: "seller", x: m + 40, y: 86, w: W - 80, h: sellerH, align: "center" },
    { id: "band", kind: "rect", x: 0, y: bandY, w: A4.w, h: bandH, bg: t.primary },
    { id: "title", kind: "title", x: m, y: bandY + 3, w: W, h: bandH - 4, align: "center", fontSize: 7.5, hide: ["en", "copy"], color: "#ffffff" },
    ...body(docType, t, m, W, partyY, { metaBesideParty: { x: m + W * 0.62, w: W * 0.38 } }),
  ];
};

const cards: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font];
  const m = 32, W = A4.w - m * 2;
  const soft = tint(t.accent, 0.9);
  const partyY = 30 + Math.round(80 * k) + 12;
  return [
    { id: "logo", kind: "logo", x: m, y: 30, w: 60, h: 60 },
    { id: "seller", kind: "seller", x: m + 70, y: 30, w: W * 0.56 - 70, h: Math.round(80 * k) },
    { id: "title", kind: "title", x: m + W * 0.56, y: 30, w: W * 0.44, h: Math.round(70 * k), align: "right", fontSize: 11 },
    ...body(docType, t, m, W, partyY, { partyBg: soft, metaBesideParty: { x: m + W * 0.6, w: W * 0.4 } }),
  ];
};

export const LAYOUT_TEMPLATES: Record<string, Gen> = { form, sidebar, centerBand, cards };

/** ผังของแม่แบบสำหรับเอกสารชนิดนี้ (ไม่มีผังเฉพาะ = ผังมาตรฐาน) */
export function templateLayout(layoutId: string | undefined, docType: string, theme: DocTheme): FreeLayout {
  const gen = layoutId ? LAYOUT_TEMPLATES[layoutId] : undefined;
  return gen ? { enabled: true, blocks: gen(docType, theme) } : { ...defaultFreeLayout(docType, theme.font, docDef(docType)?.meta), enabled: true };
}
