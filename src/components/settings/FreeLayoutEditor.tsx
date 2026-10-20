"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, ImagePlus, Loader2, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import type { DocumentModel } from "@/lib/documents/model";
import {
  A4, BLOCK_LABELS, BLOCK_PARTS, HEAD_KINDS, ITEM_COLUMNS, TEXT_BLOCKS, addableBlocksFor, defaultFreeLayout, requiredBlocksFor, requiredColumnsFor, resolveDesign,
  type BlockKind, type FontFamily, type FreeBlock, type FreeLayout, type ItemColumn, type Letterhead,
} from "@/lib/documents/design";
import { usePdfPageImage } from "./usePdfPageImage";

/**
 * ผังลากวางอิสระ — แก้บนหน้าเอกสารจริง
 *  - พื้นกระดาษคือหน้าแรกของ PDF จริง (ตัวสร้างเดียวกับตอนพิมพ์) อัปเดตหลังหยุดแก้ครู่หนึ่ง
 *    ระหว่างลาก เนื้อหาของกล่องเลื่อนตามเมาส์ (ตัดจากภาพล่าสุด)
 *  - กล่องมี 2 กลุ่ม: หัวกระดาษ (ใช้ร่วมหลายเอกสาร) และเนื้อเอกสาร (เฉพาะชนิดนี้)
 *  - คลิกกล่องเพื่อแก้: ตำแหน่ง ขนาดตัวอักษร ระยะบรรทัด จัดวาง สี ส่วนย่อยที่แสดง คอลัมน์ตาราง ช่องลงนาม
 *  - กล่องที่เอกสารภาษีต้องมี ย้าย/ปรับได้แต่ลบไม่ได้ · ปุ่มลูกศรขยับทีละ 1pt (Shift = 10pt) · Delete ลบกล่อง
 */
const S = 1; // px ต่อ pt บนจอ
const GRID = 2;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const SINGLE: BlockKind[] = ["logo", "seller", "title", "meta", "party", "items", "totals", "words", "notes", "payment", "signatures"];
const ALIGNABLE: BlockKind[] = ["seller", "title", "meta", "text", "words", "notes", "payment"];
type Zone = "head" | "doc";
type Item = { key: string; zone: Zone; b: FreeBlock };

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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><label className="text-[11px] text-white/55 ml-1">{label}</label>{children}</div>
);

