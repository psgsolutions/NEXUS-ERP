import { describe, expect, it } from "vitest";
import { DESIGNABLE_DOCS } from "@/lib/documents/build";
import { TEMPLATES, type ItemColumn } from "@/lib/documents/design";
import { dataGroups, ensureLayout, layoutIdFor, toggleData, type DataContext } from "@/lib/documents/design-data";

const q = DESIGNABLE_DOCS.find((d) => d.type === "quotation")!;
const ctx: DataContext = { docType: "quotation", docTitle: q.title, meta: q.meta, fields: q.fields || [], columns: q.columns as ItemColumn[], totals: ["ส่วนลดท้ายบิล"] };
const theme = TEMPLATES.find((t) => t.id === "modern")!.theme;
const item = (l: ReturnType<typeof ensureLayout>, key: string) => dataGroups(l, ctx).flatMap((g) => g.items).find((i) => i.key === key)!;

describe("one checklist for what the document shows", () => {
  it("templates without their own layout get a matching layout (no separate auto mode)", () => {
    expect(layoutIdFor("classic")).toBe("standard");
    expect(layoutIdFor("government")).toBe("centerBand");
    expect(layoutIdFor("banner-a")).toBe("banner");
    const l = ensureLayout(undefined, "quotation", theme);
    expect(l.enabled).toBe(true);
    expect(l.blocks.some((b) => b.kind === "items")).toBe(true);
  });

  it("toggles a row wherever it lives, number/date locked", () => {
    let l = ensureLayout(undefined, "quotation", theme);
    expect(item(l, "doc:number").locked).toBe(true);
    expect(item(l, "doc:m:โครงการ").on).toBe(false);
    l = toggleData(l, "doc:m:โครงการ", true, ctx);
    expect(item(l, "doc:m:โครงการ").on).toBe(true);
    // ข้อมูลเพิ่มอยู่ในกล่องข้อมูลของแม่แบบ: ปิดแล้วหายจากทุกกล่อง
    expect(item(l, "doc:f:paymentTerms").on).toBe(true);
    l = toggleData(l, "doc:f:paymentTerms", false, ctx);
    expect(item(l, "doc:f:paymentTerms").on).toBe(false);
    l = toggleData(l, "doc:f:paymentTerms", true, ctx);
    expect(item(l, "doc:f:paymentTerms").on).toBe(true);
  });

  it("party contact, columns in sensible order, and footer blocks", () => {
    let l = ensureLayout(undefined, "quotation", theme);
    l = toggleData(l, "party:email", false, ctx);
    expect(item(l, "party:email").on).toBe(false);
    l = toggleData(l, "col:code", true, ctx);
    l = toggleData(l, "col:detail", true, ctx);
    const cols = l.blocks.find((b) => b.kind === "items")!.colSpec!.map((x) => x.key);
    expect(cols.indexOf("code")).toBeLessThan(cols.indexOf("description"));
    expect(cols.indexOf("detail")).toBe(cols.indexOf("description") + 1);
    expect(item(l, "col:amount").locked).toBe(true);
    l = toggleData(l, "block:payment", false, ctx);
    expect(l.blocks.some((b) => b.kind === "payment")).toBe(false);
    l = toggleData(l, "block:payment", true, ctx);
    expect(l.blocks.filter((b) => b.kind === "payment")).toHaveLength(1);
  });
});

