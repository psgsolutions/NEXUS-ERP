import { describe, expect, it } from "vitest";
import { crc16, normalizePromptPayId, promptPayPayload } from "@/lib/promptpay";

describe("พร้อมเพย์", () => {
  it("CRC-16/CCITT-FALSE ตรงค่ามาตรฐาน", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("แปลงเบอร์มือถือและเลขผู้เสียภาษี", () => {
    expect(normalizePromptPayId("081-234-5678")).toEqual({ type: "PHONE", value: "0066812345678" });
    expect(normalizePromptPayId("1234567890123")).toEqual({ type: "TAXID", value: "1234567890123" });
    expect(normalizePromptPayId("12345")).toBeNull();
  });

  it("payload แบบระบุยอดตรงกับตัวอย่างอ้างอิง", () => {
    const p = promptPayPayload("0000000000", 4.22);
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p).toContain("54044.22");
    expect(p.endsWith("6304E469")).toBe(true);
  });

  it("ไม่ระบุยอด = QR ใช้ซ้ำได้ (01=11) และไม่มีแท็ก 54", () => {
    const p = promptPayPayload("0812345678");
    expect(p.startsWith("000201010211")).toBe(true);
    expect(p).not.toMatch(/530476454/);
  });

  it("รหัสไม่ถูกต้องต้องแจ้งข้อผิดพลาด", () => {
    expect(() => promptPayPayload("abc", 10)).toThrow();
  });
});
