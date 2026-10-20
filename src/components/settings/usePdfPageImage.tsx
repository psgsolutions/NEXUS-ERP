"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DocumentModel } from "@/lib/documents/model";

/**
 * วาดหน้าเอกสาร (PDF จริงจากตัวสร้างเดียวกับที่พิมพ์) เป็นรูป — พื้นกระดาษหน้าออกแบบ ตัวอย่างแบบทันที และภาพย่อแม่แบบ
 * วาดทีละงาน: ระหว่างวาดถ้ามีการแก้เพิ่ม จะวาดเฉพาะฉบับล่าสุดต่อทันที (ไม่ต่อคิวทุกครั้งที่พิมพ์) จึงอัปเดตเร็วแบบเรียลไทม์
 * คืน model ที่ใช้วาดด้วย เพื่อรู้ตำแหน่งกล่อง ณ ตอนวาด (ใช้ตัดภาพกล่องที่กำลังลากให้เลื่อนตามเมาส์)
 */
let pdfjsReady: Promise<typeof import("pdfjs-dist")> | null = null;
const loadPdfjs = () => (pdfjsReady ||= import("pdfjs-dist").then((m) => {
  m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return m;
}));

/** วาดเอกสารเป็นรูป (สูงสุด maxPages หน้า) กว้าง widthPx */
export async function renderPdfPages(model: DocumentModel, widthPx: number, maxPages = 1): Promise<string[]> {
  const [{ pdf }, { DocumentPdf, registerDocumentFonts }, pdfjs] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/DocumentPdf"), loadPdfjs()]);
  registerDocumentFonts(window.location.origin);
  const blob = await pdf(<DocumentPdf doc={model} />).toBlob();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const out: string[] = [];
    for (let i = 1; i <= Math.min(maxPages, doc.numPages); i++) {
      const page = await doc.getPage(i);
      const scale = (widthPx / page.getViewport({ scale: 1 }).width) * Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
      out.push(canvas.toDataURL(widthPx < 300 ? "image/jpeg" : "image/png", 0.85));
    }
    return out;
  } finally { await doc.loadingTask.destroy(); }
}

export function usePdfPageImage(model: DocumentModel | null, widthPx: number, maxPages = 1) {
  const [image, setImage] = useState<{ url: string; pages: string[]; model: DocumentModel } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const latest = useRef<DocumentModel | null>(null);
  const alive = useRef(true);
  // StrictMode (dev) ถอด/ติดตั้งซ้ำ: ต้องตั้งค่ากลับเมื่อติดตั้ง ไม่เช่นนั้นจะไม่วาดอีกเลย
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!model) return;
    latest.current = model;
    if (running.current) return; // งานที่วาดอยู่จะวาดฉบับล่าสุดต่อให้เอง
    running.current = true;
    setBusy(true);
    (async () => {
      while (latest.current && alive.current) {
        const m = latest.current;
        latest.current = null;
        try {
          const pages = await renderPdfPages(m, widthPx, maxPages);
          if (alive.current) { setImage({ url: pages[0], pages, model: m }); setError(""); }
        } catch (e: any) { if (alive.current) setError(String(e?.message || e)); }
      }
      running.current = false;
      if (alive.current) setBusy(false);
    })();
  }, [model, widthPx, maxPages]);

  return { image, busy, error };
}

/** ภาพย่อ (แม่แบบ) — วาดเรียงทีละภาพ เก็บไว้ใช้ซ้ำ */
const thumbCache = new Map<string, string>();
let thumbQueue: Promise<unknown> = Promise.resolve();
export function useThumbnail(key: string, make: () => DocumentModel | null, widthPx = 150) {
  const [url, setUrl] = useState(() => thumbCache.get(key) || "");
  useEffect(() => {
    if (thumbCache.has(key)) { setUrl(thumbCache.get(key)!); return; }
    let cancel = false;
    const model = make();
    if (!model) return;
    thumbQueue = thumbQueue.then(async () => {
      if (cancel) return;
      try { const [u] = await renderPdfPages(model, widthPx, 1); thumbCache.set(key, u); if (!cancel) setUrl(u); } catch { /* ภาพย่อไม่สำคัญ */ }
    });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- วาดใหม่เมื่อคีย์เปลี่ยนเท่านั้น
  }, [key, widthPx]);
  return url;
}
