/**
 * [STRATEGIC-LOGIC-V3.0]
 * Central Intelligence for Financial Calculations & ERP Logic
 * NEXUS ERP V3.0 - Centralized Financial Calculation Engine
 */

export type VatTypeV3 = 'INCLUSIVE' | 'INCLUSIVE_AUTO' | 'EXCLUSIVE' | 'NON_VAT';
export type MarginColor = 'STRATEGIC' | 'HEALTHY' | 'TACTICAL' | 'CRITICAL';

export interface LineItem {
  id: string;
  qty: number;
  costPrice: number; // ต้นทุนจริง
  projectPrice: number; // ราคาขายโครงการ
  retailPrice: number; // ราคาขายหน้าร้าน
  whtRate?: number; // หัก ณ ที่จ่าย รายบรรทัด (เช่น 0, 1, 3, 5%)
  itemType?: 'PRODUCT' | 'SERVICE' | 'LABOR' | 'GROUP_HEADER';
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  isGroupHeader?: boolean;
}

export interface CalcResult {
  grossSubTotal: number;  // ยอดรวมก่อนส่วนลด
  lineDiscountTotal: number; // ส่วนลดรวมรายบรรทัด
  docDiscountAmount: number; // ส่วนลดระดับเอกสาร
  totalDiscount: number;  // ส่วนลดรวมทั้งหมด
  subTotal: number;       // ยอดรวมก่อนภาษี (หลังหักส่วนลดทั้งหมด)
  vatAmount: number;      // ภาษีมูลค่าเพิ่ม
  grandTotal: number;     // ยอดสุทธิรวมภาษี (SubTotal + VAT)
  whtAmount: number;      // ยอดหัก ณ ที่จ่าย
  netPayable: number;     // ยอดที่ต้องชำระจริง (GrandTotal - WHT)
  totalCost: number;      // ต้นทุนรวมทั้งหมด
  profitMargin: number;   // เปอร์เซ็นต์กำไรขั้นต้น
  rainbowColor: MarginColor; // สีสถานะกำไร
  thaiBahtText: string;   // อักษรไทยท้ายบิล
  isBiddingTriggered: boolean; // ตัวเปิด Canvas ประมูลอัตโนมัติ (>500k)
  error?: string;         // ข้อผิดพลาดกรณีส่วนลดเกิน
}

/**
 * คำนวณผลลัพธ์ทางการเงินของเอกสารแบบไร้รอยต่อ (V3)
 * คำนวณลำดับ: ส่วนลดบรรทัด -> ส่วนลดเอกสาร -> ฐานภาษี -> VAT -> WHT
 */
