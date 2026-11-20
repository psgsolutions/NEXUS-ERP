"use client";

/**
 * ขั้น "แผนงานและงวดงาน" แบบแม่แบบ (lib/project-plan.ts)
 *  - ระบบและหน้างาน: ระบบที่ทำ ซื้อ/เช่า/จ้าง พื้นที่ + จุด ระบบเดิม ห้องควบคุม โยธา ไฟฟ้า อบรม Admin รอบ PM คำถามค้าง
 *  - งวดงาน: ครบกำหนด (วันนับจากเริ่มสัญญา) % เงิน จุด ขอบเขต → ช่วงงาน/งวดเงินของโครงการ
 *  - แผนงาน: รายการงานที่ระบบสร้าง แก้จำนวนวัน/ข้าม/เพิ่มงานเองได้ + ผลตรวจกฎ (หยุด/เตือน)
 */

import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, HelpCircle, ListChecks, MapPin, OctagonX, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { GanttChart } from "@/components/projects/GanttChart";
import { Field, NumCell, FIELD_W } from "@/components/projects/ProjectPlanEditors";
import {
  CIVIL_WORKS, CONTROL_ROOMS, OWNERS, PHASE_LABELS, PROCUREMENT_KINDS, SYSTEM_TYPES, addDays, checkPlan, generatePlan,
  EMPTY_TEMPLATE, type OwnerKey, type PlanContext, type PlanInstallment, type PlanOverrides, type PlanProfile, type RuleInputs, type TemplateConfig,
} from "@/lib/project-plan";

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thDate = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "-");
const title = (icon: React.ReactNode, text: string, extra?: React.ReactNode) => (
  <div className="flex items-center gap-2 flex-wrap">{icon}<h3 className="text-[14px] font-bold text-white">{text}</h3><span className="flex-1" />{extra}</div>
);
const chip = (on: boolean) => cn("h-8 px-3 text-[12px] normal-case tracking-normal", on ? "" : "text-white/60");

