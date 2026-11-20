"use client";

/**
 * แท็บ "แผนงาน" ในหน้าโครงการ: ติดตามงานตามแผน (สร้างจากแม่แบบตอนบันทึกโครงการ)
 *  - สถานะต่องาน ยังไม่เริ่ม / กำลังทำ / เสร็จแล้ว · งานที่ต้องรอ (จุดตรวจ เช่น อนุมัติแบบ) เริ่มไม่ได้จนงานก่อนหน้าเสร็จ
 *  - มอบหมายผู้ทำ (ว่าง = ตามตำแหน่ง) · ลิงก์ไปทำต่อ: ขอซื้อ จ่ายงานช่าง วางบิล หลักประกัน
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Lock, PlayCircle, RotateCcw } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillSelect, cn } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { OWNERS, PHASE_LABELS, TASK_STATUS_TH, planProgress, stateOf, taskAction, taskBlockers, type SnapTask, type TaskStatus } from "@/lib/project-plan";

const thDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "-");
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function ProjectPlanTracker({ companyId, docId, project, canManage }: { companyId: string; docId: string; project: any; canManage: boolean }) {
  const { showAlert } = useSystemDialog();
  const { data: users = [] } = useRealtimeCollection<any>("users");
  const tasks: SnapTask[] = useMemo(() => (Array.isArray(project?.plan?.tasks) ? project.plan.tasks : []), [project?.plan?.tasks]);
  const st = project?.planStatus || {};
  const today = todayBkk();
  const prog = planProgress(tasks, st, today);
  const [busy, setBusy] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const people = useMemo(() => users.filter((u: any) => !u.status || String(u.status).toUpperCase() === "ACTIVE").map((u: any) => ({ uid: u.id, name: u.name || u.email || u.id })).sort((a: any, b: any) => a.name.localeCompare(b.name, "th")), [users]);

  const call = async (body: any) => {
    setBusy(body.taskId);
    try {
      const res = await apiFetch("/api/projects/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, projectDocId: docId, ...body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
    } catch (e: any) { showAlert(e.message, "บันทึกสถานะงานไม่สำเร็จ", "warning"); } finally { setBusy(""); }
  };
  const setStatus = (t: SnapTask, status: TaskStatus) => call({ action: "setStatus", taskId: t.id, status });

  if (!tasks.length) {
    return (
      <GlassCard className="p-5 text-[14px] text-white/60 space-y-2">
        <p>โครงการนี้ยังไม่มีแผนงานจากแม่แบบ</p>
        <p className="text-[12px]">แผนงานสร้างให้อัตโนมัติสำหรับงานติดตั้ง — <Link href={`/projects/new?edit=${encodeURIComponent(docId)}`} className="text-nexus-teal hover:underline">แก้ไขโครงการ › ขั้นแผนงานและงวดงาน</Link> แล้วบันทึก</p>
      </GlassCard>
    );
  }

  const phases = Array.from(new Set(tasks.map((t) => t.phase))).sort();
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <div className="space-y-4" data-plan-tracker>
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="min-w-[200px] flex-1">
            <div className="flex justify-between text-[12px] text-white/60 mb-1"><span>ความคืบหน้าตามแผน (ถึงตรวจรับงวดสุดท้าย)</span><span className="font-mono text-white">{prog.done}/{prog.total} · {pct}%</span></div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-nexus-teal" style={{ width: `${pct}%` }} /></div>
          </div>
          <span className="text-[12px] text-white/70">กำลังทำ <b className="text-white">{prog.doing}</b></span>
          <span className={cn("text-[12px]", prog.overdue ? "text-danger" : "text-white/70")}>เลยกำหนด <b>{prog.overdue}</b></span>
          <span className="text-[12px] text-white/70">เริ่มประกัน {thDate(project?.plan?.warrantyStartActual || project?.plan?.warrantyStart)}{project?.plan?.warrantyStartActual ? "" : " (ตามแผน)"}</span>
          <PillButton variant={onlyOpen ? "primary" : "glass"} className="h-8 px-3 text-[12px] normal-case tracking-normal" onClick={() => setOnlyOpen((v) => !v)}>เฉพาะงานที่ยังไม่เสร็จ</PillButton>
        </div>
      </GlassCard>

      {phases.map((ph) => {
        const rows = tasks.filter((t) => t.phase === ph && !t.skipped && (!onlyOpen || stateOf(st, t.id).status !== "done"));
        if (!rows.length) return null;
        return (
          <GlassCard key={ph} className="p-4 space-y-2">
            <h3 className="text-[14px] font-bold text-white">{ph}. {PHASE_LABELS[ph]}</h3>
            <NexusTable headers={["รหัส", "งาน", "ผู้รับผิดชอบ", "เริ่ม (แผน)", "สิ้นสุด (แผน)", "สถานะ", "ทำต่อ"]}>
              {rows.map((t) => {
                const s = stateOf(st, t.id);
                const wait = s.status === "done" ? [] : taskBlockers(t, tasks, st);
                const late = s.status !== "done" && t.end < today;
                const act = taskAction(t, docId, project?.projectName || "", project?.customerName || "");
                const owner = OWNERS[t.owner];
                return (
                  <NexusTableRow key={t.id}>
                    <NexusTableCell mono>{t.id}</NexusTableCell>
                    <NexusTableCell title={wait.length ? `ต้องรอ: ${wait.map((w) => w.name).join(", ")}` : t.name}>
                      <span className={cn(late && "text-danger")}>{t.name}</span>
                      {wait.length > 0 && <span className="ml-1.5 text-[11px] text-white/45"><Lock size={10} className="inline -mt-0.5" /> รอ {wait[0].id}{wait.length > 1 ? ` +${wait.length - 1}` : ""}</span>}
                    </NexusTableCell>
                    <NexusTableCell>
                      {canManage && !owner?.external ? (
                        <PillSelect value={s.assigneeUid || ""} onChange={(e) => call({ action: "assign", taskId: t.id, uid: e.target.value })} className="h-8 w-[170px] text-[12px]" aria-label={`ผู้ทำ ${t.name}`}>
                          <option value="">{owner?.label || "-"} (ตามตำแหน่ง)</option>
                          {people.map((u: any) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                        </PillSelect>
                      ) : <span className={cn("text-[12px]", owner?.external ? "text-warning" : "text-white/70")}>{s.assigneeName || owner?.label}</span>}
                    </NexusTableCell>
                    <NexusTableCell mono>{thDate(t.start)}</NexusTableCell>
                    <NexusTableCell mono><span className={cn(late && "text-danger")} title={t.deadline ? `กำหนด ${thDate(t.deadline)}` : undefined}>{thDate(t.end)}</span></NexusTableCell>
                    <NexusTableCell>
                      <div className="flex items-center gap-1.5" data-task-status={t.id}>
                        {busy === t.id ? <Loader2 size={14} className="animate-spin text-white/50" /> : s.status === "done" ? (
                          <>
                            <span className="text-[12px] text-success inline-flex items-center gap-1" title={`${s.byName || ""} ${s.at ? thDate(s.at) : ""}`}><CheckCircle2 size={13} /> เสร็จ {thDate(s.at)}</span>
                            <PillButton variant="ghost" className="h-8 w-8 px-0 text-white/40" aria-label="ย้อนเป็นยังไม่เสร็จ" title="ย้อนเป็นยังไม่เสร็จ" onClick={() => setStatus(t, "doing")}><RotateCcw size={12} /></PillButton>
                          </>
                        ) : (
                          <>
                            {s.status === "doing" ? <span className="text-[12px] text-nexus-teal">{TASK_STATUS_TH.doing}</span>
                              : <PillButton variant="ghost" className="h-8 px-2 text-[12px] normal-case tracking-normal" disabled={wait.length > 0} onClick={() => setStatus(t, "doing")} data-task-start><PlayCircle size={12} /> เริ่ม</PillButton>}
                            <PillButton variant="confirm" className="h-8 px-3 text-[12px] normal-case tracking-normal" disabled={wait.length > 0} onClick={() => setStatus(t, "done")} data-task-done>{owner?.external ? "หน่วยงานผ่านแล้ว" : "เสร็จ"}</PillButton>
                          </>
                        )}
                        {late && <AlertTriangle size={13} className="text-danger" aria-label="เลยกำหนด" />}
                      </div>
                    </NexusTableCell>
                    <NexusTableCell>{act ? <Link href={act.href} className="text-[12px] text-nexus-teal hover:underline whitespace-nowrap">{act.label}</Link> : <span className="text-white/30">-</span>}</NexusTableCell>
                  </NexusTableRow>
                );
              })}
            </NexusTable>
          </GlassCard>
        );
      })}
    </div>
  );
}
