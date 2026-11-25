"use client";

/**
 * ปุ่มทำรายการของหน้าโมดูล (ขวาบนของแถบแท็บ)
 *  - primary: งานหลัก/ใช้บ่อย แสดงเป็นปุ่มเหมือนเดิม (ตัวท้ายสุดคือปุ่มสร้างหลัก)
 *  - groups: งานรองจัดเป็นหมวด กดแล้วเปิดเมนู (ชั้นบนสุด ไม่ถูกการ์ดตัด) — ปุ่มไม่รกเมื่อมีงานเยอะ
 * รายการที่ hidden (เช่น ไม่มีสิทธิ์/ไม่เกี่ยวกับแท็บนี้) ไม่แสดง · หมวดที่ว่างไม่แสดง
 */

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { FloatingLayer } from "@/components/ui/FloatingLayer";

export interface ModuleAction {
  key?: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** คำอธิบายสั้นในเมนู (บอกว่าใช้ทำอะไร) */
  desc?: string;
  title?: string;
  hidden?: boolean;
  disabled?: boolean;
  /** ปุ่มหลัก: รูปแบบปุ่ม (ค่าเริ่มต้น glass · ปุ่มสร้างหลักใช้ primary) */
  variant?: "primary" | "glass" | "confirm" | "ghost" | "save" | "warning" | "danger";
  /** รายการในเมนูที่ต้องระวัง (เช่น ยกเลิกเอกสาร) แสดงสีแดง */
  danger?: boolean;
  /** data-* สำหรับทดสอบ */
  attrs?: Record<string, string | boolean>;
}
export interface ModuleActionGroup { label: string; icon?: React.ReactNode; items: ModuleAction[]; attrs?: Record<string, string | boolean> }

const dataAttrs = (a?: Record<string, string | boolean>) => Object.fromEntries(Object.entries(a || {}).map(([k, v]) => [k.startsWith("data-") ? k : `data-${k}`, v === true ? "" : v]));

/** ปุ่มหมวดที่เปิดเมนูรายการ (ใช้เดี่ยว ๆ ในแถบปุ่มเดิมได้) */
export function ModuleActionMenu({ g }: { g: ModuleActionGroup }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = g.items.filter((i) => !i.hidden);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!anchorRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!items.length) return null;
  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <PillButton variant="glass" className={cn("gap-1.5", open && "bg-white/15")} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} {...dataAttrs(g.attrs)}>
          {g.icon} {g.label} <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
        </PillButton>
      </span>
      <FloatingLayer ref={panelRef} anchorRef={anchorRef} open={open} matchWidth={false} align="right" minWidth={240} maxHeight={420} className="bg-surface-2 border border-white/10 rounded-2xl shadow-2xl p-1.5 overflow-y-auto custom-scrollbar">
        <div role="menu" className="flex flex-col gap-0.5">
          {items.map((i) => (
            <PillButton key={i.key || i.label} variant="ghost" role="menuitem" disabled={i.disabled} title={i.title}
              className={cn(i.desc ? "h-12" : "h-9", "w-full justify-start rounded-xl px-3 normal-case tracking-normal text-left")}
              onClick={() => { setOpen(false); i.onClick(); }} {...dataAttrs(i.attrs)}>
              <span className={cn("shrink-0", i.danger ? "text-danger" : "text-nexus-teal")}>{i.icon}</span>
              <span className="flex flex-col items-start min-w-0">
                <span className={cn("text-[12px] font-bold whitespace-nowrap", i.danger ? "text-danger" : "text-white")}>{i.label}</span>
                {i.desc && <span className="text-[11px] font-normal text-white/50 truncate max-w-[320px]">{i.desc}</span>}
              </span>
            </PillButton>
          ))}
        </div>
      </FloatingLayer>
    </>
  );
}

export function ModuleActions({ primary = [], groups = [], className }: { primary?: ModuleAction[]; groups?: ModuleActionGroup[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 ml-auto", className)} data-module-actions>
      {groups.map((g) => <ModuleActionMenu key={g.label} g={g} />)}
      {primary.filter((a) => !a.hidden).map((a) => (
        <PillButton key={a.key || a.label} variant={a.variant || "glass"} className={cn("gap-1.5", a.variant === "primary" && "shadow-neon-teal")} onClick={a.onClick} disabled={a.disabled} title={a.title || a.desc} {...dataAttrs(a.attrs)}>
          {a.icon} {a.label}
        </PillButton>
      ))}
    </div>
  );
}
