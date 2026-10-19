/**
 * สูตรคำนวณภาษี (ไม่มีการอ่านฐานข้อมูล) — ใช้ร่วมกันทั้งหน้าจอ (แสดงตัวอย่าง) และ API (บันทึกการยื่น)
 *  - ภ.พ.30 จากรายการบัญชีภาษีขาย/ภาษีซื้อ (สำรอง: ใบกำกับภาษี ถ้าไม่มีภาษีขายในสมุดรายวัน)
 *  - ภ.ง.ด.3 / 53 จากหนังสือรับรองหัก ณ ที่จ่าย
 */

export interface PP30TaxData {
  companyId: string;
  yearMonth: string; // "YYYY-MM"
  salesBase: number;
  outputVat: number;
  purchaseBase: number;
  inputVat: number;
  netVatPayable: number; // บวก = ชำระ, ลบ = ขอคืน
  journalCount: number;
}

export interface WHTTaxRecord {
  id: string;
  docNo: string;
  date: string;
  vendorName: string;
  taxId: string;
  vendorType: "INDIVIDUAL" | "CORPORATE";
  whtType: "PND3" | "PND53";
  incomeType: string;
  baseAmount: number;
  whtRate: number;
  whtAmount: number;
}

// รหัสบัญชีภาษีขาย/ภาษีซื้อ (ผังบัญชี 6 หลัก และรูปแบบ XXXX-XX)
export const OUTPUT_VAT_CODES = ["213100", "2121-00"];
export const INPUT_VAT_CODES = ["115100", "1151-00"];

/** วันที่เอกสารตามเวลาไทย (UTC+7) เพื่อจัดเข้างวดภาษีถูกเดือน */
export function toThaiDateStr(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const secs = value.seconds ?? value._seconds;
  const ms = secs !== undefined ? secs * 1000 : value instanceof Date ? value.getTime() : typeof value.toDate === "function" ? value.toDate().getTime() : NaN;
  return Number.isNaN(ms) ? "" : new Date(ms + 7 * 60 * 60 * 1000).toISOString();
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** ภ.พ.30 ของงวด จากรายการบัญชี (ที่ยังไม่ถูกยกเลิก) และใบกำกับภาษี (ใช้เมื่อไม่พบภาษีขายในสมุดรายวัน) */
export function computePP30(companyId: string, yearMonth: string, journals: any[], invoices: any[]): PP30TaxData {
  let salesBase = 0, outputVat = 0, purchaseBase = 0, inputVat = 0, journalCount = 0;

  for (const data of journals) {
    if (data.isDeleted === true || String(data.status || "").toLowerCase() === "cancelled") continue;
    if (!toThaiDateStr(data.date).startsWith(yearMonth)) continue;
    journalCount++;
    for (const line of data.items || data.lines || []) {
      const accountCode = String(line.accountCode || line.code || "");
      const debit = Number(line.debit || line.dr || 0);
      const credit = Number(line.credit || line.cr || 0);
      const memo = String(line.description || line.memo || data.description || "").toLowerCase();
      // ระบุบัญชีจากรหัสเป็นหลัก; ใช้คำอธิบายเฉพาะบรรทัดที่ไม่มีรหัสบัญชี (ข้อมูลรุ่นเก่า)
      const isOutput = accountCode ? OUTPUT_VAT_CODES.includes(accountCode) : (memo.includes("ภาษีขาย") || memo.includes("output vat"));
      const isInput = accountCode ? INPUT_VAT_CODES.includes(accountCode) : (memo.includes("ภาษีซื้อ") || memo.includes("input vat"));
      // รวมแบบมีเครื่องหมาย: ใบลดหนี้/กลับรายการลดภาษีของเดือนนั้น
      if (isOutput) { const v = credit - debit; outputVat += v; salesBase += r2(v / 0.07); }
      if (isInput) { const v = debit - credit; inputVat += v; purchaseBase += r2(v / 0.07); }
    }
  }

  if (salesBase === 0 && outputVat === 0) {
    for (const inv of invoices) {
      if (inv.isDeleted === true || inv.isSample === true || String(inv.status || "").toLowerCase() === "cancelled") continue;
      // ใบแจ้งหนี้งานบริการ (VAT เกิดตอนรับเงิน) ไม่ใช่ใบกำกับภาษี
      if (inv.vatTiming === "receipt") continue;
      // ลูกหนี้ยกมาจากระบบเดิม: ภาษีขายยื่นในระบบเดิมแล้ว
      if (inv.docKind === "opening") continue;
      if (toThaiDateStr(inv.issueDate || inv.date || "").startsWith(yearMonth)) {
        salesBase += Number(inv.subTotal || inv.amount || 0);
        outputVat += Number(inv.vatAmount || 0);
      }
    }
  }

  return {
    companyId, yearMonth,
    salesBase: r2(salesBase), outputVat: r2(outputVat), purchaseBase: r2(purchaseBase), inputVat: r2(inputVat),
    netVatPayable: r2(outputVat - inputVat), journalCount,
  };
}

/**
 * รายการ ภ.ง.ด.3 (บุคคลธรรมดา) / ภ.ง.ด.53 (นิติบุคคล) ของงวด
 * เลขผู้เสียภาษี 13 หลักขึ้นต้น 0 = นิติบุคคล
 */
export function buildWhtRecords(docs: { id: string; data: any }[], supplierTaxIds: Map<string, string>, yearMonth: string, whtType: "PND3" | "PND53"): WHTTaxRecord[] {
  const out: WHTTaxRecord[] = [];
  for (const { id, data } of docs) {
    if (data.isDeleted === true || data.isSample === true || String(data.status || "").toLowerCase() === "cancelled") continue;
    const dateStr = toThaiDateStr(data.issuedAt || data.filingDate || data.createdAt);
    if (yearMonth && !dateStr.startsWith(yearMonth)) continue;
    const taxId = String(data.taxId || supplierTaxIds.get(data.supplierId) || "");
    const isCorp = data.vendorType === "CORPORATE" || (taxId.length === 13 && taxId.startsWith("0"));
    const targetType = isCorp ? "PND53" : "PND3";
    if (whtType !== targetType) continue;
    out.push({
      id,
      docNo: data.whtId || id,
      date: dateStr.split("T")[0],
      vendorName: data.vendor || data.vendorName || "ผู้เสียภาษี",
      taxId: taxId || "0000000000000",
      vendorType: isCorp ? "CORPORATE" : "INDIVIDUAL",
      whtType: targetType,
      incomeType: data.incomeType || "ค่าบริการ / ค่าจ้าง",
      baseAmount: Number(data.baseAmount || 0),
      whtRate: Number(data.whtRate || 3),
      whtAmount: Number(data.whtAmount ?? data.taxAmount ?? 0),
    });
  }
  return out;
}