describe("design tools: shapes, corners, flow, margins, blank page, document rules", () => {
  it("keeps shapes, per-corner radii, padding, row flow and page margin within limits", async () => {
    const { normalizeFreeLayout } = await import("@/lib/documents/design");
    const out = normalizeFreeLayout({ enabled: true, margin: 500, blocks: [
      { id: "c", kind: "shape", shape: "hexagon", x: 10, y: 10, w: 50, h: 50 },
      { id: "t", kind: "shape", shape: "triangle", x: 10, y: 10, w: 50, h: 50 },
      { id: "r", kind: "rect", x: 10, y: 10, w: 50, h: 50, radii: [2, 99, -1, "x"], pad: 99 },
      { id: "i", kind: "info", x: 10, y: 10, w: 200, h: 20, fields: ["number"], flow: "row" },
    ] }, "quotation")!;
    const get = (id: string) => out.blocks.find((b) => b.id === id)!;
    expect(get("c").shape).toBe("ellipse");
    expect(get("t").shape).toBe("triangle");
    expect(get("r").radii).toEqual([2, 60, 0, 0]);
    expect(get("r").pad).toBe(30);
    expect(get("i").flow).toBe("row");
    expect(out.margin).toBe(80);
  });

  it("paper size, orientation and margins: kept by normalize, boxes refit without overlap", async () => {
    const { normalizeFreeLayout, pageOf, marginsOf, refitBlocks } = await import("@/lib/documents/design");
    const { templateLayout } = await import("@/lib/documents/layout-templates");
    const n = normalizeFreeLayout({ enabled: true, paper: "A5", landscape: true, margins: [10, 20, 30, 999], blocks: [{ id: "x", kind: "text", x: 700, y: 10, w: 100, h: 20, text: "a" }] }, "quotation")!;
    expect(n).toMatchObject({ paper: "A5", landscape: true, margins: [10, 20, 30, 120] });
    expect(n.blocks.find((b) => b.id === "x")!.x).toBe(700); // แนวนอนกว้างกว่า A4 ตั้ง
    expect(pageOf(n)).toEqual({ w: 595.28, h: 419.53 });
    expect(normalizeFreeLayout({ enabled: true, paper: "B9", blocks: [] }, "quotation")!.paper).toBeUndefined();
    expect(marginsOf({ margin: 18 })).toEqual([18, 18, 18, 18]);
    const l = templateLayout("standard", "quotation", theme);
    const to = pageOf({ landscape: true }), out = refitBlocks(l.blocks, pageOf(null), marginsOf(l), to, marginsOf(l));
    const content = out.filter((b) => !["rect", "shape", "line", "image"].includes(b.kind));
    for (const b of out) expect(b.y + b.h).toBeLessThanOrEqual(to.h + 0.1);
    const overlaps = content.flatMap((a, i) => content.slice(i + 1).filter((b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2).map((b) => `${a.kind}/${b.kind}`));
    const before = l.blocks.filter((b) => !["rect", "shape", "line", "image"].includes(b.kind));
    const was = before.flatMap((a, i) => before.slice(i + 1).filter((b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2).map((b) => `${a.kind}/${b.kind}`));
    expect(overlaps).toEqual(was);
  });

  it("stamp and signature print at a fixed real size (cannot be resized)", async () => {
    const { fixedBlockSize, SIGN_SIZE } = await import("@/lib/documents/design");
    expect(fixedBlockSize({ kind: "stamp" }, 80)).toEqual({ w: 80, h: 80 });
    expect(fixedBlockSize({ kind: "sign", hide: ["name", "title", "date"] }, 80)).toEqual(SIGN_SIZE);
    expect(fixedBlockSize({ kind: "sign", hide: ["title"] }, 80, 10)!.h).toBe(SIGN_SIZE.h + 26);
    expect(fixedBlockSize({ kind: "text" }, 80)).toBeNull();
  });

  it("grid table block keeps rows/columns within limits", async () => {
    const { normalizeFreeLayout } = await import("@/lib/documents/design");
    const n = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "g", kind: "grid", x: 10, y: 10, w: 300, h: 90, rows: 99, cols2: 0, headBg: "#eeeeee" },
      { id: "h", kind: "grid", x: 10, y: 120, w: 300, h: 90 },
    ] }, "quotation")!;
    expect(n.blocks.find((b) => b.id === "g")).toMatchObject({ rows: 40, cols2: 1, headBg: "#eeeeee" });
    expect(n.blocks.find((b) => b.id === "h")).toMatchObject({ rows: 3, cols2: 3 });
  });

  it("label-only pieces are kept but never count as showing the data (legal checks)", async () => {
    const { normalizeFreeLayout, legalFieldVisible } = await import("@/lib/documents/design");
    const n = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "l", kind: "field", field: "date", show: "label", x: 10, y: 10, w: 40, h: 14 },
      { id: "v", kind: "field", field: "date", hideLabel: true, show: "label", x: 60, y: 10, w: 80, h: 14 },
    ] }, "quotation")!;
    expect(n.blocks.find((b) => b.id === "l")!.show).toBe("label");
    expect(n.blocks.find((b) => b.id === "v")!.show).toBeUndefined(); // เฉพาะข้อมูล ชนะ
    expect(legalFieldVisible([{ id: "l", kind: "field", field: "date", show: "label", x: 0, y: 0, w: 1, h: 1 }], "date")).toBe(false);
    expect(legalFieldVisible(n.blocks.filter((b) => b.id !== "l"), "date")).toBe(true);
  });

  it("electronic signature box: slot or fixed signer, signed only on issued documents", async () => {
    const { normalizeFreeLayout, normalizeDesign } = await import("@/lib/documents/design");
    const { applySigning } = await import("@/lib/documents/esign");
    const { sampleModelFor } = await import("@/lib/documents/build");
    const n = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "a", kind: "sign", x: 10, y: 10, w: 120, h: 46, slot: "ผู้เสนอราคา", hide: ["date"] },
      { id: "b", kind: "sign", x: 10, y: 60, w: 120, h: 46, signer: "p1", slot: "ผู้อนุมัติ" },
    ] }, "quotation")!;
    expect(n.blocks.find((b) => b.id === "a")).toMatchObject({ slot: "ผู้เสนอราคา", hide: ["date"] });
    expect(n.blocks.find((b) => b.id === "b")).toMatchObject({ signer: "p1" });
    expect(n.blocks.find((b) => b.id === "b")!.slot).toBeUndefined();
    const image = "data:image/png;base64,AAAA";
    const cfg = { stamp: "", stampSize: 72, signers: [{ id: "p1", name: "สมชาย", position: "ผู้จัดการ", image }], assign: {} };
    const design = normalizeDesign({ perDoc: { quotation: { free: n } } });
    const doc = applySigning(sampleModelFor("quotation", { name: "ทดสอบ", design } as any, "2026-10-26"), cfg, []);
    expect(doc.signed?.["@p1"]).toMatchObject({ image, name: "สมชาย" });
    const draft = applySigning({ ...sampleModelFor("quotation", { name: "ทดสอบ", design } as any, "2026-10-26"), watermark: "ฉบับร่าง" }, cfg, []);
    expect(draft.signed?.["@p1"]).toBeUndefined();
  });

  it("keeps vertical alignment and label spacing within limits (label boxes only)", async () => {
    const { normalizeFreeLayout } = await import("@/lib/documents/design");
    const out = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "p", kind: "party", x: 10, y: 10, w: 300, h: 60, labelWidth: 5, labelGap: 99, rowGap: 4 },
      { id: "t", kind: "text", x: 10, y: 80, w: 200, h: 40, text: "x", valign: "middle", labelGap: 10 },
      { id: "u", kind: "text", x: 10, y: 130, w: 200, h: 40, text: "x", valign: "sideways" },
    ] }, "quotation")!;
    const get = (id: string) => out.blocks.find((b) => b.id === id)!;
    expect(get("p")).toMatchObject({ labelWidth: 20, labelGap: 60, rowGap: 4 });
    expect(get("t").valign).toBe("middle");
    expect(get("t").labelGap).toBeUndefined();
    expect(get("u").valign).toBeUndefined();
  });

  it("blank page keeps only legally required data; original/copy only on documents that need it", async () => {
    const { blankLayout } = await import("@/lib/documents/design-data");
    const { templateLayout } = await import("@/lib/documents/layout-templates");
    const blank = blankLayout("invoice", theme);
    expect(blank.blocks.map((b) => b.kind).sort()).toEqual(["items", "meta", "party", "seller", "signatures", "title", "totals"]);
    expect(blank.blocks.some((b) => ["rect", "line", "logo"].includes(b.kind))).toBe(false);
    const { docHasCopy, normalizeFreeLayout } = await import("@/lib/documents/design");
    expect(["invoice", "receipt", "billing_note", "delivery_note", "cndn"].every(docHasCopy)).toBe(true);
    expect(["quotation", "sales_order", "purchase_order", "payment", "work_order", "letter"].some(docHasCopy)).toBe(false);
    // รายการติ๊ก: เอกสารที่ต้องมี = ล็อกไว้ · เอกสารอื่นไม่มีตัวเลือก
    const copyItem = (type: string) => dataGroups(ensureLayout(undefined, type, theme), { ...ctx, docType: type }).flatMap((g) => g.items).find((i) => i.key === "title:copy");
    expect(copyItem("invoice")).toMatchObject({ on: true, locked: true });
    expect(copyItem("quotation")).toBeUndefined();
    // ช่องต้นฉบับ/สำเนาวางแยกได้
    expect(normalizeFreeLayout({ enabled: true, blocks: [{ id: "c", kind: "field", field: "copy", x: 1, y: 1, w: 50, h: 14 }] }, "invoice")!.blocks.find((b) => b.id === "c")!.field).toBe("copy");
    expect(templateLayout("standard", "invoice", theme).blocks.find((b) => b.kind === "info")?.fields).toContain("m:ครบกำหนด");
    // ใบสั่งงาน (ไม่มีกล่องเฉพาะ) ยังมีหมายเหตุ
    expect(templateLayout("standard", "work_order", theme).blocks.some((b) => b.kind === "notes")).toBe(true);
  });
});

