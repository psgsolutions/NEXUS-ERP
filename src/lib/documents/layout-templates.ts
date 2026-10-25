/**
 * ผังลากวางสำเร็จรูปของแม่แบบ (ฟังก์ชันล้วน) — เลือกแม่แบบแล้วเอกสารทุกชนิดได้ผังนี้ ลากปรับต่อได้อิสระ
 * แบ่งเป็นตระกูลผัง (ARCHETYPES ใน design.ts) อ้างอิงรูปแบบที่พบบ่อยในแม่แบบเอกสารธุรกิจ:
 *   มาตรฐาน · ฟอร์มสองภาษา · แถบข้าง · หัวกลาง · การ์ด · หัวแถบสีเต็ม · หัวแบ่งสองฝั่ง · มินิมอลเส้นบาง
 *   · กรอบทั้งหน้า · แถบท้ายกระดาษ · โลโก้ขวา · กะทัดรัด
 * กติกา: โลโก้มีจุดเดียวบนหัวกระดาษ · แถบสีที่ชนขอบกระดาษเป็นมุมเหลี่ยม · สีของแถบ/กรอบ/เส้นใช้สีอ้างอิงธีม (@primary @accent @soft @line)
 * เปลี่ยนชุดสีแล้วทุกส่วนเปลี่ยนตามกัน · ความสูงกล่องขยายตามฟอนต์ · เอกสารที่ไม่มียอดเงินไม่มีกล่องยอดรวม
 * ทุกแม่แบบปรับตามชนิดเอกสาร (tailor): กล่องข้อมูลเฉพาะ (เช่น ใบเสร็จ: รายละเอียดการชำระเงิน · ใบวางบิล: กำหนดชำระ)
 * และข้อความรับรองเหนือช่องลงนาม (เช่น ใบส่งของ: ได้รับสินค้าครบถ้วน) — หน้าตาตามธีมเดิม เนื้อหาตามเอกสารนั้น
 */
import { A4, FONT_SCALE, defaultFreeLayout, docHasAmounts, tint, type DocTheme, type FreeBlock, type FreeLayout } from "./design";
import { DESIGNABLE_DOCS } from "./build";

export { tint };
type Gen = (docType: string, theme: DocTheme) => FreeBlock[];

const docDef = (docType: string) => DESIGNABLE_DOCS.find((d) => d.type === docType);
/** แสดงแถวข้อมูลของเอกสารเฉพาะ keep แถวแรก (ที่เหลือเปิดได้จากรายการ "ข้อมูลในเอกสาร") */
const metaHide = (docType: string, keep: number) => (docDef(docType)?.meta || []).slice(keep).map((l) => `m:${l}`);
/** ความสูงกล่องเลขที่ตามจำนวนแถว (สองภาษา: ป้ายอังกฤษทำให้แถวสูงขึ้น) */
function metaHeight(docType: string, t: DocTheme, keep: number, extraRows = 0, withNumber = true) {
  const rows = (withNumber ? 2 : 1) + Math.min(keep, docDef(docType)?.meta.length || 0) + extraRows;
  return Math.round(rows * (t.bilingual ? 24 : 15) * FONT_SCALE[t.font]) + 8;
}
const twoSignatures = (docType: string) => { const s = docDef(docType)?.signatures || ["ผู้จัดทำ", "ผู้มีอำนาจลงนาม"]; return s.length > 2 ? [s[0], s[s.length - 1]] : s; };
const M = 32, W0 = A4.w - M * 2;

