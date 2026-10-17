import { db } from "./firebase-client";
import { groupIdOf } from "./master-data";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { buildWhtRecords, computePP30, type PP30TaxData, type WHTTaxRecord } from "./tax-calc";

/**
 * [TAX-COMPLIANCE-ENGINE]
 * ดึงข้อมูลภาษีสำหรับแสดงตัวอย่างบนหน้าจอ (ภ.พ.30 / ภ.ง.ด.3 / ภ.ง.ด.53)
 * สูตรอยู่ใน tax-calc.ts — การบันทึกการยื่นและล็อกงวดทำที่ /api/finance/tax-filings (คำนวณซ้ำที่ server)
 */

export type { PP30TaxData, WHTTaxRecord } from "./tax-calc";

export interface TaxFilingLock {
  lockId: string;
  companyId: string;
  reportType: "VAT30" | "PND3" | "PND53";
  yearMonth: string;
  exportedAt: string;
  exportedBy: string;
  isLocked: boolean;
}

/** รายการบัญชีของบริษัท (subcollection ของบริษัท + root รุ่นเก่า) */
async function fetchCompanyJournalEntries(companyId: string): Promise<any[]> {
  const [snapScoped, snapLegacy] = await Promise.all([
    getDocs(collection(db, `companies/${companyId}/journal_entries`)),
    getDocs(query(collection(db, "journal_entries"), where("companyId", "==", companyId), where("isDeleted", "==", false))),
  ]);
  return [...snapScoped.docs.map((d) => d.data()), ...snapLegacy.docs.map((d) => d.data())];
}

/** 1. ภ.พ.30 ของงวด YYYY-MM */
export async function calculatePP30Tax(companyId: string, yearMonth: string): Promise<PP30TaxData> {
  if (!companyId || !yearMonth) throw new Error("บริษัทและงวดเดือน/ปี มีความจำเป็นสำหรับการคำนวณภาษี");
  const journals = await fetchCompanyJournalEntries(companyId);
  const invSnap = await getDocs(query(collection(db, `companies/${companyId}/invoices`), where("companyId", "==", companyId)));
  return computePP30(companyId, yearMonth, journals, invSnap.docs.map((d) => d.data()));
}

/** 2. รายการ ภ.ง.ด.3 / ภ.ง.ด.53 ของงวด */
export async function fetchWHTTaxRecords(companyId: string, yearMonth: string, whtType: "PND3" | "PND53"): Promise<WHTTaxRecord[]> {
  const snapWht = await getDocs(query(collection(db, `companies/${companyId}/withholding_taxes`), where("companyId", "==", companyId)));
  const supplierTaxIds = new Map<string, string>();
  const supplierIds = Array.from(new Set(snapWht.docs.map((d) => d.data().supplierId).filter(Boolean)));
  // เลขผู้เสียภาษีอยู่ที่ข้อมูลกลางของเครือ (ย้ายแล้ว) หรือ root suppliers (รุ่นเก่า)
  const groupId = groupIdOf((await getDoc(doc(db, "companies", companyId))).data() as any, companyId);
  for (const id of supplierIds) {
    const master = await getDoc(doc(db, "groups", groupId, "suppliers", id)).catch(() => null);
    const sup = master?.exists() ? master : await getDoc(doc(db, "suppliers", id));
    if (sup.exists()) supplierTaxIds.set(id, String(sup.data().taxId || sup.data().tax_id || ""));
  }
  return buildWhtRecords(snapWht.docs.map((d) => ({ id: d.id, data: d.data() })), supplierTaxIds, yearMonth, whtType);
}

/** 3. ตรวจว่างวดนี้ยื่นไปแล้วหรือยัง (ล็อกสร้างโดย API ตอนบันทึกการยื่น) */
export async function checkTaxFilingExportLock(companyId: string, reportType: "VAT30" | "PND3" | "PND53", yearMonth: string): Promise<TaxFilingLock | null> {
  const snap = await getDoc(doc(db, `companies/${companyId}/tax_filing_locks`, `${companyId}_${reportType}_${yearMonth}`)).catch(() => null);
  return snap && snap.exists() ? (snap.data() as TaxFilingLock) : null;
}

/**
 * 4. CSV Exporters with UTF-8 BOM (\uFEFF) for Thai Excel Compatibility
 */
export function exportPP30ToCSV(data: PP30TaxData): string {
  const bom = "\uFEFF";
  const rows = [
    ["รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30)", `ประจำงวดเดือน/ปี: ${data.yearMonth}`],
    ["รหัสบริษัท", data.companyId],
    [],
    ["รายการ", "มูลค่าสินค้า/บริการ (บาท)", "ภาษีมูลค่าเพิ่ม 7% (บาท)"],
    ["1. ยอดขายในเดือนนี้ (ภาษีขาย)", data.salesBase.toFixed(2), data.outputVat.toFixed(2)],
    ["2. ยอดซื้อในเดือนนี้ (ภาษีซื้อ)", data.purchaseBase.toFixed(2), data.inputVat.toFixed(2)],
    [
      data.netVatPayable >= 0 ? "3. ภาษีมูลค่าเพิ่มต้องชำระสุทธิ" : "3. ภาษีมูลค่าเพิ่มขอคืนสุทธิ",
      "-",
      Math.abs(data.netVatPayable).toFixed(2)
    ]
  ];

  return bom + rows.map(r => r.join(",")).join("\n");
}

export function exportWHTToCSV(records: WHTTaxRecord[], whtType: "PND3" | "PND53", yearMonth: string): string {
  const bom = "\uFEFF";
  const title = whtType === "PND3" ? "รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 (บุคคลธรรมดา)" : "รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.53 (นิติบุคคล)";
  
  const headers = [
    "ลำดับ", "เลขที่เอกสาร", "วันที่", "ชื่อผู้มีรายได้/คู่ค้า", "เลขประจำตัวผู้เสียภาษี", 
    "ประเภทเงินได้", "จำนวนเงินที่จ่าย (บาท)", "อัตราภาษี (%)", "ภาษีที่หักและนำส่ง (บาท)"
  ];

  const rows = records.map((r, idx) => [
    idx + 1,
    `"${r.docNo}"`,
    r.date,
    `"${r.vendorName}"`,
    `"${r.taxId}"`,
    `"${r.incomeType}"`,
    r.baseAmount.toFixed(2),
    `${r.whtRate}%`,
    r.whtAmount.toFixed(2)
  ]);

  const totalBase = records.reduce((s, r) => s + r.baseAmount, 0);
  const totalWht = records.reduce((s, r) => s + r.whtAmount, 0);

  const summaryRow = [
    "รวมทั้งสิ้น", "", "", "", "", "", totalBase.toFixed(2), "-", totalWht.toFixed(2)
  ];

  const content = [
    [title, `ประจำงวด: ${yearMonth}`],
    [],
    headers,
    ...rows,
    [],
    summaryRow
  ];

  return bom + content.map(r => r.join(",")).join("\n");
}
