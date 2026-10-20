import { describe, expect, it } from "vitest";
import { customerSchedule, docProfileSummary, effectiveDocProfile, nextMonthlyDate, normalizeDocProfile, quotationDefaults, showDocDate } from "@/lib/customer-doc-profile";

describe("customer document profile", () => {
  it("government defaults: price incl. VAT, undated billing note/receipt, WHT 1%", () => {
    const p = effectiveDocProfile({ docProfile: { orgType: "GOV" } });
    expect(p).toMatchObject({ priceDisplay: "INCLUSIVE", billingMethod: "BILL_WITH_RECEIPT", whtRate: 1 });
    expect(showDocDate(p, "billingNote")).toBe(false);
    expect(showDocDate(p, "deliveryNote")).toBe(true);
    expect(showDocDate(p, "receipt", { isTaxInvoice: true })).toBe(true); // ม.86/4
    expect(quotationDefaults({ orgType: "GOV" })).toMatchObject({ taxType: "INCLUSIVE", whtRate: 1, note: "ราคาดังกล่าวรวมภาษีมูลค่าเพิ่มแล้ว" });
  });

  it("customer overrides win over org defaults, unknown/legacy customers act as private", () => {
    const p = effectiveDocProfile({ orgType: "GOV", priceDisplay: "EXCLUSIVE", undated: [], whtRate: 0, notes: { quotation: "อ้างอิงใบสั่ง" } });
    expect(p.priceDisplay).toBe("EXCLUSIVE");
    expect(showDocDate(p, "billingNote")).toBe(true);
    expect(p.notes?.quotation).toBe("อ้างอิงใบสั่ง");
    expect(effectiveDocProfile({}).orgType).toBe("PRIVATE");
    expect(effectiveDocProfile(null).priceDisplay).toBe("EXCLUSIVE");
  });

  it("normalizes untrusted input", () => {
    const n = normalizeDocProfile({ orgType: "X", priceDisplay: "BAD", undated: ["receipt", "receipt", "hack"], billingDay: 40, paymentDay: "25", whtRate: 7, creditTermDays: "45", attachments: ["  ใบส่งของ ", "", "ใบส่งของ"], notes: { quotation: " ok ", evil: "x" }, locked: "yes" });
    expect(n).toEqual({ orgType: "PRIVATE", undated: ["receipt"], billingDay: null, paymentDay: 25, creditTermDays: 45, attachments: ["ใบส่งของ"], notes: { quotation: "ok" } });
  });

  it("summary and monthly dates", () => {
    expect(docProfileSummary({ orgType: "GOV", billingDay: 25 })).toEqual(expect.arrayContaining(["ส่วนราชการ / หน่วยงานรัฐ", "รับวางบิลวันที่ 25", "หัก ณ ที่จ่าย 1%"]));
    expect(nextMonthlyDate(25, "2026-10-20")).toBe("2026-10-25");
    expect(nextMonthlyDate(25, "2026-10-26")).toBe("2026-11-25");
    expect(nextMonthlyDate(31, "2026-02-10")).toBe("2026-02-28");
    expect(nextMonthlyDate(5, "2026-12-06")).toBe("2027-01-05");
  });
});

describe("customer billing / payment schedule", () => {
  const customers = [
    { id: "G1", name: "กรมทดสอบ", docProfile: { orgType: "GOV", billingDay: 25, paymentDay: 5 } },
    { id: "P1", name: "บริษัท ก", docProfile: { orgType: "PRIVATE", paymentDay: 30 } },
    { id: "N1", name: "ไม่มีรอบ", docProfile: { orgType: "PRIVATE" } },
  ];
  const invoices = [
    { customerId: "G1", grandTotal: 107000, balance: 107000, dueDate: "2026-11-01" },
    { customerId: "G1", grandTotal: 5000, balance: 0 },
    { customerId: "G1", grandTotal: 999, balance: 999, status: "cancelled" },
    { customerId: "P1", grandTotal: 1000, balance: 1000, dueDate: "2026-12-31" },
    { customerId: "N1", grandTotal: 500, balance: 500 },
  ];
  it("lists upcoming billing and payment days with money at stake", () => {
    const ev = customerSchedule(customers, invoices, "2026-10-20");
    expect(ev.map((e) => [e.customerId, e.kind, e.date, e.daysAway])).toEqual([
      ["G1", "billing", "2026-10-25", 5],
      ["G1", "payment", "2026-11-05", 16],
    ]);
    expect(ev[0]).toMatchObject({ invoiceCount: 1, outstanding: 107000, attachments: expect.arrayContaining(["หนังสือส่งมอบงาน"]) });
    expect(ev[1].dueTotal).toBe(107000);
    // P1 จ่ายวันที่ 30 แต่ใบยังไม่ครบกำหนด -> ไม่นับ
    expect(ev.some((e) => e.customerId === "P1")).toBe(false);
  });
});