const form: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font], amounts = docHasAmounts(docType);
  const m = 26, W = A4.w - m * 2, R = m + W;
  const fields = (docDef(docType)?.fields || []).map((f) => `f:${f.key}`);
  const infoY = 140, infoH = Math.max(Math.round(84 * k), metaHeight(docType, t, 1, fields.length, false)), itemsY = infoY + infoH + 6;
  const bottomY = amounts ? 634 : 700;
  return [
    { id: "logo", kind: "logo", x: 30, y: 18, w: 120, h: 84 },
    { id: "seller", kind: "seller", x: 236, y: 18, w: R - 236, h: Math.round(70 * k), align: "right", fontSize: 8, lineHeight: 1.25 },
    { id: "band", kind: "rect", x: 262, y: 94, w: 156, h: 40, bg: "@accent" },
    { id: "bandText", kind: "text", x: 262, y: 99, w: 156, h: 30, text: "{{titleEn}}", fontSize: 14, bold: true, color: "#ffffff", align: "center" },
    { id: "titleBox", kind: "rect", x: 418, y: 94, w: R - 418, h: 40, border: "@primary" },
    { id: "title", kind: "title", x: 420, y: 95, w: R - 422, h: 18, align: "center", fontSize: 6.5, hide: ["en", "copy"] },
    { id: "titleLine", kind: "line", x: 418, y: 114, w: R - 418, h: 0.6, color: "@primary" },
    { id: "number", kind: "field", field: "number", x: 420, y: 116, w: R - 422, h: 16, align: "center", bold: true, hideLabel: true },
    { id: "party", kind: "party", x: m, y: infoY, w: 330, h: infoH, border: "@primary", hide: ["contact", "phone", "email"] },
    { id: "meta", kind: "meta", x: m + 330, y: infoY, w: W - 330, h: infoH, border: "@primary", hide: ["number", ...metaHide(docType, 1)], ...(fields.length ? { fields } : {}) },
    { id: "items", kind: "items", x: m, y: itemsY, w: W, h: bottomY - 4 - itemsY, fill: true },
    ...(amounts ? [
      { id: "words", kind: "words", x: m, y: bottomY, w: 340, h: 20 },
      { id: "notes", kind: "notes", x: m, y: bottomY + 26, w: 340, h: 60 },
      { id: "totals", kind: "totals", x: m + 346, y: bottomY, w: W - 346, h: 96 },
    ] as FreeBlock[] : [{ id: "notes", kind: "notes", x: m, y: bottomY, w: W, h: 36 } as FreeBlock]),
    { id: "signatures", kind: "signatures", x: m, y: 744, w: W, h: 72, gap: 60, labels: twoSignatures(docType), hide: ["date"] },
  ];
};

/** ส่วนกลางหน้า (ลูกค้า ตาราง ยอดรวม ลงนาม) ใช้ร่วมหลายแม่แบบ */
function body(docType: string, t: DocTheme, x: number, W: number, partyY: number, opts: { partyBg?: string; metaBesideParty?: { x: number; w: number }; signY?: number; bottomY?: number } = {}): FreeBlock[] {
  const k = FONT_SCALE[t.font], amounts = docHasAmounts(docType);
  // ลูกค้า 3 แถว (ชื่อ เลขผู้เสียภาษี ที่อยู่) — สองภาษามีป้ายอังกฤษใต้ป้าย แถวสูงขึ้น
  const partyRows = Math.round(3 * (t.bilingual ? 25 : 16) * k) + (t.formStyle ? 16 : 30);
  const partyH = Math.max(Math.round((t.formStyle ? 60 : 70) * k), partyRows, opts.metaBesideParty ? metaHeight(docType, t, 2) : 0);
  const partyW = opts.metaBesideParty ? opts.metaBesideParty.x - x - 8 : W;
  const itemsY = partyY + partyH + 10;
  const bottomY = opts.bottomY ?? (amounts ? 590 : 670);
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
    { id: "signatures", kind: "signatures", x, y: opts.signY ?? 716, w: W, h: 80 },
  ];
}

