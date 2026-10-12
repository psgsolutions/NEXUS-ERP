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

/**
 * ปรับยอดลูกหนี้ของใบกำกับ: delta > 0 = ลูกค้าค้างเพิ่ม, delta < 0 = ค้างลดลง
 * ยอดค้างชำระ (balance) กับยอดที่ต้องคืนลูกค้า (refundDue) หักกลบกันเสมอ — ไม่มีทั้งสองอย่างพร้อมกัน
 */
export function applyArDelta(balance: number, refundDue: number, delta: number): { balance: number; refundDue: number } {
  const net = r2((Number(balance) || 0) - (Number(refundDue) || 0) + (Number(delta) || 0));
  return net >= 0 ? { balance: net, refundDue: 0 } : { balance: 0, refundDue: r2(-net) };
}

export function arPaymentStatus(balance: number, paid: number): "paid" | "partial" | "unpaid" {
  return balance <= 0.009 ? "paid" : paid > 0 ? "partial" : "unpaid";
}
