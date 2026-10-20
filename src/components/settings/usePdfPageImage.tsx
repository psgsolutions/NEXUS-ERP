"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DocumentModel } from "@/lib/documents/model";

/**
 * วาดหน้าแรกของเอกสาร (PDF จริงจากตัวสร้างเดียวกับที่พิมพ์) เป็นรูป สำหรับพื้นกระดาษในหน้าออกแบบลากวาง
 * คืน model ที่ใช้วาดด้วย เพื่อรู้ตำแหน่งกล่อง ณ ตอนวาด (ใช้ตัดภาพกล่องที่กำลังลากให้เลื่อนตามเมาส์)
 */
let pdfjsReady: Promise<typeof import("pdfjs-dist")> | null = null;
const loadPdfjs = () => (pdfjsReady ||= import("pdfjs-dist").then((m) => {
  m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return m;
}));

export function usePdfPageImage(model: DocumentModel | null, widthPx: number) {
  const [image, setImage] = useState<{ url: string; model: DocumentModel } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    if (!model) return;
    const my = ++seq.current;
    setBusy(true);
    (async () => {
      const [{ pdf }, { DocumentPdf, registerDocumentFonts }, pdfjs] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/DocumentPdf"), loadPdfjs()]);
      registerDocumentFonts(window.location.origin);
      const blob = await pdf(<DocumentPdf doc={model} />).toBlob();
      if (my !== seq.current) return;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      try {
        const page = await doc.getPage(1);
        const scale = (widthPx / page.getViewport({ scale: 1 }).width) * Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        if (my === seq.current) { setImage({ url: canvas.toDataURL("image/png"), model }); setError(""); }
      } finally { await doc.loadingTask.destroy(); }
    })()
      .catch((e) => { if (my === seq.current) setError(String(e?.message || e)); })
      .finally(() => { if (my === seq.current) setBusy(false); });
  }, [model, widthPx]);

  return { image, busy, error };
}
