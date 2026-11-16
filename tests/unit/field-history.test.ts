import { describe, expect, it } from "vitest";
import { KEY_RE, matchHistory, MAX_VALUES, pushValue } from "@/lib/field-history";

describe("ข้อมูลเก่าที่เคยบันทึกต่อช่องกรอก", () => {
  it("ค่าใหม่อยู่หน้าสุด ค่าซ้ำย้ายขึ้นหน้าและนับครั้ง · สั้นกว่า 2 ตัวไม่จำ · เก็บไม่เกินที่กำหนด", () => {
    let l = pushValue([], "ต้นทางเข้า Patch Panel", 1);
    l = pushValue(l, "ชำระ 50/50", 2);
    l = pushValue(l, "  ต้นทางเข้า Patch Panel ", 3);
    expect(l.map((x) => x.v)).toEqual(["ต้นทางเข้า Patch Panel", "ชำระ 50/50"]);
    expect(l[0].n).toBe(2);
    expect(pushValue(l, "x")).toBe(l);
    let big: any[] = [];
    for (let i = 0; i < MAX_VALUES + 5; i++) big = pushValue(big, `ค่า ${i}`);
    expect(big).toHaveLength(MAX_VALUES);
  });
  it("กรองตามคำที่พิมพ์ (ทุกคำ) และไม่แสดงค่าที่อยู่ในช่องแล้ว", () => {
    const list = ["ต้นทางเข้า Patch Panel ปลายทาง Outlet", "เดินสายร้อยท่อ", "ต้นทางเข้า Rack"];
    expect(matchHistory(list, "")).toEqual(list);
    expect(matchHistory(list, "ต้นทาง outlet")).toEqual([list[0]]);
    expect(matchHistory(list, "เดินสายร้อยท่อ")).toEqual([]);
  });
  it("ชื่อช่องต้องเป็นรูปแบบที่กำหนด", () => {
    expect(KEY_RE.test("quotation.remark")).toBe(true);
    expect(KEY_RE.test("../x")).toBe(false);
  });
});
