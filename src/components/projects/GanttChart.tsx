"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/Base";
import { MILESTONE_STATUS_TH, type MilestoneStatus } from "@/lib/project-milestones";

export interface GanttItem {
  id: string;
  task: string;
  sub?: string; // บรรทัดรอง เช่น เลขที่โครงการ
  start: string; // YYYY-MM-DD
  end: string;
  progress: number;
  status: MilestoneStatus;
  href?: string;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const DAY = 86400e3;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);

const BAR: Record<MilestoneStatus, { track: string; fill: string; text: string }> = {
  completed: { track: "bg-nexus-teal/15 border-nexus-teal/30", fill: "bg-nexus-teal/60", text: "text-nexus-teal" },
  "in-progress": { track: "bg-nexus-blue/15 border-nexus-blue/30", fill: "bg-nexus-blue/60", text: "text-nexus-blue" },
  overdue: { track: "bg-danger/10 border-danger/30", fill: "bg-danger/50", text: "text-danger" },
  pending: { track: "bg-white/[0.04] border-white/15", fill: "bg-white/20", text: "text-white/50" },
};

/** แผนงานตามเวลาจริง: สเกลรายเดือนตามช่วงวันที่ของงวดงานทั้งหมด ยืดตามความกว้าง (ไม่มีแถบเลื่อนภายใน) */
export function GanttChart({ milestones }: { milestones: GanttItem[] }) {
  const scale = useMemo(() => {
    const valid = milestones.filter((m) => m.start && m.end);
    if (!valid.length) return null;
    const minD = new Date(Math.min(...valid.map((m) => ms(m.start))));
    const maxD = new Date(Math.max(...valid.map((m) => ms(m.end))));
    const from = Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth(), 1);
    const to = Date.UTC(maxD.getUTCFullYear(), maxD.getUTCMonth() + 1, 1);
    const months: { label: string; left: number; width: number }[] = [];
    for (let t = from; t < to; ) {
      const d = new Date(t);
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      months.push({ label: `${TH_MONTHS[d.getUTCMonth()]} ${String((d.getUTCFullYear() + 543) % 100).padStart(2, "0")}`, left: (t - from) / (to - from), width: (next - t) / (to - from) });
      t = next;
    }
    const today = Date.now() + 7 * 3600e3;
    return { from, to, months, step: Math.ceil(months.length / 12), today: today >= from && today <= to ? (today - from) / (to - from) : null };
  }, [milestones]);

  if (!scale) {
    return <div className="py-16 text-center text-[13px] text-white/40">ยังไม่มีงวดงาน</div>;
  }
  const pos = (start: string, end: string) => {
    const l = (ms(start) - scale.from) / (scale.to - scale.from);
    const w = (ms(end) + DAY - ms(start)) / (scale.to - scale.from);
    return { left: `${l * 100}%`, width: `${Math.max(w * 100, 0.6)}%` };
  };

  return (
    <div className="w-full border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02]">
      <div className="grid grid-cols-[minmax(160px,26%)_minmax(0,1fr)]">
        <div className="h-10 border-b border-r border-white/5 flex items-center px-4 text-[11px] font-bold text-white/50">งวดงาน</div>
        <div className="h-10 border-b border-white/5 relative">
          {scale.months.map((m, i) => (
            <div key={m.label} className="absolute inset-y-0 border-l border-white/5 flex items-center justify-center text-[11px] font-bold text-white/50 overflow-hidden" style={{ left: `${m.left * 100}%`, width: `${m.width * 100}%` }}>
              {i % scale.step === 0 ? <span className="whitespace-nowrap">{m.label}</span> : null}
            </div>
          ))}
        </div>

        {milestones.map((m) => {
          const tone = BAR[m.status] || BAR.pending;
          const label = (
            <>
              <p className="text-[13px] font-bold text-white truncate">{m.task}</p>
              <p className="text-[11px] text-white/50 truncate">{m.sub ? `${m.sub} · ` : ""}<span className={tone.text}>{MILESTONE_STATUS_TH[m.status]}</span> · {m.progress}%</p>
            </>
          );
          return (
            <React.Fragment key={m.id}>
              <div className="h-12 border-b border-r border-white/5 px-4 flex flex-col justify-center min-w-0">
                {m.href ? <Link href={m.href} className="min-w-0 hover:opacity-80">{label}</Link> : label}
              </div>
              <div className="h-12 border-b border-white/5 relative">
                {scale.months.map((mo) => <div key={mo.label} className="absolute inset-y-0 border-l border-white/[0.04]" style={{ left: `${mo.left * 100}%` }} />)}
                {scale.today !== null && <div className="absolute inset-y-0 w-px bg-warning/60" style={{ left: `${scale.today * 100}%` }} />}
                <div
                  className={cn("absolute top-1/2 -translate-y-1/2 h-5 rounded-md border overflow-hidden", tone.track)}
                  style={pos(m.start, m.end)}
                  title={`${m.task}: ${m.start} ถึง ${m.end} · ${MILESTONE_STATUS_TH[m.status]} ${m.progress}%`}
                >
                  <div className={cn("h-full", tone.fill)} style={{ width: `${Math.min(100, Math.max(0, m.progress))}%` }} />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/50 border-t border-white/5">
        {(Object.keys(BAR) as MilestoneStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cn("w-3 h-2.5 rounded-sm border", BAR[s].track)} />{MILESTONE_STATUS_TH[s]}</span>
        ))}
        {scale.today !== null && <span className="flex items-center gap-1.5"><span className="w-px h-3 bg-warning/60" />วันนี้</span>}
      </div>
    </div>
  );
}
