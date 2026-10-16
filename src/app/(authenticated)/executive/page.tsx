"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Banknote, FileClock, HandCoins, Loader2, ReceiptText, RefreshCw, ShoppingBasket, TrendingUp, Wallet } from "lucide-react";
import { GlassCard, MasterMetricCard, PillButton, cn } from "@/components/ui/Base";
import { RevenueExpenseChart } from "@/components/dashboard/RevenueExpenseChart";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { compactBaht, fullBaht, type MonthlyPL } from "@/lib/dashboard-metrics";
import type { AgingSummary } from "@/lib/executive-metrics";

interface ExecutiveReport {
  generatedAt: string;
  cash: { cash: number; bank: number; total: number };
  profit: {
    months: MonthlyPL[];
    thisMonth: { label: string; revenue: number; expense: number; profit: number };
    ytdRevenue: number;
    ytdExpense: number;
    ytdProfit: number;
    draftJournals: number;
  };
  receivables: AgingSummary;
  payables: AgingSummary;
  pipeline: Record<"quotations" | "salesOrders" | "purchasePending" | "purchaseOpen", { count: number; amount: number }>;
}

// สีเดียวกับกราฟรายได้ (ลูกหนี้ = ฝั่งรายได้) และค่าใช้จ่าย (เจ้าหนี้ = ฝั่งรายจ่าย)
const AR_COLOR = "#199e70";
const AP_COLOR = "#d95926";

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [data, setData] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/reports/executive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const v = (n: number | undefined) => (loading && !data ? "…" : compactBaht(n || 0));
  const p = data?.profit;
  const margin = p && p.thisMonth.revenue > 0 ? (p.thisMonth.profit / p.thisMonth.revenue) * 100 : null;

  return (
    <div className="px-6 py-3.5 space-y-4 max-w-[1800px] mx-auto">
      {/* หัวเรื่อง */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-nexus-teal/20 border border-nexus-teal/20 rounded-xl flex items-center justify-center shadow-neon-teal">
            <TrendingUp size={22} className="text-nexus-teal" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-white/30 mb-0.5 ml-0.5">ผู้บริหาร</p>
            <h1 className="text-3xl font-bold text-white tracking-tight leading-normal">แดชบอร์ดผู้บริหาร</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-[12px] text-white/40">
              ข้อมูล ณ {new Date(data.generatedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
          <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            รีเฟรช
          </PillButton>
        </div>
      </div>

      {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}

      {/* ตัวเลขหลัก */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div title={data ? `เงินสด ${fullBaht(data.cash.cash)} · เงินฝากธนาคาร ${fullBaht(data.cash.bank)}` : undefined}>
          <MasterMetricCard icon={<Wallet size={24} />} label="เงินสดและเงินฝาก" value={v(data?.cash.total)} color="text-nexus-teal" neon="shadow-neon-teal" className="bg-nexus-teal/[0.1]" onClick={() => router.push("/finance")} />
        </div>
        <div title={data ? `เกินกำหนด ${fullBaht(data.receivables.overdue)} จาก ${data.receivables.count} ใบ` : undefined}>
          <MasterMetricCard icon={<HandCoins size={24} />} label="ลูกหนี้คงค้าง" value={v(data?.receivables.total)} color="text-nexus-blue" neon="shadow-neon-blue" className="bg-nexus-blue/[0.1]" onClick={() => router.push("/finance")} />
        </div>
        <div title={data ? `เกินกำหนด ${fullBaht(data.payables.overdue)} จาก ${data.payables.count} รายการ` : undefined}>
          <MasterMetricCard icon={<ReceiptText size={24} />} label="เจ้าหนี้คงค้าง" value={v(data?.payables.total)} color="text-amber-500" className="bg-amber-500/[0.1]" onClick={() => router.push("/procurement")} />
        </div>
        <div title={p ? `รายได้ ${fullBaht(p.thisMonth.revenue)} · ค่าใช้จ่าย ${fullBaht(p.thisMonth.expense)}${margin === null ? "" : ` · อัตรากำไร ${margin.toFixed(1)}%`}` : undefined}>
          <MasterMetricCard icon={<TrendingUp size={24} />} label={`กำไรสุทธิ ${p?.thisMonth.label || "เดือนนี้"}`} value={v(p?.thisMonth.profit)} color={p && p.thisMonth.profit < 0 ? "text-danger" : "text-emerald-400"} className={p && p.thisMonth.profit < 0 ? "bg-danger/[0.1]" : "bg-emerald-500/[0.1]"} />
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* กราฟรายได้-ค่าใช้จ่าย 12 เดือน */}
        <GlassCard accentColor="teal" className="p-5 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
                <Activity size={16} className="text-nexus-teal" />
                รายได้และค่าใช้จ่าย 12 เดือน
              </h3>
              <p className="text-xs text-white/40">
                จากรายการบัญชี (หมวด 4 รายได้ / หมวด 5 ต้นทุนและค่าใช้จ่าย) รวมรายการรอลงบัญชี
                {p && p.draftJournals > 0 ? ` · รอลงบัญชี ${p.draftJournals} รายการ` : ""}
              </p>
            </div>
            {p && (
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-[12px] text-white/40">รายได้สะสมปีนี้</p>
                  <p className="text-lg font-bold font-mono text-white">{fullBaht(p.ytdRevenue)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-white/40">กำไร (ขาดทุน) สะสมปีนี้</p>
                  <p className={cn("text-lg font-bold font-mono", p.ytdProfit < 0 ? "text-danger" : "text-white")}>{fullBaht(p.ytdProfit)}</p>
                </div>
              </div>
            )}
          </div>
          {p ? <RevenueExpenseChart data={p.months} /> : <div className="h-[240px] flex items-center justify-center text-[13px] text-white/40">{loading ? "กำลังโหลด…" : "ไม่มีข้อมูล"}</div>}
        </GlassCard>

        {/* งานที่จะเป็นรายได้/รายจ่าย */}
        <GlassCard accentColor="blue" className="p-5 w-full xl:w-[clamp(320px,28%,440px)] flex-shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide mb-4">
            <FileClock size={16} className="text-nexus-blue" />
            งานที่รอเป็นรายได้และรายจ่าย
          </h3>
          <div className="divide-y divide-white/5">
            <PipelineRow label="ใบเสนอราคาที่ยังเปิดอยู่" item={data?.pipeline.quotations} href="/sales?tab=quotations" />
            <PipelineRow label="ใบสั่งขายที่ยังไม่ออกใบกำกับ" item={data?.pipeline.salesOrders} href="/sales?tab=orders" />
            <PipelineRow label="ใบสั่งซื้อรออนุมัติ" item={data?.pipeline.purchasePending} href="/procurement" warn />
            <PipelineRow label="ใบสั่งซื้อที่ยังไม่ตั้งหนี้" item={data?.pipeline.purchaseOpen} href="/procurement" />
          </div>
        </GlassCard>
      </div>

      {/* อายุลูกหนี้ / เจ้าหนี้ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AgingCard title="อายุลูกหนี้" icon={<Banknote size={16} className="text-nexus-teal" />} color={AR_COLOR} summary={data?.receivables} partyLabel="ลูกค้า" empty="ไม่มีลูกหนี้คงค้าง" />
        <AgingCard title="อายุเจ้าหนี้" icon={<ShoppingBasket size={16} className="text-amber-500" />} color={AP_COLOR} summary={data?.payables} partyLabel="ผู้รับเงิน" empty="ไม่มีเจ้าหนี้คงค้าง" />
      </div>
    </div>
  );
}

function PipelineRow({ label, item, href, warn }: { label: string; item?: { count: number; amount: number }; href: string; warn?: boolean }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push(href)} className="w-full flex items-center justify-between gap-3 py-3 text-left group">
      <span className="min-w-0">
        <span className="block text-[13px] text-white/70 group-hover:text-white truncate">{label}</span>
        <span className="block text-[12px] text-white/40">{item ? `${item.count} ใบ` : "…"}</span>
      </span>
      <span className={cn("text-[15px] font-bold font-mono whitespace-nowrap", warn && item && item.count > 0 ? "text-warning" : "text-white")}>
        {item ? fullBaht(item.amount) : "…"}
      </span>
    </button>
  );
}

/** แท่งยอดตามช่วงอายุหนี้ (สีเดียว ความยาว = ยอดเงิน) + รายชื่อที่ค้างมากสุด */
function AgingCard({ title, icon, color, summary, partyLabel, empty }: { title: string; icon: React.ReactNode; color: string; summary?: AgingSummary; partyLabel: string; empty: string }) {
  const max = Math.max(1, ...(summary?.buckets.map((b) => b.amount) || [0]));
  return (
    <GlassCard accentColor="purple" className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">{icon}{title}</h3>
        {summary && (
          <span className="text-[12px] text-white/50 whitespace-nowrap">
            รวม <span className="font-mono font-bold text-white">{fullBaht(summary.total)}</span>
            {summary.overdue > 0 && <> · เกินกำหนด <span className="font-mono font-bold text-white">{fullBaht(summary.overdue)}</span></>}
          </span>
        )}
      </div>

      {!summary ? (
        <p className="text-[13px] text-white/40 py-6 text-center">กำลังโหลด…</p>
      ) : summary.total <= 0 ? (
        <p className="text-[13px] text-white/40 py-6 text-center">{empty}</p>
      ) : (
        <>
          <div className="space-y-2 mb-5">
            {summary.buckets.map((b) => (
              <div key={b.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-3" title={`${b.label}: ${fullBaht(b.amount)} (${b.count} รายการ)`}>
                <span className="text-[12px] text-white/60 whitespace-nowrap">{b.label}</span>
                <div className="h-3 rounded-[4px] bg-white/[0.04] overflow-hidden">
                  {b.amount > 0 && <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (b.amount / max) * 100)}%`, background: color, opacity: b.key === "current" ? 0.55 : 1 }} />}
                </div>
                <span className="text-[12px] font-mono text-white/80 whitespace-nowrap text-right min-w-[88px]">{fullBaht(b.amount)}</span>
              </div>
            ))}
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-white/40 border-b border-white/10">
                <th className="text-left font-medium py-2">{partyLabel}ที่ค้างมากสุด</th>
                <th className="text-right font-medium py-2 whitespace-nowrap">ยอดค้าง</th>
                <th className="text-right font-medium py-2 whitespace-nowrap">เกินกำหนด</th>
                <th className="text-right font-medium py-2 whitespace-nowrap">ค้างนานสุด</th>
              </tr>
            </thead>
            <tbody>
              {summary.top.map((t) => (
                <tr key={t.name} className="border-b border-white/5">
                  <td className="py-2 text-white/80 truncate max-w-[220px]" title={t.name}>{t.name}</td>
                  <td className="py-2 text-right font-mono text-white/80 whitespace-nowrap">{fullBaht(t.amount)}</td>
                  <td className={cn("py-2 text-right font-mono whitespace-nowrap", t.overdue > 0 ? "text-warning" : "text-white/30")}>{t.overdue > 0 ? fullBaht(t.overdue) : "-"}</td>
                  <td className="py-2 text-right text-white/60 whitespace-nowrap">{t.oldestDays > 0 ? `${t.oldestDays} วัน` : "ยังไม่ถึงกำหนด"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </GlassCard>
  );
}
