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

/** รายการบัญชีของบริษัท (root journal_entries ว่างแล้ว — ไม่อ่านซ้ำ เหมือนรายงานฝั่ง server, C-09) */
async function fetchCompanyJournalEntries(companyId: string): Promise<any[]> {
  return (await getDocs(collection(db, `companies/${companyId}/journal_entries`))).docs.map((d) => d.data());
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
 * 4. \u0E44\u0E1F\u0E25\u0E4C CSV (UTF-8 \u0E21\u0E35 BOM \u0E43\u0E2B\u0E49 Excel \u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E14\u0E49) \u2014 \u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E04\u0E23\u0E2D\u0E1A\u0E14\u0E49\u0E27\u0E22 "\u2026" \u0E41\u0E25\u0E30 " \u0E43\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19 "" (\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E48\u0E21\u0E35\u0E08\u0E38\u0E25\u0E20\u0E32\u0E04/\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22\u0E04\u0E33\u0E1E\u0E39\u0E14\u0E44\u0E21\u0E48\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19)
 */
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
/** \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E1A\u0E1A RD Prep: \u0E27\u0E27/\u0E14\u0E14/\u0E1B\u0E1B\u0E1B\u0E1B (\u0E1E.\u0E28.) */
const thaiDmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return y && m && d ? `${d}/${m}/${Number(y) + 543}` : iso; };

export function exportPP30ToCSV(data: PP30TaxData): string {
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

  return csv(rows);
}

/**
 * \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E41\u0E19\u0E1A \u0E20.\u0E07.\u0E14.3 / \u0E20.\u0E07.\u0E14.53 \u2014 \u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C\u0E15\u0E32\u0E21\u0E25\u0E33\u0E14\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E42\u0E1B\u0E23\u0E41\u0E01\u0E23\u0E21 RD Prep \u0E02\u0E2D\u0E07\u0E01\u0E23\u0E21\u0E2A\u0E23\u0E23\u0E1E\u0E32\u0E01\u0E23\u0E43\u0E0A\u0E49\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32
 * (\u0E40\u0E25\u0E02\u0E1C\u0E39\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E20\u0E32\u0E29\u0E35 \u0E2A\u0E32\u0E02\u0E32 \u0E0A\u0E37\u0E48\u0E2D \u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22 \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49 \u0E2D\u0E31\u0E15\u0E23\u0E32 \u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19 \u0E20\u0E32\u0E29\u0E35 \u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02) + \u0E40\u0E25\u0E02\u0E17\u0E35\u0E48\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E41\u0E25\u0E30\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E15\u0E23\u0E27\u0E08
 * \u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02 1 = \u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22 \u00B7 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E25\u0E02\u0E1C\u0E39\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E20\u0E32\u0E29\u0E35 13 \u0E2B\u0E25\u0E31\u0E01 = \u0E40\u0E27\u0E49\u0E19\u0E27\u0E48\u0E32\u0E07\u0E41\u0E25\u0E30\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38\u0E43\u0E2B\u0E49\u0E41\u0E01\u0E49\u0E01\u0E48\u0E2D\u0E19\u0E22\u0E37\u0E48\u0E19 (\u0E44\u0E21\u0E48\u0E43\u0E2A\u0E48\u0E40\u0E25\u0E02\u0E2A\u0E21\u0E21\u0E38\u0E15\u0E34)
 */
export function exportWHTToCSV(records: WHTTaxRecord[], whtType: "PND3" | "PND53", yearMonth: string): string {
  const title = whtType === "PND3" ? "รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 (บุคคลธรรมดา)" : "รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.53 (นิติบุคคล)";
  const headers = [
    "ลำดับ", "เลขประจำตัวผู้เสียภาษี", "สาขา", "ชื่อผู้มีเงินได้", "ที่อยู่", "วันที่จ่าย",
    "ประเภทเงินได้", "อัตราภาษี (%)", "จำนวนเงินที่จ่าย (บาท)", "ภาษีที่หักและนำส่ง (บาท)", "เงื่อนไข", "เลขที่เอกสาร", "หมายเหตุ",
  ];
  const rows = records.map((r, idx) => [
    idx + 1,
    r.missingTaxId ? "" : r.taxId.replace(/\D/g, ""),
    r.branchCode || (whtType === "PND53" ? "00000" : ""),
    r.vendorName,
    r.address || "",
    thaiDmy(r.date),
    r.incomeType,
    r.whtRate,
    r.baseAmount.toFixed(2),
    r.whtAmount.toFixed(2),
    1,
    r.docNo,
    r.missingTaxId ? "ไม่มีเลขผู้เสียภาษี 13 หลัก — แก้ที่ข้อมูลคู่ค้าก่อนยื่น" : "",
  ]);
  const totalBase = records.reduce((s, r) => s + r.baseAmount, 0);
  const totalWht = records.reduce((s, r) => s + r.whtAmount, 0);
  return csv([
    [title, `ประจำงวด: ${yearMonth}`],
    [],
    headers,
    ...rows,
    [],
    ["รวมทั้งสิ้น", "", "", "", "", "", "", "", totalBase.toFixed(2), totalWht.toFixed(2), "", "", ""],
  ]);
}
