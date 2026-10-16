"use client";

import React, { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * QR code แบบ SVG (คมชัดทุกขนาด พิมพ์ได้) — ใช้กับฉลากตำแหน่งจัดเก็บ, พร้อมเพย์ ฯลฯ
 * level: M = ทนรอยเปื้อน ~15% (เหมาะกับฉลาก), H = ~30%
 */
export function QrCode({ value, size = 120, level = "M", className, title }: { value: string; size?: number | string; level?: "L" | "M" | "Q" | "H"; className?: string; title?: string }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, level);
    qr.addData(value || " ", "Byte");
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { path: d, count: n };
  }, [value, level]);
  const quiet = 2;
  return (
    <svg viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`} width={size} height={size} className={className} role="img" aria-label={title || value} shapeRendering="crispEdges">
      <rect x={-quiet} y={-quiet} width={count + quiet * 2} height={count + quiet * 2} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
