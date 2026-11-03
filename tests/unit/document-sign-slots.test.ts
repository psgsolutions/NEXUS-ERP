import { describe, expect, it } from "vitest";
import React from "react";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { FreeLayoutDocument } from "@/lib/pdf/FreeLayoutDocument";
import { registerDocumentFonts } from "@/lib/pdf/StandardDocument";
import { sampleModelFor } from "@/lib/documents/build";
import { A4, defaultFreeLayout, normalizeDesign, type FreeBlock } from "@/lib/documents/design";

/** ข้อความแต่ละบรรทัดบนหน้าแรก (ตัดช่องว่าง) พร้อมตำแหน่งจากขอบบน (pt) */
async function pageLines(buf: Buffer): Promise<{ text: string; top: number; left: number }[]> {
  const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const tc = await (await pdf.getPage(1)).getTextContent();
  const rows = new Map<number, { text: string; left: number }>();
  for (const i of tc.items as any[]) {
    const y = Math.round(A4.h - i.transform[5]);
    const r = rows.get(y);
    rows.set(y, { text: (r?.text || "") + i.str, left: Math.min(r?.left ?? Infinity, i.transform[4]) });
  }
  return [...rows].map(([top, r]) => ({ top, left: r.left, text: r.text.replace(/\s+/g, "").replace(/ํา/g, "ำ") }));
}

const seller = (design: any) => ({ name: "บริษัท ทดสอบ จำกัด", taxId: "0105555555555", branchCode: "00000", address: "1 ถนนทดสอบ", design }) as any;

describe("signature slots: per-slot options and several signature blocks", () => {
  it("keeps valid options and drops invalid ones when saving", () => {
    const layout = defaultFreeLayout("invoice");
    const sign = layout.blocks.find((b) => b.kind === "signatures")!;
    Object.assign(sign, {
      slotFrame: "dashed",
      signSlots: [{ label: "ผู้อนุมัติ", line: "dotted", noBracket: true, labelPos: "above", hideLabel: false, name: "text", nameText: "สมชาย" }, { label: "ผู้รับเงิน", line: "zigzag", labelPos: "left" }],
    });
    const extras: any[] = [
      { id: "signatures-a1", kind: "signatures", x: 300, y: 600, w: 200, h: 80, signSlots: [{ label: "ผู้รับสินค้า" }] },
      { id: "w1", kind: "line", x: 40, y: 500, w: 200, h: 1, arrow: "both" },
      { id: "w2", kind: "line", x: 40, y: 510, w: 200, h: 1, arrow: "sideways" },
      { id: "st", kind: "stamp", x: 40, y: 520, w: 72, h: 72, rotate: -12 },
      { id: "im", kind: "image", x: 40, y: 520, w: 72, h: 72, fit: "cover", rotate: 400 },
      { id: "rc", kind: "rect", x: 40, y: 520, w: 72, h: 72, fit: "cover", rotate: 30 },
    ];
    const words = layout.blocks.find((b) => b.kind === "words")!;
    Object.assign(words, { bracket: true, prefix: "ตัวอักษร" });
    const d = normalizeDesign({ perDoc: { invoice: { free: { ...layout, blocks: [...layout.blocks, ...extras], enabled: true } } } });
    const blocks = d.perDoc!.invoice!.free!.blocks;
    const s = blocks.find((b) => b.id === "signatures")!;
    expect(s.slotFrame).toBe("dashed");
    expect(s.signSlots![0]).toMatchObject({ line: "dotted", noBracket: true, labelPos: "above" });
    expect(s.signSlots![0].hideLabel).toBeUndefined();
    expect(s.signSlots![1].line).toBeUndefined();
    expect(s.signSlots![1].labelPos).toBeUndefined();
    expect(blocks.filter((b) => b.kind === "signatures")).toHaveLength(2);
    const by = (id: string) => blocks.find((b) => b.id === id) as FreeBlock;
    expect(by("w1").arrow).toBe("both");
    expect(by("w2").arrow).toBeUndefined();
    expect(by("st").rotate).toBe(-12);
    expect(by("im")).toMatchObject({ fit: "cover", rotate: 180 });
    expect(by("rc").fit).toBeUndefined();
    expect(by("rc").rotate).toBeUndefined();
    const w = blocks.find((b) => b.kind === "words")!;
    expect(w).toMatchObject({ bracket: true, prefix: "ตัวอักษร" });
  });

  it("prints the options: label above the line, name without brackets, a second block, words with prefix and brackets", async () => {
    const layout = defaultFreeLayout("invoice");
    const sign = layout.blocks.find((b) => b.kind === "signatures")!;
    sign.signSlots = [
      { label: "ผู้อนุมัติ", labelPos: "above", name: "text", nameText: "สมชาย ใจดี", noBracket: true, title: "กรรมการผู้จัดการ", line: "dashed", date: "none" },
      { label: "ผู้รับเงิน", name: "blank", date: "none" },
    ];
    sign.slotFrame = "solid";
    const extra: FreeBlock = { id: "signatures-x1", kind: "signatures", x: 300, y: 380, w: 200, h: 70, signSlots: [{ label: "ผู้รับสินค้า", name: "customer", date: "none" }], align: "left" };
    const words = layout.blocks.find((b) => b.kind === "words")!;
    words.bracket = true; words.prefix = "ตัวอักษร";
    const arrow: FreeBlock = { id: "ar", kind: "line", x: 40, y: 540, w: 200, h: 1.5, arrow: "end", color: "#000000" };
    const design = normalizeDesign({ perDoc: { invoice: { free: { ...layout, blocks: [...layout.blocks, extra, arrow], enabled: true } } } });
    const doc = sampleModelFor("invoice", seller(design), "2026-11-03");
    registerDocumentFonts(path.join(process.cwd(), "public"));
    const buf = await renderToBuffer(React.createElement(FreeLayoutDocument, { doc }) as any);
    // ดูภาพจริง: SIGN_PDF_OUT=<ไฟล์> npx vitest run tests/unit/document-sign-slots.test.ts
    if (process.env.SIGN_PDF_OUT) (await import("node:fs")).writeFileSync(process.env.SIGN_PDF_OUT, buf);
    const lines = await pageLines(buf);
    const find = (s: string) => lines.find((l) => l.text.includes(s));
    const approver = find("ผู้อนุมัติ"), name = find("สมชายใจดี");
    expect(approver && name).toBeTruthy();
    expect(approver!.top).toBeLessThan(name!.top); // หน้าที่อยู่เหนือเส้นเซ็น
    expect(name!.text).not.toContain("(สมชายใจดี)"); // ไม่ใส่วงเล็บ
    expect(find("กรรมการผู้จัดการ")).toBeTruthy();
    expect(find("(....")).toBeTruthy(); // ช่องผู้รับเงิน: ชื่อว่างในวงเล็บ
    const receiver = find("ผู้รับสินค้า");
    expect(receiver).toBeTruthy(); // ชุดที่สอง
    expect(receiver!.top).toBeGreaterThanOrEqual(380);
    expect(receiver!.top).toBeLessThan(460);
    expect(find(`(${doc.party!.name.replace(/\s+/g, "")})`)).toBeTruthy(); // ชื่อลูกค้าใต้เส้นของชุดที่สอง
    expect(lines.some((l) => /ตัวอักษร\(.+บาท.*\)/.test(l.text))).toBe(true);
    expect(lines.some((l) => l.text.includes("วันที่....") && l.top > 700)).toBe(false); // ปิดบรรทัดวันที่ทุกช่อง
  }, 60_000);
});
