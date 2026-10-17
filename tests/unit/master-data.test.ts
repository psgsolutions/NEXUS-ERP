import { describe, expect, it } from "vitest";
import { deepMerge, groupIdOf, mergeRecord, splitChanges, uniqueKeyDocId, uniqueKeyValue } from "@/lib/master-data";

describe("ข้อมูลหลักแบบเครือ", () => {
  it("บริษัทที่ไม่มี groupId เป็นเครือของตัวเอง", () => {
    expect(groupIdOf(null, "C1")).toBe("C1");
    expect(groupIdOf({ groupId: " " }, "C1")).toBe("C1");
    expect(groupIdOf({ groupId: "G1" }, "C1")).toBe("G1");
  });

  it("รวมข้อมูล: ตัวตนมาจากกลางเสมอ ค่าบริษัทที่ไม่ว่างทับค่ากลาง", () => {
    const master = { sku: "CAM-4MP", barcode: "885", name: "กล้อง IP 4MP", category: "CCTV" };
    const local = { sku: "HACK", name: "กล้องวงจรปิดภายนอก 4 ล้าน", category: "", price: 3900, stock: 0 };
    const r = mergeRecord<any>("products", master, local);
    expect(r.sku).toBe("CAM-4MP");
    expect(r.name).toBe("กล้องวงจรปิดภายนอก 4 ล้าน");
    expect(r.category).toBe("CCTV");
    expect(r.price).toBe(3900);
    expect(r._localFields).toEqual(["name"]);
    expect(r._hasMaster).toBe(true);
  });

  it("รายการเก่าที่ยังไม่มีข้อมูลกลาง ใช้ข้อมูลของบริษัททั้งหมด", () => {
    const r = mergeRecord<any>("customers", null, { name: "ลูกค้าเดิม", taxId: "0105555555555" });
    expect(r.taxId).toBe("0105555555555");
    expect(r._hasMaster).toBe(false);
  });

  it("แยกฟิลด์: ตัวตน -> กลาง, ค่าร่วม -> ตาม scope, ที่เหลือ -> บริษัท", () => {
    const changes = { sku: "X1", name: "ชื่อใหม่", price: 100, _localFields: [], id: "p1", companyId: "C1" };
    expect(splitChanges("products", changes, "company")).toEqual({ master: { sku: "X1" }, local: { name: "ชื่อใหม่", price: 100 } });
    expect(splitChanges("products", changes, "group")).toEqual({ master: { sku: "X1", name: "ชื่อใหม่" }, local: { price: 100 } });
    expect(splitChanges("suppliers", { taxId: "1", creditTermDays: 30 }, "company")).toEqual({ master: { taxId: "1" }, local: { creditTermDays: 30 } });
  });

  it("คีย์ห้ามซ้ำ: ไม่สนตัวพิมพ์/ช่องว่าง สาขาว่าง = สำนักงานใหญ่ ค่าว่างไม่ตรวจ", () => {
    expect(uniqueKeyValue(["sku"], { sku: " cam 4mp " })).toBe("CAM4MP");
    expect(uniqueKeyValue(["taxId", "branchCode"], { taxId: "0105555555555" })).toBe("0105555555555|00000");
    expect(uniqueKeyValue(["taxId", "branchCode"], { taxId: "0105555555555", branchCode: "00001" })).toBe("0105555555555|00001");
    expect(uniqueKeyValue(["barcode"], { barcode: "" })).toBe("");
    expect(uniqueKeyDocId("products", ["sku"], "A/B")).toBe("products__sku__A_B");
  });

  it("รวมแบบลงลึก: ตั้งราคาโครงการทับแล้วราคาหน้าร้าน/ต้นทุนไม่หาย", () => {
    const r = deepMerge({ pricing: { pricePOS: 100, costWAC: 60 }, tags: ["a"] }, { pricing: { priceProject: 150 }, tags: ["b"] });
    expect(r).toEqual({ pricing: { pricePOS: 100, costWAC: 60, priceProject: 150 }, tags: ["b"] });
  });
});
