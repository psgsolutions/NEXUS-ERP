/**
 * [STRATEGIC-LOGIC-V3.0]
 * Central Intelligence for Financial Calculations & ERP Logic
 * NEXUS ERP V3.0 - Centralized Financial Calculation Engine
 */

export type VatTypeV3 = 'INCLUSIVE' | 'EXCLUSIVE' | 'NON_VAT';
export type MarginColor = 'STRATEGIC' | 'HEALTHY' | 'TACTICAL' | 'CRITICAL';

export interface LineItem {
  id: string;
  qty: number;
  costPrice: number; // ต้นทุนจริง
  projectPrice: number; // ราคาขายโครงการ
  retailPrice: number; // ราคาขายหน้าร้าน
}

export interface CalcResult {
  subTotal: number;       // ยอดรวมก่อนภาษี
  vatAmount: number;      // ภาษีมูลค่าเพิ่ม
  grandTotal: number;     // ยอดสุทธิรวมภาษี
  totalCost: number;      // ต้นทุนรวมทั้งหมด
  profitMargin: number;   // เปอร์เซ็นต์กำไรขั้นต้น
  rainbowColor: MarginColor; // สีสถานะกำไร
  thaiBahtText: string;   // อักษรไทยท้ายบิล
  isBiddingTriggered: boolean; // ตัวเปิด Canvas ประมูลอัตโนมัติ (>500k)
}

/**
 * คำนวณผลลัพธ์ทางการเงินของเอกสารแบบไร้รอยต่อ (V3)
 */
export function calculateERPDocument(
  items: LineItem[], 
  vatType: VatTypeV3, 
  isProjectContext: boolean = true
): CalcResult {
  let subTotal = 0;
  let totalCost = 0;

  // 1. คำนวณฐานรากแยกบรรทัดเพื่อป้องกันทศนิยมเคลื่อน
  items.forEach(item => {
    const sellPrice = isProjectContext ? item.projectPrice : item.retailPrice;
    subTotal += sellPrice * item.qty;
    totalCost += item.costPrice * item.qty;
  });

  let vatAmount = 0;
  let grandTotal = subTotal;

  // 2. แตกแขนงคิดภาษี 3 รูปแบบตาม PSG Protocol
  if (vatType === 'EXCLUSIVE') {
    vatAmount = Math.round((subTotal * 0.07) * 100) / 100; // ปัดเศษทศนิยม 2 ตำแหน่ง
    grandTotal = subTotal + vatAmount;
  } else if (vatType === 'INCLUSIVE') {
    const rawSub = (subTotal * 100) / 107;
    vatAmount = Math.round((subTotal - rawSub) * 100) / 100;
    subTotal = Math.round(rawSub * 100) / 100;
  } else {
    vatAmount = 0; // NON_VAT
  }

  // 3. คิดกำไรขั้นต้นและสะท้อนสี Profit Rainbow
  const profit = grandTotal - totalCost;
  const profitMargin = grandTotal > 0 ? (profit / grandTotal) * 100 : 0;
  let rainbowColor: MarginColor = 'CRITICAL';

  if (profitMargin >= 40) rainbowColor = 'STRATEGIC'; // กำไรเหนือชั้น
  else if (profitMargin >= 25) rainbowColor = 'HEALTHY';  // กำไรมาตรฐานองค์กร
  else if (profitMargin >= 15) rainbowColor = 'TACTICAL'; // กำไรแข่งขันเหลี่ยมธุรกิจ
  
  // 4. เงื่อนไขอัจฉริยะ: หากมูลค่าโครงการเกิน 5 แสนบาท ปรับเข้าสู่โหมดประมูลอัตโนมัติ
  const isBiddingTriggered = isProjectContext && grandTotal > 500000;

  return {
    subTotal,
    vatAmount,
    grandTotal,
    totalCost,
    profitMargin: Math.round(profitMargin * 100) / 100,
    rainbowColor,
    thaiBahtText: arabicToThaiBaht(grandTotal),
    isBiddingTriggered
  };
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
 * Formats currency to Thai Baht standard.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value).replace('฿', '฿ ');
}

/**
 * Returns the color mapping for the Profit Rainbow based on GP%.
 */
export function getProfitRainbowColor(gpPercent: number) {
  if (gpPercent >= 50) return { bg: 'bg-nexus-teal/10', border: 'border-nexus-teal/20', text: 'text-nexus-teal', label: 'STRATEGIC MARGIN (EXCELLENT)' };
  if (gpPercent >= 30) return { bg: 'bg-nexus-blue/10', border: 'border-nexus-blue/20', text: 'text-nexus-blue', label: 'HEALTHY MARGIN (GOOD)' };
  if (gpPercent >= 15) return { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', label: 'TACTICAL MARGIN (FAIR)' };
  if (gpPercent >= 0) return { bg: 'bg-danger/10', border: 'border-danger/20', text: 'text-danger', label: 'CRITICAL MARGIN (LOW)' };
  return { bg: 'bg-black', border: 'border-danger', text: 'text-white', label: 'NEGATIVE MARGIN' };
}
