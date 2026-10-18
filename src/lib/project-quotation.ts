/**
 * รายการโครงการ -> รายการใบเสนอราคา (ฟังก์ชันล้วน)
 * ใช้ตอนปรับใบเสนอราคาตามคำขอเปลี่ยนแปลงที่อนุมัติแล้ว (รายการโครงการคือข้อมูลล่าสุด)
 */

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** รูปแบบเดียวกับที่หน้าสร้างโครงการส่งให้ /api/quotations (ผ่าน normalizeLines อีกชั้น) */
export function projectItemsToQuotationLines(items: any[]): Record<string, any>[] {
  return (Array.isArray(items) ? items : []).map((it) => {
    if (it.kind === "GROUP") return { itemType: "GROUP_HEADER", productName: String(it.name || ""), qty: 0, unitPrice: 0 };
    return {
      itemType: it.kind === "LABOR" ? "LABOR" : it.kind === "SERVICE" ? "SERVICE" : "PRODUCT",
      productId: it.productId || "", sku: it.sku || "", productName: String(it.name || ""),
      description: String(it.details || ""), details: String(it.details || ""),
      qty: num(it.qty), uom: it.unit || (it.kind === "LABOR" ? "งาน" : "ชิ้น"),
      costPrice: num(it.unitCost), unitPrice: num(it.unitPrice),
      discountType: it.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT", discountValue: num(it.discountValue),
      whtRate: num(it.whtRate), isOptional: !!it.isOptional,
    };
  });
}

/**
 * ยอดใบเสนอราคาจากรายการที่ normalize แล้ว (lineTotal หลังส่วนลดบรรทัด)
 * subTotal/netTotal = หลังส่วนลดท้ายบิล, VAT ตามประเภทภาษีของใบเสนอราคา, หัก ณ ที่จ่ายตาม whtRate ของบรรทัด
 */
export function quotationTotals(lines: Record<string, any>[], taxType: any, docDiscountAmount: any = 0) {
  const counted = lines.filter((l) => l.itemType !== "GROUP_HEADER" && !l.isOptional);
  const lineSum = r2(counted.reduce((s, l) => s + num(l.lineTotal), 0));
  const disc = r2(Math.min(Math.max(0, num(docDiscountAmount)), lineSum));
  const net = r2(lineSum - disc);
  const t = String(taxType || "EXCLUSIVE").toUpperCase();
  const ratio = lineSum > 0 ? net / lineSum : 0;
  let vat = 0, grand = net, baseFactor = 1;
  if (t === "INCLUSIVE") { vat = r2(net * 7 / 107); baseFactor = 1 / 1.07; }
  else if (t !== "NONE" && t !== "EXEMPT") { vat = r2(net * 0.07); grand = r2(net + vat); }
  const wht = r2(counted.reduce((s, l) => s + num(l.lineTotal) * ratio * baseFactor * (num(l.whtRate) / 100), 0));
  return {
    subTotal: net, netTotal: net, docDiscountAmount: disc, discountTotal: disc,
    vatAmount: vat, grandTotal: grand, whtAmount: wht, netPayable: r2(grand - wht),
  };
}
