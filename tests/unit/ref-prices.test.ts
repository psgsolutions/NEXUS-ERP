import { describe, expect, it } from "vitest";
import { bomUnitCost, isServiceCategory, matchCandidates, parseRefRows, refCostPerBase, sameUnit } from "@/lib/ref-prices";

const sheet = [
  ["รหัส", "รายการ (ไทย)", "Description (EN)", "หมวด", "หน่วย", "ต้นทุน/หน่วย", "ที่มาของราคา", "สถานะราคา (ว่าง=ไฟล์บริษัท, WEB=อินเทอร์เน็ต, Y=ประมาณการ)"],
  ["UTP-CAT6", "สาย UTP CAT6", "UTP CAT6 cable", "สาย LAN", "ม.", 12.46, "ไฟล์ต้นทุนเดิม", ""],
  ["BOX-2x4", "บล็อกลอย 2x4 นิ้ว", "Surface box 2x4\"", "สาย LAN", "ตัว", 13, "HomePro", "WEB"],
  ["LAB-UTP", "ค่าแรงเดินสาย UTP + เข้าหัว", "Labour", "ค่าแรง", "จุด", 800, "", ""],
  ["FLEXCLIP-1/2\"", "กิ๊ปจับท่อ Flex 1/2\"", "Flex clip", "ท่อและอุปกรณ์", "ตัว", 1.5, "ประมาณการ", "y"],
  ["UTP-CAT6", "ซ้ำ", "", "", "", 1, "", ""],
  ["", "", "", "", "", "", "", ""],
];

describe("ราคากลาง (BOM)", () => {
  it("อ่านชีต: ข้ามแถวว่าง/รหัสซ้ำ · สถานะ WEB/Y", () => {
    const r = parseRefRows(sheet);
    expect(r.map((x) => x.code)).toEqual(["UTP-CAT6", "BOX-2x4", "LAB-UTP", "FLEXCLIP-1/2\""]);
    expect(r[1].status).toBe("WEB");
    expect(r[3].status).toBe("Y");
    expect(isServiceCategory(r[2].category)).toBe(true);
    expect(isServiceCategory(r[0].category)).toBe(false);
  });
  it("จับคู่: ผูกรหัสแล้ว = 100% · ชื่อใกล้เคียง + หน่วยเดียวกัน · ค่าแรงไม่จับคู่สินค้าคลัง", () => {
    const [utp, box, lab] = parseRefRows(sheet);
    const products = [
      { id: "P1", sku: "PW-X4-0039", name: "บล็อกลอย 2x4 : Zeberg", unit: "ตัว" },
      { id: "P2", sku: "CB-UTP", name: "สาย UTP CAT6 Link 305 ม.", unit: "กล่อง", bomCode: "UTP-CAT6" },
      { id: "P3", sku: "X", name: "ค่าแรงเดินสาย UTP", unit: "จุด", itemType: "SERVICE" },
    ];
    expect(matchCandidates(utp, products)[0]).toMatchObject({ productId: "P2", score: 1 });
    expect(matchCandidates(box, products)[0].productId).toBe("P1");
    expect(matchCandidates(lab, products)[0].productId).toBe("P3");
  });
  it("หน่วย: ม. = เมตร · ชิ้น = ตัว · ราคากลางต่อหน่วยหลัก (12.46/ม. × 305 ม./กล่อง)", () => {
    expect(sameUnit("ม.", "เมตร")).toBe(true);
    expect(sameUnit("ชิ้น", "ตัว")).toBe(true);
    expect(sameUnit("ม.", "กล่อง")).toBe(false);
    expect(refCostPerBase(12.46, 305)).toBe(3800.3);
  });
  it("ต้นทุนคิด BOM: ราคากลางก่อน ไม่มี → ต้นทุนเฉลี่ย", () => {
    expect(bomUnitCost({ refCost: 13, refCostStatus: "WEB", pricing: { costWAC: 15 } })).toEqual({ cost: 13, basis: "ref", status: "WEB" });
    expect(bomUnitCost({ pricing: { costWAC: 15 } })).toEqual({ cost: 15, basis: "wac" });
    expect(bomUnitCost({})).toEqual({ cost: 0, basis: "none" });
  });
});
