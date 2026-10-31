/**
 * "ข้อมูลที่แสดงในเอกสาร" แบบรายการติ๊กเดียว (ฟังก์ชันล้วน) — ใช้ทั้งหน้าออกแบบแบบง่ายและแบบลากวาง
 * ติ๊ก = ข้อมูลนี้ปรากฏบนเอกสาร ไม่ว่าจะอยู่ในกล่องไหน (กล่องเลขที่ · กล่องข้อมูล · ช่องข้อมูลเดี่ยว)
 * เปิด: ใส่ในกล่องที่เหมาะที่สุดที่มีอยู่ · ปิด: เอาออกจากทุกกล่อง · ข้อมูลที่กฎหมายกำหนดล็อกไว้
 */
import { A4, CORE_TOTALS, TEMPLATES, totalsBlockHeight, type DocumentDesign, docHasAmounts, docHasCopy, defaultFreeLayout, requiredColumnsFor, resolveColumns, type BlockKind, type ColumnSpec, type DocTheme, type FreeBlock, type FreeLayout, type ItemColumn, ITEM_COLUMNS } from "./design";
import { templateLayout } from "./layout-templates";
import { sampleModelFor } from "./build";

export interface DataItem { key: string; label: string; on: boolean; locked?: boolean }
export interface DataGroup { id: string; title: string; source: string; kinds: BlockKind[]; items: DataItem[] }
export interface DataContext {
  docType: string; docTitle: string;
  meta: string[]; fields: { key: string; label: string }[];
  columns: ItemColumn[];
  /** แถวยอดเงินที่เลือกซ่อนได้ (ไม่รวม VAT/ยอดรวมทั้งสิ้น) */
  totals: string[];
  /** กล่องในหัวกระดาษที่ใช้อยู่ (นับว่าแสดงแล้ว แก้ที่หัวกระดาษ) */
  head?: FreeBlock[];
}

/** แม่แบบที่ไม่มีผังของตัวเอง: ใช้ผังที่ใกล้เคียงหัวเอกสารของแม่แบบ (ไม่มีโหมดจัดอัตโนมัติแยกอีก) */
export function layoutIdFor(templateId: string | undefined, theme?: DocTheme): string {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (t?.layout) return t.layout;
  const header = (theme || t?.theme)?.header;
  return header === "centered" ? "centerBand" : header === "banner" ? "banner" : header === "logo-right" ? "mirror" : "standard";
}
/** ผังของเอกสาร (ยังไม่เคยจัด = สร้างจากแม่แบบที่ใช้อยู่) */
export function ensureLayout(free: FreeLayout | undefined, docType: string, theme: DocTheme): FreeLayout {
  return free?.enabled && free.blocks.length ? free : templateLayout(layoutIdFor(theme.templateId, theme), docType, theme);
}

// ชื่อเรียกข้อมูลย่อยของผู้ขาย/ลูกค้า
const SELLER = [["nameEn", "seller.nameEn", "ชื่อภาษาอังกฤษ"], ["contact", "seller.contact", "โทร · อีเมล · เว็บไซต์"]] as const;
const PARTY = [["contact", "customer.contact", "ชื่อผู้ติดต่อ"], ["phone", "customer.phone", "โทรศัพท์"], ["email", "customer.email", "อีเมล"]] as const;

const all = (l: FreeLayout, c: DataContext) => [...(c.head || []), ...l.blocks];
/** ข้อมูล (คีย์ช่องข้อมูล) ปรากฏในกล่องใดกล่องหนึ่ง */
function fieldShown(blocks: FreeBlock[], key: string): boolean {
  return blocks.some((b) =>
    (b.kind === "meta" && (key.startsWith("f:") ? (b.fields || []).includes(key) : (key === "number" || key === "date" || key.startsWith("m:")) && !(b.hide || []).includes(key)))
    || (b.kind === "field" && b.field === key) || (b.kind === "info" && (b.fields || []).includes(key)));
}
function partShown(blocks: FreeBlock[], kind: BlockKind, part: string, field: string) {
  return blocks.some((b) => b.kind === kind && !(b.hide || []).includes(part)) || fieldShown(blocks, field);
}

