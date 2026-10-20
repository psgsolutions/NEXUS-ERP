import { describe, expect, it } from "vitest";
import { addMonths, contractReminders, guaranteeAmount, normalizeContract, penaltyAccrued, stampDuty, suggestMethod, warrantyEnd } from "@/lib/gov-contract";

describe("government contract helpers", () => {
  it("procurement method by value incl. VAT", () => {
    expect(suggestMethod("Government", 500_000)).toBe("SPECIFIC");
    expect(suggestMethod("Government", 500_000.01)).toBe("EBIDDING");
    expect(suggestMethod("Private", 9_000_000)).toBe("PRIVATE");
  });

  it("stamp duty: 1 baht per 1,000 or fraction; guarantee 5%", () => {
    expect(stampDuty(1_070_000)).toBe(1070);
    expect(stampDuty(1_070_001)).toBe(1071);
    expect(stampDuty(0)).toBe(0);
    expect(guaranteeAmount(5, 1_070_000)).toBe(53_500);
  });

  it("warranty end and penalty", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-20", 24)).toBe("2028-10-20");
    expect(warrantyEnd({ handoverDate: "2026-10-01", warrantyMonths: 12 })).toBe("2027-10-01");
    const c = normalizeContract({ contractValue: 1_000_000, dueDate: "2026-10-10", penaltyRatePct: 0.1, penaltyMinPerDay: 100 });
    expect(penaltyAccrued(c, "2026-10-20")).toEqual({ daysLate: 10, perDay: 1000, total: 10000 });
    expect(penaltyAccrued({ ...c, handoverDate: "2026-10-12" }, "2026-10-20").daysLate).toBe(2);
    expect(penaltyAccrued({ ...c, penaltyRatePct: 0.001 }, "2026-10-11").perDay).toBe(100); // ขั้นต่ำ
  });

  it("normalizes input and fills defaults", () => {
    const c = normalizeContract({ contractValue: "1070000", dueDate: "bad", guarantees: [{ type: "PERFORMANCE" }, { type: "X" }], stamp: { method: "E_STAMP" } }, { sector: "Government", warrantyMonths: 24 });
    expect(c).toMatchObject({ method: "EBIDDING", contractValue: 1_070_000, warrantyMonths: 24, stamp: { base: 1_070_000, method: "E_STAMP" } });
    expect(c.dueDate).toBeUndefined();
    expect(c.guarantees).toEqual([{ id: "PERFORMANCE-1", type: "PERFORMANCE", form: "BANK_GUARANTEE", percent: 5, amount: 53_500 }]);
  });

  it("reminders: due soon, late buckets, guarantee expiry, return after warranty", () => {
    const base = normalizeContract({ contractValue: 100_000, dueDate: "2026-10-25", penaltyRatePct: 0.1, guarantees: [{ id: "g1", type: "PERFORMANCE", expiryDate: "2026-11-10", amount: 5000 }] });
    expect(contractReminders("PRJ-1", base, "2026-10-20").map((r) => r.kind)).toEqual(["due_soon", "guarantee_expiring"]);
    expect(contractReminders("PRJ-1", base, "2026-11-01").map((r) => r.key)).toContain("late-7");
    expect(contractReminders("PRJ-1", base, "2026-10-28").some((r) => r.kind === "overdue")).toBe(false); // แจ้งเฉพาะวันที่ 1, 7, 30
    const done = { ...base, handoverDate: "2025-10-01", warrantyMonths: 12, guarantees: [{ ...base.guarantees[0], expiryDate: undefined }] };
    expect(contractReminders("PRJ-1", done, "2026-10-20").map((r) => r.kind)).toEqual(["guarantee_return"]);
    expect(contractReminders("PRJ-1", { ...done, guarantees: [{ ...done.guarantees[0], returned: true }] }, "2026-10-20")).toEqual([]);
  });
});
