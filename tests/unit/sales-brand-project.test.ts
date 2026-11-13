import { describe, expect, it } from "vitest";
import { salesProfit, salesYears } from "@/lib/management-reports";

const inv = (id: string, date: string, extra: any, items: any[]) => ({ id, invoiceNo: id, issueDate: date, status: "ISSUED", items, subTotal: items.reduce((s, it) => s + it.qty * it.price, 0), ...extra });

describe("ยอดขายและกำไรขั้นต้น รายยี่ห้อ / รายโครงการ", () => {
  const invoices = [
    inv("IV1", "2026-03-10", { projectId: "PJ1", projectName: "โครงการ A" }, [
      { productId: "P1", name: "ZKTeco : L", qty: 2, price: 1000, cost: 600 },
      { productId: "P2", name: "Link สายแลน", qty: 1, price: 500, cost: 700 },
      { name: "ติดตั้ง", itemType: "SERVICE", qty: 1, price: 300, cost: 100 },
    ]),
    inv("IV2", "2025-11-01", {}, [{ productId: "P1", name: "ZKTeco : L", qty: 1, price: 900, cost: 600 }]),
    inv("IV3", "2026-04-01", {}, [{ productId: "P9", name: "ของไม่มียี่ห้อ", qty: 1, price: 100, cost: 50 }]),
    inv("IVX", "2024-01-01", { status: "CANCELLED" }, [{ productId: "P1", qty: 1, price: 1, cost: 1 }]),
  ];
  const notes = [{ id: "CN1", documentNo: "CN1", type: "CN", issueDate: "2026-03-20", amount: 200, invoiceDocId: "IV1", status: "ISSUED" }];
  const brandOf = new Map([["P1", "ZKTeco"], ["P2", "LINK"]]);

  it("รายยี่ห้อ: ยี่ห้อจากทะเบียนสินค้า · งานบริการแยกแถว · ไม่มียี่ห้อ · GP ติดลบนับได้", () => {
    const r = salesProfit(invoices, notes, "2026-01-01", "2026-12-31", "brand", brandOf);
    const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
    expect(by["ZKTeco"].revenue).toBe(2000);
    expect(by["ZKTeco"].profit).toBe(800);
    expect(by["LINK"].profit).toBe(-200);
    expect(by["งานบริการ/ค่าแรง"].profit).toBe(200);
    expect(by["ไม่ระบุยี่ห้อ"].revenue).toBe(100);
    expect(by["ใบลดหนี้ (ลดยอดขาย)"].revenue).toBe(-200);
    expect(r.negative).toBe(2); // LINK และแถวใบลดหนี้
  });

  it("รายโครงการ: ใบลดหนี้ตามโครงการของใบที่อ้างถึง · ไม่มีโครงการรวมเป็นขายทั่วไป", () => {
    const r = salesProfit(invoices, notes, "2026-01-01", "2026-12-31", "project");
    const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
    expect(by["โครงการ A"].revenue).toBe(2600); // 2,800 − ลดหนี้ 200
    expect(by["โครงการ A"].cost).toBe(2000);
    expect(by["โครงการ A"].docs).toBe(2);
    expect(by["ขายทั่วไป (ไม่ผูกโครงการ)"].revenue).toBe(100);
  });

  it("ปีที่มีข้อมูลจริง (ไม่นับใบยกเลิก) ใหม่ → เก่า", () => {
    expect(salesYears(invoices, notes)).toEqual([2026, 2025]);
  });
});
