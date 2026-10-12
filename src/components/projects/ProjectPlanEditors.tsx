"use client";

/**
 * ตัวแก้ไขส่วนวางแผนโครงการ (หน้าสร้าง/แก้ไขโครงการ)
 *  - Field / NumCell: ช่องกรอกขนาดพอดีข้อมูล (ปี 4 หลัก, เงินไม่เกินหมื่นล้าน, %)
 *  - ExpensesEditor: ค่าใช้จ่ายดำเนินงาน (อัตราอัตโนมัติ แก้ไขได้)
 *  - TimelineEditor: แผนงาน/งวดงาน + แผนภูมิเวลา
 *  - DocSectionsEditor: รายละเอียดโครงการตามแบบ TOR + ผู้ช่วย AI
 */

import React, { useState } from "react";
import { Bot, Lock, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { GanttChart } from "@/components/projects/GanttChart";
import {
  EXPENSE_BASIS_TH, type DocSectionDef, type DocSectionKey, type ExpenseBasis, type ProjectExpense, type TimelinePhase,
} from "@/lib/project-templates";

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400e3;
const daysBetween = (a: string, b: string) => {
  const s = Date.parse(`${a}T00:00:00Z`);
  const e = Date.parse(`${b}T00:00:00Z`);
  return Number.isFinite(s) && Number.isFinite(e) && e >= s ? Math.round((e - s) / DAY) + 1 : 0;
};

/** ความกว้างมาตรฐานของช่องตามชนิดข้อมูล (px) */
export const FIELD_W = {
  year: 84,      // 2570
  pct: 92,       // 100.00 %
  days: 100,     // 9999 วัน
  months: 104,   // 120 เดือน
  money: 168,    // 99,999,999,999.99 (หน่วยอยู่ที่ป้ายชื่อ)
  date: 152,     // 31/12/2026 + ไอคอนปฏิทิน
  code: 168,     // เลขที่เอกสาร
  phone: 148,
  select: 150,
} as const;

/** ช่องกรอกพร้อมป้ายชื่อ: กว้างคงที่ตามข้อมูล หรือยืดเต็มแถว (grow) — วางใน flex-wrap */
export function Field({ label, required, extra, w, grow, children, className }: {
  label: string; required?: boolean; extra?: React.ReactNode; w: number; grow?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1 min-w-0", className)} style={{ flex: grow ? `1 1 ${w}px` : `0 0 ${w}px`, maxWidth: "100%" }}>
      <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center gap-1.5 min-h-[18px] whitespace-nowrap">
        <span>{label}{required && <span className="text-danger ml-0.5">*</span>}</span>
        {extra}
      </label>
      {children}
    </div>
  );
}

type NumKind = "money" | "pct" | "int" | "year";
const MAX_INT_DIGITS: Record<NumKind, number> = { money: 11, pct: 3, int: 4, year: 4 };

/** ช่องตัวเลข: ไม่มีปุ่มขึ้นลง จำกัดจำนวนหลัก เงินแสดงคั่นหลักพันเมื่อไม่ได้แก้ไข หน่วยท้ายช่องไม่ทับตัวเลข */
export function NumCell({ value, onChange, suffix, kind = "int", className, disabled, title, warn }: {
  value: number; onChange: (v: number) => void; suffix?: string; kind?: NumKind; className?: string; disabled?: boolean; title?: string; warn?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const decimals = kind === "money" || kind === "pct" ? 2 : 0;
  const shown = editing !== null
    ? editing
    : kind === "money"
      ? (Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(Number.isFinite(value) ? value : 0);
  const accept = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, "");
    const [i = "", d] = clean.split(".");
    if (i.length > MAX_INT_DIGITS[kind]) return;
    const text = decimals && d !== undefined ? `${i}.${d.slice(0, decimals)}` : i;
    setEditing(text);
    onChange(Number(text) || 0);
  };
  return (
    <div className={cn("relative", className)} title={title}>
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        value={shown}
        disabled={disabled}
        onChange={(e) => accept(e.target.value)}
        onFocus={(e) => { const el = e.target; setEditing(value ? String(value) : ""); requestAnimationFrame(() => el.select()); }}
        onBlur={() => setEditing(null)}
        className={cn(
          "w-full h-9 rounded-full bg-white/[0.03] border text-white text-[13px] font-mono text-right focus:outline-none focus:border-nexus-teal/40 disabled:opacity-40",
          warn ? "border-warning/60" : "border-white/10",
          suffix ? "pl-3 pr-12" : "px-3"
        )}
      />
      {suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-white/40 pointer-events-none">{suffix}</span>}
    </div>
  );
}

const headCls = "text-[11px] font-bold text-white/45 uppercase tracking-wide";

// ---------------------------------------------------------------------------
export function ExpensesEditor({ expenses, onChange, onReset, amounts }: {
  expenses: ProjectExpense[];
  onChange: (next: ProjectExpense[]) => void;
  onReset: () => void;
  /** จำนวนเงินของแต่ละแถว (id -> บาท) คำนวณจากงบประมาณ */
  amounts: Record<string, number>;
}) {
  const update = (id: string, patch: Partial<ProjectExpense>, keepAuto = false) =>
    onChange(expenses.map((e) => (e.id === id ? { ...e, ...patch, ...(keepAuto ? {} : { auto: false }) } : e)));
  const total = r2(expenses.reduce((s, e) => s + (amounts[e.id] || 0), 0));
  const cols = "grid grid-cols-[minmax(0,1fr)_140px_108px_112px_24px] 2xl:grid-cols-[minmax(0,1fr)_156px_120px_140px_28px] gap-1.5 2xl:gap-2 items-center";

  return (
    <div className="space-y-2">
      <div className={cn(cols, "px-1")}>
        <span className={headCls}>รายการค่าใช้จ่าย</span>
        <span className={headCls}>ฐานคำนวณ</span>
        <span className={cn(headCls, "text-right pr-3")}>อัตรา</span>
        <span className={cn(headCls, "text-right")}>จำนวนเงิน</span>
        <span />
      </div>
      {expenses.map((e) => (
        <div key={e.id} className={cols}>
          <div className="relative min-w-0">
            <PillInput value={e.name} title={e.name} onChange={(ev) => update(e.id, { name: ev.target.value }, true)} placeholder="ชื่อค่าใช้จ่าย" className={cn("h-9 text-sm px-4", e.key && "pr-[86px]")} />
            {e.key && (
              <button
                type="button"
                onClick={() => update(e.id, { auto: true }, true)}
                disabled={e.auto}
                title={e.auto ? "อัตราคำนวณตามขนาด รูปแบบงาน และระยะเวลาโครงการ" : "กลับไปใช้อัตราอัตโนมัติ"}
                className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 h-6 px-2 rounded-full text-[11px] font-bold border whitespace-nowrap",
                  e.auto ? "text-nexus-teal border-nexus-teal/30 bg-nexus-teal/10 cursor-default" : "text-white/50 border-white/10 hover:text-nexus-teal")}
              >
                {e.auto ? "อัตโนมัติ" : "ใช้อัตโนมัติ"}
              </button>
            )}
          </div>
          <PillSelect value={e.basis} onChange={(ev) => update(e.id, { basis: ev.target.value as ExpenseBasis })} className="h-9 text-sm">
            {(Object.keys(EXPENSE_BASIS_TH) as ExpenseBasis[]).map((b) => <option key={b} value={b}>{EXPENSE_BASIS_TH[b]}</option>)}
          </PillSelect>
          <NumCell value={e.value} kind={e.basis === "AMOUNT" ? "money" : "pct"} onChange={(v) => update(e.id, { value: e.basis === "AMOUNT" ? v : Math.min(100, v) })} suffix={e.basis === "AMOUNT" ? "บาท" : "%"} />
          <span className="text-[13px] font-mono text-white text-right whitespace-nowrap">{baht(amounts[e.id] || 0)}</span>
          <button type="button" onClick={() => onChange(expenses.filter((x) => x.id !== e.id))} className="p-1 text-white/40 hover:text-danger justify-self-end" title="ลบรายการ"><Trash2 size={15} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <PillButton variant="glass" onClick={() => onChange([...expenses, { id: `EXP-${Date.now()}`, name: "", basis: "AMOUNT", value: 0 }])} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">
            <Plus size={13} className="mr-1" /> เพิ่มค่าใช้จ่าย
          </PillButton>
          <PillButton variant="glass" onClick={onReset} className="h-8 px-3 text-xs font-bold text-white/60">
            <RotateCcw size={13} className="mr-1" /> คำนวณใหม่ทั้งหมด
          </PillButton>
        </div>
        <span className="text-[13px] text-white/60">รวมค่าใช้จ่ายดำเนินงาน <b className="font-mono text-white ml-2">{baht(total)}</b></span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function TimelineEditor({ phases, onChange, onRegenerate, contractValue, startDate, endDate }: {
  phases: TimelinePhase[];
  onChange: (next: TimelinePhase[]) => void;
  onRegenerate: () => void;
  contractValue: number;
  startDate: string;
  endDate: string;
}) {
  const update = (id: string, patch: Partial<TimelinePhase>) => onChange(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const totalWeight = r2(phases.reduce((s, p) => s + (Number(p.weight) || 0), 0));
  const weightOk = phases.length === 0 || Math.abs(totalWeight - 100) <= 0.01;
  const outOfRange = (p: TimelinePhase) => (startDate && p.startDate < startDate) || (endDate && p.endDate > endDate);
  // จอเล็ก (13") ซ่อนคอลัมน์ลำดับ/จำนวนวัน เพื่อให้แถวเดียวพอดีการ์ดโดยไม่ต้องเลื่อน
  const cols = "grid grid-cols-[minmax(0,1fr)_140px_140px_92px_112px_24px] 2xl:grid-cols-[24px_minmax(0,1fr)_152px_152px_56px_96px_140px_28px] gap-1.5 2xl:gap-2 items-center";

  const addPhase = () => {
    const last = phases[phases.length - 1];
    const s = last?.endDate || startDate;
    onChange([...phases, { id: `PH-${Date.now()}`, name: "", startDate: s, endDate: endDate || s, weight: 0 }]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className={cn(cols, "px-1")}>
          <span className={cn(headCls, "hidden 2xl:block")}>#</span>
          <span className={headCls}>งวดงาน / ขั้นตอน</span>
          <span className={headCls}>เริ่ม</span>
          <span className={headCls}>สิ้นสุด</span>
          <span className={cn(headCls, "text-right hidden 2xl:block")}>วัน</span>
          <span className={cn(headCls, "text-right pr-3")}>สัดส่วน</span>
          <span className={cn(headCls, "text-right")}>งวดเงิน</span>
          <span />
        </div>
        {phases.map((p, i) => (
          <div key={p.id} className={cols}>
            <span className="text-[12px] font-mono text-white/50 text-center hidden 2xl:block">{i + 1}</span>
            <PillInput value={p.name} title={p.name} onChange={(e) => update(p.id, { name: e.target.value })} placeholder="ชื่องวดงาน" className="h-9 text-sm px-4" />
            <PillInput type="date" value={p.startDate} title={`${daysBetween(p.startDate, p.endDate)} วัน`} onChange={(e) => update(p.id, { startDate: e.target.value })} className={cn("h-9 text-[13px] font-mono px-3", outOfRange(p) && "border-warning/50")} />
            <PillInput type="date" value={p.endDate} onChange={(e) => update(p.id, { endDate: e.target.value })} className={cn("h-9 text-[13px] font-mono px-3", (p.endDate < p.startDate || outOfRange(p)) && "border-warning/50")} />
            <span className="text-[13px] font-mono text-white/70 text-right hidden 2xl:block">{daysBetween(p.startDate, p.endDate) || "-"}</span>
            <NumCell value={p.weight} kind="pct" onChange={(v) => update(p.id, { weight: Math.min(100, v) })} suffix="%" />
            <span className="text-[13px] font-mono text-white text-right whitespace-nowrap">{baht((contractValue * (Number(p.weight) || 0)) / 100)}</span>
            <button type="button" onClick={() => onChange(phases.filter((x) => x.id !== p.id))} className="p-1 text-white/40 hover:text-danger justify-self-end" title="ลบงวดงาน"><Trash2 size={15} /></button>
          </div>
        ))}
        {phases.length === 0 && (
          <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-white/40 text-xs">ยังไม่มีงวดงาน — กด &ldquo;สร้างตามรูปแบบงาน&rdquo; เพื่อเริ่มจากแผนมาตรฐาน</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <PillButton variant="glass" onClick={addPhase} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">
            <Plus size={13} className="mr-1" /> เพิ่มงวดงาน
          </PillButton>
          <PillButton variant="glass" onClick={onRegenerate} className="h-8 px-3 text-xs font-bold text-white/60">
            <Sparkles size={13} className="mr-1" /> สร้างตามรูปแบบงาน
          </PillButton>
        </div>
        <span className={cn("text-[13px]", weightOk ? "text-white/60" : "text-warning font-bold")}>
          สัดส่วนรวม <b className="font-mono ml-1">{totalWeight}%</b>{!weightOk && " (ต้องเท่ากับ 100%)"}
          <span className="text-white/40 font-normal ml-3">งวดเงินคิดจากมูลค่ารวม VAT {baht(contractValue)}</span>
        </span>
      </div>

      {phases.some((p) => p.startDate && p.endDate) && (
        <GanttChart
          milestones={phases.filter((p) => p.startDate && p.endDate && p.endDate >= p.startDate).map((p, i) => ({
            id: p.id, task: p.name || `งวดที่ ${i + 1}`, sub: `${r2(p.weight)}%`, start: p.startDate, end: p.endDate, progress: 0, status: "pending" as const,
          }))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export type DocSource = "auto" | "edited" | "ai";

const SOURCE_CHIP: Record<DocSource, { label: string; cls: string }> = {
  auto: { label: "อัตโนมัติ", cls: "text-nexus-teal border-nexus-teal/30 bg-nexus-teal/10" },
  edited: { label: "แก้ไขเอง", cls: "text-white/50 border-white/10" },
  ai: { label: "AI เรียบเรียง", cls: "text-nexus-blue border-nexus-blue/30 bg-nexus-blue/10" },
};

const textareaCls = "w-full bg-black/20 border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:outline-none resize-y leading-relaxed placeholder:text-white/30";
const autoRows = (v: string, min = 2) => Math.min(40, Math.max(min, (v || "").split("\n").length + 1));

export function DocSectionsEditor({ defs, sections, source, onChange, onRegenerate, aiNotes, onAiNotes, onAi, aiBusy }: {
  defs: DocSectionDef[];
  sections: Record<DocSectionKey, string>;
  source: Partial<Record<DocSectionKey, DocSource>>;
  onChange: (key: DocSectionKey, value: string) => void;
  onRegenerate: (key: DocSectionKey) => void;
  aiNotes: string;
  onAiNotes: (v: string) => void;
  onAi: () => void;
  aiBusy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl border border-nexus-blue/25 bg-nexus-blue/[0.04] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-white flex items-center gap-2"><Bot size={15} className="text-nexus-blue" /> ผู้ช่วย AI เรียบเรียงรายละเอียดโครงการ</span>
          <PillButton variant="glass" onClick={onAi} disabled={aiBusy} className="h-8 px-3 text-xs font-bold text-nexus-blue border-nexus-blue/30">
            <Sparkles size={13} className="mr-1" /> {aiBusy ? "AI กำลังเรียบเรียง..." : "ให้ AI เรียบเรียง"}
          </PillButton>
        </div>
        <textarea
          value={aiNotes}
          onChange={(e) => onAiNotes(e.target.value)}
          rows={autoRows(aiNotes, 3)}
          style={{ fieldSizing: "content", minHeight: "4.5rem" } as React.CSSProperties}
          placeholder="ใส่ข้อมูลประกอบให้ AI เช่น ปัญหาที่พบ สภาพหน้างาน จำนวนผู้ใช้งาน มาตรฐานที่ต้องการ ความต้องการพิเศษของหน่วยงาน..."
          className={textareaCls}
        />
        <p className="text-[11px] text-white/40">AI เรียบเรียงหัวข้อ ความเป็นมา วัตถุประสงค์ ขอบเขตของงาน และคุณลักษณะเฉพาะ (ไม่ระบุยี่ห้อ/รุ่น) — ตัวเลขเงิน ระยะเวลา และข้อกฎหมาย ระบบสร้างจากข้อมูลจริง</p>
      </div>

      {defs.map((s, i) => {
        const src = source[s.key] || "auto";
        return (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-white flex items-center gap-1.5">
                {i + 1}. {s.title}
                {s.locked && <Lock size={12} className="text-white/40" />}
              </span>
              {s.locked ? (
                <span className="text-[11px] text-white/40">ข้อความมาตรฐาน ไม่ต้องแก้ไข</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", SOURCE_CHIP[src].cls)}>{SOURCE_CHIP[src].label}</span>
                  {src !== "auto" && (
                    <button type="button" onClick={() => onRegenerate(s.key)} className="text-[12px] font-bold text-white/50 hover:text-nexus-teal flex items-center gap-1" title="สร้างข้อความใหม่จากข้อมูลโครงการ">
                      <RotateCcw size={12} /> ใช้ข้อความอัตโนมัติ
                    </button>
                  )}
                </div>
              )}
            </div>
            {s.locked ? (
              <div className="whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[13px] text-white/60 leading-relaxed">{sections[s.key]}</div>
            ) : (
              <textarea
                value={sections[s.key] || ""}
                onChange={(e) => onChange(s.key, e.target.value)}
                rows={autoRows(sections[s.key])}
                // ขยายตามเนื้อหา ไม่ต้องเลื่อนภายในกล่อง
                style={{ fieldSizing: "content", minHeight: "3rem" } as React.CSSProperties}
                className={textareaCls}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
