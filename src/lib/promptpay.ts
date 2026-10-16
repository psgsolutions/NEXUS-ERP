/**
 * สร้างข้อความ QR พร้อมเพย์ (มาตรฐาน EMVCo / Thai QR Payment) พร้อมยอดเงิน
 * รหัสพร้อมเพย์: เบอร์มือถือ 10 หลัก (08xxxxxxxx) หรือเลขประจำตัวผู้เสียภาษี/บัตรประชาชน 13 หลัก
 */
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ตามที่ EMVCo กำหนด */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function normalizePromptPayId(raw: string): { type: "PHONE" | "TAXID"; value: string } | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return { type: "PHONE", value: `0066${d.slice(1)}` };
  if (d.length === 13) return { type: "TAXID", value: d };
  return null;
}

/** payload สำหรับสร้าง QR (amount > 0 = QR แบบระบุยอด ใช้ได้ครั้งเดียวต่อบิล) */
export function promptPayPayload(id: string, amount?: number): string {
  const target = normalizePromptPayId(id);
  if (!target) throw new Error("รหัสพร้อมเพย์ไม่ถูกต้อง (เบอร์มือถือ 10 หลัก หรือเลขประจำตัวผู้เสียภาษี 13 หลัก)");
  const merchant = tlv("00", "A000000677010111") + tlv(target.type === "PHONE" ? "01" : "02", target.value);
  const hasAmount = typeof amount === "number" && amount > 0;
  const body = [
    tlv("00", "01"),
    tlv("01", hasAmount ? "12" : "11"),
    tlv("29", merchant),
    tlv("58", "TH"),
    tlv("53", "764"),
    ...(hasAmount ? [tlv("54", amount!.toFixed(2))] : []),
  ].join("") + "6304";
  return body + crc16(body);
}
