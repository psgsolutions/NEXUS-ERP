"use client";

import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { PillButton, PillInput, PillSelect } from "@/components/ui/Base";
import { ChoiceInput } from "@/components/ui/ChoiceInput";
import { SIGN_DATE_MODES, SIGN_NAME_MODES, type SignSlot } from "@/lib/documents/design";

const COMMON_LABELS = ["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ", "ผู้รับเงิน", "ผู้จ่ายเงิน", "ผู้รับสินค้า", "ผู้ส่งสินค้า", "ผู้สั่งซื้อ", "ลูกค้า", "ผู้มีอำนาจลงนาม", "พยาน"];
const MAX = 4;

/**
 * เครื่องมือสร้างช่องลงนาม (สูงสุด 4 ช่อง): ชื่อช่อง · ชื่อใต้เส้น · ตำแหน่ง · วันที่ · คำนำหน้า (เช่น "ลงชื่อ")
 * ช่องที่มีลายเซ็นจริงตอนออกเอกสาร (ผู้ลงนาม/เซ็นบนมือถือ) ใช้ชื่อ ตำแหน่ง วันที่ของลายเซ็นนั้นก่อน
 */
export function SignSlotsEditor({ slots, fallbackLabels, onChange, disabled }: {
  slots?: SignSlot[];
  fallbackLabels: string[];
  onChange: (next: SignSlot[] | undefined) => void;
  disabled?: boolean;
}) {
  const list: SignSlot[] = slots?.length ? slots : fallbackLabels.slice(0, MAX).map((label) => ({ label, date: "blank" }));
  const set = (i: number, patch: Partial<SignSlot>) => onChange(list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {list.map((s, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-white/50 w-5 shrink-0">{i + 1}.</span>
            <div className="flex-1 min-w-0"><ChoiceInput value={s.label} onChange={(v) => set(i, { label: v })} options={[...fallbackLabels, ...COMMON_LABELS]} placeholder="ชื่อช่อง เช่น ผู้อนุมัติ" disabled={disabled} className="w-full" /></div>
            <PillButton variant="ghost" onClick={() => move(i, -1)} disabled={disabled || i === 0} className="h-8 w-8 px-0" aria-label="เลื่อนขึ้น" title="เลื่อนไปซ้าย"><ArrowUp size={12} /></PillButton>
            <PillButton variant="ghost" onClick={() => move(i, 1)} disabled={disabled || i === list.length - 1} className="h-8 w-8 px-0" aria-label="เลื่อนลง" title="เลื่อนไปขวา"><ArrowDown size={12} /></PillButton>
            <PillButton variant="ghost" onClick={() => onChange(list.length > 1 ? list.filter((_, k) => k !== i) : undefined)} disabled={disabled} className="h-8 w-8 px-0 text-danger/80" aria-label="ลบช่อง" title="ลบช่องนี้"><Trash2 size={12} /></PillButton>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pl-6">
            <label className="space-y-0.5 block"><span className="text-[11px] text-white/50">ชื่อใต้เส้น</span>
              <PillSelect value={s.name || ""} onChange={(e) => set(i, { name: (e.target.value || undefined) as SignSlot["name"] })} disabled={disabled} className="h-8 w-full text-[12px]">
                <option value="">ไม่แสดง</option>
                {SIGN_NAME_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </PillSelect>
            </label>
            <label className="space-y-0.5 block"><span className="text-[11px] text-white/50">วันที่</span>
              <PillSelect value={s.date || "blank"} onChange={(e) => set(i, { date: e.target.value as SignSlot["date"] })} disabled={disabled} className="h-8 w-full text-[12px]">
                {SIGN_DATE_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </PillSelect>
            </label>
            {s.name === "text" && (
              <label className="space-y-0.5 block col-span-2"><span className="text-[11px] text-white/50">ชื่อที่พิมพ์</span>
                <PillInput value={s.nameText || ""} onChange={(e) => set(i, { nameText: e.target.value })} disabled={disabled} placeholder="เช่น นายสมชาย ใจดี" className="h-8 w-full text-[12px]" />
              </label>
            )}
            <label className="space-y-0.5 block"><span className="text-[11px] text-white/50">ตำแหน่ง</span>
              <PillInput value={s.title || ""} onChange={(e) => set(i, { title: e.target.value })} disabled={disabled} placeholder="เช่น กรรมการผู้จัดการ" className="h-8 w-full text-[12px]" />
            </label>
            <label className="space-y-0.5 block"><span className="text-[11px] text-white/50">คำหน้าชื่อ</span>
              <PillInput value={s.prefix || ""} onChange={(e) => set(i, { prefix: e.target.value })} disabled={disabled} placeholder="เช่น ลงชื่อ" className="h-8 w-full text-[12px]" />
            </label>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={() => onChange([...list, { label: COMMON_LABELS.find((l) => !list.some((s) => s.label === l)) || "ผู้ลงนาม", name: "blank", date: "blank" }])} disabled={disabled || list.length >= MAX} className="h-8 px-3 text-xs">
          <Plus size={12} /> เพิ่มช่องลงนาม ({list.length}/{MAX})
        </PillButton>
        {slots?.length ? <PillButton variant="ghost" onClick={() => onChange(undefined)} disabled={disabled} className="h-8 px-3 text-[11px] normal-case tracking-normal">กลับเป็นค่าเดิม</PillButton> : null}
      </div>
    </div>
  );
}
