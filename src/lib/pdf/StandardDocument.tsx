import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ColumnKey, CopyMode, DocumentModel } from "@/lib/documents/model";
import { amountInWords, branchLabel, formatTaxId, money, qtyText, thaiDate } from "@/lib/documents/format";
import { FONT_SCALE, resolveDesign, type DocTheme, type FreeBlock, type ItemColumn, type Letterhead, type PerDocDesign } from "@/lib/documents/design";

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
  const f = (name: string) => `${base}/fonts/${encodeURIComponent(name)}`;
  Font.register({ family: "Sarabun", fonts: [{ src: f("Sarabun-Regular.ttf"), fontWeight: "normal" }, { src: f("Sarabun-Bold.ttf"), fontWeight: "bold" }] });
  Font.register({ family: "THSarabunNew", fonts: [{ src: f("THSarabun.ttf"), fontWeight: "normal" }, { src: f("THSarabun Bold.ttf"), fontWeight: "bold" }] });
  Font.register({ family: "THSarabunIT9", fonts: [{ src: f("THSarabunIT๙.ttf"), fontWeight: "normal" }, { src: f("THSarabunIT๙ Bold.ttf"), fontWeight: "bold" }] });
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
export function T({ children, ...rest }: { children?: React.ReactNode; style?: any; fixed?: boolean; wrap?: boolean; render?: any }) {
  return <Text {...rest}>{React.Children.map(children, fixThaiText)}</Text>;
}

export const COL: Record<ColumnKey, { label: string; width: string; align: "left" | "right" | "center" }> = {
  no: { label: "ลำดับ", width: "6%", align: "center" },
  code: { label: "รหัส", width: "13%", align: "left" },
  description: { label: "รายการ", width: "auto", align: "left" },
  qty: { label: "จำนวน", width: "9%", align: "right" },
  unit: { label: "หน่วย", width: "8%", align: "center" },
  price: { label: "ราคา/หน่วย", width: "13%", align: "right" },
  discount: { label: "ส่วนลด", width: "10%", align: "right" },
  amount: { label: "จำนวนเงิน", width: "14%", align: "right" },
  debit: { label: "เดบิต", width: "15%", align: "right" },
  credit: { label: "เครดิต", width: "15%", align: "right" },
};

const line = "#d9d9d9";

/** สไตล์ตามธีม (ขนาดตัวอักษรคูณสเกลของฟอนต์ ให้ TH Sarabun อ่านได้เท่ากัน) · lh = ระยะบรรทัดเนื้อหา */
export function themeStyles(t: DocTheme, lh = 1.35) {
  const k = FONT_SCALE[t.font] * (t.fontSize / 9.5);
  const fz = (n: number) => Math.round(n * k * 10) / 10;
  const r = t.rounded ? 4 : 0;
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
    thText: { fontSize: fz(8.5), fontWeight: "bold", paddingHorizontal: 4 },
    td: { paddingHorizontal: 4 },
    words: { borderWidth: 1, borderColor: line, borderRadius: r, padding: 6, fontWeight: "bold", textAlign: "center", backgroundColor: `${t.accent}10` },
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
export type Ctx = { doc: DocumentModel; t: DocTheme; s: ThemeStyles; per: PerDocDesign; copy: CopyMode; lh?: Letterhead; hide: Set<string>; cols?: ItemColumn[]; labels?: string[] };

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
      {c.hide.has("copy") ? null : <T style={[c.s.copyBox, inverse ? { borderColor: "#ffffff", color: "#ffffff" } : {}]}>{c.copy === "copy" ? "สำเนา" : "ต้นฉบับ"}</T>}
    </View>
  );
}

