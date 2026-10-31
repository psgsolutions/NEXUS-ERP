import { describe, expect, it } from "vitest";
import { CORE_TOTALS, OPTIONAL_TOTALS, columnWidthsPt, gridSizes, normalizeDesign, normalizeFreeLayout, requiredColumnsFor, visibleTotals, BLOCK_PARTS } from "@/lib/documents/design";
import { applySigning, EMPTY_SIGNING } from "@/lib/documents/esign";
import { dataGroups, fitTotalsBlocks } from "@/lib/documents/design-data";
import { sampleModelFor, totalsRows } from "@/lib/documents/build";

describe("designer: fixed form, totals, rows/columns, stamp choice", () => {
  it("totals: only optional rows get a checkbox; VAT, sum and grand total are always shown", () => {
    expect(OPTIONAL_TOTALS).toContain("ยอดชำระสุทธิ");
    for (const core of CORE_TOTALS) expect(OPTIONAL_TOTALS).not.toContain(core);
    const layout = { enabled: true, blocks: [{ id: "t", kind: "totals" as const, x: 300, y: 590, w: 230, h: 80, hide: ["t:ยอดชำระสุทธิ"] }] };
    const g = dataGroups(layout, { docType: "quotation", docTitle: "ใบเสนอราคา", meta: [], fields: [], columns: [], totals: OPTIONAL_TOTALS }).find((x) => x.id === "totals")!;
    expect(g.items.filter((i) => i.locked).map((i) => i.label)).toEqual(CORE_TOTALS);
    expect(g.items.find((i) => i.label === "ยอดชำระสุทธิ")).toMatchObject({ on: false });
    expect(g.items.find((i) => i.label === "ยอดชำระสุทธิ")!.locked).toBeFalsy();
  });

  it("row height and grid divider sizes survive normalisation; English sub-label can be hidden per box", () => {
    const out = normalizeFreeLayout({ enabled: true, blocks: [
      { id: "i", kind: "items", x: 32, y: 200, w: 530, h: 300, rowPad: 0.5, hide: ["en"], colSpec: [{ key: "description", width: 1 }, { key: "amount", width: 40 }] },
      { id: "g", kind: "grid", x: 32, y: 520, w: 300, h: 90, rows: 2, cols2: 3, colW: [1, 2, 1], rowH: [1, 3] },
      { id: "bad", kind: "grid", x: 32, y: 620, w: 300, h: 90, rows: 2, cols2: 3, colW: [1, 1] },
    ] }, "quotation")!;
    const i = out.blocks.find((b) => b.id === "i")!, g = out.blocks.find((b) => b.id === "g")!, bad = out.blocks.find((b) => b.id === "bad")!;
    expect(i.rowPad).toBe(0.5);
    expect(i.hide).toContain("en");
    expect(i.colSpec?.[0].width).toBe(1);
    expect(g.colW).toEqual([0.25, 0.5, 0.25]);
    expect(g.rowH).toEqual([0.25, 0.75]);
    expect(bad.colW).toBeUndefined();
    expect(BLOCK_PARTS.items?.some((p) => p.key === "en")).toBe(true);
  });

  it("column widths in pt match the PDF split (all set = proportional, otherwise auto takes the rest)", () => {
    expect(columnWidthsPt([{ key: "description", width: 60 }, { key: "amount", width: 40 }], 500)).toEqual([300, 200]);
    const mixed = columnWidthsPt([{ key: "no" }, { key: "description" }, { key: "amount" }], 500);
    expect(mixed[0]).toBeCloseTo(30); expect(mixed[2]).toBeCloseTo(70); expect(mixed[1]).toBeCloseTo(400);
    expect(gridSizes(undefined, 4, 100)).toEqual([25, 25, 25, 25]);
  });

  it("quotation can leave out the e-stamp and/or e-signature", () => {
    const cfg = { ...EMPTY_SIGNING, stamp: "data:image/png;base64,AAAA", signers: [{ id: "s1", name: "ผู้ลงนาม", position: "", image: "data:image/png;base64,BBBB" }],
      assign: { quotation: { "ผู้เสนอราคา": { signer: "s1", stamp: true } } } };
    const base = { ...sampleModelFor("quotation", { name: "TEST" } as any, "2026-10-30"), watermark: undefined, signatures: ["ผู้เสนอราคา"] } as any;
    const all = applySigning(base, cfg, ["ผู้เสนอราคา"]);
    expect(all.stamp).toBeTruthy(); expect(all.signed?.["ผู้เสนอราคา"]?.image).toBeTruthy();
    const noStamp = applySigning({ ...base, noStamp: true }, cfg, ["ผู้เสนอราคา"]);
    expect(noStamp.stamp).toBeUndefined(); expect(noStamp.signed?.["ผู้เสนอราคา"]?.image).toBeTruthy();
    const noSign = applySigning({ ...base, noSign: true }, cfg, ["ผู้เสนอราคา"]);
    expect(noSign.stamp).toBeTruthy(); expect(noSign.signed?.["ผู้เสนอราคา"]?.image).toBeFalsy();
    const none = applySigning({ ...base, noSign: true, noStamp: true }, cfg, ["ผู้เสนอราคา"]);
    expect(none.stamp).toBeUndefined(); expect(none.signed?.["ผู้เสนอราคา"]?.image).toBeFalsy();
  });
});

