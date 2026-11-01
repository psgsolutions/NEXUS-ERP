import { describe, expect, it } from "vitest";
import React from "react";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { FreeLayoutDocument } from "@/lib/pdf/FreeLayoutDocument";
import { registerDocumentFonts } from "@/lib/pdf/StandardDocument";
import { sampleModelFor } from "@/lib/documents/build";
import { A4, defaultFreeLayout, normalizeDesign } from "@/lib/documents/design";

/**
 * ข้อความบนหน้าแรกพร้อมตำแหน่งบรรทัด (pt จากขอบบน) — ข้อความที่ถูกตัดตามกรอบยังอยู่ในไฟล์ จึงต้องเทียบตำแหน่งกับกรอบ
 * สระอำถูกพิมพ์เป็น นิคหิต + สระอา (แก้การแสดงผลฟอนต์) — รวมกลับก่อนเทียบ
 */
async function pageLines(buf: Buffer): Promise<{ text: string; top: number }[]> {
  const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const tc = await (await pdf.getPage(1)).getTextContent();
  const rows = new Map<number, string>();
  for (const i of tc.items as any[]) { const y = Math.round(A4.h - i.transform[5]); rows.set(y, (rows.get(y) || "") + i.str); }
  return [...rows].map(([top, text]) => ({ top, text: text.replace(/\s+/g, "").replace(/ํา/g, "ำ") }));
}
const lineOf = (lines: { text: string; top: number }[], s: string) => lines.find((l) => l.text.includes(s));

describe("fixed form keeps legally required data inside the designed frame (ม.86/4)", () => {
  it("long buyer address in a small box and many totals rows: tax ID, VAT and grand total stay inside their boxes", async () => {
    const layout = defaultFreeLayout("invoice");
    const party = layout.blocks.find((b) => b.kind === "party")!;
    party.h = 44; // กรอบเล็กกว่าข้อมูลจริง
    const totals = layout.blocks.find((b) => b.kind === "totals")!;
    totals.h = 60; // ข้อมูลจริงมี 7 แถว (ส่วนลด หัก ณ ที่จ่าย) — กรอบออกแบบไว้พอแค่ 4 แถว
    const design = normalizeDesign({ perDoc: { invoice: { free: { ...layout, enabled: true } } } });
    const seller = { name: "บริษัท ทดสอบ จำกัด", taxId: "0105555555555", branchCode: "00000", address: "1 ถนนทดสอบ", design } as any;
    const doc = sampleModelFor("invoice", seller, "2026-10-30");
    doc.party = { ...doc.party!, address: "เลขที่ 999/99 อาคารทดสอบชั้น 12 ห้อง 1201 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310 ", taxId: "0109999999999", branchCode: "00000" };
    registerDocumentFonts(path.join(process.cwd(), "public"));
    const lines = await pageLines(await renderToBuffer(React.createElement(FreeLayoutDocument, { doc }) as any));
    const inside = (s: string, b: { y: number; h: number }) => { const l = lineOf(lines, s); expect(l, s).toBeTruthy(); expect(l!.top, s).toBeGreaterThanOrEqual(b.y); expect(l!.top, s).toBeLessThanOrEqual(b.y + b.h); };
    inside("1099-99999-99-9", party);
    inside("ภาษีมูลค่าเพิ่ม", totals);
    inside("จำนวนเงินรวมทั้งสิ้น", totals);
    inside("ยอดชำระสุทธิ", totals);
  }, 60_000);
});

describe("totals labels never wrap to a second line", () => {
  it("long bracketed label moves its bracket under the main text, row height unchanged", async () => {
    const layout = defaultFreeLayout("invoice");
    const totals = layout.blocks.find((b) => b.kind === "totals")!;
    totals.w = 150;
    const design = normalizeDesign({ perDoc: { invoice: { free: { ...layout, enabled: true } } } });
    const seller = { name: "บริษัท ทดสอบ จำกัด", taxId: "0105555555555", branchCode: "00000", address: "1 ถนนทดสอบ", design } as any;
    const doc = sampleModelFor("invoice", seller, "2026-10-30");
    doc.totals = [
      { label: "รวมเป็นเงิน", amount: 1000 },
      { label: "มูลค่าก่อนภาษี (ส่วนที่เป็นใบกำกับภาษี)", amount: 934.58 },
      { label: "ภาษีมูลค่าเพิ่ม 7%", amount: 65.42 },
      { label: "จำนวนเงินรวมทั้งสิ้น", amount: 1000, strong: true },
    ];
    registerDocumentFonts(path.join(process.cwd(), "public"));
    const lines = await pageLines(await renderToBuffer(React.createElement(FreeLayoutDocument, { doc }) as any));
    const main = lineOf(lines, "มูลค่าก่อนภาษี")!, sub = lineOf(lines, "(ส่วนที่เป็นใบกำกับภาษี)")!;
    expect(main && sub).toBeTruthy();
    expect(main.text).not.toContain("(ส่วน"); // วงเล็บแยกลงบรรทัดใต้
    expect(sub.top).toBeGreaterThan(main.top);
    // ระยะระหว่างแถวก่อนหน้า/ถัดไปเท่ากับแถวปกติ (ตารางไม่สูงขึ้น)
    const r1 = lineOf(lines, "รวมเป็นเงิน")!, r3 = lineOf(lines, "ภาษีมูลค่าเพิ่ม")!, r4 = lineOf(lines, "จำนวนเงินรวมทั้งสิ้น")!;
    expect(Math.abs((r3.top - r1.top) / 2 - (r4.top - r3.top))).toBeLessThanOrEqual(3);
    expect(r4.top).toBeLessThanOrEqual(totals.y + totals.h);
  }, 60_000);
});

describe("placeable original/copy label", () => {
  it("prints at the placed position in the chosen style and replaces the label under the title", async () => {
    const layout = defaultFreeLayout("invoice");
    layout.blocks.push({ id: "copy-1", kind: "copy", x: 40, y: 300, w: 100, h: 36, copyStyle: "stamp" });
    const design = normalizeDesign({ perDoc: { invoice: { free: { ...layout, enabled: true } } } });
    const blk = design.perDoc.invoice!.free!.blocks.find((b) => b.kind === "copy")!;
    expect(blk.copyStyle).toBe("stamp");
    const seller = { name: "บริษัท ทดสอบ จำกัด", taxId: "0105555555555", branchCode: "00000", address: "1 ถนนทดสอบ", design } as any;
    const doc = sampleModelFor("invoice", seller, "2026-10-30");
    registerDocumentFonts(path.join(process.cwd(), "public"));
    for (const [copy, word] of [["original", "ต้นฉบับ"], ["copy", "สำเนา"]] as const) {
      const lines = await pageLines(await renderToBuffer(React.createElement(FreeLayoutDocument, { doc, copy }) as any));
      const hits = lines.filter((l) => l.text.includes(word));
      expect(hits.length, word).toBe(1); // ไม่ซ้ำใต้ชื่อเอกสาร
      expect(hits[0].top).toBeGreaterThan(300);
      expect(hits[0].top).toBeLessThan(345);
    }
  }, 60_000);
  it("is only addable on documents that have original/copy", async () => {
    const { addableBlocksFor } = await import("@/lib/documents/design");
    expect(addableBlocksFor("invoice")).toContain("copy");
    expect(addableBlocksFor("quotation")).not.toContain("copy");
  });
});