describe("split pieces: label styles, hidden pieces, merge back", () => {
  it("keeps the split set, the original box once, label styles and hidden flags", async () => {
    const { normalizeFreeLayout } = await import("@/lib/documents/design");
    const meta = { id: "m", kind: "meta", x: 300, y: 40, w: 240, h: 60, hide: ["m:อ้างอิง"] };
    const out = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "a", kind: "field", field: "number", show: "label", labelStyle: "plain", split: "g-1", origin: meta, originAt: [310, 42], x: 310, y: 42, w: 70, h: 14 },
      { id: "b", kind: "field", field: "number", hideLabel: true, split: "g-1", x: 386, y: 42, w: 90, h: 14, off: true },
      { id: "c", kind: "field", field: "seller.taxId", labelStyle: "inline", split: "g-1", x: 10, y: 10, w: 200, h: 14 },
      { id: "d", kind: "field", field: "date", labelStyle: "fancy", split: "BAD ID!", origin: { ...meta, split: "x" }, originAt: [1, 2], x: 1, y: 1, w: 50, h: 12 },
    ] }, "quotation")!;
    const [a, b, c, d] = out.blocks;
    expect(a).toMatchObject({ labelStyle: "plain", split: "g-1", originAt: [310, 42], origin: { kind: "meta", x: 300, w: 240, hide: ["m:อ้างอิง"] } });
    expect(a.origin).not.toHaveProperty("split");
    expect(b).toMatchObject({ off: true, split: "g-1" });
    expect(c).toMatchObject({ labelStyle: "inline" });
    // รหัสชุดไม่ถูกต้อง / กล่องเดิมซ้อนชุด / รูปแบบป้ายไม่รู้จัก ถูกตัด
    expect(d).not.toHaveProperty("split");
    expect(d).not.toHaveProperty("origin");
    expect(d).not.toHaveProperty("labelStyle");
  });

  it("hidden value pieces do not count as showing legal data", async () => {
    const { legalFieldVisible, requiredSatisfied } = await import("@/lib/documents/design");
    const num = { id: "n", kind: "field" as const, field: "number", hideLabel: true, x: 0, y: 0, w: 50, h: 12 };
    expect(legalFieldVisible([num], "number")).toBe(true);
    expect(legalFieldVisible([{ ...num, off: true }], "number")).toBe(false);
    const seller = ["seller.name", "seller.address", "seller.taxId"].map((f, i) => ({ id: `s${i}`, kind: "field" as const, field: f, hideLabel: true, x: 0, y: 0, w: 50, h: 12 }));
    expect(requiredSatisfied("seller", seller)).toBe(true);
    expect(requiredSatisfied("seller", seller.map((b, i) => (i === 2 ? { ...b, off: true } : b)))).toBe(false);
  });
});