describe("tax invoice quantity column (ม.86/4 (5))", () => {
  it("cannot be removed and is restored on old layouts", () => {
    expect(requiredColumnsFor("invoice")).toContain("qty");
    expect(requiredColumnsFor("quotation")).not.toContain("qty");
    const out = normalizeFreeLayout({ enabled: true, blocks: [{ id: "i", kind: "items", x: 32, y: 200, w: 530, h: 300, colSpec: [{ key: "no" }, { key: "description" }, { key: "amount" }] }] }, "invoice")!;
    expect(out.blocks.find((b) => b.id === "i")!.colSpec!.map((x) => x.key)).toEqual(["no", "description", "qty", "amount"]);
    const unit = normalizeFreeLayout({ enabled: true, blocks: [{ id: "i", kind: "items", x: 32, y: 200, w: 530, h: 300, colSpec: [{ key: "description" }, { key: "qtyUnit" }, { key: "amount" }] }] }, "invoice")!;
    expect(unit.blocks.find((b) => b.id === "i")!.colSpec!.map((x) => x.key)).toEqual(["description", "qtyUnit", "amount"]);
  });
});

describe("amount in words is its own box", () => {
  it("is not part of the totals group (ticking totals rows never removes it)", () => {
    const layout = { enabled: true, blocks: [
      { id: "t", kind: "totals" as const, x: 300, y: 590, w: 230, h: 80 },
      { id: "w", kind: "words" as const, x: 32, y: 590, w: 260, h: 22 },
    ] };
    const groups = dataGroups(layout, { docType: "quotation", docTitle: "ใบเสนอราคา", meta: [], fields: [], columns: [], totals: OPTIONAL_TOTALS });
    const totals = groups.find((g) => g.id === "totals")!, words = groups.find((g) => g.id === "words")!;
    expect(totals.kinds).toEqual(["totals"]);
    expect(totals.items.some((i) => i.key === "block:words")).toBe(false);
    expect(words.items).toEqual([{ key: "block:words", label: "แสดงจำนวนเงินตัวอักษร", on: true }]);
    expect(dataGroups(layout, { docType: "delivery_note", docTitle: "ใบส่งของ", meta: [], fields: [], columns: [], totals: [] }).some((g) => g.id === "words")).toBe(false);
  });
});

describe("totals box fits the totals table", () => {
  const theme = normalizeDesign(null).theme;
  const base = () => normalizeDesign({ perDoc: { quotation: { free: { enabled: true, blocks: [{ id: "t", kind: "totals", x: 300, y: 590, w: 230, h: 200 }] } } } });
  const tb = (d: any) => d.perDoc.quotation.free.blocks.find((b: any) => b.kind === "totals");

  it("height follows the ticked rows (no empty space, grows when a row is ticked)", () => {
    const all = fitTotalsBlocks(base());
    const rows = 7; // รวมเป็นเงิน ส่วนลด หลังหักส่วนลด VAT รวมทั้งสิ้น หัก ณ ที่จ่าย ยอดชำระสุทธิ
    const fs = 9.5, lh = 1.35, pad = 2.5;
    expect(tb(all).h).toBeCloseTo(Math.ceil((rows * (fs * lh + 2 * pad) + 2) * 2) / 2, 1);
    const fewer = fitTotalsBlocks({ ...all, perDoc: { quotation: { free: { ...all.perDoc.quotation.free!, blocks: [{ ...tb(all), hide: ["t:หัก ณ ที่จ่าย", "t:ยอดชำระสุทธิ"] }] } } } });
    expect(tb(fewer).h).toBeLessThan(tb(all).h);
    expect(fitTotalsBlocks(all)).toBe(all); // ไม่เปลี่ยน = ออบเจกต์เดิม
    void theme;
  });

  it("rows follow the custom order; default is the standard order", () => {
    const rows = [{ label: "รวมเป็นเงิน" }, { label: "ภาษีมูลค่าเพิ่ม 7%" }, { label: "จำนวนเงินรวมทั้งสิ้น", strong: true }];
    expect(visibleTotals(rows).map((r) => r.label)).toEqual(["รวมเป็นเงิน", "ภาษีมูลค่าเพิ่ม 7%", "จำนวนเงินรวมทั้งสิ้น"]);
    expect(visibleTotals(rows, [], ["จำนวนเงินรวมทั้งสิ้น", "รวมเป็นเงิน"]).map((r) => r.label)).toEqual(["จำนวนเงินรวมทั้งสิ้น", "รวมเป็นเงิน", "ภาษีมูลค่าเพิ่ม 7%"]);
  });

  it("VAT row has no brackets", () => {
    const labels = totalsRows({ lineTotal: 107, billDiscount: 0, net: 107, vat: 7, grand: 107, taxType: "INCLUSIVE" }).map((r) => r.label);
    expect(labels.some((l) => /[()]/.test(l))).toBe(false);
  });
});
