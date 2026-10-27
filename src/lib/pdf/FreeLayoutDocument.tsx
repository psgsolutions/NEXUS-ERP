import React from "react";
import { Document, Page, View } from "@react-pdf/renderer";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";
import { FONT_SCALE, docHasCopy, pageOf, type FreeBlock } from "@/lib/documents/design";
import { BlockView, LetterheadBlocks, PageChrome, SectionItems, T, blockContext, documentContext } from "./StandardDocument";

/**
 * เอกสารตามผังลากวางอิสระ (ตั้งค่า › ออกแบบเอกสาร › โหมดลากวาง)
 * - กล่องวางตามตำแหน่งที่ออกแบบบนหน้าแรก ใช้ส่วนประกอบเดียวกับเทมเพลตมาตรฐาน (ข้อมูลภาษีครบเสมอ)
 * - มีหัวกระดาษที่เลือก: วางกล่องของหัวกระดาษก่อน กล่องชนิดเดียวกันในผังของเอกสารไม่วาดซ้ำ
 * - รายการเกินกล่อง: แสดงเท่าที่พอ แล้วต่อในหน้าถัดไป (หัวกระดาษย่อ + ตาราง)
 */
/** กล่องที่มีได้ชุดเดียวต่อหน้า: อยู่ในหัวกระดาษแล้วไม่วาดซ้ำจากผังเอกสาร */
export const DEDUP_KINDS = ["seller", "title", "meta", "party"];

export function FreeLayoutDocument({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  const base = documentContext(doc, copy);
  // ข้อมูลเพิ่มที่วางแล้ว (ในกล่องเลขที่/ช่องข้อมูล) — หมายเหตุไม่แสดงซ้ำ
  const placed = [...(base.lh?.blocks || []), ...(base.per.free?.blocks || [])].filter((b) => !b.off);
  const placedKeys = new Set(placed.flatMap((b) => (b.kind === "meta" || b.kind === "info" ? b.fields || [] : b.kind === "field" && b.field ? [b.field] : [])));
  const c = { ...base, stampPlaced: placed.some((b) => b.kind === "stamp"), signPlaced: new Set(placed.filter((b) => b.kind === "sign" && b.slot && !b.signer).map((b) => b.slot!)), shown: new Set((doc.fields || []).filter((f) => placedKeys.has(`f:${f.key}`)).map((f) => f.label)) };
  const headKinds = new Set((c.lh?.blocks || []).filter((b) => DEDUP_KINDS.includes(b.kind)).map((b) => b.kind));
  const blocks: FreeBlock[] = (c.per.free?.blocks || []).filter((b) => !headKinds.has(b.kind));
  // เอกสารที่ต้องมีต้นฉบับ/สำเนา แต่ผังไม่มีที่แสดง (กล่องชื่อเอกสารเล็ก/แยกช่อง): พิมพ์ป้ายมุมขวาบนของหน้าให้เสมอ
  const allBlocks = [...(c.lh?.blocks || []), ...blocks];
  const copyMissing = docHasCopy(doc.type) && !allBlocks.some((b) => (b.kind === "title" && !(b.hide || []).includes("copy")) || (b.kind === "field" && b.field === "copy" && !b.off) || (b.kind === "info" && (b.fields || []).includes("copy")));
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
  // ขนาดกระดาษ/แนวตามที่ตั้งในผัง (ไม่ตั้ง = A4 แนวตั้ง)
  const pg = pageOf(c.per.free);
  const firstItems = (
    <View>
      <SectionItems c={{ ...ic, doc: { ...doc, lines: doc.lines.slice(0, cap) } }} />
      {rest.length ? <T style={[ic.s.small, { textAlign: "right", marginTop: 2 }]}>รายการต่อหน้าถัดไป ({rest.length} รายการ)</T> : null}
    </View>
  );

  return (
    <Document title={`${c.per.title || doc.title} ${doc.number}`} author={doc.seller.name} creator="NEXUS ERP">
      <Page size={[pg.w, pg.h]} style={[c.s.page, { padding: 0 }]}>
        <PageChrome c={c} />
        <LetterheadBlocks c={c} />
        {blocks.map((b) => <BlockView key={b.id} c={c} b={b} items={b.kind === "items" ? firstItems : undefined} />)}
        {copyMissing ? <T style={[c.s.copyBox, { position: "absolute", top: 4, right: 26 }]}>{copy === "copy" ? "สำเนา" : "ต้นฉบับ"}</T> : null}
      </Page>
      {rest.length ? (
        <Page size={[pg.w, pg.h]} style={c.s.page} wrap>
          <PageChrome c={c} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <T style={c.s.sellerName}>{doc.seller.name}</T>
            <T style={{ fontWeight: "bold" }}>{c.per.title || doc.title} {doc.number} (ต่อ)</T>
          </View>
          <SectionItems c={{ ...ic, fill: false, doc: { ...doc, lines: rest } }} />
        </Page>
      ) : null}
    </Document>
  );
}
