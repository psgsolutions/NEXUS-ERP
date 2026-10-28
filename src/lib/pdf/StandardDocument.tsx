import React from "react";
import { Document, Ellipse, Font, Image, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ColumnKey, CopyMode, DocumentModel } from "@/lib/documents/model";
import { amountInWords, branchLabel, formatTaxId, money, qtyText, thaiDate } from "@/lib/documents/format";
import { FONT_MAX, FONT_MIN, FONT_SCALE, SIGN_SIZE, docHasCopy, enLabel, legalFieldVisible, requiredSatisfied, resolveBlockColors, resolveDesign, themeLine, tint, resolveColumns, type ColumnSpec, type DocTheme, type FreeBlock, type ItemColumn, type Letterhead, type PerDocDesign } from "@/lib/documents/design";

/**
 * เทมเพลตเอกสาร A4 (ใช้ร่วมทุกประเภทเอกสาร) — หน้าตาตามธีมของบริษัท (ตั้งค่า › ออกแบบเอกสาร)
 * หัวเอกสาร: ผู้ขาย (ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา) | ชื่อเอกสาร เลขที่ วันที่ ต้นฉบับ/สำเนา
 * ส่วนต่าง ๆ (Section*) ใช้ซ้ำในผังลากวางอิสระ (FreeLayoutDocument)
 */

let fontsReady = "";
const thaiSeg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

