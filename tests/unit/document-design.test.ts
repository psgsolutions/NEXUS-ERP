import { describe, expect, it } from "vitest";
import { DESIGNABLE_DOCS } from "@/lib/documents/build";
import { templateLayout } from "@/lib/documents/layout-templates";
import { legalFieldVisible, requiredSatisfied, resolveBlockColors, resolveColor, tint, REQUIRED_BLOCKS, TEMPLATES, addableBlocksFor, applyLayoutToAll, defaultFreeLayout, docHasAmounts, letterheadTemplate, normalizeDesign, normalizeFreeLayout, normalizeTheme, requiredBlocksFor, requiredColumnsFor, resolveDesign } from "@/lib/documents/design";

describe("document design", () => {
  it("normalizes theme input and keeps brand color as default", () => {
    const t = normalizeTheme({ font: "Comic", fontSize: 50, primary: "red", header: "centered", margin: 5 }, "#123456");
    expect(t).toMatchObject({ font: "Sarabun", fontSize: 12, primary: "#123456", header: "centered", margin: 20 });
    expect(TEMPLATES.map((x) => x.id).slice(0, 6)).toEqual(["modern", "classic", "government", "minimal", "bold", "elegant"]);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TEMPLATES.map((x) => x.id)).size).toBe(TEMPLATES.length);
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
    expect(requiredColumnsFor("invoice")).toEqual(["description", "qty", "amount"]); // ใบกำกับภาษี ม.86/4 (5) ต้องมีปริมาณ
    expect(requiredColumnsFor("quotation")).toEqual(["description", "amount"]);
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

describe("document design — template layouts, field rows, legal fields", () => {
  it("every template layout keeps required blocks and shows number/date for every document", () => {
    for (const t of TEMPLATES.filter((x) => x.layout)) {
      for (const d of DESIGNABLE_DOCS) {
        const design = normalizeDesign({ theme: t.theme, perDoc: { [d.type]: { free: templateLayout(t.layout, d.type, t.theme) } } });
        const blocks = design.perDoc[d.type].free!.blocks;
        for (const k of requiredBlocksFor(d.type)) expect(blocks.some((b) => b.kind === k), `${t.id}/${d.type}/${k}`).toBe(true);
        expect(legalFieldVisible(blocks, "number"), `${t.id}/${d.type} number`).toBe(true);
        expect(legalFieldVisible(blocks, "date"), `${t.id}/${d.type} date`).toBe(true);
        for (const b of blocks) { expect(b.x + b.w).toBeLessThanOrEqual(596); expect(b.y + b.h).toBeLessThanOrEqual(842); }
      }
    }
  });

  it("meta rows, extra fields, totals rows and field blocks are validated", () => {
    const f = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "m", kind: "meta", x: 0, y: 0, w: 200, h: 80, hide: ["m:โครงการ", "extra", "t:x"], fields: ["f:paymentTerms", "f:bad key", "m:x"] },
      { id: "t", kind: "totals", x: 0, y: 100, w: 200, h: 80, hide: ["t:ส่วนลดท้ายบิล", "m:x"] },
      { id: "f", kind: "field", x: 0, y: 200, w: 100, h: 18, field: "javascript:", hideLabel: true },
      { id: "s", kind: "signatures", x: 0, y: 700, w: 500, h: 80, gap: 999 },
      { id: "i", kind: "items", x: 0, y: 300, w: 500, h: 300, fill: 1 },
    ] }, "quotation")!;
    const by = (id: string) => f.blocks.find((b) => b.id === id)!;
    expect(by("m")).toMatchObject({ hide: ["m:โครงการ"], fields: ["f:paymentTerms"] });
    expect(by("t").hide).toEqual(["t:ส่วนลดท้ายบิล"]);
    expect(by("f")).toMatchObject({ field: "number", hideLabel: true });
    expect(by("s").gap).toBe(300);
    expect(by("i").fill).toBe(true);
  });

  it("number/date cannot disappear: hidden in meta without another place is restored", () => {
    const free = { enabled: true, blocks: [...defaultFreeLayout("quotation").blocks.filter((b) => b.kind !== "meta"), { id: "meta", kind: "meta", x: 0, y: 0, w: 100, h: 40, hide: ["number", "date"] }] };
    const d = normalizeDesign({ perDoc: { quotation: { free } } });
    expect(d.perDoc.quotation.free!.blocks.find((b) => b.kind === "meta")!.hide).toEqual([]);
    const withField = { ...free, blocks: [...free.blocks, { id: "n", kind: "field", field: "number", x: 0, y: 50, w: 100, h: 18 }] };
    const d2 = normalizeDesign({ perDoc: { quotation: { free: withField } } });
    expect(d2.perDoc.quotation.free!.blocks.find((b) => b.kind === "meta")!.hide).toEqual(["number"]);
  });
});