export function calculateERPDocument(
  items: LineItem[], 
  vatType: VatTypeV3, 
  isProjectContext: boolean = true,
  whtRate: number = 0,
  vatPct: number = 7,
  docDiscountType: 'PERCENT' | 'AMOUNT' = 'AMOUNT',
  docDiscountValue: number = 0
): CalcResult {
  let grossSubTotal = 0;
  let lineDiscountTotal = 0;
  let totalCost = 0;

  // 1. คำนวณส่วนลดรายบรรทัด และยอดรวมขั้นต้น
  const lineDetails = items.map(item => {
    if (item.isGroupHeader || item.itemType === 'GROUP_HEADER') {
      return { item, lineGross: 0, lineDisc: 0, lineNet: 0 };
    }
    const sellPrice = isProjectContext ? item.projectPrice : item.retailPrice;
    const lineGross = sellPrice * item.qty;
    grossSubTotal += lineGross;
    totalCost += (item.costPrice || 0) * item.qty;

    let lineDisc = 0;
    if (item.discountType === 'PERCENT') {
      lineDisc = lineGross * ((item.discountValue || 0) / 100);
    } else if (item.discountType === 'AMOUNT') {
      lineDisc = item.discountValue || 0;
    }
    lineDiscountTotal += lineDisc;
    const lineNet = lineGross - lineDisc;

    return { item, lineGross, lineDisc, lineNet };
  });

  const netAfterLineDisc = grossSubTotal - lineDiscountTotal;

  // 2. คำนวณส่วนลดระดับเอกสาร
  let docDiscountAmount = 0;
  if (docDiscountType === 'PERCENT') {
    docDiscountAmount = netAfterLineDisc * ((docDiscountValue || 0) / 100);
  } else {
    docDiscountAmount = docDiscountValue || 0;
  }

  const totalDiscount = lineDiscountTotal + docDiscountAmount;

  // ตรวจสอบกรณีส่วนลดเกินยอดรวม
  if (totalDiscount > grossSubTotal && grossSubTotal > 0) {
    return {
      grossSubTotal,
      lineDiscountTotal,
      docDiscountAmount,
      totalDiscount,
      subTotal: 0,
      vatAmount: 0,
      grandTotal: 0,
      whtAmount: 0,
      netPayable: 0,
      totalCost,
      profitMargin: 0,
      rainbowColor: 'CRITICAL',
      thaiBahtText: 'ศูนย์บาทถ้วน',
      isBiddingTriggered: false,
      error: 'ส่วนลดรวมมากกว่ามูลค่าสินค้า/บริการ'
    };
  }

  // 3. กระจายส่วนลดเอกสารลงรายบรรทัดเพื่อคิด ฐานภาษี และ WHT
  let totalWhtAmount = 0;
  lineDetails.forEach(({ item, lineNet }) => {
    if (lineNet <= 0) return;
    const ratio = netAfterLineDisc > 0 ? lineNet / netAfterLineDisc : 0;
    const lineDocDisc = docDiscountAmount * ratio;
    const effectiveLineNet = lineNet - lineDocDisc;

    let lineExVat = effectiveLineNet;
    if (vatType === 'INCLUSIVE' || vatType === 'INCLUSIVE_AUTO') {
      lineExVat = (effectiveLineNet * 100) / (100 + vatPct);
    }

    const effectiveLineWhtRate = item.whtRate ?? whtRate;
    const lineWht = Math.round((lineExVat * (effectiveLineWhtRate / 100)) * 100) / 100;
    totalWhtAmount += lineWht;
  });

  let subTotal = grossSubTotal - totalDiscount;
  let vatAmount = 0;
  let grandTotal = subTotal;

  // 4. คำนวณภาษีมูลค่าเพิ่ม (VAT)
  if (vatType === 'EXCLUSIVE') {
    vatAmount = Math.round((subTotal * (vatPct / 100)) * 100) / 100;
    grandTotal = subTotal + vatAmount;
  } else if (vatType === 'INCLUSIVE' || vatType === 'INCLUSIVE_AUTO') {
    const rawSub = (subTotal * 100) / (100 + vatPct);
    vatAmount = Math.round((subTotal - rawSub) * 100) / 100;
    subTotal = Math.round(rawSub * 100) / 100;
    grandTotal = Math.round((subTotal + vatAmount) * 100) / 100;
  } else {
    vatAmount = 0;
    grandTotal = subTotal;
  }

  // 5. คำนวณ หัก ณ ที่จ่าย (WHT) และ ยอดชำระสุทธิ
  const whtAmount = Math.round(totalWhtAmount * 100) / 100;
  const netPayable = grandTotal - whtAmount;

  // 6. คำนวณกำไรขั้นต้น (GP%) คิดบนยอดก่อน VAT หลังส่วนลด
  const profit = subTotal - totalCost;
  const profitMargin = subTotal > 0 ? (profit / subTotal) * 100 : 0;
  let rainbowColor: MarginColor = 'CRITICAL';

  if (profitMargin >= 40) rainbowColor = 'STRATEGIC';
  else if (profitMargin >= 25) rainbowColor = 'HEALTHY';
  else if (profitMargin >= 15) rainbowColor = 'TACTICAL';

  const isBiddingTriggered = isProjectContext && grandTotal > 500000;

  return {
    grossSubTotal,
    lineDiscountTotal,
    docDiscountAmount,
    totalDiscount,
    subTotal,
    vatAmount,
    grandTotal,
    whtAmount,
    netPayable,
    totalCost,
    profitMargin: Math.round(profitMargin * 100) / 100,
    rainbowColor,
    thaiBahtText: arabicToThaiBaht(netPayable),
    isBiddingTriggered
  };
}

/**
 * ตรวจสอบความถูกต้องของวันคาดว่าปิดจบกับวันที่ออกเอกสาร
 */
