"use client";

import React, { useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { PillButton } from "@/components/ui/Base";

/** พื้นตารางหมากรุก: เห็นว่ารูปตรา/ลายเซ็นพื้นโปร่งใส */
export const CHECKER = { backgroundColor: "#ffffff", backgroundImage: "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)", backgroundSize: "14px 14px", backgroundPosition: "0 0,0 7px,7px -7px,-7px 0" };

/**
 * เตรียมรูปตรา/ลายเซ็น: ย่อด้านยาวไม่เกิน max px · เก็บ PNG คงพื้นโปร่ง
 * dropWhite = ทำพื้นขาว/เทาอ่อนเป็นโปร่งใส (รูปสแกนหรือถ่ายจากกระดาษ) แล้วตัดขอบว่างออก
 */
export async function prepareMark(src: File | string, limit: number, max = 600, dropWhite = true): Promise<string> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    for (const m of [max, 480, 360, 260]) {
      const k = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, c.width, c.height);
      const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let i = 0; i < d.length; i += 4) {
        if (dropWhite) {
          const light = Math.min(d[i], d[i + 1], d[i + 2]);
          // ขาว → โปร่งใส · เกือบขาว → โปร่งบางส่วน (ขอบหมึกเนียน)
          if (light > 235) d[i + 3] = 0; else if (light > 200) d[i + 3] = Math.min(d[i + 3], Math.round(((235 - light) / 35) * 255));
        }
        if (d[i + 3] > 16) { const p = i / 4, x = p % c.width, y = (p - x) / c.width; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      g.putImageData(px, 0, 0);
      let out = c;
      if (x1 >= x0 && y1 >= y0) {
        const pad = 4, w = Math.min(c.width, x1 - x0 + 1 + pad * 2), h = Math.min(c.height, y1 - y0 + 1 + pad * 2);
        out = document.createElement("canvas"); out.width = w; out.height = h;
        out.getContext("2d")!.drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), w, h, 0, 0, w, h);
      }
      const data = out.toDataURL("image/png");
      if (data.length <= limit) return data;
    }
    throw new Error("รูปใหญ่เกินไป ลองไฟล์ที่เล็กลง");
  } finally { if (typeof src !== "string") URL.revokeObjectURL(url); }
}

/** ช่องเซ็นด้วยเมาส์/นิ้ว */
export function SignPad({ onDone, onCancel }: { onDone: (data: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height }; };
  const down = (e: React.PointerEvent) => { ref.current!.setPointerCapture(e.pointerId); last.current = pos(e); };
  const move = (e: React.PointerEvent) => {
    if (!last.current) return;
    const p = pos(e), g = ref.current!.getContext("2d")!;
    g.strokeStyle = "#0f2a6b"; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    last.current = p; setDrawn(true);
  };
  const clear = () => { ref.current!.getContext("2d")!.clearRect(0, 0, 900, 300); setDrawn(false); };
  return (
    <div className="space-y-2">
      <canvas ref={ref} width={900} height={300} onPointerDown={down} onPointerMove={move} onPointerUp={() => (last.current = null)} onPointerLeave={() => (last.current = null)}
        className="w-full aspect-[3/1] rounded-xl bg-white touch-none cursor-crosshair border border-white/10" aria-label="ช่องเซ็นชื่อ" />
      <div className="flex gap-2 justify-end">
        <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={clear}><Eraser size={13} /> ล้าง</PillButton>
        <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={onCancel}>ยกเลิก</PillButton>
        <PillButton variant="confirm" className="h-8 px-3 text-xs" disabled={!drawn} onClick={() => onDone(ref.current!.toDataURL("image/png"))}>ใช้ลายเซ็นนี้</PillButton>
      </div>
    </div>
  );
}
