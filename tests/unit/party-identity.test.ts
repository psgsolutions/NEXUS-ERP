import { describe, expect, it } from "vitest";
import { exactDuplicate, isValidThaiTaxId, partyDocName, sameTaxIdRecords, taxIdProblem } from "@/lib/party-identity";
import { MASTER_SCHEMAS, uniqueKeyValue } from "@/lib/master-data";
import { IMPORT_TEMPLATES, mapHeaders, parseRows } from "@/lib/import/templates";

const BMA = "0994000165510"; // เลขผู้เสียภาษีที่ผ่านสูตรตรวจ (ตัวอย่างหน่วยงานรัฐ)

describe("tax ID check digit (Revenue Department mod 11)", () => {
  it("accepts valid numbers and catches a one-digit typo", () => {
    expect(isValidThaiTaxId(BMA)).toBe(true);
    expect(isValidThaiTaxId("0-9940-00165-51-0")).toBe(true);
    expect(isValidThaiTaxId("0994000165511")).toBe(false);
    expect(taxIdProblem("0994000165511")).toContain("สูตรตรวจ");
    expect(taxIdProblem("12345")).toContain("13 หลัก");
    expect(taxIdProblem("")).toBe("");
  });
});

describe("one taxpayer, many units (e.g. city districts, air force wings)", () => {
  const list = [
    { id: "C1", name: "กรุงเทพมหานคร", taxId: BMA, branchCode: "00000" },
    { id: "C2", name: "กรุงเทพมหานคร", taxId: BMA, branchCode: "00000", unitName: "สำนักงานเขตบางรัก" },
    { id: "C3", name: "กรุงเทพมหานคร", taxId: BMA, branchCode: "00000", unitName: "สำนักการโยธา", taxInvoiceName: "สำนักการโยธา กรุงเทพมหานคร" },
    { id: "X", name: "อื่น", taxId: "0105536092641" },
  ];

  it("unique key includes the unit, so units can share tax ID + branch", () => {
    const [keys] = MASTER_SCHEMAS.customers.unique;
    expect(keys).toEqual(["taxId", "branchCode", "unitName"]);
    const main = uniqueKeyValue(keys, list[0]), unit = uniqueKeyValue(keys, list[1]);
    expect(main).not.toBe(unit);
    expect(uniqueKeyValue(keys, { taxId: BMA, branchCode: "", unitName: "  ", name: "กรุงเทพ มหานคร" })).toBe(main); // หน่วยงานว่าง = ใช้ชื่อ · สาขาว่าง = 00000
    expect(uniqueKeyValue(keys, { taxId: BMA, unitName: "สำนักงานเขต บางรัก" })).toBe(unit); // เว้นวรรคต่างกันถือว่าซ้ำ
  });

  it("lists every unit that already uses the tax ID and finds the exact duplicate", () => {
    const same = sameTaxIdRecords(list, BMA, "C1");
    expect(same.map((s) => s.id)).toEqual(["C2", "C3"]);
    expect(exactDuplicate(sameTaxIdRecords(list, BMA), "", { name: "กรุงเทพมหานคร" })?.id).toBe("C1");
    expect(exactDuplicate(sameTaxIdRecords(list, BMA), "00000", { unitName: "สำนักงานเขตบางรัก" })?.id).toBe("C2");
    expect(exactDuplicate(sameTaxIdRecords(list, BMA), "00000", { unitName: "สำนักงานเขตปทุมวัน" })).toBeNull();
  });

  it("same tax ID with a different name is another record (1 name = 1 address)", () => {
    const [keys] = MASTER_SCHEMAS.customers.unique;
    const a = uniqueKeyValue(keys, { taxId: BMA, name: "สำนักงานเขตบางรัก" });
    const b = uniqueKeyValue(keys, { taxId: BMA, name: "สำนักงานเขตปทุมวัน" });
    expect(a).not.toBe(b);
    expect(uniqueKeyValue(keys, { taxId: BMA, name: "สำนักงานเขต บางรัก" })).toBe(a);
    expect(uniqueKeyValue(keys, { taxId: BMA, name: "ชื่ออื่น", unitName: "สำนักงานเขตบางรัก" })).toBe(a); // ชื่อหน่วยงานมาก่อนชื่อรายการ
    expect(exactDuplicate(sameTaxIdRecords(list, BMA), "00000", { name: "สำนักงานเขตปทุมวัน" })).toBeNull();
    const t = IMPORT_TEMPLATES.customers;
    const head = ["ชื่อลูกค้า*", "เลขประจำตัวผู้เสียภาษี"];
    const rows = parseRows(t, [["สำนักงานเขตบางรัก", BMA], ["สำนักงานเขตปทุมวัน", BMA], ["สำนักงานเขต บางรัก", BMA]], mapHeaders(t, head).index);
    expect(rows.map((x) => x.errors.length)).toEqual([0, 0, 1]);
  });

  it("name on documents is set per unit", () => {
    expect(partyDocName(list[0])).toBe("กรุงเทพมหานคร");
    expect(partyDocName(list[1])).toBe("กรุงเทพมหานคร (สำนักงานเขตบางรัก)");
    expect(partyDocName(list[2])).toBe("สำนักการโยธา กรุงเทพมหานคร");
  });

  it("import: units with the same tax ID are allowed, the same unit twice is not", () => {
    const t = IMPORT_TEMPLATES.customers;
    const { index } = mapHeaders(t, ["ชื่อลูกค้า", "เลขประจำตัวผู้เสียภาษี", "หน่วยงาน"]);
    const rows = parseRows(t, [
      ["กรุงเทพมหานคร", BMA, ""],
      ["กรุงเทพมหานคร", BMA, "สำนักงานเขตบางรัก"],
      ["กรุงเทพมหานคร", BMA, "สำนักงานเขต บางรัก"],
      ["กรุงเทพมหานคร", "0994000165511", ""],
    ], index);
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].errors[0]).toContain("ซ้ำกับแถว 3");
    expect(rows[3].errors[0]).toContain("สูตรตรวจ");
  });
});
