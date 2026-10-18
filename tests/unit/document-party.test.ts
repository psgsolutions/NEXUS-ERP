import { describe, expect, it } from "vitest";
import { addressText, isCorporate, partySnapshot } from "@/lib/documents/party";

describe("document party snapshot", () => {
  it("builds address from split fields (Bangkok uses แขวง/เขต)", () => {
    expect(addressText({ address_detail: "99/1", road: "พระราม 9", subDistrict: "ห้วยขวาง", district: "ห้วยขวาง", province: "กรุงเทพมหานคร", zipCode: "10310" }))
      .toBe("99/1 ถนน พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310");
    expect(addressText({ address_detail: "12", subDistrict: "ในเมือง", district: "เมือง", province: "ขอนแก่น" })).toBe("12 ตำบลในเมือง อำเภอเมือง จังหวัดขอนแก่น");
  });

  it("prefers the longer of plain and composed address", () => {
    expect(addressText({ address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110", province: "กรุงเทพฯ" })).toContain("สุขุมวิท");
  });

  it("classifies PND53 vs PND3 by tax id", () => {
    expect(isCorporate("0105564000000")).toBe(true);
    expect(isCorporate("1101700000000")).toBe(false);
    expect(isCorporate("", "COMPANY")).toBe(true);
    expect(isCorporate("", "TEAM")).toBe(false);
  });

  it("falls back to document values", () => {
    const p = partySnapshot(null, { name: "ร้าน ก", taxId: "1-1017-00000-00-0" });
    expect(p).toEqual({ name: "ร้าน ก", taxId: "1101700000000", branchCode: "", address: "", corporate: false });
  });
});
