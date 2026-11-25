import { describe, expect, it } from "vitest";
import { canonTokens, findDuplicateCandidates, nameMatch, normalizeSynonyms } from "@/lib/product-match";
import { markProductDuplicates } from "@/lib/import/product-dups";

const P = [
  { id: "lan", sku: "PRD-001", name: "สาย LAN CAT6 305 ม.", category: "สาย" },
  { id: "lan5", sku: "PRD-002", name: "สาย LAN CAT5e 305 ม.", category: "สาย" },
  { id: "plug", sku: "PRD-003", name: "หัว RJ45 ตัวผู้ CAT6", category: "อุปกรณ์" },
  { id: "fo12", sku: "PRD-004", name: "สายไฟเบอร์ SM 12 core", category: "สาย" },
  { id: "bag50", sku: "PRD-005", name: "สกรู 6x1 นิ้ว ถุง 50 ตัว", category: "น็อต/สกรู" },
  { id: "cam", sku: "PRD-006", name: "กล้องวงจรปิด Dome 2MP", category: "CCTV", brand: "Dahua", model: "HDBW1239", partNumber: "DH-IPC-HDBW1239E1" },
  { id: "thw", sku: "PRD-007", name: "สายไฟ THW 2.5 ตร.มม.", category: "ไฟฟ้า" },
];

describe("แปลงชื่อเป็นคำกลาง", () => {
  it("สเปกเขียนต่างกันเป็นรูปเดียวกัน · คำพ้องไทย/อังกฤษ", () => {
    expect(canonTokens("UTP Cat 6 Cable Box 305m")).toEqual(expect.arrayContaining(["lan", "cat6", "cable", "box", "305m"]));
    expect(canonTokens("สาย LAN CAT-6 305 เมตร")).toEqual(expect.arrayContaining(["cable", "lan", "cat6", "305m"]));
    expect(canonTokens("FO 12C")).toEqual(expect.arrayContaining(["fiber", "12core"]));
    expect(canonTokens("หัว RJ45 ตัวผู้")).toEqual(["rj45", "plug"]);
    expect(canonTokens("สายไฟ THW 2.5 sq.mm")).toEqual(expect.arrayContaining(["wire", "thw", "2.5sqmm"]));
    expect(canonTokens('ท่อ EMT 1/2"')).toEqual(expect.arrayContaining(["conduit", "emt", "1/2in"]));
  });
});

describe("เรียกต่างกันแต่เป็นตัวเดียวกัน", () => {
  it("ไทย/อังกฤษ สลับคำ เขียนสเปกต่างกัน", () => {
    expect(nameMatch("UTP Cat 6 Cable Box 305m", "สาย LAN CAT6 305 ม.").score).toBeGreaterThan(0.8);
    expect(nameMatch("RJ45 Plug Cat 6", "หัว RJ45 ตัวผู้ CAT6").score).toBe(1);
    expect(nameMatch("Fiber optic cable SM 12C", "สายไฟเบอร์ SM 12 core").score).toBeGreaterThan(0.8);
  });
  it("สเปกต่างกัน = คนละตัว (CAT6/CAT5e · 12/24 core · ถุง 50/100 ตัว · 2.5/4 ตร.มม.)", () => {
    expect(nameMatch("สาย LAN CAT6 305 ม.", "สาย LAN CAT5e 305 ม.").conflict).toBe("CAT6 ≠ CAT5e");
    expect(nameMatch("สายไฟเบอร์ SM 24 core", "สายไฟเบอร์ SM 12 core").conflict).toBeTruthy();
    expect(nameMatch("สกรู 6x1 นิ้ว ถุง 100 ตัว", "สกรู 6x1 นิ้ว ถุง 50 ตัว").conflict).toBe("100pcs ≠ 50pcs");
    expect(nameMatch("สายไฟ THW 4 ตร.มม.", "สายไฟ THW 2.5 ตร.มม.").conflict).toBeTruthy();
  });
});

