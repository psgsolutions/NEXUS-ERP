import { describe, expect, it } from "vitest";
import { markupFor, normalizePricing, priceSuggestions } from "@/lib/price-bases";

// ตัวอย่างจากเอกสาร: Lot A 3 × 1,000 · Lot B 5 × 1,200 · ขาย 5 = A3 + B2 = 5,400 · markup 25%
const inp = { fifoCost: 5400, pickedUnitCosts: [1000, 1200], newestLotCost: 1200, oldestLotCost: 1000, lastPurchaseCost: 1200, listPrice: 1450, lastSoldPrice: 1380, qty: 5 };
const by = (k: string) => priceSuggestions(inp, 25, 20).find((s) => s.key === k)!;

describe("price bases (document example)", () => {
  it("average of picked lots: 1,080 → 1,350, GP 20%", () => { expect(by("lotsAvg")).toMatchObject({ base: 1080, price: 1350, gpPct: 20 }); });
  it("new lot price: 1,200 → 1,500, GP 28%", () => { expect(by("lotsNew")).toMatchObject({ base: 1200, price: 1500, gpPct: 28 }); });
  it("old lot price: 1,000 → 1,250, GP 13.6%", () => { expect(by("lotsOld")).toMatchObject({ price: 1250, gpPct: 13.6 }); });
  it("max of picked lots: 1,500", () => { expect(by("lotsMax").price).toBe(1500); });
  it("list price and last sold price are used as they are", () => {
    expect(by("list")).toMatchObject({ price: 1450, gpPct: 25.52 });
    expect(by("lastSold").price).toBe(1380);
  });
  it("target GP 20%: cost ÷ 0.8 = 1,350", () => { expect(by("targetGp").price).toBe(1350); });
  it("no stock: lot bases unavailable, last purchase still works", () => {
    const s = priceSuggestions({ ...inp, fifoCost: null, pickedUnitCosts: [], newestLotCost: null, oldestLotCost: null }, 25, 20);
    expect(s.find((x) => x.key === "lotsAvg")!.available).toBe(false);
    expect(s.find((x) => x.key === "lastPurchase")!.price).toBe(1500);
  });
});

describe("markup rules", () => {
  const s = normalizePricing({ defaultMarkupPct: 25, rules: [{ type: "category", key: "NW", markupPct: 18 }, { type: "brand", key: "Ruckus", markupPct: 12 }, { type: "brand", key: "", markupPct: 5 }] });
  it("brand rule beats category beats default; blank rules dropped", () => {
    expect(s.rules).toHaveLength(2);
    expect(markupFor({ brand: "ruckus", category: "NW" }, s).pct).toBe(12);
    expect(markupFor({ brand: "Link", category: "NW" }, s)).toMatchObject({ pct: 18, source: "หมวด NW" });
    expect(markupFor({ brand: "LG", category: "DP" }, s).pct).toBe(25);
  });
  it("defaults when nothing is set", () => {
    expect(normalizePricing(undefined)).toMatchObject({ defaultMarkupPct: 25, targetGpPct: 20, defaultBase: "lotsAvg" });
  });
});