/** หัวเอกสารแบบโลโก้+บริษัทฝั่งหนึ่ง ชื่อเอกสาร+เลขที่อีกฝั่ง (mirror = โลโก้ขวา) */
function header(docType: string, t: DocTheme, opts: { mirror?: boolean; titleSize?: number; x?: number; W?: number; logo?: number; small?: boolean } = {}) {
  const k = FONT_SCALE[t.font], x = opts.x ?? M, W = opts.W ?? W0, lg = opts.logo ?? 60;
  const sellerH = Math.round((opts.small ? 60 : 80) * k), titleH = Math.round((opts.titleSize ? 50 + opts.titleSize * 2 : 66) * k);
  const metaY = 28 + titleH, metaH = metaHeight(docType, t, 2);
  const leftW = W * 0.56, rightW = W * 0.44;
  const blocks: FreeBlock[] = opts.mirror ? [
    { id: "logo", kind: "logo", x: x + W - lg, y: 28, w: lg, h: lg },
    { id: "seller", kind: "seller", x: x + rightW, y: 26, w: leftW - lg - 10, h: sellerH, align: "right", ...(opts.small ? { fontSize: 8 } : {}) },
    { id: "title", kind: "title", x, y: 26, w: rightW, h: titleH, align: "left", ...(opts.titleSize ? { fontSize: opts.titleSize } : {}) },
    { id: "meta", kind: "meta", x, y: metaY, w: rightW, h: metaH, align: "left", hide: metaHide(docType, 2) },
  ] : [
    { id: "logo", kind: "logo", x, y: 28, w: lg, h: lg },
    { id: "seller", kind: "seller", x: x + lg + 10, y: 26, w: leftW - lg - 10, h: sellerH, ...(opts.small ? { fontSize: 8 } : {}) },
    { id: "title", kind: "title", x: x + leftW, y: 26, w: rightW, h: titleH, align: "right", ...(opts.titleSize ? { fontSize: opts.titleSize } : {}) },
    { id: "meta", kind: "meta", x: x + leftW, y: metaY, w: rightW, h: metaH, hide: metaHide(docType, 2) },
  ];
  return { blocks, bottom: Math.max(26 + sellerH, metaY + metaH) };
}

const standard: Gen = (docType, t) => defaultFreeLayout(docType, t.font, docDef(docType)?.meta).blocks;

const sidebar: Gen = (docType, t) => {
  const x = 46, W = A4.w - x - 30;
  const h = header(docType, t, { x, W, titleSize: 12 });
  return [{ id: "stripe", kind: "rect", x: 0, y: 0, w: 22, h: A4.h, bg: "@primary", radius: 0 }, ...h.blocks,
    { id: "rule", kind: "line", x, y: h.bottom + 6, w: W, h: 1.2, color: "@accent" }, ...body(docType, t, x, W, h.bottom + 14)];
};

const centerBand: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font];
  const sellerH = Math.round(66 * k), bandY = 86 + sellerH + 4, bandH = 30;
  return [
    { id: "logo", kind: "logo", x: (A4.w - 60) / 2, y: 22, w: 60, h: 60 },
    { id: "seller", kind: "seller", x: M + 40, y: 86, w: W0 - 80, h: sellerH, align: "center" },
    { id: "band", kind: "rect", x: 0, y: bandY, w: A4.w, h: bandH, bg: "@primary", radius: 0 },
    { id: "title", kind: "title", x: M, y: bandY + 3, w: W0, h: bandH - 4, align: "center", fontSize: 7.5, hide: ["en", "copy"], color: "#ffffff" },
    ...body(docType, t, M, W0, bandY + bandH + 10, { metaBesideParty: { x: M + W0 * 0.62, w: W0 * 0.38 } }),
  ];
};

const cards: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font];
  return [
    { id: "logo", kind: "logo", x: M, y: 30, w: 60, h: 60 },
    { id: "seller", kind: "seller", x: M + 70, y: 30, w: W0 * 0.56 - 70, h: Math.round(80 * k) },
    { id: "title", kind: "title", x: M + W0 * 0.56, y: 30, w: W0 * 0.44, h: Math.round(70 * k), align: "right", fontSize: 11 },
    ...body(docType, t, M, W0, 30 + Math.round(80 * k) + 12, { partyBg: "@soft", metaBesideParty: { x: M + W0 * 0.6, w: W0 * 0.4 } }),
  ];
};

