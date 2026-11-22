"use client";

import React, { useCallback, useState } from "react";
import { FloatingLayer } from "@/components/ui/FloatingLayer";

/**
 * ข้อความเต็มเมื่อชี้ช่องที่ข้อความถูกตัด (…) — ใช้กับ dropdown/ช่องเลือกทุกแบบ
 * แสดงเฉพาะเมื่อข้อความยาวเกินช่องจริง (วัด scrollWidth) · ช่องกว้างพอ = ไม่แสดง
 *
 *   const tip = useOverflowTip(textRef);
 *   <div ref={anchor} onMouseEnter={tip.onMouseEnter} onMouseLeave={tip.onMouseLeave}>…</div>
 *   <OverflowTip anchorRef={anchor} open={tip.show && !menuOpen} text={label} />
 */
export function useOverflowTip(textRef: React.RefObject<HTMLElement | null>) {
  const [show, setShow] = useState(false);
  const onMouseEnter = useCallback(() => {
    const el = textRef.current;
    setShow(!!el && el.scrollWidth > el.clientWidth + 1);
  }, [textRef]);
  const onMouseLeave = useCallback(() => setShow(false), []);
  return { show, onMouseEnter, onMouseLeave, hide: onMouseLeave };
}

export function OverflowTip({ anchorRef, open, text }: { anchorRef: React.RefObject<HTMLElement | null>; open: boolean; text?: string }) {
  const t = String(text ?? "").trim();
  return (
    <FloatingLayer anchorRef={anchorRef} open={open && !!t} fit fitMaxWidth={420} gap={4} maxHeight={200}
      className="pointer-events-none rounded-xl border border-nexus-teal/30 bg-surface-2 px-3 py-1.5 text-[12px] font-medium leading-[1.9] text-white shadow-2xl whitespace-normal break-words" >
      <span role="tooltip" data-overflow-tip>{t}</span>
    </FloatingLayer>
  );
}
