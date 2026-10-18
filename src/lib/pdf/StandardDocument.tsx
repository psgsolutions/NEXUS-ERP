import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ColumnKey, CopyMode, DocumentModel } from "@/lib/documents/model";
import { amountInWords, branchLabel, formatTaxId, money, qtyText, thaiDate } from "@/lib/documents/format";

/**
 * เทมเพลตเอกสารมาตรฐาน A4 (ใช้ร่วมทุกประเภทเอกสาร) — ภาษาไทย Sarabun ตัดบรรทัดตามคำ
 * หัวเอกสาร: ผู้ขาย (ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา) | ชื่อเอกสาร เลขที่ วันที่ ต้นฉบับ/สำเนา
 */

let fontsReady = "";
const thaiSeg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

/** ลงทะเบียนฟอนต์ครั้งเดียวต่อ base URL (server ส่ง origin ของเว็บ, client ใช้ "") */
export function registerDocumentFonts(base: string) {
  if (fontsReady === base) return;
  Font.register({
    family: "Sarabun",
    fonts: [
      { src: `${base}/fonts/Sarabun-Regular.ttf`, fontWeight: "normal" },
      { src: `${base}/fonts/Sarabun-Bold.ttf`, fontWeight: "bold" },
    ],
  });
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
export function T({ children, ...rest }: { children?: React.ReactNode; style?: any; fixed?: boolean; wrap?: boolean }) {
  return <Text {...rest}>{React.Children.map(children, fixThaiText)}</Text>;
}

const COL: Record<ColumnKey, { label: string; width: string; align: "left" | "right" | "center" }> = {
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

const ink = "#1a1a1a", muted = "#666666", line = "#d9d9d9";
const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 48, paddingHorizontal: 32, fontFamily: "Sarabun", fontSize: 9.5, color: ink, lineHeight: 1.35 },
  row: { flexDirection: "row" },
  headerLeft: { flexDirection: "row", width: "58%", gap: 10 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  sellerName: { fontSize: 13, fontWeight: "bold", lineHeight: 1.5 },
  small: { fontSize: 8.5, color: muted },
  headerRight: { width: "42%", alignItems: "flex-end" },
  title: { fontSize: 17, fontWeight: "bold", textAlign: "right", lineHeight: 1.6 },
  copyBox: { marginTop: 3, paddingVertical: 1.5, paddingHorizontal: 8, borderWidth: 1, borderRadius: 3, fontSize: 9, fontWeight: "bold" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 1.5 },
  metaLabel: { color: muted, width: 70, textAlign: "right", marginRight: 6 },
  metaValue: { fontWeight: "bold", minWidth: 90, textAlign: "right" },
  party: { marginTop: 12, borderWidth: 1, borderColor: line, borderRadius: 4, padding: 8, flexDirection: "row", gap: 10 },
  partyLabel: { fontSize: 8.5, color: muted, marginBottom: 1 },
  table: { marginTop: 12, borderWidth: 1, borderColor: line, borderRadius: 4 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: line, paddingVertical: 4 },
  thText: { fontSize: 8.5, fontWeight: "bold", paddingHorizontal: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#eeeeee", paddingVertical: 3.5 },
  td: { paddingHorizontal: 4 },
  bottom: { flexDirection: "row", marginTop: 10, gap: 12 },
  words: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 6, fontWeight: "bold", textAlign: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 6 },
  signRow: { flexDirection: "row", marginTop: 26, gap: 16 },
  signBox: { flex: 1, alignItems: "center" },
  signLine: { width: "85%", borderBottomWidth: 0.8, borderColor: "#888888", height: 28 },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: muted },
  watermark: { position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", fontSize: 90, fontWeight: "bold", color: "#d32f2f", opacity: 0.12, transform: "rotate(-30deg)" },
});