export function validateQuotationDates(docDate: string, expectedCloseDate: string): { isValid: boolean; error?: string } {
  if (expectedCloseDate && docDate && expectedCloseDate < docDate) {
    return {
      isValid: false,
      error: "วันที่คาดว่าปิดจบ ต้องไม่ก่อนวันที่ออกเอกสาร"
    };
  }
  return { isValid: true };
}

/**
 * ตรวจสอบสิทธิ์การเขียนข้อมูลสเปก/datasheet กลับไปยังฐานข้อมูลสินค้า
 * สอดคล้องกับ Firestore Rules (SUPERADMIN, ADMIN, MANAGER, ENGINEER)
 */
export function canWriteBackToProductMaster(role: string | null | undefined, saveToProductRequested: boolean): boolean {
  if (!saveToProductRequested) return false;
  if (!role) return false;
  const upperRole = role.toUpperCase();
  return upperRole === "SUPERADMIN" || upperRole === "ADMIN" || upperRole === "MANAGER" || upperRole === "ENGINEER";
}

/**
 * แปลงจำนวนเงินเป็นอักษรภาษาไทย ถูกต้องตามหลักสรรพากร 100% (V3)
 */
export function arabicToThaiBaht(amount: number): string {
  if (amount === 0) return 'ศูนย์บาทถ้วน';
  
  const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  let [intPart, decPart] = amount.toFixed(2).split('.');
  let bahtText = '';

  const convertArray = (numStr: string): string => {
    let text = '';
    const len = numStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i]);
      const position = len - 1 - i;
      if (digit !== 0) {
        if (position === 1 && digit === 2) text += 'ยี่';
        else if (position === 1 && digit === 1) text += '';
        else if (position === 0 && digit === 1 && len > 1 && numStr[i-1] !== '0') text += 'เอ็ด';
        else text += numbers[digit];
        text += units[position % 6];
        if (position >= 6 && position % 6 === 0) text += units[6];
      }
    }
    return text;
  };

  bahtText += convertArray(intPart) + 'บาท';
  if (!decPart || decPart === '00') {
    bahtText += 'ถ้วน';
  } else {
    bahtText += convertArray(decPart) + 'สตางค์';
  }
  return bahtText;
}


// ============================================================================
// LEGACY V2.9 FUNCTIONS (Retained for backward compatibility during migration)
// ============================================================================

export type VatType = 'Inclusive' | 'Exclusive' | 'Non-VAT';
export type POType = 'STOCK' | 'PROJECT' | 'CONSUMABLE' | 'ASSET';
export type CustomerType = 'company' | 'government' | 'hospital' | 'person';
export type CustomerStatus = 'active' | 'draft' | 'suspended';

export const SCHEMA_VERSION = '2.9.5';

/**
 * @deprecated Use calculateERPDocument instead
 */
export function calculateFinancials(items: any[], vatType: VatType, discount: number = 0) {
  const rawNet = items.reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.price || 0)), 0);
  const cost = items.reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.cost || 0)), 0);
  
  const discountedNet = Math.max(0, rawNet - discount);
  
  let vat = 0;
  let total = 0;
  let subtotal = 0; // The true net revenue before tax

  if (vatType === 'Inclusive') {
    vat = discountedNet - (discountedNet / 1.07);
    total = discountedNet;
    subtotal = discountedNet - vat;
  } else if (vatType === 'Exclusive') {
    vat = discountedNet * 0.07;
    total = discountedNet + vat;
    subtotal = discountedNet;
  } else {
    vat = 0;
    total = discountedNet;
    subtotal = discountedNet;
  }

  const profit = subtotal - cost;
  const gpPercent = subtotal > 0 ? Math.round((profit / subtotal) * 100) : 0;

  return {
    net: subtotal,
    cost,
    vat,
    total,
    profit,
    gpPercent,
    rawNet,
    netThaiText: convertNumberToThaiText(total)
  };
}

/**
 * @deprecated Use arabicToThaiBaht instead
 */
