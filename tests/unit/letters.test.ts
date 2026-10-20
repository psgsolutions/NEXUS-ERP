import { describe, expect, it } from "vitest";
import { buildLetter } from "@/lib/letters";

const ctx = { customerName: "โรงพยาบาลทดสอบ", projectName: "ติดตั้งกล้องวงจรปิด", contractNo: "12/2569", signDate: "2026-10-01", contractValue: 1_070_000, sellerName: "บริษัท พีเอสจี โซลูชั่น จำกัด" };

describe("letters", () => {
  it("site access lists workers and dates", () => {
    const l = buildLetter("SITE_ACCESS", { ...ctx, from: "2026-10-21", to: "2026-10-23", workers: ["นาย ก", "", "นาย ข"], location: "อาคาร 2" });
    expect(l.subject).toContain("ขออนุญาตเข้าพื้นที่");
    expect(l.refs[0]).toContain("สัญญาเลขที่ 12/2569");
    expect(l.attachments).toEqual(["รายชื่อผู้ปฏิบัติงาน จำนวน 2 คน"]);
    expect(l.body).toContain("1. นาย ก");
    expect(l.body.join(" ")).toContain("อาคาร 2");
  });

  it("handover and guarantee return use contract data", () => {
    expect(buildLetter("HANDOVER", { ...ctx, handoverDate: "2026-10-20" }).body[0]).toContain("1,070,000.00 บาท");
    const g = buildLetter("GUARANTEE_RETURN", { ...ctx, warrantyEnd: "2027-10-20", guarantee: { label: "หลักประกันสัญญา", number: "LG-9", issuer: "ธนาคารกสิกรไทย", amount: 53_500 } });
    expect(g.subject).toBe("ขอคืนหลักประกันสัญญา");
    expect(g.body[0]).toContain("เลขที่ LG-9 ของธนาคารกสิกรไทย จำนวนเงิน 53,500.00 บาท");
    expect(buildLetter("HANDOVER", { ...ctx, contractNo: undefined, orderNo: "PO-77" }).refs).toEqual(["ใบสั่งซื้อ/ใบสั่งจ้างเลขที่ PO-77"]);
  });
});
