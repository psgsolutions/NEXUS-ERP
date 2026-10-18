import { describe, expect, it } from "vitest";
import { billingSummary, progressBillAmounts, retentionReleaseAmounts, vatPortionOfPayment } from "@/lib/project-billing";

describe("project milestone billing", () => {
  it("splits a VAT-inclusive milestone into work value, retention, VAT", () => {
    expect(progressBillAmounts(107000, 5)).toEqual({ workValue: 100000, retention: 5000, base: 95000, vat: 6650, total: 101650 });
    expect(progressBillAmounts(107000, 0)).toEqual({ workValue: 100000, retention: 0, base: 100000, vat: 7000, total: 107000 });
  });

  it("caps retention and handles non-VAT companies", () => {
    expect(progressBillAmounts(107000, 50).retention).toBe(20000); // สูงสุด 20% ของมูลค่างานก่อน VAT
    expect(progressBillAmounts(100000, 10, false)).toEqual({ workValue: 100000, retention: 10000, base: 90000, vat: 0, total: 90000 });
  });

  it("retention release bills the held amount with VAT", () => {
    expect(retentionReleaseAmounts(5000)).toEqual({ workValue: 0, retention: -5000, base: 5000, vat: 350, total: 5350 });
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
