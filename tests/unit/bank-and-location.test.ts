import { describe, expect, it } from "vitest";
import { matchStatement, parseStatementCsv } from "@/lib/subledgers";
import { binLocation, findLocation, findProductByScan } from "@/lib/warehouse-location";
import { slaRemainingHours } from "@/lib/service-tickets";

describe("กระทบยอดธนาคาร", () => {
  it("อ่าน CSV แบบ ถอน/ฝาก วันที่ พ.ศ. และตัวเลขมีจุลภาค", () => {
    const csv = "﻿วันที่,รายละเอียด,ถอน,ฝาก\n05/10/2569,รับโอน,,\"1,070.00\"\n20/10/2569,ค่าเช่า,200,\nวันไม่รู้,x,1,";
    const { rows, errors } = parseStatementCsv(csv);
    expect(rows).toEqual([
      { date: "2026-10-05", description: "รับโอน", amount: 1070 },
      { date: "2026-10-20", description: "ค่าเช่า", amount: -200 },
    ]);
    expect(errors).toHaveLength(1);
  });

  it("ไม่มีหัวคอลัมน์วันที่ต้องแจ้ง", () => {
    expect(parseStatementCsv("a,b\n1,2").errors.length).toBe(1);
  });

  it("จับคู่ยอดเท่ากันภายใน 3 วัน เลือกวันใกล้สุด และจับได้ครั้งเดียว", () => {
    const book = [
      { key: "R1", date: "2026-10-05", inAmount: 1070, outAmount: 0 },
      { key: "P1", date: "2026-10-20", inAmount: 0, outAmount: 200 },
      { key: "P2", date: "2026-10-01", inAmount: 0, outAmount: 200 },
    ] as any[];
    const rows = [
      { date: "2026-10-06", description: "", amount: 1070 },
      { date: "2026-10-21", description: "", amount: -200 },
    ];
    const m = matchStatement(book, rows);
    expect(m.matches).toEqual(expect.arrayContaining([{ bookKey: "R1", rowIndex: 0 }, { bookKey: "P1", rowIndex: 1 }]));
    expect(m.unmatchedBook).toEqual(["P2"]);
    expect(m.unmatchedRows).toEqual([]);
  });
});

describe("ตำแหน่งในคลัง", () => {
  const options = [
    { code: "WH-01-A-R01-L1-B01" }, { code: "WH-01-A-R01-L2-B03" }, { code: "WH-01-S-RS1-L1" },
  ] as any[];

  it("รหัสช่อง: มีหลายช่องต่อชั้นจึงมี -Bxx", () => {
    expect(binLocation("WH-01", "A", "R01", 2, 3, 4)).toBe("WH-01-A-R01-L2-B03");
    expect(binLocation("WH-01", "A", "R01", 2, 1, 1)).toBe("WH-01-A-R01-L2");
  });

  it("สแกน QR แบบ URL หรือรหัสตรง และยิงชั้นวาง = ชั้น 1 ช่อง 1", () => {
    expect(findLocation(options, "https://x.app/inventory?loc=WH-01-A-R01-L2-B03")?.code).toBe("WH-01-A-R01-L2-B03");
    expect(findLocation(options, " wh-01-a-r01-l2-b03 ")?.code).toBe("WH-01-A-R01-L2-B03");
    expect(findLocation(options, "WH-01-A-R01")?.code).toBe("WH-01-A-R01-L1-B01");
    expect(findLocation(options, "https://x.app/i?loc=wh-01-s-rs1&x=1")?.code).toBe("WH-01-S-RS1-L1");
  });

  it("หาสินค้าจากบาร์โค้ด/รหัส", () => {
    const products = [{ id: "p1", sku: "PRD-1", barcode: "885000111" }, { id: "p2", sku: "prd-2" }];
    expect(findProductByScan(products, "885000111")?.id).toBe("p1");
    expect(findProductByScan(products, "PRD-2")?.id).toBe("p2");
    expect(findProductByScan(products, "none")).toBeUndefined();
  });
});

describe("SLA งานบริการ", () => {
  it("ชั่วโมงที่เหลือ ติดลบเมื่อเกินกำหนด", () => {
    const now = Date.parse("2026-10-17T00:00:00Z");
    expect(slaRemainingHours("2026-10-17T04:00:00Z", now)).toBe(4);
    expect(slaRemainingHours("2026-10-16T22:00:00Z", now)).toBe(-2);
    expect(slaRemainingHours(undefined, now)).toBeNull();
  });
});
