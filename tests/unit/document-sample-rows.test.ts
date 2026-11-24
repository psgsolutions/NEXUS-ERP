import { describe, expect, it } from "vitest";
import { sampleModelFor, withSampleRows } from "@/lib/documents/build";

const seller: any = { name: "บริษัทตัวอย่าง จำกัด", taxId: "0105500000000", address: "กรุงเทพฯ" };
const today = "2026-11-24";

describe("แถวรายการตัวอย่างในหน้าออกแบบ", () => {
  it("ใบเสนอราคา: ได้จำนวนแถวตามที่เลือก รหัสไม่ซ้ำ ยอดต่อแถว = จำนวน × ราคา", () => {
    const m = withSampleRows(sampleModelFor("quotation", seller, today), 4, "detail");
    const rows = m.lines.filter((l) => !l.heading);
    expect(rows.length).toBe(4);
    expect(m.lines.some((l) => l.heading)).toBe(false);
    expect(new Set(rows.map((l) => l.code)).size).toBe(4);
    for (const l of rows) expect(l.amount).toBe((l.qty || 0) * (l.price || 0));
    expect(rows.some((l) => l.detail)).toBe(true);
  });
  it("บรรทัดเดียว = ไม่มีรายละเอียด · หัวข้อกลุ่มทุก 5 แถว", () => {
    const plain = withSampleRows(sampleModelFor("invoice", seller, today), 3, "plain");
    expect(plain.lines.length).toBe(3);
    expect(plain.lines.every((l) => !l.detail)).toBe(true);
    const grouped = withSampleRows(sampleModelFor("quotation", seller, today), 12, "heading");
    expect(grouped.lines.filter((l) => l.heading).length).toBe(3);
    expect(grouped.lines.filter((l) => !l.heading).length).toBe(12);
  });
  it("ใบวางบิล: ใช้แถวแบบรายการใบกำกับของเอกสารนั้น (ไม่มีจำนวน/หน่วย) เลขที่เรียงต่อ", () => {
    const m = withSampleRows(sampleModelFor("billing_note", seller, today), 5, "plain");
    expect(m.lines.length).toBe(5);
    expect(m.lines.every((l) => l.qty === undefined && /^IV6910-\d+$/.test(l.code || ""))).toBe(true);
    expect(new Set(m.lines.map((l) => l.code)).size).toBe(5);
  });
  it("0 แถว = ตัวอย่างเดิม · หนังสือ (ไม่มีตาราง) ไม่เปลี่ยน", () => {
    const q = sampleModelFor("quotation", seller, today);
    expect(withSampleRows(q, 0)).toBe(q);
    const letter = sampleModelFor("letter", seller, today);
    expect(withSampleRows(letter, 4)).toBe(letter);
  });
});
