import { db } from "./firebase-client";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auditService } from "@/services/audit.service";

/**
 * [TAX-COMPLIANCE-ENGINE-V1.0]
 * Revenue Department Tax Filing Engine for NEXUS ERP (Intelligence OS)
 * Supports PP.30 (ภ.พ.30), PND 3 (ภ.ง.ด.3), PND 53 (ภ.ง.ด.53)
 */

export interface PP30TaxData {
  companyId: string;
  yearMonth: string; // "YYYY-MM"
  salesBase: number;
  outputVat: number;
  purchaseBase: number;
  inputVat: number;
  netVatPayable: number; // positive = payable, negative = refundable
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

export interface TaxFilingLock {
  lockId: string;
  companyId: string;
  reportType: "VAT30" | "PND3" | "PND53";
  yearMonth: string;
  exportedAt: string;
  exportedBy: string;
  isLocked: boolean;
}

// วันที่ของเอกสารตามเวลาประเทศไทย (UTC+7) เพื่อจัดเข้างวดภาษีถูกเดือน
// (เอกสารที่ออก 1 ต.ค. 06:00 น. เวลาไทย คือ 30 ก.ย. ตามเวลา UTC)
function toThaiDateStr(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const ms = value.seconds !== undefined ? value.seconds * 1000 : value instanceof Date ? value.getTime() : NaN;
  return Number.isNaN(ms) ? "" : new Date(ms + 7 * 60 * 60 * 1000).toISOString();
}

// รหัสบัญชีภาษีขาย/ภาษีซื้อ (ผังบัญชี 6 หลัก และรูปแบบ XXXX-XX ที่ AccountingEngine ใช้)
const OUTPUT_VAT_CODES = ["213100", "2121-00"];
const INPUT_VAT_CODES = ["115100", "1151-00"];

/**
 * Reads a company's journal entries from the tenant subcollection
 * (`companies/{companyId}/journal_entries`) and the legacy root `journal_entries`.
 */
async function fetchCompanyJournalEntries(companyId: string): Promise<any[]> {
  const [snapScoped, snapLegacy] = await Promise.all([
    getDocs(collection(db, `companies/${companyId}/journal_entries`)),
    getDocs(query(collection(db, "journal_entries"), where("companyId", "==", companyId), where("isDeleted", "==", false)))
  ]);
  const entries: any[] = [];
  snapScoped.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.isDeleted !== true) entries.push(data);
  });
  snapLegacy.forEach((docSnap) => entries.push(docSnap.data()));
  return entries;
}

/**
 * 1. Calculate ภ.พ.30 (PP.30 VAT) from Journal Entries / Invoices / Expenses
 * Scoped by companyId + isDeleted: false
 */
export async function calculatePP30Tax(companyId: string, yearMonth: string): Promise<PP30TaxData> {
  if (!companyId || !yearMonth) {
    throw new Error("บริษัทและงวดเดือน/ปี มีความจำเป็นสำหรับการคำนวณภาษี");
  }

  let salesBase = 0;
  let outputVat = 0;
  let purchaseBase = 0;
  let inputVat = 0;
  let journalCount = 0;

  try {
    // 1. Query journal entries for the target month (both the tenant subcollection
    //    used by AccountingEngine / post-journal API and the legacy root collection)
    const journalDocs = await fetchCompanyJournalEntries(companyId);

    journalDocs.forEach((data) => {
      const entryDateStr = toThaiDateStr(data.date);
      
      if (entryDateStr.startsWith(yearMonth)) {
        journalCount++;
        const items = data.items || data.lines || [];
        
        items.forEach((line: any) => {
          const accountCode = String(line.accountCode || line.code || "");
          const debit = Number(line.debit || line.dr || 0);
          const credit = Number(line.credit || line.cr || 0);
          const memo = String(line.description || line.memo || data.description || "").toLowerCase();

          // ระบุบัญชีจากรหัสเป็นหลัก; ใช้คำอธิบายเฉพาะบรรทัดที่ไม่มีรหัสบัญชี (ข้อมูลรุ่นเก่า)
          const isOutput = accountCode ? OUTPUT_VAT_CODES.includes(accountCode) : (memo.includes("ภาษีขาย") || memo.includes("output vat"));
          const isInput = accountCode ? INPUT_VAT_CODES.includes(accountCode) : (memo.includes("ภาษีซื้อ") || memo.includes("input vat"));

          // ภาษีขาย: รวมแบบมีเครื่องหมาย — ใบลดหนี้ (Dr ภาษีขาย) ลดภาษีขายของเดือนนั้น
          if (isOutput) {
            const vatVal = credit - debit;
            outputVat += vatVal;
            salesBase += Math.round((vatVal / 0.07) * 100) / 100;
          }

          // ภาษีซื้อ: รวมแบบมีเครื่องหมาย (กลับรายการ/ลดหนี้จากผู้ขายลดภาษีซื้อ)
          if (isInput) {
            const vatVal = debit - credit;
            inputVat += vatVal;
            purchaseBase += Math.round((vatVal / 0.07) * 100) / 100;
          }
        });
      }
    });

    // 2. Fallback: ใบกำกับภาษีของบริษัท (companies/{companyId}/invoices) ถ้าไม่พบภาษีขายในสมุดรายวัน
    if (salesBase === 0 && outputVat === 0) {
      const invRef = collection(db, `companies/${companyId}/invoices`);
      const qInv = query(
        invRef,
        where("companyId", "==", companyId),
        where("isDeleted", "==", false)
      );
      const snapInv = await getDocs(qInv);
      snapInv.forEach((docSnap) => {
        const inv = docSnap.data();
        if (inv.isSample === true) return; // ข้อมูลตัวอย่างไม่นับเป็นภาษีจริง
        const rawDate = inv.issueDate || inv.date || "";
        const dateStr = toThaiDateStr(rawDate);
        if (dateStr.startsWith(yearMonth)) {
          salesBase += Number(inv.subTotal || inv.amount || 0);
          outputVat += Number(inv.vatAmount || 0);
        }
      });
    }
  } catch (err) {
    console.error("Error calculating PP.30 tax data:", err);
  }

  const netVatPayable = outputVat - inputVat;

  return {
    companyId,
    yearMonth,
    salesBase,
    outputVat,
    purchaseBase,
    inputVat,
    netVatPayable,
    journalCount
  };
}

