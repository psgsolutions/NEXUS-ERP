"use client";

import React, { useEffect, useRef, useState } from "react";
import { Info, ListChecks } from "lucide-react";
import { FloatingLayer } from "@/components/ui/FloatingLayer";
import { cn } from "@/components/ui/Base";

/**
 * ตัวช่วยสำหรับผู้ใช้ใหม่ ณ จุดที่ต้องตัดสินใจ
 *  - InfoTip: ไอคอน ⓘ ข้างช่องกรอก ชี้/แตะเพื่อดูคำอธิบาย (ใช้ได้ทั้งเมาส์และจอสัมผัส)
 *  - WhatHappens: กล่อง "เมื่อกดบันทึก ระบบจะ…" วางเหนือปุ่มบันทึกของเอกสารที่มีผลทางบัญชี/สต็อก/ภาษี
 */

export function InfoTip({ text, className }: { text: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [open]);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="คำอธิบาย"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={cn("inline-flex items-center justify-center align-middle w-4 h-4 ml-1 rounded-full text-white/45 hover:text-nexus-teal focus:text-nexus-teal focus:outline-none", className)}
      >
        <Info size={14} />
      </button>
      <FloatingLayer anchorRef={ref} open={open} matchWidth={false} minWidth={260} maxHeight={260}>
        <div className="max-w-[320px] p-3 rounded-xl border border-white/10 bg-surface-0/95 backdrop-blur-xl shadow-2xl text-[13px] leading-relaxed text-white/85 font-normal normal-case tracking-normal">
          {text}
        </div>
      </FloatingLayer>
    </>
  );
}

/** แถวตารางว่างที่บอกว่าเริ่มอย่างไร (ใช้ใน NexusTable) */
export function EmptyGuide({ cols, text, hint }: { cols: number; text: string; hint?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 px-4 text-center">
        <p className="text-[14px] text-white/60">{text}</p>
        {hint && <p className="text-[13px] text-white/45 mt-1">{hint}</p>}
        <button type="button" onClick={() => window.dispatchEvent(new Event("nexus:help"))} className="mt-2 text-[13px] font-semibold text-nexus-teal hover:underline">ดูวิธีใช้หน้านี้</button>
      </td>
    </tr>
  );
}

export function WhatHappens({ items, title = "เมื่อกดบันทึก ระบบจะ", className }: { items: React.ReactNode[]; title?: string; className?: string }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <div className={cn("rounded-xl border border-nexus-blue/20 bg-nexus-blue/[0.06] p-3", className)}>
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-nexus-blue mb-1.5"><ListChecks size={14} /> {title}</p>
      <ol className="list-decimal pl-5 space-y-0.5 text-[13px] leading-relaxed text-white/75">
        {list.map((x, i) => <li key={i}>{x}</li>)}
      </ol>
    </div>
  );
}
