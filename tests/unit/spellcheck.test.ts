import { describe, expect, it } from "vitest";
import { applyTypoFixes, buildAddressIndex, checkThaiAddress, editDistance, findTypos, normalizeThaiText } from "@/lib/spellcheck";

describe("spell check: safe automatic clean-up", () => {
  it("fixes nikhahit + sara aa from copied PDFs, double spaces and invisible characters", () => {
    expect(normalizeThaiText("  บริษัท ทดสอบ  จํากัด​ ")).toEqual({ text: "บริษัท ทดสอบ จำกัด", changes: expect.any(Number) });
    expect(normalizeThaiText("บริษัท ทดสอบ จำกัด").changes).toBe(0);
  });
});

describe("spell check: typos with suggestions", () => {
  it("common business misspellings", () => {
    expect(findTypos("บริษท ไทยเทค จำกัษ")).toEqual(expect.arrayContaining([
      expect.objectContaining({ wrong: "บริษท", suggest: "บริษัท" }),
      expect.objectContaining({ wrong: "จำกัษ", suggest: "จำกัด" }),
    ]));
    expect(applyTypoFixes("บริษท ไทยเทค จำกัษ")).toBe("บริษัท ไทยเทค จำกัด");
  });

  it("one-letter slips of key words", () => {
    expect(findTypos("มหาวิทยาลัยเทคโนโลยีราชมงคล")).toEqual([]);
    expect(findTypos("โรงพยาบาลศิริราช")).toEqual([]);
    expect(applyTypoFixes("กองทัพอากาษ")).toBe("กองทัพอากาศ");
    expect(applyTypoFixes("โรงพยาบาณศิริราช")).toBe("โรงพยาบาลศิริราช");
  });

  it("broken Thai structure: doubled marks, stacked tones", () => {
    expect(applyTypoFixes("กล้่่องวงจรปิด")).not.toMatch(/[่-๋]{2}/);
    expect(findTypos("แอร์์").map((t) => t.reason)).toContain("เครื่องหมายซ้ำ");
    expect(findTypos("ก่้า").map((t) => t.reason)).toContain("วรรณยุกต์ซ้อน");
  });

  it("correct text and English produce no warnings", () => {
    for (const ok of ["บริษัท ซีเอ็ด ยูเคชั่น จำกัด (มหาชน)", "ห้างหุ้นส่วนจำกัด สมชายการช่าง", "กรุงเทพมหานคร (สำนักงานเขตบางรัก)", "Cisco Catalyst 9200L", "สาย LAN CAT6 305 เมตร", "เบรกเกอร์ 32A", "ติดตั้งและบำรุงรักษา", "กิตติศักดิ์ แก้วใส", "สิทธิ์การใช้งาน"]) {
      expect(findTypos(ok), ok).toEqual([]);
    }
  });

  it("edit distance counts Thai code points", () => {
    expect(editDistance("บริษัท", "บริษท")).toBe(1);
    expect(editDistance("abc", "abd", 0)).toBe(1);
  });
});

describe("spell check: Thai address against the national address list", () => {
  const idx = buildAddressIndex([
    { district: "สีลม", amphoe: "บางรัก", province: "กรุงเทพมหานคร", zipcode: 10500 },
    { district: "สุริยวงศ์", amphoe: "บางรัก", province: "กรุงเทพมหานคร", zipcode: 10500 },
    { district: "ปทุมวัน", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร", zipcode: 10330 },
    { district: "บางพระ", amphoe: "ศรีราชา", province: "ชลบุรี", zipcode: 20110 },
  ]);
  it("accepts correct addresses (with prefixes and short forms)", () => {
    expect(checkThaiAddress({ province: "กทม.", district: "เขตบางรัก", subDistrict: "แขวงสีลม", zipCode: "10500" }, idx)).toEqual([]);
    expect(checkThaiAddress({ province: "จังหวัดชลบุรี", district: "อำเภอศรีราชา", subDistrict: "ตำบลบางพระ", zipCode: 20110 }, idx)).toEqual([]);
  });
  it("suggests the closest province, district, sub-district and the right postcode", () => {
    expect(checkThaiAddress({ province: "ชลบุร", district: "ศรีราชา" }, idx)[0]).toMatchObject({ field: "province", suggest: "ชลบุรี" });
    expect(checkThaiAddress({ province: "กรุงเทพมหานคร", district: "บางลัก" }, idx)[0]).toMatchObject({ field: "district", suggest: "บางรัก" });
    expect(checkThaiAddress({ province: "กรุงเทพมหานคร", district: "บางรัก", subDistrict: "สีรม" }, idx)[0]).toMatchObject({ field: "subDistrict", suggest: "สีลม" });
    expect(checkThaiAddress({ province: "กรุงเทพมหานคร", district: "บางรัก", subDistrict: "สีลม", zipCode: "10330" }, idx)[0]).toMatchObject({ field: "zipCode", suggest: "10500" });
  });
});

describe("import: spelling per row (never blocks the import)", () => {
  it("cleans text, suggests fixes for names and addresses", async () => {
    const { checkRowSpelling } = await import("@/lib/import/row-check");
    const { IMPORT_TEMPLATES } = await import("@/lib/import/templates");
    const idx = buildAddressIndex([{ district: "สีลม", amphoe: "บางรัก", province: "กรุงเทพมหานคร", zipcode: 10500 }]);
    const r = checkRowSpelling(IMPORT_TEMPLATES.customers, { name: "บริษท  ทดสอบ จํากัด", province: "กรุงเทพมหานคร", district: "บางลัก", subDistrict: "สีลม", zipCode: "10500" }, idx);
    expect(r.values.name).toBe("บริษท ทดสอบ จำกัด");
    expect(r.normalized).toBeGreaterThan(0);
    expect(r.fixes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "name", to: "บริษัท ทดสอบ จำกัด" }),
      expect.objectContaining({ key: "district", to: "บางรัก" }),
    ]));
    expect(checkRowSpelling(IMPORT_TEMPLATES.customers, { name: "บริษัท ทดสอบ จำกัด", province: "กรุงเทพมหานคร", district: "บางรัก" }, idx).fixes).toEqual([]);
  });
});
