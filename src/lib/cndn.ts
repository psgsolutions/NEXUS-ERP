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

/** รายการที่ลดหนี้/เพิ่มหนี้ อ้างอิงบรรทัดของใบกำกับเดิม */
export interface CnDnLineInput { lineNo: number; qty: number; unitPrice?: number }
export interface CnDnLine { lineNo: number; productId: string | null; sku: string; name: string; unit: string; itemType: string; qty: number; unitPrice: number; amount: number; unitCost: number }

/**
 * มูลค่าก่อน VAT ของรายการที่ลด/เพิ่ม (ใช้ทั้งหน้าจอและ server)
 * - ราคาต่อหน่วยตั้งต้น = ราคาสุทธิหลังส่วนลดบรรทัดของใบกำกับเดิม (แก้ได้ เช่น ลดราคาบางส่วน)
 * - ราคารวม VAT → แปลงเป็นก่อน VAT · ส่วนลดท้ายบิลของใบเดิมเฉลี่ยตามสัดส่วน
 * - จำนวนรวมที่ลด (รวมใบลดหนี้ก่อนหน้า returnedQty) ต้องไม่เกินจำนวนในใบกำกับ
 */
export function cndnLines(invoice: any, input: CnDnLineInput[], type: CnDnType): { lines: CnDnLine[]; amount: number; error: string } {
  const items: any[] = Array.isArray(invoice?.items) ? invoice.items : [];
  const inclusive = String(invoice?.vatType || "").toLowerCase().startsWith("incl");
  const netOf = (it: any) => {
    const gross = Math.max(0, Number(it.qty) || 0) * Math.max(0, Number(it.price ?? it.unitPrice) || 0);
    const v = Math.max(0, Number(it.discountValue) || 0);
    const disc = Math.min(gross, it.discountType === "AMOUNT" ? v : gross * (v / 100));
    return gross - disc;
  };
  const sumNet = items.reduce((s, it) => s + netOf(it), 0);
  const preVat = (n: number) => (inclusive ? n / 1.07 : n);
  // ส่วนลดท้ายบิล: ยอดก่อน VAT ของใบ ÷ ผลรวมรายการ (ไม่เกิน 1)
  const factor = sumNet > 0 ? Math.min(1, (Number(invoice?.subTotal) || preVat(sumNet)) / preVat(sumNet)) : 1;
  const returned = invoice?.returnedQty && typeof invoice.returnedQty === "object" ? invoice.returnedQty : {};
  const out: CnDnLine[] = [];
  for (const row of input || []) {
    const qty = r2(Math.max(0, Number(row.qty) || 0));
    if (!qty) continue;
    const idx = items.findIndex((it, i) => Number(it.lineNo ?? i + 1) === Number(row.lineNo));
    if (idx < 0) return { lines: [], amount: 0, error: `ไม่พบรายการที่ ${row.lineNo} ในใบกำกับภาษี` };
    const it = items[idx];
    const lineNo = Number(it.lineNo ?? idx + 1);
    const origQty = Number(it.qty) || 0;
    if (type === "CN" && qty + (Number(returned[lineNo]) || 0) > origQty + 1e-9) {
      return { lines: [], amount: 0, error: `${it.name || "รายการ"}: ลดได้ไม่เกิน ${r2(origQty - (Number(returned[lineNo]) || 0))} ${it.unit || ""}`.trim() };
    }
    const defaultUnit = origQty > 0 ? netOf(it) / origQty : 0;
    const unitShown = row.unitPrice !== undefined && row.unitPrice !== null && String(row.unitPrice) !== "" ? Math.max(0, Number(row.unitPrice) || 0) : defaultUnit;
    const amount = r2(preVat(qty * unitShown) * factor);
    out.push({ lineNo, productId: it.productId || null, sku: String(it.sku || ""), name: String(it.name || it.productName || ""), unit: String(it.unit || ""), itemType: String(it.itemType || "PRODUCT").toUpperCase(),
      qty, unitPrice: r2(unitShown), amount, unitCost: r2(Math.max(0, Number(it.cost) || 0)) });
  }
  return { lines: out, amount: r2(out.reduce((s, l) => s + l.amount, 0)), error: "" };
}