/** หัวแถบสีเต็มความกว้าง ตัวอักษรขาว */
const banner: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font], bandH = Math.round(104 * k);
  return [
    { id: "band", kind: "rect", x: 0, y: 0, w: A4.w, h: bandH, bg: "@primary", radius: 0 },
    { id: "logo", kind: "logo", x: M, y: 20, w: 64, h: 64 },
    { id: "seller", kind: "seller", x: M + 74, y: 16, w: W0 * 0.58 - 74, h: bandH - 20, color: "#ffffff" },
    { id: "title", kind: "title", x: M + W0 * 0.58, y: 18, w: W0 * 0.42, h: bandH - 24, align: "right", color: "#ffffff" },
    ...body(docType, t, M, W0, bandH + 14, { metaBesideParty: { x: M + W0 * 0.62, w: W0 * 0.38 } }),
  ];
};

/** หัวแบ่งสองฝั่ง: ซ้ายบล็อกสีชื่อเอกสาร+เลขที่ ขวาโลโก้+บริษัท */
const split: Gen = (docType, t) => {
  const k = FONT_SCALE[t.font], bw = Math.round(A4.w * 0.42), titleH = Math.round(40 * k), metaH = metaHeight(docType, t, 1);
  const blockH = Math.max(Math.round(120 * k), 26 + titleH + metaH + 10);
  return [
    { id: "block", kind: "rect", x: 0, y: 0, w: bw, h: blockH, bg: "@primary", radius: 0 },
    { id: "title", kind: "title", x: M, y: 22, w: bw - M - 12, h: titleH, align: "left", color: "#ffffff", fontSize: 11, hide: ["copy"] },
    { id: "meta", kind: "meta", x: M, y: 26 + titleH, w: bw - M - 12, h: metaH, align: "left", color: "#ffffff", hide: metaHide(docType, 1) },
    { id: "logo", kind: "logo", x: bw + 20, y: 24, w: 56, h: 56 },
    { id: "seller", kind: "seller", x: bw + 84, y: 22, w: A4.w - bw - 84 - M, h: blockH - 30, fontSize: 8.5 },
    ...body(docType, t, M, W0, blockH + 14),
  ];
};

/** มินิมอลเส้นบาง: ไม่มีกรอบ ใช้เส้นสีเส้นธีมแบ่งส่วน */
const minimalLine: Gen = (docType, t) => {
  const h = header(docType, t, { logo: 48, titleSize: 11 });
  const b = body(docType, t, M, W0, h.bottom + 16).map((x) => (x.kind === "party" ? { ...x, partyStyle: "plain" as const } : x));
  return [...h.blocks, { id: "rule1", kind: "line", x: M, y: h.bottom + 6, w: W0, h: 0.6, color: "@line" }, ...b,
    { id: "rule2", kind: "line", x: M, y: 706, w: W0, h: 0.6, color: "@line" }];
};

/** กรอบทั้งหน้า (แบบฟอร์มทางการ) */
const frame: Gen = (docType, t) => {
  const inner = defaultFreeLayout(docType, t.font, docDef(docType)?.meta).blocks;
  const party = inner.find((b) => b.kind === "party")!;
  return [
    { id: "frame", kind: "rect", x: 16, y: 16, w: A4.w - 32, h: A4.h - 44, border: "@primary", borderWidth: 1.4, radius: t.rounded ? 8 : 0 },
    { id: "rule", kind: "line", x: 16, y: party.y - 6, w: A4.w - 32, h: 0.8, color: "@primary" },
    ...inner,
  ];
};

/** แถบท้ายกระดาษสีหลัก พร้อมข้อมูลติดต่อบริษัท */
const footerBand: Gen = (docType, t) => {
  const h = header(docType, t);
  return [...h.blocks, ...body(docType, t, M, W0, h.bottom + 12, { signY: 682, bottomY: docHasAmounts(docType) ? 570 : 640 }),
    { id: "foot", kind: "rect", x: 0, y: 770, w: A4.w, h: 32, bg: "@primary", radius: 0 },
    { id: "footText", kind: "text", x: M, y: 778, w: W0, h: 18, text: "{{seller.name}}  ·  โทร {{seller.phone}}  ·  {{seller.email}}", fontSize: 8.5, color: "#ffffff", align: "center" },
  ];
};