export function ProjectPlanSection({ profile, onProfile, overrides, onOverrides, ctx, inputs, contractValue, installments, onInstallments, template = EMPTY_TEMPLATE }: {
  profile: PlanProfile; onProfile: (p: PlanProfile) => void;
  overrides: PlanOverrides; onOverrides: (o: PlanOverrides) => void;
  ctx: PlanContext; inputs: RuleInputs; contractValue: number;
  /** งวดงานที่แสดง (ยังไม่เคยแก้ = มาจากแผนมาตรฐานของรูปแบบงาน) */
  installments: PlanInstallment[]; onInstallments: (i: PlanInstallment[]) => void;
  /** แม่แบบของบริษัท (ตั้งค่า › แม่แบบโครงการ) */
  template?: TemplateConfig;
}) {
  const set = (patch: Partial<PlanProfile>) => onProfile({ ...profile, ...patch });
  const full = { ...profile, installments };
  const plan = useMemo(() => generatePlan(full, ctx, overrides, template), [full, ctx, overrides, template]); // eslint-disable-line react-hooks/exhaustive-deps
  const rules = useMemo(() => checkPlan(full, ctx, plan, inputs), [full, ctx, plan, inputs]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showSettings, setShowSettings] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState<Record<number, boolean>>({});
  const [newTask, setNewTask] = useState({ name: "", phase: 4, after: "", days: 1, owner: "pm" as OwnerKey });

  const sitePts = profile.sites.reduce((s, x) => s + (Number(x.points) || 0), 0);
  const instPts = installments.reduce((s, x) => s + (Number(x.points) || 0), 0);
  const instPct = Math.round(installments.reduce((s, x) => s + (Number(x.payPct) || 0), 0) * 100) / 100;
  const setInst = (i: number, patch: Partial<PlanInstallment>) => onInstallments(installments.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const ov = (id: string, patch: Partial<{ days: number; skip: boolean }> | null) => {
    const tasks = { ...overrides.tasks };
    if (patch === null) delete tasks[id];
    else { const next = { ...(tasks[id] || {}), ...patch }; if (!next.skip) delete next.skip; tasks[id] = next; }
    onOverrides({ ...overrides, tasks });
  };
  const stops = rules.filter((r) => r.level === "stop"), warns = rules.filter((r) => r.level === "warn");
  const phases = Array.from(new Set(plan.tasks.map((t) => t.phase))).sort();
  // แผนภูมิเฉพาะช่วงก่อนพ้นสัญญา (ช่วงประกันยาวหลายปี ทำให้แท่งงานติดตั้งเล็กจนอ่านไม่ออก)
  const gantt = phases.filter((ph) => ph < 7).map((ph) => {
    const ts = plan.tasks.filter((t) => t.phase === ph && !t.skipped);
    return { id: `ph${ph}`, task: `${ph}. ${PHASE_LABELS[ph]}`, start: ts.reduce((m, t) => (!m || t.start < m ? t.start : m), ""), end: ts.reduce((m, t) => (t.end > m ? t.end : m), ""), progress: 0, status: "pending" as const };
  }).filter((g) => g.start);

  return (
    <div className="space-y-4" data-plan-section>
      {/* ---------- ระบบและหน้างาน ---------- */}
      <GlassCard className="p-5 space-y-4">
        {title(<MapPin size={16} className="text-nexus-teal" />, "ระบบและหน้างาน", <span className="text-[11px] text-white/40">ระบบใช้ข้อมูลนี้สร้างรายการงานให้อัตโนมัติ</span>)}
        <div className="space-y-1.5">
          <p className="text-[12px] font-bold text-white/70">ระบบที่ทำ (เลือกได้หลายระบบ)</p>
          <div className="flex flex-wrap gap-1.5" data-plan-systems>
            {SYSTEM_TYPES.map((s) => {
              const on = profile.systems.includes(s.code);
              return <PillButton key={s.code} variant={on ? "primary" : "glass"} className={chip(on)} onClick={() => set({ systems: on ? profile.systems.filter((x) => x !== s.code) : [...profile.systems, s.code] })}>{s.label}</PillButton>;
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="รูปแบบการจัดหา" w={220}>
            <div className="flex gap-1.5">{PROCUREMENT_KINDS.map((k) => <PillButton key={k.code} variant={profile.procurement === k.code ? "primary" : "glass"} className={chip(profile.procurement === k.code)} onClick={() => set({ procurement: k.code })}>{k.label}</PillButton>)}</div>
          </Field>
          <Field label="ระบบเดิมที่ต้องเชื่อม (ถ้ามี)" w={220} grow>
            <PillInput value={profile.legacySystem} onChange={(e) => set({ legacySystem: e.target.value })} placeholder="ว่าง = ไม่มี เช่น DSS Pro" className="w-full h-9 text-sm" />
          </Field>
          <Field label="ห้องควบคุม" w={FIELD_W.select}>
            <PillSelect value={profile.controlRoom} onChange={(e) => set({ controlRoom: e.target.value as any })} className="w-full h-9 text-sm">
              {CONTROL_ROOMS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </PillSelect>
          </Field>
          {profile.procurement === "rent" && (<>
            <Field label="ระยะเช่า" w={FIELD_W.months}><NumCell value={profile.rent.months} onChange={(v) => set({ rent: { months: Math.max(0, Math.min(48, Math.round(v))) } })} suffix="เดือน" /></Field>
            <Field label="SLA ตอบสนอง" w={FIELD_W.days}><NumCell value={profile.sla.responseHours} onChange={(v) => set({ sla: { ...profile.sla, responseHours: v } })} suffix="ชม." /></Field>
            <Field label="SLA แก้ไขเสร็จ" w={FIELD_W.days}><NumCell value={profile.sla.fixHours} onChange={(v) => set({ sla: { ...profile.sla, fixHours: v } })} suffix="ชม." /></Field>
            <Field label="ระบบพร้อมใช้" w={FIELD_W.pct}><NumCell kind="pct" value={profile.sla.uptimePct} onChange={(v) => set({ sla: { ...profile.sla, uptimePct: Math.min(100, v) } })} suffix="%" /></Field>
          </>)}
          <Field label={profile.procurement === "rent" ? "รอบบริการ SLA" : "รอบ PM"} w={FIELD_W.months}><NumCell value={profile.pmIntervalMonths} onChange={(v) => set({ pmIntervalMonths: Math.max(1, Math.min(24, Math.round(v))) })} suffix="เดือน" /></Field>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
          <span className="text-[12px] font-bold text-white/70">งานประกอบ</span>
          {CIVIL_WORKS.map((c) => (
            <PillCheckbox key={c.code} label={c.label} checked={profile.civilWork.includes(c.code)} onChange={(e) => set({ civilWork: e.target.checked ? [...profile.civilWork, c.code] : profile.civilWork.filter((x) => x !== c.code) })} className="text-[12px] text-white/80" />
          ))}
          <PillCheckbox label="งานไฟฟ้า (แบบ กว.)" checked={profile.electricalWork} onChange={(e) => set({ electricalWork: e.target.checked })} className="text-[12px] text-white/80" />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="อบรม (ครั้ง)" w={FIELD_W.days}><NumCell value={profile.training.sessions} onChange={(v) => set({ training: { ...profile.training, sessions: Math.round(v) } })} suffix="ครั้ง" /></Field>
          <Field label="ชั่วโมงต่อครั้ง" w={FIELD_W.days}><NumCell value={profile.training.hoursEach} onChange={(v) => set({ training: { ...profile.training, hoursEach: v } })} suffix="ชม." /></Field>
          <Field label="Admin ประจำหน้างาน" w={FIELD_W.days}><NumCell value={profile.onsiteAdmin.count} onChange={(v) => set({ onsiteAdmin: { ...profile.onsiteAdmin, count: Math.round(v) } })} suffix="คน" /></Field>
          {profile.onsiteAdmin.count > 0 && <Field label="เวลาทำงาน Admin" w={160}><PillInput value={profile.onsiteAdmin.hours} onChange={(e) => set({ onsiteAdmin: { ...profile.onsiteAdmin, hours: e.target.value } })} placeholder="เช่น 08:30-16:30" className="w-full h-9 text-sm" /></Field>}
        </div>

        {/* พื้นที่ติดตั้ง */}
        <div className="space-y-1.5" data-plan-sites>
          <div className="flex items-center gap-2"><p className="text-[12px] font-bold text-white/70">พื้นที่ติดตั้ง</p><span className="text-[11px] text-white/45">รวม {sitePts} จุด</span></div>
          {profile.sites.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <PillInput value={s.name} onChange={(e) => set({ sites: profile.sites.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} placeholder="ชื่อพื้นที่ เช่น อาคาร A ชั้น 1-3" className="h-9 flex-1 min-w-[180px] text-sm" aria-label="ชื่อพื้นที่" />
              <PillSelect value={s.env} onChange={(e) => set({ sites: profile.sites.map((x, k) => (k === i ? { ...x, env: e.target.value as any } : x)) })} className="h-9 w-[130px] text-sm">
                <option value="indoor">ในอาคาร</option><option value="outdoor">นอกอาคาร</option>
              </PillSelect>
              <div className="w-[110px]"><NumCell value={s.points} onChange={(v) => set({ sites: profile.sites.map((x, k) => (k === i ? { ...x, points: Math.round(v) } : x)) })} suffix="จุด" /></div>
              <PillButton variant="ghost" className="h-9 w-9 px-0 text-danger/80" aria-label="ลบพื้นที่" onClick={() => set({ sites: profile.sites.filter((_, k) => k !== i) })}><Trash2 size={13} /></PillButton>
            </div>
          ))}
          <PillButton variant="ghost" className="h-8 px-3 text-[12px] text-nexus-teal normal-case tracking-normal" onClick={() => set({ sites: [...profile.sites, { name: "", env: "indoor", points: 0 }] })} data-add-site><Plus size={12} /> เพิ่มพื้นที่</PillButton>
        </div>

        {/* คำถามค้าง */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><HelpCircle size={13} className="text-white/50" /><p className="text-[12px] font-bold text-white/70">คำถามที่รอหน่วยงานตอบ</p></div>
          {profile.openQuestions.map((q, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <PillInput value={q.text} onChange={(e) => set({ openQuestions: profile.openQuestions.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} placeholder="เช่น ใช้ห้อง Server เดิมได้หรือไม่" className="h-9 flex-1 min-w-[200px] text-sm" aria-label="คำถาม" />
              <PillSelect value={q.neededByTask} onChange={(e) => set({ openQuestions: profile.openQuestions.map((x, k) => (k === i ? { ...x, neededByTask: e.target.value } : x)) })} className="h-9 w-[260px] text-sm">
                <option value="">ต้องได้คำตอบก่อนงาน...</option>
                {plan.tasks.filter((t) => !t.recurring).map((t) => <option key={t.id} value={t.id}>{t.id} {t.name}</option>)}
              </PillSelect>
              <PillButton variant="ghost" className="h-9 w-9 px-0 text-danger/80" aria-label="ลบคำถาม" onClick={() => set({ openQuestions: profile.openQuestions.filter((_, k) => k !== i) })}><Trash2 size={13} /></PillButton>
            </div>
          ))}
          <PillButton variant="ghost" className="h-8 px-3 text-[12px] text-nexus-teal normal-case tracking-normal" onClick={() => set({ openQuestions: [...profile.openQuestions, { text: "", neededByTask: "" }] })}><Plus size={12} /> เพิ่มคำถาม</PillButton>
        </div>
      </GlassCard>

      {/* ---------- งวดงาน ---------- */}
      <GlassCard className="p-5 space-y-3" >
        <div data-plan-installments className="space-y-3">
        {title(<CalendarRange size={16} className="text-nexus-teal" />, "งวดงาน", <span className={cn("text-[12px] font-mono", instPct === 100 || (profile.procurement === "rent" && profile.rent.months > 0 && instPct < 100) ? "text-white/50" : "text-warning")}>รวม {instPct}% · {instPts} จุด</span>)}
        <p className="text-[12px] text-white/45 -mt-1">ครบกำหนด = จำนวนวันนับจากวันเริ่มสัญญา ({thDate(ctx.contractStart)}) · งวดเงินคิดจากมูลค่ารวม VAT {baht(contractValue)}</p>
        {profile.procurement === "rent" && profile.rent.months > 0 && (
          <p className="text-[12px] text-nexus-teal" data-rent-summary>
            สัญญาเช่า: งวดติดตั้งรวม {instPct}% · ค่าเช่า {Math.round((100 - instPct) * 100) / 100}% แบ่ง {profile.rent.months} เดือน = เดือนละ {baht((contractValue * Math.max(0, 100 - instPct)) / 100 / profile.rent.months)} เริ่มเดือนแรกหลังตรวจรับ ({thDate(plan.warrantyStart)})
          </p>
        )}
        {installments.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
            <span className="w-[56px] text-[12px] font-bold text-white/80">งวด {i + 1}</span>
            <div className="w-[120px]" title="ครบกำหนด (วันนับจากเริ่มสัญญา)"><NumCell value={it.dueDay} onChange={(v) => setInst(i, { dueDay: Math.round(v) })} suffix="วัน" /></div>
            <span className="w-[86px] text-[12px] text-white/55">{thDate(addDays(ctx.contractStart, Math.max(0, it.dueDay - 1)))}</span>
            <div className="w-[100px]"><NumCell kind="pct" value={it.payPct} onChange={(v) => setInst(i, { payPct: v })} suffix="%" /></div>
            <span className="w-[130px] text-right font-mono text-[12px] text-white/70">{baht((contractValue * it.payPct) / 100)}</span>
            {ctx.installable && <div className="w-[100px]"><NumCell value={it.points} onChange={(v) => setInst(i, { points: Math.round(v) })} suffix="จุด" /></div>}
            {profile.procurement === "hire" && <div className="w-[120px]" title="ผลงานสะสมที่ต้องถึงเพื่อเบิกงวดนี้"><NumCell value={it.progressPct || 0} onChange={(v) => setInst(i, { progressPct: Math.min(100, Math.round(v)) })} suffix="% ผลงาน" /></div>}
            <PillInput value={it.scope} onChange={(e) => setInst(i, { scope: e.target.value })} placeholder="ขอบเขตงวดนี้ เช่น อาคาร A" className="h-9 flex-1 min-w-[160px] text-sm" aria-label={`ขอบเขตงวด ${i + 1}`} />
            <PillButton variant="ghost" className="h-9 w-9 px-0 text-danger/80" aria-label="ลบงวด" disabled={installments.length <= 1} onClick={() => onInstallments(installments.filter((_, k) => k !== i).map((x, k) => ({ ...x, no: k + 1 })))}><Trash2 size={13} /></PillButton>
          </div>
        ))}
        <PillButton variant="ghost" className="h-8 px-3 text-[12px] text-nexus-teal normal-case tracking-normal" data-add-installment
          onClick={() => onInstallments([...installments, { no: installments.length + 1, dueDay: Math.max(ctx.durationDays, (installments[installments.length - 1]?.dueDay || 0) + 30), payPct: Math.max(0, Math.round((100 - instPct) * 100) / 100), points: 0, scope: "" }])}>
          <Plus size={12} /> เพิ่มงวด
        </PillButton>
        </div>
      </GlassCard>

      {/* ---------- แผนงาน ---------- */}
      <GlassCard className="p-5 space-y-3">
        <div data-plan-tasks className="space-y-3">
        {title(<ListChecks size={16} className="text-nexus-teal" />, "แผนงาน (สร้างจากแม่แบบ)", (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/45">{profile.dayMode === "working" ? "นับวันทำงาน (จ.–ศ.)" : "นับวันปฏิทิน"} · เริ่มประกัน {thDate(plan.warrantyStart)}</span>
            <PillButton variant="ghost" className="h-8 px-3 text-[12px] normal-case tracking-normal" onClick={() => setShowSettings((v) => !v)}><Settings2 size={13} /> ตั้งค่าการคำนวณ</PillButton>
            {(Object.keys(overrides.tasks).length > 0 || overrides.custom.length > 0) && <PillButton variant="ghost" className="h-8 px-3 text-[12px] normal-case tracking-normal" onClick={() => onOverrides({ tasks: {}, custom: [] })} title="ล้างการปรับแผนเองทั้งหมด"><RotateCcw size={13} /> กลับเป็นแผนมาตรฐาน</PillButton>}
          </div>
        ))}
        {showSettings && (
          <div className="flex flex-wrap gap-3 items-end rounded-xl border border-white/10 p-3" data-plan-settings>
            <Field label="การนับวัน" w={200}>
              <PillSelect value={profile.dayMode} onChange={(e) => set({ dayMode: e.target.value as any })} className="w-full h-9 text-sm">
                <option value="calendar">วันปฏิทิน (สัญญาราชการ)</option><option value="working">วันทำงาน จ.–ศ.</option>
              </PillSelect>
            </Field>
            {([
              ["pointsPerDay", "เดินสายได้ต่อวัน", "จุด"], ["leadTimeDays", "ระยะเวลาสั่งของ", "วัน"], ["clientDays", "หน่วยงานอนุมัติ TOR", "วัน"],
              ["announcementDays", "ประกาศ/ยื่นซอง", "วัน"], ["beforeContractDays", "เตรียมเอกสารสัญญา", "วัน"], ["civilDays", "งานโยธา", "วัน"], ["rainBufferDays", "เผื่อหน้าฝน", "วัน"],
            ] as const).map(([k, label, unit]) => (
              <Field key={k} label={label} w={FIELD_W.days + 20}><NumCell value={profile.defaults[k]} onChange={(v) => set({ defaults: { ...profile.defaults, [k]: Math.round(v) } })} suffix={unit} /></Field>
            ))}
          </div>
        )}

        {/* ผลตรวจกฎ */}
        <div className="space-y-1.5" data-plan-rules>
          {stops.map((r, i) => <p key={`s${i}`} className="flex gap-2 text-[12px] text-danger"><OctagonX size={14} className="shrink-0 mt-0.5" /><span><b>{r.id}</b> {r.message} — ต้องแก้ก่อนส่งอนุมัติ</span></p>)}
          {warns.map((r, i) => <p key={`w${i}`} className="flex gap-2 text-[12px] text-warning"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span><b>{r.id}</b> {r.message}</span></p>)}
          {!rules.length && <p className="text-[12px] text-success">ผ่านกฎตรวจแผนทุกข้อ</p>}
        </div>

        {gantt.length > 0 && <GanttChart milestones={gantt} />}

        {phases.map((ph) => {
          const rows = plan.tasks.filter((t) => t.phase === ph);
          const open = phaseOpen[ph] ?? true;
          return (
            <div key={ph} className="space-y-1">
              <PillButton variant="ghost" onClick={() => setPhaseOpen((x) => ({ ...x, [ph]: !open }))} className="h-8 px-2 justify-start text-[12px] font-bold text-white/80 normal-case tracking-normal">
                <span className="w-4 text-white/40">{open ? "▾" : "▸"}</span>{ph}. {PHASE_LABELS[ph]} <span className="font-normal text-white/40">({rows.length} งาน)</span>
              </PillButton>
              {open && (
                <NexusTable headers={["รหัส", "งาน", "ผู้รับผิดชอบ", "เริ่ม", "สิ้นสุด", "จำนวนวัน", "จุดตรวจ", "ข้าม"]}>
                  {rows.map((t) => (
                    <NexusTableRow key={t.id} className={cn(t.skipped && "opacity-40")}>
                      <NexusTableCell mono>{t.id}</NexusTableCell>
                      <NexusTableCell title={t.name}>
                        <span className={cn(t.late && "text-warning")}>{t.name}</span>
                        {t.custom && <span className="ml-1.5 text-[11px] text-nexus-teal">(เพิ่มเอง)</span>}
                        {t.rainBuffer && <span className="ml-1.5 text-[11px] text-white/45">(เผื่อหน้าฝน)</span>}
                      </NexusTableCell>
                      <NexusTableCell><span className={cn(t.external && "text-warning")}>{t.ownerLabel}</span></NexusTableCell>
                      <NexusTableCell mono>{thDate(t.start)}</NexusTableCell>
                      <NexusTableCell mono><span className={cn(t.late && "text-warning")} title={t.deadline ? `กำหนด ${thDate(t.deadline)}` : undefined}>{thDate(t.end)}</span></NexusTableCell>
                      <NexusTableCell align="right">
                        {t.recurring ? <span className="text-white/50 text-[12px]">ตามรอบ</span> : (
                          <div className="w-[96px] ml-auto"><NumCell value={t.days} onChange={(v) => ov(t.id, v > 0 ? { days: Math.round(v) } : null)} suffix="วัน" warn={!!overrides.tasks[t.id]?.days} /></div>
                        )}
                      </NexusTableCell>
                      <NexusTableCell><span className="text-[11px] text-white/55">{[t.gate, ...(t.checks || [])].filter(Boolean).join(" · ") || "-"}</span></NexusTableCell>
                      <NexusTableCell align="center">
                        {t.custom
                          ? <PillButton variant="ghost" className="h-8 w-8 px-0 text-danger/80" aria-label="ลบงานที่เพิ่มเอง" onClick={() => onOverrides({ ...overrides, custom: overrides.custom.filter((c) => c.id !== t.id) })}><Trash2 size={12} /></PillButton>
                          : <PillCheckbox checked={!!t.skipped} onChange={(e) => ov(t.id, { skip: e.target.checked })} aria-label={`ข้าม ${t.name}`} />}
                      </NexusTableCell>
                    </NexusTableRow>
                  ))}
                </NexusTable>
              )}
            </div>
          );
        })}

        {/* เพิ่มงานเอง */}
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 p-3" data-plan-custom>
          <Field label="เพิ่มงานเอง" w={220} grow><PillInput value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="เช่น ขออนุญาตเข้าพื้นที่" className="w-full h-9 text-sm" /></Field>
          <Field label="ช่วง" w={170}>
            <PillSelect value={String(newTask.phase)} onChange={(e) => setNewTask({ ...newTask, phase: Number(e.target.value) })} className="w-full h-9 text-sm">
              {Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}
            </PillSelect>
          </Field>
          <Field label="ต่อจากงาน" w={200}>
            <PillSelect value={newTask.after} onChange={(e) => setNewTask({ ...newTask, after: e.target.value })} className="w-full h-9 text-sm">
              <option value="">— เริ่มต้นช่วง —</option>
              {plan.tasks.filter((t) => !t.recurring).map((t) => <option key={t.id} value={t.id}>{t.id} {t.name}</option>)}
            </PillSelect>
          </Field>
          <Field label="ผู้รับผิดชอบ" w={170}>
            <PillSelect value={newTask.owner} onChange={(e) => setNewTask({ ...newTask, owner: e.target.value as OwnerKey })} className="w-full h-9 text-sm">
              {(Object.keys(OWNERS) as OwnerKey[]).map((k) => <option key={k} value={k}>{OWNERS[k].label}</option>)}
            </PillSelect>
          </Field>
          <Field label="จำนวนวัน" w={FIELD_W.days}><NumCell value={newTask.days} onChange={(v) => setNewTask({ ...newTask, days: Math.max(1, Math.round(v)) })} suffix="วัน" /></Field>
          <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!newTask.name.trim()} data-add-custom-task
            onClick={() => {
              const used = new Set(overrides.custom.map((c) => c.id));
              let n = 1; while (used.has(`U${n}`)) n++;
              onOverrides({ ...overrides, custom: [...overrides.custom, { id: `U${n}`, name: newTask.name.trim(), phase: newTask.phase, after: newTask.after ? [newTask.after] : [], days: newTask.days, owner: newTask.owner }] });
              setNewTask({ ...newTask, name: "" });
            }}><Plus size={13} /> เพิ่มงาน</PillButton>
        </div>
        </div>
      </GlassCard>
    </div>
  );
}
