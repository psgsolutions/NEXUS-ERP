"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow } from "@/components/ui/Base";
import { apiFetch } from "@/lib/api-client";
import { COST_CATEGORY_TH, costVsBudget, forecastProfit, type BudgetByCategory, type CostLine } from "@/lib/project-costs";

/**
 * ต้นทุนจริงเทียบงบประมาณของโครงการ (ยอดก่อน VAT) — ข้อมูลจากเอกสารต้นทางผ่าน /api/projects/costs
 */

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

export function ProjectCostPanel({ companyId, docId, budget, revenue }: { companyId: string; docId: string; budget: BudgetByCategory; revenue: number }) {
  const [data, setData] = useState<{ lines: CostLine[]; committed: CostLine[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId || !docId) return;
    apiFetch("/api/projects/costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, projectDocId: docId }) })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.success) throw new Error(d.error || "โหลดต้นทุนไม่สำเร็จ"); setData(d); })
      .catch((e) => setError(e.message));
  }, [companyId, docId]);

  const cmp = useMemo(() => (data ? costVsBudget(budget, data.lines, data.committed) : null), [data, budget]);
  const fc = useMemo(() => (cmp ? forecastProfit(revenue, cmp) : null), [cmp, revenue]);

  if (error) return <GlassCard className="p-5 text-danger text-sm">{error}</GlassCard>;
  if (!data || !cmp || !fc) return <GlassCard className="p-5 text-white/50 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> กำลังคำนวณต้นทุนจริง…</GlassCard>;

  const over = (v: number) => (v < -0.009 ? "text-danger" : "text-white");
  const all = [...data.lines.map((l) => ({ ...l, committed: false })), ...data.committed.map((l) => ({ ...l, committed: true }))];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          ["งบต้นทุน", baht(cmp.total.budget), "text-white"],
          ["ต้นทุนจริง", baht(cmp.total.actual), "text-white"],
          ["ผูกพันแล้ว", baht(cmp.total.committed), "text-warning"],
          ["คงเหลือตามงบ", baht(cmp.total.remaining), over(cmp.total.remaining)],
          [`กำไรคาด${fc.percent !== null ? ` ${fc.percent}%` : ""}`, baht(fc.profit), fc.profit < 0 ? "text-danger" : "text-nexus-teal"],
        ].map(([label, v, cls]) => (
          <GlassCard key={label} className="p-4 min-w-0">
            <p className="text-[12px] text-white/50 truncate" title={label}>{label}</p>
            <p className={`text-lg font-bold font-mono mt-1 truncate ${cls}`}>{v}</p>
          </GlassCard>
        ))}
      </div>

      <NexusTable headers={["หมวด", "งบประมาณ", "ผูกพัน", "ต้นทุนจริง", "คงเหลือ", "ใช้ไป (%)"]}>
        {cmp.rows.map((r) => (
          <NexusTableRow key={r.category}>
            <NexusTableCell className="w-full font-bold text-white/85">{r.label}</NexusTableCell>
            <NexusTableCell className="w-[1%] whitespace-nowrap font-mono text-white/70">{baht(r.budget)}</NexusTableCell>
            <NexusTableCell className="w-[1%] whitespace-nowrap font-mono text-warning">{baht(r.committed)}</NexusTableCell>
            <NexusTableCell className="w-[1%] whitespace-nowrap font-mono text-white">{baht(r.actual)}</NexusTableCell>
            <NexusTableCell className={`w-[1%] whitespace-nowrap font-mono ${over(r.remaining)}`}>{baht(r.remaining)}</NexusTableCell>
            <NexusTableCell className={`w-[1%] whitespace-nowrap font-mono ${r.usedPercent !== null && r.usedPercent > 100 ? "text-danger" : "text-white/70"}`}>{r.usedPercent === null ? (r.actual + r.committed > 0 ? "ไม่มีงบ" : "-") : `${r.usedPercent}%`}</NexusTableCell>
          </NexusTableRow>
        ))}
        <NexusTableRow>
          <NexusTableCell className="w-full font-bold text-white">รวม</NexusTableCell>
          <NexusTableCell className="w-[1%] whitespace-nowrap font-mono font-bold text-white">{baht(cmp.total.budget)}</NexusTableCell>
          <NexusTableCell className="w-[1%] whitespace-nowrap font-mono font-bold text-warning">{baht(cmp.total.committed)}</NexusTableCell>
          <NexusTableCell className="w-[1%] whitespace-nowrap font-mono font-bold text-white">{baht(cmp.total.actual)}</NexusTableCell>
          <NexusTableCell className={`w-[1%] whitespace-nowrap font-mono font-bold ${over(cmp.total.remaining)}`}>{baht(cmp.total.remaining)}</NexusTableCell>
          <NexusTableCell className="w-[1%] whitespace-nowrap font-mono font-bold text-white/70">{cmp.total.usedPercent === null ? "-" : `${cmp.total.usedPercent}%`}</NexusTableCell>
        </NexusTableRow>
      </NexusTable>

      <GlassCard className="p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold text-white">รายการต้นทุน ({all.length})</h3>
          <p className="text-[12px] text-white/45">ยอดก่อน VAT · ใบสั่งซื้อเข้าสต็อกนับเป็นต้นทุนตอนเบิกจากคลังตามใบสั่งขายของโครงการ · ใบเบิกค่าใช้จ่ายนับเมื่อระบุโครงการ</p>
        </div>
        <NexusTable headers={["วันที่", "หมวด", "ที่มา", "เลขที่เอกสาร", "รายละเอียด", "จำนวนเงิน"]}>
          {all.length === 0 ? (
            <NexusTableRow><NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ยังไม่มีต้นทุนจริง</NexusTableCell></NexusTableRow>
          ) : all.map((l, i) => (
            <NexusTableRow key={`${l.docNo}-${i}`}>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-white/60">{thDate(l.date)}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-white/70">{COST_CATEGORY_TH[l.category]}</NexusTableCell>
              <NexusTableCell className={`w-[1%] whitespace-nowrap ${l.committed ? "text-warning" : "text-white/70"}`}>{l.source}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap font-mono text-nexus-blue">{l.docNo}</NexusTableCell>
              <NexusTableCell className="w-full text-white/80">{l.description || "-"}</NexusTableCell>
              <NexusTableCell className={`w-[1%] whitespace-nowrap font-mono ${l.committed ? "text-warning" : "text-white"}`}>{baht(l.amount)}</NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      </GlassCard>
    </div>
  );
}
