import { describe, expect, it } from "vitest";
import { findPackProduct, normalizePackOf, packProductName, planRepack, repackCosts, repackShares } from "@/lib/repack";

describe("แบ่งบรรจุ: จำนวนห่อและเศษ", () => {
  it("สกรู 3 กล่อง × 1,000 ตัว ถุงละ 50 = 60 ถุงพอดี", () => {
    expect(planRepack({ sourceQty: 3, piecesPerSource: 1000, packSize: 50 })).toMatchObject({ totalPieces: 3000, maxPacks: 60, packs: 60, remainder: 0, errors: [] });
  });
  it("ถุงละ 30: ได้ 33 ถุง เหลือ 10 ตัว · ตัดเศษได้เมื่อเหลือไม่ถึง 1 ถุง", () => {
    const p = planRepack({ sourceQty: 1, piecesPerSource: 1000, packSize: 30 });
    expect(p).toMatchObject({ maxPacks: 33, packs: 33, packedPieces: 990, remainder: 10, remainderMode: "waste", errors: [] });
  });
  it("บรรจุไม่เต็ม: ที่เหลือต้องเก็บเป็นสินค้าแยกชิ้น (ไม่ทิ้งของดี)", () => {
    expect(planRepack({ sourceQty: 1, piecesPerSource: 1000, packSize: 50, packs: 10 }).errors[0]).toMatch(/เหลือ 500 ชิ้น/);
    expect(planRepack({ sourceQty: 1, piecesPerSource: 1000, packSize: 50, packs: 10, remainderMode: "loose" })).toMatchObject({ packs: 10, remainder: 500, errors: [] });
  });
  it("ตรวจค่าที่กรอก", () => {
    expect(planRepack({ sourceQty: 0, piecesPerSource: 1000, packSize: 50 }).errors).toContain("ระบุจำนวนที่แกะ");
    expect(planRepack({ sourceQty: 1, piecesPerSource: 1000, packSize: 50, packs: 21 }).errors).toContain("บรรจุได้ไม่เกิน 20 ห่อ");
    expect(planRepack({ sourceQty: 1, piecesPerSource: 10, packSize: 50 }).errors[0]).toMatch(/มากกว่าจำนวนชิ้นทั้งหมด/);
  });
});

describe("แบ่งบรรจุ: ต้นทุน (มูลค่าคลังรวมเท่าเดิม)", () => {
  it("เศษสูญเสีย: ต้นทุนทั้งหมดอยู่ในห่อ", () => {
    const p = planRepack({ sourceQty: 1, piecesPerSource: 1000, packSize: 30 });
    expect(repackShares(p)).toEqual({ packShare: 1, looseShare: 0 });
    expect(repackCosts(500, p).packUnitCost).toBeCloseTo(15.1515, 4);
  });
  it("เก็บเศษแยกชิ้น: แบ่งตามจำนวนชิ้น ต้นทุนต่อชิ้นเท่ากัน", () => {
    const p = planRepack({ sourceQty: 2, piecesPerSource: 1000, packSize: 30, remainderMode: "loose" });
    expect(p).toMatchObject({ packs: 66, remainder: 20 });
    const c = repackCosts(1000, p);
    expect(c.packUnitCost).toBe(15);
    expect(c.looseUnitCost).toBe(0.5);
    expect(c.packUnitCost * 66 + c.looseUnitCost * 20).toBeCloseTo(1000, 6);
  });
});

describe("สินค้าห่อเล็ก", () => {
  it("ชื่ออัตโนมัติ · หาห่อเดิมของสินค้าต้นทาง/ขนาดเดียวกัน · ตรวจข้อมูลผูก", () => {
    expect(packProductName("สกรูเกลียวปล่อย 6x1 นิ้ว (กล่อง 1000 ตัว)", 50, "ตัว", "ถุง")).toBe("สกรูเกลียวปล่อย 6x1 นิ้ว (ถุงละ 50 ตัว)");
    expect(packProductName("สกรูเกลียวปล่อย 6x1 นิ้ว", 1, "ตัว", "ถุง")).toBe("สกรูเกลียวปล่อย 6x1 นิ้ว (แยกตัว)");
    const ps = [{ id: "a", packOf: { productId: "BOX", pieces: 50 } }, { id: "b", packOf: { productId: "BOX", pieces: 100 } }, { id: "c", packOf: { productId: "BOX", pieces: 50 }, isDeleted: true }];
    expect(findPackProduct(ps, "BOX", 100)?.id).toBe("b");
    expect(findPackProduct(ps, "BOX", 25)).toBeUndefined();
    expect(normalizePackOf({ productId: "BOX", pieces: "50", pieceUnit: "ตัว" })).toEqual({ productId: "BOX", pieces: 50, pieceUnit: "ตัว" });
    expect(normalizePackOf({ productId: "a/b", pieces: 5 })).toBeNull();
  });
});
