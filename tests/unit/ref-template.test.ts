import { describe, expect, it } from "vitest";
import { parseRefRows } from "@/lib/ref-prices";

/** แม่แบบที่ดาวน์โหลดจากหน้าราคากลาง ต้องนำเข้ากลับได้ตรงทุกคอลัมน์ */
describe("แม่แบบราคากลาง นำเข้ากลับได้", () => {
  const head = ["รหัส", "รายการ (ไทย)", "Description (EN)", "หมวด", "หน่วย", "ต้นทุน/หน่วย", "ที่มาของราคา", "สถานะราคา"];
  it("อ่านทุกคอลัมน์ · แถวที่ยังไม่กรอกชื่อถูกข้าม", () => {
    const rows = parseRefRows([
      head,
      ["UTP-CAT6", "สาย UTP CAT6", "CAT6 cable", "สาย", "ม.", 12.46, "ใบเสนอราคาผู้ขาย", ""],
      ['EMT-1"', "ท่อ EMT 1 นิ้ว", "", "ท่อ", "เส้น", 71.67, "เว็บ", "WEB"],
      ["CONSUM", "วัสดุสิ้นเปลือง", "", "สิ้นเปลือง", "จุด", 10, "", "Y"],
      ['FLEX-1/2"', "", "", "", "ม.", "", "", ""],
    ]);
    expect(rows.map((r) => [r.code, r.unit, r.cost, r.status])).toEqual([["UTP-CAT6", "ม.", 12.46, ""], ['EMT-1"', "เส้น", 71.67, "WEB"], ["CONSUM", "จุด", 10, "Y"]]);
    expect(rows[0]).toMatchObject({ name: "สาย UTP CAT6", nameEn: "CAT6 cable", category: "สาย", source: "ใบเสนอราคาผู้ขาย" });
  });
});
