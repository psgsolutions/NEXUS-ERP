import React from "react";
import { Document, Image, Page, View } from "@react-pdf/renderer";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";
import { money, thaiDate } from "@/lib/documents/format";
import { FONT_SCALE, type FreeBlock } from "@/lib/documents/design";
import {
  PageChrome, SectionItems, SectionLogo, SectionMeta, SectionNotes, SectionParty, SectionPayment, SectionSeller,
  SectionSignatures, SectionTitle, SectionTotals, SectionWords, T, documentContext,
} from "./StandardDocument";

/**
 * เอกสารตามผังลากวางอิสระ (ตั้งค่า › ออกแบบเอกสาร › โหมดลากวาง)
 * - กล่องวางตามตำแหน่งที่ออกแบบบนหน้าแรก ใช้ส่วนประกอบเดียวกับเทมเพลตมาตรฐาน (ข้อมูลภาษีครบเสมอ)
 * - รายการเกินกล่อง: แสดงเท่าที่พอ แล้วต่อในหน้าถัดไป (หัวกระดาษย่อ + ตาราง)
 */
const fill = (text: string, doc: DocumentModel) => text
  .replace(/\{\{number\}\}/g, doc.number || "")
  .replace(/\{\{date\}\}/g, doc.date ? thaiDate(doc.date) : "")
  .replace(/\{\{customer\}\}/g, doc.party?.name || "")
  .replace(/\{\{title\}\}/g, doc.title || "")
  .replace(/\{\{total\}\}/g, doc.amountInWords !== undefined ? money(doc.amountInWords) : "");

export function FreeLayoutDocument({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  const c = documentContext(doc, copy);
  const blocks: FreeBlock[] = c.per.free?.blocks || [];
  // ความจุของกล่องตาราง (ประมาณความสูงทีละแถว รวมบรรทัดที่ตัดขึ้นใหม่และรายละเอียด) — ส่วนที่เกินไปหน้าถัดไป
  const lineH = c.t.fontSize * FONT_SCALE[c.t.font] * 1.35;
  const items = blocks.find((b) => b.kind === "items");
  const charsPerLine = items ? Math.max(10, (items.w * 0.5) / (c.t.fontSize * FONT_SCALE[c.t.font] * 0.42)) : 1;
  const rowHeight = (l: DocumentModel["lines"][number]) =>
    7 + lineH * Math.max(1, Math.ceil((l.description || "").length / charsPerLine)) + (l.detail ? lineH * 0.85 : 0);
  let cap = doc.lines.length;
  if (items) {
    let used = lineH + 12; // หัวตาราง + บรรทัด "รายการต่อหน้าถัดไป"
    cap = 0;
    for (const l of doc.lines) {
      used += rowHeight(l);
      if (used > items.h) break;
      cap += 1;
    }
    cap = Math.max(1, cap);
  }
  const first = { ...doc, lines: doc.lines.slice(0, cap) };
  const rest = doc.lines.slice(cap);
  const firstCtx = { ...c, doc: first };

  const render = (b: FreeBlock) => {
    const textStyle = { fontSize: b.fontSize, color: b.color, textAlign: b.align, fontWeight: b.bold ? ("bold" as const) : undefined };
    switch (b.kind) {
      case "logo": return <SectionLogo c={c} />;
      case "seller": return <SectionSeller c={c} align={b.align} />;
      case "title": return <SectionTitle c={c} align={b.align || "right"} />;
      case "meta": return <SectionMeta c={c} align={b.align === "left" ? "left" : "right"} />;
      case "party": return <SectionParty c={c} />;
      case "items": return (
        <View>
          <SectionItems c={firstCtx} />
          {rest.length ? <T style={[c.s.small, { textAlign: "right", marginTop: 2 }]}>รายการต่อหน้าถัดไป ({rest.length} รายการ)</T> : null}
        </View>
      );
      case "totals": return <SectionTotals c={c} />;
      case "words": return <SectionWords c={c} />;
      case "notes": return <SectionNotes c={c} />;
      case "payment": return <SectionPayment c={c} />;
      case "signatures": return <SectionSignatures c={c} />;
      case "text": return <T style={textStyle}>{fill(b.text || "", doc)}</T>;
      // eslint-disable-next-line jsx-a11y/alt-text -- Image ของ react-pdf (PDF) ไม่มี alt
      case "image": return b.src ? <Image src={b.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null;
      default: return null;
    }
  };

  return (
    <Document title={`${c.per.title || doc.title} ${doc.number}`} author={doc.seller.name} creator="NEXUS ERP">
      <Page size="A4" style={[c.s.page, { padding: 0 }]}>
        <PageChrome c={c} />
        {blocks.map((b) => (
          <View key={b.id} style={{
            position: "absolute", left: b.x, top: b.y, width: b.w, height: b.kind === "line" ? Math.max(1, b.h) : b.h,
            ...(b.kind === "line" ? { backgroundColor: b.color || c.t.primary } : {}),
            ...(b.bg ? { backgroundColor: b.bg } : {}),
            ...(b.border ? { borderWidth: 1, borderColor: b.border, borderRadius: c.t.rounded ? 4 : 0 } : {}),
          }}>
            {/* เนื้อหาวางในชั้นที่ไม่จำกัดความสูง — กล่องสูงตายตัวทำให้ react-pdf บีบบรรทัดซ้อนกันหรือทิ้งข้อความที่ไม่พอดี */}
            {b.kind === "line" || b.kind === "rect" ? null : b.kind === "image"
              ? render(b)
              : <View style={{ position: "absolute", top: b.kind === "text" ? 2 : 0, left: b.kind === "text" ? 2 : 0, right: b.kind === "text" ? 2 : 0 }}>{render(b)}</View>}
          </View>
        ))}
      </Page>
      {rest.length ? (
        <Page size="A4" style={c.s.page} wrap>
          <PageChrome c={c} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <T style={c.s.sellerName}>{doc.seller.name}</T>
            <T style={{ fontWeight: "bold" }}>{c.per.title || doc.title} {doc.number} (ต่อ)</T>
          </View>
          <SectionItems c={{ ...c, doc: { ...doc, lines: rest } }} />
        </Page>
      ) : null}
    </Document>
  );
}
