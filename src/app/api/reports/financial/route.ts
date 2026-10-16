import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { balanceSheet, generalLedger, monthEnd, postingLines, profitAndLoss, trialBalance } from "@/lib/financial-reports";
import { inputVatRows, outputVatRows, vatTotals } from "@/lib/vat-reports";
import { buildWhtRecords, computePP30 } from "@/lib/tax-calc";

/**
 * [API-SERVER] รายงานบัญชีและภาษี (คำนวณที่ server จากข้อมูลจริง)
 * Endpoint: POST /api/reports/financial
 * body: { companyId, report, from?: "YYYY-MM", to?: "YYYY-MM", account? }
 *  report: "tb" งบทดลอง | "gl" บัญชีแยกประเภท | "pl" งบกำไรขาดทุน | "bs" งบแสดงฐานะการเงิน (ณ สิ้นเดือน to)
 *          "vat-out" รายงานภาษีขาย | "vat-in" รายงานภาษีซื้อ | "pnd3" / "pnd53" รายงานภาษีหัก ณ ที่จ่าย (เดือน to)
 * - เฉพาะผู้มีสิทธิ์ finance:view; งบการเงินใช้รายการที่ลงบัญชีแล้วเท่านั้น
 */

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const REPORTS = ["tb", "gl", "pl", "bs", "vat-out", "vat-in", "pnd3", "pnd53"] as const;
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
    const journals = async () => [
      ...(await col("journal_entries")),
      ...(await adminDb.collection("journal_entries").where("companyId", "==", companyId).get()).docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
    ];
    const base = { success: true, report, from, to, fromDate, toDate, generatedAt: new Date().toISOString() };

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
        rows = outputVatRows(invoices, await col("cndn"), month);
      } else {
        const [expenses, payments] = await Promise.all([col("expenses"), col("payments")]);
        const supplierIds = Array.from(new Set([...expenses.map((e) => e.supplierId), ...payments.map((p) => p.supplierId)].filter(Boolean).map(String)));
        const sups = supplierIds.length ? await adminDb.getAll(...supplierIds.map((id) => adminDb.doc(`suppliers/${id}`))) : [];
        const taxIds = new Map(sups.filter((d) => d.exists && d.data()!.companyId === companyId).map((d) => [d.id, String(d.data()!.taxId || "")]));
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
    const sups = supplierIds.length ? await adminDb.getAll(...supplierIds.map((id) => adminDb.doc(`suppliers/${id}`))) : [];
    const taxIds = new Map(sups.filter((d) => d.exists && d.data()!.companyId === companyId).map((d) => [d.id, String(d.data()!.taxId || "")]));
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
