import { describe, expect, it } from "vitest";
import { matchSupplierId, mergeSupplierPrice, normalizeAliases, normalizeSupplierPriceItem, parsePriceDate, parseSupplierPriceSheet, priceKindOf } from "@/lib/supplier-prices";

const HEAD = ["ผู้ขาย (ชื่อใน NEXUS)", "รหัสสินค้า NEXUS (SKU)", "รหัสสินค้าของผู้ขาย", "รายการ", "ยี่ห้อ", "รุ่น", "หน่วย", "ต้นทุน/หน่วย (ก่อน VAT)", "ประเภทราคา", "วันที่ราคา", "งาน/โครงการ", "ไฟล์/หน้าอ้างอิง", "หมายเหตุ"];

describe("อ่านไฟล์ราคาผู้ขาย", () => {
  it("หัวตารางตามไฟล์จริง · ชนิดราคา · วันที่ไทย", () => {
    const { rows, missing } = parseSupplierPriceSheet([
      HEAD,
      ["Interlink", "CB-LNK-9015LSZH", "US-9015LSZH", "สาย CAT5E", "Link", "US-9015LSZH", "กล่อง", 5230, "ราคา List (ก่อนส่วนลด)", "1 ก.ค. 2569", "", "Pricelist InterLink.pdf หน้า 18", "OCR 2 รอบตรงกัน"],
      ["SiS", "CAM-DH-1239", "", "กล้อง", "Dahua", "", "ตัว", "1,050.50", "ใบเสนอราคา/ไฟล์ต้นทุนงาน", "05/03/2569", "TUH", "QT-SIS-001", ""],
      ["SiS", "", "", "ไม่มี SKU", "", "", "ตัว", 0, "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", ""],
    ]);
    expect(missing).toEqual([]);
    expect(rows.length).toBe(3);
    expect(rows[0]).toMatchObject({ rowNo: 2, supplierName: "Interlink", sku: "CB-LNK-9015LSZH", supplierSku: "US-9015LSZH", price: 5230, kind: "LIST", priceDate: "2026-07-01", ref: "Pricelist InterLink.pdf หน้า 18", errors: [] });
    expect(rows[1]).toMatchObject({ price: 1050.5, kind: "QUOTE", priceDate: "2026-03-05", project: "TUH" });
    expect(rows[2].errors).toEqual(["ไม่มีรหัสสินค้า (SKU)", "ราคาไม่ถูกต้อง"]);
  });
  it("ไม่มีหัวตารางที่จำเป็น", () => {
    expect(parseSupplierPriceSheet([["ชื่อ", "ราคา"]]).missing).toEqual(["ผู้ขาย", "รหัสสินค้า NEXUS (SKU)"]);
  });
  it("วันที่หลายแบบ", () => {
    expect(parsePriceDate("24 พ.ย. 2569")).toBe("2026-11-24");
    expect(parsePriceDate("2026-11-24")).toBe("2026-11-24");
    expect(parsePriceDate(46350)).toBe("2026-11-24");
    expect(parsePriceDate("ส.ค. 2569")).toBe("2026-08-01");
    expect(parsePriceDate("2568")).toBe("2025-01-01");
    expect(parsePriceDate("พรุ่งนี้")).toBe("");
    expect(priceKindOf("Price List 2569")).toBe("LIST");
    expect(priceKindOf("ใบเสนอราคา")).toBe("QUOTE");
  });
});

