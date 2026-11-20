"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ListChecks, Loader2, Lock, PlayCircle, RefreshCw } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { OWNERS, PHASE_LABELS, taskAction } from "@/lib/project-plan";

const thDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "-");
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/**
 * งานตามแผนโครงการของฉัน: มอบหมายให้ฉัน · งานตามตำแหน่งของฉัน · งานผู้จัดการ/รอหน่วยงานของโครงการที่ฉันเป็นผู้จัดการ
 * กลุ่ม: เลยกำหนด → กำลังทำ → ถึงเวลาเริ่ม (7 วัน) → รองานก่อนหน้า → ถัดไป
 */
export default function MyTasksPage() {
  const { companyId } = useAuth();
  const { showAlert } = useSystemDialog();
  const [rows, setRows] = useState<any[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const post = useCallback(async (body: any) => {
    const res = await apiFetch("/api/projects/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try { const d = await post({ action: "mine" }); setRows(d.tasks || []); setToday(d.today || ""); }
    catch (e: any) { showAlert(e.message); } finally { setLoading(false); }
  }, [companyId, post, showAlert]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (r: any, status: string) => {
    const key = `${r.projectDocId}|${r.task.id}`;
    setBusy(key);
    try { await post({ action: "setStatus", projectDocId: r.projectDocId, taskId: r.task.id, status }); await load(); }
    catch (e: any) { showAlert(e.message, "บันทึกสถานะงานไม่สำเร็จ", "warning"); } finally { setBusy(""); }
  };

  const groups = useMemo(() => {
    const soon = today ? addDays(today, 7) : "";
    const g: { key: string; title: string; tone: string; items: any[] }[] = [
      { key: "late", title: "เลยกำหนด", tone: "text-danger", items: [] },
      { key: "doing", title: "กำลังทำ", tone: "text-nexus-teal", items: [] },
      { key: "ready", title: "ถึงเวลาเริ่ม (ภายใน 7 วัน)", tone: "text-white", items: [] },
      { key: "wait", title: "รองานก่อนหน้า", tone: "text-white/60", items: [] },
      { key: "next", title: "ถัดไป", tone: "text-white/60", items: [] },
    ];
    for (const r of rows) {
      const k = r.overdue ? "late" : r.state.status === "doing" ? "doing" : r.blockers.length ? "wait" : r.task.start <= soon ? "ready" : "next";
      g.find((x) => x.key === k)!.items.push(r);
    }
    return g.filter((x) => x.items.length);
  }, [rows, today]);

  return (
    <div className="p-4 xl:p-6 space-y-4" data-my-tasks>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal flex items-center justify-center"><ListChecks size={20} /></div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white leading-none">งานตามแผนโครงการ</h1>
          <p className="text-xs text-white/55 mt-1">งานที่มอบหมายให้ฉัน งานตามตำแหน่งของฉัน และงานที่ต้องติดตามหน่วยงานในโครงการที่ฉันเป็นผู้จัดการ</p>
        </div>
        <span className="flex-1" />
        <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={load} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} โหลดใหม่</PillButton>
      </div>

      {!loading && !rows.length && <GlassCard className="p-6 text-[14px] text-white/60">ไม่มีงานค้างตามแผนโครงการ</GlassCard>}

      {groups.map((g) => (
        <GlassCard key={g.key} className="p-4 space-y-2">
          <h3 className={cn("text-[14px] font-bold flex items-center gap-2", g.tone)}>{g.key === "late" && <AlertTriangle size={14} />}{g.title} <span className="font-normal text-white/45">({g.items.length})</span></h3>
          <NexusTable headers={["โครงการ", "งาน", "ช่วง", "ผู้รับผิดชอบ", "เริ่ม (แผน)", "สิ้นสุด (แผน)", "สถานะ", "ทำต่อ"]}>
            {g.items.map((r) => {
              const key = `${r.projectDocId}|${r.task.id}`;
              const act = taskAction(r.task, r.projectDocId, r.projectName, r.customerName);
              const owner = OWNERS[r.task.owner as keyof typeof OWNERS];
              return (
                <NexusTableRow key={key}>
                  <NexusTableCell title={r.projectName}><Link href={`/projects/${encodeURIComponent(r.projectDocId)}?tab=plan`} className="text-nexus-teal hover:underline">{r.projectId}</Link> <span className="text-white/60">{r.projectName}</span></NexusTableCell>
                  <NexusTableCell title={r.blockers.length ? `ต้องรอ: ${r.blockers.map((b: any) => b.name).join(", ")}` : r.task.name}>
                    {r.task.name}{r.blockers.length > 0 && <span className="ml-1.5 text-[11px] text-white/45"><Lock size={10} className="inline -mt-0.5" /> รอ {r.blockers[0].name}</span>}
                  </NexusTableCell>
                  <NexusTableCell><span className="text-[12px] text-white/60">{PHASE_LABELS[r.task.phase]}</span></NexusTableCell>
                  <NexusTableCell><span className={cn("text-[12px]", owner?.external ? "text-warning" : "text-white/70")}>{r.state.assigneeName || owner?.label}</span></NexusTableCell>
                  <NexusTableCell mono>{thDate(r.task.start)}</NexusTableCell>
                  <NexusTableCell mono><span className={cn(r.overdue && "text-danger")}>{thDate(r.task.end)}</span></NexusTableCell>
                  <NexusTableCell>
                    <div className="flex items-center gap-1.5">
                      {busy === key ? <Loader2 size={14} className="animate-spin text-white/50" /> : (
                        <>
                          {r.state.status === "doing" ? <span className="text-[12px] text-nexus-teal">กำลังทำ</span>
                            : <PillButton variant="ghost" className="h-8 px-2 text-[12px] normal-case tracking-normal" disabled={r.blockers.length > 0} onClick={() => setStatus(r, "doing")}><PlayCircle size={12} /> เริ่ม</PillButton>}
                          <PillButton variant="confirm" className="h-8 px-3 text-[12px] normal-case tracking-normal" disabled={r.blockers.length > 0} onClick={() => setStatus(r, "done")} data-my-done>{owner?.external ? "หน่วยงานผ่านแล้ว" : "เสร็จ"}</PillButton>
                        </>
                      )}
                    </div>
                  </NexusTableCell>
                  <NexusTableCell>{act ? <Link href={act.href} className="text-[12px] text-nexus-teal hover:underline whitespace-nowrap">{act.label}</Link> : <span className="text-white/30">-</span>}</NexusTableCell>
                </NexusTableRow>
              );
            })}
          </NexusTable>
        </GlassCard>
      ))}
    </div>
  );
}
