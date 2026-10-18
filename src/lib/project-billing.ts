/**
 * การเรียกเก็บเงินตามงวดงานของโครงการ (ฟังก์ชันล้วน ใช้ทั้ง server และหน้าจอ)
 *
 * ยอดงวดในโครงการ (milestone.amount) เป็นยอดรวม VAT ตามสัญญา
 *  W = มูลค่างานก่อน VAT          = amount / 1.07
 *  R = เงินประกันผลงานที่ลูกค้าหัก   = W × retention%
 *  D = หักคืนเงินล่วงหน้า (มัดจำ)      = W × advance% (งวดสุดท้ายหักส่วนที่เหลือทั้งหมด)
 *  B = ยอดเรียกเก็บก่อน VAT        = W − R − D
 *  V = ภาษีมูลค่าเพิ่ม (ยังไม่ถึงกำหนด) = B × 7%   (VAT ของเงินประกันเกิดตอนเบิกคืน, ของเงินล่วงหน้าเกิดตอนรับเงินล่วงหน้า)
 *  G = ยอดเรียกเก็บรวม VAT         = B + V
 * งานบริการ/จ้างทำของ (ม.78/1): ออกใบแจ้งหนี้ก่อน ใบกำกับภาษีออกตอนรับเงิน
 */

export const VAT_RATE = 0.07;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ProgressBillAmounts {
  workValue: number;  // W
  retention: number;  // R
  advanceDeduct: number; // D
  base: number;       // B
  vat: number;        // V
  total: number;      // G
}

/** advanceDeduct: ยอดหักคืนเงินล่วงหน้าที่คำนวณไว้แล้ว (ดู advanceRecovery) */
export function progressBillAmounts(amountInclVat: number, retentionPercent: number, vatRegistered = true, advanceDeduct = 0): ProgressBillAmounts {
  const a = Math.max(0, Number(amountInclVat) || 0);
  const pct = Math.min(20, Math.max(0, Number(retentionPercent) || 0));
  const workValue = r2(vatRegistered ? a / (1 + VAT_RATE) : a);
  const retention = r2(workValue * pct / 100);
  const deduct = r2(Math.min(Math.max(0, Number(advanceDeduct) || 0), workValue - retention));
  const base = r2(workValue - retention - deduct);
  const vat = vatRegistered ? r2(base * VAT_RATE) : 0;
  return { workValue, retention, advanceDeduct: deduct, base, vat, total: r2(base + vat) };
}

/** ยอดหักคืนเงินล่วงหน้าของงวด: W × advance% ไม่เกินยอดคงค้าง; งวดสุดท้ายหักที่เหลือทั้งหมด */
export function advanceRecovery(workValue: number, advancePercent: number, outstanding: number, isLastMilestone: boolean): number {
  const left = Math.max(0, Number(outstanding) || 0);
  if (!(left > 0.009)) return 0;
  if (isLastMilestone) return r2(left);
  return r2(Math.min(left, (Number(workValue) || 0) * (Number(advancePercent) || 0) / 100));
}

/** ใบแจ้งหนี้เงินล่วงหน้า: มูลค่าสัญญาก่อน VAT × advance% (VAT เกิดตอนรับเงินล่วงหน้า) */
export function advanceBillAmounts(contractInclVat: number, advancePercent: number, vatRegistered = true): ProgressBillAmounts {
  const c = Math.max(0, Number(contractInclVat) || 0);
  const pct = Math.min(50, Math.max(0, Number(advancePercent) || 0));
  const base = r2((vatRegistered ? c / (1 + VAT_RATE) : c) * pct / 100);
  const vat = vatRegistered ? r2(base * VAT_RATE) : 0;
  return { workValue: 0, retention: 0, advanceDeduct: 0, base, vat, total: r2(base + vat) };
}

/** ใบเบิกคืนเงินประกันผลงาน: ฐาน = ยอดเงินประกันคงค้าง VAT เกิดตอนนี้ (ยังไม่ถึงกำหนดจนรับเงิน) */
export function retentionReleaseAmounts(retentionOutstanding: number, vatRegistered = true): ProgressBillAmounts {
  const base = r2(Math.max(0, Number(retentionOutstanding) || 0));
  const vat = vatRegistered ? r2(base * VAT_RATE) : 0;
  return { workValue: 0, retention: -base, advanceDeduct: 0, base, vat, total: r2(base + vat) };
}

/**
 * ส่วนของ VAT ในยอดที่รับชำระของใบแจ้งหนี้ที่ VAT เกิดตอนรับเงิน (รับบางส่วนได้)
 * ส่วนสุดท้ายใช้ยอดคงเหลือ เพื่อให้ผลรวมตรงกับ V พอดี
 */
export function vatPortionOfPayment(inv: { grandTotal: number; vatAmount: number; vatRealized?: number }, amount: number, balanceAfter: number) {
  const g = Number(inv.grandTotal) || 0, v = Number(inv.vatAmount) || 0;
  if (!(g > 0) || !(v > 0)) return { base: r2(amount), vat: 0 };
  const done = Number(inv.vatRealized) || 0;
  const vat = balanceAfter <= 0.009 ? r2(v - done) : r2(Math.min(v - done, amount * v / g));
  return { base: r2(amount - vat), vat: Math.max(0, vat) };
}

export interface BillRecord {
  invoiceNo: string;
  docKind: "progress" | "retention" | "advance";
  /** ใบเงินล่วงหน้า: ยอดเงินล่วงหน้าก่อน VAT / ใบงวดงาน: ยอดหักคืน */
  advanceAmount?: number;
  /** ใบเงินล่วงหน้า: % ที่ใช้หักคืนในแต่ละงวด */
  advancePercent?: number;
  milestoneId?: string;
  retentionAmount: number;
  workValue: number;
  grandTotal: number;
  paidAmount: number;
  status: string;
}

/** สรุปการเรียกเก็บของโครงการ */
export function billingSummary(milestones: { id: string; amount: number }[], bills: BillRecord[]) {
  const live = bills.filter((b) => String(b.status || "").toLowerCase() !== "cancelled");
  const progress = live.filter((b) => b.docKind === "progress");
  const contract = r2(milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0));
  const billedMilestones = new Set(progress.map((b) => b.milestoneId).filter(Boolean));
  const retentionHeld = r2(progress.reduce((s, b) => s + (Number(b.retentionAmount) || 0), 0));
  const retentionReleased = r2(live.filter((b) => b.docKind === "retention").reduce((s, b) => s - (Number(b.retentionAmount) || 0), 0));
  const advance = live.find((b) => b.docKind === "advance");
  const advanceBilled = r2(Number(advance?.advanceAmount) || 0);
  const advanceRecovered = r2(progress.reduce((s, b) => s + (Number(b.advanceAmount) || 0), 0));
  return {
    contract,
    billedWork: r2(progress.reduce((s, b) => s + (Number(b.workValue) || 0), 0)),
    billedTotal: r2(live.reduce((s, b) => s + (Number(b.grandTotal) || 0), 0)),
    received: r2(live.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0)),
    billedMilestones,
    unbilledAmount: r2(milestones.filter((m) => !billedMilestones.has(m.id)).reduce((s, m) => s + (Number(m.amount) || 0), 0)),
    retentionHeld,
    retentionReleased,
    retentionOutstanding: r2(retentionHeld - retentionReleased),
    advanceBilled,
    advanceRecovered,
    advanceOutstanding: r2(advanceBilled - advanceRecovered),
    advancePercent: Number(advance?.advancePercent) || 0,
  };
}
