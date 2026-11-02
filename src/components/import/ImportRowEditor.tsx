"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCheck, ChevronRight, Pencil, SpellCheck, Trash2, X, XCircle } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import type { ImportTemplate } from "@/lib/import/templates";
import type { FieldFix } from "@/lib/import/row-check";

/**
 * แก้แถวที่นำเข้าไม่ผ่าน/ไม่สำเร็จ หรือมีคำที่อาจพิมพ์ผิด ในหน้าจอ (ไม่ต้องกลับไปแก้ไฟล์ Excel)
 * แก้แล้วระบบตรวจแถวนั้นใหม่ทันที · ช่องที่ข้อความผิดพลาดพูดถึงจะถูกเน้นสีแดง · คำแนะนำกดใช้ได้ทีละช่อง
 * คำเตือนคำผิดปล่อยผ่านได้ (คงค่าตามไฟล์) · ไม่ต้องการแถวนี้ = ลบแถว (ข้าม ไม่นำเข้า คืนได้จากตาราง)
 */
export function ImportRowEditor({
  open, template, rowNo, cells, errors, message, fixes, hasNext, onClose, onSave, onDismiss, onSkip,
}: {
  open: boolean;
  template: ImportTemplate | null;
  rowNo: number;
  /** ค่าเดิมของแต่ละช่อง (ข้อความตามไฟล์) */
  cells: Record<string, string>;
  errors: string[];
  message?: string;
  fixes: FieldFix[];
  hasNext: boolean;
  onClose: () => void;
  onSave: (cells: Record<string, string>, next: boolean) => void;
  onDismiss?: (fixes: FieldFix[]) => void;
  onSkip?: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(cells);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setDraft(cells); }, [open, cells]);
  if (!open || !mounted || !template) return null;

  const problems = [...errors, ...(message ? [message] : [])];
  const flagged = (header: string) => problems.some((p) => p.includes(header));
  const fixOf = (key: string) => fixes.filter((f) => f.key === key);
  const cols = template.columns.filter((c) => c.key !== "_id");
  const changed = cols.some((c) => (draft[c.key] ?? "") !== (cells[c.key] ?? ""));
  const applyAll = () => setDraft((d) => ({ ...d, ...Object.fromEntries(fixes.filter((f) => f.to).map((f) => [f.key, f.to])) }));

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[860px] max-h-[90vh] flex flex-col bg-surface-0 border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/10">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal flex items-center justify-center flex-shrink-0"><Pencil size={18} /></div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-white leading-normal">แก้ไขแถวที่ {rowNo} — {template.label}</h3>
              <p className="text-[12px] text-white/60 leading-normal">แก้ในหน้านี้ได้เลย ระบบตรวจใหม่ทันทีที่บันทึก (ไฟล์ Excel เดิมไม่เปลี่ยน)</p>
            </div>
          </div>
          <PillButton variant="ghost" onClick={onClose} className="h-8 w-8 px-0" aria-label="ปิด"><X size={16} /></PillButton>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {problems.length > 0 && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 space-y-1">
              {problems.map((p, i) => <p key={i} className="text-[12px] text-danger flex items-start gap-1.5"><XCircle size={13} className="mt-0.5 shrink-0" /> {p}</p>)}
            </div>
          )}
          {fixes.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center gap-3">
              <SpellCheck size={14} className="text-amber-300 shrink-0" />
              <p className="text-[12px] text-amber-200 flex-1">พบคำที่อาจพิมพ์ผิด {fixes.length} จุด — ตรวจคำแนะนำใต้แต่ละช่อง</p>
              {fixes.some((f) => f.to) && <PillButton variant="warning" onClick={applyAll} className="h-8 px-3 text-xs">ใช้คำแนะนำทั้งหมด</PillButton>}
              {onDismiss && <PillButton variant="ghost" onClick={() => onDismiss(fixes)} className="h-8 px-3 text-xs" title="คงค่าตามไฟล์"><CheckCheck size={13} /> ปล่อยผ่านทั้งหมด</PillButton>}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {cols.map((c) => {
              const bad = flagged(c.header);
              const fx = fixOf(c.key);
              return (
                <label key={c.key} className="block space-y-1">
                  <span className={cn("block text-[12px] font-bold", bad ? "text-danger" : "text-white/70")}>{c.header}{c.required && <span className="text-danger"> *</span>}</span>
                  <PillInput value={draft[c.key] ?? ""} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })} placeholder={c.example || c.note || ""} className={cn("w-full h-9", bad && "border-danger/60")} />
                  {fx.map((f, i) => (
                    <span key={i} className="flex items-center gap-2 text-[11px] text-amber-300">
                      <AlertTriangle size={11} className="shrink-0" />
                      <span className="flex-1">{f.message}</span>
                      {f.to && (draft[c.key] ?? "") !== f.to && <PillButton variant="ghost" onClick={() => setDraft({ ...draft, [c.key]: f.to })} className="h-8 px-2 text-[11px] normal-case tracking-normal">ใช้ “{f.to}”</PillButton>}
                      {onDismiss && <PillButton variant="ghost" onClick={() => onDismiss([f])} className="h-8 px-2 text-[11px] normal-case tracking-normal" title="คงค่าตามไฟล์">ปล่อยผ่าน</PillButton>}
                    </span>
                  ))}
                  {!fx.length && c.note && <span className="block text-[11px] text-white/40">{c.note}</span>}
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          {onSkip && <PillButton variant="ghost" className="h-9 px-4 text-xs text-danger mr-auto" onClick={onSkip} title="ไม่นำเข้าแถวนี้ (คืนได้จากตาราง)"><Trash2 size={13} /> ลบแถวนี้</PillButton>}
          <PillButton variant="ghost" className="h-9 px-5 text-xs" onClick={onClose}>ยกเลิก</PillButton>
          {hasNext && <PillButton variant="glass" className="h-9 px-5 text-xs" onClick={() => onSave(draft, true)}>บันทึกและไปแถวถัดไป <ChevronRight size={14} /></PillButton>}
          <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={!changed} onClick={() => onSave(draft, false)}>บันทึกการแก้ไข</PillButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
