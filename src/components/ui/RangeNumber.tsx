"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/components/ui/Base";

type RangeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange?: (e: { target: { value: string } }) => void;
  /** หน่วยหลังช่องตัวเลข เช่น pt, % */
  unit?: string;
};

/**
 * แถบเลื่อน + ช่องพิมพ์ตัวเลข (ค่าเดียวกัน) — ใช้แทน <input type="range"> ได้ทันที (props เดิม)
 * พิมพ์ตัวเลขแล้วกด Enter หรือออกจากช่อง: ปัดตาม step และจำกัดในช่วง min–max
 */
export function RangeNumber({ min = 0, max = 100, step = 1, value, onChange, className, unit, disabled, ...rest }: RangeProps) {
  const lo = Number(min), hi = Number(max), st = Number(step) || 1;
  const [text, setText] = useState(String(value ?? ""));
  useEffect(() => { setText(String(value ?? "")); }, [value]);
  const decimals = (String(st).split(".")[1] || "").length;
  const commit = () => {
    const n = Number(String(text).replace(/,/g, ""));
    if (!Number.isFinite(n)) { setText(String(value ?? "")); return; }
    const clamped = Math.min(hi, Math.max(lo, Math.round((n - lo) / st) * st + lo));
    const fixed = Number(clamped.toFixed(decimals));
    setText(String(fixed));
    if (String(fixed) !== String(value)) onChange?.({ target: { value: String(fixed) } });
  };
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <input {...rest} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })} className="flex-1 min-w-0 accent-nexus-teal" />
      <input type="text" inputMode="decimal" value={text} disabled={disabled} aria-label="ใส่ค่าเป็นตัวเลข"
        onChange={(e) => setText(e.target.value.replace(/[^\d.,-]/g, ""))}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        className="w-[56px] h-7 rounded-lg bg-white/[0.04] border border-white/10 px-1.5 text-right font-mono text-[12px] text-white focus:outline-none focus:border-nexus-teal/50" />
      {unit && <span className="text-[11px] text-white/50 shrink-0">{unit}</span>}
    </span>
  );
}