describe("document design — lines, frames, corners, table styling", () => {
  it("keeps line/frame/table settings within limits", () => {
    const f = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "v", kind: "line", x: 100, y: 100, w: 0.5, h: 200, dash: "dashed", color: "#ff0000" },
      { id: "r", kind: "rect", x: 0, y: 0, w: 100, h: 50, border: "#00aa00", borderWidth: 99, radius: 99, dash: "wavy" },
      { id: "i", kind: "items", x: 0, y: 300, w: 500, h: 200, table: "zebra", headBg: "#123456", lineColor: "red", totalsStyle: "x" },
      { id: "t", kind: "totals", x: 0, y: 600, w: 200, h: 80, totalsStyle: "grid", radius: 0 },
      { id: "p", kind: "party", x: 0, y: 150, w: 500, h: 60, partyStyle: "boxed" },
    ] }, "quotation")!;
    const by = (id: string) => f.blocks.find((b) => b.id === id)!;
    expect(by("v")).toMatchObject({ w: 0.5, h: 200, dash: "dashed" });
    expect(by("r")).toMatchObject({ borderWidth: 8, radius: 40 });
    expect(by("r").dash).toBeUndefined();
    expect(by("i")).toMatchObject({ table: "zebra", headBg: "#123456" });
    expect(by("i").lineColor).toBeUndefined();
    expect(by("t")).toMatchObject({ totalsStyle: "grid", radius: 0 });
    expect(by("p").partyStyle).toBe("boxed");
  });

  it("standard layout fits the document's meta rows (2 shown, rest hidden)", () => {
    const meta = DESIGNABLE_DOCS.find((d) => d.type === "quotation")!.meta;
    const l = defaultFreeLayout("quotation", "Sarabun", meta);
    const m = l.blocks.find((b) => b.kind === "meta")!, p = l.blocks.find((b) => b.kind === "party")!;
    expect(m.hide).toEqual(meta.slice(2).map((x) => `m:${x}`));
    expect(m.y + m.h).toBeLessThanOrEqual(p.y);
  });
});

describe("document design — template catalog and theme colours", () => {
  it("has at least 50 templates per document type, one logo each, colours from the theme", () => {
    const withLayout = TEMPLATES.filter((t) => t.layout);
    expect(withLayout.length).toBeGreaterThanOrEqual(50);
    for (const t of withLayout) for (const d of DESIGNABLE_DOCS) {
      const blocks = templateLayout(t.layout, d.type, t.theme).blocks;
      expect(blocks.filter((b) => b.kind === "logo").length, `${t.id}/${d.type} logos`).toBeLessThanOrEqual(1);
      for (const b of blocks) for (const c of [b.bg, b.border, b.lineColor, b.headBg]) if (c) expect(c.startsWith("@") || c === "#ffffff", `${t.id} ${b.id} ${c}`).toBe(true);
      expect(new Set(blocks.map((b) => b.id)).size, `${t.id}/${d.type} ids`).toBe(blocks.length);
    }
  });

  it("theme colour tokens survive normalisation and resolve from the palette", () => {
    const f = normalizeFreeLayout({ enabled: true, blocks: [{ id: "r", kind: "rect", x: 0, y: 0, w: 10, h: 10, bg: "@accent", border: "@primary", lineColor: "@bogus" }] })!;
    const r = f.blocks.find((b) => b.id === "r")!;
    expect(r).toMatchObject({ bg: "@accent", border: "@primary" });
    expect(r.lineColor).toBeUndefined();
    const theme = normalizeTheme({ primary: "#112233", accent: "#445566" });
    expect(resolveBlockColors(r, theme)).toMatchObject({ bg: "#445566", border: "#112233" });
    expect(resolveColor("@line", theme)).toBe(tint("#112233", 0.72));
  });
});

