import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATES, mapHeaders, parseNumber, parseRows, toCreateRequest } from "@/lib/import/templates";

describe("excel import templates", () => {
  it("parses numbers from Excel text", () => {
    expect(parseNumber("1,234.50")).toBe(1234.5);
    expect(parseNumber("๑๒๓")).toBe(123);
    expect(parseNumber("฿ 2,000")).toBe(2000);
    expect(parseNumber("")).toBeNull();
    expect(Number.isNaN(parseNumber("abc"))).toBe(true);
  });

  it("maps headers by name in any order and reports missing required", () => {
    const t = IMPORT_TEMPLATES.products;
    const m = mapHeaders(t, ["หน่วย", "ชื่อสินค้า*", "รหัสสินค้า (SKU)", "คอลัมน์อื่น"]);
    expect(m.index).toMatchObject({ unit: 0, name: 1, sku: 2 });
    expect(m.unknown).toEqual(["คอลัมน์อื่น"]);
    expect(mapHeaders(t, ["ชื่อสินค้า"]).missing).toEqual(["รหัสสินค้า (SKU)", "หน่วย"]);
  });

  it("validates rows, skips blank rows, detects duplicates in the file", () => {
    const t = IMPORT_TEMPLATES.customers;
    const { index } = mapHeaders(t, ["ชื่อลูกค้า", "เลขประจำตัวผู้เสียภาษี", "รหัสสาขา", "อีเมล", "วงเงินเครดิต (บาท)"]);
    const rows = parseRows(t, [
      ["ลูกค้า A", "0-1055-61234-56-7", "", "a@x.co", "1,000"],
      [null, "", "", "", ""],
      ["", "123", "2", "bad", "-5"],
      ["ลูกค้า C", "0105561234567", "สำนักงานใหญ่", "", ""],
    ], index);
    expect(rows.map((r) => r.rowNo)).toEqual([2, 4, 5]);
    expect(rows[0]).toMatchObject({ values: { name: "ลูกค้า A", taxId: "0105561234567", branchCode: "00000", email: "a@x.co", creditLimit: 1000 }, errors: [] });
    expect(rows[1].errors).toEqual(expect.arrayContaining(["ไม่มีชื่อลูกค้า", expect.stringContaining("13 หลัก"), expect.stringContaining("อีเมล"), expect.stringContaining("ไม่ติดลบ")]));
    expect(rows[2].errors[0]).toContain("ซ้ำกับแถว 2");
  });

  it("restores leading zeros Excel drops from numeric cells", () => {
    const t = IMPORT_TEMPLATES.customers;
    const { index } = mapHeaders(t, ["ชื่อลูกค้า", "เลขประจำตัวผู้เสียภาษี", "โทรศัพท์"]);
    const [r] = parseRows(t, [["A", 105561234567, 21234567]], index);
    expect(r.values).toMatchObject({ taxId: "0105561234567", phone: "021234567" });
  });

  it("builds the same request shape as the in-app forms", () => {
    const p = toCreateRequest("products", { sku: "A1", name: "กล้อง", unit: "ตัว", price: 2500, cost: 1800, openingQty: 3 }, { postOpeningJournal: false });
    expect(p.data).toMatchObject({ sku: "A1", itemType: "PRODUCT", pricing: { pricePOS: 2500 }, costPrice: 1800 });
    expect(p.openingStock).toEqual({ qty: 3, unitCost: 1800, postJournal: false });
    expect(toCreateRequest("products", { sku: "S1", name: "ค่าติดตั้ง", unit: "งาน", itemType: "SERVICE", openingQty: 0 }).openingStock).toBeUndefined();
    const s = toCreateRequest("suppliers", { name: "ร้าน", category: "STORE", creditTermDays: 45 });
    expect(s.data).toMatchObject({ entity_category: "STORE", category: "ห้าง/ร้าน", payment_term: "45 Days", branchCode: "00000" });
    const svc = parseRows(IMPORT_TEMPLATES.products, [["X", "บริการ", "บริการ", "งาน", "5"]], mapHeaders(IMPORT_TEMPLATES.products, ["รหัสสินค้า (SKU)", "ชื่อสินค้า", "ประเภท", "หน่วย", "จำนวนคงเหลือยกมา"]).index);
    expect(svc[0].errors).toContain("บริการไม่มีจำนวนคงเหลือยกมา");
  });
});
