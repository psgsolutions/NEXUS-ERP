"use client";

/**
 * ตัวแก้ไขส่วนวางแผนโครงการ (หน้าสร้าง/แก้ไขโครงการ)
 *  - ExpensesEditor: ค่าใช้จ่ายดำเนินงาน
 *  - TimelineEditor: แผนงาน/งวดงาน + แผนภูมิเวลา
 *  - DocSectionsEditor: รายละเอียดโครงการ (ข้อความอัตโนมัติ แก้ไขได้) + ข้อกำหนดทางกฎหมาย
 */

import React from "react";
import { Lock, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { GanttChart } from "@/components/projects/GanttChart";
import {
  DOC_SECTIONS, EXPENSE_BASIS_TH, type DocSectionKey, type ExpenseBasis, type ProjectExpense, type TimelinePhase,
} from "@/lib/project-templates";

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400e3;
const daysBetween = (a: string, b: string) => {
  const s = Date.parse(`${a}T00:00:00Z`);
  const e = Date.parse(`${b}T00:00:00Z`);
  return Number.isFinite(s) && Number.isFinite(e) && e >= s ? Math.round((e - s) / DAY) + 1 : 0;
};

/** ช่องตัวเลขขนาดเล็กสำหรับแถวตาราง */
export function NumCell({ value, onChange, suffix, className, disabled, title }: {
  value: number; onChange: (v: number) => void; suffix?: string; className?: string; disabled?: boolean; title?: string;
}) {
  return (
    <div className={cn("relative", className)} title={title}>
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) && value !== 0 ? value : value === 0 ? 0 : ""}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        onFocus={(e) => e.target.select()}
        className={cn(
          "w-full h-9 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-mono text-right focus:outline-none focus:border-nexus-teal/40 disabled:opacity-40",
          suffix ? "pl-3 pr-8" : "px-3"
        )}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/40 pointer-events-none">{suffix}</span>}
    </div>
  );
}

const headCls = "text-[11px] font-bold text-white/45 uppercase tracking-wide";

