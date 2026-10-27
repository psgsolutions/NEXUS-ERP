"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { docHasCopy } from "@/lib/documents/design";
import { createPortal } from "react-dom";
import { Download, Loader2, Printer, Send, X } from "lucide-react";
import { DocumentSharePanel } from "./DocumentSharePanel";
import { PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { effectiveDocProfile } from "@/lib/customer-doc-profile";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";

/**
 * ตัวดูเอกสาร PDF มาตรฐาน (ใช้ได้ทุกประเภทเอกสาร)
 *  - source: เอกสารที่บันทึกแล้ว -> สร้าง PDF ที่ server (/api/documents/pdf)
 *  - model: ตัวอย่างก่อนบันทึก -> สร้าง PDF ในเบราว์เซอร์ด้วยเทมเพลตเดียวกัน
 */
export interface DocumentPdfSource { type: string; id: string }

async function renderClientPdf(model: DocumentModel, copy: CopyMode): Promise<Blob> {
  const [{ pdf }, { DocumentPdf, registerDocumentFonts }] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/DocumentPdf")]);
  registerDocumentFonts(window.location.origin);
  return pdf(<DocumentPdf doc={model} copy={copy} />).toBlob();
}

/**
 * shareSource: เอกสารที่บันทึกแล้วสำหรับส่ง/แชร์ เมื่อแสดงตัวอย่างจากหน้าจอ (model) เช่น ใบเสนอราคาที่กำลังแก้
 * startShare: เปิดแผงส่ง/แชร์ทันที
 */
export function DocumentPdfViewer({ source, model, className, title = "", shareSource, startShare = false, shareEmail }: { source?: DocumentPdfSource; model?: DocumentModel; className?: string; title?: string; shareSource?: DocumentPdfSource; startShare?: boolean; shareEmail?: string }) {
  const shareDoc = shareSource || (model ? undefined : source);
  const [shareOpen, setShareOpen] = useState(startShare && !!shareDoc);
  const { companyId } = useAuth();
  const [copy, setCopy] = useState<CopyMode>("original");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("document.pdf");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  // ใบวางบิล/ใบส่งของ/ใบเสร็จ (ไม่ใช่ใบกำกับ): เลือกใส่/เว้นวันที่ตอนพิมพ์ และจำเป็นค่าของลูกค้าได้
  type DateOpt = { actual: string; profileUndated: boolean; customerId: string; docKind: "billingNote" | "deliveryNote" | "receipt"; undated: boolean };
  const [dateMode, setDateMode] = useState<"profile" | "dated" | "undated">("profile");
  const [dateOpt, setDateOpt] = useState<DateOpt | null>(null);
  const [learnMsg, setLearnMsg] = useState("");
  // ลายเซ็น/ตราอิเล็กทรอนิกส์ (เอกสารที่ออกจริงและตั้งไว้) — เลือกพิมพ์โดยไม่ใส่ได้
  const [esign, setEsign] = useState(true);
  const [esignAvail, setEsignAvail] = useState(false);
  useEffect(() => { setDateMode("profile"); setLearnMsg(""); setEsign(true); }, [source?.type, source?.id]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let blob: Blob;
      if (model) {
        blob = await renderClientPdf(model, copy);
        setFileName(`${(model.number || "ตัวอย่าง").replace(/[\\/:*?"<>|\s]+/g, "-")}${copy === "copy" ? "-copy" : ""}.pdf`);
      } else if (source && companyId) {
        const res = await apiFetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, type: source.type, id: source.id, copy, dateMode, esign }) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "สร้างเอกสารไม่สำเร็จ"); }
        blob = await res.blob();
        const cd = res.headers.get("content-disposition") || "";
        const m = cd.match(/filename="([^"]+)"/);
        setFileName(m ? decodeURIComponent(m[1]) : `${source.id}.pdf`);
        setEsignAvail(!!res.headers.get("x-esign"));
        const opt = res.headers.get("x-date-option");
        try { setDateOpt(opt ? JSON.parse(decodeURIComponent(opt)) : null); } catch { setDateOpt(null); }
      } else return;
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch (e: any) {
      setError(e.message || "สร้างเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [model, source, companyId, copy, dateMode, esign]);

  // จำรูปแบบวันที่ที่เลือกเป็นค่าของลูกค้ารายนี้ (โปรไฟล์เอกสารลูกค้า)
  const rememberDate = async () => {
    if (!dateOpt?.customerId || !companyId) return;
    setLearnMsg("");
    try {
      const post = (body: any) => apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, entity: "customers", ...body }) }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ"); return d; });
      const { record } = await post({ action: "get", id: dateOpt.customerId });
      const raw = record.docProfile || { orgType: "PRIVATE" };
      if (raw.locked) { setLearnMsg("รูปแบบเอกสารของลูกค้ารายนี้ล็อกอยู่ — แก้ได้ที่หน้าข้อมูลลูกค้า"); return; }
      const list = new Set(effectiveDocProfile(raw).undated);
      if (dateOpt.undated) list.add(dateOpt.docKind); else list.delete(dateOpt.docKind);
      await post({ action: "update", id: dateOpt.customerId, scope: "company", changes: { docProfile: { ...raw, undated: Array.from(list) } } });
      setDateOpt({ ...dateOpt, profileUndated: dateOpt.undated });
      setLearnMsg("จำแล้ว — ครั้งต่อไปพิมพ์แบบนี้ให้ลูกค้ารายนี้อัตโนมัติ");
    } catch (e: any) {
      setLearnMsg(e.message);
    }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // พิมพ์เต็มกระดาษ (100%) — ตัวแสดง PDF ของเบราว์เซอร์ย่อหน้าให้พอดีพื้นที่พิมพ์ (หน้าเล็กกว่ากระดาษ)
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    if (!url) return;
    setPrinting(true);
    try { await (await import("@/components/settings/usePdfPageImage")).printPdfActualSize(url); }
    catch { frame.current?.contentWindow?.print(); }
    finally { setPrinting(false); }
  };
  // 50 ทวิ: ฉบับที่ 1 แนบแบบยื่น / ฉบับที่ 2 ผู้ถูกหักเก็บไว้
  const formCopies = source?.type === "wht" || !!model?.wht50;
  // ต้นฉบับ/สำเนา เฉพาะเอกสารที่ต้องมี (ใบกำกับ ใบเสร็จ ใบวางบิล ใบส่งของ ใบลดหนี้) · 50 ทวิ มีฉบับที่ 1/2
  const noCopy = !formCopies && !docHasCopy(source?.type || model?.type);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className={cn("flex rounded-full bg-white/5 p-1", noCopy && "invisible")}>
          {(["original", "copy"] as CopyMode[]).map((c) => (
            <button key={c} type="button" onClick={() => setCopy(c)} className={cn("h-8 px-4 rounded-full text-[13px]", copy === c ? "bg-white/15 text-white font-semibold" : "text-white/50 hover:text-white")}>
              {formCopies ? (c === "original" ? "ฉบับที่ 1" : "ฉบับที่ 2") : c === "original" ? "ต้นฉบับ" : "สำเนา"}
            </button>
          ))}
        </div>
        {esignAvail && (
          <div className="flex rounded-full bg-white/5 p-1" title="ลายเซ็นและตราประทับอิเล็กทรอนิกส์ (ตั้งค่า › ลายเซ็น · ตราประทับ)">
            {([[true, "ใส่ลายเซ็น/ตรา"], [false, "ไม่ใส่"]] as const).map(([v, label]) => (
              <button key={label} type="button" onClick={() => setEsign(v)} className={cn("h-8 px-4 rounded-full text-[13px]", esign === v ? "bg-white/15 text-white font-semibold" : "text-white/50 hover:text-white")}>{label}</button>
            ))}
          </div>
        )}
        {dateOpt && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-white/5 p-1" title="หน่วยงานบางแห่งให้เว้นวันที่ไว้ลงเอง">
              {([["dated", "ใส่วันที่"], ["undated", "เว้นวันที่"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => { setDateMode(m); setLearnMsg(""); }} className={cn("h-8 px-4 rounded-full text-[13px]", (m === "undated") === dateOpt.undated ? "bg-white/15 text-white font-semibold" : "text-white/50 hover:text-white")}>{label}</button>
              ))}
            </div>
            {dateOpt.customerId && dateOpt.undated !== dateOpt.profileUndated && (
              <button type="button" onClick={rememberDate} className="text-[13px] font-semibold text-nexus-teal hover:underline">จำแบบนี้สำหรับลูกค้ารายนี้</button>
            )}
            {learnMsg && <span className="text-[12px] text-white/60">{learnMsg}</span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* ส่งได้เฉพาะเอกสารที่บันทึกแล้ว (มีเลขที่) */}
          {shareDoc && (
            <PillButton variant={shareOpen ? "confirm" : "glass"} className="h-9 px-4 text-xs" onClick={() => setShareOpen((v) => !v)}><Send size={14} /> ส่ง / แชร์</PillButton>
          )}
          <PillButton variant="glass" className="h-9 px-4 text-xs" disabled={!url || loading || printing} onClick={print}>{printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} พิมพ์</PillButton>
          <a href={url || undefined} download={fileName} className={cn("h-9 px-4 rounded-full text-xs font-bold flex items-center gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/20", (!url || loading) && "pointer-events-none opacity-40")}>
            <Download size={14} /> ดาวน์โหลด PDF
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 relative bg-black/30">
          {loading && <div className="absolute inset-0 flex items-center justify-center gap-2 text-white/50 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังสร้างเอกสาร…</div>}
          {error && !loading && <div className="absolute inset-0 flex items-center justify-center text-danger text-sm px-6 text-center">{error}</div>}
          {url && <iframe ref={frame} src={url} title={fileName} className={cn("w-full h-full border-0", loading && "opacity-0")} />}
        </div>
        {shareOpen && shareDoc && (
          <aside className="w-[340px] max-w-[85vw] shrink-0 border-l border-white/10 overflow-y-auto bg-surface-0">
            <DocumentSharePanel type={shareDoc.type} id={shareDoc.id} defaultTo={shareEmail} title={title || fileName.replace(/.pdf$/, "")} />
          </aside>
        )}
      </div>
    </div>
  );
}

/** หน้าต่างดูเอกสาร (ทับหน้าปัจจุบัน) */
export function DocumentPdfModal({ open, onClose, title, source, model, shareSource, startShare, shareEmail }: { open: boolean; onClose: () => void; title: string; source?: DocumentPdfSource; model?: DocumentModel; shareSource?: DocumentPdfSource; startShare?: boolean; shareEmail?: string }) {
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
        <DocumentPdfViewer source={source} model={model} title={title} shareSource={shareSource} startShare={startShare} shareEmail={shareEmail} className="flex-1 min-h-0" />
      </div>
    </div>,
    document.body
  );
}

/** ปุ่มพิมพ์เล็กในแถวตาราง (ไม่เปิดแถว) */
export function DocumentPrintButton({ onPrint, label }: { onPrint?: () => void; label: string }) {
  if (!onPrint) return null;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onPrint(); }} title={`พิมพ์ ${label}`} aria-label={`พิมพ์ ${label}`}
      className="w-8 h-8 rounded-full border border-white/15 text-white/60 hover:text-white hover:bg-white/[0.05] inline-flex items-center justify-center flex-shrink-0">
      <Printer size={14} />
    </button>
  );
}