describe("หาสินค้าเดิมที่อาจซ้ำ", () => {
  it("ชื่ออังกฤษเจอสินค้าไทยตัวเดียว ไม่ปน CAT5e", () => {
    const r = findDuplicateCandidates({ name: "UTP Cat 6 Cable 305m", category: "สาย" }, P);
    expect(r.map((x) => x.id)).toEqual(["lan"]);
    expect(r[0].reason).toMatch(/ชื่อ/);
  });
  it("รหัสที่ระบุตัวสินค้ามาก่อน: Part number / ยี่ห้อ+รุ่น / SKU", () => {
    expect(findDuplicateCandidates({ name: "กล้อง IP โดม", partNumber: "DH-IPC-HDBW1239E1" }, P)[0]).toMatchObject({ id: "cam", exact: true, reason: "Part number ตรงกัน" });
    expect(findDuplicateCandidates({ brand: "dahua", model: "hdbw1239" }, P)[0]).toMatchObject({ id: "cam", reason: "ยี่ห้อและรุ่นเดียวกัน" });
    expect(findDuplicateCandidates({ sku: "prd-005" }, P)[0]).toMatchObject({ id: "bag50", reason: "รหัสสินค้าตรงกัน" });
  });
  it("ข้ามหมวดต้องคล้ายมากกว่า · ไม่เทียบกับตัวเอง/รายการที่ลบ", () => {
    expect(findDuplicateCandidates({ name: "RJ45 Plug Cat6", category: "สาย" }, P)[0]).toMatchObject({ id: "plug", sameCategory: false });
    expect(findDuplicateCandidates({ name: "หัว RJ45 ตัวผู้ CAT6" }, P, { excludeId: "plug" })).toEqual([]);
    expect(findDuplicateCandidates({ name: "สาย LAN CAT6 305 ม." }, [{ ...P[0], isDeleted: true }])).toEqual([]);
  });
  it("คำพ้องของบริษัทเอง", () => {
    const ww = [{ id: "ww", name: "รางวายเวย์ 4x4", category: "ราง" }];
    expect(findDuplicateCandidates({ name: "ไวร์เวย์ 4x4", category: "ราง" }, ww)).toEqual([]);
    const syn = normalizeSynonyms(["wireway, รางวายเวย์, ไวร์เวย์", ["x"]]);
    expect(syn).toEqual([["wireway", "รางวายเวย์", "ไวร์เวย์"]]);
    expect(findDuplicateCandidates({ name: "ไวร์เวย์ 4x4", category: "ราง" }, ww, { synonyms: syn })[0]?.id).toBe("ww");
  });
});

describe("หน้านำเข้า: แถวที่อาจซ้ำกับสินค้าเดิม", () => {
  it("ติดคำเตือน + รายการสินค้าเดิม · แถวแก้ไขของเดิม/แถวไม่ผ่านรูปแบบไม่ตรวจ", () => {
    const rows: any[] = [
      { rowNo: 2, values: { name: "UTP Cat 6 Cable 305m", category: "สาย" }, errors: [], status: "ready" },
      { rowNo: 3, values: { name: "เบรกเกอร์ 32A", category: "ไฟฟ้า" }, errors: [], status: "ready" },
      { rowNo: 4, values: { _id: "lan", name: "UTP Cat 6 Cable 305m" }, errors: [], status: "ready" },
      { rowNo: 5, values: { name: "UTP Cat 6 Cable 305m" }, errors: ["x"], status: "invalid" },
    ];
    markProductDuplicates(rows, P);
    expect(rows[0].dupOf.map((c: any) => c.id)).toEqual(["lan"]);
    expect(rows[0].fixes[0]).toMatchObject({ key: "name", from: "dup:product:lan" });
    expect(rows[0].fixes[0].message).toMatch(/PRD-001 สาย LAN CAT6 305 ม\./);
    expect(rows.slice(1).map((r) => r.dupOf)).toEqual([undefined, undefined, undefined]);
  });
});