export function dataGroups(layout: FreeLayout, c: DataContext): DataGroup[] {
  const blocks = all(layout, c);
  const has = (k: BlockKind) => blocks.some((b) => b.kind === k);
  const title = blocks.find((b) => b.kind === "title");
  const items = layout.blocks.find((b) => b.kind === "items");
  const cols = resolveColumns(items, c.columns).map((x) => x.key);
  const req = requiredColumnsFor(c.docType);
  const totals = layout.blocks.find((b) => b.kind === "totals");
  const sign = blocks.find((b) => b.kind === "signatures");
  return [
    { id: "doc", title: `ข้อมูล${c.docTitle}`, source: `ดึงจาก ${c.docTitle} ที่บันทึกในระบบ`, kinds: ["title", "meta", "field", "info"], items: [
      { key: "doc:number", label: "เลขที่", on: true, locked: true },
      { key: "doc:date", label: "วันที่", on: true, locked: true },
      ...c.meta.map((l) => ({ key: `doc:m:${l}`, label: l, on: fieldShown(blocks, `m:${l}`) })),
      ...c.fields.map((f) => ({ key: `doc:f:${f.key}`, label: f.label, on: fieldShown(blocks, `f:${f.key}`) })),
      { key: "title:en", label: "ชื่อเอกสารภาษาอังกฤษ", on: !!title && !(title.hide || []).includes("en") || fieldShown(blocks, "titleEn") },
      // ต้นฉบับ/สำเนา: เอกสารที่ต้องมี = แสดงเสมอ · เอกสารอื่นไม่มีตัวเลือกนี้
      ...(docHasCopy(c.docType) ? [{ key: "title:copy", label: "ป้ายต้นฉบับ/สำเนา", on: true, locked: true }] : []),
    ] },
    { id: "seller", title: "บริษัท (ผู้ขาย)", source: "ดึงจาก ตั้งค่า › ข้อมูลนิติบุคคล", kinds: ["logo", "seller", "info", "field"], items: [
      { key: "block:logo", label: "โลโก้", on: has("logo") },
      { key: "seller:name", label: "ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา", on: true, locked: true },
      ...SELLER.map(([p, f, label]) => ({ key: `seller:${p}`, label, on: partShown(blocks, "seller", p, f) })),
    ] },
    { id: "party", title: "ลูกค้า / คู่ค้า", source: "ดึงจาก ลูกค้าที่เลือกในเอกสาร", kinds: ["party", "info", "field"], items: [
      { key: "party:name", label: "ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา", on: true, locked: true },
      ...PARTY.map(([p, f, label]) => ({ key: `party:${p}`, label, on: partShown(blocks, "party", p, f) })),
    ] },
    ...(items ? [{ id: "items", title: "ตารางรายการ", source: "ดึงจาก รายการสินค้า/บริการในเอกสาร", kinds: ["items"] as BlockKind[], items: [
      ...ITEM_COLUMNS.map((x) => ({ key: `col:${x.key}`, label: x.label, on: cols.includes(x.key), locked: req.includes(x.key) })),
      ...(!cols.includes("detail") ? [{ key: "items:detail", label: "รายละเอียดใต้รายการ", on: !(items.hide || []).includes("detail") }] : []),
      { key: "items:heading", label: "หัวข้อหมวด", on: !(items.hide || []).includes("heading") },
    ] }] : []),
    ...(totals ? [{ id: "totals", title: "ยอดเงิน", source: "คำนวณจากรายการ ส่วนลด และภาษี", kinds: ["totals"] as BlockKind[], items: [
      // ข้อมูลหลัก แสดงเสมอ (ไม่มีช่องติ๊ก) · แถวอื่นติ๊กเพิ่มตามฟอร์มที่บริษัทต้องการ
      ...CORE_TOTALS.map((l) => ({ key: `total-core:${l}`, label: l, on: true, locked: true })),
      ...c.totals.map((l) => ({ key: `total:${l}`, label: l, on: !(totals.hide || []).includes(`t:${l}`) })),
    ] }] : []),
    // จำนวนเงินตัวอักษร: กล่องแยกจากตารางยอดรวม (วาง/ซ่อนเองได้ ไม่ผูกกับยอดรวม)
    ...(docHasAmounts(c.docType) ? [{ id: "words", title: "จำนวนเงินตัวอักษร", source: "ยอดรวมทั้งสิ้นเป็นตัวอักษร (คำนวณจากรายการ)", kinds: ["words"] as BlockKind[], items: [
      { key: "block:words", label: "แสดงจำนวนเงินตัวอักษร", on: has("words") },
    ] }] : []),
    { id: "foot", title: "ท้ายเอกสาร", source: "หมายเหตุจากเอกสาร · บัญชีรับเงินจากข้อมูลนิติบุคคล", kinds: ["notes", "payment", "signatures", "stamp", "sign"], items: [
      { key: "block:notes", label: "หมายเหตุ", on: has("notes") },
      { key: "block:payment", label: "ข้อมูลการชำระเงิน (บัญชีธนาคาร)", on: has("payment") },
      { key: "block:signatures", label: "ช่องลงนาม", on: has("signatures") },
      ...(sign ? [{ key: "sign:date", label: "บรรทัดวันที่ใต้ลายเซ็น", on: !(sign.hide || []).includes("date") }] : []),
    ] },
  ];
}