export function SectionMeta({ c, align = "right" }: { c: Ctx; align?: "left" | "center" | "right" }) {
  const rows = [{ label: "เลขที่", value: c.doc.number || "-" }, { label: "วันที่", value: c.doc.date ? thaiDate(c.doc.date) : "......../......../........" }, ...(c.hide.has("extra") ? [] : c.doc.meta)];
  return (
    <View>
      {rows.map((m) => (
        <View key={m.label} style={[c.s.metaRow, { justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start" }]}>
          <T style={c.s.metaLabel}>{m.label}</T><T style={c.s.metaValue}>{m.value || "-"}</T>
        </View>
      ))}
    </View>
  );
}

export function SectionParty({ c }: { c: Ctx }) {
  const p = c.doc.party;
  if (!p) return null;
  const t = c.t;
  const box = t.party === "boxed" ? { borderWidth: 1, borderColor: line, borderRadius: t.rounded ? 4 : 0, padding: 8 }
    : t.party === "accent-bar" ? { borderWidth: 1, borderColor: line, borderLeftWidth: 3, borderLeftColor: t.primary, borderRadius: t.rounded ? 4 : 0, padding: 8 }
    : { borderBottomWidth: 0.8, borderColor: line, paddingVertical: 6 };
  return (
    <View style={[{ flexDirection: "row", gap: 10 }, box]}>
      <View style={{ flex: 1 }}>
        <T style={c.s.partyLabel}>{p.label}</T>
        <T style={{ fontWeight: "bold" }}>{p.name || "-"}</T>
        {p.address ? <T>{p.address}</T> : null}
        {p.taxId ? <T>เลขประจำตัวผู้เสียภาษี {formatTaxId(p.taxId)}  {branchLabel(p.branchCode, p.branchName)}</T> : null}
      </View>
      {(p.contact || p.phone || p.email) && !c.hide.has("contact") ? (
        <View style={{ width: "34%" }}>
          <T style={c.s.partyLabel}>{p.contactLabel || "ผู้ติดต่อ"}</T>
          {p.contact ? <T>{p.contact}</T> : null}
          {p.phone ? <T>โทร {p.phone}</T> : null}
          {p.email ? <T>{p.email}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

export function SectionItems({ c }: { c: Ctx }) {
  const { doc, t, s } = c;
  const hidden = new Set(c.per.hideColumns || []);
  // คอลัมน์ที่เลือกในกล่องตาราง (ผังลากวาง) มาก่อน · ไม่เช่นนั้นใช้คอลัมน์ของเอกสาร ลบที่ซ่อนในธีม
  const cols: ColumnKey[] = c.cols?.length ? c.cols : (doc.columns || ["no", "description", "qty", "unit", "price", "amount"]).filter((k) => !hidden.has(k));
  const cell = (k: ColumnKey) => ({ ...(COL[k].width === "auto" ? { flex: 1 } : { width: COL[k].width }), textAlign: COL[k].align });
  const grid = t.table === "grid";
  const head = t.table === "solid" ? { backgroundColor: t.primary } : t.table === "lines" ? { borderBottomWidth: 1.2, borderColor: t.primary } : { backgroundColor: `${t.primary}18` };
  const headText = t.table === "solid" ? { color: "#ffffff" } : {};
  const outer = t.table === "lines" ? {} : { borderWidth: 1, borderColor: line, borderRadius: t.rounded ? 4 : 0 };
  let n = 0;
  return (
    <View style={outer}>
      <View style={[{ flexDirection: "row", borderBottomWidth: 1, borderColor: line, paddingVertical: 4 }, head]} fixed>
        {cols.map((k, i) => <T key={k} style={[s.thText, cell(k), headText, grid && i ? { borderLeftWidth: 0.5, borderColor: line } : {}]}>{COL[k].label}</T>)}
      </View>
      {doc.lines.length === 0 ? <T style={[s.td, { paddingVertical: 8, color: t.muted, textAlign: "center" }]}>ไม่มีรายการ</T> : null}
      {doc.lines.map((l, i) => {
        const zebra = t.table === "zebra" && i % 2 === 1 ? { backgroundColor: `${t.accent}0d` } : {};
        const rowStyle = [{ flexDirection: "row" as const, borderBottomWidth: 0.5, borderColor: grid ? line : "#eeeeee", paddingVertical: 3.5 }, zebra];
        if (l.heading) return c.hide.has("heading") ? null : <View key={i} style={rowStyle} wrap={false}><T style={[s.td, { flex: 1, fontWeight: "bold" }]}>{l.description}</T></View>;
        n += 1;
        return (
          <View key={i} style={rowStyle} wrap={false}>
            {cols.map((k, j) => {
              const v = k === "no" ? String(n) : k === "code" ? l.code || "" : k === "description" ? l.description
                : k === "qty" ? (l.qty !== undefined ? qtyText(l.qty) : "") : k === "unit" ? l.unit || ""
                : k === "price" ? (l.price !== undefined ? money(l.price) : "") : k === "discount" ? (l.discount ? money(l.discount) : "")
                : k === "debit" ? (l.debit ? money(l.debit) : "") : k === "credit" ? (l.credit ? money(l.credit) : "")
                : l.amount !== undefined ? money(l.amount) : "";
              return (
                <View key={k} style={[s.td, cell(k), grid && j ? { borderLeftWidth: 0.5, borderColor: line } : {}]}>
                  <T>{v}</T>
                  {k === "description" && l.detail && !c.hide.has("detail") ? <T style={s.small}>{l.detail}</T> : null}
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
  const notes = [...(c.doc.notes || []), c.per.extraNote || ""].filter(Boolean);
  return notes.length ? <View style={{ gap: 2 }}>{notes.map((t, i) => <T key={i} style={[c.s.small, align ? { textAlign: align } : {}]}>{t}</T>)}</View> : null;
}

export function SectionPayment({ c, align }: { c: Ctx; align?: "left" | "center" | "right" }) {
  return c.doc.seller.paymentInfo ? <T style={[c.s.small, align ? { textAlign: align } : {}]}>การชำระเงิน: {c.doc.seller.paymentInfo}</T> : null;
}

export function SectionTotals({ c }: { c: Ctx }) {
  const { t, doc, s } = c;
  return (
    <View>
      {doc.totals.map((row) => {
        const strong = row.strong;
        const box = !strong ? {} : t.totals === "solid" ? { backgroundColor: t.primary, borderRadius: t.rounded ? 3 : 0, marginTop: 2 }
          : t.totals === "outline" ? { borderWidth: 1, borderColor: t.primary, borderRadius: t.rounded ? 3 : 0, marginTop: 2 } : { borderTopWidth: 1, borderColor: t.primary, marginTop: 2 };
        const text = strong && t.totals === "solid" ? { fontWeight: "bold" as const, color: "#ffffff" } : strong ? { fontWeight: "bold" as const, color: t.primary } : {};
        return (
          <View key={row.label} style={[s.totalRow, box]}>
            <T style={text}>{row.label}</T>
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
    <View style={{ flexDirection: "row", gap: 16 }} wrap={false}>
      {labels.map((label) => {
        const sg = c.doc.signed?.[label];
        return (
          <View key={label} style={[c.s.signBox, boxed ? { borderWidth: 0.8, borderColor: line, borderRadius: c.t.rounded ? 4 : 0, paddingVertical: 6 } : {}]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt */}
            {sg?.image ? <Image src={sg.image} style={c.s.signImage} /> : <View style={c.s.signLine} />}
            {sg?.name ? <T style={{ marginTop: 3 }}>({sg.name})</T> : null}
            <T style={{ marginTop: sg?.name ? 0 : 3 }}>{label}</T>
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
        {c.t.showPageNumber ? <Text render={({ pageNumber, totalPages }) => `${c.doc.number}  ·  หน้า ${pageNumber}/${totalPages}`} /> : null}
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
export function blockContext(c: Ctx, b: FreeBlock): Ctx {
  const own = b.fontSize !== undefined || b.lineHeight !== undefined || !!b.color;
  const t = own ? { ...c.t, ...(b.fontSize !== undefined ? { fontSize: Math.min(16, Math.max(6, b.fontSize)) } : {}), ...(b.color ? { text: b.color, primary: b.color, muted: b.color } : {}) } : c.t;
  return { ...c, t, s: own ? themeStyles(t, b.lineHeight ?? 1.35) : c.s, hide: new Set(b.hide || []), cols: b.cols, labels: b.labels };
}

const fillVars = (text: string, doc: DocumentModel) => text
  .replace(/\{\{number\}\}/g, doc.number || "")
  .replace(/\{\{date\}\}/g, doc.date ? thaiDate(doc.date) : "")
  .replace(/\{\{customer\}\}/g, doc.party?.name || "")
  .replace(/\{\{title\}\}/g, doc.title || "")
  .replace(/\{\{total\}\}/g, doc.amountInWords !== undefined ? money(doc.amountInWords) : "");

/**
 * กล่องหนึ่งกล่อง วางตำแหน่งแน่นอนบนหน้า (ผังลากวาง/หัวกระดาษ)
 * เนื้อหาวางในชั้นที่ไม่จำกัดความสูง — กล่องสูงตายตัวทำให้ react-pdf บีบบรรทัดซ้อนกันหรือทิ้งข้อความที่ไม่พอดี
 * items: เนื้อหาตารางที่ส่งมาเอง (FreeLayoutDocument ตัดรายการที่ล้นไปหน้าถัดไป) · letter: หนังสือไม่มีชื่อเอกสาร/เลขที่แบบเอกสารการค้า
 */
export function BlockView({ c, b, items, letter = false }: { c: Ctx; b: FreeBlock; items?: React.ReactNode; letter?: boolean }) {
  const bc = blockContext(c, b);
  const own = b.fontSize !== undefined || b.lineHeight !== undefined || !!b.color;
  const content = (() => {
    switch (b.kind) {
      case "logo": return <SectionLogo c={bc} />;
      case "seller": return <SectionSeller c={bc} align={b.align} />;
      case "title": return letter ? null : <SectionTitle c={bc} align={b.align || "right"} />;
      case "meta": return letter ? null : <SectionMeta c={bc} align={b.align || "right"} />;
      case "party": return <SectionParty c={bc} />;
      case "items": return items ?? <SectionItems c={bc} />;
      case "totals": return <SectionTotals c={bc} />;
      case "words": return <SectionWords c={bc} align={b.align} />;
      case "notes": return <SectionNotes c={bc} align={b.align} />;
      case "payment": return <SectionPayment c={bc} align={b.align} />;
      case "signatures": return <SectionSignatures c={bc} />;
      case "text": return <T style={{ fontSize: (b.fontSize || 10) * FONT_SCALE[c.t.font], lineHeight: b.lineHeight ?? 1.35, color: b.color || c.t.text, textAlign: b.align, fontWeight: b.bold ? "bold" : undefined }}>{fillVars(b.text || "", c.doc)}</T>;
      // eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt
      case "image": return b.src ? <Image src={b.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null;
      default: return null;
    }
  })();
  const pad = b.kind === "text" ? 2 : 0;
  return (
    <View style={{
      position: "absolute", left: b.x, top: b.y, width: b.w, height: b.kind === "line" ? Math.max(1, b.h) : b.h,
      ...(b.kind === "line" ? { backgroundColor: b.color || c.t.primary } : {}),
      ...(b.bg ? { backgroundColor: b.bg } : {}),
      ...(b.border ? { borderWidth: 1, borderColor: b.border, borderRadius: c.t.rounded ? 4 : 0 } : {}),
    }}>
      {b.kind === "line" || b.kind === "rect" ? null : b.kind === "image"
        ? content
        : <View style={{ position: "absolute", top: pad, left: pad, right: pad, ...(own ? { fontSize: bc.s.page.fontSize, lineHeight: bc.s.page.lineHeight, color: bc.t.text } : {}) }}>{content}</View>}
    </View>
  );
}

/** หัวกระดาษ (กล่องตำแหน่งแน่นอนบนหน้าแรก) */
export function LetterheadBlocks({ c, letter = false }: { c: Ctx; letter?: boolean }) {
  return c.lh ? <>{c.lh.blocks.map((b) => <BlockView key={`lh-${b.id}`} c={c} b={b} letter={letter} />)}</> : null;
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
          <SectionMeta c={c} />
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
        <View style={{ marginTop: 6 }}><SectionMeta c={c} /></View>
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
        <View style={{ marginTop: 6 }}><SectionMeta c={c} /></View>
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
        {c.lh ? <><LetterheadBlocks c={c} /><View style={{ height: Math.max(0, c.lh.height - (c.t.margin - 2)) }} /></> : <Header c={c} />}
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
