import { describe, expect, it } from "vitest";
import { binKey, listLocations, locationsForCompany, ownerOfBin, type WarehouseDoc } from "@/lib/warehouse-location";

const wh: WarehouseDoc = {
  id: "group:WH-01", code: "WH-01", ownerCompanyId: "A",
  zones: [
    { code: "A", racks: [
      { code: "R01", levels: 2, bins: 3, owner: "B", binOwners: { "L2": "A", "L1-B03": "C" } },
      { code: "R02", levels: 1, bins: 1 },
    ] },
    { code: "B", owner: "C", racks: [{ code: "R01", levels: 1, bins: 2 }] },
  ],
};

describe("เจ้าของช่องในคลังที่ใช้ร่วมกัน", () => {
  it("คีย์ช่อง: หลายช่อง = L2-B03, ช่องเดียว = L2", () => {
    expect(binKey(2, 3, 3)).toBe("L2-B03");
    expect(binKey(2, 1, 1)).toBe("L2");
  });

  it("ลำดับ: ช่อง → ชั้น → ชั้นวาง → โซน → คลัง", () => {
    const [za, zb] = wh.zones!;
    expect(ownerOfBin(wh, za, za.racks[0], 1, 3)).toBe("C");   // ระบุรายช่อง
    expect(ownerOfBin(wh, za, za.racks[0], 2, 1)).toBe("A");   // ระบุทั้งชั้น
    expect(ownerOfBin(wh, za, za.racks[0], 1, 1)).toBe("B");   // ตามชั้นวาง
    expect(ownerOfBin(wh, zb, zb.racks[0], 1, 2)).toBe("C");   // ตามโซน
    expect(ownerOfBin(wh, za, za.racks[1], 1, 1)).toBe("A");   // ตามคลัง
  });

  it("รายการตำแหน่งมีเจ้าของ และพื้นที่รับสินค้าใช้ร่วมกัน", () => {
    const locs = listLocations([wh]);
    expect(locs.find((l) => l.isReceiving)?.owner).toBe("");
    expect(locs.find((l) => l.code === "WH-01-A-R01-L1-B03")?.owner).toBe("C");
    const mineB = locationsForCompany(locs, "B").map((l) => l.code);
    expect(mineB).toEqual(["WH-01-RECV", "WH-01-A-R01-L1-B01", "WH-01-A-R01-L1-B02"]);
  });

  it("คลังรุ่นเก่าของบริษัทเดียว: ทุกช่องเป็นของบริษัทนั้น", () => {
    const legacy: WarehouseDoc = { id: "C1_WH-01", code: "WH-01", companyId: "C1", zones: [{ code: "A", racks: [{ code: "R01", levels: 1, bins: 2 }] }] };
    expect(locationsForCompany(listLocations([legacy]), "C1")).toHaveLength(3);
    expect(locationsForCompany(listLocations([legacy]), "C2")).toHaveLength(1);
  });
});
