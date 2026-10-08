"use client";

import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * ชั้นลอยสำหรับ dropdown / เมนู: แสดงที่ระดับ document.body (อยู่หน้าสุดเสมอ)
 * จึงไม่ถูกการ์ดหรือกล่องที่ตั้ง overflow-hidden / scroll ตัดทิ้ง
 * - ยึดตำแหน่งกับ anchor และขยับตามเมื่อเลื่อนหน้า/ปรับขนาดจอ
 * - พื้นที่ด้านล่างไม่พอ -> เปิดขึ้นด้านบน; ไม่ล้นขอบจอซ้าย/ขวา
 * - z-index สูงกว่า Modal ของระบบ (dropdown ใน modal ก็อยู่บนสุด)
 *
 * เจ้าของ dropdown ต้องนับคลิกภายในชั้นลอยเป็น "ข้างใน" (ใช้ ref ที่ส่งเข้ามา)
 */
export interface FloatingLayerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
  className?: string;
  /** ระยะห่างจาก anchor (px) */
  gap?: number;
  /** กว้างเท่ากับ anchor (ค่าเริ่มต้น) — false = กว้างตามเนื้อหา แต่ไม่แคบกว่า anchor */
  matchWidth?: boolean;
  align?: "left" | "right";
  /** ความสูงสูงสุดที่ต้องการ (px) */
  maxHeight?: number;
  minWidth?: number;
  style?: React.CSSProperties;
}

type Placement = { top?: number; bottom?: number; left?: number; right?: number; width?: number; minWidth: number; maxHeight: number };

export const FLOATING_Z = "z-[1000010]";

export const FloatingLayer = React.forwardRef<HTMLDivElement, FloatingLayerProps>(function FloatingLayer(
  { anchorRef, open, children, className, gap = 6, matchWidth = true, align = "left", maxHeight = 320, minWidth, style },
  ref
) {
  const [pos, setPos] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    let frame = 0;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 8;
      const below = vh - r.bottom - gap - margin;
      const above = r.top - gap - margin;
      const openUp = below < Math.min(maxHeight, 220) && above > below;
      const width = matchWidth ? r.width : undefined;
      const minW = Math.max(minWidth || 0, r.width);
      const next: Placement = {
        minWidth: minW,
        maxHeight: Math.max(120, Math.min(maxHeight, openUp ? above : below)),
        ...(width !== undefined ? { width } : {}),
      };
      if (openUp) next.bottom = vh - r.top + gap;
      else next.top = r.bottom + gap;
      if (align === "right") next.right = Math.max(margin, vw - r.right);
      else next.left = Math.max(margin, Math.min(r.left, vw - minW - margin));
      setPos(next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open, anchorRef, gap, matchWidth, align, maxHeight, minWidth]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        right: pos.right,
        width: pos.width,
        minWidth: pos.minWidth,
        maxHeight: pos.maxHeight,
        ...style,
      }}
      className={cn(FLOATING_Z, "overflow-y-auto custom-scrollbar", className)}
    >
      {children}
    </div>,
    document.body
  );
});
