import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { balanceSheet, generalLedger, monthEnd, postingLines, profitAndLoss, trialBalance } from "@/lib/financial-reports";
import { inputVatRows, outputVatRows, vatTotals } from "@/lib/vat-reports";
import { buildWhtRecords, computePP30 } from "@/lib/tax-calc";
import { getRecords } from "@/lib/master-store.server";
import { cashFlow, salesProfit } from "@/lib/management-reports";

/**
 * [API-SERVER] รายงานบัญชีและภาษี (คำนวณที่ server จากข้อมูลจริง)
 * Endpoint: POST /api/reports/financial
 * body: { companyId, report, from?: "YYYY-MM", to?: "YYYY-MM", account? }
 *  report: "tb" งบทดลอง | "gl" บัญชีแยกประเภท | "pl" งบกำไรขาดทุน | "bs" งบแสดงฐานะการเงิน (ณ สิ้นเดือน to)
 *          "cf" งบกระแสเงินสด | "sales-customer" / "sales-product" ยอดขายและกำไรขั้นต้น รายลูกค้า/รายสินค้า (ช่วงเดือน)
 *          "vat-out" รายงานภาษีขาย | "vat-in" รายงานภาษีซื้อ | "pnd3" / "pnd53" รายงานภาษีหัก ณ ที่จ่าย (เดือน to)
 * - เฉพาะผู้มีสิทธิ์ finance:view; งบการเงินใช้รายการที่ลงบัญชีแล้วเท่านั้น
 */

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const REPORTS = ["tb", "gl", "pl", "bs", "cf", "sales-customer", "sales-product", "vat-out", "vat-in", "pnd3", "pnd53"] as const;
type Report = (typeof REPORTS)[number];
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:view")) throw new ApiAuthError(403, "รายงานบัญชีเปิดได้เฉพาะฝ่ายบัญชีและผู้บริหาร");

    const report = String(body.report || "") as Report;
    if (!REPORTS.includes(report)) throw new ApiAuthError(400, "ไม่พบรายงานที่ต้องการ");
    const to = YM.test(String(body.to || "")) ? String(body.to) : thisMonth();
    const from = YM.test(String(body.from || "")) ? String(body.from) : to;
    if (from > to) throw new ApiAuthError(400, "ช่วงเวลาไม่ถูกต้อง (เดือนเริ่มต้องไม่เกินเดือนสิ้นสุด)");
    const fromDate = `${from}-01`, toDate = monthEnd(to);
    const col = (c: string) => adminDb.collection(`companies/${companyId}/${c}`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    // สมุดรายวันอยู่ใต้บริษัทที่เดียว (root journal_entries ว่างแล้ว ตรวจ 2026-10-30)
    const journals = () => col("journal_entries");
    const base = { success: true, report, from, to, fromDate, toDate, generatedAt: new Date().toISOString() };

    if (report === "cf") {
      const { lines, draftCount, undatedCount } = postingLines(await journals());
      return NextResponse.json({ ...base, draftCount, undatedCount, ...cashFlow(lines, fromDate, toDate) });
    }
    if (report === "sales-customer" || report === "sales-product") {
      const [invoices, notes] = await Promise.all([col("invoices"), col("cndn")]);
      return NextResponse.json({ ...base, ...salesProfit(invoices, notes, fromDate, toDate, report === "sales-customer" ? "customer" : "product") });
    }

    if (report === "tb" || report === "gl" || report === "pl" || report === "bs") {
      const { lines, draftCount, undatedCount } = postingLines(await journals());
      const meta = { ...base, draftCount, undatedCount };
      if (report === "tb") return NextResponse.json({ ...meta, ...trialBalance(lines, fromDate, toDate) });
      if (report === "pl") return NextResponse.json({ ...meta, ...profitAndLoss(lines, fromDate, toDate) });
      if (report === "bs") return NextResponse.json({ ...meta, asOf: toDate, ...balanceSheet(lines, toDate) });
      const account = String(body.account || "").trim();
      const accounts = Array.from(new Map(lines.map((l) => [l.code, l.name])).entries()).sort(([a], [b]) => a.localeCompare(b)).map(([code, name]) => ({ code, name }));
      if (!account) return NextResponse.json({ ...meta, accounts, ledger: null });
      return NextResponse.json({ ...meta, accounts, ledger: generalLedger(lines, account, fromDate, toDate) });
    }

    // รายงานภาษี: รายเดือน (เดือน to)
    const month = to;
    if (report === "vat-out" || report === "vat-in") {
      const [allJournals, invoices] = await Promise.all([journals(), col("invoices")]);
      const pp30 = computePP30(companyId, month, allJournals, invoices);
      let rows;
      if (report === "vat-out") {
        const [cndns, receipts] = await Promise.all([col("cndn"), col("receipts")]);
        rows = outputVatRows(invoices, cndns, month, receipts);
      } else {
        const [expenses, payments] = await Promise.all([col("expenses"), col("payments")]);
        const supplierIds = Array.from(new Set([...expenses.map((e) => e.supplierId), ...payments.map((p) => p.supplierId)].filter(Boolean).map(String)));
        const taxIds = new Map(Array.from((await getRecords("suppliers", companyId, supplierIds)).entries()).map(([id, d]) => [id, String(d.taxId || d.tax_id || "")]));
        rows = inputVatRows(expenses, payments, taxIds, month);
      }
      const totals = vatTotals(rows);
      // ตรวจทานกับสมุดรายวัน (ยอดเดียวกับที่ใช้ยื่น ภ.พ.30)
      const ledgerVat = report === "vat-out" ? pp30.outputVat : pp30.inputVat;
      return NextResponse.json({ ...base, month, rows, totals, ledgerVat, difference: Math.round((totals.vat - ledgerVat) * 100) / 100 });
    }

    const whtType = report === "pnd3" ? "PND3" : "PND53";
    const wht = await col("withholding_taxes");
    const supplierIds = Array.from(new Set(wht.map((w) => w.supplierId).filter(Boolean).map(String)));
    const taxIds = new Map(Array.from((await getRecords("suppliers", companyId, supplierIds)).entries()).map(([id, d]) => [id, String(d.taxId || d.tax_id || "")]));
    const rows = buildWhtRecords(wht.map((w) => ({ id: w.id, data: w })), taxIds, month, whtType).sort((a, b) => a.date.localeCompare(b.date));
    const totals = {
      count: rows.length,
      base: Math.round(rows.reduce((s, r) => s + r.baseAmount, 0) * 100) / 100,
      wht: Math.round(rows.reduce((s, r) => s + r.whtAmount, 0) * 100) / 100,
    };
    return NextResponse.json({ ...base, month, whtType, rows, totals });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[FINANCIAL_REPORT_ERROR]:", error);
    return NextResponse.json({ success: false, error: "สร้างรายงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
