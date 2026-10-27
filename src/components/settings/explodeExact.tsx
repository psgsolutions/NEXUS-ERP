"use client";

import React from "react";
import type { DocumentModel } from "@/lib/documents/model";
import { FONT_SCALE, docHasCopy, enLabel, themeLine, type FreeBlock } from "@/lib/documents/design";
import { loadPdfjs } from "./usePdfPageImage";

/**
 * แยกกล่อง (ผู้ขาย ลูกค้า เลขที่ ชื่อเอกสาร กล่องข้อมูล ช่องข้อมูล) เป็นชิ้นหัวข้อ/ข้อมูล ให้หน้าตาเหมือนเดิมทุกบรรทัด
 *  1) วาดกล่องเดิมเป็น PDF จริง (ตัวสร้างเดียวกับที่พิมพ์) อ่านตำแหน่งข้อความทุกบรรทัด
 *  2) สร้างชิ้นตามแบบของกล่อง: ขนาด/น้ำหนัก/สีอักษร ระยะบรรทัด ความกว้างคอลัมน์ การจัดชิด เหมือนเดิม
 *  3) วาดแต่ละชิ้น แล้วเลื่อนให้ข้อความตรงตำแหน่งเดิม (ตรงกันระดับเศษ pt)
 * ข้อมูลที่ว่างในตัวอย่าง (กล่องเดิมไม่พิมพ์) ไม่สร้างชิ้น
 */

type Run = { n: string; x: number; base: number; w: number; size: number };
type Col = { x: number; w: number };
interface Piece {
  b: FreeBlock;
  /** ตำแหน่ง/ความกว้างคอลัมน์ (คำนวณหลังอ่านตำแหน่งข้อความเดิม) — ไม่มี = พอดีข้อความ */
  col?: () => Col;
  /** ข้อมูลที่ต่อท้ายหัวข้อในบรรทัดเดียวกัน (เช่น "เลขประจำตัวผู้เสียภาษี 0105…") */
  after?: boolean;
  /** กล่องมีกรอบรอบข้อความ (ป้ายต้นฉบับ/สำเนา): ขอบในซ้ายขวา */
  boxPad?: number;
}
interface Unit {
  text: string; pieces: Piece[]; runs: Run[];
  /** ป้ายต่อข้อมูลที่ขึ้นบรรทัดใหม่ในกล่องเดิม: ใช้ชิ้นเดียว (ป้าย ข้อมูล ตัดบรรทัดเหมือนเดิม) แทนการแยก */
  wrapped?: Piece[];
  /** ป้ายต่อข้อมูลบรรทัดเดียว: ข้อความเดียวกันวางในที่กว้าง (ความยาวปกติ) — บรรทัดเดิมสั้นกว่า = ช่องว่างถูกบีบให้พอดีกล่อง ใช้ชิ้นเดียว */
  probe?: FreeBlock;
}

