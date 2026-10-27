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

/**
 * พิมพ์ PDF ขนาดเท่ากระดาษจริง (100%): ตัวแสดง PDF ของเบราว์เซอร์พิมพ์แบบ "พอดีพื้นที่พิมพ์" หน้าเอกสารจึงเล็กกว่ากระดาษ
 * — วาดแต่ละหน้าเป็นรูปความละเอียด 200 dpi ลงหน้าพิมพ์ที่ตั้งขนาดกระดาษตรงกับเอกสาร ขอบ 0 แล้วสั่งพิมพ์
 */
export async function printPdfActualSize(pdfUrl: string, dpi = 200): Promise<void> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
  const pages: { src: string; w: number; h: number }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      pages.push({ src: canvas.toDataURL("image/png"), w: v1.width, h: v1.height });
    }
  } finally { await doc.loadingTask.destroy(); }
  if (!pages.length) return;
  const { w, h } = pages[0];
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // กรอบพิมพ์ต้องกว้างเท่ากระดาษจริง (กรอบ 0×0 ทำให้ Chrome ย่อเนื้อหาเหลือ ~75% ชิดมุมซ้ายบน) — วางไว้นอกจอแทนการซ่อน
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}pt;height:${h}pt;border:0;opacity:0;pointer-events:none`;
  document.body.appendChild(frame);
  const d = frame.contentDocument!;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${w}pt ${h}pt;margin:0}html,body{margin:0;padding:0;width:${w}pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}img{display:block;width:${w}pt;height:${h}pt;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>${pages.map((p) => `<img src="${p.src}" alt="">`).join("")}</body></html>`);
  d.close();
  await Promise.all([...d.images].map((im) => (im.complete ? Promise.resolve() : new Promise((ok) => { im.onload = ok; im.onerror = ok; }))));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}

/**
 * ไฟล์ตัวอย่างเอกสาร (รูป หรือ PDF หน้าแรก) → รูป JPEG ด้านยาวไม่เกิน 1600px สำหรับให้ AI อ่าน
 * landscape = หน้ากว้างกว่าสูง
 */
export async function fileToPageImage(file: File): Promise<{ image: string; landscape: boolean }> {
  const MAX = 1600;
  const canvas = document.createElement("canvas");
  if (file.type === "application/pdf") {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
      const page = await doc.getPage(1);
      const v1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: MAX / Math.max(v1.width, v1.height) });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    } finally { await doc.loadingTask.destroy(); }
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      const k = Math.min(1, MAX / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally { URL.revokeObjectURL(url); }
  }
  return { image: canvas.toDataURL("image/jpeg", 0.85), landscape: canvas.width > canvas.height };
}

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
/** enabled = เริ่มวาดเมื่อการ์ดเลื่อนเข้ามาในจอ (แม่แบบหลายสิบแบบไม่วาดพร้อมกันทั้งหมด) */
export function useThumbnail(key: string, make: () => DocumentModel | null, widthPx = 150, enabled = true) {
  const [url, setUrl] = useState(() => thumbCache.get(key) || "");
  useEffect(() => {
    if (thumbCache.has(key)) { setUrl(thumbCache.get(key)!); return; }
    if (!enabled) return;
    let cancel = false;
    const model = make();
    if (!model) return;
    thumbQueue = thumbQueue.then(async () => {
      if (cancel) return;
      try { const [u] = await renderPdfPages(model, widthPx, 1); thumbCache.set(key, u); if (!cancel) setUrl(u); } catch { /* ภาพย่อไม่สำคัญ */ }
    });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- วาดใหม่เมื่อคีย์เปลี่ยนเท่านั้น
  }, [key, widthPx, enabled]);
  return url;
}
