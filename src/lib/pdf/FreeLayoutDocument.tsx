import React from "react";
import { Document, Page, View } from "@react-pdf/renderer";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";
import { FONT_SCALE, type FreeBlock } from "@/lib/documents/design";
import { BlockView, LetterheadBlocks, PageChrome, SectionItems, T, blockContext, documentContext } from "./StandardDocument";

/**
 * เอกสารตามผังลากวางอิสระ (ตั้งค่า › ออกแบบเอกสาร › โหมดลากวาง)
 * - กล่องวางตามตำแหน่งที่ออกแบบบนหน้าแรก ใช้ส่วนประกอบเดียวกับเทมเพลตมาตรฐาน (ข้อมูลภาษีครบเสมอ)
 * - มีหัวกระดาษที่เลือก: วางกล่องของหัวกระดาษก่อน กล่องชนิดเดียวกันในผังของเอกสารไม่วาดซ้ำ
 * - รายการเกินกล่อง: แสดงเท่าที่พอ แล้วต่อในหน้าถัดไป (หัวกระดาษย่อ + ตาราง)
 */
export function FreeLayoutDocument({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  const c = documentContext(doc, copy);
  const headKinds = new Set((c.lh?.blocks || []).filter((b) => !["text", "line", "rect", "image"].includes(b.kind)).map((b) => b.kind));
  const blocks: FreeBlock[] = (c.per.free?.blocks || []).filter((b) => !headKinds.has(b.kind));
  // ความจุของกล่องตาราง (ประมาณความสูงทีละแถว รวมบรรทัดที่ตัดขึ้นใหม่และรายละเอียด) — ส่วนที่เกินไปหน้าถัดไป
  const items = blocks.find((b) => b.kind === "items");
  const ic = items ? blockContext(c, items) : c;
  const lineH = ic.t.fontSize * FONT_SCALE[ic.t.font] * (items?.lineHeight ?? 1.35);
  const charsPerLine = items ? Math.max(10, (items.w * 0.5) / (ic.t.fontSize * FONT_SCALE[ic.t.font] * 0.42)) : 1;
  const rowHeight = (l: DocumentModel["lines"][number]) =>
    7 + lineH * Math.max(1, Math.ceil((l.description || "").length / charsPerLine)) + (l.detail && !ic.hide.has("detail") ? lineH * 0.85 : 0);
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
  const rest = doc.lines.slice(cap);
  const firstItems = (
    <View>
      <SectionItems c={{ ...ic, doc: { ...doc, lines: doc.lines.slice(0, cap) } }} />
      {rest.length ? <T style={[ic.s.small, { textAlign: "right", marginTop: 2 }]}>รายการต่อหน้าถัดไป ({rest.length} รายการ)</T> : null}
    </View>
  );

  return (
    <Document title={`${c.per.title || doc.title} ${doc.number}`} author={doc.seller.name} creator="NEXUS ERP">
      <Page size="A4" style={[c.s.page, { padding: 0 }]}>
        <PageChrome c={c} />
        <LetterheadBlocks c={c} />
        {blocks.map((b) => <BlockView key={b.id} c={c} b={b} items={b.kind === "items" ? firstItems : undefined} />)}
      </Page>
      {rest.length ? (
        <Page size="A4" style={c.s.page} wrap>
          <PageChrome c={c} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <T style={c.s.sellerName}>{doc.seller.name}</T>
            <T style={{ fontWeight: "bold" }}>{c.per.title || doc.title} {doc.number} (ต่อ)</T>
          </View>
          <SectionItems c={{ ...ic, doc: { ...doc, lines: rest } }} />
        </Page>
      ) : null}
    </Document>
  );
}
