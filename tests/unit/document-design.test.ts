import { describe, expect, it } from "vitest";
import { REQUIRED_BLOCKS, TEMPLATES, addableBlocksFor, applyLayoutToAll, defaultFreeLayout, docHasAmounts, letterheadTemplate, normalizeDesign, normalizeFreeLayout, normalizeTheme, requiredBlocksFor, requiredColumnsFor, resolveDesign } from "@/lib/documents/design";

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

describe("document design — block settings, per-document blocks, letterheads", () => {
  it("keeps block typography and only known parts/columns/labels", () => {
    const f = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "s", kind: "seller", x: 10, y: 10, w: 200, h: 60, fontSize: 11, lineHeight: 9, color: "#ffffff", hide: ["nameEn", "taxId", "contact"] },
      { id: "i", kind: "items", x: 10, y: 100, w: 500, h: 300, cols: ["qty", "amount", "hack"], hide: ["detail"] },
      { id: "g", kind: "signatures", x: 10, y: 700, w: 500, h: 80, labels: ["ผู้จัดทำ", "", "ผู้อนุมัติ", "a", "b", "c"] },
    ] }, "quotation")!;
    expect(f.blocks[0]).toMatchObject({ fontSize: 11, lineHeight: 2.5, color: "#ffffff", hide: ["nameEn", "contact"] });
    expect(f.blocks[1].cols).toEqual(["description", "qty", "amount"]);
    expect(f.blocks[2].labels).toEqual(["ผู้จัดทำ", "ผู้อนุมัติ", "a", "b"]);
  });

  it("documents without amounts do not need totals or amount in words", () => {
    expect(docHasAmounts("delivery_note")).toBe(false);
    expect(requiredBlocksFor("delivery_note")).not.toContain("totals");
    expect(defaultFreeLayout("delivery_note").blocks.some((b) => b.kind === "totals" || b.kind === "words")).toBe(false);
    expect(addableBlocksFor("work_order")).not.toContain("words");
    expect(requiredColumnsFor("invoice")).toEqual(["description", "amount"]);
    const f = normalizeFreeLayout({ enabled: true, blocks: [] }, "delivery_note")!;
    expect(f.blocks.some((b) => b.kind === "totals")).toBe(false);
  });

  it("letterheads: templates, head-only kinds, assignments must exist", () => {
    const lh = letterheadTemplate("letter", "lh-a", "#123456");
    expect(lh.blocks.map((b) => b.kind)).toEqual(["logo", "seller", "line"]);
    const d = normalizeDesign({
      letterheads: [lh, { id: "lh-b", name: "x", height: 999, blocks: [{ kind: "items", x: 0, y: 0, w: 10, h: 10 }, { kind: "text", x: 0, y: 0, w: 10, h: 10, text: "หัว" }] }],
      perDoc: { letter: { letterhead: "lh-a" }, quotation: { letterhead: "missing" }, invoice: { letterhead: "lh-b" } },
    });
    expect(d.letterheads.map((l) => l.id)).toEqual(["lh-a", "lh-b"]);
    expect(d.letterheads[1]).toMatchObject({ height: 320 });
    expect(d.letterheads[1].blocks.map((b) => b.kind)).toEqual(["text"]);
    expect(d.perDoc.letter.letterhead).toBe("lh-a");
    expect(d.perDoc.quotation).toBeUndefined();
    expect(resolveDesign(d, "invoice").letterhead?.id).toBe("lh-b");
    expect(resolveDesign(d, "receipt").letterhead).toBeUndefined();
  });

  it("apply to all: copies letterhead, leaves item columns and totals per document", () => {
    const free = { ...defaultFreeLayout("quotation"), enabled: true };
    free.blocks = free.blocks.map((b) => (b.kind === "items" ? { ...b, cols: ["description", "price", "amount"] as any } : b));
    const d = normalizeDesign({ letterheads: [letterheadTemplate("trade", "lh-t")], perDoc: { quotation: { free, letterhead: "lh-t" } } });
    const all = applyLayoutToAll(d, "quotation", ["delivery_note", "receipt"]);
    expect(all.perDoc.delivery_note.letterhead).toBe("lh-t");
    expect(all.perDoc.delivery_note.free!.blocks.some((b) => b.kind === "totals")).toBe(false);
    expect(all.perDoc.receipt.free!.blocks.find((b) => b.kind === "items")!.cols).toBeUndefined();
  });
});
