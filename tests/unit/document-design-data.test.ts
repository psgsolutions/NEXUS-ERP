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
