import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { agingSummary, cashBalance, payableRows, profitOverview, receivableRows } from "@/lib/executive-metrics";
import { normalizePoStatus } from "@/lib/procurement-status";
import { quotationStage } from "@/lib/quotation-status";

/**
 * [API-SERVER] ภาพรวมการเงินสำหรับผู้บริหาร
 * Endpoint: POST /api/reports/executive  { companyId }
 * - เฉพาะผู้มีสิทธิ์ dashboard:executive
 * - คำนวณที่ server จากข้อมูลจริง: เงินสด/เงินฝาก ลูกหนี้ เจ้าหนี้ (แยกอายุหนี้) รายได้-ค่าใช้จ่าย-กำไร 12 เดือน และงานที่รอเป็นรายได้/รายจ่าย
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => Number(v) || 0;
const live = (x: any) => x.isDeleted !== true && x.isSample !== true && String(x.status || "").toLowerCase() !== "cancelled";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "dashboard:executive")) throw new ApiAuthError(403, "แดชบอร์ดผู้บริหารเปิดได้เฉพาะผู้บริหาร");

    const col = (c: string) => adminDb.collection(`companies/${companyId}/${c}`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
    // สมุดรายวันอยู่ใต้บริษัทที่เดียว (root journal_entries ว่างแล้ว ตรวจ 2026-10-30)
    const [journals, invoices, expenses, quotations, salesOrders, purchaseOrders] = await Promise.all([
      col("journal_entries"),
      col("invoices"),
      col("expenses"),
      col("quotations"),
      col("sales_orders"),
      col("purchase_orders"),
    ]);
    const allJournals = journals;
    const now = Date.now();

    const profit = profitOverview(allJournals, now);
    const thisMonth = profit.months[profit.months.length - 1];
    const draftJournals = allJournals.filter((j: any) => live(j) && String(j.status || "").toLowerCase() === "draft").length;

    // งานที่จะกลายเป็นรายได้/รายจ่าย
    const openQuotes = quotations.filter((q: any) => live(q) && ["pending", "sent", "draft"].includes(quotationStage(q)));
    const openSOs = salesOrders.filter((s: any) => live(s) && !["COMPLETED", "CANCELLED"].includes(String(s.status || "").toUpperCase()) && !s.invoiceNo);
    const pendingPOs = purchaseOrders.filter((p: any) => live(p) && normalizePoStatus(p.status) === "PENDING_APPROVAL");
    const openPOs = purchaseOrders.filter((p: any) => live(p) && ["APPROVED", "PARTIAL_RECEIVED"].includes(normalizePoStatus(p.status)) && !p.expenseId);
    const sum = (rows: any[], f: (x: any) => number) => r2(rows.reduce((s, x) => s + f(x), 0));

    return NextResponse.json({
      success: true,
      generatedAt: new Date(now).toISOString(),
      cash: cashBalance(allJournals),
      profit: {
        months: profit.months,
        thisMonth: { label: thisMonth.label, revenue: thisMonth.revenue, expense: thisMonth.expense, profit: r2(thisMonth.revenue - thisMonth.expense) },
        ytdRevenue: profit.ytdRevenue,
        ytdExpense: profit.ytdExpense,
        ytdProfit: profit.ytdProfit,
        draftJournals,
      },
      receivables: agingSummary(receivableRows(invoices), now),
      payables: agingSummary(payableRows(expenses), now),
      pipeline: {
        quotations: { count: openQuotes.length, amount: sum(openQuotes, (q) => num(q.grandTotal ?? q.totalAmount)) },
        salesOrders: { count: openSOs.length, amount: sum(openSOs, (s) => num(s.grandTotal ?? s.totalAmount)) },
        purchasePending: { count: pendingPOs.length, amount: sum(pendingPOs, (p) => num(p.totalAmount)) },
        purchaseOpen: { count: openPOs.length, amount: sum(openPOs, (p) => num(p.totalAmount)) },
      },
    });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[EXECUTIVE_REPORT_ERROR]:", error);
    return NextResponse.json({ success: false, error: "โหลดข้อมูลผู้บริหารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
