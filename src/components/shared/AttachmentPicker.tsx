"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, FileText, ImagePlus, Loader2, Paperclip, X } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { prepareAttachment, type AttachmentOwner, type PendingFile } from "@/lib/attachments";

/**
 * แนบรูปใบเสร็จ/บิล/PDF ทีละหลายไฟล์ — เลือกหลายไฟล์พร้อมกัน หรือถ่ายรูปจากมือถือ · ย่อรูปในเบราว์เซอร์ก่อนส่ง
 *  - pending: ไฟล์ที่ยังไม่บันทึก (รายการยังไม่ถูกสร้าง) — หน้าจอเรียก uploadAttachments หลังบันทึกรายการแล้ว
 *  - ownerType + ownerId: แสดง/เปิด/ลบไฟล์ที่แนบไว้แล้ว และอัปโหลดเพิ่มได้ทันที
 */
export async function uploadAttachments(companyId: string, ownerType: AttachmentOwner, ownerId: string, files: PendingFile[], onProgress?: (done: number) => void) {
  let done = 0;
  for (const file of files) {
    const res = await apiFetch("/api/attachments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "upload", ownerType, ownerId, file }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(`${file.name}: ${d.error || "อัปโหลดไม่สำเร็จ"}`);
    onProgress?.(++done);
  }
}

type Saved = { id: string; name: string; mime: string; size: number; uploadedByName?: string };

export function AttachmentPicker({ pending, onPending, ownerType, ownerId, disabled, hint }: {
  pending?: PendingFile[]; onPending?: (files: PendingFile[]) => void;
  ownerType?: AttachmentOwner; ownerId?: string; disabled?: boolean; hint?: string;
}) {
  const { companyId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<{ name: string; mime: string; data: string } | null>(null);
  const live = !!(ownerType && ownerId);

  const post = useCallback(async (body: Record<string, any>) => {
    const res = await apiFetch("/api/attachments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  const reload = useCallback(async () => { if (live && companyId) setSaved((await post({ action: "list", ownerType, ownerId })).files); }, [live, companyId, post, ownerType, ownerId]);
  useEffect(() => { reload().catch((e: any) => setError(`โหลดไฟล์แนบไม่สำเร็จ: ${e.message}`)); }, [reload]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    const prepared: PendingFile[] = [];
    for (const [i, f] of Array.from(list).entries()) {
      setBusy(`กำลังย่อรูป ${i + 1}/${list.length}…`);
      try { prepared.push(await prepareAttachment(f)); } catch (e: any) { setError(e.message); }
    }
    if (live && companyId) {
      try { await uploadAttachments(companyId, ownerType!, ownerId!, prepared, (n) => setBusy(`กำลังอัปโหลด ${n}/${prepared.length}…`)); } catch (e: any) { setError(e.message); }
      await reload().catch((e: any) => setError(`โหลดไฟล์แนบไม่สำเร็จ: ${e.message}`));
    } else onPending?.([...(pending || []), ...prepared]);
    setBusy("");
  };
  const open = async (f: Saved) => { try { setView((await post({ action: "get", id: f.id })).file); } catch (e: any) { setError(e.message); } };
  const remove = async (f: Saved) => { try { await post({ action: "remove", id: f.id }); await reload(); } catch (e: any) { setError(e.message); } };

  const tile = "relative w-[86px] h-[86px] rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden flex items-center justify-center";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {saved.map((f) => (
          <div key={f.id} className={tile} title={`${f.name}${f.uploadedByName ? ` · ${f.uploadedByName}` : ""}`}>
            <button type="button" onClick={() => open(f)} className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/70 hover:text-white">
              {f.mime === "application/pdf" ? <FileText size={22} /> : <Paperclip size={20} />}
              <span className="text-[10px] px-1 truncate max-w-full">{f.name}</span>
            </button>
            {!disabled && <button type="button" onClick={() => remove(f)} aria-label={`ลบ ${f.name}`} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={12} /></button>}
          </div>
        ))}
        {(pending || []).map((f, i) => (
          <div key={`${f.name}-${i}`} className={tile} title={f.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- รูปที่เพิ่งเลือก (data URL) */}
            {f.mime === "application/pdf" ? <FileText size={22} className="text-white/70" /> : <img src={f.data} alt={f.name} className="w-full h-full object-cover" />}
            {!disabled && <button type="button" onClick={() => onPending?.((pending || []).filter((_x, j) => j !== i))} aria-label={`เอา ${f.name} ออก`} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={12} /></button>}
          </div>
        ))}
        {!disabled && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} className={cn(tile, "border-dashed hover:border-nexus-teal/50 flex-col gap-1 text-white/55 hover:text-white")}>
              <ImagePlus size={20} /><span className="text-[10.5px]">เลือกหลายไฟล์</span>
            </button>
            <button type="button" onClick={() => camRef.current?.click()} className={cn(tile, "border-dashed hover:border-nexus-teal/50 flex-col gap-1 text-white/55 hover:text-white")}>
              <Camera size={20} /><span className="text-[10.5px]">ถ่ายรูป</span>
            </button>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {busy && <p className="text-[12px] text-nexus-teal flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {busy}</p>}
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {hint && !busy && <p className="text-[11.5px] text-white/40">{hint}</p>}
      {view && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4" onClick={() => setView(null)}>
          <div className="absolute inset-0 bg-black/85" />
          <div className="relative max-w-[95vw] max-h-[92vh] flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {view.mime === "application/pdf"
              ? <iframe title={view.name} src={view.data} className="w-[90vw] h-[85vh] rounded-xl bg-white" />
              // eslint-disable-next-line @next/next/no-img-element -- ไฟล์แนบ (data URL)
              : <img src={view.data} alt={view.name} className="max-w-[92vw] max-h-[85vh] rounded-xl" />}
            <div className="flex gap-2">
              <a href={view.data} download={view.name} className="h-9 px-4 rounded-full text-xs font-bold flex items-center bg-white/10 text-white border border-white/20">ดาวน์โหลด</a>
              <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={() => setView(null)}>ปิด</PillButton>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** หน้าต่างไฟล์แนบของรายการ (ดู เพิ่ม ลบ) */
export function AttachmentsDialog({ open, onClose, title, ownerType, ownerId, disabled }: { open: boolean; onClose: () => void; title: string; ownerType: AttachmentOwner; ownerId: string; disabled?: boolean }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[99000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-[560px] rounded-2xl border border-white/10 bg-surface-0 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-bold text-white flex items-center gap-2"><Paperclip size={16} className="text-nexus-teal" /> {title}</p>
          <button type="button" onClick={onClose} aria-label="ปิด" className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"><X size={16} /></button>
        </div>
        <AttachmentPicker ownerType={ownerType} ownerId={ownerId} disabled={disabled} hint="คลิกไฟล์เพื่อเปิดดู · เพิ่มได้หลายไฟล์พร้อมกัน" />
      </div>
    </div>,
    document.body,
  );
}
