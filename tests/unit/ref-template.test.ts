import { describe, expect, it } from "vitest";
import { followRefCost, parseRefRows } from "@/lib/ref-prices";
import { DEFAULT_BOM_SETTINGS, normalizeBomSettings } from "@/lib/bom";

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

describe("ราคากลางขยับตามราคาซื้อจริง", () => {
  const on = { refFollow: "เปิด", refFollowPct: 0.05 };
  it("ซื้อแพงกว่าราคากลาง → ราคาซื้อ + เผื่อ %", () => {
    expect(followRefCost(12.46, 13, on)).toBe(13.65);
    expect(followRefCost(100, 120, { refFollow: "เปิด", refFollowPct: 0 })).toBe(120);
  });
  it("ไม่ปรับ: ซื้อถูกกว่า/เท่า · ไม่มีราคากลาง · ปิดอยู่", () => {
    expect(followRefCost(12.46, 12, on)).toBeNull();
    expect(followRefCost(12.46, 12.46, on)).toBeNull();
    expect(followRefCost(0, 50, on)).toBeNull();
    expect(followRefCost(10, 20, { refFollow: "ปิด", refFollowPct: 0.05 })).toBeNull();
  });
  it("ค่าเริ่มต้นเปิด เผื่อ 5% · ตั้งค่าผิดรูปแบบกลับเป็นค่าเริ่มต้น", () => {
    expect(DEFAULT_BOM_SETTINGS).toMatchObject({ refFollow: "เปิด", refFollowPct: 0.05 });
    expect(normalizeBomSettings({ refFollow: "x", refFollowPct: 0.1 })).toMatchObject({ refFollow: "เปิด", refFollowPct: 0.1 });
    expect(normalizeBomSettings({ refFollow: "ปิด" }).refFollow).toBe("ปิด");
  });
});
