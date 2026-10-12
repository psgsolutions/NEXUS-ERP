/** ใบลดหนี้ / ใบเพิ่มหนี้ (ประมวลรัษฎากร ม.86/9, 86/10) — ข้อมูลกลางใช้ทั้งหน้าจอและ API */

export type CnDnType = "CN" | "DN";

export const CNDN_TYPE_TH: Record<CnDnType, string> = { CN: "ใบลดหนี้", DN: "ใบเพิ่มหนี้" };

/** เหตุที่ออกได้ตามกฎหมาย */
export const CNDN_REASONS: Record<CnDnType, string[]> = {
  CN: [
    "ลดราคาสินค้า/บริการ",
    "สินค้าชำรุดเสียหายหรือไม่ตรงตามตัวอย่าง",
    "รับคืนสินค้า",
    "สินค้าขาดจำนวนจากที่ตกลง",
    "คำนวณราคาสินค้าผิดพลาดสูงกว่าที่เป็นจริง",
    "บอกเลิกสัญญาบริการ/ให้บริการไม่ครบ",
    "อื่น ๆ",
  ],
  DN: [
    "เพิ่มราคาสินค้า/บริการ",
    "สินค้าเกินจำนวนจากที่ตกลง",
    "คำนวณราคาสินค้าผิดพลาดต่ำกว่าที่เป็นจริง",
    "อื่น ๆ",
  ],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** ยอดของใบลดหนี้/เพิ่มหนี้ จากผลต่างก่อน VAT และอัตราภาษีของใบกำกับเดิม */
export function cndnAmounts(diff: number, invoice: { vatAmount?: number; subTotal?: number }) {
  const hasVat = (Number(invoice.vatAmount) || 0) > 0;
  const amount = r2(Math.max(0, Number(diff) || 0));
  const vatAmount = hasVat ? r2(amount * 0.07) : 0;
  return { amount, vatAmount, totalAmount: r2(amount + vatAmount), vatRate: hasVat ? 7 : 0 };
}
