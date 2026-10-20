import { describe, expect, it } from "vitest";
import { REQUIRED_BLOCKS, TEMPLATES, applyLayoutToAll, defaultFreeLayout, normalizeDesign, normalizeFreeLayout, normalizeTheme } from "@/lib/documents/design";

describe("document design", () => {
  it("normalizes theme input and keeps brand color as default", () => {
    const t = normalizeTheme({ font: "Comic", fontSize: 50, primary: "red", header: "centered", margin: 5 }, "#123456");
    expect(t).toMatchObject({ font: "Sarabun", fontSize: 12, primary: "#123456", header: "centered", margin: 20 });
    expect(TEMPLATES.map((x) => x.id)).toEqual(["modern", "classic", "government", "minimal", "bold", "elegant"]);
    expect(normalizeTheme(TEMPLATES[2].theme).font).toBe("THSarabunIT9");
  });

  it("free layout: clamps blocks, drops unknown kinds, restores required tax blocks", () => {
    const f = normalizeFreeLayout({ enabled: true, blocks: [{ kind: "text", x: -5, y: 9999, w: 100, h: 20, text: "สวัสดี {{number}}" }, { kind: "virus" }, { kind: "image", src: "javascript:alert(1)" }] })!;
    expect(f.blocks[0]).toMatchObject({ kind: "text", x: 0, text: "สวัสดี {{number}}" });
    expect(f.blocks.some((b: any) => b.kind === "virus")).toBe(false);
    expect(f.blocks.find((b) => b.kind === "image")?.src).toBeUndefined();
    for (const k of REQUIRED_BLOCKS) expect(f.blocks.some((b) => b.kind === k)).toBe(true);
  });

  it("per-document overrides and applying one layout to all documents", () => {
    const d = normalizeDesign({ perDoc: { quotation: { title: "ใบเสนอราคา/QUOTATION", hideColumns: ["code", "taxId"], free: { ...defaultFreeLayout(), enabled: true } }, "BAD KEY": { title: "x" } } });
    expect(Object.keys(d.perDoc)).toEqual(["quotation"]);
    expect(d.perDoc.quotation.hideColumns).toEqual(["code"]);
    const all = applyLayoutToAll(d, "quotation", ["quotation", "invoice", "receipt"]);
    expect(all.perDoc.invoice.free?.enabled).toBe(true);
    expect(all.perDoc.receipt.free?.blocks.length).toBe(d.perDoc.quotation.free!.blocks.length);
    expect(all.perDoc.quotation.title).toBe("ใบเสนอราคา/QUOTATION");
  });
});
