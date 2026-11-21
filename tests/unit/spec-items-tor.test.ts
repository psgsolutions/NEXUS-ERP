import { describe, expect, it } from "vitest";
import { hasDatasheet, normalizeSpecItems, productSpecText } from "@/lib/spec-items";
import { generateSection } from "@/lib/project-templates";
import { defaultProfile, docPlan, normalizeProfile } from "@/lib/project-plan";
import { normalizeContract } from "@/lib/gov-contract";

const ctx = (x: any = {}) => ({ projectName: "ระบบกล้อง", customerName: "โรงพยาบาล ก", sector: "Government" as const, typeCode: 4 as const, stage: "CONTRACTED" as const,
  startDate: "2027-01-04", endDate: "2027-04-03", durationDays: 90, budgetAmount: 1_000_000, referencePrice: 0, budgetSource: "งบประมาณประจำปี", fiscalYear: 2570, warrantyMonths: 24, lines: [], timeline: [], ...x });

describe("คุณลักษณะเฉพาะเป็นข้อ (datasheet/AI)", () => {
  it("ตัดเลขข้อ/สัญลักษณ์ ข้อว่าง ข้อซ้ำ · รับทั้ง array และข้อความหลายบรรทัด", () => {
    expect(normalizeSpecItems(["1. ความละเอียดไม่น้อยกว่า 2 ล้านพิกเซล", "- รองรับ PoE", "", "รองรับ PoE", "2.1) มาตรฐาน IP67"])).toEqual(["ความละเอียดไม่น้อยกว่า 2 ล้านพิกเซล", "รองรับ PoE", "มาตรฐาน IP67"]);
    expect(normalizeSpecItems("ก\n• ข\n")).toEqual(["ก", "ข"]);
  });
  it("ร่าง TOR ใช้ข้อจาก specItems ก่อน technicalSpecs", () => {
    expect(productSpecText({ specItems: ["ก", "ข"], technicalSpecs: "เดิม" })).toBe("ก\nข");
    expect(productSpecText({ technicalSpecs: "เดิม" })).toBe("เดิม");
  });
  it("มี datasheet: ลิงก์ · แนบ PDF · AI อ่านแล้ว", () => {
    expect(hasDatasheet({ datasheetUrl: "https://x" })).toBe(true);
    expect(hasDatasheet({ hasDatasheet: true })).toBe(true);
    expect(hasDatasheet({ specSource: "datasheet" })).toBe(true);
    expect(hasDatasheet({ specSource: "manual" })).toBe(false);
  });
});

describe("ร่าง TOR ดึงข้อมูลจากแผนงาน", () => {
  const p = { ...defaultProfile("Government"), systems: ["cctv"] as any, sites: [{ name: "อาคาร A", env: "indoor" as const, points: 30 }, { name: "ลานจอด", env: "outdoor" as const, points: 10 }],
    legacySystem: "DSS Pro", controlRoom: "new" as const, civilWork: ["poles"], training: { sessions: 2, hoursEach: 6 }, onsiteAdmin: { count: 1, hours: "08:30-16:30" }, penaltyRatePct: 0.15 };
  it("ขอบเขตงาน: ระบบ พื้นที่/จุด ระบบเดิม ห้องควบคุม โยธา ไฟฟ้า อบรม Admin PM", () => {
    const s = generateSection("scope", ctx({ plan: docPlan(p) }));
    for (const t of ["กล้องวงจรปิด", "อาคาร A 30 จุด", "ลานจอด 10 จุด (นอกอาคาร) รวม 40 จุด", "ระบบเดิม (DSS Pro)", "ห้องควบคุม (สร้างใหม่)", "ตั้งเสา", "วิศวกรไฟฟ้า", "จำนวน 2 ครั้ง ครั้งละไม่น้อยกว่า 6 ชั่วโมง", "Admin) จำนวน 1 คน เวลาปฏิบัติงาน 08:30-16:30", "ทุก 6 เดือน ตลอดระยะเวลารับประกัน 24 เดือน"]) expect(s).toContain(t);
  });
  it("มี SLA ในเอกสาร → ไม่ซ้ำข้อ PM ในขอบเขตงาน", () => {
    const s = generateSection("scope", ctx({ plan: docPlan({ ...p, procurement: "rent" }) }));
    expect(s).not.toContain("ทุก 6 เดือน ตลอดระยะเวลารับประกัน");
  });
  it("ค่าปรับ: ใช้อัตราจากแผน · ไม่กำหนด = มาตรฐาน", () => {
    expect(generateSection("penalty", ctx({ plan: docPlan(p) }))).toContain("ร้อยละ 0.15");
    expect(generateSection("penalty", ctx({ plan: docPlan({ ...p, penaltyRatePct: 0 }) }))).toContain("ร้อยละ 0.10");
    expect(normalizeContract({}, { penaltyRatePct: 0.15 }).penaltyRatePct).toBe(0.15);
    expect(normalizeContract({ penaltyRatePct: 0.2 }, { penaltyRatePct: 0.15 }).penaltyRatePct).toBe(0.2);
  });
  it("ประเภทลูกค้า + TOR ที่เกี่ยวข้อง บันทึก/อ่านกลับได้", () => {
    const n = normalizeProfile({ clientKind: "hospital", relatedTors: [{ title: "TOR เดิม 2566", ref: "EGP-123" }, { title: "", ref: "" }], penaltyRatePct: 0.2 });
    expect(n.clientKind).toBe("hospital");
    expect(n.relatedTors).toEqual([{ title: "TOR เดิม 2566", ref: "EGP-123" }]);
    expect(normalizeProfile({ clientKind: "x" }).clientKind).toBe("");
  });
});