const uid = (kind: string) => `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const toggleHide = (b: FreeBlock, part: string, show: boolean): FreeBlock => {
  const hide = new Set(b.hide || []);
  if (show) hide.delete(part); else hide.add(part);
  return { ...b, hide: [...hide] };
};

/** เปิด/ปิดข้อมูล (คีย์จาก dataGroups) — คืนผังใหม่ (ไม่แก้กล่องในหัวกระดาษ) */
export function toggleData(layout: FreeLayout, key: string, on: boolean, c: DataContext): FreeLayout {
  let blocks = [...layout.blocks];
  const set = (fn: (b: FreeBlock) => FreeBlock | null) => { blocks = blocks.map(fn).filter((b): b is FreeBlock => !!b); };
  const def = (kind: BlockKind) => defaultFreeLayout(c.docType).blocks.find((b) => b.kind === kind);

  /** ช่องข้อมูล: ปิด = เอาออกทุกที่ · เปิด = กล่องที่เหมาะ (กล่องเลขที่ → กล่องข้อมูลกลุ่มเดียวกัน → ช่องเดี่ยวใหม่) */
  const field = (k: string, prefer: BlockKind | null, sameGroup: (x: string) => boolean) => {
    if (!on) {
      set((b) => (b.kind === "field" && b.field === k ? null
        : b.kind === "info" ? { ...b, fields: (b.fields || []).filter((x) => x !== k) }
        : b.kind === "meta" ? (k.startsWith("f:") ? { ...b, fields: (b.fields || []).filter((x) => x !== k) } : k.startsWith("m:") ? toggleHide(b, k, false) : b) : b));
      return;
    }
    if (fieldShown([...(c.head || []), ...blocks], k)) return;
    const meta = blocks.find((b) => b.kind === "meta");
    if (prefer === "meta" && meta) { set((b) => (b !== meta ? b : k.startsWith("f:") ? { ...b, fields: [...(b.fields || []), k] } : toggleHide(b, k, true))); return; }
    const info = blocks.find((b) => b.kind === "info" && (b.fields || []).some(sameGroup));
    if (info) { set((b) => (b === info ? { ...b, fields: [...(b.fields || []), k] } : b)); return; }
    const anchor = blocks.find((b) => b.kind === (prefer || "meta")) || meta;
    blocks.push({ id: uid("field"), kind: "field", field: k, x: anchor?.x ?? 360, y: Math.min(A4.h - 30, (anchor ? anchor.y + anchor.h + 2 : 150)), w: anchor?.w ?? 200, h: 16 });
  };
  const docKey = (x: string) => x === "number" || x === "date" || x.startsWith("m:") || x.startsWith("f:");
  const part = (kind: BlockKind, p: string, f: string, prefix: string) => {
    const box = blocks.find((b) => b.kind === kind);
    if (box) { set((b) => (b === box ? toggleHide(b, p, on) : b)); if (!on) field(f, null, () => false); return; }
    field(f, kind, (x) => x.startsWith(prefix));
  };

  const [group, rest] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (group === "doc") field(rest, "meta", docKey);
  else if (group === "title") set((b) => (b.kind === "title" ? toggleHide(b, rest, on) : b));
  else if (group === "seller") { const p = SELLER.find((x) => x[0] === rest); if (p) part("seller", p[0], p[1], "seller."); }
  else if (group === "party") { const p = PARTY.find((x) => x[0] === rest); if (p) part("party", p[0], p[1], "customer."); }
  else if (group === "items" || group === "sign") { const kind: BlockKind = group === "items" ? "items" : "signatures"; set((b) => (b.kind === kind ? toggleHide(b, rest, on) : b)); }
  else if (group === "total") set((b) => (b.kind === "totals" ? toggleHide(b, `t:${rest}`, on) : b));
  else if (group === "col") {
    const items = blocks.find((b) => b.kind === "items");
    if (items) {
      const spec = resolveColumns(items, c.columns), k = rest as ItemColumn;
      let next: ColumnSpec[] = spec.filter((x) => x.key !== k);
      if (on) {
        const at = k === "no" ? 0 : k === "code" ? Math.max(0, next.findIndex((x) => x.key === "description")) : k === "detail" ? next.findIndex((x) => x.key === "description") + 1 : next.some((x) => x.key === "amount") && k !== "amount" ? next.findIndex((x) => x.key === "amount") : next.length;
        next = [...next.slice(0, at), { key: k }, ...next.slice(at)];
      }
      set((b) => { if (b !== items) return b; const n: FreeBlock = { ...b, colSpec: next }; delete n.cols; return n; });
    }
  } else if (group === "block") {
    const kind = rest as BlockKind;
    if (!on) set((b) => (b.kind === kind ? null : b));
    else if (!blocks.some((b) => b.kind === kind)) { const d = def(kind); blocks.push({ ...(d || { x: 32, y: 600, w: 300, h: 30 }), id: uid(kind), kind }); }
  }
  return { ...layout, enabled: true, blocks };
}

/** แถวยอดรวมของเอกสารตัวอย่าง (ครบทุกแถวที่เลือกแสดงได้) ตามชนิดเอกสาร */
const sampleTotals = (docType: string) => sampleModelFor(docType, { name: "" } as any, "2026-01-01").totals;

/**
 * กรอบกล่องยอดรวมสูงพอดีตารางยอดรวมเสมอ (ไม่มีที่ว่างเหลือ) — ติ๊กแถวเพิ่ม/ลด เปลี่ยนตัวอักษร/ระยะแถว/รูปแบบ กรอบขยาย/หดตาม
 * ใช้แถวของเอกสารตัวอย่าง (ครบทุกแถว) ตัดแถวที่ติ๊กออก · ไม่มีอะไรเปลี่ยน = คืนออบเจกต์เดิม
 */
export function fitTotalsBlocks(d: DocumentDesign): DocumentDesign {
  let changed = false;
  const perDoc = { ...d.perDoc };
  for (const [type, per] of Object.entries(d.perDoc)) {
    const free = per.free;
    if (!free?.blocks.some((b) => b.kind === "totals")) continue;
    const rows = sampleTotals(type);
    if (!rows.length) continue;
    let touched = false;
    const blocks = free.blocks.map((b) => {
      if (b.kind !== "totals") return b;
      const h = totalsBlockHeight(b, d.theme, rows);
      if (Math.abs(h - b.h) < 0.25) return b;
      touched = true;
      return { ...b, h };
    });
    if (touched) { changed = true; perDoc[type] = { ...per, free: { ...free, blocks } }; }
  }
  return changed ? { ...d, perDoc } : d;
}

/** หน้ากระดาษเปล่า: เหลือเฉพาะกล่องข้อมูลที่กฎหมายกำหนด (ไม่มีกรอบ สี เส้น) ให้ออกแบบใหม่ทั้งหมด */
export function blankLayout(docType: string, theme: DocTheme): FreeLayout {
  const keep: BlockKind[] = ["seller", "title", "meta", "party", "items", "totals", "signatures"];
  const blocks = defaultFreeLayout(docType, theme.font).blocks.filter((b) => keep.includes(b.kind))
    .map((b) => (b.kind === "party" ? { ...b, partyStyle: "none" as const } : b.kind === "items" ? { ...b, table: "lines" as const } : b.kind === "totals" ? { ...b, totalsStyle: "plain" as const } : b));
  return { enabled: true, blocks };
}
