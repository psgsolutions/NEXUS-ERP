"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Briefcase, ClipboardList, Clock, DollarSign, FileText, Phone, Plus, Target, Users, Wrench } from "lucide-react";
import {
  GlassCard, NexusSearchInput, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillTabs, StatusBadge, cn,
} from "@/components/ui/Base";
import { GanttChart, type GanttItem } from "@/components/projects/GanttChart";
import { EmptyGuide } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { useCompanyProjects } from "@/hooks/useCompanyProjects";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useContractors } from "@/hooks/useCustomers";
import { OPEN_STATUSES, PROJECT_STATUS_BADGE, PROJECT_STATUS_TH, normalizeProjectStatus, type ProjectStatus } from "@/lib/project-status";
import { milestoneStatus } from "@/lib/project-milestones";
import { compactBaht } from "@/lib/dashboard-metrics";

type Tab = "list" | "planning" | "report" | "costing" | "contractors";

const baht = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toMs = (v: any) => (!v ? 0 : v.seconds ? v.seconds * 1000 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime() || 0);
const thDate = (v: any) => { const t = toMs(v); return t ? new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-"; };
const projectName = (p: any) => String(p?.projectName || p?.title || p?.name || "โครงการไม่มีชื่อ");
const WO_STATUS: Record<string, { label: string; badge: "active" | "pending" | "warning" | "inactive" }> = {
  ASSIGNED: { label: "รอเริ่มงาน", badge: "pending" },
  IN_PROGRESS: { label: "กำลังทำงาน", badge: "warning" },
  COMPLETED: { label: "เซ็นรับงานแล้ว", badge: "active" },
};

export default function ProjectsPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: dbProjects } = useCompanyProjects();
  const { data: workOrders } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/work_orders` : "");
  const { data: allContractors } = useContractors<any>();

  const projects = useMemo(() => dbProjects
    .filter((p: any) => p.isDeleted !== true)
    .map((p: any) => ({ ...p, _status: normalizeProjectStatus(p.status) }))
    .sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt)), [dbProjects]);
  const openProjects = useMemo(() => projects.filter((p: any) => OPEN_STATUSES.includes(p._status)), [projects]);

  const q = searchQuery.trim().toLowerCase();
  const match = (...vals: any[]) => !q || vals.some((v) => String(v || "").toLowerCase().includes(q));

  // ---- สรุปภาพรวม (เฉพาะโครงการที่ยังไม่ปิด/ยกเลิก) ----
  const projectStats = useMemo(() => {
    const running = openProjects.filter((p: any) => p._status === "In Progress");
    const people = new Set<string>();
    openProjects.forEach((p: any) => {
      if (p.projectManagerUid) people.add(p.projectManagerUid);
      (p.teamUids || []).forEach((u: string) => people.add(u));
    });
    const allocated = running.reduce((s: number, p: any) => s + (Number(p.allocatedCost) || 0), 0);
    const actual = running.reduce((s: number, p: any) => s + (Number(p.actualCost) || 0), 0);
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    return {
      openCount: openProjects.length,
      totalValue: openProjects.reduce((s: number, p: any) => s + (Number(p.budget) || 0), 0),
      people: people.size,
      pendingCount: openProjects.filter((p: any) => p._status === "Pending Approval").length,
      budgetUse: allocated > 0 ? Math.round((actual / allocated) * 100) : null,
      avgProgress: running.length ? Math.round(running.reduce((s: number, p: any) => s + (Number(p.progress) || 0), 0) / running.length) : null,
      upcoming: openProjects
        .filter((p: any) => (p.endDate || "") >= today)
        .sort((a: any, b: any) => String(a.endDate).localeCompare(String(b.endDate)))
        .slice(0, 3),
    };
  }, [openProjects]);

  // ---- ทะเบียนโครงการ ----
  const listRows = projects.filter((p: any) => match(projectName(p), p.projectId, p.id, p.customerName));

  // ---- งวดงาน: ทุกงวดของโครงการที่ยังไม่ปิด ----
  const gantt: GanttItem[] = useMemo(() => openProjects
    .filter((p: any) => match(projectName(p), p.projectId, p.id))
    .flatMap((p: any) => (Array.isArray(p.milestones) ? p.milestones : []).map((m: any) => ({
      id: `${p.id}-${m.id}`,
      task: m.name,
      sub: p.projectId || p.id,
      start: m.startDate,
      end: m.endDate,
      progress: Number(m.progress) || 0,
      status: milestoneStatus(m),
      href: `/projects/milestones/new?project=${encodeURIComponent(p.id)}`,
    })))
    .sort((a: GanttItem, b: GanttItem) => a.start.localeCompare(b.start)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [openProjects, q]);
  const projectsWithoutPlan = openProjects.filter((p: any) => !(Array.isArray(p.milestones) && p.milestones.length)).length;

  // ---- รายงานบริการ: ใบสั่งงานช่าง ----
  const projectByKey = useMemo(() => {
    const m = new Map<string, any>();
    projects.forEach((p: any) => { m.set(p.id, p); if (p.projectId) m.set(p.projectId, p); });
    return m;
  }, [projects]);
  const reports = useMemo(() => workOrders
    .filter((w: any) => w.isDeleted !== true)
    .map((w: any) => ({ ...w, _project: w.projectId ? projectByKey.get(w.projectId) : null, _status: String(w.status || "").toUpperCase() }))
    .filter((w: any) => match(w.woCode, w.id, w.customerName, w.technicianName, w._project && projectName(w._project), w.projectId))
    .sort((a: any, b: any) => toMs(b.completedAt || b.createdAt) - toMs(a.completedAt || a.createdAt)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [workOrders, projectByKey, q]);

  // ---- งบประมาณ & กำไร ----
  const costing = openProjects
    .filter((p: any) => match(projectName(p), p.projectId, p.id))
    .map((p: any) => {
      const value = Number(p.budget) || 0;
      const planned = Number(p.allocatedCost) || 0;
      const actual = Number(p.actualCost) || 0;
      const progress = Number(p.progress) || 0;
      // ต้นทุนคาดการณ์เมื่อจบงาน: ถ้าใช้งบเร็วกว่าความคืบหน้า ประมาณจากอัตราใช้จริง มิฉะนั้นใช้งบที่วางไว้
      const forecast = progress > 0 && actual / Math.max(progress, 1) * 100 > planned ? Math.round(actual / progress * 100) : Math.max(planned, actual);
      const profit = value - forecast;
      // ยังไม่มีข้อมูลต้นทุน: ไม่แสดงกำไร (จะดูเหมือนกำไร 100%)
      const known = forecast > 0;
      return { p, value, planned, actual, progress, forecast, profit: known ? profit : null, margin: known && value > 0 ? Math.round((profit / value) * 1000) / 10 : null, use: planned > 0 ? Math.round((actual / planned) * 100) : null };
    });

  // ---- ผู้รับเหมา ----
  const contractors = allContractors
    .filter((c: any) => c.companyId === companyId && c.isActive !== false && c.isDeleted !== true)
    .filter((c: any) => match(c.name, c.phone, c.category))
    .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), "th"));

  const tabs = [
    { id: "list", label: "โครงการ", icon: <Briefcase size={14} /> },
    { id: "planning", label: "งวดงาน", icon: <Target size={14} /> },
    { id: "report", label: "รายงานบริการ", icon: <ClipboardList size={14} /> },
    { id: "costing", label: "งบประมาณ & กำไร", icon: <BarChart3 size={14} /> },
    { id: "contractors", label: "ผู้รับเหมา", icon: <Users size={14} /> },
  ];
  const searchPlaceholder: Record<Tab, string> = {
    list: "ค้นหาโครงการ, เลขที่ PRJ หรือลูกค้า...",
    planning: "ค้นหาโครงการเพื่อดูงวดงาน...",
    report: "ค้นหาเลขที่ใบงาน, ลูกค้า, ช่าง...",
    costing: "ค้นหาโครงการ...",
    contractors: "ค้นหาผู้รับเหมา / ทีมช่าง...",
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <Briefcase size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ศูนย์บริหารโครงการ</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 tracking-wider leading-none">ศูนย์รวมการจัดการโครงการ</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <HeaderStat icon={<Activity size={16} />} tone="teal" label="โครงการที่ยังไม่ปิด" value={`${projectStats.openCount} งาน`} />
          <HeaderStat icon={<DollarSign size={16} />} tone="blue" label="มูลค่าโครงการรวม" value={compactBaht(projectStats.totalValue)} title={`฿${projectStats.totalValue.toLocaleString("th-TH")}`} />
          <HeaderStat icon={<Users size={16} />} tone="white" label="ทีมงานในโครงการ" value={`${projectStats.people} คน`} />
        </div>
      </header>

      <section className="module-toolbar">
        <PillTabs className="module-tabs flex-1 min-w-[min(100%,520px)]" tabs={tabs} activeTab={activeTab} onTabChange={(id: any) => setActiveTab(id)} />
        <div className="module-toolbar-actions">
          {activeTab === "list" && (
            <PillButton variant="primary" onClick={() => router.push("/projects/new")} className="h-8 px-5 shadow-neon-teal">
              <Plus size={14} className="mr-1.5" /> เริ่มโครงการใหม่
            </PillButton>
          )}
          {activeTab === "planning" && (
            <PillButton variant="primary" onClick={() => router.push("/projects/milestones/new")} className="h-8 px-5 shadow-neon-teal">
              <Target size={14} className="mr-1.5" /> จัดการงวดงาน
            </PillButton>
          )}
          {activeTab === "report" && (
            <PillButton variant="primary" onClick={() => router.push("/service/work-orders/new")} className="h-8 px-5 shadow-neon-teal">
              <FileText size={14} className="mr-1.5" /> สร้างใบสั่งงาน
            </PillButton>
          )}
          {activeTab === "contractors" && (
            <PillButton variant="primary" onClick={() => router.push("/procurement/suppliers/new")} className="h-8 px-5 shadow-neon-teal">
              <Plus size={14} className="mr-1.5" /> เพิ่มทีมช่าง
            </PillButton>
          )}
        </div>
      </section>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1800px] mx-auto">
          <div className="flex flex-col xl:flex-row items-start gap-4">
            <div className="flex-1 min-w-0 w-full space-y-3">
              <NexusSearchInput placeholder={searchPlaceholder[activeTab]} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} kbd="F" />

              <GlassCard accentColor="teal" className="p-2 min-h-[560px]">
                {activeTab === "list" && (
                  <NexusTable headers={["รหัสโครงการ", "ชื่อโครงการ", "ความคืบหน้า", "ทีมงาน", "กำหนดเสร็จ", "สถานะ"]}>
                    {listRows.length === 0 && <EmptyGuide cols={6} text="ยังไม่มีโครงการ" hint="สร้างโครงการจากใบเสนอราคาที่ลูกค้าตกลง แล้วแบ่งงวดงานเพื่อเรียกเก็บเงินตามงวด" />}
                    {listRows.map((p: any) => {
                      const href = `/projects/${encodeURIComponent(p.id)}`;
                      const progress = Math.max(0, Math.min(100, Number(p.progress) || 0));
                      return (
                        <NexusTableRow key={p.id}>
                          <NexusTableCell><Link href={href} className="font-mono text-[13px] text-nexus-blue font-medium">{p.projectId || p.id}</Link></NexusTableCell>
                          <NexusTableCell><Link href={href} className="text-[13px] font-bold text-white/80 hover:text-white">{projectName(p)}</Link></NexusTableCell>
                          <NexusTableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1 w-20 2xl:w-28 bg-white/5 rounded-full overflow-hidden shrink-0"><div className="h-full bg-nexus-teal" style={{ width: `${progress}%` }} /></div>
                              <span className="text-xs font-mono text-white/75">{progress}%</span>
                            </div>
                          </NexusTableCell>
                          <NexusTableCell className="text-white/60">{(p.resources || p.team || []).length} คน</NexusTableCell>
                          <NexusTableCell className="text-white/60">{thDate(p.endDate || p.deadline)}</NexusTableCell>
                          <NexusTableCell><StatusBadge status={PROJECT_STATUS_BADGE[p._status as ProjectStatus]} label={PROJECT_STATUS_TH[p._status as ProjectStatus]} /></NexusTableCell>
                        </NexusTableRow>
                      );
                    })}
                  </NexusTable>
                )}

                {activeTab === "planning" && (
                  <div className="space-y-2 p-1">
                    <GanttChart milestones={gantt} />
                    {projectsWithoutPlan > 0 && (
                      <p className="text-[12px] text-white/50 px-1">มี {projectsWithoutPlan} โครงการที่ยังไม่ได้แบ่งงวดงาน · <Link href="/projects/milestones/new" className="text-nexus-teal hover:underline">จัดการงวดงาน</Link></p>
                    )}
                  </div>
                )}

                {activeTab === "report" && (
                  <NexusTable headers={["เลขที่ใบงาน", "ลูกค้า", "โครงการ", "ช่างผู้รับผิดชอบ", "วันนัดหมาย", "ปิดงานเมื่อ", "สถานะ"]}>
                    {reports.length === 0 && <EmptyRow cols={7} text="ยังไม่มีใบสั่งงาน" />}
                    {reports.map((w: any) => {
                      const st = WO_STATUS[w._status] || { label: w.status || "-", badge: "inactive" as const };
                      return (
                        <NexusTableRow key={w.id}>
                          <NexusTableCell className="font-mono text-[13px] text-nexus-teal">{w.woCode || w.id}</NexusTableCell>
                          <NexusTableCell className="font-bold text-white/80">{w.customerName || "-"}</NexusTableCell>
                          <NexusTableCell className="text-white/70">
                            {w._project ? <Link href={`/projects/${encodeURIComponent(w._project.id)}`} className="hover:text-white">{projectName(w._project)}</Link> : (w.projectId || "-")}
                          </NexusTableCell>
                          <NexusTableCell className="text-white/70">{w.technicianName || "-"}</NexusTableCell>
                          <NexusTableCell className="text-white/60">{thDate(w.scheduleDate)}</NexusTableCell>
                          <NexusTableCell className="text-white/60">{thDate(w.completedAt)}</NexusTableCell>
                          <NexusTableCell><StatusBadge status={st.badge} label={st.label} /></NexusTableCell>
                        </NexusTableRow>
                      );
                    })}
                  </NexusTable>
                )}

                {activeTab === "costing" && (
                  <NexusTable headers={["รหัสโครงการ", "ชื่อโครงการ", "มูลค่าสัญญา", "งบต้นทุน", "ต้นทุนจริง", "ใช้งบ / คืบหน้า %", "กำไรคาดการณ์", "กำไร %"]}>
                    {costing.length === 0 && <EmptyRow cols={8} text="ไม่มีโครงการที่ยังไม่ปิด" />}
                    {costing.map((c) => (
                      <NexusTableRow key={c.p.id}>
                        <NexusTableCell><Link href={`/projects/${encodeURIComponent(c.p.id)}`} className="font-mono text-[13px] text-nexus-blue">{c.p.projectId || c.p.id}</Link></NexusTableCell>
                        <NexusTableCell className="font-bold text-white/80">{projectName(c.p)}</NexusTableCell>
                        <NexusTableCell mono>{baht(c.value)}</NexusTableCell>
                        <NexusTableCell mono className="text-white/70">{baht(c.planned)}</NexusTableCell>
                        <NexusTableCell mono className={c.planned > 0 && c.actual > c.planned ? "text-danger" : "text-white"}>{baht(c.actual)}</NexusTableCell>
                        <NexusTableCell mono className={c.use !== null && c.use > c.progress + 10 ? "text-warning" : "text-white/70"}>{c.use === null ? "-" : c.use} / {c.progress}</NexusTableCell>
                        <NexusTableCell mono className={c.profit !== null && c.profit < 0 ? "text-danger" : "text-white"} title={c.profit === null ? "ยังไม่มีข้อมูลต้นทุน" : `ต้นทุนคาดการณ์เมื่อจบงาน ฿${baht(c.forecast)}`}>{c.profit === null ? "-" : baht(c.profit)}</NexusTableCell>
                        <NexusTableCell mono className={c.margin !== null && c.margin < 0 ? "text-danger" : "text-white/80"}>{c.margin === null ? "-" : c.margin.toFixed(1)}</NexusTableCell>
                      </NexusTableRow>
                    ))}
                  </NexusTable>
                )}

                {activeTab === "contractors" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 p-2">
                    {contractors.length === 0 ? (
                      <div className="col-span-full p-12 text-center text-white/40 border border-white/5 border-dashed rounded-3xl text-[13px]">ยังไม่มีผู้รับเหมาหรือทีมช่างในระบบ</div>
                    ) : contractors.map((c: any) => (
                      <div key={c.id} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-bold text-white truncate">{c.name || "-"}</h4>
                            <p className="text-[12px] text-white/50">{c.category || "-"}{c.contact_person ? ` · ${c.contact_person}` : ""}</p>
                          </div>
                          <Users size={16} className="text-nexus-blue/70 shrink-0" />
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-white/60 border-t border-white/5 pt-2">
                          <span className="flex items-center gap-1.5"><Phone size={12} className="text-white/40" /> {c.phone || "-"}</span>
                          <span className="flex items-center gap-1.5"><Wrench size={12} className="text-white/40" /> อัตราค่าแรง <span className="font-mono text-nexus-blue">{(c.labor_rates || c.laborRates || []).length}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {activeTab === "list" && <div className="w-full xl:w-[clamp(280px,24%,380px)] shrink-0 xl:sticky xl:top-4 space-y-4">
              <GlassCard accentColor="blue" className="p-5">
                <h4 className="text-sm font-bold text-nexus-teal mb-4">ภาพรวมโครงการที่กำลังดำเนินการ</h4>
                <div className="space-y-3">
                  <HealthItem label="ใช้งบประมาณไปแล้ว" value={projectStats.budgetUse === null ? "-" : `${projectStats.budgetUse}%`} color={projectStats.budgetUse !== null && projectStats.budgetUse > 100 ? "bg-danger" : "bg-nexus-teal"} />
                  <HealthItem label="ความคืบหน้าเฉลี่ย" value={projectStats.avgProgress === null ? "-" : `${projectStats.avgProgress}%`} color="bg-nexus-blue" />
                  <div className="flex justify-between items-center text-sm font-medium pt-1">
                    <span className="text-white/60">โครงการรออนุมัติ</span>
                    <span className="text-warning font-mono font-bold">{projectStats.pendingCount}</span>
                  </div>
                </div>
              </GlassCard>
              <GlassCard accentColor="purple" className="p-5">
                <h4 className="text-sm font-bold text-white/60 mb-4">กำหนดส่งมอบที่ใกล้ถึง</h4>
                <div className="space-y-2">
                  {projectStats.upcoming.length === 0 && <p className="text-[13px] text-white/40">ไม่มีกำหนดส่งมอบที่ใกล้ถึง</p>}
                  {projectStats.upcoming.map((p: any) => (
                    <Link key={p.id} href={`/projects/${encodeURIComponent(p.id)}`} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40 shrink-0"><Clock size={15} /></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{projectName(p)}</p>
                        <p className="text-xs text-white/60 mt-0.5">{p.projectId || p.id} • {thDate(p.endDate)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </GlassCard>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderStat({ icon, label, value, tone, title }: { icon: React.ReactNode; label: string; value: string; tone: "teal" | "blue" | "white"; title?: string }) {
  const color = tone === "teal" ? "text-nexus-teal bg-nexus-teal/10 border-nexus-teal/20" : tone === "blue" ? "text-nexus-blue bg-nexus-blue/10 border-nexus-blue/20" : "text-white bg-white/5 border-white/10";
  return (
    <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px]">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border shrink-0", color)}>{icon}</div>
      <div className="flex flex-col justify-center">
        <span className="text-xs font-semibold text-white/60 tracking-wider leading-none">{label}</span>
        <span className={cn("text-[17px] font-bold mt-0.5 mono-numbers leading-none whitespace-nowrap", color.split(" ")[0])} title={title}>{value}</span>
      </div>
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <NexusTableRow>
      <NexusTableCell colSpan={cols} className="text-center py-10 text-white/40">{text}</NexusTableCell>
    </NexusTableRow>
  );
}

function HealthItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm font-medium">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div className={cn("h-full", color)} style={{ width: value.endsWith("%") ? `${Math.min(100, parseFloat(value))}%` : "0%" }} />
      </div>
    </div>
  );
}
