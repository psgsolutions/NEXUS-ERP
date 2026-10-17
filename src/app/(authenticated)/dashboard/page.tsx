"use client";

import React, { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Package,
  Warehouse,
  Briefcase,
  FolderKanban,
  AlertTriangle,
  Plus,
  ShoppingBasket,
  TrendingUp,
  Activity,
  ChevronRight,
  Bell,
  ArrowUpRight,
  UsersRound,
  CheckCircle2,
  ClipboardList,
  Zap,
} from "lucide-react";
import { PillButton, MasterMetricCard, cn, GlassCard } from "@/components/ui/Base";
import { SystemHealthIndicator } from "@/components/shared/SystemHealthIndicator";
import { RevenueExpenseChart } from "@/components/dashboard/RevenueExpenseChart";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useProducts } from "@/hooks/useProducts";
import { useCompanyProjects } from "@/hooks/useCompanyProjects";
import { normalizePoStatus } from "@/lib/procurement-status";
import {
  activeProjects,
  activityFeed,
  compactBaht,
  fullBaht,
  lastMonthKeys,
  lowStockProducts,
  monthlyProfitAndLoss,
  overdueInvoices,
  PROJECT_STATUS_LABEL,
  relativeTimeTh,
  type ActivityKind,
} from "@/lib/dashboard-metrics";
import Link from "next/link";
import { quotationStage } from "@/lib/quotation-status";
import { useRouter } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";

const upper = (s: any) => String(s || "").toUpperCase();

