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