/** โลโก้และบริษัทชิดขวา ชื่อเอกสารชิดซ้าย */
const mirror: Gen = (docType, t) => {
  const h = header(docType, t, { mirror: true, titleSize: 11 });
  return [...h.blocks, { id: "rule", kind: "line", x: M, y: h.bottom + 6, w: W0, h: 1, color: "@primary" }, ...body(docType, t, M, W0, h.bottom + 14)];
};

/** กะทัดรัด: หัวเล็ก ตารางยาว (เอกสารรายการเยอะ) */
const compact: Gen = (docType, t) => {
  const h = header(docType, t, { logo: 40, small: true, titleSize: 8.5 });
  return [...h.blocks, ...body(docType, t, M, W0, h.bottom + 8, { metaBesideParty: undefined }).map((b) => (b.kind === "party" ? { ...b, fontSize: 8.5 } : b))];
};

/** ส่วนเฉพาะของเอกสารแต่ละชนิด: กล่องข้อมูล (แถวที่ย้ายออกจากกล่องเลขที่) · บัญชีรับเงิน · ข้อความรับรองเหนือช่องลงนาม */
/** ack.slot = ช่องลงนามที่ข้อความนี้เป็นของ (ลำดับ · -1 = ช่องสุดท้าย) */
export const DOC_PARTS: Record<string, { box?: string[]; payment?: boolean; ack?: { text: string; slot: number } }> = {
  quotation: { box: ["f:paymentTerms", "f:delivery"], payment: true, ack: { text: "ยืนยันการสั่งซื้อตามรายการและเงื่อนไขข้างต้น", slot: -1 } },
  sales_order: { box: ["m:เครดิต"], payment: true },
  invoice: { payment: true, ack: { text: "ได้รับสินค้า/บริการตามรายการข้างต้นไว้ถูกต้องแล้ว", slot: 0 } },
  billing_note: { box: ["m:กำหนดชำระ", "m:เลขที่ใบสั่งซื้อ"], payment: true, ack: { text: "ได้รับใบวางบิลไว้ตรวจสอบแล้ว  นัดชำระ/รับเช็ค ......../......../........", slot: -1 } },
  receipt: { box: ["m:ชำระโดย", "m:บัญชี", "m:เช็คเลขที่", "m:อ้างอิง"] },
  delivery_note: { ack: { text: "ได้รับสินค้าตามรายการข้างต้นถูกต้องในสภาพเรียบร้อย", slot: 1 } },
  cndn: { box: ["m:อ้างอิงใบกำกับ", "m:ลงวันที่"] },
  purchase_order: { box: ["m:กำหนดส่ง", "m:ส่งที่คลัง", "m:เงื่อนไขชำระ"], ack: { text: "ยืนยันรับคำสั่งซื้อตามรายการและเงื่อนไขข้างต้น", slot: -1 } },
  payment: { box: ["m:จ่ายโดย", "m:บัญชี", "m:เช็คเลขที่", "m:อ้างอิง"], ack: { text: "ได้รับเงินตามรายการข้างต้นถูกต้องแล้ว", slot: -1 } },
};

/**
 * ปรับผังของแม่แบบให้เป็นเอกสารชนิดนั้น: วางกล่องข้อมูลเฉพาะในคอลัมน์ซ้ายใต้จำนวนเงินตัวอักษร (ต่อด้วยหมายเหตุ บัญชีรับเงิน)
 * ย้ายแถวที่อยู่ในกล่องออกจากกล่องเลขที่ · ข้อความรับรองเหนือช่องลงนาม
 */
