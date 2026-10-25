import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATES, mapHeaders, parseNumber, parseRows, toCreateRequest, toTemplateRow } from "@/lib/import/templates";

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

describe("excel export → edit → import round trip", () => {
  const roundTrip = (entity: "customers" | "suppliers" | "products" | "employees", record: Record<string, any>) => {
    const t = IMPORT_TEMPLATES[entity];
    const headers = t.columns.map((c) => (c.required ? `${c.header}*` : c.header));
    const { index, missing } = mapHeaders(t, headers);
    expect(missing).toEqual([]);
    const [row] = parseRows(t, [toTemplateRow(entity, record)], index);
    expect(row.errors).toEqual([]);
    return row.values;
  };

  it("every form field has a column (customers, suppliers, products, employees)", () => {
    const keys = (e: keyof typeof IMPORT_TEMPLATES) => IMPORT_TEMPLATES[e].columns.map((c) => c.key);
    expect(keys("customers")).toEqual(expect.arrayContaining(["_id", "name", "orgType", "taxId", "branchCode", "branchName", "address", "building", "soi", "road", "subDistrict", "district", "province", "zipCode", "phone", "email", "contactPerson", "creditLimit", "creditTermDays"]));
    expect(keys("suppliers")).toEqual(expect.arrayContaining(["_id", "category", "bankName", "bankAccount", "bankAccountName", "paymentMethod", "businessType", "chequePickupDay"]));
    expect(keys("products")).toEqual(expect.arrayContaining(["_id", "subCategory", "taxType", "packageUnit", "conversionRate", "priceProject", "priceWholesale", "minimumFloorPrice", "minStock", "maxStock", "warehouseId", "rackLocation", "isSerialized", "warrantyMonths", "weightKg", "supplierSku", "leadTimeDays", "lifecycleStatus"]));
    expect(keys("employees")).toEqual(expect.arrayContaining(["_id", "prefix", "firstName", "lastName", "citizenId", "position", "department", "employmentType", "joinDate", "status", "salary", "socialSecurity", "bankName", "bankAccount"]));
  });

  it("customer and supplier records come back with the same values and their system id", () => {
    const c = roundTrip("customers", { id: "C-1", name: "บริษัท ทดสอบ จำกัด", docProfile: { orgType: "GOV" }, taxId: "0105561234567", branchCode: "00001", branchName: "บางนา", addressNo: "99/1", road: "บางนา-ตราด", province: "กรุงเทพมหานคร", phoneNumber: "021234567", creditLimit: 50000, creditTermDays: 45 });
    expect(c).toMatchObject({ _id: "C-1", orgType: "GOV", taxId: "0105561234567", branchCode: "00001", branchName: "บางนา", address: "99/1", road: "บางนา-ตราด", creditLimit: 50000, creditTermDays: 45 });
    const s = roundTrip("suppliers", { id: "S-1", name: "ร้านวัสดุ", entity_category: "STORE", tax_id: "0105561234567", payment_method: "CHEQUE", business_type: "GOODS", account_number: "123-4", payment_term: "60 Days" });
    expect(s).toMatchObject({ _id: "S-1", category: "STORE", paymentMethod: "CHEQUE", businessType: "GOODS", bankAccount: "123-4", creditTermDays: 60 });
    expect(toCreateRequest("suppliers", s).data).toMatchObject({ payment_method: "CHEQUE", business_type: "GOODS", account_number: "123-4" });
  });

  it("product record round trip keeps prices, stock control and tracking", () => {
    const p = roundTrip("products", { id: "P-1", sku: "CAM-1", name: "กล้อง", unit: "ตัว", taxType: "EXEMPT", packageUnit: "กล่อง", conversionRate: 10, unitPrice: 2500, pricing: { priceProject: 2800, priceWholesale: 2300, minimumFloorPrice: 2000 }, costPrice: 1800, inventoryControl: { reorderPoint: 5, minStock: 3, maxStock: 50 }, rackLocation: "A-1", isSerialized: true, supplierConfig: [{ supplierSku: "HK-1", leadTimeDays: 7, isPrimary: true }], lifecycleStatus: "PHASE_OUT" });
    expect(p).toMatchObject({ _id: "P-1", taxType: "EXEMPT", packageUnit: "กล่อง", conversionRate: 10, price: 2500, priceProject: 2800, priceWholesale: 2300, minimumFloorPrice: 2000, cost: 1800, minStock: 3, maxStock: 50, rackLocation: "A-1", isSerialized: true, supplierSku: "HK-1", leadTimeDays: 7, lifecycleStatus: "PHASE_OUT" });
    const d = toCreateRequest("products", p).data;
    expect(d).toMatchObject({ taxType: "EXEMPT", conversionRate: 10, purchaseUnit: "กล่อง", isSerialized: true, pricing: { priceProject: 2800, minimumFloorPrice: 2000 }, inventoryControl: { minStock: 3, maxStock: 50 } });
  });

  it("employee round trip (date in Buddhist year, yes/no fields)", () => {
    const e = roundTrip("employees", { id: "E-1", prefix: "Ms.", firstName: "สมหญิง", lastName: "ใจดี", citizenId: "1103700012345", position: "บัญชี", employmentType: "daily", joinDate: "2025-06-01", status: "probation", salary: 450, socialSecurity: false });
    expect(e).toMatchObject({ _id: "E-1", prefix: "Ms.", employmentType: "daily", joinDate: "2025-06-01", status: "probation", salary: 450, socialSecurity: false });
    expect(toCreateRequest("employees", e).data).toMatchObject({ socialSecurity: false, employmentType: "daily" });
  });
});