/**
 * 2. Fetch WHT Records for ภ.ง.ด.3 or ภ.ง.ด.53
 * Scoped by companyId + isDeleted: false
 */
export async function fetchWHTTaxRecords(
  companyId: string, 
  yearMonth: string, 
  whtType: "PND3" | "PND53"
): Promise<WHTTaxRecord[]> {
  const records: WHTTaxRecord[] = [];

  try {
    // ไม่กรอง isDeleted ใน query: เอกสารที่สร้างจาก createWHTFromExpense ไม่มีฟิลด์นี้
    const snapWht = await getDocs(query(collection(db, `companies/${companyId}/withholding_taxes`), where("companyId", "==", companyId)));

    // เลขผู้เสียภาษีของผู้จำหน่าย: 13 หลักขึ้นต้น 0 = นิติบุคคล (ภ.ง.ด.53), อื่นๆ = บุคคลธรรมดา (ภ.ง.ด.3)
    const supplierTaxIds = new Map<string, string>();
    const supplierIds = Array.from(new Set(snapWht.docs.map((d) => d.data().supplierId).filter(Boolean)));
    for (const id of supplierIds) {
      const sup = await getDoc(doc(db, "suppliers", id));
      if (sup.exists()) supplierTaxIds.set(id, String(sup.data().taxId || ""));
    }

    snapWht.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isDeleted === true || data.isSample === true) return;
      // วันที่หักภาษี: issuedAt / filingDate / createdAt ตามเวลาไทย
      const dateStr = toThaiDateStr(data.issuedAt || data.filingDate || data.createdAt);

      if (dateStr.startsWith(yearMonth) || !yearMonth) {
        const taxId = String(data.taxId || supplierTaxIds.get(data.supplierId) || "");
        const isCorp = data.vendorType === "CORPORATE" || (taxId.length === 13 && taxId.startsWith("0"));
        const targetType = isCorp ? "PND53" : "PND3";

        if (whtType === targetType) {
          records.push({
            id: docSnap.id,
            docNo: data.whtId || docSnap.id,
            date: dateStr.split("T")[0],
            vendorName: data.vendor || data.vendorName || "ผู้เสียภาษี",
            taxId: taxId || "0000000000000",
            vendorType: isCorp ? "CORPORATE" : "INDIVIDUAL",
            whtType: targetType,
            incomeType: data.incomeType || "ค่าบริการ / ค่าจ้าง",
            baseAmount: Number(data.baseAmount || 0),
            whtRate: Number(data.whtRate || 3),
            whtAmount: Number(data.whtAmount ?? data.taxAmount ?? 0)
          });
        }
      }
    });
  } catch (err) {
    console.error("Error fetching WHT records:", err);
  }

  return records;
}

/**
 * 3. Lock & Warning Engine to Prevent Duplicate Export Submissions
 */
export async function checkTaxFilingExportLock(
  companyId: string, 
  reportType: "VAT30" | "PND3" | "PND53", 
  yearMonth: string
): Promise<TaxFilingLock | null> {
  const lockId = `${companyId}_${reportType}_${yearMonth}`;
  try {
    const lockRef = doc(db, `companies/${companyId}/tax_filing_locks`, lockId);
    const snap = await getDoc(lockRef);
    if (snap.exists()) {
      return snap.data() as TaxFilingLock;
    }
  } catch (err) {
    console.warn("Check tax filing lock warning:", err);
  }
  return null;
}

export async function lockTaxFilingExport(
  companyId: string, 
  reportType: "VAT30" | "PND3" | "PND53", 
  yearMonth: string,
  userId: string
): Promise<void> {
  const lockId = `${companyId}_${reportType}_${yearMonth}`;
  const lockRef = doc(db, `companies/${companyId}/tax_filing_locks`, lockId);
  const now = new Date().toISOString();

  await setDoc(lockRef, {
    lockId,
    companyId,
    reportType,
    yearMonth,
    exportedAt: now,
    exportedBy: userId,
    isLocked: true
  });

  await auditService.logCreate(
    userId,
    companyId,
    "tax_filing_locks",
    lockId,
    { reportType, yearMonth, exportedAt: now }
  );
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
