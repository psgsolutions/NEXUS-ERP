import { describe, expect, it } from "vitest";
import { DEFAULT_BOM_SETTINGS, bomToRecipe, expandBom, lanBomSpec } from "@/lib/bom";
import { applyLineInputs, prDraftLines, crewRatesByCode, laborCompare, lineInputs, lineWarnings, normalizeRealModels, purchaseRows, quoteBom, roundingLine } from "@/lib/bom-quote";

/** ราคากลางเดียวกับ bom-lan-excel.test (Excel จริง) */
const PRICE: Record<string, number> = {
  "UTP-CAT6": 12.46, "RJ45-PLUG": 6, "RJ45-BOOT": 6.31, "JACK-CAT6": 65, "PP-24": 1800, "PC-1M": 60, "PC-2M": 68.4, "BOX-2x4": 13, "FP-1P": 47.53,
  'FLEX-3/4"': 9, 'FLEXCON-3/4"': 13.19, 'FLEXCLIP-3/4"': 3, 'EMT-3/4"': 50, 'EMTCOUP-3/4"': 6.79, 'EMTCON-3/4"': 5.96, 'EMTSTRAP-3/4"': 0.94, 'EMTELB-3/4"': 33.95,
  ANCHOR: 1.46, CONSUM: 10, LABEL: 9.78, "LAB-UTP": 800, 'LAB-FLEX-3/4"': 30, 'LAB-EMT-3/4"': 60, TEST: 50,
};
const pid = (code: string) => code.replace(/[/"]/g, "_");
const EST = new Set<string>();
const resolve = (code: string) => (code in PRICE ? { productId: pid(code), name: code, unit: code === "UTP-CAT6" ? "ม." : "ชิ้น", cost: PRICE[code], status: EST.has(code) ? "Y" : "" } : null);
const s = DEFAULT_BOM_SETTINGS;

/** บรรทัดใบเสนอราคาที่เลือกงานบริการ LAN (สำเนาสูตรจากงานบริการ ค่าเริ่มต้นที่บันทึกไว้ = 0) */
const line = (id: number, v: "PB" | "PLUG2" | "PPLUG", qty: number, extra: any = {}) => {
  const spec = lanBomSpec(v);
  const res = expandBom(spec, { flexSize: s.flexSize, emtSize: s.emtSize }, s, resolve);
  return { id, name: `LAN ${v}`, qty, unit: "จุด", itemType: "SERVICE", price: 0, cost: res.costPerUnit, discountType: "PERCENT", discountValue: 0, recipe: { ...bomToRecipe(spec, res.items), bomInputs: { routeM: 0, flexM: 0, emtM: 0 } }, ...extra };
};

describe("กรอกระยะต่อบรรทัด", () => {
  it("ค่าในบรรทัดทับค่าเริ่มต้นของงานบริการ", () => {
    const it0 = line(1, "PB", 20, { bomInputs: { routeM: 30 } });
    expect(lineInputs(it0, s)).toMatchObject({ routeM: 30, flexM: 0, emtM: 0, flexSize: '3/4"', emtSize: '3/4"' });
  });
  it("กรอกระยะ → ต้นทุนต่อจุดตรง Excel และราคา = ต้นทุน × 1.30", () => {
    const it0 = line(1, "PB", 20);
    const p = applyLineInputs(it0, { ...lineInputs(it0, s), routeM: 30, flexM: 8, emtM: 20 }, s, resolve);
    expect(p.cost).toBe(4350.82);
    expect(p.price).toBe(5656.06);
    expect(p.recipe.bomInputs).toMatchObject({ routeM: 30, flexM: 8, emtM: 20 });
    expect(p.recipe.materials.find((m: any) => m.productId === pid("UTP-CAT6")).qty).toBeCloseTo(33, 6);
  });
  it("ราคาที่ปรับเองไม่ถูกทับเมื่อกรอกระยะใหม่", () => {
    const it0 = line(1, "PB", 20, { price: 5000, priceManual: true });
    const p = applyLineInputs(it0, { ...lineInputs(it0, s), routeM: 30, flexM: 8, emtM: 20 }, s, resolve);
    expect(p.price).toBeUndefined();
    expect(p.cost).toBe(4350.82);
  });
});

describe("BOM รวมทั้งใบ (กลุ่มตัวอย่าง Excel)", () => {
  const items = [
    { id: 0, itemType: "GROUP_HEADER", name: "หัวข้อ" },
    { ...line(1, "PB", 20, { bomInputs: { routeM: 30, flexM: 8, emtM: 20 } }), price: 5656.06 },
    { ...line(2, "PLUG2", 6, { bomInputs: { routeM: 40, flexM: 10, emtM: 25 } }), price: 6313.81 },
    { ...line(3, "PPLUG", 4, { bomInputs: { routeM: 25, flexM: 5, emtM: 15 } }), price: 4399.19 },
    { id: 4, name: "สินค้าทั่วไป", qty: 2, price: 100, itemType: "PRODUCT" },
  ];
  const q = quoteBom(items, s, resolve);
  it("ต้นทุนหลังปัดทั้งงาน และส่วนต่างจากการปัด ตรง Excel", () => {
    expect(q.lines.length).toBe(3);
    expect(q.cost).toBe(129698.31);
    expect(q.lineCost).toBeCloseTo(129692.98, 2);
    expect(q.roundingDiff).toBe(5.33);
    expect(q.rows.find((r) => r.code === "PP-24")!.qty).toBe(1);
  });
  it("ราคาตาม markup ไม่เตือน · บรรทัดเหมาส่วนต่าง = ต้นทุน × 1.30", () => {
    expect(q.warnings).toEqual([]);
    expect(roundingLine(q.roundingDiff, s)).toMatchObject({ qty: 1, cost: 5.33, price: 6.93, bomRounding: true });
  });
});

describe("เตือนกำไรต่ำ / ราคาประมาณการ / ไม่พบราคากลาง", () => {
  it("ปรับราคาต่อจุดต่ำกว่า 30% → เตือน (คิดหลังส่วนลด)", () => {
    const it0 = { ...line(1, "PB", 10, { bomInputs: { routeM: 30, flexM: 8, emtM: 20 } }), price: 5656.06 };
    expect(lineWarnings(it0, s, resolve).map((w) => w.kind)).toEqual([]);
    const w = lineWarnings({ ...it0, discountValue: 10 }, s, resolve);
    expect(w.map((x) => x.kind)).toEqual(["lowMarkup"]);
    expect(w[0].markup!).toBeCloseTo(0.17, 2);
    expect(lineWarnings({ ...it0, price: 5000 }, s, resolve)[0].text).toMatch(/ต่ำกว่าเกณฑ์ 30%/);
    // เกณฑ์เตือนตาม "เตือนเมื่อ markup ต่ำกว่า" (minMarkup) ไม่ใช่ markup ที่ใช้ตั้งราคา
    expect(lineWarnings({ ...it0, discountValue: 10 }, { ...s, minMarkup: 0.15 }, resolve)).toEqual([]);
  });
  it("ราคาประมาณการ (Y) และรหัสที่ไม่มีราคากลาง", () => {
    EST.add("PP-24");
    const miss = (code: string) => (code === "TEST" ? null : resolve(code));
    const it0 = { ...line(1, "PB", 10), price: 99999 };
    const kinds = lineWarnings(it0, s, miss).map((w) => w.kind);
    EST.clear();
    expect(kinds).toEqual(["missing", "estimated"]);
  });
});

describe("สินค้ากลาง → รุ่นที่ซื้อจริง", () => {
  it("ทำความสะอาด: ไม่ซ้ำ ไม่ผูกตัวเอง รุ่นหลักรุ่นเดียว", () => {
    expect(normalizeRealModels([{ productId: "A" }, { productId: "B", primary: true, per: 305 }, { productId: "A" }, { productId: "G" }, { productId: "x/y" }], "G"))
      .toEqual([{ productId: "A" }, { productId: "B", primary: true, per: 305 }]);
    expect(normalizeRealModels([{ productId: "A" }, { productId: "B" }])[0].primary).toBe(true);
  });
  it("แปลงหน่วย (เมตร → กล่อง 305 ม. ปัดขึ้น) · ยังไม่ผูก = ซื้อตามสินค้ากลาง · ไม่รวมค่าแรง", () => {
    const byId = new Map<string, any>([
      ["G-UTP", { id: "G-UTP", name: "สาย CAT6 (กลาง)", unit: "ม.", realModels: [{ productId: "R-UTP", primary: true, per: 305 }] }],
      ["R-UTP", { id: "R-UTP", name: "LINK US-9116 CAT6 305m", unit: "กล่อง" }],
    ]);
    const rows = purchaseRows([
      { code: "UTP-CAT6", productId: "G-UTP", name: "สาย CAT6 (กลาง)", unit: "ม.", qty: 1034, rawQty: 1034, unitCost: 12.46, cost: 0, labor: false, group: "" },
      { code: "BOX-2x4", productId: "G-BOX", name: "กล่อง 2x4", unit: "ชิ้น", qty: 20, rawQty: 20, unitCost: 13, cost: 0, labor: false, group: "" },
      { code: "LAB-UTP", productId: "G-LAB", name: "ค่าแรง", unit: "จุด", qty: 30, rawQty: 30, unitCost: 800, cost: 0, labor: true, group: "" },
    ], byId);
    expect(rows).toEqual([
      expect.objectContaining({ productId: "R-UTP", unit: "กล่อง", qty: 4, mapped: true, genericQty: 1034 }),
      expect.objectContaining({ productId: "G-BOX", qty: 20, mapped: false }),
    ]);
  });
});

describe("ค่าแรงกลาง ↔ อัตราช่าง", () => {
  it("เทียบต้นทุนจริงของช่างแต่ละคนกับที่เสนอ (เรียงถูกไปแพง)", () => {
    const crews = crewRatesByCode([
      { id: "L1", laborCode: "LAB-UTP", subcontractorId: "S1", subcontractorName: "ช่างเอ", costPrice: 900, unit: "จุด" },
      { id: "L2", laborCode: "LAB-UTP", subcontractorId: "S2", subcontractorName: "ช่างบี", costPrice: 700, unit: "จุด" },
      { id: "L3", laborCode: "LAB-UTP", costPrice: 650, isActive: false },
      { id: "L4", costPrice: 500 },
    ]);
    const cmp = laborCompare([
      { code: "LAB-UTP", productId: "G", name: "ค่าแรงเดินสาย", unit: "จุด", qty: 30, rawQty: 30, unitCost: 800, cost: 24000, labor: true, group: "" },
      { code: "UTP-CAT6", productId: "U", name: "สาย", unit: "ม.", qty: 10, rawQty: 10, unitCost: 12, cost: 120, labor: false, group: "" },
    ], crews);
    expect(cmp.length).toBe(1);
    expect(cmp[0].quotedCost).toBe(24000);
    expect(cmp[0].crews.map((c) => [c.contractorName, c.cost, c.diff])).toEqual([["ช่างบี", 21000, -3000], ["ช่างเอ", 27000, 3000]]);
  });
});

describe("รายการที่ต้องซื้อ → ใบขอซื้อ", () => {
  const byId = new Map<string, any>([
    ["G-UTP", { id: "G-UTP", sku: "GEN-UTP", name: "สาย CAT6 (กลาง)", unit: "ม.", realModels: [{ productId: "R-UTP", primary: true, per: 305 }] }],
    ["R-UTP", { id: "R-UTP", sku: "LINK-9116", name: "LINK US-9116 CAT6 305m", unit: "กล่อง" }],
    ["G-PP", { id: "G-PP", name: "Patch panel", unit: "ชิ้น", realModels: [{ productId: "R-PP", primary: true }] }],
    ["R-PP", { id: "R-PP", name: "PP 24 port", unit: "ชิ้น", pricing: { costWAC: 1650 } }],
  ]);
  const buy = purchaseRows([
    { code: "UTP-CAT6", productId: "G-UTP", name: "สาย CAT6 (กลาง)", unit: "ม.", qty: 1034, rawQty: 1034, unitCost: 12.46, cost: 0, labor: false, group: "" },
    { code: "PP-24", productId: "G-PP", name: "Patch panel", unit: "ชิ้น", qty: 1, rawQty: 1, unitCost: 1800, cost: 0, labor: false, group: "" },
    { code: "BOX-2x4", productId: "G-BOX", name: "กล่อง 2x4", unit: "ชิ้น", qty: 20, rawQty: 20, unitCost: 13, cost: 0, labor: false, group: "" },
  ], byId);
  it("ต้นทุนประมาณ: ต้นทุนจริงของรุ่น ถ้าไม่มี = ราคากลาง × ต่อหน่วยซื้อ · ไม่ผูก = ราคากลาง", () => {
    expect(buy.map((b) => [b.productId, b.qty, b.unitCost, b.sku])).toEqual([["R-UTP", 4, 3800.3, "LINK-9116"], ["R-PP", 1, 1650, ""], ["G-BOX", 20, 13, ""]]);
  });
  it("เป็นบรรทัดใบขอซื้อสินค้า ราคา = ต้นทุนประมาณ พร้อมที่มาจาก BOM", () => {
    const lines = prDraftLines(buy);
    expect(lines[0]).toMatchObject({ productId: "R-UTP", sku: "LINK-9116", qty: 4, unit: "กล่อง", price: 3800.3, itemType: "PRODUCT", whtRate: 0 });
    expect(lines[0].details).toMatch(/สาย CAT6 \(กลาง\) 1034 ม\./);
    expect(lines[2].details).toMatch(/ยังไม่ผูก/);
    expect(new Set(lines.map((l) => l.id)).size).toBe(3);
  });
});
