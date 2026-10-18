import { describe, expect, it } from "vitest";
import { advanceBillAmounts, advanceRecovery, billingSummary, progressBillAmounts, retentionReleaseAmounts, vatPortionOfPayment } from "@/lib/project-billing";

describe("project milestone billing", () => {
  it("splits a VAT-inclusive milestone into work value, retention, VAT", () => {
    expect(progressBillAmounts(107000, 5)).toEqual({ workValue: 100000, retention: 5000, advanceDeduct: 0, base: 95000, vat: 6650, total: 101650 });
    expect(progressBillAmounts(107000, 0)).toEqual({ workValue: 100000, retention: 0, advanceDeduct: 0, base: 100000, vat: 7000, total: 107000 });
  });

  it("caps retention and handles non-VAT companies", () => {
    expect(progressBillAmounts(107000, 50).retention).toBe(20000); // สูงสุด 20% ของมูลค่างานก่อน VAT
    expect(progressBillAmounts(100000, 10, false)).toEqual({ workValue: 100000, retention: 10000, advanceDeduct: 0, base: 90000, vat: 0, total: 90000 });
  });

  it("retention release bills the held amount with VAT", () => {
    expect(retentionReleaseAmounts(5000)).toEqual({ workValue: 0, retention: -5000, advanceDeduct: 0, base: 5000, vat: 350, total: 5350 });
  });

  it("VAT realized on partial payments sums exactly to the bill VAT", () => {
    const inv = { grandTotal: 101650, vatAmount: 6650, vatRealized: 0 };
    const p1 = vatPortionOfPayment(inv, 50000, 51650);
    const p2 = vatPortionOfPayment({ ...inv, vatRealized: p1.vat }, 51650, 0);
    expect(p1.vat + p2.vat).toBeCloseTo(6650, 2);
    expect(p1.base + p1.vat).toBe(50000);
  });

  it("summarises billed, unbilled and retention", () => {
    const s = billingSummary(
      [{ id: "m1", amount: 107000 }, { id: "m2", amount: 53500 }],
      [
        { invoiceNo: "PB1", docKind: "progress", milestoneId: "m1", retentionAmount: 5000, workValue: 100000, grandTotal: 101650, paidAmount: 101650, status: "issued" },
        { invoiceNo: "PB2", docKind: "retention", retentionAmount: -5000, workValue: 0, grandTotal: 5350, paidAmount: 0, status: "issued" },
        { invoiceNo: "PB3", docKind: "progress", milestoneId: "m2", retentionAmount: 2500, workValue: 50000, grandTotal: 50825, paidAmount: 0, status: "cancelled" },
      ],
    );
    expect(s.unbilledAmount).toBe(53500);
    expect(s.retentionHeld).toBe(5000);
    expect(s.retentionOutstanding).toBe(0);
    expect(s.received).toBe(101650);
  });
});

describe("advance payment (เงินล่วงหน้า)", () => {
  it("advance bill = contract before VAT × %", () => {
    expect(advanceBillAmounts(160500, 15)).toEqual({ workValue: 0, retention: 0, advanceDeduct: 0, base: 22500, vat: 1575, total: 24075 });
  });

  it("recovers proportionally and the last milestone takes the rest", () => {
    expect(advanceRecovery(100000, 15, 22500, false)).toBe(15000);
    expect(advanceRecovery(50000, 15, 7500.01, true)).toBe(7500.01);
    expect(advanceRecovery(50000, 15, 0, true)).toBe(0);
  });

  it("milestone bill deducts advance before VAT", () => {
    expect(progressBillAmounts(107000, 5, true, 15000)).toEqual({ workValue: 100000, retention: 5000, advanceDeduct: 15000, base: 80000, vat: 5600, total: 85600 });
  });

  it("summary tracks advance outstanding", () => {
    const s = billingSummary([{ id: "m1", amount: 107000 }], [
      { invoiceNo: "A", docKind: "advance", advanceAmount: 22500, advancePercent: 15, retentionAmount: 0, workValue: 0, grandTotal: 24075, paidAmount: 24075, status: "issued" },
      { invoiceNo: "B", docKind: "progress", milestoneId: "m1", advanceAmount: 15000, retentionAmount: 5000, workValue: 100000, grandTotal: 85600, paidAmount: 0, status: "issued" },
    ]);
    expect(s.advanceOutstanding).toBe(7500);
    expect(s.advancePercent).toBe(15);
  });
});