describe("document design — split boxes into fields, groups", () => {
  it("split seller/party/meta fields count as the required boxes and keep their group", () => {
    const base = defaultFreeLayout("quotation").blocks.filter((b) => !["seller", "party", "meta"].includes(b.kind));
    const f = (field: string, y: number) => ({ id: `f-${field.replace(/\W/g, "")}`, kind: "field", field, x: 40, y, w: 200, h: 14, group: "g-seller" });
    const raw = { enabled: true, blocks: [...base, f("seller.name", 20), f("seller.address", 36), f("seller.taxId", 52), f("customer.name", 160), f("customer.address", 176), f("customer.taxId", 192), f("number", 100), f("date", 116)] };
    const out = normalizeFreeLayout(raw, "quotation")!;
    for (const k of ["seller", "party", "meta"]) expect(out.blocks.some((b) => b.kind === k), k).toBe(false);
    expect(requiredSatisfied("seller", out.blocks)).toBe(true);
    expect(out.blocks.find((b) => b.field === "seller.name")!.group).toBe("g-seller");
    // ขาดเลขผู้เสียภาษีผู้ขาย → คืนกล่องผู้ขายให้ (ข้อมูลภาษีต้องครบ)
    const missing = normalizeFreeLayout({ ...raw, blocks: raw.blocks.filter((b: any) => b.field !== "seller.taxId") }, "quotation")!;
    expect(missing.blocks.some((b) => b.kind === "seller")).toBe(true);
  });

  it("rejects unknown field keys and bad group ids", () => {
    const out = normalizeFreeLayout({ enabled: true, blocks: [{ id: "x", kind: "field", field: "seller.password", x: 0, y: 0, w: 10, h: 10, group: "BAD GROUP!" }] })!;
    const x = out.blocks.find((b) => b.id === "x")!;
    expect(x.field).toBe("number");
    expect(x.group).toBeUndefined();
  });
});

describe("document design — data boxes and table column spec", () => {
  it("info boxes keep chosen fields in order, count toward legal boxes, and drop unknown keys", () => {
    const base = defaultFreeLayout("quotation").blocks.filter((b) => b.kind !== "seller" && b.kind !== "meta");
    const raw = { enabled: true, blocks: [...base,
      { id: "i1", kind: "info", x: 40, y: 20, w: 260, h: 60, fields: ["seller.taxId", "seller.name", "seller.address", "seller.password", "seller.name"], emphasizeFirst: true, names: { "seller.taxId": "Tax ID", "customer.name": "x" }, labelWidth: 999 },
      { id: "i2", kind: "info", x: 360, y: 20, w: 200, h: 40, fields: ["number", "date", "f:paymentTerms"] },
    ] };
    const out = normalizeFreeLayout(raw, "quotation")!;
    const i1 = out.blocks.find((b) => b.id === "i1")!;
    expect(i1.fields).toEqual(["seller.taxId", "seller.name", "seller.address"]);
    expect(i1.names).toEqual({ "seller.taxId": "Tax ID" });
    expect(i1.labelWidth).toBe(300);
    expect(out.blocks.some((b) => b.kind === "seller" || b.kind === "meta")).toBe(false);
    expect(requiredSatisfied("seller", out.blocks)).toBe(true);
    expect(legalFieldVisible(out.blocks, "number")).toBe(true);
    expect(addableBlocksFor("quotation")).toContain("info");
  });

  it("column spec: known keys once, label/align/width limits, description always kept", () => {
    const out = normalizeFreeLayout({ enabled: true, blocks: [{ id: "t", kind: "items", x: 40, y: 200, w: 515, h: 300,
      colSpec: [{ key: "code", align: "center", width: 200 }, { key: "detail", label: "รายละเอียดสินค้า" }, { key: "code" }, { key: "bogus" }, { key: "amount", align: "middle", width: "" }] }] }, "quotation")!;
    const t = out.blocks.find((b) => b.id === "t")!;
    expect(t.colSpec).toEqual([{ key: "description" }, { key: "code", align: "center", width: 95 }, { key: "detail", label: "รายละเอียดสินค้า" }, { key: "amount" }]);
  });
});
