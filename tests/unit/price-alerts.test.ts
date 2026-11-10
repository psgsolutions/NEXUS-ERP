import { describe, expect, it } from "vitest";
import { changePct, gpPercent, isSignificant, keepMarginPrice, PRICE_ALERT_THRESHOLD_PCT } from "@/lib/price-alerts";

describe("price change alerts", () => {
  it("threshold is 5% both up and down", () => {
    expect(PRICE_ALERT_THRESHOLD_PCT).toBe(5);
    expect(isSignificant(100, 105)).toBe(true);
    expect(isSignificant(100, 104.99)).toBe(false);
    expect(isSignificant(100, 95)).toBe(true);
    expect(isSignificant(100, 96)).toBe(false);
  });
  it("no previous cost (new product) is never an alert", () => {
    expect(changePct(0, 120)).toBeNull();
    expect(isSignificant(0, 120)).toBe(false);
  });
  it("GP uses the new cost only for the changed product and respects the bill discount", () => {
    const lines = [
      { productId: "A", qty: 2, cost: 100, revenue: 300 },
      { productId: "B", qty: 1, cost: 50, revenue: 100 },
      { productId: "C", qty: 1, cost: 10, revenue: 20, skip: true },
    ];
    expect(gpPercent(lines)).toBe(37.5); // (400 - 250) / 400
    expect(gpPercent(lines, { productId: "A", cost: 120 })).toBe(27.5); // (400 - 290) / 400
    expect(gpPercent(lines, undefined, 100)).toBe(16.67); // (300 - 250) / 300
    expect(gpPercent([])).toBeNull();
  });
  it("suggested selling price keeps the markup and rounds up to a whole baht", () => {
    expect(keepMarginPrice(150, 100, 120)).toBe(180);
    expect(keepMarginPrice(150, 100, 113)).toBe(170); // 169.5 → 170
    expect(keepMarginPrice(150, 0, 120)).toBe(150);
  });
});
