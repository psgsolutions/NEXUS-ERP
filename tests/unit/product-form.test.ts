import { describe, expect, it } from "vitest";
import { carryOver, findSimilarProducts, marginOf, nameSimilarity, productToForm } from "@/lib/product-form";

const CO = "TEST-CO";
const products = [
  { id: "p1", companyId: CO, sku: "PRD-2610-001", name: "กล้องวงจรปิด Hikvision 2MP Bullet", brand: "Hikvision", model: "DS-2CD1023", supplierConfig: [{ supplierId: "s1", mpn: "DS-2CD1023G0E-I", supplierSku: "HK-1023", isPrimary: true, leadTimeDays: 7 }] },
  { id: "p2", companyId: CO, sku: "PRD-2610-002", name: "สาย LAN CAT6 305 เมตร", brand: "Link", model: "US-9106" },
  { id: "p3", companyId: CO, sku: "PRD-2610-003", name: "กล้องวงจรปิด Hikvision 2MP Bullet", isDeleted: true },
  { id: "p4", companyId: "OTHER", sku: "X", name: "สาย LAN CAT6 305 เมตร" },
];

describe("new product form: possible duplicates while typing", () => {
  it("matches MPN, supplier code and brand+model exactly; deleted/other-company products are ignored", () => {
    expect(findSimilarProducts({ mpn: "ds-2cd1023g0e-i" }, products, CO)).toEqual([{ id: "p1", name: products[0].name, sku: "PRD-2610-001", reason: "MPN ตรงกัน" }]);
    expect(findSimilarProducts({ supplierSku: "HK-1023" }, products, CO)[0]).toMatchObject({ id: "p1", reason: "รหัสผู้ขายตรงกัน" });
    expect(findSimilarProducts({ brand: "link", model: "us-9106" }, products, CO)[0]).toMatchObject({ id: "p2" });
    expect(findSimilarProducts({ name: "สาย LAN CAT6 305 เมตร" }, products, CO).map((s) => s.id)).toEqual(["p2"]);
  });

  it("Thai names without spaces and small typos still match; unrelated names do not", () => {
    expect(nameSimilarity("กล้องวงจรปิดHikvision2MPBullet", "กล้องวงจรปิด Hikvision 2MP Bullet")).toBe(1);
    expect(findSimilarProducts({ name: "กล้องวงจรปิด Hikvision 2MP Bulet" }, products, CO)[0]?.id).toBe("p1");
    expect(findSimilarProducts({ name: "เบรกเกอร์ 32A" }, products, CO)).toEqual([]);
    expect(findSimilarProducts({ name: "สา" }, products, CO)).toEqual([]);
  });
});

describe("new product form: margin against the company GP threshold", () => {
  it("levels: none / loss / low / ok", () => {
    expect(marginOf(100, 0, 15).level).toBe("none");
    expect(marginOf(100, 90, 15)).toMatchObject({ profit: -10, level: "loss" });
    expect(marginOf(100, 110, 15)).toMatchObject({ profit: 10, percent: 9.1, level: "low" });
    expect(marginOf(80, 100, 15)).toMatchObject({ profit: 20, percent: 20, level: "ok" });
  });
});

describe("new product form: create from an existing product / save and add next", () => {
  const INITIAL = { sku: "", barcode: "", name: "", category: "", brand: "", model: "", baseUnit: "", cost: 0, price: 0, supplierId: "", supplierSku: "", mpn: "", supplierConfig: [] as any[], leadTimeDays: null as number | null, qty: null as number | null, sns: "", imageUrl: "", isSerialized: false, reorderPoint: null as number | null, aliases: "", accessories: "" };
  const src = { ...products[0], barcode: "885000", imageUrl: "x.png", unit: "ตัว", category: "cctv", isSerialTracked: true, pricing: { costWAC: 900, pricePOS: 1290 }, inventoryControl: { reorderPoint: 5 }, aliases: [{ name: "กล้อง 2 ล้าน" }], accessories: ["พุก", "น็อต"], somethingElse: 1 };

  it("copies reusable data, never identity, stock or part numbers", () => {
    const f = productToForm(INITIAL, src);
    expect(f).toMatchObject({ name: src.name, category: "cctv", brand: "Hikvision", baseUnit: "ตัว", cost: 900, price: 1290, supplierId: "s1", leadTimeDays: 7, isSerialized: true, reorderPoint: 5, aliases: "กล้อง 2 ล้าน", accessories: "พุก, น็อต" });
    expect(f).toMatchObject({ sku: "", barcode: "", imageUrl: "", qty: null, sns: "", mpn: "", supplierSku: "" });
    expect(f.supplierConfig[0]).toMatchObject({ supplierId: "s1", mpn: "", supplierSku: "" });
    expect("somethingElse" in f).toBe(false);
  });

  it("save and add next keeps category/brand/unit/supplier but clears the product itself", () => {
    const saved = { ...INITIAL, name: "A", sku: "PRD-1", barcode: "1", category: "cctv", brand: "Dahua", baseUnit: "ตัว", supplierId: "s1", cost: 10, price: 20, isSerialized: true };
    expect(carryOver(INITIAL, saved)).toMatchObject({ name: "", sku: "", barcode: "", cost: 0, price: 0, category: "cctv", brand: "Dahua", baseUnit: "ตัว", supplierId: "s1", isSerialized: true });
  });
});

describe("service/licence items are not stock items", () => {
  it("itemType first, then the form's productType", async () => {
    const { isStockItem } = await import("@/lib/product-kind");
    expect(isStockItem({ itemType: "SERVICE" })).toBe(false);
    expect(isStockItem({ productType: "SERVICE" })).toBe(false);
    expect(isStockItem({ itemType: "LABOR" })).toBe(false);
    expect(isStockItem({ productType: "PHYSICAL" })).toBe(true);
    expect(isStockItem({})).toBe(true);
  });
});
