import React from "react";
import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import type { DocumentModel } from "@/lib/documents/model";
import { thaiDate } from "@/lib/documents/format";
import { FONT_SCALE } from "@/lib/documents/design";
import { LetterheadBlocks, T, documentContext } from "./StandardDocument";

/**
 * หนังสือ (รูปแบบหนังสือภายนอก): หัวบริษัท · ที่ · วันที่ · เรื่อง · เรียน · อ้างถึง · สิ่งที่ส่งมาด้วย · เนื้อความ · ลงนาม
 * ใช้เมื่อ DocumentModel มี letter (เลือกโดย DocumentPdf)
 * ฟอนต์ตามธีมของบริษัท · หัวกระดาษตามที่เลือกให้ "หนังสือ" (ตั้งค่า › ออกแบบเอกสาร) ถ้าไม่เลือกใช้หัวกึ่งกลางมาตรฐาน
 */
const ink = "#1a1a1a", muted = "#555555";
const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 56, fontFamily: "Sarabun", fontSize: 12, color: ink, lineHeight: 1.6 },
  head: { alignItems: "center", marginBottom: 14 },
  logo: { width: 60, height: 60, objectFit: "contain", marginBottom: 4 },
  seller: { fontSize: 14, fontWeight: "bold" },
  small: { fontSize: 10, color: muted, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  label: { width: 92 },
  line: { flexDirection: "row", marginTop: 2 },
  para: { marginTop: 8, textIndent: 48 },
  item: { marginTop: 2, marginLeft: 64 },
  sign: { marginTop: 28, marginLeft: "50%", alignItems: "center" },
  signLine: { marginTop: 36, width: 180, borderBottomWidth: 0.8, borderColor: "#888888" },
});

export function LetterDocument({ doc }: { doc: DocumentModel }) {
  const l = doc.letter!;
  const seller = doc.seller;
  const contactLine = [seller.phone ? `โทร ${seller.phone}` : "", seller.email ? `อีเมล ${seller.email}` : ""].filter(Boolean).join("  ");
  const isListItem = (p: string) => /^\d+\.\s/.test(p);
  const c = documentContext({ ...doc, type: "letter" }, "original");
  const font = { fontFamily: c.t.font, fontSize: 12 * FONT_SCALE[c.t.font] };
  return (
    <Document title={`${l.subject} ${doc.number || ""}`.trim()}>
      <Page size="A4" style={[s.page, font]}>
        {c.lh ? <><LetterheadBlocks c={c} letter /><View style={{ height: Math.max(0, c.lh.height - 36) }} /></> : (
        <View style={s.head}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt */}
          {seller.logo ? <Image src={seller.logo} style={s.logo} /> : null}
          <T style={s.seller}>{seller.name}</T>
          <T style={s.small}>{seller.address}</T>
          {contactLine ? <T style={s.small}>{contactLine}</T> : null}
        </View>
        )}
        <View style={s.row}>
          <T>ที่ {doc.number || "........"}</T>
          <T>{doc.date ? thaiDate(doc.date) : "วันที่ ........................"}</T>
        </View>
        <View style={[s.line, { marginTop: 12 }]}><T style={s.label}>เรื่อง</T><T style={{ flex: 1 }}>{l.subject}</T></View>
        <View style={s.line}><T style={s.label}>เรียน</T><T style={{ flex: 1 }}>{l.to}</T></View>
        {l.refs.length > 0 && <View style={s.line}><T style={s.label}>อ้างถึง</T><T style={{ flex: 1 }}>{l.refs.join(" · ")}</T></View>}
        {l.attachments.length > 0 && (
          <View style={s.line}>
            <T style={s.label}>สิ่งที่ส่งมาด้วย</T>
            <View style={{ flex: 1 }}>{l.attachments.map((a, i) => <T key={i}>{l.attachments.length > 1 ? `${i + 1}. ` : ""}{a}</T>)}</View>
          </View>
        )}
        <View style={{ marginTop: 6 }}>
          {l.body.map((p, i) => <T key={i} style={isListItem(p) ? s.item : s.para}>{p}</T>)}
        </View>
        <View style={s.sign}>
          <T>ขอแสดงความนับถือ</T>
          <View style={s.signLine} />
          <T>({l.signerName || "................................................"})</T>
          <T>{l.signerTitle || "ผู้มีอำนาจลงนาม"}</T>
          <T>{seller.name}</T>
        </View>
      </Page>
    </Document>
  );
}
