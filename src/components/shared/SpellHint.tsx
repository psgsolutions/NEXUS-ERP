"use client";

import React, { useMemo } from "react";
import { SpellCheck } from "lucide-react";
import { PillButton } from "@/components/ui/Base";
import { applyTypoFixes, findTypos, normalizeThaiText } from "@/lib/spellcheck";

/**
 * คำแนะนำคำที่อาจพิมพ์ผิด ใต้ช่องกรอก (ชื่อลูกค้า/ผู้ขาย/สินค้า ฯลฯ) — กด "แก้ให้" แล้วค่าในช่องเปลี่ยนตามคำแนะนำ
 * ไม่บล็อกการบันทึก
 */
export function SpellHint({ value, onFix }: { value: string; onFix: (fixed: string) => void }) {
  const typos = useMemo(() => findTypos(value), [value]);
  const tidy = normalizeThaiText(value);
  if (!typos.length && !tidy.changes) return null;
  const fixed = typos.length ? applyTypoFixes(value, typos) : tidy.text;
  const label = typos.length
    ? typos.map((t) => (t.suggest ? `${t.wrong} → ${t.suggest}` : `${t.wrong} (${t.reason})`)).join(", ")
    : "มีช่องว่างเกิน หรือสระอำแบบแยกตัว";
  return (
    <div className="flex items-center gap-2 text-[11px] text-amber-300 mt-1 w-full">
      <SpellCheck size={12} className="shrink-0" />
      <span className="flex-1 min-w-0 truncate" title={label}>อาจพิมพ์ผิด: {label}</span>
      {fixed !== value && <PillButton variant="ghost" onClick={() => onFix(fixed)} className="h-8 px-2 text-[11px] normal-case tracking-normal shrink-0">แก้ให้</PillButton>}
    </div>
  );
}
