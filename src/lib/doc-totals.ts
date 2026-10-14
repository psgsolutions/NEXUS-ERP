/**
 * ยอดเอกสารซื้อ/ขายจากรายการ — server คำนวณซ้ำเสมอ (ไม่เชื่อตัวเลขจากหน้าจอ)
 * ใช้กับ ใบขอซื้อ / ใบสั่งซื้อ / ใบสั่งขาย
 */

export type VatMode = "exclusive" | "inclusive" | "none";

/** รับค่ารูปแบบต่าง ๆ ที่หน้าจอใช้ (Exclusive / exclude / Exclude VAT / EXCLUSIVE ...) */
export function normalizeVatMode(v: any): VatMode {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("incl")) return "inclusive";
  if (s.startsWith("none") || s.startsWith("non") || s === "no" || s === "novat") return "none";
  return "exclusive";
}

const num = (v: any) => {
  const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

/** ส่วนลดของบรรทัด: discountType/discountValue หรือรูปแบบเก่า "10%" / จำนวนเงิน */
export function lineDiscount(it: any): number {
  const gross = Math.max(0, num(it.qty)) * Math.max(0, num(it.price));
  if (it.discountType || it.discountValue !== undefined) {
    const v = Math.max(0, num(it.discountValue));
    return Math.min(gross, it.discountType === "AMOUNT" ? v : gross * (v / 100));
  }
  const s = str(it.discount);
  if (!s) return 0;
  return Math.min(gross, s.endsWith("%") ? gross * (num(s.slice(0, -1)) / 100) : Math.max(0, num(s)));
}

/** ทำความสะอาดรายการ (เก็บเฉพาะฟิลด์ที่ใช้) — ตัดหัวข้อกลุ่มและบรรทัดจำนวน 0 ออก */
export function sanitizeLines(raw: any, max = 300): any[] {
  return (Array.isArray(raw) ? raw : []).slice(0, max)
    .filter((it: any) => it && it.itemType !== "GROUP_HEADER" && num(it.qty) > 0)
    .map((it: any, i: number) => ({
      lineNo: i + 1,
      productId: it.productId ? str(it.productId, 120) : null,
      sku: str(it.sku, 120),
      name: str(it.name || it.productName, 300),
      details: str(it.details || it.description, 2000),
      itemType: str(it.itemType || "PRODUCT", 30).toUpperCase(),
      qty: r2(num(it.qty)),
      unit: str(it.unit || it.uom || "ชิ้น", 30),
      price: r2(Math.max(0, num(it.price ?? it.unitPrice))),
      cost: r2(Math.max(0, num(it.cost ?? it.costPrice))),
      discountType: it.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT",
      discountValue: r2(Math.max(0, num(it.discountValue ?? (str(it.discount).endsWith("%") ? str(it.discount).slice(0, -1) : 0)))),
      whtRate: [0, 1, 2, 3, 5].includes(num(it.whtRate)) ? num(it.whtRate) : 0,
      isOptional: !!it.isOptional,
    }))
    .filter((it) => it.name);
}

export interface DocTotals {
  gross: number;        // ก่อนส่วนลด
  discount: number;
  afterDiscount: number;
  subTotal: number;     // ก่อน VAT
  vatAmount: number;
  grandTotal: number;   // รวม VAT
  whtAmount: number;    // ภาษีหัก ณ ที่จ่าย (คิดจากยอดก่อน VAT)
  netPayable: number;   // grandTotal − WHT
  cost: number;
}

export function computeDocTotals(lines: any[], vatMode: VatMode, whtRate = 0): DocTotals {
  const counted = lines.filter((l) => !l.isOptional);
  const gross = counted.reduce((s, l) => s + num(l.qty) * num(l.price), 0);
  const discount = counted.reduce((s, l) => s + lineDiscount(l), 0);
  const afterDiscount = Math.max(0, gross - discount);
  let subTotal = afterDiscount, vatAmount = 0, grandTotal = afterDiscount;
  if (vatMode === "exclusive") { vatAmount = afterDiscount * 0.07; grandTotal = afterDiscount + vatAmount; }
  else if (vatMode === "inclusive") { subTotal = afterDiscount / 1.07; vatAmount = afterDiscount - subTotal; }
  const whtAmount = subTotal * (Math.max(0, num(whtRate)) / 100);
  return {
    gross: r2(gross), discount: r2(discount), afterDiscount: r2(afterDiscount),
    subTotal: r2(subTotal), vatAmount: r2(vatAmount), grandTotal: r2(grandTotal),
    whtAmount: r2(whtAmount), netPayable: r2(grandTotal - whtAmount),
    cost: r2(counted.reduce((s, l) => s + num(l.qty) * num(l.cost), 0)),
  };
}
