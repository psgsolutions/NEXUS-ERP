import { describe, expect, it } from "vitest";
import { amountInWords, branchLabel, formatTaxId, thaiDate, toDateStr } from "@/lib/documents/format";
import { quotationLines, totalsRows } from "@/lib/documents/build";
import { documentProfileOf, missingTaxFields } from "@/lib/documents/profile";
import { fixThaiText } from "@/lib/pdf/StandardDocument";

describe("รูปแบบข้อความบนเอกสาร", () => {
  it("วันที่ไทย พ.ศ. และวันที่จาก Timestamp ตามเวลาไทย", () => {
    expect(thaiDate("2026-10-17")).toBe("17 ตุลาคม 2569");
    expect(toDateStr({ seconds: Date.parse("2026-10-16T18:30:00Z") / 1000 })).toBe("2026-10-17");
    expect(thaiDate("")).toBe("-");
  });

  it("จำนวนเงินเป็นตัวอักษร", () => {
    expect(amountInWords(28836.5)).toBe("สองหมื่นแปดพันแปดร้อยสามสิบหกบาทห้าสิบสตางค์");
    expect(amountInWords(5350)).toBe("ห้าพันสามร้อยห้าสิบบาทถ้วน");
    expect(amountInWords(-100)).toBe("ลบหนึ่งร้อยบาทถ้วน");
  });

  it("สาขาและเลขผู้เสียภาษีตามรูปแบบกรมสรรพากร", () => {
    expect(branchLabel("00000")).toBe("สำนักงานใหญ่");
    expect(branchLabel("", "สำนักงานใหญ่")).toBe("สำนักงานใหญ่");
    expect(branchLabel("1", "บางนา")).toBe("สาขาที่ 00001 (บางนา)");
    expect(formatTaxId("0105564000000")).toBe("0-1055-64000-00-0");
  });

  it("แก้สระอำสำหรับ PDF โดยแสดงผลเหมือนเดิม", () => {
    expect(fixThaiText("น้ำ")).toBe("นํ้า");
    expect(fixThaiText("จำนวน")).toBe("จํานวน");
    expect(fixThaiText(5)).toBe(5);
  });
});

describe("ยอดรวมและรายการ", () => {
  it("VAT แยก + ส่วนลดท้ายบิล + หัก ณ ที่จ่าย", () => {
    const rows = totalsRows({ lineTotal: 1000, billDiscount: 100, net: 900, vat: 63, grand: 963, taxType: "EXCLUSIVE", wht: 27, payable: 936 });
    expect(rows.map((r) => r.label)).toEqual(["รวมเป็นเงิน", "ส่วนลดท้ายบิล", "ยอดหลังหักส่วนลด", "ภาษีมูลค่าเพิ่ม 7%", "จำนวนเงินรวมทั้งสิ้น", "หัก ณ ที่จ่าย", "ยอดชำระสุทธิ"]);
    expect(rows.find((r) => r.strong)?.amount).toBe(936);
  });

  it("VAT รวมในราคา แสดงมูลค่าก่อนภาษี", () => {
    const rows = totalsRows({ lineTotal: 1070, billDiscount: 0, net: 1070, vat: 70, grand: 1070, taxType: "INCLUSIVE" });
    expect(rows.find((r) => r.label === "มูลค่าก่อนภาษี")?.amount).toBe(1000);
  });

  it("บรรทัดหัวข้อกลุ่ม และส่วนลดรายบรรทัดแบบเปอร์เซ็นต์", () => {
    const lines = quotationLines([
      { itemType: "GROUP_HEADER", productName: "งานระบบ" },
      { productName: "กล้อง", qty: 2, unitPrice: 1000, discountType: "PERCENT", discountValue: 10 },
    ]);
    expect(lines[0]).toEqual({ heading: true, description: "งานระบบ" });
    expect(lines[1]).toMatchObject({ qty: 2, price: 1000, discount: 200, amount: 1800 });
  });

  it("ข้อมูลบริษัทไม่ครบ = เตือน ไม่เติมค่าปลอม", () => {
    const p = documentProfileOf({ name: "บริษัท ทดสอบ จำกัด" });
    expect(p.taxId).toBe("");
    expect(p.branchCode).toBe("00000");
    expect(missingTaxFields(p)).toEqual(["ที่อยู่", "เลขประจำตัวผู้เสียภาษี 13 หลัก"]);
  });
});