export function FreeLayoutEditor({ docType, font, layout, onChange, letterhead, onLetterheadChange, letterOnly, model, canEdit, docTitle, defaultColumns, defaultSignatures, onApplyAll }: {
  docType: string; font: FontFamily;
  layout: FreeLayout; onChange: (l: FreeLayout) => void;
  letterhead: Letterhead | null; onLetterheadChange: (l: Letterhead) => void;
  /** หนังสือ: แก้ได้เฉพาะหัวกระดาษ เนื้อหาจัดตามรูปแบบหนังสือ */
  letterOnly: boolean;
  model: DocumentModel | null; canEdit: boolean; docTitle: string;
  defaultColumns: ItemColumn[]; defaultSignatures: string[];
  onApplyAll: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const drag = useRef<{ key: string; mode: "move" | "size" | "head"; px: number; py: number; b: FreeBlock; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { image, busy, error } = usePdfPageImage(model, A4.w * S);

  const bodyOn = !letterOnly && layout.enabled;
  const headKinds = new Set((letterhead?.blocks || []).filter((b) => SINGLE.includes(b.kind)).map((b) => b.kind));
  const items: Item[] = [
    ...(letterhead?.blocks || []).map((b) => ({ key: `h:${b.id}`, zone: "head" as Zone, b })),
    ...(bodyOn ? layout.blocks.filter((b) => !headKinds.has(b.kind)).map((b) => ({ key: `d:${b.id}`, zone: "doc" as Zone, b })) : []),
  ];
  const selected = items.find((i) => i.key === sel) || null;
  const required = requiredBlocksFor(docType);
  const isLocked = (it: Item) => !letterOnly && required.includes(it.b.kind) && items.filter((x) => x.b.kind === it.b.kind).length <= 1;

  // ตำแหน่งกล่อง ณ ตอนวาดภาพล่าสุด (ตัดภาพให้กล่องที่ถูกย้าย)
  const shot = useMemo(() => {
    const m = new Map<string, FreeBlock>();
    if (!image) return m;
    const r = resolveDesign(image.model.seller.design, docType, image.model.seller.brandColor);
    for (const b of r.letterhead?.blocks || []) m.set(`h:${b.id}`, b);
    if (r.doc.free?.enabled) for (const b of r.doc.free.blocks) m.set(`d:${b.id}`, b);
    return m;
  }, [image, docType]);

  const clamp = (b: FreeBlock): FreeBlock => {
    const w = Math.max(8, Math.min(A4.w, b.w)), h = Math.max(1, Math.min(A4.h, b.h));
    return { ...b, w, h, x: Math.max(0, Math.min(A4.w - w, b.x)), y: Math.max(0, Math.min(A4.h - h, b.y)) };
  };
  const setBlock = (key: string, next: FreeBlock | null) => {
    const [zone, id] = [key.slice(0, 1), key.slice(2)];
    if (zone === "h" && letterhead) {
      onLetterheadChange({ ...letterhead, blocks: next ? letterhead.blocks.map((b) => (b.id === id ? next : b)) : letterhead.blocks.filter((b) => b.id !== id) });
    } else {
      onChange({ ...layout, blocks: next ? layout.blocks.map((b) => (b.id === id ? next : b)) : layout.blocks.filter((b) => b.id !== id) });
    }
  };
  const update = (it: Item, patch: Partial<FreeBlock>) => setBlock(it.key, clamp({ ...it.b, ...patch }));
  /** ล้างค่าของกล่อง (กลับไปใช้ค่าตามธีม) */
  const unset = (it: Item, ...keys: (keyof FreeBlock)[]) => { const n: any = { ...it.b }; for (const k of keys) delete n[k]; setBlock(it.key, n); };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.px) / S, dy = (e.clientY - d.py) / S;
      if (d.mode === "head") { if (letterhead) onLetterheadChange({ ...letterhead, height: Math.max(40, Math.min(320, snap(d.h + dy))) }); return; }
      setBlock(d.key, clamp(d.mode === "move" ? { ...d.b, x: snap(d.b.x + dx), y: snap(d.b.y + dy) } : { ...d.b, w: snap(d.b.w + dx), h: snap(d.b.h + dy) }));
    };
    const up = () => { drag.current = null; };
    const key = (e: KeyboardEvent) => {
      if (!selected || !canEdit) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const step = e.shiftKey ? 10 : 1;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (delta[e.key]) { e.preventDefault(); update(selected, { x: selected.b.x + delta[e.key][0], y: selected.b.y + delta[e.key][1] }); }
      else if ((e.key === "Delete" || e.key === "Backspace") && !isLocked(selected)) { e.preventDefault(); setBlock(selected.key, null); setSel(null); }
      else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", key); };
  });

  const start = (e: React.PointerEvent, it: Item, mode: "move" | "size") => {
    e.stopPropagation();
    setSel(it.key);
    if (!canEdit) return;
    e.preventDefault();
    drag.current = { key: it.key, mode, px: e.clientX, py: e.clientY, b: it.b, h: 0 };
  };
  const startHead = (e: React.PointerEvent) => {
    if (!canEdit || !letterhead) return;
    e.preventDefault(); e.stopPropagation();
    drag.current = { key: "", mode: "head", px: e.clientX, py: e.clientY, b: letterhead.blocks[0], h: letterhead.height };
  };

  const addZone: Zone = letterOnly || !bodyOn ? "head" : "doc";
  const addable = (letterOnly ? HEAD_KINDS.filter((k) => k !== "title" && k !== "meta") : !bodyOn ? HEAD_KINDS : addableBlocksFor(docType)).filter((k) => !SINGLE.includes(k) || !items.some((i) => i.b.kind === k));
  const add = (kind: BlockKind) => {
    const id = `${kind}-${Date.now().toString(36)}`;
    const size: Record<string, [number, number]> = { text: [200, 24], line: [300, 1.5], rect: [200, 80], image: [120, 80], logo: [64, 64], signatures: [530, 80], words: [320, 22], notes: [320, 40], payment: [320, 22], totals: [212, 80] };
    const [w, h] = size[kind] || [200, 40];
    const b: FreeBlock = { id, kind, x: 60, y: addZone === "head" ? 30 : 160, w, h, ...(kind === "text" ? { text: "ข้อความ {{number}}", fontSize: 10 } : {}) };
    if (addZone === "head" && letterhead) onLetterheadChange({ ...letterhead, blocks: [...letterhead.blocks, b] });
    else onChange({ ...layout, blocks: [...layout.blocks, b] });
    setSel(`${addZone === "head" ? "h" : "d"}:${id}`);
  };
  /** ย้ายกล่องระหว่างหัวกระดาษ (ใช้ร่วม) กับเนื้อเอกสาร */
  const moveZone = (it: Item) => {
    if (!letterhead) return;
    const id = `${it.b.id}-${Date.now().toString(36).slice(-3)}`;
    if (it.zone === "doc") {
      onLetterheadChange({ ...letterhead, blocks: [...letterhead.blocks, { ...it.b, id }] });
      onChange({ ...layout, blocks: layout.blocks.filter((b) => b.id !== it.b.id) });
      setSel(`h:${id}`);
    } else {
      onChange({ ...layout, blocks: [...layout.blocks.filter((b) => b.kind !== it.b.kind || !SINGLE.includes(b.kind)), { ...it.b, id }] });
      onLetterheadChange({ ...letterhead, blocks: letterhead.blocks.filter((b) => b.id !== it.b.id) });
      setSel(`d:${id}`);
    }
  };
  const reorder = (it: Item, dir: -1 | 1) => {
    const list = it.zone === "head" ? letterhead!.blocks : layout.blocks;
    const i = list.findIndex((x) => x.id === it.b.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    if (it.zone === "head") onLetterheadChange({ ...letterhead!, blocks: next }); else onChange({ ...layout, blocks: next });
  };

  const colorRow = (it: Item, label: string, key: "color" | "bg" | "border") => (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-white/60 w-[64px]">{label}</span>
      <input type="color" value={it.b[key] || "#ffffff"} onChange={(e) => update(it, { [key]: e.target.value } as any)} className="w-8 h-8 rounded bg-transparent border border-white/10" aria-label={label} />
      {it.b[key] && <button type="button" className="text-[12px] text-white/50 hover:text-white" onClick={() => unset(it, key)}>{key === "color" ? "ตามธีม" : "ไม่มี"}</button>}
    </div>
  );
  const numInput = (it: Item, key: "x" | "y" | "w" | "h") => (
    <PillInput inputMode="decimal" value={Math.round(it.b[key] * 10) / 10} onChange={(e) => update(it, { [key]: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } as any)} className="h-8 w-full text-sm font-mono text-right" />
  );

  const props = (it: Item) => {
    const b = it.b;
    const parts = BLOCK_PARTS[b.kind] || [];
    const hide = new Set(b.hide || []);
    const cols = b.cols?.length ? b.cols : defaultColumns;
    const reqCols = requiredColumnsFor(docType);
    return (
      <fieldset disabled={!canEdit} className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold text-white">{BLOCK_LABELS[b.kind]}</p>
          {isLocked(it) && <Lock size={12} className="text-white/50" />}
          <span className={cn("ml-auto text-[10.5px] px-2 py-0.5 rounded-full", it.zone === "head" ? "bg-purple-500/15 text-purple-200" : "bg-nexus-teal/15 text-nexus-teal")}>{it.zone === "head" ? "หัวกระดาษ" : "เนื้อเอกสาร"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="ซ้าย (pt)">{numInput(it, "x")}</Field><Field label="บน (pt)">{numInput(it, "y")}</Field>
          <Field label="กว้าง">{numInput(it, "w")}</Field><Field label="สูง">{numInput(it, "h")}</Field>
        </div>

        {b.kind === "text" && (
          <>
            <textarea value={b.text || ""} onChange={(e) => update(it, { text: e.target.value })} className="w-full min-h-[70px] rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-[13px] leading-[1.9] text-white" />
            <p className="text-[11px] text-white/45">ใส่ข้อมูลอัตโนมัติ: {"{{number}} {{date}} {{customer}} {{total}} {{title}}"}</p>
          </>
        )}

        {TEXT_BLOCKS.includes(b.kind) && (
          <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">ตัวอักษร</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={b.kind === "text" ? "ขนาด (pt)" : "ขนาด (pt) ว่าง=ตามธีม"}>
                <PillInput inputMode="decimal" value={b.fontSize ?? ""} placeholder="ธีม" onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ""); if (v === "") unset(it, "fontSize"); else update(it, { fontSize: Math.min(40, Number(v)) || 6 }); }} className="h-8 w-full text-sm font-mono text-right" />
              </Field>
              {ALIGNABLE.includes(b.kind) && (
                <Field label="จัดวาง">
                  <PillSelect value={b.align || ""} onChange={(e) => (e.target.value ? update(it, { align: e.target.value as any }) : unset(it, "align"))} className="h-8 w-full text-sm">
                    <option value="">ค่าเดิม</option><option value="left">ชิดซ้าย</option><option value="center">กึ่งกลาง</option><option value="right">ชิดขวา</option>
                  </PillSelect>
                </Field>
              )}
            </div>
            <Field label={`ระยะบรรทัด ${(b.lineHeight ?? 1.35).toFixed(2)} เท่า`}>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={2.5} step={0.05} value={b.lineHeight ?? 1.35} onChange={(e) => update(it, { lineHeight: Number(e.target.value) })} className="flex-1 accent-[#0d9488] h-8" />
                {b.lineHeight !== undefined && <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => unset(it, "lineHeight")}>รีเซ็ต</button>}
              </div>
            </Field>
            {colorRow(it, "สีอักษร", "color")}
            {b.kind === "text" && <PillCheckbox label="ตัวหนา" checked={!!b.bold} onChange={(e) => update(it, { bold: e.target.checked })} />}
          </div>
        )}

        {parts.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">ข้อมูลที่แสดง</p>
            {parts.map((p) => (
              <PillCheckbox key={p.key} label={p.label} checked={!hide.has(p.key)} onChange={(e) => update(it, { hide: e.target.checked ? [...hide].filter((k) => k !== p.key) : [...hide, p.key] })} />
            ))}
            {(b.kind === "seller" || b.kind === "party") && <p className="text-[11px] text-white/40">ชื่อ ที่อยู่ เลขผู้เสียภาษี แสดงเสมอ (กฎหมายกำหนด)</p>}
          </div>
        )}

        {b.kind === "items" && (
          <div className="space-y-1.5 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">คอลัมน์ในตาราง</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {ITEM_COLUMNS.map((c) => (
                <PillCheckbox key={c.key} label={c.label} disabled={reqCols.includes(c.key)} checked={cols.includes(c.key)}
                  onChange={(e) => update(it, { cols: ITEM_COLUMNS.map((x) => x.key).filter((k) => (k === c.key ? e.target.checked : cols.includes(k))) })} />
              ))}
            </div>
            {b.cols && <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => unset(it, "cols")}>ใช้คอลัมน์ตั้งต้นของเอกสาร</button>}
          </div>
        )}

        {b.kind === "signatures" && (
          <Field label="ชื่อช่องลงนาม (คั่นด้วย , สูงสุด 4 ช่อง)">
            <PillInput value={(b.labels || []).join(", ")} placeholder={defaultSignatures.join(", ")} onChange={(e) => { const l = e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4); if (l.length) update(it, { labels: l }); else unset(it, "labels"); }} className="h-8 w-full text-sm" />
          </Field>
        )}

        {b.kind === "image" && (
          <>
            <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> เลือกรูป (PNG/JPG)</PillButton>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) update(it, { src: await shrinkImage(f) }); }} />
          </>
        )}
        {b.kind === "line" && colorRow(it, "สีเส้น", "color")}
        {b.kind !== "line" && colorRow(it, "พื้นหลัง", "bg")}
        {b.kind !== "line" && colorRow(it, "กรอบ", "border")}

        {letterhead && !letterOnly && HEAD_KINDS.includes(b.kind) && (
          <PillCheckbox label="อยู่ในหัวกระดาษ (ใช้ร่วมกับเอกสารที่ใช้หัวนี้)" checked={it.zone === "head"} onChange={() => moveZone(it)} />
        )}
        <div className="flex gap-1.5 pt-1">
          <PillButton variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => reorder(it, -1)} title="ไปด้านหลัง"><ArrowDown size={13} /></PillButton>
          <PillButton variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => reorder(it, 1)} title="มาด้านหน้า"><ArrowUp size={13} /></PillButton>
          {!isLocked(it) && <PillButton variant="ghost" className="h-8 px-2.5 text-xs text-danger ml-auto" onClick={() => { setBlock(it.key, null); setSel(null); }}><Trash2 size={13} /> ลบ</PillButton>}
        </div>
      </fieldset>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!letterOnly && (
          <>
            <PillCheckbox label={`จัดวางเนื้อ "${docTitle}" เอง (ลากวาง)`} checked={layout.enabled} onChange={(e) => onChange({ ...layout, enabled: e.target.checked })} disabled={!canEdit} />
            <span className="text-[12px] text-white/45">{layout.enabled ? "พิมพ์ตามผังนี้" : "เนื้อเอกสารจัดตามธีม — แก้ได้เฉพาะหัวกระดาษ"}</span>
          </>
        )}
        {letterOnly && <span className="text-[12px] text-white/50">หนังสือ: ออกแบบหัวกระดาษได้ เนื้อหา (ที่ · วันที่ · เรื่อง · เรียน · เนื้อความ · ลงนาม) จัดตามรูปแบบหนังสือ</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {canEdit && bodyOn && <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={() => { onChange({ ...defaultFreeLayout(docType, font), enabled: true }); setSel(null); }}><RotateCcw size={13} /> เริ่มจากผังมาตรฐาน</PillButton>}
          {canEdit && bodyOn && <PillButton variant="glass" className="h-9 px-3 text-xs" onClick={onApplyAll}><Copy size={13} /> ใช้ผังนี้กับทุกเอกสาร</PillButton>}
          <PillButton variant="glass" className="h-9 px-3 text-xs" onClick={() => setShowPdf((v) => !v)}><Eye size={13} /> {showPdf ? "ซ่อน PDF" : "ดู PDF ทุกหน้า"}</PillButton>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* กระดาษ A4: ภาพหน้าจริง + กล่องที่ลากได้ */}
        <div className="overflow-x-auto max-w-full flex-shrink-0">
          <div className="relative bg-white rounded-sm shadow-2xl overflow-hidden select-none" style={{ width: A4.w * S, height: A4.h * S }} onPointerDown={() => setSel(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพหน้าเอกสารที่วาดในเบราว์เซอร์ (data URL) */}
            {image && <img src={image.url} alt="" className="absolute inset-0 w-full h-full pointer-events-none" />}
            {/* กล่องที่ถูกย้าย: ปิดตำแหน่งเดิมในภาพ */}
            {image && items.map((it) => {
              const o = shot.get(it.key);
              return o && (o.x !== it.b.x || o.y !== it.b.y) ? <div key={`m-${it.key}`} className="absolute bg-white pointer-events-none" style={{ left: o.x * S, top: o.y * S, width: o.w * S, height: Math.max(1, o.h) * S }} /> : null;
            })}
            {items.map((it) => {
              const b = it.b, on = it.key === sel, o = shot.get(it.key);
              const moved = !!(image && o && (o.x !== b.x || o.y !== b.y));
              const fresh = !o;
              return (
                <div key={it.key} onPointerDown={(e) => start(e, it, "move")}
                  className={cn("absolute group", canEdit ? "cursor-move" : "cursor-pointer",
                    on ? "outline outline-2 outline-[#0d9488] z-20" : "outline outline-1 outline-dashed outline-transparent hover:outline-slate-400 z-10",
                    fresh && !on && "outline-slate-300")}
                  style={{
                    left: b.x * S, top: b.y * S, width: b.w * S, height: Math.max(2, b.h * S),
                    ...(moved ? { backgroundImage: `url(${image!.url})`, backgroundSize: `${A4.w * S}px ${A4.h * S}px`, backgroundPosition: `${-o!.x * S}px ${-o!.y * S}px`, backgroundRepeat: "no-repeat" } : {}),
                  }}>
                  <span className={cn("absolute -top-[17px] left-0 px-1.5 rounded-t text-[10px] leading-[17px] whitespace-nowrap pointer-events-none",
                    it.zone === "head" ? "bg-purple-600 text-white" : "bg-[#0d9488] text-white", on ? "block" : "hidden group-hover:block")}>
                    {BLOCK_LABELS[b.kind]}{isLocked(it) ? " 🔒" : ""}{it.zone === "head" ? " · หัวกระดาษ" : ""}
                  </span>
                  {fresh && b.kind === "text" && <div className="px-1 text-[10px] text-slate-500 pointer-events-none">{b.text}</div>}
                  {on && canEdit && <div onPointerDown={(e) => start(e, it, "size")} className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm bg-[#0d9488] cursor-se-resize" />}
                </div>
              );
            })}
            {/* ขอบล่างหัวกระดาษ (ลากเพื่อปรับความสูง) */}
            {letterhead && (
              <div onPointerDown={startHead} className={cn("absolute left-0 right-0 z-30 h-[9px] -mt-[4px] flex items-center", canEdit && "cursor-ns-resize")} style={{ top: letterhead.height * S }}>
                <div className="w-full border-t border-dashed border-purple-500/70" />
                <span className="absolute right-1 -top-[16px] text-[10px] px-1.5 rounded bg-purple-600 text-white whitespace-nowrap">ขอบล่างหัวกระดาษ · เนื้อหาเริ่มใต้เส้นนี้</span>
              </div>
            )}
            {(busy || !image) && <span className="absolute top-2 right-2 z-40 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-slate-800/80 text-white"><Loader2 size={11} className="animate-spin" /> กำลังอัปเดต</span>}
            {error && <span className="absolute bottom-2 left-2 right-2 z-40 text-[11px] px-2 py-1 rounded bg-red-600/90 text-white">วาดตัวอย่างไม่สำเร็จ: {error}</span>}
          </div>
        </div>

        {/* คุณสมบัติ */}
        <GlassCard className="p-3 w-full lg:w-[290px] flex-shrink-0 space-y-3 lg:sticky lg:top-4">
          {canEdit && (letterhead || bodyOn) && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-bold text-white/70 flex items-center gap-1"><Plus size={13} /> เพิ่มกล่อง{addZone === "head" ? "ในหัวกระดาษ" : ""}</p>
              <div className="flex flex-wrap gap-1.5">
                {addable.map((k) => (
                  <button key={k} type="button" onClick={() => add(k)} className="h-7 px-2.5 rounded-full text-[12px] border border-white/15 text-white/75 hover:border-nexus-teal/50 hover:text-nexus-teal">{BLOCK_LABELS[k]}</button>
                ))}
              </div>
            </div>
          )}
          {!letterhead && !bodyOn ? (
            <p className="text-[12.5px] text-white/60 leading-relaxed">
              {letterOnly ? "เลือกหรือสร้างหัวกระดาษด้านบนก่อน แล้วลากจัดวางบนกระดาษได้เลย" : <>ติ๊ก &quot;จัดวางเนื้อเอกสารเอง&quot; เพื่อลากจัดตำแหน่งทุกกล่อง หรือสร้างหัวกระดาษด้านบนเพื่อออกแบบเฉพาะหัว</>}
            </p>
          ) : !selected ? (
            <div className="space-y-2">
              <p className="text-[12px] text-white/50 leading-relaxed">คลิกกล่องบนกระดาษเพื่อแก้ · ลากเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด · ลูกศรขยับทีละ 1pt (Shift = 10pt) · 🔒 = ข้อมูลที่กฎหมายบังคับ</p>
              {letterhead && (
                <Field label={`ความสูงหัวกระดาษ (pt)`}>
                  <PillInput inputMode="decimal" value={letterhead.height} disabled={!canEdit} onChange={(e) => onLetterheadChange({ ...letterhead, height: Math.max(40, Math.min(320, Number(e.target.value.replace(/[^\d.]/g, "")) || 40)) })} className="h-8 w-full text-sm font-mono text-right" />
                </Field>
              )}
            </div>
          ) : props(selected)}
        </GlassCard>
      </div>

      {showPdf && model && (
        <div className="h-[880px] rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-white/[0.02]">
          <DocumentPdfViewer model={model} className="flex-1" />
        </div>
      )}
    </div>
  );
}
