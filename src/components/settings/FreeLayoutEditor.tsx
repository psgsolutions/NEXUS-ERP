"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ImagePlus, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import type { DocumentModel } from "@/lib/documents/model";
import { A4, BLOCK_LABELS, REQUIRED_BLOCKS, defaultFreeLayout, type BlockKind, type FreeBlock, type FreeLayout } from "@/lib/documents/design";

/**
 * ผังลากวางอิสระ: ลากกล่องเพื่อย้าย ลากมุมขวาล่างเพื่อปรับขนาด คลิกเพื่อแก้คุณสมบัติ
 * กล่องที่เอกสารภาษีต้องมี (ผู้ขาย ชื่อเอกสาร เลขที่/วันที่ ลูกค้า ตาราง ยอดรวม) ย้าย/ปรับได้แต่ลบไม่ได้
 */
const SCALE = 0.8;
const GRID = 2;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const ADDABLE: BlockKind[] = ["text", "line", "rect", "image", "logo", "words", "notes", "payment", "signatures"];
const SINGLE: BlockKind[] = ["logo", "seller", "title", "meta", "party", "items", "totals", "words", "notes", "payment", "signatures"];
const PREVIEW_TEXT: Partial<Record<BlockKind, string>> = {
  seller: "ชื่อบริษัท · ที่อยู่ · เลขผู้เสียภาษี", title: "ชื่อเอกสาร / ต้นฉบับ", meta: "เลขที่ · วันที่ · ครบกำหนด", party: "ลูกค้า · ที่อยู่ · เลขผู้เสียภาษี",
  items: "ตารางรายการ", totals: "รวม · VAT · รวมทั้งสิ้น", words: "(จำนวนเงินตัวอักษร)", notes: "หมายเหตุ", payment: "ข้อมูลการชำระเงิน", signatures: "ช่องลงนาม",
};

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function FreeLayoutEditor({ layout, onChange, model, canEdit, docTitle, onApplyAll }: {
  layout: FreeLayout; onChange: (l: FreeLayout) => void; model: DocumentModel | null; canEdit: boolean; docTitle: string; onApplyAll: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const drag = useRef<{ id: string; mode: "move" | "size"; px: number; py: number; b: FreeBlock } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const blocks = layout.blocks;
  const selected = blocks.find((b) => b.id === sel) || null;

  const update = (id: string, patch: Partial<FreeBlock>) => onChange({ ...layout, blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const clamp = (b: FreeBlock): FreeBlock => ({ ...b, x: Math.max(0, Math.min(A4.w - b.w, b.x)), y: Math.max(0, Math.min(A4.h - b.h, b.y)), w: Math.max(8, Math.min(A4.w, b.w)), h: Math.max(1, Math.min(A4.h, b.h)) });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.px) / SCALE, dy = (e.clientY - d.py) / SCALE;
      const next = d.mode === "move" ? { ...d.b, x: snap(d.b.x + dx), y: snap(d.b.y + dy) } : { ...d.b, w: snap(d.b.w + dx), h: snap(d.b.h + dy) };
      onChange({ ...layout, blocks: layout.blocks.map((b) => (b.id === d.id ? clamp(next) : b)) });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  });

  const start = (e: React.PointerEvent, b: FreeBlock, mode: "move" | "size") => {
    if (!canEdit) return;
    e.preventDefault(); e.stopPropagation();
    setSel(b.id);
    drag.current = { id: b.id, mode, px: e.clientX, py: e.clientY, b };
  };

  const add = (kind: BlockKind) => {
    const id = `${kind}-${Date.now().toString(36)}`;
    const size: Record<string, [number, number]> = { text: [200, 24], line: [300, 1.5], rect: [200, 80], image: [120, 80], logo: [64, 64], signatures: [530, 80], words: [320, 22], notes: [320, 40], payment: [320, 22] };
    const [w, h] = size[kind] || [200, 40];
    onChange({ ...layout, blocks: [...blocks, { id, kind, x: 60, y: 60, w, h, ...(kind === "text" ? { text: "ข้อความ {{number}}", fontSize: 10 } : {}) }] });
    setSel(id);
  };
  const remove = (b: FreeBlock) => { if (REQUIRED_BLOCKS.includes(b.kind)) return; onChange({ ...layout, blocks: blocks.filter((x) => x.id !== b.id) }); setSel(null); };
  const reorder = (b: FreeBlock, dir: -1 | 1) => {
    const i = blocks.findIndex((x) => x.id === b.id), j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...layout, blocks: next });
  };

  const num = (label: string, key: "x" | "y" | "w" | "h" | "fontSize") => (
    <div className="space-y-1">
      <label className="text-[11px] text-white/55 ml-1">{label}</label>
      <PillInput inputMode="decimal" value={selected?.[key] ?? ""} onChange={(e) => selected && update(selected.id, { [key]: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } as any)} className="h-8 w-full text-sm font-mono text-right" />
    </div>
  );
  const colorRow = (label: string, key: "color" | "bg" | "border") => (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-white/60 w-[64px]">{label}</span>
      <input type="color" value={selected?.[key] || "#ffffff"} onChange={(e) => selected && update(selected.id, { [key]: e.target.value } as any)} className="w-8 h-8 rounded bg-transparent border border-white/10" aria-label={label} />
      {selected?.[key] && <button type="button" className="text-[12px] text-white/50 hover:text-white" onClick={() => selected && update(selected.id, { [key]: undefined } as any)}>ไม่มี</button>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <PillCheckbox label={`ใช้ผังลากวางกับ "${docTitle}"`} checked={layout.enabled} onChange={(e) => onChange({ ...layout, enabled: e.target.checked })} disabled={!canEdit} />
        <span className="text-[12px] text-white/45">{layout.enabled ? "พิมพ์ตามผังนี้" : "ยังใช้ธีมมาตรฐาน (เปิดเพื่อใช้ผังนี้)"}</span>
        {canEdit && (
          <div className="ml-auto flex flex-wrap gap-2">
            <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={() => { onChange({ ...defaultFreeLayout(), enabled: layout.enabled }); setSel(null); }}><RotateCcw size={13} /> เริ่มจากผังมาตรฐาน</PillButton>
            <PillButton variant="glass" className="h-9 px-3 text-xs" onClick={onApplyAll}><Copy size={13} /> ใช้ผังนี้กับทุกเอกสาร</PillButton>
          </div>
        )}
      </div>

      {/* จอกว้าง ≥1360px: กระดาษ · คุณสมบัติ · ตัวอย่าง PDF เรียงแถวเดียว เห็นผลทันทีที่ลาก */}
      <div className="flex flex-col min-[1360px]:flex-row gap-4">
        <div className="flex gap-3">
          {/* กระดาษ A4 */}
          <div className="relative bg-white rounded-sm shadow-2xl flex-shrink-0 overflow-hidden select-none" style={{ width: A4.w * SCALE, height: A4.h * SCALE }} onPointerDown={() => setSel(null)}>
            {blocks.map((b) => {
              const req = REQUIRED_BLOCKS.includes(b.kind);
              const on = b.id === sel;
              return (
                <div key={b.id} onPointerDown={(e) => start(e, b, "move")}
                  className={cn("absolute rounded-[2px] cursor-move overflow-hidden", on ? "outline outline-2 outline-[#0d9488] z-10" : "outline outline-1 outline-dashed outline-slate-400/70")}
                  style={{ left: b.x * SCALE, top: b.y * SCALE, width: b.w * SCALE, height: Math.max(2, b.h * SCALE), background: b.kind === "line" ? b.color || "#0d9488" : b.bg || (b.kind === "rect" ? "transparent" : "rgba(13,148,136,0.06)"), border: b.border ? `1px solid ${b.border}` : undefined }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก data URL ในผังเอกสาร */}
                  {b.kind === "image" && b.src ? <img src={b.src} alt="" className="w-full h-full object-contain pointer-events-none" /> : null}
                  {b.kind !== "line" && b.kind !== "rect" && !(b.kind === "image" && b.src) && (
                    <div className="px-1 py-0.5 text-[10px] leading-tight text-slate-700 pointer-events-none" style={{ textAlign: b.align, fontWeight: b.bold ? 700 : 400, color: b.color }}>
                      <span className="font-bold text-[#0d9488]">{BLOCK_LABELS[b.kind]}{req ? " 🔒" : ""}</span>
                      <div className="text-slate-500">{b.kind === "text" ? b.text : PREVIEW_TEXT[b.kind] || ""}</div>
                    </div>
                  )}
                  {on && canEdit && <div onPointerDown={(e) => start(e, b, "size")} className="absolute right-0 bottom-0 w-3 h-3 bg-[#0d9488] cursor-se-resize" />}
                </div>
              );
            })}
          </div>

          {/* คุณสมบัติ */}
          <GlassCard className="p-3 w-[230px] flex-shrink-0 space-y-3 self-start">
            {canEdit && (
              <div className="space-y-1.5">
                <p className="text-[12px] font-bold text-white/70 flex items-center gap-1"><Plus size={13} /> เพิ่มกล่อง</p>
                <div className="flex flex-wrap gap-1.5">
                  {ADDABLE.filter((k) => !SINGLE.includes(k) || !blocks.some((b) => b.kind === k)).map((k) => (
                    <button key={k} type="button" onClick={() => add(k)} className="h-7 px-2.5 rounded-full text-[12px] border border-white/15 text-white/75 hover:border-nexus-teal/50 hover:text-nexus-teal">{BLOCK_LABELS[k]}</button>
                  ))}
                </div>
              </div>
            )}
            {!selected ? (
              <p className="text-[12px] text-white/50 leading-relaxed">คลิกกล่องบนกระดาษเพื่อแก้ไข · ลากเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด · 🔒 = ข้อมูลที่กฎหมายบังคับ (ลบไม่ได้)</p>
            ) : (
              <fieldset disabled={!canEdit} className="space-y-2.5">
                <p className="text-[13px] font-bold text-white flex items-center gap-1.5">{BLOCK_LABELS[selected.kind]}{REQUIRED_BLOCKS.includes(selected.kind) && <Lock size={12} className="text-white/50" />}</p>
                <div className="grid grid-cols-2 gap-2">{num("ซ้าย (pt)", "x")}{num("บน (pt)", "y")}{num("กว้าง", "w")}{num("สูง", "h")}</div>
                {selected.kind === "text" && (
                  <>
                    <textarea value={selected.text || ""} onChange={(e) => update(selected.id, { text: e.target.value })} className="w-full min-h-[70px] rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-[13px] leading-[1.9] text-white" />
                    <p className="text-[11px] text-white/45">ใส่ข้อมูลอัตโนมัติ: {"{{number}} {{date}} {{customer}} {{total}} {{title}}"}</p>
                    <div className="grid grid-cols-2 gap-2">{num("ขนาดอักษร", "fontSize")}
                      <div className="space-y-1"><label className="text-[11px] text-white/55 ml-1">จัดวาง</label>
                        <PillSelect value={selected.align || "left"} onChange={(e) => update(selected.id, { align: e.target.value as any })} className="h-8 w-full text-sm"><option value="left">ซ้าย</option><option value="center">กลาง</option><option value="right">ขวา</option></PillSelect>
                      </div>
                    </div>
                    <PillCheckbox label="ตัวหนา" checked={!!selected.bold} onChange={(e) => update(selected.id, { bold: e.target.checked })} />
                  </>
                )}
                {["seller", "title"].includes(selected.kind) && (
                  <div className="space-y-1"><label className="text-[11px] text-white/55 ml-1">จัดวาง</label>
                    <PillSelect value={selected.align || (selected.kind === "title" ? "right" : "left")} onChange={(e) => update(selected.id, { align: e.target.value as any })} className="h-8 w-full text-sm"><option value="left">ซ้าย</option><option value="center">กลาง</option><option value="right">ขวา</option></PillSelect>
                  </div>
                )}
                {selected.kind === "image" && (
                  <>
                    <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> เลือกรูป (PNG/JPG)</PillButton>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) update(selected.id, { src: await shrinkImage(f) }); }} />
                  </>
                )}
                {selected.kind === "text" && colorRow("สีอักษร", "color")}
                {selected.kind === "line" && colorRow("สีเส้น", "color")}
                {selected.kind !== "line" && colorRow("พื้นหลัง", "bg")}
                {selected.kind !== "line" && colorRow("กรอบ", "border")}
                <div className="flex gap-1.5 pt-1">
                  <PillButton variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => reorder(selected, -1)} title="ไปด้านหลัง"><ArrowDown size={13} /></PillButton>
                  <PillButton variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => reorder(selected, 1)} title="มาด้านหน้า"><ArrowUp size={13} /></PillButton>
                  {!REQUIRED_BLOCKS.includes(selected.kind) && <PillButton variant="ghost" className="h-8 px-2.5 text-xs text-danger ml-auto" onClick={() => remove(selected)}><Trash2 size={13} /> ลบ</PillButton>}
                </div>
              </fieldset>
            )}
          </GlassCard>
        </div>

        <div className="flex-1 min-w-0 h-[880px] min-[1360px]:h-[700px] rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-white/[0.02]">
          <div className="px-4 pt-3 text-[13px] text-white/60">ตัวอย่าง PDF ของผังนี้{layout.enabled ? "" : " — ยังไม่ใช้พิมพ์จริง (ติ๊ก \"ใช้ผังลากวาง\" ด้านบนเพื่อใช้)"}</div>
          {model && <DocumentPdfViewer model={model} className="flex-1" />}
        </div>
      </div>
    </div>
  );
}
