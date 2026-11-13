import { describe, expect, it } from "vitest";
import { catalogToProduct, searchCatalog, type CatalogItem } from "@/lib/supplier-catalog";

const item = (c: string, n: string, m: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({ c, s: `NW-X-${m}`, n, b: n.split(" : ")[0], m, g: "ระบบเครือข่าย", h: "สวิตช์ (Switch)", u: "เครื่อง", t: "P", p: 1000, k: 800, w: 12, bc: "", ...extra });
const items = [
  item("ARU-JL682A", "Aruba : Instant On 1930 24G 4SFP+ (JL682A)", "JL682A"),
  item("ARU-JL683A", "Aruba : Instant On 1930 24G Class4 PoE (JL683A)", "JL683A"),
  item("TPL-SG1024", "TP-Link : TL-SG1024 24-Port Gigabit (TL-SG1024)", "TL-SG1024"),
  item("HIK-2CD1043", "Hikvision : DS-2CD1043G2-LIUF 4MP (DS-2CD1043G2-LIUF)", "DS-2CD1043G2-LIUF", { h: "กล้อง IP/อุปกรณ์กล้อง" }),
];

describe("แคตตาล็อกผู้ขาย", () => {
  it("ค้นทุกคำ ไม่สนช่องว่าง/ขีด · รุ่นตรงมาก่อน", () => {
    expect(searchCatalog(items, "1930 24g").map((x) => x.c)).toEqual(["ARU-JL682A", "ARU-JL683A"]);
    expect(searchCatalog(items, "jl683a")[0].c).toBe("ARU-JL683A");
    expect(searchCatalog(items, "tlsg1024")[0].c).toBe("TPL-SG1024");
    expect(searchCatalog(items, "ds2cd1043")[0].c).toBe("HIK-2CD1043");
    expect(searchCatalog(items, "x")).toEqual([]);
  });

  it("แปลงเป็นสินค้า: ผู้ขายหลัก + ทุน + Part number + ที่มา", () => {
    const p = catalogToProduct(items[0], { key: "SIS", supplierId: "SUP-1", version: "v1" });
    expect(p.sku).toBe("NW-X-JL682A");
    expect(p.partNumber).toBe("JL682A");
    expect(p.costPrice).toBe(800);
    expect(p.pricing.pricePOS).toBe(1000);
    expect(p.supplierConfig).toEqual([{ supplierId: "SUP-1", supplierSku: "ARU-JL682A", latestCost: 800, leadTimeDays: 7, isPrimary: true }]);
    expect(p.sourceCatalog).toEqual({ key: "SIS", code: "ARU-JL682A", version: "v1" });
    expect(catalogToProduct({ ...items[0], t: "S" }, { key: "SIS", supplierId: "S", version: "1" }).itemType).toBe("SERVICE");
  });
});