export function convertNumberToThaiText(number: number): string {
  if (!number || isNaN(number)) return "ศูนย์บาทถ้วน";

  const textNumbers = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const textPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  
  const numberString = Math.abs(number).toFixed(2);
  const parts = numberString.split('.');
  const baht = parts[0];
  const satang = parts[1];
  
  const processGroup = (str: string): string => {
    let result = "";
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(str.charAt(i), 10);
      const pos = len - i - 1;
      
      if (digit !== 0) {
        if (pos === 0 && digit === 1 && len > 1 && result !== "") {
          result += "เอ็ด";
        } else if (pos === 1 && digit === 2) {
          result += "ยี่สิบ";
        } else if (pos === 1 && digit === 1) {
          result += "สิบ";
        } else {
          result += textNumbers[digit] + textPositions[pos];
        }
      }
    }
    return result;
  };

  let bahtResult = "";
  if (baht.length > 6) {
    const millionPart = baht.substring(0, baht.length - 6);
    const restPart = baht.substring(baht.length - 6);
    bahtResult = processGroup(millionPart) + "ล้าน" + processGroup(restPart);
  } else {
    bahtResult = processGroup(baht);
  }
  
  if (bahtResult === "") {
    bahtResult = "ศูนย์";
  }
  
  let result = (number < 0 ? "ลบ" : "") + bahtResult + "บาท";
  
  if (satang === "00") {
    result += "ถ้วน";
  } else {
    result += processGroup(satang) + "สตางค์";
  }
  
  return result;
}

/**
 * คำนวณอัตรากำไรขั้นต้น (GP%) สำหรับรายการสินค้า 1 บรรทัด (V3)
 * คำนวณจากราคาขายหลังส่วนลด เทียบกับต้นทุนสินค้า (คิดบนยอดก่อน VAT หลังส่วนลด)
 */
export function calculateLineGP(price: number, cost: number): number {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  if (p <= 0) return 0;
  const profit = p - c;
  const gp = (profit / p) * 100;
  return Math.round(gp * 100) / 100;
}

/**
 * Formats currency to Thai Baht standard string with 2 decimal places.
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  const num = Number(value) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Returns the color mapping for the Profit Rainbow based on GP%.
 */
export function getProfitRainbowColor(gpPercent: number) {
  if (gpPercent >= 50) return { bg: 'bg-nexus-teal/10', border: 'border-nexus-teal/20', text: 'text-nexus-teal', label: 'กำไรเหนือชั้น (ดีเยี่ยม)' };
  if (gpPercent >= 30) return { bg: 'bg-nexus-blue/10', border: 'border-nexus-blue/20', text: 'text-nexus-blue', label: 'กำไรมาตรฐาน (ดี)' };
  if (gpPercent >= 15) return { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', label: 'กำไรแข่งขัน (ปานกลาง)' };
  if (gpPercent >= 0) return { bg: 'bg-danger/10', border: 'border-danger/20', text: 'text-danger', label: 'กำไรวิกฤต (ต่ำ)' };
  return { bg: 'bg-black', border: 'border-danger', text: 'text-white', label: 'กำไรติดลบ' };
}

export type QuotationStatus = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'SENT' 
  | 'ACCEPTED' 
  | 'APPROVED'
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'CONVERTED_TO_SO'
  | 'ORDERED'
  | 'SUPERSEDED';

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'ฉบับร่าง',
  PENDING_APPROVAL: 'รออนุมัติ',
  SENT: 'ส่งแล้ว',
  ACCEPTED: 'อนุมัติแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
  EXPIRED: 'หมดอายุ',
  CONVERTED_TO_SO: 'แปลงเป็นใบสั่งขายแล้ว',
  ORDERED: 'แปลงเป็นใบสั่งขายแล้ว',
  SUPERSEDED: 'ฉบับเก่า'
};

export const QUOTATION_STATUS_COLORS: Record<string, 'inactive' | 'pending' | 'active' | 'danger' | 'warning'> = {
  DRAFT: 'inactive',
  PENDING_APPROVAL: 'pending',
  SENT: 'pending',
  ACCEPTED: 'active',
  APPROVED: 'active',
  REJECTED: 'danger',
  EXPIRED: 'warning',
  CONVERTED_TO_SO: 'active',
  ORDERED: 'active',
  SUPERSEDED: 'inactive'
};

export function calculateProfitAmount(subTotal: number, totalCost: number): number {
  return Math.max(0, (Number(subTotal) || 0) - (Number(totalCost) || 0));
}

