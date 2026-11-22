"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * ชั้นลอยสำหรับ dropdown / เมนู: แสดงที่ระดับ document.body (อยู่หน้าสุดเสมอ)
 * จึงไม่ถูกการ์ดหรือกล่องที่ตั้ง overflow-hidden / scroll ตัดทิ้ง
 * - ยึดตำแหน่งกับ anchor และขยับตามเมื่อเลื่อนหน้า/ปรับขนาดจอ
 * - พื้นที่ด้านล่างไม่พอ -> เปิดขึ้นด้านบน; ไม่ล้นขอบจอซ้าย/ขวา
 * - z-index สูงกว่า Modal ของระบบ (dropdown ใน modal ก็อยู่บนสุด)
 * - fit: กว้างตามข้อความยาวสุด (ไม่แคบกว่าช่อง ไม่เกิน fitMaxWidth/จอ) — ใช้กับ dropdown ทุกแบบ ช่องสั้นก็อ่านตัวเลือกได้ครบ
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
  /** กว้างตามเนื้อหา (ไม่แคบกว่า anchor) แล้วขยับไม่ให้ล้นขอบจอ */
  fit?: boolean;
  /** ความกว้างสูงสุดเมื่อ fit (px) */
  fitMaxWidth?: number;
  style?: React.CSSProperties;
}

type Placement = { top?: number; bottom?: number; left?: number; right?: number; width?: number | string; minWidth: number; maxWidth?: number; maxHeight: number };

export const FLOATING_Z = "z-[1000010]";

export const FloatingLayer = React.forwardRef<HTMLDivElement, FloatingLayerProps>(function FloatingLayer(
  { anchorRef, open, children, className, gap = 6, matchWidth = true, align = "left", maxHeight = 320, minWidth, fit = false, fitMaxWidth = 480, style },
  ref
) {
  const [pos, setPos] = useState<Placement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const reposition = useRef<(() => void) | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

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
      const width = fit ? "max-content" : matchWidth ? r.width : undefined;
      const maxW = fit ? Math.max(r.width, Math.min(fitMaxWidth, vw - margin * 2)) : undefined;
      const minW = Math.min(Math.max(minWidth || 0, r.width), vw - margin * 2);
      // เมนูกว้างกว่าช่อง: ใช้ความกว้างจริงที่วัดได้ ขยับซ้ายไม่ให้ล้นขอบขวา
      const realW = fit && inner.current ? inner.current.offsetWidth : minW;
      const next: Placement = {
        minWidth: minW,
        ...(maxW !== undefined ? { maxWidth: maxW } : {}),
        maxHeight: Math.max(120, Math.min(maxHeight, openUp ? above : below)),
        ...(width !== undefined ? { width } : {}),
      };
      if (openUp) next.bottom = vh - r.top + gap;
      else next.top = r.bottom + gap;
      if (align === "right") next.right = Math.max(margin, vw - r.right);
      else next.left = Math.max(margin, Math.min(r.left, vw - Math.max(minW, realW) - margin));
      setPos((cur) => (cur && JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    reposition.current = schedule;
    update();
    // วัดความกว้างจริงหลังแสดงผลครั้งแรก (fit) แล้ววางตำแหน่งใหม่
    if (fit) schedule();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      reposition.current = null;
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open, anchorRef, gap, matchWidth, align, maxHeight, minWidth, fit, fitMaxWidth]);

  // fit: เนื้อหาเปลี่ยน (พิมพ์ค้นหา/โหลดตัวเลือก) → ความกว้างเปลี่ยน → วางตำแหน่งใหม่ไม่ให้ล้นจอ
  const shown = !!pos;
  useLayoutEffect(() => {
    const el = inner.current;
    if (!fit || !open || !shown || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => reposition.current?.());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, open, shown]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={setRef}
      style={{
        position: "fixed",
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        right: pos.right,
        width: pos.width,
        minWidth: pos.minWidth,
        maxWidth: pos.maxWidth,
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