export function tailor(docType: string, t: DocTheme, blocks: FreeBlock[]): FreeBlock[] {
  const part = DOC_PARTS[docType];
  if (!part) return blocks;
  const def = docDef(docType);
  const known = new Set([...(def?.meta || []).map((l) => `m:${l}`), ...(def?.fields || []).map((x) => `f:${x.key}`)]);
  const fields = (part.box || []).filter((k) => known.has(k));
  const sign = blocks.find((b) => b.kind === "signatures");
  const notes = blocks.find((b) => b.kind === "notes");
  const pay = blocks.find((b) => b.kind === "payment");
  let out = blocks.filter((b) => b !== notes && b !== pay);
  const extra: FreeBlock[] = [];
  const limit = sign ? sign.y - (part.ack ? 26 : 6) : A4.h - 40;
  if (notes) {
    const k = FONT_SCALE[t.font], row = Math.round((t.bilingual ? 24 : 15) * k);
    const boxH = fields.length ? fields.length * row + 8 : 0;
    const payH = part.payment && pay ? pay.h : 0;
    // ที่ไม่พอ: ยกส่วนท้าย (จำนวนเงินตัวอักษร ยอดรวม หมายเหตุ ฯลฯ) ขึ้น และลดความสูงตาราง
    const deficit = (boxH ? boxH + 4 : 0) + 18 + (payH ? payH + 4 : 0) - (limit - notes.y);
    const items = out.find((b) => b.kind === "items");
    let top = notes.y;
    if (deficit > 0 && items && items.h - deficit >= 120) {
      const itemsEnd = items.y + items.h;
      out = out.map((b) => (b === items ? { ...b, h: b.h - deficit } : b.y >= itemsEnd - 1 && b.y < limit && b.kind !== "signatures" ? { ...b, y: b.y - deficit } : b));
      top -= deficit;
    }
    const bottom = Math.max(limit, top + 40);
    let y = top;
    if (fields.length) {
      extra.push({ id: "docInfo", kind: "info", x: notes.x, y, w: notes.w, h: boxH, fields, labelWidth: 100, border: "@line", radius: t.rounded ? 4 : 0, fontSize: Math.max(7.5, t.fontSize - 1) });
      y += boxH + 4;
    }
    const notesH = Math.max(16, bottom - y - (payH ? payH + 4 : 0));
    extra.push({ ...notes, y, h: notesH, x: notes.x });
    if (payH) extra.push({ ...pay!, y: y + notesH + 4 });
    // แถวที่อยู่ในกล่องข้อมูลแล้ว ไม่แสดงซ้ำในกล่องเลขที่
    const moved = fields.filter((x) => x.startsWith("m:"));
    out = out.map((b) => (b.kind === "meta" && moved.length ? { ...b, hide: [...new Set([...(b.hide || []), ...moved])] } : b));
  }
  if (part.ack && sign) {
    // เหนือช่องลงนามของผู้รับรอง (ช่องเท่ากันตามจำนวนช่องในแม่แบบ)
    const n = Math.max(1, (sign.labels?.length || def?.signatures.length || 2));
    const i = part.ack.slot < 0 ? n - 1 : Math.min(n - 1, part.ack.slot), w = sign.w / n;
    extra.push({ id: "ack", kind: "text", x: sign.x + i * w, y: sign.y - 24, w, h: 22, text: part.ack.text, fontSize: 8, align: "center", color: "@primary" });
  }
  return [...out, ...extra];
}

export const LAYOUT_TEMPLATES: Record<string, Gen> = { standard, form, sidebar, centerBand, cards, banner, split, minimalLine, frame, footerBand, mirror, compact };

/** ผังของแม่แบบสำหรับเอกสารชนิดนี้ (ไม่มีผังเฉพาะ = ผังมาตรฐาน) */
export function templateLayout(layoutId: string | undefined, docType: string, theme: DocTheme): FreeLayout {
  const gen = (layoutId && LAYOUT_TEMPLATES[layoutId]) || standard;
  return { enabled: true, blocks: tailor(docType, theme, gen(docType, theme)) };
}
