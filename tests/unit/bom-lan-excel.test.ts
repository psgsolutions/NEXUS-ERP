import { describe, expect, it } from "vitest";
import { DEFAULT_BOM_SETTINGS, LAN_CODES, bomToRecipe, compQty, expandBom, jobBom, lanBomSpec, normalizeBomSpec, salePrice, type BomSettings } from "@/lib/bom";
import { normalizeRecipe, recipeCost } from "@/lib/service-recipe";

/**
 * เทียบกับ Excel จริง: คำนวณ Template_SOW_BOM_งานติดตั้ง.xlsx ด้วย Microsoft Excel (สำเนา) แล้วอ่านชีต BOM LAN
 * กลุ่มตัวอย่างในชีต: Patch + Box 20 จุด (สาย 30 · Flex 8 · EMT 20) · ตัวผู้ 2 ฝั่ง 6 จุด (40 · 10 · 25) · Patch + ตัวผู้ 4 จุด (25 · 5 · 15)
 */
const PRICE: Record<string, number> = {
  "UTP-CAT6": 12.46, "RJ45-PLUG": 6, "RJ45-BOOT": 6.31, "JACK-CAT6": 65, "PP-24": 1800, "PC-1M": 60, "PC-2M": 68.4, "BOX-2x4": 13, "FP-1P": 47.53,
  'FLEX-1/2"': 7.5, 'FLEX-3/4"': 9, 'FLEX-1"': 12.9, 'FLEXCON-1/2"': 10, 'FLEXCON-3/4"': 13.19, 'FLEXCON-1"': 20.37, 'FLEXCLIP-1/2"': 1.5, 'FLEXCLIP-3/4"': 3, 'FLEXCLIP-1"': 3,
  'EMT-1/2"': 30, 'EMT-3/4"': 50, 'EMT-1"': 71.67, 'EMTCOUP-1/2"': 4.07, 'EMTCOUP-3/4"': 6.79, 'EMTCOUP-1"': 9.51, 'EMTCON-1/2"': 3.4, 'EMTCON-3/4"': 5.96, 'EMTCON-1"': 10,
  'EMTSTRAP-1/2"': 2, 'EMTSTRAP-3/4"': 0.94, 'EMTSTRAP-1"': 4, 'EMTELB-1/2"': 26.19, 'EMTELB-3/4"': 33.95, 'EMTELB-1"': 50.44,
  ANCHOR: 1.46, CONSUM: 10, LABEL: 9.78, "LAB-UTP": 800, 'LAB-FLEX-1/2"': 30, 'LAB-FLEX-3/4"': 30, 'LAB-FLEX-1"': 40, 'LAB-EMT-1/2"': 60, 'LAB-EMT-3/4"': 60, 'LAB-EMT-1"': 60, TEST: 50,
};
// รหัสสินค้าจริงเป็น id ของ Firestore (ไม่มี / ") — แปลงรหัสราคากลางเป็น id สำหรับทดสอบ
const pid = (code: string) => code.replace(/[/"]/g, "_");
const resolve = (code: string) => (code in PRICE ? { productId: pid(code), name: code, unit: "", cost: PRICE[code] } : null);
const PRICE_BY_ID = Object.fromEntries(Object.entries(PRICE).map(([k, v]) => [pid(k), v]));
const GROUPS = [
  { v: "PB" as const, n: 20, routeM: 30, flexM: 8, emtM: 20 },
  { v: "PLUG2" as const, n: 6, routeM: 40, flexM: 10, emtM: 25 },
  { v: "PPLUG" as const, n: 4, routeM: 25, flexM: 5, emtM: 15 },
];
const run = (s: BomSettings) => GROUPS.map((g) => ({ g, ...expandBom(lanBomSpec(g.v), { routeM: g.routeM, flexM: g.flexM, emtM: g.emtM, flexSize: s.flexSize, emtSize: s.emtSize }, s, resolve) }));

describe("BOM LAN ตรงกับ Excel (ท่อ Flex 3/4\" · EMT 3/4\")", () => {
  const s = DEFAULT_BOM_SETTINGS;
  const res = run(s);
  it("ต้นทุนต่อจุดทั้ง 3 รูปแบบ", () => {
    expect(res[0].costPerUnit).toBeCloseTo(4350.8166666666675, 6);
    expect(res[1].costPerUnit).toBeCloseTo(4856.778333333334, 6);
    expect(res[2].costPerUnit).toBeCloseTo(3383.9950000000003, 6);
    expect(res.every((r) => r.missing.length === 0)).toBe(true);
  });
  it("ราคาขายต่อจุด = ต้นทุน × 1.30", () => {
    expect(salePrice(res[0].costPerUnit, s.markup)).toBeCloseTo(5656.061666666668, 6);
  });
  it("BOM ทั้งงาน: จำนวน (ปัดขึ้นเฉพาะรายการนับชิ้น) และต้นทุนรวม", () => {
    const job = jobBom(res.map((r) => ({ units: r.g.n, items: r.items })));
    const q = Object.fromEntries(job.rows.map((r) => [r.code, r.qty]));
    expect(q).toEqual({
      "UTP-CAT6": 1034, "RJ45-PLUG": 16, "RJ45-BOOT": 16, "JACK-CAT6": 20, "BOX-2x4": 20, "FP-1P": 20, "PC-2M": 20, "PP-24": 1, "PC-1M": 24,
      'FLEX-3/4"': 240, 'FLEXCON-3/4"': 60, 'FLEXCLIP-3/4"': 240, 'EMT-3/4"': 610, 'EMTCOUP-3/4"': 204, 'EMTCON-3/4"': 60, 'EMTSTRAP-3/4"': 407, 'EMTELB-3/4"': 61,
      ANCHOR: 647, CONSUM: 30, LABEL: 60, "LAB-UTP": 30, 'LAB-FLEX-3/4"': 240, 'LAB-EMT-3/4"': 610, TEST: 30,
    });
    expect(job.cost).toBe(129698.31);
    // ต้นทุนรวมของกลุ่มจุด (ก่อนปัด) — ส่วนต่างจากการปัดเศษ = บรรทัดเหมาต่องาน
    expect(job.unroundedCost).toBeCloseTo(129692.98, 2);
  });
});

describe("BOM LAN ตรงกับ Excel เมื่อเปลี่ยนขนาดท่อ (Flex 1\" · EMT 1/2\")", () => {
  const s = { ...DEFAULT_BOM_SETTINGS, flexSize: '1"', emtSize: '1/2"' };
  const res = run(s);
  it("เลือกสินค้าตามขนาดท่อ · ต้นทุนต่อจุดและรวมทั้งงาน", () => {
    expect(res[0].costPerUnit).toBeCloseTo(4051.73666666667, 6);
    expect(res[1].costPerUnit).toBeCloseTo(4480.61833333333, 6);
    expect(res[2].costPerUnit).toBeCloseTo(3148.095, 6);
    const job = jobBom(res.map((r) => ({ units: r.g.n, items: r.items })));
    expect(job.rows.map((r) => r.code)).toEqual(expect.arrayContaining(['FLEX-1"', 'EMT-1/2"', 'LAB-FLEX-1"', 'LAB-EMT-1/2"']));
    expect(job.cost).toBe(120514.69);
  });
});

describe("สูตร BOM ในงานบริการ", () => {
  it("ไม่มีท่อ → ไม่ใส่คอนเน็กเตอร์ (เงื่อนไข) · ช่องว่าง = แค่ส่วนคงที่", () => {
    const spec = lanBomSpec("PB");
    const con = spec.comps.find((c) => c.code.startsWith("EMTCON"))!;
    expect(compQty(con, { emtM: 0 }, DEFAULT_BOM_SETTINGS)).toBe(0);
    expect(compQty(con, { emtM: 5 }, DEFAULT_BOM_SETTINGS)).toBe(2);
  });
  it("แตก BOM เป็นสูตรเดิม (วัสดุ + ค่าแรง) — ต้นทุนเท่ากัน · บันทึก/อ่านกลับได้", () => {
    const s = DEFAULT_BOM_SETTINGS;
    const r = expandBom(lanBomSpec("PB"), { routeM: 30, flexM: 8, emtM: 20, flexSize: '3/4"', emtSize: '3/4"' }, s, resolve);
    const recipe = normalizeRecipe(bomToRecipe(lanBomSpec("PB"), r.items))!;
    expect(recipe.bom?.kind).toBe("LAN");
    expect(recipe.labors?.map((l) => l.name)).toEqual(["LAB-UTP", 'LAB-FLEX-3/4"', 'LAB-EMT-3/4"', "TEST"]);
    expect(recipeCost(recipe, (id) => PRICE_BY_ID[id]).total).toBeCloseTo(4350.82, 2);
    expect(normalizeBomSpec(JSON.parse(JSON.stringify(lanBomSpec("PLUG2"))))).toEqual(lanBomSpec("PLUG2"));
  });
  it("รหัสราคากลางที่สูตร LAN ต้องมี (ทุกขนาดท่อ)", () => {
    expect(LAN_CODES).toHaveLength(44); // 14 รหัสคงที่ + 10 รายการตามขนาดท่อ × 3 ขนาด
    expect(LAN_CODES.every((c) => c in PRICE)).toBe(true);
  });
});
