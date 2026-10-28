"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/components/ui/Base";

/**
 * แสดงหน้า PDF ตามขนาดจริงของกระดาษ (100% = 96 px ต่อนิ้ว เท่ากับเอกสารที่พิมพ์) — แทนตัวแสดง PDF ของเบราว์เซอร์ที่ย่อหน้าให้พอดีช่อง
 * ปรับได้: พอดีความกว้าง · ซูม 50–200% · คมชัดตามความละเอียดจอ
 */
export type PdfZoom = "fit" | number;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PX_PER_PT = 96 / 72;

export function PdfPages({ url, className }: { url: string; className?: string }) {
  const [zoom, setZoom] = useState<PdfZoom>(() => { try { const v = localStorage.getItem("nexus.pdf.zoom"); return v === "fit" ? "fit" : Number(v) || 1; } catch { return 1; } });
  const [pages, setPages] = useState<{ src: string; w: number; h: number }[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [boxW, setBoxW] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const shown = useRef<{ src: string }[]>([]);
  useEffect(() => { try { localStorage.setItem("nexus.pdf.zoom", String(zoom)); } catch { /* ไม่สำคัญ */ } }, [zoom]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ขนาดหน้า (pt) จากหน้าแรก — ใช้คำนวณ "พอดีความกว้าง"
  const [pt, setPt] = useState<{ w: number; h: number } | null>(null);
  const scale = zoom === "fit" ? (pt && boxW ? Math.max(0.2, (boxW - 32) / pt.w) : PX_PER_PT) : zoom * PX_PER_PT; // px ต่อ pt บนจอ

  useEffect(() => {
    if (!url) return;
    let cancel = false;
    setBusy(true); setError("");
    (async () => {
      try {
        const { loadPdfjs } = await import("@/components/settings/usePdfPageImage");
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        try {
          const dpr = Math.min(3, window.devicePixelRatio || 1);
          const out: { src: string; w: number; h: number }[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const v1 = page.getViewport({ scale: 1 });
            if (i === 1 && !cancel) setPt((o) => (o && o.w === v1.width && o.h === v1.height ? o : { w: v1.width, h: v1.height }));
            const viewport = page.getViewport({ scale: scale * dpr });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
            const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
            if (blob) out.push({ src: URL.createObjectURL(blob), w: v1.width, h: v1.height });
          }
          if (!cancel) { shown.current.forEach((p) => URL.revokeObjectURL(p.src)); shown.current = out; setPages(out); }
          else out.forEach((p) => URL.revokeObjectURL(p.src));
        } finally { await doc.loadingTask.destroy(); }
      } catch (e: any) { if (!cancel) setError(e?.message || "แสดงเอกสารไม่สำเร็จ"); }
      finally { if (!cancel) setBusy(false); }
    })();
    return () => { cancel = true; };
  }, [url, scale]);
  useEffect(() => () => shown.current.forEach((p) => URL.revokeObjectURL(p.src)), []);

  const step = (d: number) => { const cur = zoom === "fit" ? scale / PX_PER_PT : zoom; const i = ZOOMS.findIndex((z) => z >= cur - 0.001); setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? ZOOMS.length - 1 : i) + d))]); };
  const pct = Math.round((scale / PX_PER_PT) * 100);

  return (
    <div className={cn("relative flex flex-col min-h-0", className)}>
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-white/10">
        {busy && <span className="mr-auto flex items-center gap-1.5 text-[12px] text-white/60"><Loader2 size={12} className="animate-spin" /> กำลังแสดงเอกสาร…</span>}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
        <button type="button" title="ย่อ" aria-label="ย่อ" onClick={() => step(-1)} className="h-7 w-7 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center"><Minus size={14} /></button>
        <span className="w-12 text-center text-[12px] text-white/80 tabular-nums">{pct}%</span>
        <button type="button" title="ขยาย" aria-label="ขยาย" onClick={() => step(1)} className="h-7 w-7 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center"><Plus size={14} /></button>
        <button type="button" onClick={() => setZoom(1)} className={cn("h-7 px-2.5 rounded-full text-[12px]", zoom === 1 ? "bg-nexus-teal/20 text-nexus-teal font-semibold" : "text-white/70 hover:bg-white/10")}>ขนาดจริง</button>
        <button type="button" onClick={() => setZoom("fit")} className={cn("h-7 px-2.5 rounded-full text-[12px]", zoom === "fit" ? "bg-nexus-teal/20 text-nexus-teal font-semibold" : "text-white/70 hover:bg-white/10")}>พอดีความกว้าง</button>
        </div>
      </div>
      <div ref={box} className="flex-1 min-h-0 overflow-auto">
        <div className="flex flex-col items-center gap-4 py-6 px-4 w-max min-w-full">
          {pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- หน้าเอกสารที่วาดในเบราว์เซอร์ (blob URL)
            <img key={i} src={p.src} alt={`หน้า ${i + 1}`} className="block bg-white shadow-2xl max-w-none" style={{ width: p.w * scale, height: p.h * scale }} />
          ))}
        </div>
      </div>
      {error && <div className="absolute inset-0 flex items-center justify-center text-danger text-sm">{error}</div>}
    </div>
  );
}