/** ตัวอักษรหลักของข้อความ (ตัดช่องว่าง วรรณยุกต์ สระบน/ล่าง ขีด) — เทียบข้อความจาก PDF ได้แม้ลำดับสระ/วรรณยุกต์ต่างกัน */
const skel = (s: string) => s.replace(/([่-๋]?)ำ/g, "ํ$1า").replace(/ำ/g, "า").replace(/[\s​-‍­\-ัิ-ฺ็-๎]/g, "");
const uid = (k: string) => `${k.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12) || "f"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type SD = typeof import("@/lib/pdf/StandardDocument");

/** วาดกล่องเป็น PDF (หนึ่งหน้าต่อชุด) แล้วอ่านข้อความทุกบรรทัดตามลำดับที่วาด */
async function renderRuns(sd: SD, model: DocumentModel, pages: FreeBlock[][], page: { w: number; h: number }): Promise<Run[][]> {
  const [{ pdf, Document, Page }, pdfjs] = await Promise.all([import("@react-pdf/renderer"), loadPdfjs()]);
  sd.registerDocumentFonts(window.location.origin);
  const c = sd.documentContext(model, "original");
  const blob = await pdf(
    <Document>
      {pages.map((bs, i) => <Page key={i} size={[page.w, page.h]} style={[c.s.page, { padding: 0 }]}>{bs.map((b) => <sd.BlockView key={b.id} c={c} b={b} />)}</Page>)}
    </Document>,
  ).toBlob();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const out: Run[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      out.push(tc.items.flatMap((it: any) => {
        const n = typeof it.str === "string" ? skel(it.str) : "";
        return n ? [{ n, x: it.transform[4], base: page.h - it.transform[5], w: it.width, size: Math.hypot(it.transform[2], it.transform[3]) }] : [];
      }));
    }
    return out;
  } finally { await doc.loadingTask.destroy(); }
}

/** แบบของชิ้นตามกล่องแต่ละชนิด (ลำดับเดียวกับที่ตัวสร้าง PDF วาด) */
function plan(sd: SD, model: DocumentModel, b: FreeBlock) {
  const c = sd.blockContext(sd.documentContext(model, "original"), b);
  const t = c.t, FS = FONT_SCALE[t.font], B = t.fontSize, L = b.lineHeight ?? 1.35;
  const fz = (n: number) => Math.round(n * FS * (B / 9.5) * 10) / 10;
  const pt = (rendered: number) => Math.round((rendered / FS) * 1000) / 1000;
  const col = b.color;
  const deco: Partial<FreeBlock> = { ...(b.font ? { font: b.font } : {}), ...(b.italic ? { italic: true } : {}), ...(b.underline ? { underline: true } : {}), ...(b.strike ? { strike: true } : {}), ...(b.letterSpacing ? { letterSpacing: b.letterSpacing } : {}) };
  const role = {
    normal: { fontSize: pt(fz(9.5)), lineHeight: L, ...(col ? { color: col } : {}) },
    small: { fontSize: pt(fz(8.5)), lineHeight: L, color: col || "@muted" },
    sellerName: { fontSize: pt(fz(13)), lineHeight: L + 0.15, bold: true, color: col || "@primary" },
    title: { fontSize: pt(fz(17)), lineHeight: L + 0.25, bold: true, color: col || "@primary" },
    partyLabel: { fontSize: pt(fz(8.5)), lineHeight: L, color: col || "@muted" },
    muted: { fontSize: pt(fz(9.5)), lineHeight: L, color: col || "@muted" },
  } satisfies Record<string, Partial<FreeBlock>>;
  const fv = (k: string) => sd.fieldValue(c, k);
  const val = (k: string) => fv(k)?.value || "";
  const field = (k: string, extra: Partial<FreeBlock>): FreeBlock => ({ id: uid(k), kind: "field", field: k, x: 0, y: 0, w: 10, h: 10, ...deco, ...extra });
  const value = (k: string, r: Partial<FreeBlock>, extra: Partial<FreeBlock> = {}) => field(k, { hideLabel: true, ...r, ...extra });
  const label = (k: string, r: Partial<FreeBlock>, extra: Partial<FreeBlock> = {}) => field(k, { show: "label", ...r, ...extra });
  const enOf = (th: string) => (t.bilingual ? enLabel(th) : "");

  // พื้นที่เนื้อหาของกล่อง (ภายในเส้นกรอบและขอบใน)
  const pad = b.pad ?? ((b.border || b.bg) && b.kind !== "items" ? 4 : 0);
  const bw = b.border ? b.borderWidth ?? 1 : 0;
  const cx = b.x + bw + pad, cy = b.y + bw + pad, cw = b.w - 2 * bw - 2 * pad;
  const a3 = (b.align === "justify" ? "left" : b.align) as "left" | "center" | "right" | undefined;

  const units: Unit[] = [];
  const frames: FreeBlock[] = [];
  let partyFrame: { cy: number; pv: number; bottomBorder: number; style: string } | null = null;
  const unit = (text: string, ...pieces: Piece[]) => { const u: Unit = { text, pieces, runs: [] }; units.push(u); return u; };
  const full = (): Col => ({ x: cx, w: cw });
  const pairId = () => `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  /** ป้าย : ข้อมูล แบบคอลัมน์ (ป้ายกว้าง lw ชิดซ้ายที่ x · ข้อมูลเริ่มหลังระยะ gap) */
  const formRow = (k: string, th: string, x: number, w: number, lw: number, gap: number, bold = false, names?: string) => {
    const g = pairId();
    unit(`${th} :${enOf(th)}`, { b: label(k, role.normal, { group: g, ...(names ? { text: names } : {}) }), col: () => ({ x, w: lw }) });
    unit(val(k) || "-", { b: value(k, role.normal, { group: g, ...(bold ? { bold: true } : {}) }), col: () => ({ x: x + lw + gap, w: Math.max(10, w - lw - gap) }) });
  };
  /** "ป้าย ข้อมูล" ต่อกันเป็นข้อความเดียวในกล่องเดิม: บรรทัดเดียว = แยกป้าย/ข้อมูล · ตัดขึ้นบรรทัดใหม่ = ชิ้นเดียวตัดบรรทัดเหมือนเดิม */
  const inline = (k: string, th: string, r: Partial<FreeBlock>, area: () => Col, align?: "left" | "center" | "right") => {
    const g = pairId();
    const u = unit(`${th} ${val(k)}`, { b: label(k, r, { labelStyle: "inline", group: g }) }, { b: value(k, r, { group: g }), after: true });
    u.wrapped = [{ b: field(k, { ...r, labelStyle: "inline", ...(align ? { align } : {}) }), col: area }];
    u.probe = field(k, { ...r, labelStyle: "inline", x: 0, y: 0, w: 2000, h: 200 });
  };

  switch (b.kind) {
    case "seller": {
      const a = a3 || "left", s = model.seller, al = { align: a } as const;
      if (s.name) unit(s.name, { b: value("seller.name", role.sellerName, al), col: full });
      if (s.nameEn && !c.hide.has("nameEn")) unit(s.nameEn, { b: value("seller.nameEn", role.small, al), col: full });
      if (s.address) unit(s.address, { b: value("seller.address", role.normal, al), col: full });
      inline("seller.taxId", "เลขประจำตัวผู้เสียภาษี", role.normal, full, a);
      if (val("seller.contact") && !c.hide.has("contact")) unit(val("seller.contact"), { b: value("seller.contact", role.small, al), col: full });
      break;
    }
    case "title": {
      const a = a3 || "right", al = { align: a } as const;
      unit(val("title"), { b: value("title", role.title, al), col: full });
      if (val("titleEn") && !c.hide.has("en")) unit(val("titleEn"), { b: value("titleEn", role.small, al), col: full });
      if (docHasCopy(model.type) && !c.hide.has("copy")) {
        const border = col || "@primary", r = (b.radius ?? (t.rounded ? 4 : 0)) ? 3 : 0;
        unit(val("copy"), { b: value("copy", { fontSize: pt(fz(9)), lineHeight: L, bold: true, color: border }, { border, borderWidth: 1, radius: r, pad: 1.5, align: "center" }), boxPad: 8 });
      }
      break;
    }
    case "meta": {
      const rows = sd.metaRows(c);
      if (t.formStyle) {
        const rw = Math.max(cw, 190), lw = c.labelWidth ?? rw * 0.48;
        for (const m of rows) formRow(m.key, m.label, cx, rw, lw, c.labelGap ?? 4);
      } else if ((a3 || "right") === "left") {
        const lw = c.labelWidth ?? sd.autoLabelWidth(c, rows.map((m) => m.label), (c.box?.w ?? 240) * 0.55);
        for (const m of rows) formRow(m.key, m.label, cx, cw, lw, c.labelGap ?? 4);
      } else {
        // ป้ายสีจางชิดขวาในช่องกว้าง 70 · ข้อมูลตัวหนาชิดขวา กว้างอย่างน้อย 90
        const lw = c.labelWidth ?? 70, gap = c.labelGap ?? 6;
        for (const m of rows) {
          const g = pairId();
          const lu = unit(`${m.label}${enOf(m.label)}`, { b: label(m.key, role.muted, { labelStyle: "plain", align: "right", group: g }) });
          const vu = unit(m.value || "-", { b: value(m.key, role.normal, { bold: true, align: "right", group: g }) });
          const vbox = (): Col => { const r = vu.runs[0]; const right = r ? r.x + r.w : cx + cw; const w = Math.max(90, r?.w ?? 0); return { x: right - w, w }; };
          vu.pieces[0].col = vbox;
          lu.pieces[0].col = () => ({ x: vbox().x - gap - lw, w: lw });
        }
      }
      break;
    }
    case "info": {
      const rows = (b.fields || []).map((k) => fv(k)).filter((r): r is NonNullable<typeof r> => !!r && !!r.value.trim());
      const lw = b.labelWidth ?? sd.autoLabelWidth(c, rows.filter((_, i) => !(i === 0 && b.emphasizeFirst)).map((r) => b.names?.[r.key] || r.label), b.w * 0.55);
      const gap = b.labelGap ?? 4, left = !a3 || a3 === "left";
      rows.forEach((r, i) => {
        const th = b.names?.[r.key] || r.label;
        if (i === 0 && b.emphasizeFirst) unit(r.value, { b: value(r.key, { fontSize: pt(c.s.page.fontSize * 1.25), lineHeight: 1.3, bold: true, color: col || "@primary" }, a3 ? { align: a3 } : {}), col: full });
        else if (b.hideLabel) unit(r.value, { b: value(r.key, role.normal, { ...(a3 ? { align: a3 } : {}), ...(b.bold ? { bold: true } : {}) }), col: full });
        else if (b.flow === "row") {
          const g = pairId();
          unit(`${th} :${enOf(th)}`, { b: label(r.key, role.normal, { group: g, ...(b.names?.[r.key] ? { text: th } : {}) }) });
          unit(r.value, { b: value(r.key, role.normal, { group: g, ...(b.bold ? { bold: true } : {}) }) });
        } else if (left) formRow(r.key, th, cx, cw, lw, gap, !!b.bold, b.names?.[r.key] ? th : undefined);
        else {
          const g = pairId();
          const lu = unit(`${th} :${enOf(th)}`, { b: label(r.key, role.normal, { group: g, ...(b.names?.[r.key] ? { text: th } : {}) }) });
          const vu = unit(r.value, { b: value(r.key, role.normal, { group: g, ...(b.bold ? { bold: true } : {}) }) });
          lu.pieces[0].col = () => ({ x: (vu.runs[0]?.x ?? cx + lw + gap) - gap - lw, w: lw });
        }
      });
      break;
    }
    case "party": {
      const p = model.party;
      if (!p) break;
      const style = t.party;
      const lineColor = b.lineColor || (col ? themeLine(t) : "@line");
      const bl = style === "boxed" ? 1 : style === "accent-bar" ? 3 : 0, br = style === "boxed" || style === "accent-bar" ? 1 : 0;
      const ph = style === "boxed" || style === "accent-bar" ? 8 : 0, pv = style === "boxed" || style === "accent-bar" ? 8 : style === "plain" ? 6 : 0;
      const ix = cx + bl + ph, iw = cw - bl - br - 2 * ph;
      const showContact = !c.hide.has("contact") && !!p.contact, showPhone = !c.hide.has("phone") && !!p.phone, showEmail = !c.hide.has("email") && !!p.email;
      const right = showContact || showPhone || showEmail;
      const rw = right ? iw * 0.34 : 0, lwid = right ? iw - 10 - rw : iw, rx = ix + iw - rw;
      if (t.formStyle) {
        const lw = c.labelWidth ?? 110, lw2 = c.labelWidth ? Math.round(c.labelWidth * 0.53) : 58, gap = c.labelGap ?? 4;
        const nameTh = ({ "ลูกค้า": "ชื่อลูกค้า", "เสนอราคาให้": "ชื่อลูกค้า" } as Record<string, string>)[p.label] || p.label;
        formRow("customer.name", nameTh, ix, lwid, lw, gap, true, nameTh !== p.label ? nameTh : undefined);
        if (p.taxId) formRow("customer.taxId", "เลขประจำตัวผู้เสียภาษี", ix, lwid, lw, gap);
        if (p.address) formRow("customer.address", "ที่อยู่", ix, lwid, lw, gap);
        if (showContact) formRow("customer.contact", p.contactLabel || "ผู้ติดต่อ", rx, rw, lw2, gap);
        if (showPhone) formRow("customer.phone", "โทร", rx, rw, lw2, gap);
        if (showEmail) formRow("customer.email", "อีเมล", rx, rw, lw2, gap);
      } else {
        unit(`${p.label}${enOf(p.label)}`, { b: label("customer.name", role.partyLabel, { labelStyle: "plain" }), col: () => ({ x: ix, w: lwid }) });
        unit(p.name || "-", { b: value("customer.name", role.normal, { bold: true }), col: () => ({ x: ix, w: lwid }) });
        if (p.address) unit(p.address, { b: value("customer.address", role.normal), col: () => ({ x: ix, w: lwid }) });
        if (p.taxId) inline("customer.taxId", "เลขประจำตัวผู้เสียภาษี", role.normal, () => ({ x: ix, w: lwid }));
        if (right) {
          const th = p.contactLabel || "ผู้ติดต่อ";
          unit(`${th}${enOf(th)}`, { b: label("customer.contact", role.partyLabel, { labelStyle: "plain" }), col: () => ({ x: rx, w: rw }) });
          if (showContact) unit(p.contact || "", { b: value("customer.contact", role.normal), col: () => ({ x: rx, w: rw }) });
          if (showPhone) inline("customer.phone", "โทร", role.normal, () => ({ x: rx, w: rw }));
          if (showEmail) unit(p.email || "", { b: value("customer.email", role.normal), col: () => ({ x: rx, w: rw }) });
        }
      }
      // กรอบลูกค้าตามรูปแบบ: สูงเท่าเนื้อหา + ขอบใน (คำนวณหลังวางชิ้นแล้ว)
      if (style === "boxed" || style === "accent-bar") frames.push({ id: uid("rect"), kind: "rect", x: cx, y: cy, w: cw, h: 0, border: lineColor, borderWidth: 1, radius: c.radius !== undefined ? Math.min(c.radius, 24) : t.rounded ? 4 : 0 });
      if (style === "accent-bar") frames.push({ id: uid("line"), kind: "line", x: cx, y: cy, w: 3, h: 0, color: col || "@primary" });
      if (style === "plain") frames.push({ id: uid("line"), kind: "line", x: cx, y: 0, w: cw, h: 0.8, color: lineColor });
      partyFrame = { cy, pv, bottomBorder: style === "boxed" || style === "accent-bar" ? 1 : 0, style };
      break;
    }
    case "field": {
      const f = b.field ? fv(b.field) : null;
      if (!f || !f.value.trim()) break;
      const left = !a3 || a3 === "left", g = pairId();
      const own = { ...role.normal, ...(b.align ? { align: b.align } : {}) };
      unit(`${f.label} :${enOf(f.label)}`, { b: label(f.key, own, { group: g }) });
      const vu = unit(f.value, { b: value(f.key, own, { group: g, ...(b.bold ? { bold: true } : {}) }) });
      if (left) vu.pieces[0].col = () => { const x = vu.runs[0]?.x ?? cx; return { x, w: Math.max(10, cx + cw - x) }; };
      break;
    }
  }
  // กรอบ/พื้นของกล่องเดิมเป็นกรอบแยก (ชั้นล่าง)
  if (b.border || b.bg) frames.unshift({ id: uid("rect"), kind: "rect", x: b.x, y: b.y, w: b.w, h: b.h, ...(b.bg ? { bg: b.bg } : {}), ...(b.border ? { border: b.border } : {}), ...(b.borderWidth ? { borderWidth: b.borderWidth } : {}), ...(b.radius !== undefined ? { radius: b.radius } : {}), ...(b.radii ? { radii: b.radii } : {}), ...(b.dash ? { dash: b.dash } : {}), ...(b.opacity ? { opacity: b.opacity } : {}) });
  return { units, frames, partyFrame };
}