export default function DashboardPage() {
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const has = (perm: Permission) => can(roles, perm);
  // ตัวเลขการเงิน (รายได้ กำไร ลูกหนี้) เห็นเฉพาะฝ่ายบัญชี/ผู้บริหาร — ไม่โหลดข้อมูลเลยถ้าไม่มีสิทธิ์
  const seeMoney = has("finance:view");
  const seeStock = has("inventory:view") || has("procurement:view");
  const co = (sub: string, allowed = true) => (companyId && allowed ? `companies/${companyId}/${sub}` : "");

  // ข้อมูลจริงของบริษัท (useRealtimeCollection กรองตาม companyId ให้อัตโนมัติ)
  const { data: companyJournals, loading: journalsLoading } = useRealtimeCollection<any>(co("journal_entries", seeMoney));
  const { data: legacyJournals } = useRealtimeCollection<any>(seeMoney ? "journal_entries" : "");
  const { data: products, loading: productsLoading } = useProducts<any>();
  const { data: allProjects } = useCompanyProjects();
  const { data: invoices } = useRealtimeCollection<any>(co("invoices", seeMoney));
  const { data: purchaseOrders } = useRealtimeCollection<any>(co("purchase_orders"));
  const { data: purchaseRequests } = useRealtimeCollection<any>(co("purchase_requests"));
  const { data: quotations } = useRealtimeCollection<any>(co("quotations"));
  const { data: workOrders } = useRealtimeCollection<any>(co("work_orders"));
  const { data: logs, loading: logsLoading } = useRealtimeCollection<any>(has("logs:view") ? "logs" : "");

  const journals = useMemo(() => [...companyJournals, ...legacyJournals], [companyJournals, legacyJournals]);
  const months = useMemo(() => lastMonthKeys(6), []);
  const monthly = useMemo(() => monthlyProfitAndLoss(journals, months), [journals, months]);
  const thisMonth = monthly[monthly.length - 1];
  const margin = thisMonth && thisMonth.revenue > 0 ? ((thisMonth.revenue - thisMonth.expense) / thisMonth.revenue) * 100 : null;

  const lowStock = useMemo(() => lowStockProducts(products), [products]);
  const projects = useMemo(
    () => activeProjects(allProjects).filter((p) => !p.isSample),
    [allProjects]
  );
  const overdue = useMemo(() => overdueInvoices(invoices), [invoices]);
  const feed = useMemo(() => activityFeed(logs, 8), [logs]);

  // งานรอดำเนินการ (นับเอกสารตัวอย่างแยกไว้ให้เห็น)
  const pending = useMemo(() => {
    const count = (list: any[], pred: (x: any) => boolean) => {
      const hit = list.filter((x) => x.isDeleted !== true && pred(x));
      return { total: hit.length, samples: hit.filter((x) => x.isSample).length };
    };
    const rows = [
      { show: has("procurement:approve"), label: "ใบขอซื้อรออนุมัติ", href: "/procurement", ...count(purchaseRequests, (x) => upper(x.status) === "PENDING_APPROVAL") },
      { show: has("procurement:approve"), label: "ใบสั่งซื้อรออนุมัติ", href: "/procurement", ...count(purchaseOrders, (x) => normalizePoStatus(x.status) === "PENDING_APPROVAL") },
      { show: has("sales:approve") || has("sales:edit"), label: "ใบเสนอราคารออนุมัติ", href: "/sales?tab=quotations&status=pending", ...count(quotations, (x) => quotationStage(x) === "pending") },
      { show: has("finance:post"), label: "รายการบัญชีรอลงบัญชี", href: "/finance", ...count(journals, (x) => String(x.status || "").toLowerCase() === "draft") },
      { show: has("service:field") || has("projects:edit"), label: "ใบงานช่างที่ยังเปิดอยู่", href: "/mobile/technician/work-orders", ...count(workOrders, (x) => ["ASSIGNED", "IN_PROGRESS"].includes(upper(x.status))) },
    ];
    return rows.filter((r) => r.show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseRequests, purchaseOrders, quotations, journals, workOrders, roles]);
  const pendingTotal = pending.reduce((s, p) => s + p.total, 0);

  // เรื่องที่ควรดำเนินการก่อน (เรียงตามความเร่งด่วน)
  const attention = useMemo(() => {
    const items: { text: React.ReactNode; href: string; action: string }[] = [];
    if (overdue.length > 0) {
      const amount = overdue.reduce((s, inv) => s + (Number(inv.balance ?? inv.grandTotal ?? inv.totalAmount) || 0), 0);
      items.push({
        text: <>มีใบแจ้งหนี้เกินกำหนดชำระ <span className="text-danger">{overdue.length} ใบ</span> รวม {fullBaht(amount)}</>,
        href: "/finance",
        action: "ติดตามหนี้",
      });
    }
    if (seeStock && lowStock.length > 0) {
      const top = lowStock[0];
      items.push({
        text: <>สินค้าต่ำกว่าจุดสั่งซื้อ <span className="text-warning">{lowStock.length} รายการ</span> เช่น {top.name} เหลือ {top.onHand} {top.unit} (จุดสั่งซื้อ {top.min})</>,
        href: "/procurement/requests/new",
        action: "เปิดใบขอซื้อ",
      });
    }
    // ไม่นับเอกสารตัวอย่างเป็นงานที่ต้องทำจริง
    const approvals = pending.filter((p) => p.label.includes("รออนุมัติ") && p.total - p.samples > 0);
    if (approvals.length > 0) {
      items.push({
        text: <>มีเอกสารรออนุมัติ {approvals.map((p) => `${p.label.replace("รออนุมัติ", "")} ${p.total - p.samples}`).join(", ")}</>,
        href: approvals[0].href,
        action: "ตรวจอนุมัติ",
      });
    }
    return items;
  }, [overdue, lowStock, pending, seeStock]);

  const loadingMoney = journalsLoading;
  const kpiValue = (v: string) => (loadingMoney ? "…" : v);

  return (
    <div className="px-6 py-3.5 space-y-4 max-w-[1800px] mx-auto">

      {/* --- TOP COMMAND HEADER --- */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <SystemHealthIndicator />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-nexus-teal/20 border border-nexus-teal/20 rounded-xl flex items-center justify-center shadow-neon-teal">
              <Zap size={22} className="text-nexus-teal drop-shadow-md" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-white/20 uppercase tracking-[0.2em] mb-0.5 ml-0.5">หน้าแรก</p>
              <h1 className="text-3xl font-bold text-white tracking-tighter leading-none uppercase">ภาพรวมระบบ</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn("relative", isCreateMenuOpen && "z-[99999]")}>
            <PillButton className="px-8 shadow-neon-teal" onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}>
              <Plus size={18} className={cn("transition-transform", isCreateMenuOpen && "rotate-45")} />
              สร้างรายการใหม่
            </PillButton>

            {isCreateMenuOpen && (
              <div className="absolute top-full right-0 mt-3 w-56 bg-surface-0/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[99999]">
                <div className="p-2 space-y-1">
                  {[
                    { href: "/projects/new", label: "โครงการใหม่", icon: <FolderKanban size={16} className="group-hover:text-nexus-blue" /> },
                    { href: "/sales/quotations/new", label: "ใบเสนอราคา", icon: <BadgeDollarSign size={16} className="group-hover:text-nexus-teal" /> },
                    { href: "/procurement/orders/new", label: "ใบสั่งซื้อ", icon: <ShoppingBasket size={16} className="group-hover:text-warning" /> },
                    { href: "/customers/new", label: "เพิ่มลูกค้าใหม่", icon: <UsersRound size={16} className="group-hover:text-nexus-teal" /> },
                  ].map((m) => (
                    <div
                      key={m.href}
                      onClick={() => router.push(m.href)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer text-white/70 hover:text-white transition-colors group"
                    >
                      {m.icon}
                      <span className="text-sm font-bold uppercase tracking-widest">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- TOP METRICS & QUICK ACTIONS --- */}
      <div className="flex flex-col 2xl:flex-row justify-between w-full gap-4 2xl:gap-5">

        {/* HERO METRICS */}
        <div className={cn("grid grid-cols-2 gap-4 flex-1", seeMoney ? "md:grid-cols-4" : "md:grid-cols-2")}>
          {seeMoney && <div className="w-full" title={thisMonth ? `รายได้เดือน ${thisMonth.label}: ${fullBaht(thisMonth.revenue)}` : undefined}>
            <MasterMetricCard
              icon={<BadgeDollarSign size={24} />}
              label="รายได้เดือนนี้"
              value={kpiValue(compactBaht(thisMonth?.revenue || 0))}
              color="text-nexus-teal"
              neon="shadow-neon-teal"
              onClick={() => router.push("/finance")}
              className="bg-nexus-teal/[0.1]"
            />
          </div>}
          {seeMoney && <div className="w-full" title="กำไรสุทธิเดือนนี้ = (รายได้ - ต้นทุนและค่าใช้จ่าย) / รายได้">
            <MasterMetricCard
              icon={<TrendingUp size={24} />}
              label="กำไรสุทธิเดือนนี้"
              value={kpiValue(margin === null ? "-" : `${margin.toFixed(1)}%`)}
              color="text-nexus-blue"
              neon="shadow-neon-blue"
              onClick={() => router.push("/finance")}
              className="bg-nexus-blue/[0.1]"
            />
          </div>}
          {has("projects:view") && <div className="w-full" title="โครงการที่ยังไม่ปิด">
            <MasterMetricCard
              icon={<FolderKanban size={24} />}
              label="โครงการที่ดำเนินอยู่"
              value={`${projects.length} งาน`}
              color="text-amber-500"
              onClick={() => router.push("/projects")}
              className="bg-amber-500/[0.1]"
            />
          </div>}
          {(seeStock || seeMoney) && <div className="w-full" title={seeMoney ? "สินค้าต่ำกว่าจุดสั่งซื้อ + ใบแจ้งหนี้เกินกำหนด" : "สินค้าต่ำกว่าจุดสั่งซื้อ"}>
            <MasterMetricCard
              icon={<AlertTriangle size={24} />}
              label="จุดวิกฤต"
              value={productsLoading ? "…" : `${(seeStock ? lowStock.length : 0) + overdue.length} จุด`}
              color="text-danger"
              onClick={() => router.push(overdue.length > 0 ? "/finance" : "/inventory")}
              className="bg-danger/[0.1]"
            />
          </div>}
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-4 gap-3 2xl:flex 2xl:flex-nowrap 2xl:w-auto">
          {has("sales:edit") && <div className="w-full 2xl:w-[110px]">
            <QuickActionCard icon={<BadgeDollarSign size={16} />} label="เสนอราคา" color="text-nexus-teal bg-nexus-teal/20" link="/sales/quotations/new" />
          </div>}
          {has("inventory:view") && <div className="w-full 2xl:w-[110px]">
            <QuickActionCard icon={<Warehouse size={16} />} label="คลังสินค้า" color="text-nexus-blue bg-nexus-blue/20" link="/inventory" />
          </div>}
          {has("sales:view") && <div className="w-full 2xl:w-[110px]">
            <QuickActionCard icon={<UsersRound size={16} />} label="ลูกค้า" color="text-amber-500 bg-amber-500/20" link="/customers" />
          </div>}
          {has("procurement:edit") && <div className="w-full 2xl:w-[110px]">
            <QuickActionCard icon={<ShoppingBasket size={16} />} label="สั่งซื้อ" color="text-rose-500 bg-rose-500/20" link="/procurement/orders/new" />
          </div>}
        </div>
      </div>

      {/* --- MAIN OPERATIONAL LAYER --- */}
      <div className="flex flex-col xl:flex-row gap-5">

        {/* LEFT: PERFORMANCE & GRAPHS */}
        <div className="flex-1 space-y-3 min-w-0">

          {/* เรื่องที่ต้องดำเนินการ (คำนวณจากข้อมูลจริง) */}
          <div className={cn(
            "border rounded-xl p-5 flex items-center gap-5 relative overflow-hidden",
            attention.length > 0 ? "bg-warning/5 border-warning/20" : "bg-nexus-teal/5 border-nexus-teal/20"
          )}>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0",
              attention.length > 0 ? "bg-warning/15 text-warning border-warning/30" : "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/30"
            )}>
              {attention.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={cn("text-[13px] font-medium uppercase tracking-[0.15em] mb-1", attention.length > 0 ? "text-warning" : "text-nexus-teal")}>
                สิ่งที่ต้องดำเนินการ{attention.length > 1 ? ` (${attention.length} เรื่อง)` : ""}
              </h3>
              <p className="text-[15px] font-bold text-white leading-relaxed">
                {productsLoading ? "กำลังตรวจสอบข้อมูล…" : attention.length > 0 ? attention[0].text : "ไม่มีเรื่องเร่งด่วนในส่วนงานของคุณ"}
              </p>
              {attention.length > 1 && (
                <ul className="mt-1 space-y-0.5">
                  {attention.slice(1).map((a, i) => (
                    <li key={i} className="text-[13px] text-white/50">
                      <Link href={a.href} className="hover:text-white">• {a.text}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {attention.length > 0 && (
              <PillButton variant="glass" onClick={() => router.push(attention[0].href)} className="hidden md:flex border-warning/30 text-warning px-5 text-[12px] shrink-0">
                {attention[0].action}
              </PillButton>
            )}
          </div>

          {/* รายได้และค่าใช้จ่าย 6 เดือน (ฝ่ายบัญชี/ผู้บริหาร) */}
          {seeMoney && <GlassCard accentColor="teal" className="p-5 relative">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2 tracking-[0.15em]">
                  <Activity size={16} className="text-nexus-teal" />
                  รายได้และค่าใช้จ่ายรายเดือน
                </h3>
                <p className="text-xs text-white/40">6 เดือนล่าสุด จากรายการบัญชี (หมวด 4 รายได้ / หมวด 5 ต้นทุนและค่าใช้จ่าย) รวมรายการรอลงบัญชี</p>
              </div>
              {thisMonth && (
                <div className="text-right">
                  <p className="text-[12px] text-white/40">กำไร (ขาดทุน) {thisMonth.label}</p>
                  <p className={cn("text-xl font-bold font-mono", thisMonth.revenue - thisMonth.expense < 0 ? "text-danger" : "text-white")}>
                    {fullBaht(thisMonth.revenue - thisMonth.expense)}
                  </p>
                </div>
              )}
            </div>
            <RevenueExpenseChart data={monthly} />
          </GlassCard>}

          {/* Bottom Operational Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {has("projects:view") && <GlassCard accentColor="blue" className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-3">
                  <Briefcase size={16} className="text-nexus-blue" />
                  ความคืบหน้าโครงการ
                </h3>
                <Link href="/projects" className="text-xs font-bold text-white/40 hover:text-white">ดูทั้งหมด</Link>
              </div>
              <div className="space-y-4">
                {projects.length === 0 && <p className="text-[13px] text-white/40 py-6 text-center">ยังไม่มีโครงการที่ดำเนินอยู่</p>}
                {projects.slice(0, 4).map((p) => {
                  const late = p.deadlineMs > 0 && p.deadlineMs < Date.now() && p.progress < 100;
                  return (
                    <ProjectProgressRow
                      key={p.id}
                      href={`/projects/${encodeURIComponent(p.id)}`}
                      name={p.name}
                      code={p.code}
                      progress={p.progress}
                      status={late ? "เลยกำหนด" : PROJECT_STATUS_LABEL[p.status]}
                      isRisk={late}
                    />
                  );
                })}
              </div>
            </GlassCard>}

            {seeStock && <GlassCard accentColor="purple" className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-3">
                  <Package size={16} className="text-nexus-teal" />
                  สินค้าต่ำกว่าจุดสั่งซื้อ
                </h3>
                <span className="text-xs font-bold text-white/40">{lowStock.length} รายการ</span>
              </div>
              <div className="space-y-2">
                {!productsLoading && lowStock.length === 0 && (
                  <p className="text-[13px] text-white/40 py-6 text-center">สต็อกทุกรายการอยู่เหนือจุดสั่งซื้อ</p>
                )}
                {lowStock.slice(0, 4).map((s) => (
                  <StockAlertRow key={s.id} item={s.name} sku={s.sku} stock={s.onHand} min={s.min} unit={s.unit} />
                ))}
              </div>
              <PillButton variant="glass" onClick={() => router.push("/inventory")} className="w-full mt-5 border-white/10 hover:border-nexus-teal text-white text-xs font-bold uppercase tracking-widest">
                ดูสต็อกทั้งหมด
                <ChevronRight size={14} className="ml-2" />
              </PillButton>
            </GlassCard>}
          </div>
        </div>

        {/* RIGHT: TACTICAL SIDEBAR */}
        <div className="w-full xl:w-[clamp(320px,30%,476px)] flex-shrink-0 space-y-4">
          {/* กิจกรรมล่าสุด จากบันทึกระบบ (ผู้มีสิทธิ์ดูบันทึก) */}
          {has("logs:view") && <GlassCard accentColor="amber" className="flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.04] gap-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-3 min-w-0">
                <Bell size={16} className="text-warning flex-shrink-0" />
                <span>กิจกรรมล่าสุด</span>
              </h3>
            </div>

            <div className="flex-1">
              {!logsLoading && feed.length === 0 && <p className="text-[13px] text-white/40 py-10 text-center">ยังไม่มีบันทึกกิจกรรม</p>}
              {feed.map((f) => (
                <TacticalLogItem key={f.id} kind={f.kind} msg={f.message} time={relativeTimeTh(f.atMs)} />
              ))}
            </div>

            <Link href="/logs" className="w-full py-4 px-4 text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2 border-t border-white/5">
              ดูประวัติระบบทั้งหมด <ArrowUpRight size={14} className="flex-shrink-0" />
            </Link>
          </GlassCard>}

          {/* งานรอดำเนินการ */}
          {pending.length > 0 && <GlassCard accentColor="emerald" className="p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-3">
                <ClipboardList size={16} className="text-nexus-blue" />
                งานรอดำเนินการ
              </h3>
              <span className="text-2xl font-bold text-white font-mono">{pendingTotal}</span>
            </div>
            <div className="divide-y divide-white/5">
              {pending.map((p) => (
                <Link key={p.label} href={p.href} className="flex items-center justify-between py-2.5 group">
                  <span className="text-[13px] text-white/70 group-hover:text-white">
                    {p.label}
                    {p.samples > 0 && <span className="text-[11px] text-white/30 ml-1.5">(ตัวอย่าง {p.samples})</span>}
                  </span>
                  <span className={cn("text-[14px] font-bold font-mono", p.total > 0 ? "text-warning" : "text-white/30")}>{p.total}</span>
                </Link>
              ))}
            </div>
          </GlassCard>}
        </div>
      </div>
    </div>
  );
}

/* --- HELPER COMPONENTS --- */

function ProjectProgressRow({ href, name, progress, code, status, isRisk = false }: { href: string, name: string, progress: number, code: string, status: string, isRisk?: boolean }) {
  return (
    <Link href={href} className="block space-y-2 group">
      <div className="flex justify-between items-end gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-nexus-blue font-mono mb-0.5">{code}</p>
          <p className="text-sm font-bold text-white truncate group-hover:text-nexus-teal" title={name}>{name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] font-mono text-white/60">{progress}%</span>
          <span className={cn("text-[12px] font-medium px-2 py-0.5 rounded border whitespace-nowrap", isRisk ? "text-danger border-danger/30 bg-danger/10" : "text-white/50 border-white/10")}>
            {status}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div className={cn("h-full", isRisk ? "bg-danger" : "bg-nexus-teal")} style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}

function StockAlertRow({ item, sku, stock, min, unit }: { item: string, sku: string, stock: number, min: number, unit: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-transparent hover:border-white/5 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/30 shrink-0">
          <Package size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white truncate" title={item}>{item}</p>
          <p className="text-[12px] text-white/40 font-mono">{sku ? `${sku} · ` : ""}จุดสั่งซื้อ {min} {unit}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-lg font-bold font-mono", stock === 0 ? "text-danger" : "text-warning")}>{stock}</p>
        <p className="text-[11px] text-white/30">คงเหลือ</p>
      </div>
    </div>
  );
}

const KIND_STYLE: Record<ActivityKind, { dot: string; badge: string; label: string }> = {
  success: { dot: "bg-nexus-teal", badge: "text-nexus-teal border-nexus-teal/20 bg-nexus-teal/10", label: "สร้าง/อนุมัติ" },
  info: { dot: "bg-nexus-blue", badge: "text-nexus-blue border-nexus-blue/20 bg-nexus-blue/10", label: "แก้ไข" },
  warning: { dot: "bg-warning", badge: "text-warning border-warning/20 bg-warning/10", label: "ลบ" },
};

function TacticalLogItem({ kind, msg, time }: { kind: ActivityKind, msg: string, time: string }) {
  const st = KIND_STYLE[kind];
  return (
    <div className="px-5 py-3.5 flex gap-4 items-start border-b border-white/[0.03] last:border-0">
      <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", st.dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white/80 leading-snug break-words">{msg}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px] text-white/40">{time}</span>
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded border", st.badge)}>{st.label}</span>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon, label, color, link }: { icon: any, label: string, color: string, link: string }) {
  return (
    <Link href={link} className="contents">
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/[0.08] hover:border-white/20 transition-all active:scale-95 group relative overflow-hidden shadow-2xl backdrop-blur-lg">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", color)}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
        </div>
        <span className="text-[12px] font-medium text-white uppercase text-center tracking-widest leading-snug w-full px-1">{label}</span>
      </div>
    </Link>
  );
}
