"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DocumentModel } from "@/lib/documents/model";
import type { FreeBlock } from "@/lib/documents/design";
import { loadPdfjs } from "./usePdfPageImage";

/**
 * หน้าออกแบบแบบแยกชั้น: วาดแต่ละกล่องเป็นภาพของตัวเอง (ตัวสร้าง PDF เดียวกับที่พิมพ์)
 *  - ลาก/ย้ายกล่อง = เลื่อนภาพของกล่องนั้นทันที ไม่ต้องวาดใหม่
 *  - แก้รูปแบบ/ขนาดกล่อง = วาดใหม่เฉพาะกล่องนั้น (ระหว่างวาดยังเห็นภาพเดิม ไม่กระพริบ)
 *  - เปลี่ยนธีม/ข้อมูลเอกสาร/ซูม = วาดใหม่ทั้งหมด
 * ภาพของกล่อง: ตัดเฉพาะส่วนที่มีหมึก (พื้นโปร่ง) เก็บตำแหน่งเทียบกับมุมกล่อง ณ ตอนวาด
 */
export interface Sprite { url: string; x: number; y: number; w: number; h: number; bx: number; by: number }

/** ค่าที่ใช้เทียบว่าเอกสาร/ธีมเปลี่ยนหรือไม่ (ไม่รวมตำแหน่งกล่อง · ย่อข้อความยาว เช่น รูปโลโก้) */
const stableKey = (v: unknown) => JSON.stringify(v, (k, x) => (k === "blocks" ? undefined : typeof x === "string" && x.length > 400 ? `#${x.length}:${x.slice(0, 48)}${x.slice(-48)}` : x instanceof Set ? [...x].sort() : x));
const contentKey = (b: FreeBlock) => { const { x: _x, y: _y, ...rest } = b; void _x; void _y; return JSON.stringify(rest); };

type Parts = ReturnType<typeof import("@/lib/pdf/FreeLayoutDocument").freeLayoutParts>;

async function rasterize(pdfjs: Awaited<ReturnType<typeof loadPdfjs>>, data: Uint8Array, scale: number): Promise<({ blob: Blob; x: number; y: number; w: number; h: number } | null)[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const out: ({ blob: Blob; x: number; y: number; w: number; h: number } | null)[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      await page.render({ canvas, canvasContext: ctx, viewport, background: "rgba(0,0,0,0)" } as any).promise;
      // ขอบเขตที่มีหมึก (ตัดพื้นโปร่ง)
      const { data: px, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y++) {
        const row = y * width * 4;
        for (let x = 0; x < width; x++) if (px[row + x * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
      }
      if (x1 < 0) { out.push(null); continue; }
      x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(width - 1, x1 + 1); y1 = Math.min(height - 1, y1 + 1);
      const crop = document.createElement("canvas");
      crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
      crop.getContext("2d")!.drawImage(canvas, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
      const blob = await new Promise<Blob | null>((ok) => crop.toBlob(ok, "image/png"));
      out.push(blob ? { blob, x: x0 / scale, y: y0 / scale, w: crop.width / scale, h: crop.height / scale } : null);
    }
    return out;
  } finally { await doc.loadingTask.destroy(); }
}

/** S = px ต่อ pt บนจอ · คืนภาพส่วนหัว/ท้ายหน้า (base) และภาพของแต่ละกล่องตามคีย์ h:/d: */
export function useLayerSprites(model: DocumentModel | null, S: number) {
  const [state, setState] = useState<{ base: Sprite | null; sprites: Map<string, Sprite> }>({ base: null, sprites: new Map() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // คีย์เนื้อหา -> ภาพ (ใช้ซ้ำเมื่อกล่องไม่เปลี่ยน) · กล่อง -> คีย์ที่แสดงอยู่
  const cache = useRef(new Map<string, Sprite>());
  const latest = useRef<{ model: DocumentModel; S: number } | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => () => { cache.current.forEach((s) => URL.revokeObjectURL(s.url)); cache.current.clear(); }, []);

  useEffect(() => {
    if (!model) return;
    latest.current = { model, S };
    if (running.current) return;
    running.current = true;
    (async () => {
      while (latest.current && alive.current) {
        const { model: m, S: scale } = latest.current;
        latest.current = null;
        try {
          const [{ pdf, Document, Page }, sd, fl, pdfjs] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/StandardDocument"), import("@/lib/pdf/FreeLayoutDocument"), loadPdfjs()]);
          sd.registerDocumentFonts(window.location.origin);
          const parts: Parts = fl.freeLayoutParts(m, "original");
          const dpr = Math.min(2, window.devicePixelRatio || 1), px = scale * dpr;
          const global = `${px}|${stableKey({ ...m, seller: { ...m.seller, design: m.seller.design } })}|${stableKey({ shown: parts.c.shown, stamp: parts.c.stampPlaced, sign: parts.c.signPlaced })}`;
          const baseKey = `base|${global}|${parts.parts.length}|${!!parts.copyLabel}|${parts.rest.length}`;
          const want = [{ key: baseKey, node: <>{parts.chrome}{parts.copyLabel}</>, b: null as FreeBlock | null, part: "" }, ...parts.parts.map((p) => ({ key: `${global}|${contentKey(p.b)}`, node: p.node, b: p.b as FreeBlock | null, part: p.key }))];
          const missing = want.filter((w) => !cache.current.has(w.key));
          if (missing.length) {
            if (alive.current) setBusy(true);
            const blob = await pdf(
              <Document>
                {missing.map((w, i) => <Page key={i} size={[parts.pg.w, parts.pg.h]} style={[parts.c.s.page, { padding: 0 }]}>{w.node}</Page>)}
              </Document>,
            ).toBlob();
            const shots = await rasterize(pdfjs, new Uint8Array(await blob.arrayBuffer()), px);
            missing.forEach((w, i) => {
              const r = shots[i];
              cache.current.set(w.key, r ? { url: URL.createObjectURL(r.blob), x: r.x, y: r.y, w: r.w, h: r.h, bx: w.b?.x ?? 0, by: w.b?.y ?? 0 } : { url: "", x: 0, y: 0, w: 0, h: 0, bx: w.b?.x ?? 0, by: w.b?.y ?? 0 });
            });
          }
          // ทิ้งภาพที่ไม่ใช้แล้ว
          const keep = new Set(want.map((w) => w.key));
          for (const [k, s] of cache.current) if (!keep.has(k)) { if (s.url) URL.revokeObjectURL(s.url); cache.current.delete(k); }
          if (alive.current) {
            const sprites = new Map<string, Sprite>();
            want.slice(1).forEach((w) => { const s = cache.current.get(w.key); if (s?.url) sprites.set(w.part, s); });
            const base = cache.current.get(baseKey);
            setState({ base: base?.url ? base : null, sprites });
            setError("");
          }
        } catch (e: any) { if (alive.current) setError(String(e?.message || e)); }
      }
      running.current = false;
      if (alive.current) setBusy(false);
    })();
  }, [model, S]);

  return { ...state, busy, error };
}