// ---------------------------------------------------------------------------
export function ExpensesEditor({ expenses, onChange, onReset, directCost, price }: {
  expenses: ProjectExpense[];
  onChange: (next: ProjectExpense[]) => void;
  onReset: () => void;
  directCost: number;
  price: number;
}) {
  const update = (id: string, patch: Partial<ProjectExpense>) => onChange(expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const amountOf = (e: ProjectExpense) => {
    const v = Number(e.value) || 0;
    return r2(e.basis === "AMOUNT" ? v : ((e.basis === "PCT_PRICE" ? price : directCost) * v) / 100);
  };
  const total = r2(expenses.reduce((s, e) => s + amountOf(e), 0));
  const cols = "grid grid-cols-[minmax(0,1fr)_124px_100px_112px_24px] 2xl:grid-cols-[minmax(0,1fr)_150px_120px_130px_28px] gap-1.5 2xl:gap-2 items-center";

  return (
    <div className="space-y-2">
      <div className={cn(cols, "px-1 hidden md:grid")}>
        <span className={headCls}>รายการค่าใช้จ่าย</span>
        <span className={headCls}>ฐานคำนวณ</span>
        <span className={cn(headCls, "text-right")}>อัตรา / จำนวน</span>
        <span className={cn(headCls, "text-right")}>จำนวนเงิน</span>
        <span />
      </div>
      {expenses.map((e) => (
        <div key={e.id} className={cn(cols, "max-md:grid-cols-2")}>
          <PillInput value={e.name} title={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })} placeholder="ชื่อค่าใช้จ่าย" className="h-9 text-sm px-4 max-md:col-span-2" />
          <PillSelect value={e.basis} onChange={(ev) => update(e.id, { basis: ev.target.value as ExpenseBasis })} className="h-9 text-sm">
            {(Object.keys(EXPENSE_BASIS_TH) as ExpenseBasis[]).map((b) => <option key={b} value={b}>{EXPENSE_BASIS_TH[b]}</option>)}
          </PillSelect>
          <NumCell value={e.value} onChange={(v) => update(e.id, { value: v })} suffix={e.basis === "AMOUNT" ? "฿" : "%"} />
          <span className="text-[13px] font-mono text-white text-right pr-1 whitespace-nowrap">{baht(amountOf(e))}</span>
          <button type="button" onClick={() => onChange(expenses.filter((x) => x.id !== e.id))} className="p-1 text-white/40 hover:text-danger justify-self-end" title="ลบรายการ"><Trash2 size={15} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <PillButton variant="glass" onClick={() => onChange([...expenses, { id: `EXP-${Date.now()}`, name: "", basis: "AMOUNT", value: 0 }])} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">
            <Plus size={13} className="mr-1" /> เพิ่มค่าใช้จ่าย
          </PillButton>
          <PillButton variant="glass" onClick={onReset} className="h-8 px-3 text-xs font-bold text-white/60">
            <RotateCcw size={13} className="mr-1" /> ค่าเริ่มต้น
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
  const cols = "grid grid-cols-[minmax(0,1fr)_128px_128px_80px_108px_24px] 2xl:grid-cols-[24px_minmax(0,1fr)_140px_140px_48px_90px_130px_28px] gap-1.5 2xl:gap-2 items-center";

  const addPhase = () => {
    const last = phases[phases.length - 1];
    const s = last?.endDate || startDate;
    onChange([...phases, { id: `PH-${Date.now()}`, name: "", startDate: s, endDate: endDate || s, weight: 0 }]);
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="space-y-2">
          <div className={cn(cols, "px-1")}>
            <span className={cn(headCls, "hidden 2xl:block")}>#</span>
            <span className={headCls}>งวดงาน / ขั้นตอน</span>
            <span className={headCls}>เริ่ม</span>
            <span className={headCls}>สิ้นสุด</span>
            <span className={cn(headCls, "text-right hidden 2xl:block")}>วัน</span>
            <span className={cn(headCls, "text-right")}>สัดส่วน</span>
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
              <NumCell value={p.weight} onChange={(v) => update(p.id, { weight: Math.min(100, v) })} suffix="%" />
              <span className="text-[13px] font-mono text-white text-right pr-1 whitespace-nowrap">{baht((contractValue * (Number(p.weight) || 0)) / 100)}</span>
              <button type="button" onClick={() => onChange(phases.filter((x) => x.id !== p.id))} className="p-1 text-white/40 hover:text-danger justify-self-end" title="ลบงวดงาน"><Trash2 size={15} /></button>
            </div>
          ))}
          {phases.length === 0 && (
            <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-white/40 text-xs">ยังไม่มีงวดงาน — กด &ldquo;สร้างตามรูปแบบงาน&rdquo; เพื่อเริ่มจากแผนมาตรฐาน</div>
          )}
        </div>
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
export function DocSectionsEditor({ sections, dirty, onChange, onRegenerate, legalRefs }: {
  sections: Record<DocSectionKey, string>;
  dirty: Partial<Record<DocSectionKey, boolean>>;
  onChange: (key: DocSectionKey, value: string) => void;
  onRegenerate: (key: DocSectionKey) => void;
  legalRefs: string[];
}) {
  return (
    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
      {DOC_SECTIONS.map((s, i) => (
        <div key={s.key} className={cn("space-y-1.5", (s.key === "specs" || s.key === "scope" || s.key === "payment") && "2xl:col-span-2")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-white">{i + 1}. {s.title}</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", dirty[s.key] ? "text-white/50 border-white/10" : "text-nexus-teal border-nexus-teal/30 bg-nexus-teal/10")}>
                {dirty[s.key] ? "แก้ไขเอง" : "อัตโนมัติ"}
              </span>
              <button type="button" onClick={() => onRegenerate(s.key)} className="text-[12px] font-bold text-white/50 hover:text-nexus-teal flex items-center gap-1" title="สร้างข้อความใหม่จากข้อมูลโครงการ">
                <Sparkles size={12} /> สร้างใหม่
              </button>
            </div>
          </div>
          <textarea
            value={sections[s.key] || ""}
            onChange={(e) => onChange(s.key, e.target.value)}
            // ขยายตามเนื้อหา ไม่ต้องเลื่อนภายในกล่อง
            rows={Math.min(40, Math.max(2, (sections[s.key] || "").split("\n").length + 1))}
            style={{ fieldSizing: "content", minHeight: "4.5rem" } as React.CSSProperties}
            className="w-full bg-black/20 border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:outline-none resize-y leading-relaxed placeholder:text-white/30"
          />
        </div>
      ))}
      <div className="2xl:col-span-2 p-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-2">
        <div className="flex items-center gap-2 text-[13px] font-bold text-white">
          <Lock size={14} className="text-white/50" /> ข้อกำหนดทางกฎหมาย <span className="text-[11px] font-normal text-white/40">(อ้างอิงอัตโนมัติตามประเภทลูกค้า ไม่ต้องแก้ไข)</span>
        </div>
        <ul className="space-y-1">
          {legalRefs.map((l) => <li key={l} className="text-[13px] text-white/70 pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-white/30">{l}</li>)}
        </ul>
      </div>
    </div>
  );
}