/** ลงทะเบียนฟอนต์ครั้งเดียวต่อ base URL (server ส่ง origin ของเว็บ, client ใช้ "") */
export function registerDocumentFonts(base: string) {
  if (fontsReady === base) return;
  // URL (เว็บ/origin) ต้องเข้ารหัสชื่อไฟล์ · พาธในเครื่อง (server อ่านไฟล์ตรง) ใช้ชื่อจริง (TH SarabunIT๙ มีอักษรไทยในชื่อ)
  const isUrl = base === "" || /^https?:\/\//.test(base);
  const f = (name: string) => `${base}/fonts/${isUrl ? encodeURIComponent(name) : name}`;
  // ตัวเอียง: TH Sarabun มีไฟล์เอียงจริง · Sarabun ไม่มีไฟล์เอียง ใช้ตัวตรงแทน (ไม่ให้พิมพ์ล้ม)
  Font.register({ family: "Sarabun", fonts: [{ src: f("Sarabun-Regular.ttf"), fontWeight: "normal" }, { src: f("Sarabun-Bold.ttf"), fontWeight: "bold" }, { src: f("Sarabun-Regular.ttf"), fontWeight: "normal", fontStyle: "italic" }, { src: f("Sarabun-Bold.ttf"), fontWeight: "bold", fontStyle: "italic" }] });
  Font.register({ family: "THSarabunNew", fonts: [{ src: f("THSarabun.ttf"), fontWeight: "normal" }, { src: f("THSarabun Bold.ttf"), fontWeight: "bold" }, { src: f("THSarabun Italic.ttf"), fontWeight: "normal", fontStyle: "italic" }, { src: f("THSarabun BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" }] });
  Font.register({ family: "THSarabunIT9", fonts: [{ src: f("THSarabunIT๙.ttf"), fontWeight: "normal" }, { src: f("THSarabunIT๙ Bold.ttf"), fontWeight: "bold" }, { src: f("THSarabunIT๙ Italic.ttf"), fontWeight: "normal", fontStyle: "italic" }, { src: f("THSarabunIT๙ BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" }] });
  // ภาษาไทยไม่มีช่องว่างระหว่างคำ: แบ่งคำให้ตัดบรรทัดได้
  Font.registerHyphenationCallback((word) => (thaiSeg && /[฀-๿]/.test(word) ? Array.from(thaiSeg.segment(word), (s) => s.segment) : [word]));
  fontsReady = base;
}

/**
 * react-pdf + ฟอนต์ไทย: สระอำ (U+0E33) ถูกแตกเป็น 2 glyph ทำให้นับตำแหน่งตัวอักษรเพี้ยน (ตัวท้ายบรรทัดหาย, น้ำ -> น้า)
 * แก้โดยแตกเองก่อน: [วรรณยุกต์]ำ -> ํ[วรรณยุกต์]า (แสดงผลเหมือนเดิม)
 */
export const fixThaiText = (v: any) => (typeof v === "string" ? v.replace(/([่-๋]?)ำ/g, "ํ$1า") : v);

/** Text ที่แก้สระอำให้อัตโนมัติ (ใช้แทน Text ทุกที่ที่เป็นข้อความ) */
export function T({ children, ...rest }: { children?: React.ReactNode; style?: any; fixed?: boolean; wrap?: boolean; render?: any; maxLines?: number }) {
  return <Text {...rest}>{React.Children.map(children, fixThaiText)}</Text>;
}

export const COL: Record<ColumnKey, { label: string; width: string; align: "left" | "right" | "center" }> = {
  no: { label: "ลำดับ", width: "6%", align: "center" },
  code: { label: "รหัส", width: "13%", align: "left" },
  description: { label: "รายการ", width: "auto", align: "left" },
  detail: { label: "รายละเอียด", width: "auto", align: "left" },
  qty: { label: "จำนวน", width: "9%", align: "right" },
  unit: { label: "หน่วย", width: "8%", align: "center" },
  qtyUnit: { label: "จำนวน", width: "13%", align: "right" },
  price: { label: "ราคา/หน่วย", width: "13%", align: "right" },
  gross: { label: "ราคารวม", width: "14%", align: "right" },
  discount: { label: "ส่วนลด", width: "10%", align: "right" },
  discountText: { label: "ส่วนลด", width: "9%", align: "center" },
  amount: { label: "จำนวนเงิน", width: "14%", align: "right" },
  debit: { label: "เดบิต", width: "15%", align: "right" },
  credit: { label: "เครดิต", width: "15%", align: "right" },
};

const line = "#d9d9d9";

/** สไตล์ตามธีม (ขนาดตัวอักษรคูณสเกลของฟอนต์ ให้ TH Sarabun อ่านได้เท่ากัน) · lh = ระยะบรรทัดเนื้อหา */
export function themeStyles(t: DocTheme, lh = 1.35, radius?: number) {
  const k = FONT_SCALE[t.font] * (t.fontSize / 9.5);
  const fz = (n: number) => Math.round(n * k * 10) / 10;
  const r = radius ?? (t.rounded ? 4 : 0);
  return StyleSheet.create({
    page: { paddingTop: t.margin - 2, paddingBottom: t.margin + 16, paddingHorizontal: t.margin, fontFamily: t.font, fontSize: fz(9.5), color: t.text, lineHeight: lh },
    row: { flexDirection: "row" },
    logo: { width: t.logoSize, height: t.logoSize, objectFit: "contain" },
    sellerName: { fontSize: fz(13), fontWeight: "bold", lineHeight: lh + 0.15, color: t.primary },
    small: { fontSize: fz(8.5), color: t.muted },
    title: { fontSize: fz(17), fontWeight: "bold", lineHeight: lh + 0.25, color: t.primary },
    copyBox: { marginTop: 3, paddingVertical: 1.5, paddingHorizontal: 8, borderWidth: 1, borderRadius: r ? 3 : 0, fontSize: fz(9), fontWeight: "bold", borderColor: t.primary, color: t.primary },
    metaRow: { flexDirection: "row", marginTop: 1.5 },
    metaLabel: { color: t.muted, width: 70, textAlign: "right", marginRight: 6 },
    metaValue: { fontWeight: "bold", minWidth: 90, textAlign: "right" },
    partyLabel: { fontSize: fz(8.5), color: t.muted, marginBottom: 1 },
    en: { fontSize: fz(6), color: t.muted, lineHeight: 1.15 },
    thText: { fontSize: fz(8.5), fontWeight: "bold", paddingHorizontal: 4 },
    td: { paddingHorizontal: 4 },
    words: { borderWidth: 1, borderColor: themeLine(t), borderRadius: r, padding: 6, fontWeight: "bold", textAlign: "center", backgroundColor: `${t.accent}10` },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 6 },
    signBox: { flex: 1, alignItems: "center" },
    signLine: { width: "85%", borderBottomWidth: 0.8, borderColor: "#888888", height: 28 },
    signImage: { width: "85%", height: 40, objectFit: "contain", borderBottomWidth: 0.8, borderColor: "#888888" },
    photo: { width: "100%", height: 170, objectFit: "contain" },
    watermark: { position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", fontSize: 90, fontWeight: "bold", color: "#d32f2f", opacity: 0.12, transform: "rotate(-30deg)" },
  });
}
export type ThemeStyles = ReturnType<typeof themeStyles>;
/**
 * บริบทการวาด: ธีม สไตล์ การปรับของชนิดเอกสาร + การตั้งค่าของกล่อง (ผังลากวาง/หัวกระดาษ)
 * hide = ส่วนย่อยที่ซ่อน (BLOCK_PARTS) · cols = คอลัมน์ตาราง · labels = ชื่อช่องลงนาม
 */
export type Ctx = {
  doc: DocumentModel; t: DocTheme; s: ThemeStyles; per: PerDocDesign; copy: CopyMode; lh?: Letterhead;
  hide: Set<string>; cols?: ItemColumn[]; colSpec?: ColumnSpec[]; labels?: string[];
  /** กล่องเลขที่: ข้อมูลเพิ่ม · ช่องลงนาม: ระยะห่าง · ตาราง: ยืดเต็มกล่อง (ต้องรู้ขนาดกล่อง) */
  fields?: string[]; gap?: number; fill?: boolean; box?: { w: number; h: number };
  /** ป้ายของข้อมูลที่วางแยกแล้ว (หมายเหตุไม่แสดงซ้ำ) */
  shown?: Set<string>;
  /** วางกล่องตราประทับเองแล้ว (ไม่ประทับทับช่องลงนามซ้ำ) */
  stampPlaced?: boolean;
  /** การตั้งค่ากล่อง: รัศมีมุม · สีเส้น/ความหนาเส้นในตาราง/กรอบ · สีพื้นหัวตาราง */
  radius?: number; lineColor?: string; lineWidth?: number; headBg?: string;
  /** ระยะข้อความของกล่องที่มีป้าย: ป้าย→ข้อมูล · ความกว้างป้าย · ระยะระหว่างแถว (pt) */
  labelGap?: number; labelWidth?: number; rowGap?: number;
  /** ช่องลงนามที่วางกล่องลายเซ็นแยกไว้แล้ว (ช่องลงนามไม่พิมพ์รูปลายเซ็นซ้ำ) */
  signPlaced?: Set<string>;
  /** จำนวนหน้าจริงของเอกสาร (หน้าออกแบบวาดทีละกล่องหลายหน้า — เลขหน้าในส่วนท้ายใช้ค่านี้) */
  pageTotal?: number;
};
/** รัศมีมุม: ค่าของกล่องก่อน ไม่มีจึงตามธีม (มุมโค้ง/เหลี่ยม) */
const rad = (c: Ctx, d = 4) => (c.radius !== undefined ? Math.min(c.radius, d * 6) : c.t.rounded ? d : 0);
/** สีเส้นตาราง/กรอบ: ของกล่องก่อน ไม่มีจึงเป็นสีเส้นของธีม (สีหลักแบบอ่อน) */
const lineOf = (c: Ctx) => c.lineColor || themeLine(c.t);
/** สีตัวอักษรที่อ่านได้บนพื้นสีนี้ */
const onColor = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l < 150 ? "#ffffff" : "#111111"; };

const docTitle = (c: Ctx) => c.per.title || c.doc.title;
const docTitleEn = (c: Ctx) => c.per.titleEn ?? c.doc.titleEn;
const sigLabels = (c: Ctx) => (c.labels?.length ? c.labels : c.per.signatures?.length ? c.per.signatures : c.doc.signatures);

// ---------- ส่วนต่าง ๆ ของเอกสาร ----------
export function SectionLogo({ c }: { c: Ctx }) {
  // eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt
  return c.doc.seller.logo ? <Image src={c.doc.seller.logo} style={c.s.logo} /> : null;
}

export function SectionSeller({ c, align = "left", inverse = false }: { c: Ctx; align?: "left" | "center" | "right"; inverse?: boolean }) {
  const seller = c.doc.seller;
  const contact = [seller.phone && `โทร ${seller.phone}`, seller.email, seller.website].filter(Boolean).join("  ·  ");
  const tone = inverse ? { color: "#ffffff" } : {};
  return (
    <View style={{ alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
      <T style={[c.s.sellerName, { textAlign: align }, tone]}>{seller.name || "(ยังไม่ได้ตั้งชื่อบริษัท)"}</T>
      {seller.nameEn && !c.hide.has("nameEn") ? <T style={[c.s.small, { textAlign: align }, tone]}>{seller.nameEn}</T> : null}
      {seller.address ? <T style={[{ textAlign: align }, tone]}>{seller.address}</T> : null}
      <T style={[{ textAlign: align }, tone]}>เลขประจำตัวผู้เสียภาษี {formatTaxId(seller.taxId) || "-"}  {branchLabel(seller.branchCode, seller.branchName)}</T>
      {contact && !c.hide.has("contact") ? <T style={[c.s.small, { textAlign: align }, tone]}>{contact}</T> : null}
    </View>
  );
}

export function SectionTitle({ c, align = "right", inverse = false }: { c: Ctx; align?: "left" | "center" | "right"; inverse?: boolean }) {
  const en = docTitleEn(c);
  const tone = inverse ? { color: "#ffffff" } : {};
  return (
    <View style={{ alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
      <T style={[c.s.title, { textAlign: align }, tone]}>{docTitle(c)}</T>
      {en && !c.hide.has("en") ? <T style={[c.s.small, { textAlign: align }, tone]}>{en}</T> : null}
      {!docHasCopy(c.doc.type) || c.hide.has("copy") ? null : <T style={[c.s.copyBox, inverse ? { borderColor: "#ffffff", color: "#ffffff" } : {}]}>{c.copy === "copy" ? "สำเนา" : "ต้นฉบับ"}</T>}
    </View>
  );
}

/** ป้ายกำกับ (โหมดสองภาษา: ไทย + อังกฤษตัวเล็กใต้ป้าย) */
function Lbl({ c, th, style, align, suffix = "" }: { c: Ctx; th: string; style?: any; align?: "left" | "center" | "right"; suffix?: string }) {
  const en = c.t.bilingual ? enLabel(th) : "";
  if (!en) return <T style={[style, align ? { textAlign: align } : {}]}>{th}{suffix}</T>;
  // ป้ายอังกฤษใช้สีเดียวกับป้ายไทยเมื่อป้ายมีสีเฉพาะ (เช่น ตัวขาวบนแถบยอดรวมสีทึบ)
  const tone = style && !Array.isArray(style) && style.color ? { color: style.color, opacity: 0.85 } : {};
  return (
    <View>
      <T style={[style, align ? { textAlign: align } : {}]}>{th}{suffix}</T>
      <T style={[c.s.en, tone, align ? { textAlign: align } : {}]}>{en}</T>
    </View>
  );
}

/** ความยาวที่มองเห็นของข้อความ (ไม่นับสระบน/ล่าง วรรณยุกต์ไทย) */
function vlen(s: string) { return s.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "").length; }
/** กว้างพอสำหรับป้ายที่ยาวสุด (ป้ายชิดซ้ายเป็นแนวเดียว ข้อมูลเริ่มตรงกัน) */
export function autoLabelWidth(c: Ctx, labels: string[], max: number) {
  const fs = c.s.page.fontSize as number;
  return Math.min(max, Math.ceil(Math.max(20, ...labels.map((l) => vlen(`${l} :`) * fs * 0.55)) + 4));
}

/** แถว "ป้าย : ค่า" (รูปแบบฟอร์ม) */
function FormRow({ c, th, value, labelWidth, bold = false }: { c: Ctx; th: string; value: React.ReactNode; labelWidth: number | string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", marginTop: c.rowGap ?? 1.5 }}>
      <View style={{ width: labelWidth }}><Lbl c={c} th={th} suffix=" :" style={{ fontWeight: "bold" }} /></View>
      <T style={[{ flex: 1, paddingLeft: c.labelGap ?? 4 }, bold ? { fontWeight: "bold" } : {}]}>{value}</T>
    </View>
  );
}

type FieldRow = { key: string; label: string; value: string };
/** ข้อมูลที่วางได้: เลขที่ วันที่ แถวข้อมูลของเอกสาร (m:ป้าย) ข้อมูลเพิ่ม (f:คีย์) */
export function fieldValue(c: Ctx, key?: string): FieldRow | null {
  if (!key) return null;
  const s = c.doc.seller, p = c.doc.party;
  // ช่องย่อยจากกล่องผู้ขาย/ลูกค้า/ชื่อเอกสาร (แยกกล่องเพื่อจัดวางเอง)
  switch (key) {
    case "title": return { key, label: "ชื่อเอกสาร", value: docTitle(c) };
    case "copy": return docHasCopy(c.doc.type) ? { key, label: "ต้นฉบับ/สำเนา", value: c.copy === "copy" ? "สำเนา" : "ต้นฉบับ" } : null;
    case "titleEn": return { key, label: "ชื่อภาษาอังกฤษ", value: docTitleEn(c) || "" };
    case "seller.name": return { key, label: "ชื่อบริษัท", value: s.name || "" };
    case "seller.nameEn": return { key, label: "ชื่อภาษาอังกฤษ", value: s.nameEn || "" };
    case "seller.address": return { key, label: "ที่อยู่", value: s.address || "" };
    case "seller.taxId": return { key, label: "เลขประจำตัวผู้เสียภาษี", value: `${formatTaxId(s.taxId) || "-"}  ${branchLabel(s.branchCode, s.branchName)}` };
    case "seller.contact": return { key, label: "ติดต่อ", value: [s.phone && `โทร ${s.phone}`, s.email, s.website].filter(Boolean).join("  ·  ") };
    case "customer.name": return { key, label: p?.label || "ลูกค้า", value: p?.name || "-" };
    case "customer.address": return { key, label: "ที่อยู่", value: p?.address || "" };
    case "customer.taxId": return { key, label: "เลขประจำตัวผู้เสียภาษี", value: p?.taxId ? `${formatTaxId(p.taxId)}  ${branchLabel(p.branchCode, p.branchName)}` : "" };
    case "customer.contact": return { key, label: p?.contactLabel || "ผู้ติดต่อ", value: p?.contact || "" };
    case "customer.phone": return { key, label: "โทร", value: p?.phone || "" };
    case "customer.email": return { key, label: "อีเมล", value: p?.email || "" };
  }
  if (key === "number") return { key, label: "เลขที่", value: c.doc.number || "-" };
  if (key === "date") return { key, label: "วันที่", value: c.doc.date ? thaiDate(c.doc.date) : "......../......../........" };
  if (key.startsWith("m:")) { const m = c.doc.meta.find((x) => x.label === key.slice(2)); return m ? { key, label: m.label, value: m.value } : null; }
  if (key.startsWith("f:")) { const f = c.doc.fields?.find((x) => x.key === key.slice(2)); return f ? { key, label: f.label, value: f.value } : null; }
  return null;
}

/** แถวของกล่องเลขที่/วันที่ ตามที่เลือกแสดง */
export function metaRows(c: Ctx): FieldRow[] {
  const keys = ["number", "date", ...c.doc.meta.map((m) => `m:${m.label}`), ...(c.fields || [])];
  return keys.filter((k) => !c.hide.has(k)).map((k) => fieldValue(c, k)).filter((r): r is FieldRow => !!r);
}

export function SectionMeta({ c, align = "right" }: { c: Ctx; align?: "left" | "center" | "right" }) {
  const rows = metaRows(c);
  if (c.t.formStyle) return <View style={{ alignSelf: "stretch", minWidth: 190 }}>{rows.map((m) => <FormRow key={m.key} c={c} th={m.label} value={m.value || "-"} labelWidth={c.labelWidth ?? "48%"} />)}</View>;
  if (align === "left") {
    const lw = c.labelWidth ?? autoLabelWidth(c, rows.map((m) => m.label), (c.box?.w ?? 240) * 0.55);
    return (
      <View>
        {rows.map((m) => (
          <View key={m.key} style={[c.s.metaRow, c.rowGap !== undefined ? { marginTop: c.rowGap } : {}]}>
            <View style={{ width: lw }}><Lbl c={c} th={m.label} suffix=" :" style={{ fontWeight: "bold" }} /></View>
            <T style={{ flex: 1, paddingLeft: c.labelGap ?? 4 }}>{m.value || "-"}</T>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {rows.map((m) => (
        <View key={m.key} style={[c.s.metaRow, { justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start" }, c.rowGap !== undefined ? { marginTop: c.rowGap } : {}]}>
          <View style={{ width: c.labelWidth ?? 70, marginRight: c.labelGap ?? 6 }}><Lbl c={c} th={m.label} style={{ color: c.t.muted }} align="right" /></View>
          <T style={c.s.metaValue}>{m.value || "-"}</T>
        </View>
      ))}
    </View>
  );
}

export function SectionField({ c, b }: { c: Ctx; b: FreeBlock }) {
  const f = fieldValue(c, b.field);
  // ไม่มีข้อมูล (เช่น ยังไม่ได้กรอกชื่อภาษาอังกฤษ/อีเมล) = ไม่พิมพ์อะไร
  if (!f || !f.value.trim()) return null;
  // เฉพาะป้าย (หัวข้อ): วางแยกจากข้อมูลได้ · ชื่อหัวข้อที่ตั้งเอง (text) · รูปแบบตามกล่องเดิมที่แยกมา (ตัวปกติ/ต่อบรรทัด)
  if (b.show === "label") {
    const th = b.text || f.label, a = b.align === "justify" ? "left" : b.align;
    if (b.labelStyle === "inline") return <T style={{ textAlign: a }}>{th}</T>;
    return <View style={{ flexDirection: "row", justifyContent: b.align === "right" ? "flex-end" : b.align === "center" ? "center" : "flex-start" }}><Lbl c={c} th={th} suffix={b.labelStyle === "plain" ? "" : " :"} style={b.labelStyle === "plain" ? { color: c.t.text } : { fontWeight: "bold" }} align={a} /></View>;
  }
  if (b.hideLabel) return <T style={{ textAlign: b.align, fontWeight: b.bold ? "bold" : undefined }}>{f.value || "-"}</T>;
  // ป้ายกับข้อมูลเป็นข้อความเดียวกัน (เช่น "เลขประจำตัวผู้เสียภาษี 0105…" ที่ตัดขึ้นบรรทัดใหม่) — แบบเดียวกับกล่องผู้ขาย/ลูกค้า
  if (b.labelStyle === "inline") return <T style={{ textAlign: b.align === "justify" ? "left" : b.align, fontWeight: b.bold ? "bold" : undefined }}>{b.text || f.label} {f.value}</T>;
  return (
    <View style={{ flexDirection: "row", justifyContent: b.align === "right" ? "flex-end" : b.align === "center" ? "center" : "flex-start" }}>
      {b.labelWidth ? <View style={{ width: b.labelWidth }}><Lbl c={c} th={f.label} suffix=" :" style={{ fontWeight: "bold" }} /></View> : <Lbl c={c} th={f.label} suffix=" :" style={{ fontWeight: "bold" }} />}
      <View style={{ flexShrink: 1, paddingLeft: b.labelGap ?? 4 }}><T style={b.bold ? { fontWeight: "bold" } : {}}>{f.value || "-"}</T></View>
    </View>
  );
}

/**
 * กล่องข้อมูล: หัวข้อที่เลือกเอง ตามลำดับ (ข้อมูลใดก็ได้ของเอกสาร) · ข้อมูลว่างไม่พิมพ์แถว
 * เน้นแถวแรก = ชื่อบริษัท/ลูกค้าตัวหนาใหญ่ ไม่มีป้าย · ซ่อนป้าย = แสดงเฉพาะค่า
 */
export function SectionInfo({ c, b }: { c: Ctx; b: FreeBlock }) {
  const rows = (b.fields || []).map((k) => fieldValue(c, k)).filter((r): r is FieldRow => !!r && !!r.value.trim());
  if (!rows.length) return null;
  // ป้ายชิดซ้ายเป็นแนวเดียว: กว้างพอดีป้ายที่ยาวสุด (ตั้งเองได้)
  const lw = b.labelWidth ?? autoLabelWidth(c, rows.filter((_, i) => !(i === 0 && b.emphasizeFirst)).map((r) => b.names?.[r.key] || r.label), b.w * 0.55);
  const justify = b.align === "right" ? "flex-end" : b.align === "center" ? "center" : "flex-start";
  if (b.flow === "row") {
    // เรียงเป็นแถวแนวนอน: ป้าย : ค่า ต่อกัน (ขึ้นบรรทัดใหม่เมื่อเต็ม)
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: justify, columnGap: 14, rowGap: b.rowGap ?? 2 }}>
        {rows.map((r, i) => (
          <View key={r.key} style={{ flexDirection: "row" }}>
            {b.hideLabel || (i === 0 && b.emphasizeFirst) ? null : <Lbl c={c} th={b.names?.[r.key] || r.label} suffix=" :" style={{ fontWeight: "bold" }} />}
            <T style={[{ paddingLeft: b.hideLabel ? 0 : b.labelGap ?? 4 }, b.bold || (i === 0 && b.emphasizeFirst) ? { fontWeight: "bold" } : {}, i === 0 && b.emphasizeFirst ? { color: c.t.primary } : {}]}>{r.value}</T>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {rows.map((r, i) => {
        const label = b.names?.[r.key] || r.label;
        if (i === 0 && b.emphasizeFirst) return <T key={r.key} style={{ fontWeight: "bold", fontSize: c.s.page.fontSize * 1.25, lineHeight: 1.3, marginBottom: 2, color: c.t.primary, textAlign: b.align }}>{r.value}</T>;
        if (b.hideLabel) return <T key={r.key} style={{ textAlign: b.align, fontWeight: b.bold ? "bold" : undefined, marginTop: b.rowGap ?? 0 }}>{r.value}</T>;
        return (
          <View key={r.key} style={{ flexDirection: "row", justifyContent: justify, marginTop: b.rowGap ?? 1 }}>
            <View style={{ width: lw }}><Lbl c={c} th={label} suffix=" :" style={{ fontWeight: "bold" }} /></View>
            <T style={[{ flex: b.align === "left" || !b.align ? 1 : undefined, paddingLeft: b.labelGap ?? 4 }, b.bold ? { fontWeight: "bold" } : {}]}>{r.value}</T>
          </View>
        );
      })}
    </View>
  );
}

const PARTY_NAME_LABEL: Record<string, string> = { "ลูกค้า": "ชื่อลูกค้า", "เสนอราคาให้": "ชื่อลูกค้า" };

export function SectionParty({ c }: { c: Ctx }) {
  const p = c.doc.party;
  if (!p) return null;
  const t = c.t;
  const box = t.party === "boxed" ? { borderWidth: 1, borderColor: lineOf(c), borderRadius: rad(c), padding: 8 }
    : t.party === "accent-bar" ? { borderWidth: 1, borderColor: lineOf(c), borderLeftWidth: 3, borderLeftColor: t.primary, borderRadius: rad(c), padding: 8 }
    : t.party === "none" ? {} : { borderBottomWidth: 0.8, borderColor: lineOf(c), paddingVertical: 6 };
  const showContact = !c.hide.has("contact") && !!p.contact, showPhone = !c.hide.has("phone") && !!p.phone, showEmail = !c.hide.has("email") && !!p.email;
  const taxLine = p.taxId ? `${formatTaxId(p.taxId)}  ${branchLabel(p.branchCode, p.branchName)}` : "";
  if (t.formStyle) {
    return (
      <View style={[{ flexDirection: "row", gap: 10 }, box]}>
        <View style={{ flex: 1 }}>
          <FormRow c={c} th={PARTY_NAME_LABEL[p.label] || p.label} value={p.name || "-"} labelWidth={c.labelWidth ?? 110} bold />
          {p.taxId ? <FormRow c={c} th="เลขประจำตัวผู้เสียภาษี" value={taxLine} labelWidth={c.labelWidth ?? 110} /> : null}
          {p.address ? <FormRow c={c} th="ที่อยู่" value={p.address} labelWidth={c.labelWidth ?? 110} /> : null}
        </View>
        {showContact || showPhone || showEmail ? (
          <View style={{ width: "34%" }}>
            {showContact ? <FormRow c={c} th={p.contactLabel || "ผู้ติดต่อ"} value={p.contact} labelWidth={c.labelWidth ? Math.round(c.labelWidth * 0.53) : 58} /> : null}
            {showPhone ? <FormRow c={c} th="โทร" value={p.phone} labelWidth={c.labelWidth ? Math.round(c.labelWidth * 0.53) : 58} /> : null}
            {showEmail ? <FormRow c={c} th="อีเมล" value={p.email} labelWidth={c.labelWidth ? Math.round(c.labelWidth * 0.53) : 58} /> : null}
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[{ flexDirection: "row", gap: 10 }, box]}>
      <View style={{ flex: 1 }}>
        <Lbl c={c} th={p.label} style={c.s.partyLabel} />
        <T style={{ fontWeight: "bold" }}>{p.name || "-"}</T>
        {p.address ? <T>{p.address}</T> : null}
        {p.taxId ? <T>เลขประจำตัวผู้เสียภาษี {taxLine}</T> : null}
      </View>
      {showContact || showPhone || showEmail ? (
        <View style={{ width: "34%" }}>
          <Lbl c={c} th={p.contactLabel || "ผู้ติดต่อ"} style={c.s.partyLabel} />
          {showContact ? <T>{p.contact}</T> : null}
          {showPhone ? <T>โทร {p.phone}</T> : null}
          {showEmail ? <T>{p.email}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

export function SectionItems({ c }: { c: Ctx }) {
  const { doc, t, s } = c;
  const hidden = new Set(c.per.hideColumns || []);
  // คอลัมน์ที่ตั้งในกล่องตาราง (ลำดับ หัวคอลัมน์ จัดวาง ความกว้าง) มาก่อน · ไม่เช่นนั้นใช้คอลัมน์ของเอกสาร ลบที่ซ่อนในธีม
  const spec = resolveColumns(c, (doc.columns || ["no", "description", "qty", "unit", "price", "amount"]).filter((k) => !hidden.has(k)) as ItemColumn[]);
  const cols: ColumnKey[] = spec.map((x) => x.key);
  const pctOf = (i: number) => (spec[i].width !== undefined ? spec[i].width! : COL[cols[i]].width === "auto" ? 0 : parseFloat(COL[cols[i]].width));
  // ไม่มีคอลัมน์อัตโนมัติ = แบ่งตามสัดส่วนความกว้างที่ตั้ง (เต็มตารางพอดี)
  const noAuto = cols.every((_k, i) => pctOf(i) > 0);
  const sumPct = cols.reduce((a, _k, i) => a + pctOf(i), 0) || 1;
  const alignOf = (i: number) => spec[i].align || COL[cols[i]].align;
  const labelOf = (i: number) => spec[i].label || doc.columnLabels?.[cols[i]] || COL[cols[i]].label;
  const cell = (k: ColumnKey) => {
    const i = cols.indexOf(k), w = pctOf(i);
    return { ...(noAuto ? { flexGrow: w, flexShrink: 1, flexBasis: 0 } : w ? { width: `${w}%` } : { flex: 1 }), textAlign: alignOf(i) };
  };
  const detailCol = cols.includes("detail");
  // ยืดตารางเต็มกล่อง (แบบฟอร์ม): เส้นคอลัมน์ลากถึงล่างกล่อง ไม่มีเส้นคั่นแถว
  const fill = !!(c.fill && c.box);
  const grid = t.table === "grid" && !fill;
  const head = c.headBg ? { backgroundColor: c.headBg } : t.table === "solid" ? { backgroundColor: t.primary } : t.table === "lines" ? { borderBottomWidth: 1.2, borderColor: t.primary } : { backgroundColor: `${t.primary}18` };
  const headText = c.headBg ? { color: onColor(c.headBg) } : t.table === "solid" ? { color: "#ffffff" } : {};
  const outer = t.table === "lines" && !fill ? {} : { borderWidth: c.lineWidth ?? 1, borderColor: fill ? c.lineColor || t.primary : lineOf(c), borderRadius: rad(c) };
  const xs: number[] = [];
  if (fill) {
    const W = c.box!.w;
    const fixed = cols.map((_k, i) => (noAuto ? (pctOf(i) / sumPct) * W : (pctOf(i) / 100) * W));
    const autoN = noAuto ? 0 : cols.filter((_k, i) => !pctOf(i)).length;
    const auto = autoN ? Math.max(0, W - fixed.reduce((a, b) => a + b, 0)) / autoN : 0;
    let x = 0;
    cols.forEach((_k, i) => { x += fixed[i] || auto; if (i < cols.length - 1) xs.push(x); });
  }
  let n = 0;
  return (
    <View style={[outer, fill ? { height: c.box!.h, position: "relative" } : {}]}>
      {fill ? xs.map((x, i) => <View key={`v${i}`} style={{ position: "absolute", left: x, top: 0, bottom: 0, borderLeftWidth: 0.6, borderColor: t.primary }} />) : null}
      <View style={[{ flexDirection: "row", borderBottomWidth: 1, borderColor: fill ? t.primary : lineOf(c), paddingVertical: 4 }, head]} fixed>
        {cols.map((k, i) => (
          <View key={k} style={[cell(k), grid && i ? { borderLeftWidth: 0.5, borderColor: lineOf(c) } : {}]}>
            <Lbl c={c} th={labelOf(i)} style={[s.thText, headText]} align={t.bilingual ? "center" : alignOf(i)} />
          </View>
        ))}
      </View>
      {doc.lines.length === 0 ? <T style={[s.td, { paddingVertical: 8, color: t.muted, textAlign: "center" }]}>ไม่มีรายการ</T> : null}
      {doc.lines.map((l, i) => {
        const zebra = t.table === "zebra" && i % 2 === 1 ? { backgroundColor: `${t.accent}0d` } : {};
        const rowStyle = [{ flexDirection: "row" as const, borderBottomWidth: fill ? 0 : 0.5, borderColor: grid ? lineOf(c) : c.lineColor || tint(c.t.primary, 0.9), paddingVertical: 3.5 }, zebra];
        if (l.heading) {
          if (c.hide.has("heading")) return null;
          // ตารางยืดเต็มกล่อง: หัวข้อหมวดอยู่ในช่องรายการ ไม่ทับเส้นคอลัมน์
          if (fill) return <View key={i} style={rowStyle} wrap={false}>{cols.map((k) => <View key={k} style={[s.td, cell(k)]}>{k === "description" ? <T style={{ fontWeight: "bold" }}>{l.description}</T> : null}</View>)}</View>;
          return <View key={i} style={rowStyle} wrap={false}><T style={[s.td, { flex: 1, fontWeight: "bold" }]}>{l.description}</T></View>;
        }
        n += 1;
        return (
          <View key={i} style={rowStyle} wrap={false}>
            {cols.map((k, j) => {
              const v = k === "no" ? String(n) : k === "code" ? l.code || "" : k === "description" ? l.description
                : k === "qty" ? (l.qty !== undefined ? qtyText(l.qty) : "") : k === "unit" ? l.unit || ""
                : k === "detail" ? l.detail || "" : k === "qtyUnit" ? (l.qty !== undefined ? `${qtyText(l.qty)} ${l.unit || ""}`.trim() : "")
                : k === "gross" ? (l.qty !== undefined && l.price !== undefined ? money(l.qty * l.price) : "")
                : k === "discountText" ? l.discountText || (l.discount ? money(l.discount) : "")
                : k === "price" ? (l.price !== undefined ? money(l.price) : "") : k === "discount" ? (l.discount ? money(l.discount) : "")
                : k === "debit" ? (l.debit ? money(l.debit) : "") : k === "credit" ? (l.credit ? money(l.credit) : "")
                : l.amount !== undefined ? money(l.amount) : "";
              return (
                <View key={k} style={[s.td, cell(k), grid && j ? { borderLeftWidth: 0.5, borderColor: lineOf(c) } : {}]}>
                  <T>{v}</T>
                  {k === "description" && l.detail && !detailCol && !c.hide.has("detail") ? <T style={s.small}>{l.detail}</T> : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function SectionWords({ c, align }: { c: Ctx; align?: "left" | "center" | "right" }) {
  return c.doc.amountInWords !== undefined ? <T style={[c.s.words, align ? { textAlign: align } : {}]}>({amountInWords(c.doc.amountInWords)})</T> : null;
}

export function SectionNotes({ c, align }: { c: Ctx; align?: "left" | "center" | "right" }) {
  // ข้อมูลที่วางแยกแล้ว (เช่น เงื่อนไขการชำระเงินในกล่องเลขที่) ไม่แสดงซ้ำในหมายเหตุ
  const shown = [...(c.shown || [])];
  const notes = [...(c.doc.notes || []), c.per.extraNote || ""].filter(Boolean).filter((n) => !shown.some((l) => n.startsWith(`${l}:`)));
  if (!notes.length) return null;
  const list = <View style={{ gap: 2, flex: c.t.formStyle ? 1 : undefined }}>{notes.map((t, i) => <T key={i} style={[c.t.formStyle ? {} : c.s.small, align ? { textAlign: align } : {}]}>{t}</T>)}</View>;
  if (!c.t.formStyle) return list;
  return <View style={{ flexDirection: "row", gap: 6 }}><Lbl c={c} th="หมายเหตุ" suffix=" :" style={{ fontWeight: "bold" }} />{list}</View>;
}

export function SectionPayment({ c, align }: { c: Ctx; align?: "left" | "center" | "right" }) {
  return c.doc.seller.paymentInfo ? <T style={[c.s.small, align ? { textAlign: align } : {}]}>การชำระเงิน: {c.doc.seller.paymentInfo}</T> : null;
}

/** ภาษีและยอดรวมทั้งสิ้นซ่อนไม่ได้ (เอกสารภาษี) */
const lockedTotal = (row: { label: string; strong?: boolean }) => !!row.strong || row.label.startsWith("ภาษีมูลค่าเพิ่ม") || row.label === "จำนวนเงินรวมทั้งสิ้น";

export function SectionTotals({ c }: { c: Ctx }) {
  const { t, doc, s } = c;
  const rows = doc.totals.filter((row) => lockedTotal(row) || !c.hide.has(`t:${row.label}`));
  if (t.totals === "grid") {
    return (
      <View style={{ borderWidth: 1, borderColor: t.primary, borderRadius: rad(c) }}>
        {rows.map((row, i) => (
          <View key={row.label} style={{ flexDirection: "row", borderTopWidth: i ? 0.6 : 0, borderColor: t.primary }}>
            <View style={{ flex: 1, backgroundColor: `${t.accent}${row.strong ? "cc" : "88"}`, paddingVertical: 2.5, paddingHorizontal: 6 }}>
              <Lbl c={c} th={row.label} suffix=" :" align="right" style={row.strong ? { fontWeight: "bold" } : {}} />
            </View>
            <View style={{ width: "44%", paddingVertical: 2.5, paddingHorizontal: 6, justifyContent: "center", borderLeftWidth: 0.6, borderColor: t.primary }}>
              <T style={{ textAlign: "right", fontWeight: row.strong ? "bold" : undefined }}>{money(row.amount)}</T>
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {rows.map((row) => {
        const strong = row.strong;
        const box = !strong ? {} : t.totals === "solid" ? { backgroundColor: t.primary, borderRadius: rad(c, 3), marginTop: 2 }
          : t.totals === "outline" ? { borderWidth: 1, borderColor: t.primary, borderRadius: rad(c, 3), marginTop: 2 } : { borderTopWidth: 1, borderColor: t.primary, marginTop: 2 };
        const text = strong && t.totals === "solid" ? { fontWeight: "bold" as const, color: "#ffffff" } : strong ? { fontWeight: "bold" as const, color: t.primary } : {};
        return (
          <View key={row.label} style={[s.totalRow, box]}>
            <Lbl c={c} th={row.label} style={text} />
            <T style={[{ fontWeight: "bold" as const }, text]}>{money(row.amount)}</T>
          </View>
        );
      })}
    </View>
  );
}

export function SectionSignatures({ c }: { c: Ctx }) {
  const labels = sigLabels(c);
  if (!labels.length) return null;
  const boxed = c.t.signatures === "box";
  return (
    <View style={{ flexDirection: "row", gap: c.gap ?? 16 }} wrap={false}>
      {labels.map((label, i) => {
        // ช่องที่เปลี่ยนชื่อในหน้าออกแบบ: ใช้ลายเซ็นของช่องลำดับเดียวกันในเอกสาร
        const real = c.doc.signatures.includes(label) ? label : c.doc.signatures[i] || label;
        const sg = c.doc.signed?.[label] || c.doc.signed?.[real];
        const st = c.doc.stamp && !c.stampPlaced && (c.doc.stamp.slots.includes(label) || c.doc.stamp.slots.includes(real)) ? c.doc.stamp : null;
        return (
          <View key={label} style={[c.s.signBox, { position: "relative" }, boxed ? { borderWidth: 0.8, borderColor: c.t.formStyle ? c.t.primary : lineOf(c), borderRadius: rad(c), paddingVertical: 6 } : {}]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt */}
            {sg?.image && !c.signPlaced?.has(label) && !c.signPlaced?.has(real) ? <Image src={sg.image} style={c.s.signImage} /> : <View style={c.s.signLine} />}
            {sg?.name ? <T style={{ marginTop: 3 }}>({sg.name})</T> : null}
            {sg?.title ? <T style={c.s.small}>{sg.title}</T> : null}
            {/* ตราประทับอิเล็กทรอนิกส์: ทับมุมขวาของลายเซ็น (เหมือนประทับจริง) */}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt */}
            {st ? <Image src={st.image} style={{ position: "absolute", width: st.size, height: st.size, objectFit: "contain", top: 0, right: 4, opacity: 0.92 }} /> : null}
            <View style={{ marginTop: sg?.name ? 0 : 3, alignItems: "center" }}><Lbl c={c} th={label} align="center" style={{ fontWeight: c.t.formStyle ? "bold" : undefined }} /></View>
            {c.hide.has("date") ? null : <T style={c.s.small}>{sg?.date ? `วันที่ ${thaiDate(sg.date)}` : "วันที่ ........../........../.........."}</T>}
          </View>
        );
      })}
    </View>
  );
}

export function SectionPhotos({ c }: { c: Ctx }) {
  if (!c.doc.photos?.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
      {c.doc.photos.map((ph, i) => (
        <View key={i} style={{ width: "48%", borderWidth: 1, borderColor: line, borderRadius: 4, padding: 4 }} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt */}
          <Image src={ph.src} style={c.s.photo} />
          <T style={[c.s.small, { textAlign: "center", marginTop: 2 }]}>{ph.label}</T>
        </View>
      ))}
    </View>
  );
}

export function PageChrome({ c }: { c: Ctx }) {
  const mark = c.doc.watermark || c.t.watermark;
  return (
    <>
      {mark ? <T style={[c.s.watermark, c.doc.watermark ? {} : { color: c.t.primary, opacity: 0.07 }]} fixed>{mark}</T> : null}
      <View style={{ position: "absolute", bottom: 18, left: c.t.margin, right: c.t.margin, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.t.muted }} fixed>
        <T style={{ maxWidth: "70%" }}>{c.doc.seller.footerNote || ""}</T>
        {c.t.showPageNumber ? (c.pageTotal ? <Text>{`${c.doc.number}  ·  หน้า 1/${c.pageTotal}`}</Text> : <Text render={({ pageNumber, totalPages }) => `${c.doc.number}  ·  หน้า ${pageNumber}/${totalPages}`} />) : null}
      </View>
    </>
  );
}

/** เตรียมธีมและการปรับของเอกสารชนิดนี้ */
export function documentContext(doc: DocumentModel, copy: CopyMode): Ctx {
  const { theme, doc: per, letterhead } = resolveDesign(doc.seller.design, doc.type, doc.seller.brandColor);
  return { doc, t: theme, s: themeStyles(theme), per, copy, lh: letterhead, hide: new Set() };
}

/** บริบทของกล่องหนึ่ง: ขนาดตัวอักษร ระยะบรรทัด สี ส่วนย่อยที่ซ่อน คอลัมน์ ช่องลงนาม ของกล่องนั้น */
export function blockContext(c: Ctx, raw: FreeBlock): Ctx {
  const b = resolveBlockColors(raw, c.t);
  const own = b.fontSize !== undefined || b.lineHeight !== undefined || !!b.color || b.radius !== undefined || !!b.table || !!b.totalsStyle || !!b.partyStyle;
  const t: DocTheme = own ? {
    ...c.t,
    ...(b.fontSize !== undefined ? { fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, b.fontSize)) } : {}),
    ...(b.color ? { text: b.color, primary: b.color, muted: b.color } : {}),
    ...(b.table ? { table: b.table } : {}), ...(b.totalsStyle ? { totals: b.totalsStyle } : {}), ...(b.partyStyle ? { party: b.partyStyle } : {}),
    ...(b.radius !== undefined ? { rounded: b.radius > 0 } : {}),
  } : c.t;
  return {
    ...c, t, s: own ? themeStyles(t, b.lineHeight ?? 1.35, b.radius) : c.s, hide: new Set(b.hide || []), cols: b.cols, colSpec: b.colSpec, labels: b.labels, fields: b.fields, gap: b.gap, fill: b.fill, box: { w: b.w, h: b.h },
    radius: b.radius, lineColor: b.lineColor, lineWidth: b.borderWidth, headBg: b.headBg, labelGap: b.labelGap, labelWidth: b.labelWidth, rowGap: b.rowGap,
  };
}

/** รูปแบบตัวอักษรของกล่อง: ฟอนต์ ตัวเอียง ขีดเส้นใต้/ขีดฆ่า ระยะห่างตัวอักษร (ข้อความในกล่องรับต่อ) */
function textDeco(b: FreeBlock) {
  const deco = [b.underline ? "underline" : "", b.strike ? "line-through" : ""].filter(Boolean).join(" ");
  return { ...(b.font ? { fontFamily: b.font } : {}), ...(b.italic ? { fontStyle: "italic" as const } : {}), ...(deco ? { textDecoration: deco as any } : {}), ...(b.letterSpacing ? { letterSpacing: b.letterSpacing } : {}) };
}

/** แทนค่าข้อมูลในกล่องข้อความ (รายการตัวแปรอยู่ที่ TEXT_VARIABLES) — ไม่รู้จัก/ไม่มีข้อมูล = ว่าง */
const fillVars = (text: string, doc: DocumentModel) => text.replace(/\{\{([^{}]{1,60})\}\}/g, (_m, key: string) => {
  const s = doc.seller, p = doc.party;
  switch (key) {
    case "number": return doc.number || "";
    case "date": return doc.date ? thaiDate(doc.date) : "";
    case "title": return doc.title || "";
    case "titleEn": return doc.titleEn || "";
    case "total": return doc.amountInWords !== undefined ? money(doc.amountInWords) : "";
    case "totalWords": return doc.amountInWords !== undefined ? amountInWords(doc.amountInWords) : "";
    case "customer": return p?.name || "";
    case "customer.address": return p?.address || "";
    case "customer.taxId": return p?.taxId ? formatTaxId(p.taxId) : "";
    case "customer.contact": return p?.contact || "";
    case "customer.phone": return p?.phone || "";
    case "customer.email": return p?.email || "";
    case "seller.name": return s.name || "";
    case "seller.nameEn": return s.nameEn || "";
    case "seller.address": return s.address || "";
    case "seller.taxId": return formatTaxId(s.taxId) || "";
    case "seller.phone": return s.phone || "";
    case "seller.email": return s.email || "";
    case "seller.website": return s.website || "";
    case "seller.payment": return s.paymentInfo || "";
  }
  if (key.startsWith("m:")) return doc.meta.find((m) => m.label === key.slice(2))?.value || "";
  if (key.startsWith("f:")) return doc.fields?.find((f) => f.key === key.slice(2))?.value || "";
  return "";
});

/**
 * กล่องหนึ่งกล่อง วางตำแหน่งแน่นอนบนหน้า (ผังลากวาง/หัวกระดาษ)
 * เนื้อหาวางในชั้นที่ไม่จำกัดความสูง — กล่องสูงตายตัวทำให้ react-pdf บีบบรรทัดซ้อนกันหรือทิ้งข้อความที่ไม่พอดี
 * items: เนื้อหาตารางที่ส่งมาเอง (FreeLayoutDocument ตัดรายการที่ล้นไปหน้าถัดไป) · letter: หนังสือไม่มีชื่อเอกสาร/เลขที่แบบเอกสารการค้า
 */
/** กล่องข้อความ/ข้อมูลที่ต้องไม่ล้นกรอบ: ตัวอักษรขนาดเดิม · ส่วนที่เกินกรอบถูกตัดตามขอบกรอบจริง (เห็นเท่าที่กรอบสูง) */
const CLIP_KINDS = ["text", "field", "info", "meta"];

export function BlockView({ c, b: raw, items, letter = false }: { c: Ctx; b: FreeBlock; items?: React.ReactNode; letter?: boolean }) {
  // ชิ้นที่ติ๊กไม่แสดง (ชุดที่แยกจากกล่องเดียวกัน)
  if (raw.off) return null;
  const b = resolveBlockColors(raw, c.t);
  const bc = blockContext(c, b);
  const own = b.fontSize !== undefined || b.lineHeight !== undefined || !!b.color;
  // ส่วนของเอกสาร (ผู้ขาย ชื่อเอกสาร ฯลฯ) จัดได้ ซ้าย/กลาง/ขวา — "เต็มบรรทัด" ใช้กับกล่องข้อความ
  const a3 = (b.align === "justify" ? "left" : b.align) as "left" | "center" | "right" | undefined;
  const content = (() => {
    switch (b.kind) {
      // โลโก้ในผังลากวาง: ขยายเต็มกล่อง (คงสัดส่วน · PNG โปร่งใสคงพื้นโปร่ง)
      // eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt
      case "logo": return c.doc.seller.logo ? <Image src={c.doc.seller.logo} style={{ width: b.w, height: b.h, objectFit: "contain" }} /> : null;
      case "seller": return <SectionSeller c={bc} align={a3} />;
      case "title": return letter ? null : <SectionTitle c={bc} align={a3 || "right"} />;
      case "meta": return letter ? null : <SectionMeta c={bc} align={a3 || "right"} />;
      case "party": return <SectionParty c={bc} />;
      case "items": return items ?? <SectionItems c={bc} />;
      case "totals": return <SectionTotals c={bc} />;
      case "words": return <SectionWords c={bc} align={a3} />;
      case "notes": return <SectionNotes c={bc} align={a3} />;
      case "payment": return <SectionPayment c={bc} align={a3} />;
      case "signatures": return <SectionSignatures c={bc} />;
      case "field": return <SectionField c={bc} b={b} />;
      case "info": return <SectionInfo c={bc} b={b} />;
      case "sign": {
        // ลายเซ็นอิเล็กทรอนิกส์ที่วางเอง: เฉพาะเอกสารที่มีลายเซ็นแล้ว (ออกจริง) · ชื่อ/ตำแหน่ง/วันที่ใต้ลายเซ็นเลือกแสดงได้
        const sg = b.signer ? c.doc.signed?.[`@${b.signer}`] : b.slot ? c.doc.signed?.[b.slot] : undefined;
        if (!sg?.image) return null;
        const hide = new Set(b.hide || []), fs = (b.fontSize || c.t.fontSize) * FONT_SCALE[b.font || c.t.font];
        const lines = [!hide.has("name") && sg.name ? `(${sg.name})` : "", !hide.has("title") ? sg.title || "" : "", !hide.has("date") && sg.date ? `วันที่ ${thaiDate(sg.date)}` : ""].filter(Boolean);
        return (
          <View style={{ width: SIGN_SIZE.w, alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt */}
            <Image src={sg.image} style={{ width: SIGN_SIZE.w, height: SIGN_SIZE.h, objectFit: "contain" }} />
            {lines.map((l) => <T key={l} style={{ fontSize: fs, lineHeight: 1.3, color: b.color || c.t.text, textAlign: "center" }}>{l}</T>)}
          </View>
        );
      }
      // ตราประทับ: พิมพ์เฉพาะเอกสารที่ใส่ตราอิเล็กทรอนิกส์ (ออกจริง และตั้งให้ประทับ)
      // eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt
      case "stamp": return c.doc.stamp ? <Image src={c.doc.stamp.image} style={{ width: c.doc.stamp.size, height: c.doc.stamp.size, objectFit: "contain", opacity: 0.92 }} /> : null;
      case "text": return <T style={{ fontSize: (b.fontSize || 10) * FONT_SCALE[b.font || c.t.font], lineHeight: b.lineHeight ?? 1.35, color: b.color || c.t.text, textAlign: b.align, fontWeight: b.bold ? "bold" : undefined, ...textDeco(b) }}>{fillVars(b.text || "", c.doc)}</T>;
      // eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt
      case "image": return b.src ? <Image src={b.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null;
      default: return null;
    }
  })();
  // กล่องที่มีกรอบ/พื้นหลัง: เว้นขอบในให้เนื้อหาไม่ชิดเส้น
  const pad = b.pad ?? (b.kind === "text" ? 2 : (b.border || b.bg) && b.kind !== "items" ? 4 : 0);
  if (b.kind === "line") {
    // เส้น: แนวนอนเมื่อกว้างกว่าสูง (ความหนา = สูง) · แนวตั้งเมื่อสูงกว่า (ความหนา = กว้าง) · เส้นประ/จุดวาดด้วยขอบ
    const vertical = b.h > b.w, thick = Math.max(0.25, vertical ? b.w : b.h), color = b.color || c.t.primary;
    const style = !b.dash || b.dash === "solid" ? { backgroundColor: color, width: vertical ? thick : b.w, height: vertical ? b.h : thick }
      : vertical ? { width: 0, height: b.h, borderLeftWidth: thick, borderLeftColor: color, borderStyle: b.dash } : { height: 0, width: b.w, borderTopWidth: thick, borderTopColor: color, borderStyle: b.dash };
    return <View style={{ position: "absolute", left: b.x, top: b.y, ...style }} />;
  }
  const radius = b.radius ?? (c.t.rounded ? 4 : 0);
  // มุมโค้งแยกแต่ละมุม (บนซ้าย บนขวา ล่างขวา ล่างซ้าย)
  const corners = b.radii ? { borderTopLeftRadius: b.radii[0], borderTopRightRadius: b.radii[1], borderBottomRightRadius: b.radii[2], borderBottomLeftRadius: b.radii[3] } : { borderRadius: radius };
  if (b.kind === "grid") {
    // ตารางเส้นสำหรับจัดแบบฟอร์ม: กรอบนอก + เส้นแบ่งแถว/คอลัมน์เท่ากัน (วางข้อความ/ข้อมูลลงในช่องเอง)
    const rows = b.rows || 3, cols = b.cols2 || 3, lw = b.borderWidth ?? 0.75, color = b.border || themeLine(c.t);
    const dash = b.dash && b.dash !== "solid" ? { borderStyle: b.dash } : {};
    return (
      <View style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, borderWidth: lw, borderColor: color, ...corners, ...dash, ...(b.bg ? { backgroundColor: b.bg } : {}), ...(b.opacity ? { opacity: b.opacity } : {}) }}>
        {b.headBg ? <View style={{ position: "absolute", left: 0, top: 0, right: 0, height: b.h / rows - lw, backgroundColor: b.headBg }} /> : null}
        {Array.from({ length: rows - 1 }, (_, i) => <View key={`r${i}`} style={{ position: "absolute", left: 0, right: 0, top: ((i + 1) * b.h) / rows - lw, height: 0, borderTopWidth: lw, borderColor: color, ...dash }} />)}
        {Array.from({ length: cols - 1 }, (_, j) => <View key={`c${j}`} style={{ position: "absolute", top: 0, bottom: 0, left: ((j + 1) * b.w) / cols - lw, width: 0, borderLeftWidth: lw, borderColor: color, ...dash }} />)}
      </View>
    );
  }
  if (b.kind === "shape") {
    // รูปทรง: วงรี/วงกลม · สามเหลี่ยม (วาดเป็นเวกเตอร์)
    const sw = b.border ? b.borderWidth ?? 1 : 0, dash = b.dash === "dashed" ? `${sw * 4} ${sw * 2.5}` : b.dash === "dotted" ? `${sw} ${sw * 1.8}` : undefined;
    const paint = { fill: b.bg || "none", stroke: b.border || "none", strokeWidth: sw, ...(dash ? { strokeDasharray: dash } : {}) };
    return (
      <Svg style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, ...(b.opacity ? { opacity: b.opacity } : {}) }} viewBox={`0 0 ${b.w} ${b.h}`}>
        {b.shape === "triangle"
          ? <Polygon points={`${b.w / 2},${sw / 2} ${b.w - sw / 2},${b.h - sw / 2} ${sw / 2},${b.h - sw / 2}`} {...paint} />
          : <Ellipse cx={b.w / 2} cy={b.h / 2} rx={Math.max(0, b.w / 2 - sw / 2)} ry={Math.max(0, b.h / 2 - sw / 2)} {...paint} />}
      </Svg>
    );
  }
  return (
    <View style={{
      position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h,
      ...(b.opacity ? { opacity: b.opacity } : {}),
      ...(b.bg ? { backgroundColor: b.bg, ...corners } : {}),
      ...(b.border ? { borderWidth: b.borderWidth ?? 1, borderColor: b.border, ...corners, ...(b.dash && b.dash !== "solid" ? { borderStyle: b.dash } : {}) } : {}),
    }}>
      {b.kind === "rect" ? null : b.kind === "image" || b.kind === "logo" || b.kind === "stamp" || b.kind === "sign"
        ? content
        : CLIP_KINDS.includes(b.kind)
          ? (
            <View style={{ position: "absolute", top: pad, left: pad, right: pad, height: Math.max(0, b.h - pad * 2), overflow: "hidden" }}>
              <View style={{ position: "absolute", left: 0, right: 0, ...(b.valign === "bottom" ? { bottom: 0 } : b.valign === "middle" ? { top: 0, bottom: 0, justifyContent: "center" } : { top: 0 }), ...(own ? { fontSize: bc.s.page.fontSize, lineHeight: bc.s.page.lineHeight, color: bc.t.text } : {}), ...(b.kind !== "text" ? textDeco(b) : {}) }}>{content}</View>
            </View>
          )
          : <View style={{ position: "absolute", top: pad, left: pad, right: pad, ...(b.valign ? { bottom: pad, justifyContent: b.valign === "middle" ? "center" : "flex-end" } : {}), ...(own ? { fontSize: bc.s.page.fontSize, lineHeight: bc.s.page.lineHeight, color: bc.t.text } : {}), ...(b.kind !== "text" ? textDeco(b) : {}) }}>{content}</View>}
    </View>
  );
}

/** หัวกระดาษ (กล่องตำแหน่งแน่นอนบนหน้าแรก) */
export function LetterheadBlocks({ c, letter = false }: { c: Ctx; letter?: boolean }) {
  return c.lh ? <>{c.lh.blocks.map((b) => <BlockView key={`lh-${b.id}`} c={c} b={b} letter={letter} />)}</> : null;
}

/** หัวกระดาษที่ไม่มีชื่อผู้ขาย/ชื่อเอกสาร/เลขที่-วันที่ (เช่น หัวหนังสือ): เติมใต้หัวกระดาษให้ข้อมูลภาษีครบเสมอ */
function LetterheadGaps({ c }: { c: Ctx }) {
  const blocks = c.lh?.blocks || [];
  const needSeller = !requiredSatisfied("seller", blocks);
  const needTitle = !requiredSatisfied("title", blocks);
  const needMeta = !legalFieldVisible(blocks, "number") || !legalFieldVisible(blocks, "date");
  if (!needSeller && !needTitle && !needMeta) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
      <View style={{ width: "56%" }}>{needSeller ? <SectionSeller c={c} /> : null}</View>
      <View style={{ width: "42%", alignItems: "flex-end" }}>{needTitle ? <SectionTitle c={c} /> : null}{needMeta ? <View style={{ marginTop: 4, alignSelf: c.t.formStyle ? "stretch" : "auto" }}><SectionMeta c={c} /></View> : null}</View>
    </View>
  );
}

function Header({ c }: { c: Ctx }) {
  const h = c.t.header;
  if (h === "centered") {
    return (
      <View style={{ alignItems: "center", gap: 4 }}>
        <SectionLogo c={c} />
        <SectionSeller c={c} align="center" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 6, alignItems: "flex-end" }}>
          <SectionTitle c={c} align="left" />
          <View style={c.t.formStyle ? { width: "48%" } : {}}><SectionMeta c={c} /></View>
        </View>
      </View>
    );
  }
  if (h === "banner") {
    return (
      <View>
        <View style={{ backgroundColor: c.t.primary, borderRadius: c.t.rounded ? 6 : 0, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
          {c.doc.seller.logo ? <View style={{ backgroundColor: "#ffffff", borderRadius: 4, padding: 3 }}><SectionLogo c={c} /></View> : null}
          <View style={{ flex: 1 }}><SectionSeller c={c} inverse /></View>
          <SectionTitle c={c} inverse />
        </View>
        <View style={{ marginTop: 6, alignSelf: c.t.formStyle ? "flex-end" : "auto", width: c.t.formStyle ? "42%" : undefined }}><SectionMeta c={c} /></View>
      </View>
    );
  }
  const right = h === "logo-right";
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ flexDirection: right ? "row-reverse" : "row", width: "58%", gap: 10 }}>
        <SectionLogo c={c} />
        <View style={{ flex: 1 }}><SectionSeller c={c} align={right ? "right" : "left"} /></View>
      </View>
      <View style={{ width: "42%", alignItems: "flex-end" }}>
        <SectionTitle c={c} />
        <View style={{ marginTop: 6, alignSelf: c.t.formStyle ? "stretch" : "auto" }}><SectionMeta c={c} /></View>
      </View>
    </View>
  );
}

export function StandardDocument({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  const c = documentContext(doc, copy);
  return (
    <Document title={`${docTitle(c)} ${doc.number}`} author={doc.seller.name} creator="NEXUS ERP">
      <Page size="A4" style={c.s.page} wrap>
        <PageChrome c={c} />
        {/* หัวกระดาษที่เลือก: วางกล่องบนหน้าแรก แล้วเว้นที่ให้เนื้อหาเริ่มใต้หัวกระดาษ */}
        {c.lh ? <><LetterheadBlocks c={c} /><View style={{ height: Math.max(0, c.lh.height - (c.t.margin - 2)) }} /><LetterheadGaps c={c} /></> : <Header c={c} />}
        <View style={{ marginTop: c.lh ? 0 : 12 }}><SectionParty c={c} /></View>
        <View style={{ marginTop: 12 }}><SectionItems c={c} /></View>
        <View style={{ flexDirection: "row", marginTop: 10, gap: 12 }} wrap={false}>
          <View style={{ flex: 1, gap: 6 }}>
            <SectionWords c={c} />
            <SectionNotes c={c} />
            <SectionPayment c={c} />
          </View>
          <View style={{ width: "40%" }}><SectionTotals c={c} /></View>
        </View>
        <SectionPhotos c={c} />
        <View style={{ marginTop: 26 }}><SectionSignatures c={c} /></View>
      </Page>
    </Document>
  );
}
