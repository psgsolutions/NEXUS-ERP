"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, Printer, X } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";

/**
 * ตัวดูเอกสาร PDF มาตรฐาน (ใช้ได้ทุกประเภทเอกสาร)
 *  - source: เอกสารที่บันทึกแล้ว -> สร้าง PDF ที่ server (/api/documents/pdf)
 *  - model: ตัวอย่างก่อนบันทึก -> สร้าง PDF ในเบราว์เซอร์ด้วยเทมเพลตเดียวกัน
 */
export interface DocumentPdfSource { type: string; id: string }

async function renderClientPdf(model: DocumentModel, copy: CopyMode): Promise<Blob> {
  const [{ pdf }, { StandardDocument, registerDocumentFonts }] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/StandardDocument")]);
  registerDocumentFonts(window.location.origin);
  return pdf(<StandardDocument doc={model} copy={copy} />).toBlob();
}

export function DocumentPdfViewer({ source, model, className }: { source?: DocumentPdfSource; model?: DocumentModel; className?: string }) {
  const { companyId } = useAuth();
  const [copy, setCopy] = useState<CopyMode>("original");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("document.pdf");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let blob: Blob;
      if (model) {
        blob = await renderClientPdf(model, copy);
        setFileName(`${(model.number || "ตัวอย่าง").replace(/[\\/:*?"<>|\s]+/g, "-")}${copy === "copy" ? "-copy" : ""}.pdf`);
      } else if (source && companyId) {
        const res = await apiFetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, type: source.type, id: source.id, copy }) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "สร้างเอกสารไม่สำเร็จ"); }
        blob = await res.blob();
        const cd = res.headers.get("content-disposition") || "";
        const m = cd.match(/filename="([^"]+)"/);
        setFileName(m ? decodeURIComponent(m[1]) : `${source.id}.pdf`);
      } else return;
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch (e: any) {
      setError(e.message || "สร้างเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [model, source, companyId, copy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const print = () => frame.current?.contentWindow?.print();

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex rounded-full bg-white/5 p-1">
          {(["original", "copy"] as CopyMode[]).map((c) => (
            <button key={c} type="button" onClick={() => setCopy(c)} className={cn("h-8 px-4 rounded-full text-[13px]", copy === c ? "bg-white/15 text-white font-semibold" : "text-white/50 hover:text-white")}>
              {c === "original" ? "ต้นฉบับ" : "สำเนา"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <PillButton variant="glass" className="h-9 px-4 text-xs" disabled={!url || loading} onClick={print}><Printer size={14} /> พิมพ์</PillButton>
          <a href={url || undefined} download={fileName} className={cn("h-9 px-4 rounded-full text-xs font-bold flex items-center gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/20", (!url || loading) && "pointer-events-none opacity-40")}>
            <Download size={14} /> ดาวน์โหลด PDF
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative bg-black/30">
        {loading && <div className="absolute inset-0 flex items-center justify-center gap-2 text-white/50 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังสร้างเอกสาร…</div>}
        {error && !loading && <div className="absolute inset-0 flex items-center justify-center text-danger text-sm px-6 text-center">{error}</div>}
        {url && <iframe ref={frame} src={url} title={fileName} className={cn("w-full h-full border-0", loading && "opacity-0")} />}
      </div>
    </div>
  );
}

/** หน้าต่างดูเอกสาร (ทับหน้าปัจจุบัน) */
export function DocumentPdfModal({ open, onClose, title, source, model }: { open: boolean; onClose: () => void; title: string; source?: DocumentPdfSource; model?: DocumentModel }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-[1100px] h-[92vh] bg-surface-0 border border-white/10 rounded-3xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h3 className="text-[16px] font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white" aria-label="ปิด"><X size={20} /></button>
        </div>
        <DocumentPdfViewer source={source} model={model} className="flex-1" />
      </div>
    </div>,
    document.body
  );
}
