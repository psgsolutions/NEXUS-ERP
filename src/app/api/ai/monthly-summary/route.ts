import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { monthEnd, postingLines, profitAndLoss } from "@/lib/financial-reports";
import { cashFlow, findAnomalies, monthSummaryText, salesProfit, type MonthFacts } from "@/lib/management-reports";
import { THAI_MONTHS } from "@/lib/period";
import { journalDateStr } from "@/lib/journal-posting";
import { aiErrorInfo, geminiConfigured, geminiModel, limitAi } from "@/lib/gemini.server";

export const maxDuration = 60;

/**
 * [API-SERVER] สรุปผลประกอบการรายเดือนภาษาไทย — POST /api/ai/monthly-summary { companyId, month?: "YYYY-MM" }
 * ตัวเลขทั้งหมดคำนวณที่ server จากข้อมูลจริง (facts) แล้วให้ AI เรียบเรียงเป็นภาษาไทย ห้ามเพิ่มตัวเลขเอง
 * ไม่มี AI / AI ล้ม = ใช้สรุปแบบกฎจากตัวเลขเดียวกัน · สิทธิ์ dashboard:executive
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const prevOf = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "dashboard:executive")) throw new ApiAuthError(403, "สรุปผลประกอบการเปิดได้เฉพาะผู้บริหาร");
    const thisMonth = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.month || "")) && body.month <= thisMonth ? String(body.month) : prevOf(thisMonth);
    const prev = prevOf(month), from = `${month}-01`, to = monthEnd(month);
    const [y, m] = month.split("-").map(Number);
    const monthLabel = `เดือน${THAI_MONTHS[m - 1]} ${y + 543}`;

    const col = (c: string) => adminDb.collection(`companies/${companyId}/${c}`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    const [journals, invoices, notes, expenses, payments] = await Promise.all([col("journal_entries"), col("invoices"), col("cndn"), col("expenses"), col("payments")]);
    const { lines } = postingLines(journals);
    const sales = salesProfit(invoices, notes, from, to, "customer");
    const salesPrev = salesProfit(invoices, notes, `${prev}-01`, monthEnd(prev), "customer");
    const products = salesProfit(invoices, notes, from, to, "product");
    const pl = profitAndLoss(lines, from, to);
    const cf = cashFlow(lines, from, to);
    const overdue = invoices.filter((i) => i.isDeleted !== true && String(i.status || "").toLowerCase() !== "cancelled" && (Number(i.balance) || 0) > 0.009 && String(i.dueDate || "") && String(i.dueDate) < to);
    const facts: MonthFacts = {
      month, prevMonth: prev,
      sales: sales.totals.revenue, salesPrev: salesPrev.totals.revenue, invoices: new Set(invoices.filter((i) => String(i.issueDate || "").startsWith(month) && i.isDeleted !== true && String(i.status || "").toLowerCase() !== "cancelled").map((i) => i.id)).size,
      grossProfit: sales.totals.profit, grossMargin: sales.totals.margin, costMissing: sales.costMissing,
      postedRevenue: pl.totalRevenue, postedExpense: r2(pl.totalCost + pl.totalExpense), postedNet: pl.netProfit,
      drafts: journals.filter((j) => String(j.status || "").toLowerCase() === "draft" && journalDateStr(j.date || j.createdAt).slice(0, 7) === month).length,
      cashNet: cf.net, cashClosing: cf.closing,
      arOverdue: r2(overdue.reduce((s, i) => s + (Number(i.balance) || 0), 0)), arOverdueCount: overdue.length,
      topCustomers: sales.rows.filter((r) => r.revenue > 0).slice(0, 3).map((r) => ({ name: r.name, revenue: r.revenue })),
      topProducts: products.rows.filter((r) => r.revenue > 0 && !["cn", "dn", "contract"].includes(r.key)).slice(0, 3).map((r) => ({ name: r.name, revenue: r.revenue })),
      anomaliesHigh: findAnomalies({ invoices, expenses, payments, journals }, from, to, companyId).filter((a) => a.severity === "high").length,
    };
    const ruleText = monthSummaryText(facts, monthLabel);

    let text = ruleText, source: "ai" | "rule" = "rule", note = "";
    if (body.ai !== false && geminiConfigured()) {
      try {
        await limitAi(apiUser.uid, "monthly_summary");
        const model = geminiModel({ generationConfig: { temperature: 0.3 }, systemInstruction: [
          "คุณคือผู้ช่วย CFO เขียนสรุปผลประกอบการรายเดือนภาษาไทยให้ผู้บริหาร SME อ่านใน 1 นาที",
          "ใช้เฉพาะตัวเลขใน JSON ที่ให้ ห้ามคำนวณตัวเลขใหม่หรือเดาตัวเลขที่ไม่มี · เขียน 5–8 บรรทัด ขึ้นต้นด้วย • · ปิดท้ายด้วยสิ่งที่ควรทำต่อ 1–2 ข้อ",
          "ยอดขาย/กำไรขั้นต้นมาจากใบกำกับภาษี · รายได้/ค่าใช้จ่าย/กำไรสุทธิมาจากบัญชีที่ลงแล้วเท่านั้น (บอกถ้ามีรายการรออนุมัติ)",
        ].join("\n") });
        const res = await model.generateContent(`สรุป${monthLabel} จากข้อมูลนี้:\n${JSON.stringify(facts)}`);
        const out = res.response.text().trim();
        if (out) { text = out; source = "ai"; }
      } catch (e) { note = aiErrorInfo(e).message; }
    }
    return NextResponse.json({ success: true, month, monthLabel, facts, text, source, ...(note ? { note } : {}) });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[MONTHLY_SUMMARY]", err);
    return NextResponse.json({ success: false, error: "สรุปผลประกอบการไม่สำเร็จ" }, { status: 500 });
  }
}