/** แยกกล่องเป็นชิ้นที่ตรงตำแหน่งเดิม · คืนชิ้นทั้งหมด (กรอบก่อน) — แยกไม่ได้/อ่านตำแหน่งไม่ตรงคืน null */
export async function explodeExact(model: DocumentModel, b: FreeBlock, page: { w: number; h: number }): Promise<FreeBlock[] | null> {
  const sd = await import("@/lib/pdf/StandardDocument");
  const { units, frames, partyFrame } = plan(sd, model, b);
  const live = units.filter((u) => skel(u.text));
  if (!live.length) return null;

  // 1) ตำแหน่งข้อความของกล่องเดิม — แบ่งบรรทัดให้แต่ละหัวข้อตามลำดับที่วาด
  const [orig] = await renderRuns(sd, model, [[{ ...b, off: undefined }]], page);
  let i = 0;
  for (const u of live) {
    const want = skel(u.text);
    let got = "";
    while (got.length < want.length && i < orig.length) { got += orig[i].n; u.runs.push(orig[i++]); }
    if (got !== want) { console.warn("[explode] ข้อความไม่ตรง", { want, got }); return null; }
    if (u.wrapped && u.runs.some((r) => Math.abs(r.base - u.runs[0].base) > 0.5)) u.pieces = u.wrapped;
  }
  // ป้ายต่อข้อมูลบรรทัดเดียว: ถ้าตัวจัดบรรทัดบีบช่องว่างให้พอดีกล่อง การแยกชิ้นจะทำให้ระยะเปลี่ยน — ใช้ชิ้นเดียวแทน
  const probes = live.filter((u) => u.probe && u.pieces !== u.wrapped);
  if (probes.length) {
    const natural = await renderRuns(sd, model, probes.map((u) => [u.probe!]), { w: 2100, h: page.h });
    const ext = (rs: Run[]) => Math.max(...rs.map((x) => x.x + x.w)) - Math.min(...rs.map((x) => x.x));
    probes.forEach((u, k) => { if (natural[k]?.length && ext(u.runs) < ext(natural[k]) - 0.3) u.pieces = u.wrapped!; });
  }

  // 2) วางชิ้นตามแบบ แล้ววาดแต่ละชิ้น (หน้าละชิ้น)
  const pieces = live.flatMap((u) => u.pieces.map((p) => ({ p, u })));
  for (const { p, u } of pieces) {
    const r = u.runs[0], last = u.runs[u.runs.length - 1];
    const box = p.boxPad ?? 0;
    const cc = p.col?.();
    const bw = p.b.border ? p.b.borderWidth ?? 1 : 0, rw = Math.max(...u.runs.map((x) => x.x + x.w)) - Math.min(...u.runs.map((x) => x.x));
    p.b.x = cc ? cc.x : p.after ? r.x + r.w / 2 : r.x - box - bw;
    p.b.w = cc ? cc.w : p.after ? r.w : box ? rw + 2 * box + 2 * bw : rw * 1.08 + 4;
    p.b.y = r.base - r.size * 1.2;
    p.b.h = last.base - r.base + r.size * 3;
  }
  const mine = await renderRuns(sd, model, pieces.map(({ p }) => [p.b]), page);

  // 3) เลื่อนให้ข้อความตรงตำแหน่งเดิม · ความสูงพอดีจำนวนบรรทัด
  const bottoms: number[] = [];
  pieces.forEach(({ p, u }, k) => {
    const got = mine[k];
    const r = u.runs[0];
    if (!got?.length) return;
    const g = got[0], gl = got[got.length - 1];
    const inner = (p.b.border ? p.b.borderWidth ?? 1 : 0) + (p.b.pad ?? (p.b.border || p.b.bg ? 4 : 0));
    // บรรทัดแรกถึงบรรทัดสุดท้าย + ความสูงหนึ่งบรรทัด (ขนาดอักษร x ระยะบรรทัด)
    const contentH = gl.base - g.base + g.size * (p.b.lineHeight ?? 1.35);
    if (p.after) {
      // ข้อมูลต่อท้ายหัวข้อ: ชิดขวาของข้อความเดิมพอดี (บรรทัดหนึ่งอาจแตกเป็นหลายช่วงข้อความใน PDF)
      const line = (rs: Run[], at: Run) => rs.filter((x) => Math.abs(x.base - at.base) < 0.5);
      const mineLine = line(got, g), w = Math.max(...mineLine.map((x) => x.x + x.w)) - Math.min(...mineLine.map((x) => x.x));
      const start = Math.max(...line(u.runs, r).map((x) => x.x + x.w)) - w;
      p.b.x += start - g.x;
      p.b.w = w * 1.08 + 4;
    } else p.b.x += r.x - g.x;
    p.b.y += r.base - g.base;
    p.b.h = Math.round((contentH + 2 * inner + (p.boxPad ? 0 : 1)) * 10) / 10;
    bottoms.push(p.b.y + inner + contentH);
  });
  // กล่องเดิมตัดข้อความที่เกินกรอบ (เลขที่ กล่องข้อมูล ช่องข้อมูล): ชิ้นที่เกินถูกตัดที่ขอบเดิม · ชิ้นที่มองไม่เห็นเลยซ่อนไว้ (ติ๊กแสดงได้)
  if (["meta", "info", "field"].includes(b.kind)) {
    const pad = b.pad ?? (b.border || b.bg ? 4 : 0), bw = b.border ? b.borderWidth ?? 1 : 0;
    const clipBottom = b.y + bw + pad + Math.max(0, b.h - pad * 2);
    for (const { p } of pieces) {
      const inner = (p.b.border ? p.b.borderWidth ?? 1 : 0) + (p.b.pad ?? (p.b.border || p.b.bg ? 4 : 0));
      if (p.b.y + inner >= clipBottom - 0.5) p.b.off = true;
      else if (p.b.y + p.b.h - inner > clipBottom) p.b.h = Math.round((clipBottom - p.b.y + inner) * 10) / 10;
    }
  }
  for (const { p } of pieces) { p.b.x = Math.round(p.b.x * 100) / 100; p.b.y = Math.round(p.b.y * 100) / 100; p.b.w = Math.round(p.b.w * 100) / 100; }

  // กรอบลูกค้า: สูงถึงบรรทัดล่างสุด + ขอบใน + เส้น
  if (partyFrame && bottoms.length) {
    const bottom = Math.max(...bottoms) + partyFrame.pv;
    for (const f of frames) {
      if (f.kind === "rect" && f.h === 0) f.h = Math.round((bottom + partyFrame.bottomBorder - partyFrame.cy) * 10) / 10;
      if (f.kind === "line" && f.h === 0) f.h = Math.round((bottom + partyFrame.bottomBorder - partyFrame.cy) * 10) / 10;
      if (f.kind === "line" && partyFrame.style === "plain") f.y = Math.round(bottom * 10) / 10;
    }
  }
  return [...frames.filter((f) => f.h > 0), ...pieces.map(({ p }) => p.b)];
}