export function StandardDocument({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  const brand = doc.seller.brandColor || "#1f6f5c";
  const cols: ColumnKey[] = doc.columns || ["no", "description", "qty", "unit", "price", "amount"];
  const seller = doc.seller;
  const p = doc.party;
  let n = 0;
  const cell = (k: ColumnKey) => ({ ...(COL[k].width === "auto" ? { flex: 1 } : { width: COL[k].width }), textAlign: COL[k].align });

  return (
    <Document title={`${doc.title} ${doc.number}`} author={seller.name} creator="NEXUS ERP">
      <Page size="A4" style={s.page} wrap>
        {doc.watermark ? <T style={s.watermark} fixed>{doc.watermark}</T> : null}

        {/* หัวเอกสาร */}
        <View style={s.row}>
          <View style={s.headerLeft}>
            {seller.logo ? <Image src={seller.logo} style={s.logo} /> : null}
            <View style={{ flex: 1 }}>
              <T style={[s.sellerName, { color: brand }]}>{seller.name || "(ยังไม่ได้ตั้งชื่อบริษัท)"}</T>
              {seller.nameEn ? <T style={s.small}>{seller.nameEn}</T> : null}
              {seller.address ? <T>{seller.address}</T> : null}
              <T>เลขประจำตัวผู้เสียภาษี {formatTaxId(seller.taxId) || "-"}  {branchLabel(seller.branchCode, seller.branchName)}</T>
              {[seller.phone && `โทร ${seller.phone}`, seller.email, seller.website].filter(Boolean).length ? (
                <T style={s.small}>{[seller.phone && `โทร ${seller.phone}`, seller.email, seller.website].filter(Boolean).join("  ·  ")}</T>
              ) : null}
            </View>
          </View>
          <View style={s.headerRight}>
            <T style={[s.title, { color: brand }]}>{doc.title}</T>
            {doc.titleEn ? <T style={s.small}>{doc.titleEn}</T> : null}
            <T style={[s.copyBox, { borderColor: brand, color: brand }]}>{copy === "copy" ? "สำเนา" : "ต้นฉบับ"}</T>
            <View style={{ marginTop: 6 }}>
              <View style={s.metaRow}><T style={s.metaLabel}>เลขที่</T><T style={s.metaValue}>{doc.number || "-"}</T></View>
              <View style={s.metaRow}><T style={s.metaLabel}>วันที่</T><T style={s.metaValue}>{thaiDate(doc.date)}</T></View>
              {doc.meta.map((m) => (
                <View key={m.label} style={s.metaRow}><T style={s.metaLabel}>{m.label}</T><T style={s.metaValue}>{m.value || "-"}</T></View>
              ))}
            </View>
          </View>
        </View>

        {/* คู่ค้า */}
        {p ? (
          <View style={[s.party, { borderLeftWidth: 3, borderLeftColor: brand }]}>
            <View style={{ flex: 1 }}>
              <T style={s.partyLabel}>{p.label}</T>
              <T style={{ fontWeight: "bold" }}>{p.name || "-"}</T>
              {p.address ? <T>{p.address}</T> : null}
              {p.taxId ? <T>เลขประจำตัวผู้เสียภาษี {formatTaxId(p.taxId)}  {branchLabel(p.branchCode, p.branchName)}</T> : null}
            </View>
            {p.contact || p.phone || p.email ? (
              <View style={{ width: "34%" }}>
                <T style={s.partyLabel}>{p.contactLabel || "ผู้ติดต่อ"}</T>
                {p.contact ? <T>{p.contact}</T> : null}
                {p.phone ? <T>โทร {p.phone}</T> : null}
                {p.email ? <T>{p.email}</T> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* รายการ */}
        <View style={s.table}>
          <View style={[s.th, { backgroundColor: `${brand}18` }]} fixed>
            {cols.map((k) => <T key={k} style={[s.thText, cell(k)]}>{COL[k].label}</T>)}
          </View>
          {doc.lines.length === 0 ? <T style={[s.td, { paddingVertical: 8, color: muted, textAlign: "center" }]}>ไม่มีรายการ</T> : null}
          {doc.lines.map((l, i) => {
            if (l.heading) return <View key={i} style={s.tr} wrap={false}><T style={[s.td, { flex: 1, fontWeight: "bold" }]}>{l.description}</T></View>;
            n += 1;
            return (
              <View key={i} style={s.tr} wrap={false}>
                {cols.map((k) => {
                  const v = k === "no" ? String(n) : k === "code" ? l.code || "" : k === "description" ? l.description
                    : k === "qty" ? (l.qty !== undefined ? qtyText(l.qty) : "") : k === "unit" ? l.unit || ""
                    : k === "price" ? (l.price !== undefined ? money(l.price) : "") : k === "discount" ? (l.discount ? money(l.discount) : "")
                    : k === "debit" ? (l.debit ? money(l.debit) : "") : k === "credit" ? (l.credit ? money(l.credit) : "")
                    : l.amount !== undefined ? money(l.amount) : "";
                  return (
                    <View key={k} style={[s.td, cell(k)]}>
                      <T>{v}</T>
                      {k === "description" && l.detail ? <T style={s.small}>{l.detail}</T> : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* ยอดรวม */}
        <View style={s.bottom} wrap={false}>
          <View style={{ flex: 1, gap: 6 }}>
            {doc.amountInWords !== undefined ? <T style={[s.words, { backgroundColor: `${brand}10` }]}>({amountInWords(doc.amountInWords)})</T> : null}
            {(doc.notes || []).filter(Boolean).map((t, i) => <T key={i} style={s.small}>{t}</T>)}
            {seller.paymentInfo ? <T style={s.small}>การชำระเงิน: {seller.paymentInfo}</T> : null}
          </View>
          <View style={{ width: "40%" }}>
            {doc.totals.map((t) => (
              <View key={t.label} style={[s.totalRow, t.strong ? { backgroundColor: brand, borderRadius: 3, marginTop: 2 } : {}]}>
                <T style={t.strong ? { fontWeight: "bold", color: "#ffffff" } : {}}>{t.label}</T>
                <T style={t.strong ? { fontWeight: "bold", color: "#ffffff" } : { fontWeight: "bold" }}>{money(t.amount)}</T>
              </View>
            ))}
          </View>
        </View>

        {/* ลงนาม */}
        {doc.signatures.length ? (
          <View style={s.signRow} wrap={false}>
            {doc.signatures.map((label) => (
              <View key={label} style={s.signBox}>
                <View style={s.signLine} />
                <T style={{ marginTop: 3 }}>{label}</T>
                <T style={s.small}>วันที่ ........../........../..........</T>
              </View>
            ))}
          </View>
        ) : null}

        {/* ท้ายกระดาษ */}
        <View style={s.footer} fixed>
          <T style={{ maxWidth: "70%" }}>{seller.footerNote || ""}</T>
          <Text render={({ pageNumber, totalPages }) => `${doc.number}  ·  หน้า ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