describe("จับคู่ผู้ขาย", () => {
  const sup = [{ id: "S1", name: "Interlink" }, { id: "S2", name: "D.K. Design", taxInvoiceName: "ห้างหุ้นส่วนจำกัด ดี.เค.ดีไซน์ แอนด์ เฟอร์นิชิ่ง" }, { id: "S3", name: "บริษัท ซิส ดิสทริบิวชั่น (ประเทศไทย) จำกัด (มหาชน)", shortName: "SiS" }];
  it("ชื่อ/ชื่อย่อ/ชื่อบนใบกำกับ ไม่สนคำนำหน้าและตัวพิมพ์", () => {
    expect(matchSupplierId("InterLink", sup)).toBe("S1");
    expect(matchSupplierId("dk design", sup)).toBe("S2");
    expect(matchSupplierId("SiS", sup)).toBe("S3");
    expect(matchSupplierId("9D", sup)).toBe("");
  });
  it("ชื่อที่เคยจับคู่เอง (nameAliases) — ไฟล์ใช้ชื่ออังกฤษ ระบบใช้ชื่อไทย", () => {
    const th = [{ id: "S9", name: "บริษัท อินเตอร์ลิ้งค์ คอมมิวนิเคชั่น จำกัด (มหาชน)", nameAliases: ["Interlink"] }];
    expect(matchSupplierId("InterLink", th)).toBe("S9");
    expect(normalizeAliases([{ name: " Interlink ", supplierId: "S9" }, { name: "interlink", supplierId: "S9" }, { name: "x", supplierId: "a/b" }, { name: "", supplierId: "S1" }]))
      .toEqual([{ name: "Interlink", supplierId: "S9" }]);
  });
});

describe("รวมราคาเข้าผู้ขายของสินค้า", () => {
  it("ราคา List เก็บแยก ไม่เป็นต้นทุน · ผู้ขายแรกเป็นผู้ขายหลัก", () => {
    const l = mergeSupplierPrice([], { productId: "P", supplierId: "S1", supplierSku: "US-1", kind: "LIST", price: 5230, priceDate: "2026-07-01", ref: "PL หน้า 18" });
    expect(l).toEqual([{ supplierId: "S1", latestCost: 0, leadTimeDays: 7, isPrimary: true, supplierSku: "US-1", listPrice: 5230, listPriceAt: "2026-07-01", listPriceRef: "PL หน้า 18" }]);
  });
  it("ราคาที่ได้จริง = ต้นทุนล่าสุด เมื่อยังไม่เคยรับจริง · รับจริงแล้วไม่ทับ · ราคาเก่ากว่าไม่ทับ", () => {
    const base = [{ supplierId: "S1", latestCost: 100, leadTimeDays: 5, isPrimary: true, lastReceivedAt: "2026-10-01" }];
    const a = mergeSupplierPrice(base, { productId: "P", supplierId: "S1", kind: "QUOTE", price: 90, priceDate: "2026-11-01", ref: "QT-1" });
    expect(a[0]).toMatchObject({ latestCost: 100, quotedCost: 90, quotedAt: "2026-11-01", leadTimeDays: 5 });
    const b = mergeSupplierPrice([], { productId: "P", supplierId: "S2", kind: "QUOTE", price: 80, priceDate: "2026-11-01" });
    expect(b[0]).toMatchObject({ latestCost: 80, quotedCost: 80, isPrimary: true });
    const older = mergeSupplierPrice(b, { productId: "P", supplierId: "S2", kind: "QUOTE", price: 70, priceDate: "2026-01-01" });
    expect(older[0]).toMatchObject({ quotedCost: 80, latestCost: 80 });
    const second = mergeSupplierPrice(b, { productId: "P", supplierId: "S3", kind: "LIST", price: 99 });
    expect(second.map((c) => [c.supplierId, c.isPrimary])).toEqual([["S2", true], ["S3", false]]);
  });
  it("ตรวจข้อมูลที่ส่งมา", () => {
    expect(normalizeSupplierPriceItem({ productId: "P", supplierId: "S", price: "12.5", kind: "LIST", priceDate: "x" })).toMatchObject({ price: 12.5, kind: "LIST", priceDate: "" });
    expect(normalizeSupplierPriceItem({ productId: "a/b", supplierId: "S", price: 1 })).toBeNull();
    expect(normalizeSupplierPriceItem({ productId: "P", supplierId: "S", price: 0 })).toBeNull();
  });
});
