"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlertTriangle, AlignVerticalDistributeCenter, ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, Plus, ArrowUpDown, CheckCircle2, Copy, CopyPlus, Database, Eye, ImagePlus, Loader2, Lock, Magnet, Minus, MousePointer2,
  Group as GroupIcon, Pin, PinOff, Redo2, Split, Square, Trash2, Undo2, Ungroup, AlignLeft, AlignCenter, AlignRight, Wand2, X, Rows3,
  Bold, Type, Stamp as StampIcon, MoreHorizontal, Image as ImageIcon, TextCursorInput, BringToFront, SendToBack, ChevronLeft, PanelBottom,
  Circle, Triangle, RotateCcw, StretchHorizontal, StretchVertical,
  Italic, Underline, Strikethrough, AlignJustify, ChevronUp, ChevronDown, ChevronRight, PanelRightClose, PanelRightOpen,
  ArrowUpToLine, ArrowDownToLine, BoxSelect, Sigma, PenLine, RectangleHorizontal, RectangleVertical, Scan, Move, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Ruler as RulerIcon, Grid3x3, Paintbrush, ZoomIn,
} from "lucide-react";
import { templateLayout } from "@/lib/documents/layout-templates";
import { DataChecklist } from "./DataChecklist";
import { blankLayout, dataGroups, toggleData, type DataContext } from "@/lib/documents/design-data";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, PillTabs, cn } from "@/components/ui/Base";
import { FloatingLayer } from "@/components/ui/FloatingLayer";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import type { DocumentModel } from "@/lib/documents/model";
import {
  BLOCK_LABELS, BLOCK_PARTS, LABEL_KINDS, fixedBlockSize, PAPERS, pageOf, marginsOf, refitBlocks, type Margins, type PaperSize, COLOR_TOKENS, FONT_SCALE, HEAD_KINDS, requiredSatisfied, resolveColor, ITEM_COLUMNS, TEXT_BLOCKS, TEXT_VARIABLES, legalFieldVisible, addableBlocksFor, defaultFreeLayout, docHasAmounts, requiredBlocksFor, requiredColumnsFor, resolveDesign, resolveColumns, ARCHETYPES, docHasCopy, FONT_LABELS, type FontFamily,
  type BlockKind, type ColumnSpec, type DocTheme, type FreeBlock, type FreeLayout, type ItemColumn, type Letterhead,
} from "@/lib/documents/design";
import { fileToPageImage, usePdfPageImage } from "./usePdfPageImage";

/**
 * ผังลากวางอิสระ — แก้บนหน้าเอกสารจริง
 *  - พื้นกระดาษคือหน้าแรกของ PDF จริง (ตัวสร้างเดียวกับตอนพิมพ์) อัปเดตทันทีที่แก้ (วาดฉบับล่าสุดเสมอ)
 *    ระหว่างลาก เนื้อหาของกล่องเลื่อนตามเมาส์ (ตัดจากภาพล่าสุด)
 *  - กล่องมี 2 กลุ่ม: หัวกระดาษ (ใช้ร่วมหลายเอกสาร) และเนื้อเอกสาร (เฉพาะชนิดนี้)
 *  - ช่วยจัดวาง: ตารางกริด ดูดติดกริด เส้นนำแนวขอบ/กึ่งกลางของกล่องอื่นและหน้ากระดาษ
 *    เลือกหลายกล่อง (Shift+คลิก) แล้วจัดชิด/กระจาย/ปรับขนาดเท่ากัน · ลูกศรขยับ 1pt (Shift 10pt) · Delete ลบ
 *  - แท็บ "ข้อมูลในเอกสาร": รายการข้อมูลทั้งหมดของเอกสารชนิดนี้ ติ๊กเลือกแสดง/ซ่อน หรือแยกเป็นกล่องวางเองได้
 *  - กระดาษขยายเต็มพื้นที่ (พอดีความกว้าง) หรือซูม 100–200% — ภาพหน้าเอกสารวาดตามขนาดจอจึงคมชัด
 *  - กริดจาง แสดงเฉพาะตอนลาก/วาด (ตั้งให้แสดงตลอดหรือปิดได้)
 *  - เครื่องมือวาด: ลากบนกระดาษเพื่อวาดเส้น (แนวนอน/แนวตั้งตามทิศที่ลาก) หรือกรอบ · ปรับความหนา เส้นประ มุมโค้ง/เหลี่ยม
 *  - กล่องที่เอกสารภาษีต้องมี ย้าย/ปรับได้แต่ลบไม่ได้
 */
const SNAP_PT = 4;
const SINGLE: BlockKind[] = ["seller", "title", "meta", "party", "items", "totals", "words", "notes", "payment", "signatures"];
const DEDUP: BlockKind[] = ["seller", "title", "meta", "party"];
/** กล่องข้อมูลสำเร็จรูป (สร้างแล้วติ๊กเพิ่ม/ลด/เรียงหัวข้อเองได้) */
const INFO_PRESETS: { id: string; label: string }[] = [
  { id: "seller", label: "ข้อมูลบริษัท" }, { id: "customer", label: "ข้อมูลลูกค้า" }, { id: "doc", label: "เลขที่ · วันที่ · อ้างอิง" },
  { id: "extra", label: "ข้อมูลเพิ่มของเอกสาร" }, { id: "empty", label: "ว่าง (เลือกหัวข้อเอง)" },
];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
type Zone = "head" | "doc";
type Item = { key: string; zone: Zone; b: FreeBlock };
type Guides = { x: number[]; y: number[] };
/** ตำแหน่ง/เคอร์เซอร์ของจุดจับปรับขนาด */
const HANDLE_POS: Record<string, string> = {
  nw: "-left-1 -top-1 cursor-nwse-resize", n: "left-1/2 -translate-x-1/2 -top-1 cursor-ns-resize", ne: "-right-1 -top-1 cursor-nesw-resize",
  e: "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize", se: "-right-1 -bottom-1 cursor-nwse-resize", s: "left-1/2 -translate-x-1/2 -bottom-1 cursor-ns-resize",
  sw: "-left-1 -bottom-1 cursor-nesw-resize", w: "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize",
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

const Sep = () => <span className="w-px h-6 bg-white/10 mx-0.5" />;
/** กล่องที่แยกหัวข้อเป็นช่องย่อยได้ */
const SPLITTABLE: BlockKind[] = ["seller", "party", "meta", "title"];
/** ช่องย่อยของผู้ขาย/ลูกค้า/ชื่อเอกสาร (เลือกในช่องข้อมูลได้) */
const SUB_FIELDS = [
  { key: "title", label: "ชื่อเอกสาร" }, { key: "titleEn", label: "ชื่อเอกสารภาษาอังกฤษ" },
  { key: "seller.name", label: "ชื่อบริษัท" }, { key: "seller.nameEn", label: "ชื่อบริษัทภาษาอังกฤษ" }, { key: "seller.address", label: "ที่อยู่บริษัท" },
  { key: "seller.taxId", label: "เลขผู้เสียภาษีบริษัท" }, { key: "seller.contact", label: "ติดต่อบริษัท" },
  { key: "customer.name", label: "ชื่อลูกค้า" }, { key: "customer.address", label: "ที่อยู่ลูกค้า" }, { key: "customer.taxId", label: "เลขผู้เสียภาษีลูกค้า" },
  { key: "customer.contact", label: "ผู้ติดต่อลูกค้า" }, { key: "customer.phone", label: "โทรลูกค้า" }, { key: "customer.email", label: "อีเมลลูกค้า" },
];
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><label className="text-[11px] text-white/55 ml-1">{label}</label>{children}</div>
);
const ToolBtn = ({ title, on, onClick, children, disabled }: { title: string; on?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
    className={cn("h-8 w-8 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30", on ? "border-nexus-teal/60 bg-nexus-teal/15 text-nexus-teal" : "border-white/10 text-white/65 hover:text-white hover:border-white/25")}>
    {children}
  </button>
);
const Group = ({ title, source, children }: { title: string; source?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5 rounded-xl border border-white/10 p-2.5">
    <p className="text-[11.5px] font-bold text-white/70">{title}</p>
    {source && <p className="text-[10.5px] text-sky-300/70 -mt-1 flex items-center gap-1"><Database size={10} /> {source}</p>}
    {children}
  </div>
);

/** ปุ่มใหญ่ในริบบอน (ไอคอนบน ป้ายล่าง) · drag = ลากไปวางบนกระดาษได้ */
const RBtn = ({ icon, label, onClick, disabled, on, title, drag }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; on?: boolean; title?: string; drag?: string }) => (
  <button type="button" title={title || (drag ? `${label} — คลิกหรือลากไปวางบนกระดาษ` : label)} disabled={disabled} onClick={onClick}
    draggable={!!drag && !disabled} onDragStart={drag ? (e) => { e.dataTransfer.setData("text/nexus-kind", drag); e.dataTransfer.effectAllowed = "copy"; } : undefined}
    className={cn("h-[58px] min-w-[54px] px-1.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11.5px] leading-tight border transition-colors disabled:opacity-30", on ? "bg-nexus-teal/15 border-nexus-teal/30 text-nexus-teal" : "border-transparent text-white/80 hover:bg-white/10", drag && "cursor-grab active:cursor-grabbing")}>
    <span className={on ? "text-nexus-teal" : "text-nexus-teal/90"}>{icon}</span>{label}
  </button>
);
/** ปุ่มเล็กในริบบอน (ไอคอนอย่างเดียว) */
const RIcon = ({ title, onClick, disabled, on, children }: { title: string; onClick: () => void; disabled?: boolean; on?: boolean; children: React.ReactNode }) => (
  <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
    className={cn("h-8 min-w-8 px-1.5 rounded-full flex items-center justify-center text-[12px] border transition-colors disabled:opacity-30", on ? "bg-nexus-teal/15 border-nexus-teal/30 text-nexus-teal" : "border-transparent text-white/75 hover:bg-white/10")}>{children}</button>
);
/** ตัวเลือกในริบบอน (dropdown ของระบบ) */
const RSelect = ({ width, title, value, onChange, children }: { width: number; title: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <div style={{ width }} title={title}>
    <PillSelect value={value} onChange={(e) => onChange(String(e.target.value))} className="h-7 pl-3 pr-7 text-[12px] font-medium">{children}</PillSelect>
  </div>
);
/** ช่องตัวเลขในริบบอน */
const RNum = ({ width = 56, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { width?: number }) => (
  <PillInput type="number" {...p} style={{ width }} className="h-7 px-2 text-[12px] text-right" />
);
/** ปุ่มริบบอนที่เปิดเมนู — ชั้นลอยของระบบ (ไม่ถูกการ์ดตัด) */
function RMenu({ icon, label, disabled, width = 220, children }: { icon: React.ReactNode; label: string; disabled?: boolean; width?: number; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null), layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { const t = e.target as Node; if (!anchor.current?.contains(t) && !layer.current?.contains(t)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={anchor}>
      <RBtn icon={icon} label={`${label} ▾`} disabled={disabled} on={open} onClick={() => setOpen((v) => !v)} />
      <FloatingLayer ref={layer} anchorRef={anchor} open={open} matchWidth={false} minWidth={width} maxHeight={420} style={{ width }} className="bg-surface-2 border border-white/10 rounded-2xl shadow-2xl p-1.5">
        {children(() => setOpen(false))}
      </FloatingLayer>
    </div>
  );
}
/** ตารางสำเร็จรูป: วางแล้วข้อมูลจากเอกสารขึ้นเอง · ติ๊กเลือกคอลัมน์/แถว และจัดซ้าย-กลาง-ขวาได้ที่แผงขวา */
const READY_TABLES: { kind: BlockKind; label: string; hint: string; icon: React.ReactNode }[] = [
  { kind: "items", label: "ตารางสินค้า", hint: "ลำดับ รายการ จำนวน หน่วย ราคา ส่วนลด จำนวนเงิน", icon: <Rows3 size={18} /> },
  { kind: "totals", label: "ตารางยอดรวม", hint: "รวมเป็นเงิน ส่วนลด ภาษีมูลค่าเพิ่ม รวมทั้งสิ้น", icon: <Sigma size={18} /> },
  { kind: "words", label: "จำนวนเงินตัวอักษร", hint: "ยอดรวมทั้งสิ้นเป็นตัวอักษร", icon: <Type size={18} /> },
];
const menuItem = "w-full text-left px-3 py-2 rounded-xl text-[12.5px] text-white/85 hover:bg-white/10 hover:text-white";
/** กลุ่มในริบบอน (ป้ายชื่อกลุ่มด้านล่าง เหมือน Office) */
const RGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col px-2 border-r border-white/10 last:border-r-0 flex-shrink-0">
    <div className="flex items-center gap-1 flex-1 min-h-[62px]">{children}</div>
    <p className="text-[10.5px] text-white/40 text-center pt-0.5">{label}</p>
  </div>
);
/** ไม้บรรทัด (ซม.) ตามขนาดกระดาษบนจอ · hl = ช่วงของกล่องที่เลือก */
function Ruler({ axis, S, hl, P }: { axis: "x" | "y"; S: number; hl?: [number, number] | null; P: { w: number; h: number } }) {
  const mm = 72 / 25.4, len = axis === "x" ? P.w : P.h, n = Math.floor(len / mm);
  const H = 18;
  return (
    <div className={cn("absolute bg-surface-2 border-white/10 overflow-hidden select-none", axis === "x" ? "border-b" : "border-r")}
      style={axis === "x" ? { left: H, top: 0, width: len * S, height: H } : { left: 0, top: H, width: H, height: len * S }}>
      {hl && <div className="absolute bg-nexus-teal/25" style={axis === "x" ? { left: hl[0] * S, width: (hl[1] - hl[0]) * S, top: 0, bottom: 0 } : { top: hl[0] * S, height: (hl[1] - hl[0]) * S, left: 0, right: 0 }} />}
      {Array.from({ length: n + 1 }, (_, i) => {
        const p = i * mm * S, big = i % 10 === 0, mid = i % 5 === 0;
        if (!big && !mid && S < 1.1) return null;
        const t = big ? 9 : mid ? 6 : 3;
        return (
          <React.Fragment key={i}>
            <div className="absolute bg-white/35" style={axis === "x" ? { left: p, bottom: 0, width: 1, height: t } : { top: p, right: 0, height: 1, width: t }} />
            {big && i > 0 && <span className="absolute text-[9px] text-white/50 leading-none" style={axis === "x" ? { left: p + 2, top: 1 } : { top: p + 2, left: 1, writingMode: "vertical-rl" }}>{i / 10}</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** ตำแหน่งที่ใกล้ที่สุดในระยะดูด */
function nearest(values: number[], targets: number[]): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const v of values) for (const t of targets) { const d = t - v; if (Math.abs(d) <= SNAP_PT && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: t }; }
  return best;
}

export function FreeLayoutEditor({ docType, theme, layout, onChange, letterhead, onLetterheadChange, letterOnly, model, canEdit, docTitle, defaultColumns, defaultSignatures, docMeta, docFields, history, dataCtx, signers = [], stampSize = 72, aiLayout }: {
  docType: string; theme: DocTheme;
  layout: FreeLayout; onChange: (l: FreeLayout) => void;
  letterhead: Letterhead | null; onLetterheadChange: (l: Letterhead) => void;
  /** หนังสือ: แก้ได้เฉพาะหัวกระดาษ เนื้อหาจัดตามรูปแบบหนังสือ */
  letterOnly: boolean;
  model: DocumentModel | null; canEdit: boolean; docTitle: string;
  defaultColumns: ItemColumn[]; defaultSignatures: string[];
  /** แถวข้อมูลและข้อมูลเพิ่มของเอกสารชนิดนี้ (รายการ "ข้อมูลในเอกสาร") */
  docMeta: string[]; docFields: { key: string; label: string }[];
  /** ย้อนกลับ/ทำซ้ำทั้งการออกแบบ (หน้าหลักเก็บประวัติ — รวมการเปลี่ยนแม่แบบ/สี) */
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  /** รายการ "ข้อมูลที่แสดงในเอกสาร" ของเอกสารชนิดนี้ */
  dataCtx: DataContext;
  /** ผู้ลงนามที่ตั้งไว้ (ลายเซ็น · ตราประทับ) — เลือกให้กล่องลายเซ็นใช้ลายเซ็นของคนนั้นเสมอ */
  signers?: { id: string; name: string; position?: string }[];
  /** ขนาดตราประทับจริง (pt) จากหน้าลายเซ็น · ตราประทับ — กล่องตราใช้ขนาดนี้เสมอ */
  stampSize?: number;
  /** AI อ่านตัวอย่างเอกสาร (รูป) แล้วคืนผังที่แก้ได้ */
  aiLayout?: (image: string, landscape: boolean) => Promise<FreeLayout>;
}) {
  const font = theme.font;
  // ขนาดหน้า (กระดาษ/แนวที่ตั้ง) · ขอบกระดาษแต่ละด้าน [บน ขวา ล่าง ซ้าย]
  const P = pageOf(layout);
  const M = marginsOf(layout);
  const [sel, setSel] = useState<string[]>([]);
  // พิมพ์ข้อความบนกระดาษ (ดับเบิลคลิกกล่องข้อความ)
  const [editing, setEditing] = useState<string | null>(null);
  // ริบบอน: แท็บที่เปิด · ย่อเหลือชื่อแท็บ · ไม้บรรทัด · แผงขวา (จำไว้ในเครื่อง)
  const [rtab, setRtab] = useState("insert");
  const [ui, setUi] = useState({ ribbon: true, ruler: true, right: false, pin: false });
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("nexus.designer.ui2") || "null"); if (v) setUi((u) => ({ ...u, ...v })); } catch { /* ค่าตั้งต้น */ } }, []);
  // ปักหมุดแถบเครื่องมือ: ติดบนจอขณะเลื่อนหน้า (วัดความสูงไว้เว้นที่ให้กระดาษ/แผงขวา)
  const ribbonRef = useRef<HTMLDivElement>(null);
  const [ribbonH, setRibbonH] = useState(0);
  useEffect(() => {
    const el = ribbonRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRibbonH(Math.round(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pinTop = 8; // จากขอบบนของพื้นที่เลื่อน (ใต้แถบบนของระบบ)
  const setUiPart = (patch: Partial<typeof ui>) => setUi((u) => { const n = { ...u, ...patch }; try { localStorage.setItem("nexus.designer.ui2", JSON.stringify(n)); } catch { /* ไม่เป็นไร */ } return n; });
  // ลากคลุมบนพื้นกระดาษเพื่อเลือกหลายกล่อง (pt) · add = กด Ctrl/Shift ค้าง (เลือกเพิ่ม)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; add: boolean } | null>(null);
  // ระยะห่างระหว่างกล่องเมื่อเรียงต่อกัน (pt)
  const [gap, setGap] = useState(8);
  // AI แปลงตัวอย่างเอกสารเป็นต้นแบบ
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiFileRef = useRef<HTMLInputElement>(null);
  const runAiSample = async (file: File) => {
    if (!aiLayout || !canEdit) return;
    setAiBusy(true); setAiError("");
    try {
      const { image, landscape } = await fileToPageImage(file);
      const l = await aiLayout(image, landscape);
      commitLayout({ ...l, enabled: true });
      setSel([]);
    } catch (e: any) { setAiError(String(e?.message || e)); } finally { setAiBusy(false); }
  };
  // เปลี่ยนกระดาษ/แนว/ขอบ: ย้ายกล่องตามสัดส่วนของหน้าใหม่
  const [refit, setRefit] = useState(true);
  // วางต่อจากกรอบหลัก: ด้านที่เลือกล่าสุด (แก้ระยะห่างแล้วขยับตามทันที) — ล้างเมื่อเปลี่ยนกล่องที่เลือก
  const [side, setSide] = useState<"top" | "bottom" | "left" | "right" | null>(null);
  useEffect(() => setSide(null), [sel.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showPdf, setShowPdf] = useState(false);
  const [grid, setGrid] = useState(10);
  const [gridMode, setGridMode] = useState<"drag" | "always" | "off">("drag");
  const [moving, setMoving] = useState(false);
  const [freeMove, setFreeMove] = useState(false);
  // ขนาดกระดาษบนจอ: พอดีความกว้างพื้นที่ (ปัด 0.05 กันวาดภาพใหม่ถี่ตอนย่อขยายหน้าต่าง) หรือซูมคงที่
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitS, setFitS] = useState(1.25);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // พอดีความกว้างตามกระดาษ (เปลี่ยนแนว/ขนาดแล้วคำนวณใหม่)
    const ro = new ResizeObserver(([e]) => setFitS(Math.round(Math.min(2.4, Math.max(0.6, (e.contentRect.width - 26) / P.w)) * 20) / 20));
    ro.observe(el);
    return () => ro.disconnect();
  }, [P.w]);
  const S = zoom === "fit" ? fitS : zoom; // px ต่อ pt บนจอ
  const [snapOn, setSnapOn] = useState(true);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  // เครื่องมือวาด: ลากบนกระดาษเพื่อสร้างกล่องข้อความ กรอบ เส้น หรือตารางเส้น ตามขนาดที่ลาก
  const [tool, setTool] = useState<"select" | "line" | "rect" | "text" | "grid">("select");
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  // size: edge = ด้าน/มุมที่จับ (n s e w ne nw se sw) — ปรับขนาดได้ทุกด้าน
  const drag = useRef<{ mode: "move" | "size" | "head"; px: number; py: number; orig: Map<string, FreeBlock>; h: number; edge?: string; pick?: string[]; moved?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { image, busy, error } = usePdfPageImage(model, P.w * S);

  // ---------- ย้อนกลับ/ทำซ้ำ: ประวัติอยู่ที่หน้าหลัก (รวมทุกการแก้ของการออกแบบ) ----------
  const commitLayout = onChange;
  const commitHead = onLetterheadChange;
  const undo = () => { history.undo(); setSel([]); };
  const redo = () => { history.redo(); setSel([]); };

  const bodyOn = !letterOnly && layout.enabled;
  /** ขอบกระดาษสำหรับจัดวาง (เส้นนำ/ดูดติด/จัดชิดขอบ) */
  const headKinds = new Set((letterhead?.blocks || []).filter((b) => DEDUP.includes(b.kind)).map((b) => b.kind));
  // ตราประทับ/ลายเซ็น: ขนาดจริงเสมอ (ย่อ/ขยายไม่ได้)
  const sized = (b: FreeBlock): FreeBlock => { const f = fixedBlockSize(b, stampSize, theme.fontSize); return f ? { ...b, ...f } : b; };
  const items: Item[] = [
    ...(letterhead?.blocks || []).map((b) => ({ key: `h:${b.id}`, zone: "head" as Zone, b: sized(b) })),
    ...(bodyOn ? layout.blocks.filter((b) => !headKinds.has(b.kind)).map((b) => ({ key: `d:${b.id}`, zone: "doc" as Zone, b: sized(b) })) : []),
  ];
  const byKey = new Map(items.map((i) => [i.key, i]));
  const selected = sel.map((k) => byKey.get(k)).filter((x): x is Item => !!x);
  const primary = selected[0] || null;
  const multi = selected.length > 1;
  const required = requiredBlocksFor(docType);
  const isLocked = (it: Item) => !letterOnly && required.includes(it.b.kind) && items.filter((x) => x.b.kind === it.b.kind).length <= 1;
  const firstOf = (kind: BlockKind) => items.find((i) => i.b.kind === kind) || null;

  /** ภาพของกล่องตัดย้ายได้เฉพาะกล่องที่ไม่ทับกล่องอื่น (ทับกัน = ภาพที่ตัดมีส่วนของกล่องอื่นติดมา และการปิดตำแหน่งเดิมลบกล่องด้านหลัง) */
  const croppable = (key: string, o: FreeBlock) => o.kind !== "rect" && o.kind !== "shape" && o.kind !== "line" && o.kind !== "image"
    && ![...shot.entries()].some(([k, p]) => k !== key && p.x < o.x + o.w && o.x < p.x + p.w && p.y < o.y + o.h && o.y < p.y + p.h);
  // ตำแหน่งกล่อง ณ ตอนวาดภาพล่าสุด (ตัดภาพให้กล่องที่ถูกย้าย)
  const shot = useMemo(() => {
    const m = new Map<string, FreeBlock>();
    if (!image) return m;
    const r = resolveDesign(image.model.seller.design, docType, image.model.seller.brandColor);
    for (const b of r.letterhead?.blocks || []) m.set(`h:${b.id}`, b);
    if (r.doc.free?.enabled) for (const b of r.doc.free.blocks) m.set(`d:${b.id}`, b);
    return m;
  }, [image, docType]);

  const clamp = (b0: FreeBlock): FreeBlock => {
    const b = sized(b0);
    const w = Math.max(0.25, Math.min(P.w, b.w)), h = Math.max(0.25, Math.min(P.h, b.h));
    return { ...b, w, h, x: Math.max(0, Math.min(P.w - w, b.x)), y: Math.max(0, Math.min(P.h - h, b.y)) };
  };
  /** แก้หลายกล่องพร้อมกัน (null = ลบ) และเพิ่มกล่องใหม่ */
  const applyMany = (next: Map<string, FreeBlock | null>, adds: { zone: Zone; b: FreeBlock }[] = []) => {
    const map = (prefix: string, list: FreeBlock[]) => list.flatMap((b) => { const k = `${prefix}:${b.id}`; if (!next.has(k)) return [b]; const n = next.get(k); return n ? [clamp(n)] : []; });
    const headAdds = adds.filter((a) => a.zone === "head").map((a) => a.b), docAdds = adds.filter((a) => a.zone === "doc").map((a) => a.b);
    if (letterhead && ([...next.keys()].some((k) => k.startsWith("h:")) || headAdds.length)) commitHead({ ...letterhead, blocks: [...map("h", letterhead.blocks), ...headAdds] });
    if ([...next.keys()].some((k) => k.startsWith("d:")) || docAdds.length) commitLayout({ ...layout, blocks: [...map("d", layout.blocks), ...docAdds] });
  };
  const update = (it: Item, patch: Partial<FreeBlock>) => applyMany(new Map([[it.key, { ...it.b, ...patch }]]));
  /** ล้างค่าของกล่อง (กลับไปใช้ค่าตามแม่แบบ) */
  const unset = (it: Item, ...keys: (keyof FreeBlock)[]) => { const n: any = { ...it.b }; for (const k of keys) delete n[k]; applyMany(new Map([[it.key, n]])); };
  /** สมาชิกทั้งกลุ่มของกล่องนี้ (ไม่มีกลุ่ม = ตัวเอง) */
  const groupOf = (it: Item) => (it.b.group ? items.filter((x) => x.zone === it.zone && x.b.group === it.b.group).map((x) => x.key) : [it.key]);
  const newGroupId = () => `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  /** จัดกลุ่มกล่องที่เลือก (แยกตามหัวกระดาษ/เนื้อเอกสาร) */
  const groupSelected = () => {
    if (selected.length < 2) return;
    const ids: Record<string, string> = { head: newGroupId(), doc: newGroupId() + "d" };
    applyMany(new Map(selected.map((i) => [i.key, { ...i.b, group: ids[i.zone] }])));
  };
  const ungroupSelected = () => applyMany(new Map(selected.filter((i) => i.b.group).map((i) => [i.key, { ...i.b, group: undefined }])));
  const anyGrouped = selected.some((i) => i.b.group);

  /**
   * แยกกล่องเป็นช่องข้อมูลย่อย (ชื่อ ที่อยู่ เลขผู้เสียภาษี ฯลฯ) วางตามตำแหน่งเดิม จัดกลุ่มไว้ให้ — แล้วลากแต่ละหัวข้อได้อิสระ
   * ข้อมูลยังดึงจากฐานข้อมูลเหมือนเดิม · ข้อมูลที่กฎหมายบังคับนับครบเมื่อช่องย่อยครบ
   */
  /** หัวข้อในกล่อง (ช่องข้อมูล ความสูง รูปแบบ) ตามที่แสดงอยู่ตอนนี้ — ใช้แยกเป็นกล่องย่อย */
  const splitRows = (b: FreeBlock): [string, number, Partial<FreeBlock>][] => {
    const hide = new Set(b.hide || []);
    const base = (b.fontSize ?? theme.fontSize) * FONT_SCALE[font];
    const row = (n = 1) => Math.round(base * 1.45 * n + 2);
    const rows: [string, number, Partial<FreeBlock>][] =
      b.kind === "seller" ? [
        ["seller.name", row(1.4), { hideLabel: true, bold: true, fontSize: Math.round((b.fontSize ?? theme.fontSize) * 1.35 * 10) / 10, color: b.color || "@primary" }],
        ...(hide.has("nameEn") ? [] : [["seller.nameEn", row(0.9), { hideLabel: true, fontSize: Math.round((b.fontSize ?? theme.fontSize) * 0.9 * 10) / 10 }] as [string, number, Partial<FreeBlock>]]),
        ["seller.address", row(2), { hideLabel: true }],
        ["seller.taxId", row(), {}],
        ...(hide.has("contact") ? [] : [["seller.contact", row(0.9), { hideLabel: true, fontSize: Math.round((b.fontSize ?? theme.fontSize) * 0.9 * 10) / 10 }] as [string, number, Partial<FreeBlock>]]),
      ]
      : b.kind === "party" ? [
        ["customer.name", row(), { bold: true }], ["customer.address", row(2), {}], ["customer.taxId", row(), {}],
        ...(["contact", "phone", "email"] as const).filter((k) => !hide.has(k)).map((k) => [`customer.${k}`, row(), {}] as [string, number, Partial<FreeBlock>]),
      ]
      : b.kind === "meta" ? fieldOptions.filter((o) => (o.key === "number" || o.key === "date" || o.key.startsWith("m:")) ? !hide.has(o.key) : (b.fields || []).includes(o.key)).map((o) => [o.key, row(), {}] as [string, number, Partial<FreeBlock>])
      : b.kind === "title" ? [
        ["title", row(1.9), { hideLabel: true, bold: true, fontSize: Math.round((b.fontSize ?? theme.fontSize) * 1.8 * 10) / 10, color: b.color || "@primary" }],
        ...(hide.has("en") ? [] : [["titleEn", row(0.9), { hideLabel: true, fontSize: Math.round((b.fontSize ?? theme.fontSize) * 0.9 * 10) / 10 }] as [string, number, Partial<FreeBlock>]]),
        // เอกสารที่ต้องมีต้นฉบับ/สำเนา: แยกเป็นช่องด้วย
        ...(docHasCopy(docType) ? [["copy", row(1.1), { hideLabel: true, bold: true, color: b.color || "@primary", border: "@primary", radius: 3 }] as [string, number, Partial<FreeBlock>]] : []),
      ]
      : b.kind === "info" ? (b.fields || []).map((k, i) => [k, row(i === 0 && b.emphasizeFirst ? 1.4 : 1), i === 0 && b.emphasizeFirst ? { hideLabel: true, bold: true, fontSize: Math.round((b.fontSize ?? theme.fontSize) * 1.25 * 10) / 10, color: b.color || "@primary" } : b.hideLabel ? { hideLabel: true } : {}] as [string, number, Partial<FreeBlock>])
      : b.kind === "field" && b.field ? [[b.field, Math.max(row(), b.h), b.hideLabel ? { hideLabel: true } : {}]] : [];
    return rows;
  };
  const splitBlock = (it: Item) => {
    const b = it.b;
    const rows = splitRows(b);
    if (!rows.length) return;
    const group = newGroupId();
    let y = b.y;
    const adds = rows.map(([field, h, extra]) => {
      const nb: FreeBlock = { id: `field-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: "field", field, x: b.x, y, w: b.w, h, group, ...(b.align ? { align: b.align } : {}), ...(b.kind === "meta" && !b.align ? { align: "right" as const } : {}), ...(b.color ? { color: b.color } : {}), ...extra };
      y += h + 1;
      return { zone: it.zone, b: nb };
    });
    applyMany(new Map([[it.key, null]]), adds);
    setSel(adds.map((a) => `${a.zone === "head" ? "h" : "d"}:${a.b.id}`));
  };

  /**
   * แยกป้ายกับข้อมูลเป็นกล่องอิสระ (เหมือนกล่องข้อความใน PowerPoint/Visio): หัวข้อ 1 กล่อง ข้อมูล 1 กล่อง ต่อแถว
   * ลากวางแยกกันได้ (หัวข้อบน ข้อมูลล่าง / เว้นระยะ) · กรอบ/พื้นหลังของกล่องเดิมแยกเป็นกรอบอีกชิ้น
   */
  const explode = (it: Item) => {
    const b = it.b, rows = splitRows(b);
    if (!rows.length) return;
    const fs = (b.fontSize ?? theme.fontSize) * FONT_SCALE[font];
    const labeled = rows.filter(([, , x]) => !x.hideLabel);
    const est = Math.max(30, ...labeled.map(([k]) => fieldLabel(k).length * fs * 0.52 + 10));
    const labelW = Math.round(Math.min(b.w * 0.5, b.labelWidth ?? est));
    const id = (k: string) => `${k}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const adds: { zone: Zone; b: FreeBlock }[] = [];
    // กรอบ/พื้นของกล่องเดิม (หรือกรอบลูกค้าตามธีม) เป็นกรอบแยก อยู่ชั้นล่าง
    const partyFrame = b.kind === "party" && ["boxed", "accent-bar"].includes(b.partyStyle || theme.party);
    if (b.border || b.bg || partyFrame) adds.push({ zone: it.zone, b: { id: id("rect"), kind: "rect", x: b.x, y: b.y, w: b.w, h: b.h, ...(b.bg ? { bg: b.bg } : {}), border: b.border || (partyFrame ? "@line" : undefined), ...(b.borderWidth ? { borderWidth: b.borderWidth } : {}), ...(b.radius !== undefined ? { radius: b.radius } : {}), ...(b.dash ? { dash: b.dash } : {}) } });
    const pad = b.border || b.bg || partyFrame ? 6 : 0;
    let y = b.y + pad;
    const style: Partial<FreeBlock> = { ...(b.color ? { color: b.color } : {}), ...(b.fontSize !== undefined ? { fontSize: b.fontSize } : {}) };
    // ป้ายสองภาษา (ไทย + อังกฤษตัวเล็กใต้) สูงกว่าบรรทัดเดียว
    const labelH = Math.round(fs * 1.45 + (theme.bilingual ? fs * 0.75 * 1.3 : 0) + 2);
    // พอดีความสูงเดิมของกล่อง (ไม่ล้นไปทับกล่องถัดไป)
    const want = rows.reduce((t, [, h0, x]) => t + (x.hideLabel ? h0 : Math.max(h0, labelH)) + 1, 0);
    const k = Math.min(1, (b.h - pad * 2) / Math.max(1, want));
    for (const [field, h0, extra] of rows) {
      const h = Math.round((extra.hideLabel ? h0 : Math.max(h0, labelH)) * k * 10) / 10;
      if (extra.hideLabel) adds.push({ zone: it.zone, b: { id: id("field"), kind: "field", field, x: b.x + pad, y, w: b.w - pad * 2, h, ...style, ...extra } });
      else {
        // หัวข้อกับข้อมูลแถวเดียวกันจับคู่ไว้: คลิก/ลาก = ย้ายไปด้วยกัน · ดับเบิลคลิกชิ้นใดชิ้นหนึ่ง = ลากแยกได้อิสระ
        const pair = newGroupId();
        adds.push({ zone: it.zone, b: { id: id("field"), kind: "field", field, show: "label", group: pair, x: b.x + pad, y, w: labelW, h, ...style } });
        adds.push({ zone: it.zone, b: { id: id("field"), kind: "field", field, hideLabel: true, group: pair, x: b.x + pad + labelW + 4, y, w: Math.max(20, b.w - pad * 2 - labelW - 4), h, ...style, ...extra } });
      }
      y += h + k;
    }
    applyMany(new Map([[it.key, null]]), adds);
    setSel(adds.filter((a) => a.b.kind === "field").map((a) => `${a.zone === "head" ? "h" : "d"}:${a.b.id}`));
  };
  /** แปลงกล่องผู้ขาย/ลูกค้า/เลขที่ เป็นกล่องข้อมูล: หัวข้อเท่าที่แสดงอยู่ แล้วติ๊กเพิ่ม/ลด/เรียงเองได้ */
  const toInfo = (it: Item) => {
    const b = it.b, hide = new Set(b.hide || []);
    const fields = b.kind === "seller" ? ["seller.name", ...(hide.has("nameEn") ? [] : ["seller.nameEn"]), "seller.address", "seller.taxId", ...(hide.has("contact") ? [] : ["seller.contact"])]
      : b.kind === "party" ? ["customer.name", "customer.address", "customer.taxId", ...(["contact", "phone", "email"] as const).filter((k) => !hide.has(k)).map((k) => `customer.${k}`)]
      : b.kind === "meta" ? fieldOptions.filter((o) => (o.key === "number" || o.key === "date" || o.key.startsWith("m:")) ? !hide.has(o.key) : (b.fields || []).includes(o.key)).map((o) => o.key) : [];
    if (!fields.length) return;
    const n: any = { ...b, id: `info-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind: "info", fields, ...(b.kind !== "meta" ? { emphasizeFirst: true } : { labelWidth: 60 }) };
    for (const k of ["hide", "partyStyle", "cols", "colSpec", "labels"]) delete n[k];
    applyMany(new Map([[it.key, null]]), [{ zone: it.zone, b: n }]);
    setSel([`${it.zone === "head" ? "h" : "d"}:${n.id}`]);
  };

  /** ทำสำเนากล่องที่เลือก (กล่องที่มีได้ชุดเดียว เช่น ตาราง ยอดรวม ทำซ้ำไม่ได้) */
  const duplicate = () => {
    const adds = selected.filter((i) => !SINGLE.includes(i.b.kind)).map((i) => ({ zone: i.zone, b: { ...i.b, id: `${i.b.kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, x: i.b.x + 10, y: i.b.y + 10, locked: undefined } }));
    if (!adds.length) return;
    applyMany(new Map(), adds);
    setSel(adds.map((a) => `${a.zone === "head" ? "h" : "d"}:${a.b.id}`));
  };
  const allLocked = selected.length > 0 && selected.every((i) => i.b.locked);
  const toggleLock = () => applyMany(new Map(selected.map((i) => [i.key, { ...i.b, locked: allLocked ? undefined : true }])));
  const remove = (list: Item[]) => { applyMany(new Map(list.filter((i) => !isLocked(i)).map((i) => [i.key, null]))); setSel([]); };

  // เส้นนำ: ขอบ/กึ่งกลางของกล่องที่ไม่ได้เลือก + ขอบกระดาษ/กึ่งกลางหน้า
  const targets = (exclude: Set<string>) => {
    const xs = [M[3], P.w / 2, P.w - M[1]], ys = [M[0], P.h / 2, P.h - M[2], ...(letterhead ? [letterhead.height] : [])];
    for (const i of items) if (!exclude.has(i.key)) { xs.push(i.b.x, i.b.x + i.b.w / 2, i.b.x + i.b.w); ys.push(i.b.y, i.b.y + i.b.h / 2, i.b.y + i.b.h); }
    return { xs, ys };
  };
  /** free = วางอิสระ (ปิดดูดติด หรือกด Alt ค้าง) — ปัดแค่ 0.1pt */
  const toGrid = (v: number, free = !snapOn) => (free ? Math.round(v * 10) / 10 : Math.round(v / grid) * grid);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (marquee) { const r = paperRef.current!.getBoundingClientRect(); setMarquee({ ...marquee, x1: (e.clientX - r.left) / S, y1: (e.clientY - r.top) / S }); return; }
      if (draft) { const p = toPt(e); setDraft({ ...draft, x1: p.x, y1: p.y }); return; }
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.abs(e.clientX - d.px) < 3 && Math.abs(e.clientY - d.py) < 3) return; // ยังไม่ได้ลาก (คลิก)
      d.moved = true;
      let dx = (e.clientX - d.px) / S, dy = (e.clientY - d.py) / S;
      const free = !snapOn || e.altKey;
      setFreeMove(e.altKey);
      if (d.mode === "head") { if (letterhead) commitHead({ ...letterhead, height: Math.max(40, Math.min(320, toGrid(d.h + dy, free))) }); return; }
      const t = targets(new Set(d.orig.keys()));
      const g: Guides = { x: [], y: [] };
      if (d.mode === "move") {
        const list = [...d.orig.values()];
        const L = Math.min(...list.map((b) => b.x)), R = Math.max(...list.map((b) => b.x + b.w)), Tp = Math.min(...list.map((b) => b.y)), B = Math.max(...list.map((b) => b.y + b.h));
        const sx = free ? null : nearest([L + dx, (L + R) / 2 + dx, R + dx], t.xs);
        const sy = free ? null : nearest([Tp + dy, (Tp + B) / 2 + dy, B + dy], t.ys);
        if (sx) { dx += sx.delta; g.x.push(sx.at); } else dx = toGrid(L + dx, free) - L;
        if (sy) { dy += sy.delta; g.y.push(sy.at); } else dy = toGrid(Tp + dy, free) - Tp;
        applyMany(new Map([...d.orig].map(([k, b]) => [k, { ...b, x: b.x + dx, y: b.y + dy }])));
      } else {
        const [k, b] = [...d.orig][0];
        const ed = d.edge || "se";
        // ขอบที่จับเลื่อนตามเมาส์ (ดูดติดกริด/แนวกล่องอื่น) ขอบตรงข้ามอยู่กับที่
        const snapX = (v: number) => { const sx = free ? null : nearest([v], t.xs); if (sx) { g.x.push(sx.at); return sx.at; } return toGrid(v, free); };
        const snapY = (v: number) => { const sy = free ? null : nearest([v], t.ys); if (sy) { g.y.push(sy.at); return sy.at; } return toGrid(v, free); };
        let L = b.x, R = b.x + b.w, Tp = b.y, B = b.y + b.h;
        if (ed.includes("e")) R = snapX(R + dx);
        if (ed.includes("w")) L = snapX(L + dx);
        if (ed.includes("s")) B = snapY(B + dy);
        if (ed.includes("n")) Tp = snapY(Tp + dy);
        // มุม + Shift = คงสัดส่วนเดิม (โลโก้ ลายเซ็น ตรา รูป)
        if (e.shiftKey && ed.length === 2 && b.w > 0 && b.h > 0) {
          const w = R - L, h = w * (b.h / b.w);
          if (ed.includes("n")) Tp = B - h; else B = Tp + h;
        }
        // ไม่เกินขอบกระดาษ (ขอบตรงข้ามอยู่กับที่)
        L = Math.max(0, L); Tp = Math.max(0, Tp); R = Math.min(P.w, R); B = Math.min(P.h, B);
        if (R - L < 4) { if (ed.includes("w")) L = R - 4; else R = L + 4; }
        if (B - Tp < 1) { if (ed.includes("n")) Tp = B - 1; else B = Tp + 1; }
        applyMany(new Map([[k, { ...b, x: L, y: Tp, w: R - L, h: B - Tp }]]));
      }
      setGuides(g);
    };
    const up = () => {
      if (marquee) {
        const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1), y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
        // คลิกเฉย ๆ (ไม่ได้ลาก) = ยกเลิกการเลือก · ลากคลุม = เลือกกล่องที่อยู่ในกรอบทั้งกล่อง
        const hit = x1 - x0 < 3 && y1 - y0 < 3 ? [] : items.filter((i) => i.b.x >= x0 - 0.5 && i.b.x + i.b.w <= x1 + 0.5 && i.b.y >= y0 - 0.5 && i.b.y + i.b.h <= y1 + 0.5).map((i) => i.key);
        setSel(marquee.add ? [...new Set([...sel, ...hit])] : hit);
        setMarquee(null);
        return;
      }
      setMoving(false);
      setFreeMove(false);
      if (draft) { finishDraw(draft); return; }
      if (drag.current) { if (drag.current.pick && !drag.current.moved) setSel(drag.current.pick); drag.current = null; setGuides({ x: [], y: [] }); }
    };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!canEdit || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))) return;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); } else if (k === "d") { e.preventDefault(); duplicate(); } else if (k === "a") { e.preventDefault(); setSel(items.map((i) => i.key)); }
        else if (k === "g") { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); }
        return;
      }
      if (!selected.length) return;
      const step = e.shiftKey ? 10 : 1;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (delta[e.key]) { e.preventDefault(); applyMany(new Map(selected.filter((i) => !i.b.locked).map((i) => [i.key, { ...i.b, x: i.b.x + delta[e.key][0], y: i.b.y + delta[e.key][1] }]))); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(selected); }
      else if (e.key === "Escape") { setSel([]); setTool("select"); }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", key); };
  });

  // ---------- เครื่องมือวาด ----------
  /** ตำแหน่งเมาส์เป็น pt บนกระดาษ (ดูดติดเส้นนำ/กริด) */
  const toPt = (e: { clientX: number; clientY: number }) => {
    const r = paperRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
    const t = targets(new Set());
    const sx = snapOn ? nearest([x], t.xs) : null, sy = snapOn ? nearest([y], t.ys) : null;
    return { x: Math.max(0, Math.min(P.w, sx ? sx.at : toGrid(x))), y: Math.max(0, Math.min(P.h, sy ? sy.at : toGrid(y))) };
  };
  const startDraw = (e: React.PointerEvent) => {
    if (tool === "select" || !canEdit || (!bodyOn && !letterhead)) return;
    e.preventDefault(); e.stopPropagation();
    const p = toPt(e);
    setMoving(true);
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const finishDraw = (d: { x0: number; y0: number; x1: number; y1: number }) => {
    setDraft(null);
    const dx = d.x1 - d.x0, dy = d.y1 - d.y0;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
    const w = Math.max(4, Math.abs(dx)), h = Math.max(4, Math.abs(dy));
    const b = tool === "line"
      ? (Math.abs(dx) >= Math.abs(dy) ? newBlock("line", { x, y: d.y0, w: Math.abs(dx), h: 1, color: "@primary" }) : newBlock("line", { x: d.x0, y, w: 1, h: Math.abs(dy), color: "@primary" }))
      : tool === "text" ? newBlock("text", { x, y, w: Math.max(20, w), h: Math.max(12, h), text: "ข้อความ" })
      : tool === "grid" ? newBlock("grid", { x, y, w: Math.max(20, w), h: Math.max(12, h), rows: 3, cols2: 3 })
      : newBlock("rect", { x, y, w, h, border: "@primary", radius: 0 });
    const key = `${addZone === "head" ? "h" : "d"}:${b.id}`;
    applyMany(new Map(), [{ zone: addZone, b }]);
    setSel([key]);
    setTool("select");
    // กล่องข้อความที่วาดใหม่: พิมพ์ได้ทันที
    if (b.kind === "text") setEditing(key);
  };

  const start = (e: React.PointerEvent, it: Item, mode: "move" | "size", edge?: string) => {
    if (tool !== "select") return; // โหมดวาด: ให้กระดาษรับการลากแทน
    e.stopPropagation();
    let next = sel;
    const members = groupOf(it);
    if ((e.shiftKey || e.ctrlKey || e.metaKey) && mode === "move") next = sel.includes(it.key) ? sel.filter((k) => !members.includes(k)) : [...sel, ...members.filter((k) => !sel.includes(k))];
    else if (mode === "size") next = [it.key];
    else if (!sel.includes(it.key)) next = members; // คลิกสมาชิกกลุ่ม = เลือกทั้งกลุ่ม (ดับเบิลคลิกเพื่อแก้กล่องเดียว)
    // คลิก (ไม่กด Ctrl) กล่องที่อยู่ในกลุ่มที่เลือกไว้: ลาก = ย้ายทั้งชุด · ปล่อยโดยไม่ลาก = เลือกเฉพาะกล่องนี้ (แบบ PowerPoint)
    const pick = mode === "move" && !(e.shiftKey || e.ctrlKey || e.metaKey) && sel.includes(it.key) && next.length > members.length ? members : undefined;
    setSel(next);
    if (!canEdit || !next.includes(it.key)) return;
    const keys = (mode === "size" ? [it.key] : next).filter((k) => !byKey.get(k)?.b.locked);
    if (!keys.length) { if (pick) setSel(pick); return; } // กล่องที่ล็อกไว้: เลือกได้แต่ไม่ขยับ
    e.preventDefault();
    setMoving(true);
    drag.current = { mode, px: e.clientX, py: e.clientY, orig: new Map(keys.map((k) => [k, byKey.get(k)!.b])), h: 0, edge, pick };
  };
  const startHead = (e: React.PointerEvent) => {
    if (!canEdit || !letterhead) return;
    e.preventDefault(); e.stopPropagation();
    drag.current = { mode: "head", px: e.clientX, py: e.clientY, orig: new Map(), h: letterhead.height };
  };

  // ---------- จัดชิด/กระจาย ----------
  const align = (how: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
    if (!selected.length) return;
    const list = selected.map((i) => i.b);
    // กล่องเดียว: จัดเทียบหน้ากระดาษ (ระยะขอบ) · หลายกล่อง: จัดเทียบกรอบรวม
    const L = multi ? Math.min(...list.map((b) => b.x)) : M[3], R = multi ? Math.max(...list.map((b) => b.x + b.w)) : P.w - M[1];
    const T0 = multi ? Math.min(...list.map((b) => b.y)) : M[0], B0 = multi ? Math.max(...list.map((b) => b.y + b.h)) : P.h - M[2];
    applyMany(new Map(selected.map((i) => {
      const b = i.b;
      const pos = how === "left" ? { x: L } : how === "right" ? { x: R - b.w } : how === "hcenter" ? { x: (L + R) / 2 - b.w / 2 }
        : how === "top" ? { y: T0 } : how === "bottom" ? { y: B0 - b.h } : { y: (T0 + B0) / 2 - b.h / 2 };
      return [i.key, { ...b, ...pos }];
    })));
  };
  /** เรียงกล่องที่เลือกต่อกัน (ลงมา/ไปทางขวา) เว้นระยะเท่ากัน gap pt */
  const stack = (axis: "x" | "y") => {
    const size = axis === "x" ? "w" : "h";
    const sorted = [...selected].sort((a, b) => a.b[axis] - b.b[axis]);
    let p = sorted[0].b[axis];
    applyMany(new Map(sorted.map((i) => { const n = { ...i.b, [axis]: p }; p += i.b[size] + gap; return [i.key, n]; })));
  };
  /** ตั้งค่าหน้ากระดาษ (ขนาด แนว ขอบ) — ขอบเท่ากันทุกด้านเก็บเป็นค่าเดียว */
  const setPage = (patch: { paper?: PaperSize; landscape?: boolean; margins?: Margins }) => {
    if (!canEdit || !bodyOn) return;
    const next: FreeLayout = { ...layout };
    if (patch.paper !== undefined) { if (patch.paper === "A4") delete next.paper; else next.paper = patch.paper; }
    if (patch.landscape !== undefined) { if (patch.landscape) next.landscape = true; else delete next.landscape; }
    if (patch.margins) { const m = patch.margins; delete next.margins; next.margin = m[0]; if (!m.every((v) => v === m[0])) next.margins = m; }
    commitLayout({ ...next, blocks: refit ? refitBlocks(layout.blocks, P, M, pageOf(next), marginsOf(next)) : layout.blocks });
  };
  /** กรอบหลัก = กล่องแรกที่คลิก (รวมกลุ่มของมัน) · กล่องที่คลิกทีหลังขยับเข้าหา */
  const anchorKeys = multi && primary ? groupOf(primary).filter((k) => sel.includes(k)) : [];
  /** วางกล่องที่คลิกทีหลังไว้ด้านบน/ล่าง/ซ้าย/ขวาของกรอบหลัก ห่าง g pt (ติดลบ = ซ้อนเข้าไป) · แนวอีกแกนคงเดิม */
  const placeBy = (to: "top" | "bottom" | "left" | "right", g = gap) => {
    const anchor = selected.filter((i) => anchorKeys.includes(i.key)), movers = selected.filter((i) => !anchorKeys.includes(i.key) && !i.b.locked);
    if (!anchor.length || !movers.length) return;
    const box = (l: Item[]) => ({ L: Math.min(...l.map((i) => i.b.x)), R: Math.max(...l.map((i) => i.b.x + i.b.w)), T: Math.min(...l.map((i) => i.b.y)), B: Math.max(...l.map((i) => i.b.y + i.b.h)) });
    const a = box(anchor), m = box(movers);
    const dx = to === "right" ? a.R + g - m.L : to === "left" ? a.L - g - m.R : 0;
    const dy = to === "bottom" ? a.B + g - m.T : to === "top" ? a.T - g - m.B : 0;
    setSide(to);
    applyMany(new Map(movers.map((i) => [i.key, { ...i.b, x: i.b.x + dx, y: i.b.y + dy }])));
  };
  /** ยังไม่ได้กดเลือกด้าน: เดาจากตำแหน่งตอนนี้ (กรอบที่คลิกทีหลังอยู่ด้านไหนของกรอบหลักมากที่สุด) */
  const guessSide = (): "top" | "bottom" | "left" | "right" | null => {
    const anchor = selected.filter((i) => anchorKeys.includes(i.key)), movers = selected.filter((i) => !anchorKeys.includes(i.key));
    if (!anchor.length || !movers.length) return null;
    const c = (l: Item[]) => { const L = Math.min(...l.map((i) => i.b.x)), R = Math.max(...l.map((i) => i.b.x + i.b.w)), T = Math.min(...l.map((i) => i.b.y)), B = Math.max(...l.map((i) => i.b.y + i.b.h)); return { x: (L + R) / 2, y: (T + B) / 2, w: R - L, h: B - T }; };
    const a = c(anchor), m = c(movers), dx = (m.x - a.x) / Math.max(1, a.w + m.w), dy = (m.y - a.y) / Math.max(1, a.h + m.h);
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
  };
  const setGapLive = (v: number) => { const g = Math.max(-200, Math.min(300, v)); setGap(g); const to = side || guessSide(); if (to) placeBy(to, g); };
  const distribute = (axis: "x" | "y") => {
    if (selected.length < 3) return;
    const size = axis === "x" ? "w" : "h";
    const sorted = [...selected].sort((a, b) => a.b[axis] - b.b[axis]);
    const start0 = sorted[0].b[axis], end = Math.max(...sorted.map((i) => i.b[axis] + i.b[size]));
    const gap = (end - start0 - sorted.reduce((s, i) => s + i.b[size], 0)) / (sorted.length - 1);
    let p = start0;
    applyMany(new Map(sorted.map((i) => { const n = { ...i.b, [axis]: p }; p += i.b[size] + gap; return [i.key, n]; })));
  };

  // ---------- เพิ่ม/ย้ายกล่อง ----------
  const addZone: Zone = letterOnly || !bodyOn ? "head" : "doc";
  const addable = (letterOnly ? HEAD_KINDS.filter((k) => k !== "title" && k !== "meta") : !bodyOn ? HEAD_KINDS : addableBlocksFor(docType)).filter((k) => !SINGLE.includes(k) || !items.some((i) => i.b.kind === k));
  const newBlock = (kind: BlockKind, extra: Partial<FreeBlock> = {}): FreeBlock => {
    const id = `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
    const def = defaultFreeLayout(docType, font).blocks.find((b) => b.kind === kind);
    const size: Record<string, [number, number]> = { text: [200, 24], line: [300, 1.5], rect: [200, 80], image: [120, 80], logo: [64, 64], stamp: [72, 72], field: [180, 18], sign: [120, 46], grid: [300, 90] };
    const [w, h] = def ? [def.w, def.h] : size[kind] || [200, 40];
    // ลายเซ็น: เริ่มที่ช่องลงนามแรก แสดงเฉพาะรูปลายเซ็น (ชื่อ/วันที่อยู่ในช่องลงนามอยู่แล้ว)
    if (kind === "grid") extra = { rows: 3, cols2: 3, ...extra };
    if (kind === "sign") extra = { slot: defaultSignatures[0], hide: ["name", "title", "date"], ...extra };
    return { id, kind, x: def?.x ?? 60, y: def?.y ?? (addZone === "head" ? 30 : 160), w, h, ...(kind === "text" ? { text: "ข้อความ {{number}}", fontSize: 10 } : {}), ...(kind === "field" ? { field: "number" } : {}), ...extra };
  };
  const presetFields = (id: string) => id === "seller" ? ["seller.name", "seller.address", "seller.taxId", "seller.contact"]
    : id === "customer" ? ["customer.name", "customer.address", "customer.taxId", "customer.contact", "customer.phone"]
    : id === "doc" ? ["number", "date", ...docMeta.map((l) => `m:${l}`)]
    : id === "extra" ? docFields.map((f) => `f:${f.key}`) : [];
  const addInfo = (id: string, at?: { x: number; y: number }) => {
    const fields = presetFields(id);
    const row = Math.round(theme.fontSize * FONT_SCALE[font] * 1.45 + 3);
    let b = newBlock("info", { fields, w: id === "doc" ? 200 : 260, h: Math.max(30, (fields.length || 2) * row + 8), ...(id === "seller" || id === "customer" ? { emphasizeFirst: true } : {}), ...(id === "doc" ? { labelWidth: 60 } : {}) });
    // วางกลางจอ (หรือจุดที่ลากมาปล่อย)
    const c = at || visibleCenter();
    b = { ...b, x: Math.round(Math.max(0, Math.min(P.w - b.w, c.x - b.w / 2))), y: Math.round(Math.max(0, Math.min(P.h - b.h, c.y - b.h / 2))) };
    applyMany(new Map(), [{ zone: addZone, b }]);
    setSel([`${addZone === "head" ? "h" : "d"}:${b.id}`]);
  };
  /** ตำแหน่ง (pt) ของจุดกึ่งกลางกระดาษที่มองเห็นบนจอ */
  const visibleCenter = () => {
    const r = paperRef.current?.getBoundingClientRect();
    if (!r) return { x: P.w / 2, y: 200 };
    return { x: P.w / 2, y: Math.max(40, Math.min(P.h - 60, (window.innerHeight / 2 - r.top) / S)) };
  };
  /** เพิ่มกล่องให้กึ่งกลางอยู่ที่จุด (pt) */
  const addAt = (kind: string, at: { x: number; y: number }) => {
    let b: FreeBlock;
    if (kind.startsWith("info:")) { addInfo(kind.slice(5), at); return; }
    if (kind === "line") b = newBlock("line", { w: 200, h: 1, color: "@primary" });
    else if (kind === "rect") b = newBlock("rect", { w: 200, h: 80, border: "@primary", radius: 0 });
    else if (kind.startsWith("shape:")) b = newBlock("shape", { shape: kind.slice(6) as "ellipse" | "triangle", w: 90, h: 90, border: "@primary", borderWidth: 1.5 });
    else b = newBlock(kind as BlockKind);
    // เพิ่มซ้ำที่จุดเดิม: เลื่อนเยื้องให้เห็นทุกชิ้น
    let x = Math.round(at.x - b.w / 2), y = Math.round(at.y - b.h / 2);
    while (items.some((i) => Math.abs(i.b.x - x) < 2 && Math.abs(i.b.y - y) < 2)) { x += 16; y += 16; }
    b = { ...b, x, y };
    applyMany(new Map(), [{ zone: addZone, b }]);
    setSel([`${addZone === "head" ? "h" : "d"}:${b.id}`]);
    if (kind === "text") setEditing(`${addZone === "head" ? "h" : "d"}:${b.id}`);
  };
  const add = (kind: BlockKind) => { const b = newBlock(kind); applyMany(new Map(), [{ zone: addZone, b }]); setSel([`${addZone === "head" ? "h" : "d"}:${b.id}`]); };
  /** ย้ายกล่องระหว่างหัวกระดาษ (ใช้ร่วม) กับเนื้อเอกสาร */
  const moveZone = (it: Item) => {
    if (!letterhead) return;
    const b = { ...it.b, id: `${it.b.id}-${Date.now().toString(36).slice(-3)}` };
    if (it.zone === "doc") {
      commitHead({ ...letterhead, blocks: [...letterhead.blocks, b] });
      commitLayout({ ...layout, blocks: layout.blocks.filter((x) => x.id !== it.b.id) });
      setSel([`h:${b.id}`]);
    } else {
      commitLayout({ ...layout, blocks: [...layout.blocks.filter((x) => x.kind !== it.b.kind || !DEDUP.includes(x.kind)), b] });
      commitHead({ ...letterhead, blocks: letterhead.blocks.filter((x) => x.id !== it.b.id) });
      setSel([`d:${b.id}`]);
    }
  };
  const reorder = (it: Item, dir: -1 | 1) => {
    const list = it.zone === "head" ? letterhead!.blocks : layout.blocks;
    const i = list.findIndex((x) => x.id === it.b.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    if (it.zone === "head") commitHead({ ...letterhead!, blocks: next }); else commitLayout({ ...layout, blocks: next });
  };

  // ---------- ข้อมูลในเอกสาร ----------
  const meta = firstOf("meta");
  const fieldOptions = [
    { key: "number", label: "เลขที่" }, { key: "date", label: "วันที่" },
    ...docMeta.map((l) => ({ key: `m:${l}`, label: l })), ...docFields.map((f) => ({ key: `f:${f.key}`, label: f.label })),
    ...SUB_FIELDS,
    ...(docHasCopy(docType) ? [{ key: "copy", label: "ต้นฉบับ/สำเนา" }] : []),
  ];

  /** เลือกสี: สีของธีม (เปลี่ยนชุดสีแล้วเปลี่ยนตาม — แนะนำ) หรือสีกำหนดเอง */
  const colorRow = (it: Item, label: string, key: "color" | "bg" | "border" | "headBg" | "lineColor") => {
    const v = it.b[key];
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-white/60 w-[64px]">{label}</span>
          <input type="color" value={resolveColor(v, theme) || "#ffffff"} onChange={(e) => update(it, { [key]: e.target.value } as any)} className="w-8 h-8 rounded bg-transparent border border-white/10" aria-label={label} title="สีกำหนดเอง (ไม่เปลี่ยนตามชุดสี)" />
          {v && <button type="button" className="text-[12px] text-white/50 hover:text-white" onClick={() => unset(it, key)}>{key === "color" || key === "headBg" || key === "lineColor" ? "ตามแม่แบบ" : "ไม่มี"}</button>}
        </div>
        <div className="flex flex-wrap gap-1 pl-[72px]">
          {Object.entries(COLOR_TOKENS).map(([tok, name]) => (
            <button key={tok} type="button" title={`${name}ของธีม (เปลี่ยนตามชุดสี)`} onClick={() => update(it, { [key]: tok } as any)}
              className={cn("h-6 pl-0.5 pr-1.5 rounded-full border text-[10.5px] flex items-center gap-1", v === tok ? "border-nexus-teal/60 text-white" : "border-white/10 text-white/50 hover:text-white")}>
              <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: resolveColor(tok, theme) }} />{name}
            </button>
          ))}
        </div>
      </div>
    );
  };
  const numInput = (it: Item, key: "x" | "y" | "w" | "h") => (
    <PillInput inputMode="decimal" value={Math.round(it.b[key] * 10) / 10} onChange={(e) => update(it, { [key]: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } as any)} className="h-8 w-full text-sm font-mono text-right" />
  );

  const textRef = useRef<HTMLTextAreaElement>(null);
  const variables = [...TEXT_VARIABLES, ...docMeta.map((l) => ({ key: `m:${l}`, label: l, source: docTitle })), ...docFields.map((f) => ({ key: `f:${f.key}`, label: f.label, source: docTitle }))];

  const fieldLabel = (k: string) => fieldOptions.find((o) => o.key === k)?.label || k;
  /** กล่องข้อมูล: หัวข้อที่แสดง (เรียงลำดับ ตั้งชื่อเอง) + ติ๊กเพิ่มจากข้อมูลทั้งหมดของเอกสาร */
  const infoEditor = (it: Item) => {
    const b = it.b, f = b.fields || [], names = b.names || {};
    const set = (fields: string[]) => update(it, { fields, names: Object.fromEntries(Object.entries(names).filter(([k]) => fields.includes(k))) });
    const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= f.length) return; const n = [...f]; [n[i], n[j]] = [n[j], n[i]]; set(n); };
    const groups: { title: string; keys: string[] }[] = [
      { title: `ข้อมูล${docTitle}`, keys: ["number", "date", "title", "titleEn", ...(docHasCopy(docType) ? ["copy"] : []), ...docMeta.map((l) => `m:${l}`)] },
      ...(docFields.length ? [{ title: "ข้อมูลเพิ่ม", keys: docFields.map((x) => `f:${x.key}`) }] : []),
      { title: "บริษัท (ผู้ขาย)", keys: SUB_FIELDS.filter((x) => x.key.startsWith("seller.")).map((x) => x.key) },
      { title: "ลูกค้า / คู่ค้า", keys: SUB_FIELDS.filter((x) => x.key.startsWith("customer.")).map((x) => x.key) },
    ];
    return (
      <fieldset disabled={!canEdit} className="space-y-2">
        <p className="text-[11.5px] font-bold text-white/70">หัวข้อในกล่อง · เรียงจากบนลงล่าง</p>
        {f.length === 0 && <p className="text-[11.5px] text-amber-200/80">ยังไม่มีหัวข้อ — ติ๊กเลือกด้านล่าง</p>}
        <div className="space-y-1">
          {f.map((k, i) => (
            <div key={k} className="flex items-center gap-1">
              <span className="w-5 text-[10.5px] text-white/35 text-right">{i + 1}</span>
              <PillInput value={names[k] || ""} placeholder={fieldLabel(k)} title="ชื่อหัวข้อที่พิมพ์ (ว่าง = ชื่อตั้งต้น)"
                onChange={(e) => { const v = e.target.value.slice(0, 40); const n = { ...names }; if (v.trim()) n[k] = v; else delete n[k]; update(it, { names: n }); }} className="h-7 flex-1 min-w-0 text-[12px]" />
              <button type="button" title="ขึ้น" disabled={i === 0} onClick={() => move(i, -1)} className="h-7 w-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20"><ArrowUp size={12} /></button>
              <button type="button" title="ลง" disabled={i === f.length - 1} onClick={() => move(i, 1)} className="h-7 w-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20"><ArrowDown size={12} /></button>
              <button type="button" title="เอาออก" onClick={() => set(f.filter((x) => x !== k))} className="h-7 w-6 flex items-center justify-center text-white/40 hover:text-danger"><X size={12} /></button>
            </div>
          ))}
        </div>
        <div className="flex rounded-full bg-white/5 p-1 border border-white/10">
          {([["column", "เรียงแนวตั้ง", StretchVertical], ["row", "เรียงแนวนอน", StretchHorizontal]] as const).map(([v, label, I]) => (
            <button key={v} type="button" onClick={() => (v === "row" ? update(it, { flow: "row" }) : unset(it, "flow"))}
              className={cn("flex-1 h-8 rounded-full text-[12px] flex items-center justify-center gap-1.5", (b.flow || "column") === v ? "bg-nexus-teal/20 text-nexus-teal font-bold" : "text-white/55 hover:text-white")}><I size={13} /> {label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <PillCheckbox label="เน้นแถวแรก" checked={!!b.emphasizeFirst} onChange={(e) => update(it, { emphasizeFirst: e.target.checked || undefined })} />
          <PillCheckbox label="ไม่แสดงป้าย" checked={!!b.hideLabel} onChange={(e) => update(it, { hideLabel: e.target.checked || undefined })} />
          <PillCheckbox label="ค่าตัวหนา" checked={!!b.bold} onChange={(e) => update(it, { bold: e.target.checked || undefined })} />
        </div>
        <p className="text-[11.5px] font-bold text-white/70 pt-1">ติ๊กหัวข้อที่จะแสดง</p>
        {groups.map((g) => (
          <div key={g.title} className="space-y-0.5">
            <p className="text-[11px] text-white/45">{g.title}</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {g.keys.map((k) => <PillCheckbox key={k} label={fieldLabel(k)} checked={f.includes(k)} onChange={(e) => set(e.target.checked ? [...f, k] : f.filter((x) => x !== k))} />)}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-white/40">ทุกหัวข้อดึงข้อมูลจริงตอนพิมพ์ · หัวข้อที่ไม่มีข้อมูลไม่พิมพ์แถว</p>
      </fieldset>
    );
  };
  /** คอลัมน์ตาราง: เลือก เรียง ตั้งชื่อ จัดวาง ความกว้าง (% · ว่าง = อัตโนมัติ) */
  const columnsEditor = (it: Item) => {
    const spec = resolveColumns(it.b, defaultColumns as ItemColumn[]);
    const req = requiredColumnsFor(docType);
    const def = (k: ItemColumn) => ITEM_COLUMNS.find((c) => c.key === k)!;
    const setSpec = (next: ColumnSpec[]) => { const n: any = { ...it.b, colSpec: next }; delete n.cols; applyMany(new Map([[it.key, n]])); };
    const patch = (i: number, p: Partial<ColumnSpec>) => setSpec(spec.map((x, j) => (j === i ? { ...x, ...p } : x)));
    const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= spec.length) return; const n = [...spec]; [n[i], n[j]] = [n[j], n[i]]; setSpec(n); };
    const addCol = (k: ItemColumn) => {
      const at = k === "detail" ? spec.findIndex((x) => x.key === "description") + 1 : spec.some((x) => x.key === "amount") && k !== "amount" ? spec.findIndex((x) => x.key === "amount") : spec.length;
      setSpec([...spec.slice(0, at), { key: k }, ...spec.slice(at)]);
    };
    const off = ITEM_COLUMNS.filter((c) => !spec.some((x) => x.key === c.key));
    const fixed = spec.reduce((a, x) => a + (x.width ?? def(x.key).width ?? 0), 0);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          <PillButton variant="glass" className="h-7 px-2.5 text-[11.5px]" title="จัดวางตามชนิดข้อมูล (ตัวเลขชิดขวา ข้อความชิดซ้าย) และความกว้างอัตโนมัติ"
            onClick={() => setSpec(spec.map((x) => ({ key: x.key, ...(x.label ? { label: x.label } : {}) })))}><Wand2 size={12} /> จัดอัตโนมัติ</PillButton>
          <span className="text-[11px] text-white/45 ml-1">ทั้งตาราง</span>
          {(["left", "center", "right"] as const).map((a) => { const I = ALIGN_ICON[a]; return <button key={a} type="button" title={a === "left" ? "ชิดซ้ายทุกคอลัมน์" : a === "center" ? "กึ่งกลางทุกคอลัมน์" : "ชิดขวาทุกคอลัมน์"} onClick={() => setSpec(spec.map((x) => ({ ...x, align: a })))} className="h-7 w-7 rounded-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white"><I size={12} /></button>; })}
        </div>
        <div className="flex items-center gap-1 text-[10.5px] text-white/40 px-1"><span className="flex-1">หัวคอลัมน์ (ลำดับซ้าย→ขวา)</span><span className="w-[66px] text-center">จัดวาง</span><span className="w-[40px] text-center">กว้าง %</span><span className="w-[62px]" /></div>
        {spec.map((x, i) => {
          const locked = req.includes(x.key), align = x.align || def(x.key).align;
          return (
            <div key={x.key} className="flex items-center gap-1">
              <PillInput value={x.label || ""} placeholder={def(x.key).label} title={`ชื่อหัวคอลัมน์ (ว่าง = ${def(x.key).label})`} onChange={(e) => patch(i, { label: e.target.value.slice(0, 30) || undefined })} className="h-7 flex-1 min-w-0 text-[12px]" />
              <div className="flex w-[66px] justify-center">
                {(["left", "center", "right"] as const).map((a) => { const I = ALIGN_ICON[a]; return <button key={a} type="button" title={a === "left" ? "ชิดซ้าย" : a === "center" ? "กึ่งกลาง" : "ชิดขวา"} onClick={() => patch(i, { align: a })} className={cn("h-7 w-[22px] flex items-center justify-center rounded", align === a ? "bg-nexus-teal/20 text-nexus-teal" : "text-white/40 hover:text-white")}><I size={12} /></button>; })}
              </div>
              <PillInput inputMode="decimal" value={x.width ?? ""} placeholder={def(x.key).width ? String(def(x.key).width) : "–"} title="ความกว้างเป็น % ของตาราง (ว่าง = ค่าตั้งต้น · – = แบ่งพื้นที่ที่เหลือ)"
                onChange={(e) => { const v = e.target.value.replace(/[^d.]/g, ""); patch(i, { width: v === "" ? undefined : Math.max(3, Math.min(80, Number(v))) }); }} className="h-7 w-[40px] text-[11.5px] font-mono text-right px-1.5" />
              <button type="button" title="เลื่อนไปซ้าย" disabled={i === 0} onClick={() => move(i, -1)} className="h-7 w-5 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20"><ArrowUp size={12} /></button>
              <button type="button" title="เลื่อนไปขวา" disabled={i === spec.length - 1} onClick={() => move(i, 1)} className="h-7 w-5 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20"><ArrowDown size={12} /></button>
              <button type="button" title={locked ? "ต้องแสดงเสมอ" : "เอาคอลัมน์ออก"} disabled={locked} onClick={() => setSpec(spec.filter((_y, j) => j !== i))} className="h-7 w-5 flex items-center justify-center text-white/40 hover:text-danger disabled:opacity-20">{locked ? <Lock size={11} /> : <X size={12} />}</button>
            </div>
          );
        })}
        {fixed > 92 && <p className="text-[11px] text-amber-200/80">ความกว้างรวม {Math.round(fixed)}% — คอลัมน์รายการจะแคบ ลองลดความกว้างหรือกด &quot;จัดอัตโนมัติ&quot;</p>}
        {off.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {off.map((c) => <button key={c.key} type="button" onClick={() => addCol(c.key)} className="h-6 px-2 rounded-full border border-dashed border-white/20 text-[11px] text-white/60 hover:text-white hover:border-nexus-teal/50">+ {c.label}</button>)}
          </div>
        )}
        {(it.b.colSpec || it.b.cols) && <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => unset(it, "colSpec", "cols")}>ใช้คอลัมน์ตั้งต้นของเอกสาร</button>}
      </div>
    );
  };

  /** ระยะข้อความของกล่องที่มีป้าย: ป้าย→ข้อมูล · ความกว้างป้าย · ระยะระหว่างแถว */
  const spacingEditor = (it: Item) => {
    const b = it.b;
    const defW = b.kind === "meta" ? 70 : b.kind === "party" ? 110 : 90, defGap = b.kind === "meta" ? 6 : 4, defRow = b.kind === "info" ? 1 : 1.5;
    const slider = (key: "labelGap" | "labelWidth" | "rowGap", label: string, value: number, min: number, max: number, step: number, unit = "pt") => (
      <Field label={`${label} ${value} ${unit}`}>
        <div className="flex items-center gap-2">
          <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => update(it, { [key]: Number(e.target.value) })} className="flex-1 accent-[#0d9488] h-7" />
          {b[key] !== undefined && <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => unset(it, key)}>ค่าเดิม</button>}
        </div>
      </Field>
    );
    return (
      <div className="space-y-1 rounded-xl border border-white/10 p-2.5">
        <p className="text-[11.5px] font-bold text-white/70">ระยะข้อความ (ป้าย : ข้อมูล)</p>
        {slider("labelGap", "ระยะห่างป้ายกับข้อมูล", b.labelGap ?? defGap, 0, 60, 1)}
        {(b.kind !== "field" || b.labelWidth !== undefined) && slider("labelWidth", "ความกว้างช่องป้าย", b.labelWidth ?? defW, 20, 300, 2)}
        {b.kind === "field" && b.labelWidth === undefined && <button type="button" className="text-[11.5px] text-sky-300/80 hover:text-sky-200" onClick={() => update(it, { labelWidth: 80 })}>+ กำหนดความกว้างป้าย (ให้ข้อมูลหลายช่องตรงกัน)</button>}
        {b.kind !== "field" && slider("rowGap", "ระยะห่างระหว่างแถว", b.rowGap ?? defRow, 0, 30, 0.5)}
      </div>
    );
  };
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

        {b.kind === "field" && (
          <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
            <Field label="ข้อมูลที่แสดง">
              <PillSelect value={b.field || "number"} onChange={(e) => update(it, { field: String(e.target.value) })} className="h-8 w-full text-sm">
                {fieldOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </PillSelect>
            </Field>
            <Field label="แสดงในกล่องนี้">
              <PillSelect value={b.show === "label" ? "label" : b.hideLabel ? "value" : "both"} onChange={(e) => { const v = String(e.target.value); update(it, { show: v === "label" ? "label" : undefined, hideLabel: v === "value" ? true : undefined }); }} className="h-8 w-full text-sm">
                <option value="both">หัวข้อ : ข้อมูล</option><option value="label">เฉพาะหัวข้อ</option><option value="value">เฉพาะข้อมูล</option>
              </PillSelect>
            </Field>
            {canEdit && !b.hideLabel && b.show !== "label" && <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => explode(it)}><Split size={13} /> แยกหัวข้อกับข้อมูล (ลากวางแยกกันได้)</PillButton>}
          </div>
        )}

        {b.kind === "info" && <div className="rounded-xl border border-white/10 p-2.5">{infoEditor(it)}</div>}
        {LABEL_KINDS.includes(b.kind) && !b.hideLabel && (b.kind !== "party" || theme.formStyle) && spacingEditor(it)}

        {b.kind === "text" && (
          <div className="space-y-1.5">
            <textarea ref={textRef} value={b.text || ""} onChange={(e) => update(it, { text: e.target.value })} className="w-full min-h-[70px] rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-[13px] leading-[1.9] text-white" />
            <PillSelect value="" onChange={(e) => { const k = String(e.target.value); if (!k) return; const el = textRef.current, cur = b.text || "", at = el ? el.selectionStart : cur.length; update(it, { text: `${cur.slice(0, at)}{{${k}}}${cur.slice(at)}` }); }} className="h-8 w-full text-[12px]">
              <option value="">+ แทรกข้อมูลจากฐานข้อมูล…</option>
              {variables.map((v) => <option key={v.key} value={v.key}>{v.label} · {v.source}</option>)}
            </PillSelect>
            <p className="text-[11px] text-white/40">ข้อมูลในวงเล็บ {"{{ }}"} ถูกแทนด้วยข้อมูลจริงของเอกสารตอนพิมพ์</p>
          </div>
        )}

        {TEXT_BLOCKS.includes(b.kind) && (b.fontSize !== undefined || b.lineHeight !== undefined || b.align || b.color || b.bold || b.italic || b.underline || b.strike || b.letterSpacing || b.font) && (
          <PillButton variant="ghost" className="h-8 px-3 text-xs w-full" onClick={() => unset(it, "fontSize", "lineHeight", "align", "color", "bold", "italic", "underline", "strike", "letterSpacing", "font")}><RotateCcw size={13} /> ตัวอักษรกลับเป็นตามแม่แบบ</PillButton>
        )}

        {parts.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">ข้อมูลที่แสดง</p>
            {parts.filter((p) => !(b.kind === "title" && p.key === "copy") && !(b.kind === "items" && p.key === "detail" && resolveColumns(b, defaultColumns as ItemColumn[]).some((x) => x.key === "detail"))).map((p) => (
              <PillCheckbox key={p.key} label={p.label} checked={!hide.has(p.key)} onChange={(e) => update(it, { hide: e.target.checked ? [...hide].filter((k) => k !== p.key) : [...hide, p.key] })} />
            ))}
            {(b.kind === "seller" || b.kind === "party") && <p className="text-[11px] text-white/40">ชื่อ ที่อยู่ เลขผู้เสียภาษี แสดงเสมอ (กฎหมายกำหนด)</p>}
          </div>
        )}
        {(b.kind === "meta" || b.kind === "totals") && (
          <div className="space-y-1"><p className="text-[11.5px] font-bold text-white/70">แถวที่แสดง</p><DataChecklist compact canEdit={canEdit} groups={groups.filter((g) => g.id === (b.kind === "meta" ? "doc" : "totals"))} onToggle={toggle} /></div>
        )}

        {b.kind === "items" && (
          <div className="space-y-1.5 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">คอลัมน์ในตาราง</p>
            {columnsEditor(it)}
            <PillCheckbox label="ยืดตารางเต็มกล่อง (เส้นคอลัมน์ถึงล่าง)" checked={!!b.fill} onChange={(e) => update(it, { fill: e.target.checked })} />
            <Field label="รูปแบบตาราง">
              <PillSelect value={b.table || ""} onChange={(e) => (e.target.value ? update(it, { table: e.target.value as any }) : unset(it, "table"))} className="h-8 w-full text-sm">
                <option value="">ตามแม่แบบ</option><option value="tint">หัวตารางสีอ่อน</option><option value="solid">หัวตารางสีทึบ</option><option value="lines">เส้นบาง</option><option value="grid">เส้นครบ</option><option value="zebra">แถวสลับสี</option>
              </PillSelect>
            </Field>
            {colorRow(it, "พื้นหัวตาราง", "headBg" as any)}
            {colorRow(it, "สีเส้นตาราง", "lineColor" as any)}
            <Field label="ความหนาเส้นกรอบตาราง (pt)">
              <PillInput inputMode="decimal" value={b.borderWidth ?? 1} onChange={(e) => update(it, { borderWidth: Math.max(0.25, Math.min(8, Number(e.target.value.replace(/[^\d.]/g, "")) || 0.25)) })} className="h-8 w-full text-sm font-mono text-right" />
            </Field>
          </div>
        )}
        {b.kind === "totals" && (
          <Field label="รูปแบบยอดรวม">
            <PillSelect value={b.totalsStyle || ""} onChange={(e) => (e.target.value ? update(it, { totalsStyle: e.target.value as any }) : unset(it, "totalsStyle"))} className="h-8 w-full text-sm">
              <option value="">ตามแม่แบบ</option><option value="solid">พื้นสีเต็ม</option><option value="outline">กรอบสี</option><option value="plain">เส้นคั่น</option><option value="grid">ตารางป้าย/ยอด</option>
            </PillSelect>
          </Field>
        )}
        {b.kind === "party" && (
          <Field label="กรอบข้อมูลลูกค้า">
            <PillSelect value={b.partyStyle || ""} onChange={(e) => (e.target.value ? update(it, { partyStyle: e.target.value as any }) : unset(it, "partyStyle"))} className="h-8 w-full text-sm">
              <option value="">ตามแม่แบบ</option><option value="accent-bar">แถบสีด้านซ้าย</option><option value="boxed">กรอบเต็ม</option><option value="plain">เส้นใต้</option><option value="none">ไม่มีกรอบ</option>
            </PillSelect>
          </Field>
        )}

        {b.kind === "signatures" && (
          <>
            <Field label="ชื่อช่องลงนาม (คั่นด้วย , สูงสุด 4 ช่อง)">{sigInput(b.labels || [], (v) => (v ? update(it, { labels: v }) : unset(it, "labels")))}</Field>
            <Field label={`ระยะห่างระหว่างช่อง ${b.gap ?? 16} pt (เว้นกลางวางโลโก้/ตราประทับได้)`}>
              <input type="range" min={0} max={300} step={2} value={b.gap ?? 16} onChange={(e) => update(it, { gap: Number(e.target.value) })} className="w-full accent-[#0d9488] h-8" />
            </Field>
          </>
        )}

        {b.kind === "grid" && (
          <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">ตาราง (เส้นแบ่งช่องเท่ากัน)</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="จำนวนแถว"><PillInput type="number" min={1} max={40} value={b.rows ?? 3} onChange={(e) => update(it, { rows: Math.max(1, Math.min(40, Math.round(Number(e.target.value) || 1))) })} className="h-8 w-full text-sm text-right" /></Field>
              <Field label="จำนวนคอลัมน์"><PillInput type="number" min={1} max={20} value={b.cols2 ?? 3} onChange={(e) => update(it, { cols2: Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))) })} className="h-8 w-full text-sm text-right" /></Field>
            </div>
            {colorRow(it, "พื้นแถวหัว", "headBg" as any)}
            <p className="text-[11px] text-white/45">วางกล่องข้อความหรือข้อมูลลงในช่อง แล้วกด จัดกลุ่ม เพื่อให้ตารางกับข้อความลากไปด้วยกัน · สีเส้น/ความหนาที่แท็บ กรอบ · พื้น</p>
          </div>
        )}
        {b.kind === "sign" && (
          <div className="space-y-1.5 rounded-xl border border-white/10 p-2.5">
            <Field label="ลายเซ็นของ">
              <PillSelect value={b.signer ? `signer:${b.signer}` : `slot:${b.slot || ""}`} onChange={(e) => { const raw = String(e.target.value), i = raw.indexOf(":"), t = raw.slice(0, i), v = raw.slice(i + 1); update(it, t === "signer" ? { signer: v, slot: undefined } : { slot: v, signer: undefined }); }} className="h-8 w-full text-sm">
                {defaultSignatures.map((l) => <option key={`slot:${l}`} value={`slot:${l}`}>ช่อง: {l}</option>)}
                {signers.map((p) => <option key={`signer:${p.id}`} value={`signer:${p.id}`}>{p.name}{p.position ? ` (${p.position})` : ""} เสมอ</option>)}
              </PillSelect>
            </Field>
            <p className="text-[11px] text-white/45 leading-relaxed">
              {b.signer ? "ใช้ลายเซ็นของคนนี้ทุกเอกสารชนิดนี้ที่ออกจริง" : "ใช้ลายเซ็นของช่องนี้: ผู้ลงนามที่กำหนดในแท็บ \"ลายเซ็น · ตราประทับ\" หรือลายเซ็นจริง (เช่น ลูกค้าเซ็นบนมือถือ) — ช่องลงนามจะไม่พิมพ์รูปซ้ำ"}
              {" "}· พิมพ์เฉพาะเอกสารที่ออกจริง (ฉบับร่าง/ยกเลิกไม่มีลายเซ็น) · ขนาดจริงคงที่ ย่อ/ขยายไม่ได้ (ย้ายตำแหน่งได้)
            </p>
            {!signers.length && <p className="text-[11px] text-warning/90">ยังไม่มีผู้ลงนาม — เพิ่มลายเซ็นที่แท็บ &quot;ลายเซ็น · ตราประทับ&quot;</p>}
          </div>
        )}
        {b.kind === "stamp" && <p className="text-[11px] text-white/45">รูปตราและขนาดตราตั้งที่แท็บ &quot;ลายเซ็น · ตราประทับ&quot; (ขนาดจริงคงที่ ย่อ/ขยายในหน้านี้ไม่ได้) · พิมพ์เฉพาะเอกสารที่ออกจริง (ฉบับร่าง/ยกเลิกไม่มีตรา) · ตอนพิมพ์เลือกไม่ใส่ได้</p>}
        {b.kind === "rect" && <p className="text-[11px] text-white/45">กรอบคลิกเลือกที่เส้นขอบ (ข้างในคลิกข้อมูลที่อยู่ในกรอบได้) หรือเลือกจากรายการชั้น</p>}
        {b.kind === "image" && (
          <>
            <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> เลือกรูป (PNG/JPG)</PillButton>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) update(it, { src: await shrinkImage(f) }); }} />
          </>
        )}
        {b.kind === "line" && (() => {
          const vertical = b.h > b.w, thick = vertical ? b.w : b.h;
          return <PillButton variant="ghost" className="h-8 px-3 text-xs w-full" onClick={() => update(it, vertical ? { w: b.h, h: thick } : { w: thick, h: Math.max(20, b.w) })}>{vertical ? "เปลี่ยนเป็นแนวนอน" : "เปลี่ยนเป็นแนวตั้ง"}</PillButton>;
        })()}
        {/* สี เส้น ความหนา รูปทรง ขอบใน อยู่ที่แท็บรูปแบบบนแถบเครื่องมือ · ที่นี่เหลือมุมโค้ง (ปรับแยกแต่ละมุมได้) */}
        {!["line", "shape"].includes(b.kind) && (
          <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">{["image", "logo", "stamp", "sign"].includes(b.kind) ? "กรอบ · พื้น · มุม" : "มุม"}</p>
            {["image", "logo", "stamp", "sign"].includes(b.kind) && <>{colorRow(it, "พื้นหลัง", "bg")}{colorRow(it, "กรอบ", "border")}</>}
            {<>
            <Field label={`มุม ${b.radii ? "แยกแต่ละมุม" : b.radius === undefined ? "ตามแม่แบบ" : b.radius === 0 ? "เหลี่ยม" : `โค้ง ${b.radius} pt`}`}>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={30} step={1} value={b.radius ?? (theme.rounded ? 4 : 0)} onChange={(e) => update(it, { radius: Number(e.target.value) })} className="flex-1 accent-[#0d9488] h-8" />
                <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => update(it, { radius: 0 })}>เหลี่ยม</button>
                {b.radius !== undefined && <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => unset(it, "radius")}>ตามแม่แบบ</button>}
              </div>
            </Field>
            <PillCheckbox label="ปรับโค้งแยกแต่ละมุม" checked={!!b.radii} onChange={(e) => { if (e.target.checked) { const r = b.radius ?? (theme.rounded ? 4 : 0); update(it, { radii: [r, r, r, r] }); } else unset(it, "radii"); }} />
            {b.radii && (
              <div className="grid grid-cols-2 gap-2">
                {(["บนซ้าย", "บนขวา", "ล่างขวา", "ล่างซ้าย"] as const).map((label, i) => (
                  <Field key={label} label={`${label} (pt)`}>
                    <PillInput inputMode="decimal" value={b.radii![i]} onChange={(e) => { const r = [...b.radii!] as [number, number, number, number]; r[i] = Math.max(0, Math.min(60, Number(e.target.value.replace(/[^\d.]/g, "")) || 0)); update(it, { radii: r }); }} className="h-8 w-full text-sm font-mono text-right" />
                  </Field>
                ))}
              </div>
            )}
            {["items", "totals", "party", "words"].includes(b.kind) && <p className="text-[11px] text-white/40">มุมใช้กับกรอบตาราง/ยอดรวม/ลูกค้าภายในกล่องด้วย</p>}
            </>}
          </div>
        )}

        {letterhead && !letterOnly && HEAD_KINDS.includes(b.kind) && (
          <PillCheckbox label="อยู่ในหัวกระดาษ (ใช้ร่วมกับเอกสารที่ใช้หัวนี้)" checked={it.zone === "head"} onChange={() => moveZone(it)} />
        )}
        {canEdit && (SPLITTABLE.includes(b.kind) || b.kind === "info") && (
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-2.5 space-y-1.5">
            <p className="text-[11.5px] text-white/65 leading-relaxed">จัดวางเอง: แยกหัวข้อกับข้อมูลเป็นคนละชิ้น (ข้อมูลยังดึงจากฐานข้อมูลเหมือนเดิม) · หัวข้อกับข้อมูลแถวเดียวกันจับคู่กัน: ลาก = ย้ายไปด้วยกัน · ดับเบิลคลิกแล้วลาก = ย้ายชิ้นเดียว · กรอบ/พื้นหลังแยกเป็นกรอบอีกชิ้น</p>
            {b.kind !== "title" && <PillButton variant="primary" className="h-8 px-3 text-xs w-full" onClick={() => explode(it)}><Split size={13} /> แยกหัวข้อกับข้อมูลทุกแถว</PillButton>}
            {b.kind !== "info" && <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => splitBlock(it)}><Split size={13} /> แยกเป็นแถว (หัวข้อ : ข้อมูล อยู่ด้วยกัน)</PillButton>}
            {b.kind !== "title" && b.kind !== "info" && <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => toInfo(it)}><Rows3 size={13} /> เปลี่ยนเป็นกล่องข้อมูล (ติ๊กเลือก/เรียงหัวข้อเอง)</PillButton>}
          </div>
        )}
        {b.group && <p className="text-[11.5px] text-purple-200/80 flex items-center gap-1"><GroupIcon size={12} /> อยู่ในกลุ่ม — คลิกเลือกทั้งกลุ่ม · ดับเบิลคลิกแก้กล่องเดียว</p>}
      </fieldset>
    );
  };

  const sigInput = (value: string[], onSet: (v: string[] | undefined) => void) => (
    <PillInput value={value.join(", ")} placeholder={defaultSignatures.join(", ")} disabled={!canEdit}
      onChange={(e) => { const l = e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 4); onSet(l.length ? l : undefined); }} className="h-8 w-full text-sm" />
  );
  // ---------- ข้อมูลที่แสดง (รายการติ๊กเดียว ใช้ร่วมกับหน้าแบบง่าย) ----------
  const groups = letterOnly ? [] : dataGroups(layout, { ...dataCtx, head: letterhead?.blocks });
  const toggle = (key: string, on: boolean) => commitLayout(toggleData(layout, key, on, { ...dataCtx, head: letterhead?.blocks }));

  // ---------- ชั้นของกล่อง (บนสุดอยู่บน) ----------
  const nameOf = (b: FreeBlock) => `${BLOCK_LABELS[b.kind]}${b.kind === "info" && b.fields?.length ? ` · ${fieldLabel(b.fields[0])}` : ""}${b.kind === "field" ? ` · ${fieldOptions.find((f) => f.key === b.field)?.label || ""}` : b.kind === "text" ? ` · ${(b.text || "").slice(0, 18)}` : ""}`;
  const layersPanel = (
    <div className="space-y-1">
      <p className="text-[11.5px] text-white/45 mb-1">บนสุดอยู่บนรายการ · คลิกเพื่อเลือก · 📌 ล็อกตำแหน่ง</p>
      {[...items].reverse().map((it) => (
        <div key={it.key} className={cn("flex items-center gap-1.5 h-8 px-2 rounded-lg border text-[12px] cursor-pointer", sel.includes(it.key) ? "border-nexus-teal/50 bg-nexus-teal/10 text-white" : "border-transparent text-white/70 hover:bg-white/5")}
          onClick={(e) => { setSel(e.shiftKey || e.ctrlKey || e.metaKey ? (sel.includes(it.key) ? sel.filter((k) => k !== it.key) : [...sel, it.key]) : [it.key]); }}>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", it.zone === "head" ? "bg-purple-400" : "bg-nexus-teal")} />
          <span className="truncate flex-1">{nameOf(it.b)}{isLocked(it) ? " 🔒" : ""}</span>
          {it.b.group && <GroupIcon size={11} className="text-purple-300/70 flex-shrink-0" />}
          {canEdit && <button type="button" title={it.b.locked ? "ปลดล็อก" : "ล็อกตำแหน่ง"} onClick={(e) => { e.stopPropagation(); update(it, { locked: it.b.locked ? undefined : true }); }} className={cn("p-1 rounded", it.b.locked ? "text-warning" : "text-white/30 hover:text-white")}>{it.b.locked ? <Pin size={12} /> : <PinOff size={12} />}</button>}
        </div>
      ))}
    </div>
  );

  // ---------- ตรวจผัง: กล่องทับกัน · ชิดขอบเกินระยะพิมพ์ · ทับบรรทัดเลขหน้า · ตารางเตี้ย ----------
  const issues = useMemo(() => {
    const out: { text: string; keys: string[] }[] = [];
    const textish = items.filter((i) => TEXT_BLOCKS.includes(i.b.kind) || i.b.kind === "logo");
    for (let i = 0; i < textish.length; i++) for (let j = i + 1; j < textish.length; j++) {
      const a = textish[i].b, b = textish[j].b;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 6 && oy > 6) out.push({ text: `${nameOf(a)} ทับ ${nameOf(b)}`, keys: [textish[i].key, textish[j].key] });
    }
    for (const it of textish) {
      const b = it.b;
      if (b.x < 14 || b.y < 10 || b.x + b.w > P.w - 14 || b.y + b.h > P.h - 14) out.push({ text: `${nameOf(b)} ชิดขอบกระดาษเกินไป (เครื่องพิมพ์อาจตัดขอบ)`, keys: [it.key] });
      else if (theme.showPageNumber && b.y + b.h > P.h - 30) out.push({ text: `${nameOf(b)} ทับบรรทัดท้ายกระดาษ (เลขหน้า)`, keys: [it.key] });
    }
    const tbl = items.find((i) => i.b.kind === "items");
    if (tbl && tbl.b.h < 120) out.push({ text: "ตารางรายการเตี้ย — รายการจะต่อหน้าถัดไปเร็ว ลองขยายความสูง", keys: [tbl.key] });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- คำนวณจากกล่องปัจจุบัน
  }, [layout, letterhead, bodyOn, theme.showPageNumber]);
  const legal = letterOnly ? [] : [
    { label: "ผู้ขาย (ชื่อ ที่อยู่ เลขผู้เสียภาษี)", ok: requiredSatisfied("seller", items.map((i) => i.b)) }, { label: "ชื่อเอกสาร", ok: requiredSatisfied("title", items.map((i) => i.b)) },
    { label: "เลขที่", ok: legalFieldVisible(items.map((i) => i.b), "number") }, { label: "วันที่", ok: legalFieldVisible(items.map((i) => i.b), "date") },
    { label: "ลูกค้า/คู่ค้า", ok: requiredSatisfied("party", items.map((i) => i.b)) }, { label: "ตารางรายการ", ok: !!firstOf("items") },
    ...(docHasAmounts(docType) ? [{ label: "ยอดรวมและภาษี", ok: !!firstOf("totals") }] : []),
  ];
  const checkPanel = (
    <div className="space-y-2.5">
      {legal.length > 0 && (
        <Group title="ข้อมูลที่กฎหมายกำหนด">
          {legal.map((l) => <p key={l.label} className={cn("text-[12px] flex items-center gap-1.5", l.ok ? "text-white/70" : "text-danger")}>{l.ok ? <CheckCircle2 size={13} className="text-nexus-teal" /> : <AlertTriangle size={13} />} {l.label}</p>)}
        </Group>
      )}
      <Group title={issues.length ? `พบ ${issues.length} จุดที่ควรแก้` : "ผังเรียบร้อย"}>
        {!issues.length && <p className="text-[12px] text-white/55">ไม่มีกล่องทับกันหรือล้นขอบ พร้อมบันทึก</p>}
        {issues.map((x, i) => (
          <button key={i} type="button" onClick={() => { setSel(x.keys); }} className="w-full text-left text-[12px] text-warning hover:text-white flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> <span>{x.text}</span>
          </button>
        ))}
      </Group>
      <p className="text-[11px] text-white/40">คลิกรายการเพื่อเลือกหัวข้อนั้น · เสร็จแล้วกด &quot;บันทึก&quot; (Ctrl+S) ด้านบน</p>
    </div>
  );

  /** จัดหน้าอัตโนมัติ → คลิกบนกระดาษ: เปิดจัดตำแหน่งเอง (ผังเดิมหรือผังมาตรฐาน) แล้วเลือกหัวข้อที่คลิก */
  const convertAt = (e: React.PointerEvent) => {
    const r = paperRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
    const lay: FreeLayout = layout.blocks.length ? { ...layout, enabled: true } : { ...defaultFreeLayout(docType, font, docMeta), enabled: true };
    commitLayout(lay);
    const hit = lay.blocks.filter((b) => !headKinds.has(b.kind) && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    setSel(hit ? [`d:${hit.id}`] : []);
  };

  const gridPx = grid * S;
  const showGrid = gridMode === "always" || (gridMode === "drag" && moving);
  const can = canEdit && selected.length > 0;


  // ---------- พิมพ์ข้อความบนกระดาษ ----------
  const editItem = editing ? byKey.get(editing) : null;
  const inlineEditor = editItem && (
    <textarea autoFocus onFocus={(e) => { if (e.target.value === "ข้อความ") e.target.select(); }} value={editItem.b.text || ""} onChange={(e) => update(editItem, { text: e.target.value })}
      onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-50 resize-none rounded border border-[#0d9488] bg-white/95 text-slate-900 p-0.5 outline-none shadow-lg"
      style={{ left: editItem.b.x * S, top: editItem.b.y * S, width: Math.max(140, editItem.b.w * S), minHeight: Math.max(40, editItem.b.h * S), fontSize: (editItem.b.fontSize || 10) * FONT_SCALE[font] * S, lineHeight: editItem.b.lineHeight ?? 1.35, textAlign: editItem.b.align, fontWeight: editItem.b.bold ? 700 : 400, color: resolveColor(editItem.b.color, theme) || "#111" }} />
  );

  const missing = addable.filter((k) => SINGLE.includes(k));
  const dropAt = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData("text/nexus-kind");
    if (!kind || !canEdit) return;
    e.preventDefault();
    const r = paperRef.current!.getBoundingClientRect();
    addAt(kind === "info" ? "info:empty" : kind, { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S });
  };
  // ---------- ริบบอน ----------
  const SHAPE_KINDS: BlockKind[] = ["rect", "shape", "line", "image", "logo", "stamp", "sign", "grid"];
  const textSel = selected.filter((i) => TEXT_BLOCKS.includes(i.b.kind));
  const shapeSel = selected.filter((i) => SHAPE_KINDS.includes(i.b.kind));
  // แท็บกรอบ · พื้น ใช้กับทุกกล่องที่เลือก (ข้อความก็มีกรอบ/พื้นของตัวเอง แยกจากรูปแบบตัวอักษร)
  const boxSel = selected;
  const t0 = textSel[0]?.b, s0 = boxSel[0]?.b;
  const patchSel = (list: Item[], patch: Partial<FreeBlock> | ((b: FreeBlock) => Partial<FreeBlock>)) => { if (canEdit && list.length) applyMany(new Map(list.map((i) => [i.key, { ...i.b, ...(typeof patch === "function" ? patch(i.b) : patch) }]))); };
  const ctxTab = textSel.length && !shapeSel.length ? "ftext" : shapeSel.length ? "fshape" : null;
  // เลือกข้อความ → แท็บรูปแบบข้อความ · เลือกรูปทรง/รูปภาพ → แท็บรูปแบบรูปทรง (เหมือนแท็บตามบริบทของ Office)
  useEffect(() => {
    // แท็บรูปแบบที่เปิดอยู่ยังใช้ได้กับกล่องที่เลือก = คงไว้ (จัดรูปแบบกลุ่มที่ลากคลุมต่อได้)
    setRtab((t) => {
      if ((t === "ftext" && textSel.length) || (t === "fshape" && boxSel.length)) return t;
      if (multi) return "arrange";
      return ctxTab || (t === "ftext" || t === "fshape" ? "insert" : t);
    });
  }, [ctxTab, sel.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  /** ลำดับชั้น: บนสุด/ล่างสุด */
  const zEnd = (it: Item, to: "front" | "back") => {
    const list = it.zone === "head" ? letterhead!.blocks : layout.blocks;
    const rest = list.filter((x) => x.id !== it.b.id), next = to === "front" ? [...rest, it.b] : [it.b, ...rest];
    if (it.zone === "head") commitHead({ ...letterhead!, blocks: next }); else commitLayout({ ...layout, blocks: next });
  };
  /** กึ่งกลางหน้ากระดาษ (ทั้งกลุ่มที่เลือกเลื่อนไปพร้อมกัน) */
  const pageCenter = (axis: "x" | "y" | "both") => {
    if (!selected.length) return;
    const L = Math.min(...selected.map((i) => i.b.x)), R = Math.max(...selected.map((i) => i.b.x + i.b.w)), T = Math.min(...selected.map((i) => i.b.y)), B = Math.max(...selected.map((i) => i.b.y + i.b.h));
    const dx = axis === "y" ? 0 : (P.w - (R - L)) / 2 - L, dy = axis === "x" ? 0 : (P.h - (B - T)) / 2 - T;
    applyMany(new Map(selected.filter((i) => !i.b.locked).map((i) => [i.key, { ...i.b, x: i.b.x + dx, y: i.b.y + dy }])));
  };
  const SIZES = [7, 8, 9, 9.5, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40];
  const textSize = t0 ? t0.fontSize ?? theme.fontSize : theme.fontSize;
  const colorChips = (value: string | undefined, onPick: (v: string | undefined) => void, none?: string) => (
    <div className="flex items-center gap-1">
      <label title="เลือกสีเอง" className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/10 cursor-pointer">
        <span className="w-5 h-5 rounded border border-white/30" style={{ background: resolveColor(value, theme) || "transparent" }} />
        <input type="color" className="sr-only" value={resolveColor(value, theme) || "#000000"} onChange={(e) => onPick(e.target.value)} />
      </label>
      {Object.entries(COLOR_TOKENS).map(([tok, name]) => (
        <button key={tok} type="button" title={`${name}ของธีม`} onClick={() => onPick(tok)} className={cn("w-5 h-5 rounded-full border", value === tok ? "border-white" : "border-white/20")} style={{ background: resolveColor(tok, theme) }} />
      ))}
      {none && <button type="button" onClick={() => onPick(undefined)} className="text-[10.5px] text-white/50 hover:text-white px-1">{none}</button>}
    </div>
  );
  const SHAPE_PRESETS: { label: string; style: Partial<FreeBlock> }[] = [
    { label: "เส้นสีหลัก ไม่มีพื้น", style: { border: "@primary", bg: undefined, dash: undefined } },
    { label: "พื้นสีหลัก", style: { bg: "@primary", border: undefined } },
    { label: "พื้นสีรอง", style: { bg: "@accent", border: undefined } },
    { label: "พื้นอ่อน เส้นสีหลัก", style: { bg: "@soft", border: "@primary" } },
    { label: "พื้นอ่อน ไม่มีเส้น", style: { bg: "@soft", border: undefined } },
    { label: "เส้นประสีหลัก", style: { border: "@primary", bg: undefined, dash: "dashed" } },
  ];
  const tabs: { id: string; label: string; ctx?: boolean }[] = [
    { id: "home", label: "หน้าแรก" }, { id: "insert", label: "แทรก" }, { id: "layout", label: "เค้าโครง" }, { id: "arrange", label: "จัดเรียง" },
    ...(textSel.length ? [{ id: "ftext", label: "รูปแบบข้อความ", ctx: true }] : []),
    ...(boxSel.length ? [{ id: "fshape", label: "กรอบ · พื้น", ctx: true }] : []),
  ];
  const ribbonBody = (() => {
    switch (rtab) {
      case "home": return (
        <>
          {bodyOn && canEdit && (
            <RGroup label="เริ่มใหม่">
              <RMenu icon={<RotateCcw size={18} />} label="กระดาษเปล่า / แม่แบบ" width={260}>
                {(close) => (
                  <>
                    <button type="button" onClick={() => { close(); commitLayout(blankLayout(docType, theme)); setSel([]); }} className={menuItem}>
                      <p className="font-bold text-white">หน้ากระดาษเปล่า</p>
                      <p className="text-[11px] text-white/50">เหลือเฉพาะข้อมูลที่กฎหมายกำหนด ไม่มีกรอบ/สี — ออกแบบใหม่ทั้งหมด</p>
                    </button>
                    <p className="px-3 pt-2 pb-1 text-[11px] text-white/40">ปรับแก้จากแม่แบบ</p>
                    {ARCHETYPES.map((a) => <button key={a.id} type="button" onClick={() => { close(); commitLayout(templateLayout(a.id, docType, theme)); setSel([]); }} className={menuItem}>{a.name}</button>)}
                    <p className="px-3 py-1.5 text-[11px] text-white/40">ไม่ถูกใจกด ย้อนกลับ (Ctrl+Z)</p>
                  </>
                )}
              </RMenu>
              {aiLayout && (
                <>
                  <RBtn icon={aiBusy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />} label={aiBusy ? "AI กำลังอ่าน…" : "AI จากตัวอย่าง"} disabled={aiBusy}
                    title="แนบรูปหรือ PDF ตัวอย่างเอกสาร — AI แปลงเป็นต้นแบบ (ข้อความ ช่องข้อมูล กรอบ เส้น ตาราง) ที่แก้ได้ทุกชิ้น · ไม่ถูกใจกด ย้อนกลับ"
                    onClick={() => aiFileRef.current?.click()} />
                  <input ref={aiFileRef} type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) runAiSample(file); }} />
                </>
              )}
              {aiError && <p className="max-w-[180px] text-[11px] text-danger leading-snug">{aiError}</p>}
            </RGroup>
          )}
          <RGroup label="กล่องที่เลือก">
            <RBtn icon={<BoxSelect size={18} />} label="เลือกทั้งหมด" title="เลือกทุกกล่อง (Ctrl+A)" onClick={() => setSel(items.map((i) => i.key))} />
            <RBtn icon={<CopyPlus size={18} />} label="ทำสำเนา" title="ทำสำเนา (Ctrl+D)" disabled={!canEdit || !selected.some((i) => !SINGLE.includes(i.b.kind))} onClick={duplicate} />
            <RBtn icon={allLocked && selected.length ? <PinOff size={18} /> : <Pin size={18} />} label={allLocked && selected.length ? "ปลดล็อก" : "ล็อก"} disabled={!can} onClick={toggleLock} />
            <RBtn icon={<Trash2 size={18} />} label="ลบ" title="ลบ (Delete)" disabled={!can || !selected.some((i) => !isLocked(i))} onClick={() => remove(selected)} />
          </RGroup>
          <RGroup label="ชุดเดียวกัน">
            <RBtn icon={<GroupIcon size={18} />} label="จัดกลุ่ม" title="รวมข้อความ เส้น กรอบ ที่เลือกเป็นชุดเดียว ลากไปพร้อมกัน (Ctrl+G)" disabled={selected.length < 2 || !canEdit} onClick={groupSelected} />
            <RBtn icon={<Ungroup size={18} />} label="แยกกลุ่ม" title="แยกกลุ่ม (Ctrl+Shift+G)" disabled={!anyGrouped || !canEdit} onClick={ungroupSelected} />
          </RGroup>
          <RGroup label="มุมมอง">
            <RSelect width={136} title="ขนาดกระดาษบนจอ" value={String(zoom)} onChange={(v) => setZoom(v === "fit" ? "fit" : Number(v))}>
              <option value="fit">พอดีความกว้าง</option><option value="1">ซูม 100%</option><option value="1.333">ขนาดจริง</option><option value="1.5">ซูม 150%</option><option value="2">ซูม 200%</option>
            </RSelect>
            <RBtn icon={<Eye size={18} />} label="ดู PDF" on={showPdf} onClick={() => setShowPdf((v) => !v)} />
          </RGroup>
        </>
      );
      case "insert": return (
        <>
          <RGroup label="วาดเอง: ลากบนกระดาษ (Esc ยกเลิก)">
            {([["select", "เลือก", MousePointer2], ["text", "กล่องข้อความ", Type], ["rect", "กรอบ", Square], ["line", "เส้น", Minus], ["grid", "ตาราง", Grid3x3]] as const).map(([t, label, I]) => (
              <RBtn key={t} icon={<I size={18} />} label={label} on={tool === t} disabled={!canEdit && t !== "select"} title={t === "select" ? "เลือก/ย้ายกล่อง" : "วาด" + label + ": ลากบนกระดาษตามขนาดที่ต้องการ"} onClick={() => setTool(t)} />
            ))}
          </RGroup>
          <RGroup label="ข้อความและข้อมูล">
            <RBtn icon={<Type size={18} />} label="ข้อความ" drag="text" disabled={!canEdit} onClick={() => addAt("text", visibleCenter())} />
            {addable.includes("info") && (
              <RMenu icon={<Rows3 size={18} />} label="กล่องข้อมูล" disabled={!canEdit}>
                {(close) => INFO_PRESETS.filter((x) => x.id !== "extra" || docFields.length).map((x) => (
                  <button key={x.id} type="button" onClick={() => { close(); addInfo(x.id); }} className={menuItem}>{x.label}</button>
                ))}
              </RMenu>
            )}
            {addable.includes("field") && <RBtn icon={<TextCursorInput size={18} />} label="ข้อมูลเดี่ยว" drag="field" disabled={!canEdit} onClick={() => addAt("field", visibleCenter())} />}
          </RGroup>
          <RGroup label="รูปทรง">
            <RBtn icon={<Square size={18} />} label="สี่เหลี่ยม" drag="rect" disabled={!canEdit} onClick={() => addAt("rect", visibleCenter())} />
            <RBtn icon={<Circle size={18} />} label="วงกลม" drag="shape:ellipse" disabled={!canEdit} onClick={() => addAt("shape:ellipse", visibleCenter())} />
            <RBtn icon={<Triangle size={18} />} label="สามเหลี่ยม" drag="shape:triangle" disabled={!canEdit} onClick={() => addAt("shape:triangle", visibleCenter())} />
            <RBtn icon={<Minus size={18} />} label="เส้น" drag="line" disabled={!canEdit} onClick={() => addAt("line", visibleCenter())} />
          </RGroup>
          <RGroup label="ภาพ">
            <RBtn icon={<ImageIcon size={18} />} label="รูปภาพ" drag="image" disabled={!canEdit} onClick={() => addAt("image", visibleCenter())} />
            {addable.includes("logo") && <RBtn icon={<ImagePlus size={18} />} label="โลโก้" drag="logo" disabled={!canEdit} onClick={() => addAt("logo", visibleCenter())} />}
            {addable.includes("sign") && <RBtn icon={<PenLine size={18} />} label="ลายเซ็น" drag="sign" disabled={!canEdit} onClick={() => addAt("sign", visibleCenter())} />}
            {addable.includes("stamp") && <RBtn icon={<StampIcon size={18} />} label="ตราประทับ" drag="stamp" disabled={!canEdit} onClick={() => addAt("stamp", visibleCenter())} />}
          </RGroup>
          {bodyOn && (
            <RGroup label="ตารางสำเร็จรูป (ข้อมูลขึ้นเอง)">
              {READY_TABLES.filter((t) => t.kind === "items" || docHasAmounts(docType)).map((t) => {
                const has = firstOf(t.kind);
                return <RBtn key={t.kind} icon={t.icon} label={t.label} drag={has ? undefined : t.kind} disabled={!canEdit}
                  title={has ? `${t.label} มีอยู่แล้ว — คลิกเพื่อเลือก แล้วติ๊กเลือก${t.kind === "items" ? "คอลัมน์ · จัดซ้าย/กลาง/ขวา" : "แถวที่แสดง"} ที่แผงขวา` : `${t.label}: ${t.hint} — คลิกหรือลากไปวาง`}
                  onClick={() => { if (has) setSel([has.key]); else addAt(t.kind, visibleCenter()); setUiPart({ right: true }); }} />;
              })}
            </RGroup>
          )}
          {missing.filter((k) => !READY_TABLES.some((t) => t.kind === k)).length > 0 && (
            <RGroup label="ส่วนของเอกสารที่ยังไม่มี">
              {missing.filter((k) => !READY_TABLES.some((t) => t.kind === k)).map((k) => <RBtn key={k} icon={<PanelBottom size={18} />} label={BLOCK_LABELS[k]} drag={k} disabled={!canEdit} onClick={() => addAt(k, visibleCenter())} />)}
            </RGroup>
          )}
        </>
      );
      case "layout": return (
        <>
          <RGroup label="หน้ากระดาษ">
            <div className="flex flex-col gap-1">
              <RSelect width={170} title="ขนาดกระดาษ" value={layout.paper || "A4"} onChange={(v) => setPage({ paper: v as PaperSize })}>
                {(Object.keys(PAPERS) as PaperSize[]).map((k) => <option key={k} value={k}>{PAPERS[k].label}</option>)}
              </RSelect>
              <div className="flex items-center gap-0.5">
                <RIcon title="แนวตั้ง" on={!layout.landscape} disabled={!canEdit || !bodyOn} onClick={() => setPage({ landscape: false })}><RectangleVertical size={15} /><span className="pl-1">แนวตั้ง</span></RIcon>
                <RIcon title="แนวนอน" on={!!layout.landscape} disabled={!canEdit || !bodyOn} onClick={() => setPage({ landscape: true })}><RectangleHorizontal size={15} /><span className="pl-1">แนวนอน</span></RIcon>
              </div>
            </div>
          </RGroup>
          <RGroup label={`ขอบกระดาษ ${M[0] === M[1] && M[1] === M[2] && M[2] === M[3] ? `${M[0]} pt` : "แยกแต่ละด้าน"}`}>
            {([["ปกติ", 32], ["แคบ", 18], ["กว้าง", 48]] as const).map(([label, v]) => <RIcon key={label} title={`ขอบกระดาษ${label} (${v} pt ทุกด้าน)`} on={M.every((m) => m === v)} disabled={!canEdit || !bodyOn} onClick={() => setPage({ margins: [v, v, v, v] })}>{label}</RIcon>)}
            <RMenu icon={<Scan size={18} />} label="กำหนดเอง" disabled={!canEdit || !bodyOn} width={230}>
              {() => (
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(["บน", "ขวา", "ล่าง", "ซ้าย"] as const).map((label, i) => (
                      <label key={label} className="space-y-1 text-[11.5px] text-white/60">
                        <span>{label} (pt)</span>
                        <RNum width={90} min={0} max={120} value={M[i]} onChange={(e) => { const n = [...M] as Margins; n[i] = Math.max(0, Math.min(120, Number(e.target.value) || 0)); setPage({ margins: n }); }} />
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/45">1 ซม. ≈ 28 pt</p>
                </div>
              )}
            </RMenu>
            <RBtn icon={<Move size={18} />} label={refit ? "ขยับกล่องตาม" : "กล่องอยู่ที่เดิม"} on={refit} title="เปลี่ยนกระดาษ/แนว/ขอบแล้ว ย้ายกล่องตามสัดส่วนของหน้าใหม่ (ปิด = กล่องอยู่ตำแหน่งเดิม)" onClick={() => setRefit((v) => !v)} />
          </RGroup>
          <RGroup label="เส้นช่วยจัดวาง">
            <RBtn icon={<RulerIcon size={18} />} label="ไม้บรรทัด" on={ui.ruler} onClick={() => setUiPart({ ruler: !ui.ruler })} />
            <RBtn icon={<Magnet size={18} />} label={snapOn ? "ดูดติด" : "วางอิสระ"} on={snapOn} title="ดูดติดกริดและแนวกล่องอื่น (Alt ค้าง = วางอิสระชั่วคราว)" onClick={() => setSnapOn((v) => !v)} />
            <div className="flex flex-col gap-1">
              <RSelect width={132} title="เส้นกริด" value={gridMode} onChange={(v) => setGridMode(v as any)}>
                <option value="drag">กริด: ขณะลาก</option><option value="always">กริด: ตลอด</option><option value="off">กริด: ปิด</option>
              </RSelect>
              <RSelect width={132} title="ระยะกริด" value={String(grid)} onChange={(v) => setGrid(Number(v))}>
                {[2, 5, 10, 20].map((g) => <option key={g} value={String(g)}>ระยะกริด {g} pt</option>)}
              </RSelect>
            </div>
          </RGroup>
          {letterhead && (
            <RGroup label="ความสูงหัวกระดาษ (pt)">
              <RNum width={64} min={40} max={320} value={letterhead.height} disabled={!canEdit} onChange={(e) => commitHead({ ...letterhead, height: Math.max(40, Math.min(320, Number(e.target.value) || 40)) })} />
            </RGroup>
          )}
        </>
      );
      case "arrange": return (
        <>
          <RGroup label="กึ่งกลางหน้า">
            <RIcon title="กึ่งกลางหน้าแนวนอน" disabled={!can} onClick={() => pageCenter("x")}><AlignCenterVertical size={16} /></RIcon>
            <RIcon title="กึ่งกลางหน้าแนวตั้ง" disabled={!can} onClick={() => pageCenter("y")}><AlignCenterHorizontal size={16} /></RIcon>
            <RIcon title="กึ่งกลางหน้า" disabled={!can} onClick={() => pageCenter("both")}><BoxSelect size={16} /></RIcon>
          </RGroup>
          <RGroup label={multi ? "จัดแนวกล่องที่เลือก" : "จัดชิดขอบกระดาษ"}>
            <RIcon title="ชิดซ้าย" disabled={!can} onClick={() => align("left")}><AlignStartVertical size={16} /></RIcon>
            <RIcon title="กึ่งกลาง" disabled={!can} onClick={() => align("hcenter")}><AlignCenterVertical size={16} /></RIcon>
            <RIcon title="ชิดขวา" disabled={!can} onClick={() => align("right")}><AlignEndVertical size={16} /></RIcon>
            <RIcon title="ชิดบน" disabled={!can} onClick={() => align("top")}><AlignStartHorizontal size={16} /></RIcon>
            <RIcon title="กึ่งกลางแนวตั้ง" disabled={!can} onClick={() => align("vcenter")}><AlignCenterHorizontal size={16} /></RIcon>
            <RIcon title="ชิดล่าง" disabled={!can} onClick={() => align("bottom")}><AlignEndHorizontal size={16} /></RIcon>
          </RGroup>
          <RGroup label="ห่างจากกรอบหลัก (คลิกก่อน)">
            {([["top", "ไว้ด้านบนของกรอบหลัก", ArrowUp], ["bottom", "ไว้ด้านล่างของกรอบหลัก", ArrowDown], ["left", "ไว้ด้านซ้ายของกรอบหลัก", ArrowLeft], ["right", "ไว้ด้านขวาของกรอบหลัก", ArrowRight]] as const).map(([to, label, I]) => (
              <RIcon key={to} title={`วางกรอบที่คลิกทีหลัง${label} ห่าง ${gap} pt`} on={side === to} disabled={selected.length < 2 || !anchorKeys.length || !canEdit} onClick={() => placeBy(to)}><I size={16} /></RIcon>
            ))}
            <span className="w-px h-5 bg-white/10 mx-0.5" />
            <RIcon title="ขยับเข้าหากรอบหลัก 1 pt" disabled={!canEdit} onClick={() => setGapLive(gap - 1)}><Minus size={14} /></RIcon>
            <RNum min={-200} max={300} value={gap} onChange={(e) => setGapLive(Number(e.target.value) || 0)} onKeyDown={(e) => { if (e.key === "Enter") setGapLive(Number((e.target as HTMLInputElement).value) || 0); }} title="ระยะห่าง (pt) · ติดลบ = ซ้อนเข้าไป · ยังไม่เลือกด้าน = ขยับตามด้านที่กรอบอยู่ตอนนี้" />
            <RIcon title="ขยับออกจากกรอบหลัก 1 pt" disabled={!canEdit} onClick={() => setGapLive(gap + 1)}><Plus size={14} /></RIcon>
          </RGroup>
          <RGroup label="กระจาย · เรียงต่อกัน">
            <RIcon title="กระจายแนวนอนเท่ากัน (3 กล่องขึ้นไป)" disabled={selected.length < 3 || !canEdit} onClick={() => distribute("x")}><AlignHorizontalDistributeCenter size={16} /></RIcon>
            <RIcon title="กระจายแนวตั้งเท่ากัน (3 กล่องขึ้นไป)" disabled={selected.length < 3 || !canEdit} onClick={() => distribute("y")}><AlignVerticalDistributeCenter size={16} /></RIcon>
            <RIcon title={`เรียงลงมา ห่าง ${gap} pt`} disabled={selected.length < 2 || !canEdit} onClick={() => stack("y")}><StretchVertical size={16} /></RIcon>
            <RIcon title={`เรียงไปทางขวา ห่าง ${gap} pt`} disabled={selected.length < 2 || !canEdit} onClick={() => stack("x")}><StretchHorizontal size={16} /></RIcon>
          </RGroup>
          <RGroup label="ลำดับชั้น">
            <RIcon title="บนสุด" disabled={!primary || multi || !canEdit} onClick={() => primary && zEnd(primary, "front")}><ArrowUpToLine size={16} /></RIcon>
            <RIcon title="ขึ้นหนึ่งชั้น" disabled={!primary || multi || !canEdit} onClick={() => primary && reorder(primary, 1)}><BringToFront size={16} /></RIcon>
            <RIcon title="ลงหนึ่งชั้น" disabled={!primary || multi || !canEdit} onClick={() => primary && reorder(primary, -1)}><SendToBack size={16} /></RIcon>
            <RIcon title="ล่างสุด" disabled={!primary || multi || !canEdit} onClick={() => primary && zEnd(primary, "back")}><ArrowDownToLine size={16} /></RIcon>
          </RGroup>
        </>
      );
      case "ftext": return t0 ? (
        <>
          <RGroup label="แบบอักษร">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <RSelect width={160} title="ฟอนต์" value={t0.font || ""} onChange={(v) => patchSel(textSel, { font: (v || undefined) as FontFamily | undefined })}>
                  <option value="">ตามธีม ({FONT_LABELS[theme.font].split(" (")[0]})</option>
                  {(Object.keys(FONT_LABELS) as FontFamily[]).map((f) => <option key={f} value={f}>{FONT_LABELS[f].split(" (")[0]}</option>)}
                </RSelect>
                <RSelect width={72} title="ขนาดตัวอักษร (pt)" value={String(textSize)} onChange={(v) => patchSel(textSel, { fontSize: Number(v) })}>
                  {[...new Set([...SIZES, textSize])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>{v}</option>)}
                </RSelect>
                <RIcon title="ตัวใหญ่ขึ้น" onClick={() => patchSel(textSel, (b) => ({ fontSize: Math.min(40, (b.fontSize ?? theme.fontSize) + 1) }))}><span className="font-bold">A+</span></RIcon>
                <RIcon title="ตัวเล็กลง" onClick={() => patchSel(textSel, (b) => ({ fontSize: Math.max(6, (b.fontSize ?? theme.fontSize) - 1) }))}><span className="font-bold">A−</span></RIcon>
              </div>
              <div className="flex items-center gap-0.5">
                <RIcon title="ตัวหนา" on={!!t0.bold} onClick={() => patchSel(textSel, { bold: !t0.bold || undefined })}><Bold size={15} /></RIcon>
                <RIcon title="ตัวเอียง (TH Sarabun)" on={!!t0.italic} onClick={() => patchSel(textSel, { italic: !t0.italic || undefined })}><Italic size={15} /></RIcon>
                <RIcon title="ขีดเส้นใต้" on={!!t0.underline} onClick={() => patchSel(textSel, { underline: !t0.underline || undefined })}><Underline size={15} /></RIcon>
                <RIcon title="ขีดฆ่า" on={!!t0.strike} onClick={() => patchSel(textSel, { strike: !t0.strike || undefined })}><Strikethrough size={15} /></RIcon>
                <span className="w-px h-5 bg-white/10 mx-1" />
                <span className="text-[11px] text-white/50">สี</span>
                {colorChips(t0.color, (v) => patchSel(textSel, { color: v }), "ตามแม่แบบ")}
              </div>
            </div>
          </RGroup>
          <RGroup label="ย่อหน้า">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-0.5">
                {(["left", "center", "right", "justify"] as const).map((a) => { const I = a === "justify" ? AlignJustify : ALIGN_ICON[a]; return <RIcon key={a} title={a === "left" ? "ชิดซ้าย" : a === "center" ? "กึ่งกลาง" : a === "right" ? "ชิดขวา" : "เต็มบรรทัด"} on={t0.align === a} onClick={() => patchSel(textSel, { align: a })}><I size={15} /></RIcon>; })}
                <span className="w-px h-5 bg-white/10 mx-1" />
                {([[undefined, "ชิดบนในกล่อง", AlignVerticalJustifyStart], ["middle", "กึ่งกลางแนวตั้งในกล่อง", AlignVerticalJustifyCenter], ["bottom", "ชิดล่างในกล่อง", AlignVerticalJustifyEnd]] as const).map(([v, label, I]) => (
                  <RIcon key={label} title={label} on={t0.valign === v} onClick={() => patchSel(textSel, { valign: v })}><I size={15} /></RIcon>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <RSelect width={112} title="ระยะบรรทัด" value={String(t0.lineHeight ?? 1.35)} onChange={(v) => patchSel(textSel, { lineHeight: Number(v) })}>
                  {[...new Set([1, 1.15, 1.35, 1.5, 1.75, 2, t0.lineHeight ?? 1.35])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>บรรทัด {v}</option>)}
                </RSelect>
                <RSelect width={120} title="ระยะห่างตัวอักษร" value={String(t0.letterSpacing ?? 0)} onChange={(v) => patchSel(textSel, { letterSpacing: Number(v) || undefined })}>
                  {[...new Set([-0.5, 0, 0.5, 1, 2, 3, t0.letterSpacing ?? 0])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>ตัวอักษร {v > 0 ? "+" : ""}{v}</option>)}
                </RSelect>
              </div>
            </div>
          </RGroup>
        </>
      ) : null;
      case "fshape": return s0 ? (
        <>
          {s0.kind !== "line" && !["image", "logo", "stamp", "sign", "items"].includes(s0.kind) && (
            <RGroup label="สไตล์สำเร็จรูป">
              {SHAPE_PRESETS.map((p) => {
                const bg = resolveColor(p.style.bg, theme), bd = resolveColor(p.style.border, theme);
                return <button key={p.label} type="button" title={p.label} onClick={() => patchSel(boxSel, (b) => { const n: Partial<FreeBlock> = { ...p.style }; if (!("dash" in p.style)) n.dash = b.dash; return n; })}
                  className="w-8 h-8 rounded-md hover:ring-2 ring-white/40" style={{ background: bg || "transparent", border: bd ? `2px ${p.style.dash || "solid"} ${bd}` : "1px solid rgba(255,255,255,0.15)" }} />;
              })}
            </RGroup>
          )}
          {(
            <RGroup label="พื้น · เส้นกรอบ">
              <div className="flex flex-col gap-1">
                {s0.kind !== "line" && <div className="flex items-center gap-1"><span className="text-[11px] text-white/50 w-8">พื้น</span>{colorChips(s0.bg, (v) => patchSel(boxSel, { bg: v }), "ไม่มี")}</div>}
                <div className="flex items-center gap-1"><span className="text-[11px] text-white/50 w-8">เส้น</span>{colorChips(s0.kind === "line" ? s0.color : s0.border, (v) => patchSel(boxSel, (b) => (b.kind === "line" ? { color: v } : { border: v })), s0.kind === "line" ? undefined : "ไม่มี")}</div>
              </div>
              <div className="flex flex-col gap-1">
                <RSelect width={108} title="ความหนาเส้น" value={String(s0.kind === "line" ? Math.min(s0.w, s0.h) : s0.borderWidth ?? 1)} onChange={(x) => { const v = Number(x); patchSel(boxSel, (b) => (b.kind === "line" ? (b.h > b.w ? { w: v } : { h: v }) : { borderWidth: v })); }}>
                  {[...new Set([0.5, 0.75, 1, 1.5, 2, 3, 4, 6, s0.kind === "line" ? Math.min(s0.w, s0.h) : s0.borderWidth ?? 1])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>เส้น {v} pt</option>)}
                </RSelect>
                <RSelect width={108} title="รูปแบบเส้น" value={s0.dash || "solid"} onChange={(v) => patchSel(boxSel, { dash: v === "solid" ? undefined : (v as any) })}>
                  <option value="solid">เส้นทึบ</option><option value="dashed">เส้นประ</option><option value="dotted">เส้นจุด</option>
                </RSelect>
              </div>
            </RGroup>
          )}
          {(s0.kind === "rect" || s0.kind === "shape") && (
            <RGroup label="รูปทรง · มุม">
              <RIcon title="สี่เหลี่ยม" on={s0.kind === "rect"} onClick={() => patchSel(boxSel, () => ({ kind: "rect", shape: undefined }))}><Square size={15} /></RIcon>
              <RIcon title="วงกลม/วงรี" on={s0.kind === "shape" && s0.shape !== "triangle"} onClick={() => patchSel(boxSel, () => ({ kind: "shape", shape: "ellipse", radii: undefined }))}><Circle size={15} /></RIcon>
              <RIcon title="สามเหลี่ยม" on={s0.shape === "triangle"} onClick={() => patchSel(boxSel, () => ({ kind: "shape", shape: "triangle", radii: undefined }))}><Triangle size={15} /></RIcon>
              {s0.kind === "rect" && (
                <RSelect width={112} key="r" title="มุมโค้ง (ปรับแยกมุมที่แผงขวา)" value={String(s0.radii ? "x" : s0.radius ?? 0)} onChange={(v) => { if (v !== "x") patchSel(boxSel, { radius: Number(v), radii: undefined }); }}>
                  {s0.radii && <option value="x">แยกแต่ละมุม</option>}
                  {[...new Set([0, 2, 4, 8, 12, 20, 30, s0.radius ?? 0])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>{v ? `โค้ง ${v}` : "เหลี่ยม"}</option>)}
                </RSelect>
              )}
            </RGroup>
          )}
          {!["line", "shape", "rect"].includes(s0.kind) && (
            <RGroup label="มุม · ขอบใน">
              <RSelect width={112} title="มุมโค้ง (ปรับแยกมุมที่แผงขวา)" value={String(s0.radii ? "x" : s0.radius ?? "")} onChange={(v) => { if (v !== "x") patchSel(boxSel, { radius: v === "" ? undefined : Number(v), radii: undefined }); }}>
                {s0.radii && <option value="x">แยกแต่ละมุม</option>}
                <option value="">มุมตามแม่แบบ</option>
                {[...new Set([0, 2, 4, 8, 12, 20, 30, ...(s0.radius === undefined ? [] : [s0.radius])])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>{v ? `โค้ง ${v}` : "เหลี่ยม"}</option>)}
              </RSelect>
              {TEXT_BLOCKS.includes(s0.kind) && s0.kind !== "items" && (
                <RSelect width={120} title="ระยะห่างจากกรอบถึงข้อความ" value={String(s0.pad ?? "")} onChange={(v) => patchSel(boxSel, { pad: v === "" ? undefined : Number(v) })}>
                  <option value="">ขอบใน อัตโนมัติ</option>{[...new Set([0, 2, 4, 6, 8, 12, 16, ...(s0.pad === undefined ? [] : [s0.pad])])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>ขอบใน {v}</option>)}
                </RSelect>
              )}
            </RGroup>
          )}
          <RGroup label={`ความทึบ ${Math.round((s0.opacity ?? 1) * 100)}%`}>
            <input type="range" min={10} max={100} step={5} value={Math.round((s0.opacity ?? 1) * 100)} onChange={(e) => { const v = Number(e.target.value) / 100; patchSel(boxSel, { opacity: v >= 1 ? undefined : v }); }} className="w-[110px] accent-[#0d9488]" />
          </RGroup>
        </>
      ) : null;
      default: return null;
    }
  })();
  const ribbon = (
    <div ref={ribbonRef} className={cn(ui.pin && "sticky z-40")} style={ui.pin ? { top: pinTop } : undefined}>
    <GlassCard className={cn("rounded-2xl hover:border-white/15", ui.pin && "shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)] bg-surface-2")}>
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-white/10">
        <RIcon title="ย้อนกลับ (Ctrl+Z)" disabled={!history.canUndo || !canEdit} onClick={undo}><Undo2 size={14} /></RIcon>
        <RIcon title="ทำซ้ำ (Ctrl+Y)" disabled={!history.canRedo || !canEdit} onClick={redo}><Redo2 size={14} /></RIcon>
        <span className="w-px h-5 bg-white/10 mx-0.5" />
        <PillTabs className="flex-1 min-w-0" tabs={tabs.map((t) => ({ id: t.id, label: t.label, icon: t.ctx ? <Paintbrush /> : undefined }))} activeTab={ui.ribbon ? rtab : ""} onTabChange={(id) => { setRtab(id); if (!ui.ribbon) setUiPart({ ribbon: true }); }} />
        <span className="ml-auto text-[11.5px] text-white/40 pr-1 hidden xl:inline">{selected.length ? `เลือก ${selected.length} กล่อง · Ctrl+คลิก เลือกเพิ่ม/ลด` : "คลิกกล่องเพื่อแก้ · ลากคลุมเพื่อเลือกหลายกล่อง"}</span>
        <RIcon title={ui.pin ? "เลิกปักหมุดแถบเครื่องมือ (เลื่อนไปกับหน้า)" : "ปักหมุดแถบเครื่องมือ (ติดบนจอ ไม่เลื่อนตามหน้า)"} on={ui.pin} onClick={() => setUiPart({ pin: !ui.pin })}>{ui.pin ? <PinOff size={15} /> : <Pin size={15} />}</RIcon>
        <RIcon title={ui.ribbon ? "ย่อแถบเครื่องมือ (เหลือชื่อแท็บ)" : "ขยายแถบเครื่องมือ"} onClick={() => setUiPart({ ribbon: !ui.ribbon })}>{ui.ribbon ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</RIcon>
      </div>
      {ui.ribbon && <div className="flex items-stretch overflow-x-auto px-1 py-1.5">{ribbonBody || <p className="text-[12px] text-white/45 px-3 py-4">เลือกกล่องบนกระดาษก่อน</p>}</div>}
    </GlassCard>
    </div>
  );
  // ปักหมุดแล้ว: กระดาษและแผงขวาเริ่มใต้แถบเครื่องมือ
  const below = ui.pin ? pinTop + ribbonH + 12 : 64;

  // ---------- แผงขวา: ไม่ได้เลือก = ทั้งหน้า · เลือก = ตั้งค่ากล่องนั้น ----------
  const problems = legal.filter((l) => !l.ok).length + issues.length;
  const pagePanel = (
    <div className="space-y-3">
      {!letterOnly && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-bold text-white">ข้อมูลที่แสดงในเอกสารนี้</p>
          <DataChecklist groups={groups} onToggle={toggle} canEdit={canEdit} />
        </div>
      )}
      <details className="rounded-xl border border-white/10 px-2.5 py-2">
        <summary className="cursor-pointer text-[12.5px] font-bold text-white/70">กล่องทั้งหมดบนกระดาษ ({items.length})</summary>
        <div className="pt-2">{layersPanel}</div>
      </details>
    </div>
  );

  return (
    <div className="space-y-3">
      {ribbon}

      <div className="flex flex-col lg:flex-row gap-3 items-start">
        {/* กระดาษ A4: ภาพหน้าจริง + กล่องที่ลากได้ */}
        <div ref={wrapRef} className="flex-1 min-w-0 w-full overflow-auto rounded-lg pt-5" style={{ maxHeight: `calc(100vh - ${below + 32}px)` }}>
          <div className="relative" style={{ paddingLeft: ui.ruler ? 18 : 0, paddingTop: ui.ruler ? 18 : 0, width: P.w * S + (ui.ruler ? 18 : 0) }}>
          {ui.ruler && (
            <>
              <div className="absolute left-0 top-0 w-[18px] h-[18px] bg-[#1b1b20] border-r border-b border-white/10" title="ไม้บรรทัด (ซม.)" />
              <Ruler axis="x" P={P} S={S} hl={selected.length ? [Math.min(...selected.map((i) => i.b.x)), Math.max(...selected.map((i) => i.b.x + i.b.w))] : null} />
              <Ruler axis="y" P={P} S={S} hl={selected.length ? [Math.min(...selected.map((i) => i.b.y)), Math.max(...selected.map((i) => i.b.y + i.b.h))] : null} />
            </>
          )}
          <div className="relative" style={{ width: P.w * S, height: P.h * S }}>
          <div ref={paperRef} onDragOver={(e) => { if (e.dataTransfer.types.includes("text/nexus-kind")) e.preventDefault(); }} onDrop={dropAt}
            className={cn("relative bg-white rounded-sm shadow-2xl overflow-hidden select-none", tool !== "select" && "cursor-crosshair")} style={{ width: P.w * S, height: P.h * S }}
            onPointerDown={(e) => {
              if (tool !== "select") startDraw(e);
              else if (!bodyOn && !letterOnly && canEdit) convertAt(e);
              else { const r = paperRef.current!.getBoundingClientRect(); const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S; setMarquee({ x0: x, y0: y, x1: x, y1: y, add: e.ctrlKey || e.metaKey || e.shiftKey }); }
            }}>
            {marquee && <div className="absolute z-40 pointer-events-none border border-[#0d9488] bg-[#0d9488]/10" style={{ left: Math.min(marquee.x0, marquee.x1) * S, top: Math.min(marquee.y0, marquee.y1) * S, width: Math.abs(marquee.x1 - marquee.x0) * S, height: Math.abs(marquee.y1 - marquee.y0) * S }} />}
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพหน้าเอกสารที่วาดในเบราว์เซอร์ (data URL) */}
            {image && <img src={image.url} alt="" className="absolute inset-0 w-full h-full pointer-events-none" />}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-[5]" style={{
                // เส้นกริดบางและจาง (เส้นรองจางมาก ทุก 5 ช่องเข้มขึ้นเล็กน้อย) ไม่บังเนื้อเอกสาร
                backgroundImage: "linear-gradient(to right, rgba(100,116,139,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.035) 1px, transparent 1px), linear-gradient(to right, rgba(100,116,139,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.08) 1px, transparent 1px)",
                backgroundSize: `${gridPx}px ${gridPx}px, ${gridPx}px ${gridPx}px, ${gridPx * 5}px ${gridPx * 5}px, ${gridPx * 5}px ${gridPx * 5}px`,
              }} />
            )}
            {(showGrid || moving) && <div className="absolute pointer-events-none z-[5] border border-dashed border-sky-400/40" style={{ left: M[3] * S, top: M[0] * S, right: M[1] * S, bottom: M[2] * S }} />}
            {/* ตัวอย่างขณะวาด */}
            {draft && (tool === "line" ? (() => {
              const horiz = Math.abs(draft.x1 - draft.x0) >= Math.abs(draft.y1 - draft.y0);
              return <div className="absolute z-30 pointer-events-none bg-[#0d9488]" style={horiz
                ? { left: Math.min(draft.x0, draft.x1) * S, top: draft.y0 * S, width: Math.abs(draft.x1 - draft.x0) * S, height: 1 }
                : { left: draft.x0 * S, top: Math.min(draft.y0, draft.y1) * S, width: 1, height: Math.abs(draft.y1 - draft.y0) * S }} />;
            })() : <div className="absolute z-30 pointer-events-none border border-[#0d9488] bg-[#0d9488]/5" style={{ left: Math.min(draft.x0, draft.x1) * S, top: Math.min(draft.y0, draft.y1) * S, width: Math.abs(draft.x1 - draft.x0) * S, height: Math.abs(draft.y1 - draft.y0) * S }} />)}
            {/* กล่องที่ถูกย้าย: ปิดตำแหน่งเดิมในภาพ */}
            {image && items.map((it) => {
              const o = shot.get(it.key);
              return o && (o.x !== it.b.x || o.y !== it.b.y) && croppable(it.key, o) ? <div key={`m-${it.key}`} className="absolute bg-white pointer-events-none z-[6]" style={{ left: o.x * S, top: o.y * S, width: o.w * S, height: Math.max(1, o.h) * S }} /> : null;
            })}
            {items.map((it) => {
              const b = it.b, on = sel.includes(it.key), o = shot.get(it.key);
              const shifted = !!(image && o && (o.x !== b.x || o.y !== b.y || o.w !== b.w || o.h !== b.h));
              const moved = shifted && croppable(it.key, o!) && o!.w === b.w && o!.h === b.h;
              // ย้ายกล่องที่ทับกล่องอื่น/กรอบ: แสดงเงาตำแหน่งใหม่ ไม่ตัดภาพ (กล่องด้านหลังอยู่ที่เดิม)
              const ghost = shifted && !moved;
              const frame = b.kind === "rect" || b.kind === "grid";
              const fresh = !o;
              return (
                <div key={it.key} onPointerDown={(e) => start(e, it, "move")} onDoubleClick={(e) => { e.stopPropagation(); setSel([it.key]); if (b.kind === "text" && canEdit) setEditing(it.key); }}
                  className={cn("absolute group", canEdit ? "cursor-move" : "cursor-pointer",
                    // กรอบ/เส้น/รูป อยู่ชั้นล่างของการคลิก — คลิกข้อมูลที่อยู่ในกรอบได้ · กรอบเลือกที่ขอบ
                    on ? cn("outline outline-1 -outline-offset-1 outline-[#0d9488] z-20", multi && anchorKeys.includes(it.key) && "outline-amber-400") : cn("outline outline-1 -outline-offset-1 outline-dashed outline-transparent hover:outline-slate-400", ["rect", "shape", "line", "image", "grid"].includes(b.kind) ? "z-[8]" : "z-10"),
                    frame && "pointer-events-none",
                    fresh && !on && "outline-slate-300",
                    ghost && (b.kind === "line" ? "bg-[#0d9488]/70" : frame ? "border border-dashed border-[#0d9488]" : "bg-[#0d9488]/10 border border-dashed border-[#0d9488]/70"))}
                  style={{
                    // เส้นบาง: ขยายพื้นที่คลิกเป็นอย่างน้อย 8px รอบเส้น
                    ...(b.kind === "line"
                      ? (b.h > b.w ? { left: b.x * S - Math.max(0, (8 - b.w * S) / 2), top: b.y * S, width: Math.max(8, b.w * S), height: b.h * S } : { left: b.x * S, top: b.y * S - Math.max(0, (8 - b.h * S) / 2), width: b.w * S, height: Math.max(8, b.h * S) })
                      : { left: b.x * S, top: b.y * S, width: b.w * S, height: Math.max(2, b.h * S) }),
                    ...(moved ? { backgroundImage: `url(${image!.url})`, backgroundSize: `${P.w * S}px ${P.h * S}px`, backgroundPosition: `${-o!.x * S}px ${-o!.y * S}px`, backgroundRepeat: "no-repeat" } : {}),
                  }}>
                  <span className={cn("absolute -top-[17px] left-0 px-1.5 rounded-t text-[10px] leading-[17px] whitespace-nowrap pointer-events-none",
                    it.zone === "head" ? "bg-purple-600 text-white" : "bg-[#0d9488] text-white", on && !multi ? "block" : "hidden group-hover:block", on && multi && anchorKeys.includes(it.key) && "!block bg-amber-500")}>
                    {on && multi && anchorKeys.includes(it.key) ? "กรอบหลัก · " : ""}
                    {b.kind === "field" ? (b.show === "label" ? "หัวข้อ" : b.hideLabel ? "ข้อมูล" : BLOCK_LABELS.field) : BLOCK_LABELS[b.kind]}{b.kind === "field" ? ` · ${fieldOptions.find((f) => f.key === b.field)?.label || ""}` : b.kind === "info" && b.fields?.length ? ` · ${fieldLabel(b.fields[0])}` : ""}{isLocked(it) ? " 🔒" : ""}{it.zone === "head" ? " · หัวกระดาษ" : ""}
                  </span>
                  {((b.kind === "sign" && !(b.signer ? model?.signed?.[`@${b.signer}`]?.image : model?.signed?.[b.slot || ""]?.image)) || (b.kind === "stamp" && !model?.stamp)) && (
                    <div className="absolute inset-0 flex items-center justify-center border border-dashed border-slate-400/70 bg-slate-100/40 pointer-events-none">
                      <span className="text-[10px] text-slate-500 text-center px-1 leading-tight">{b.kind === "stamp" ? "ตราประทับ" : `ลายเซ็น · ${b.signer ? signers.find((p) => p.id === b.signer)?.name || "ผู้ลงนาม" : b.slot || ""}`}</span>
                    </div>
                  )}
                  {fresh && b.kind === "text" && <div className="px-1 text-[10px] text-slate-500 pointer-events-none">{b.text}</div>}
                  {ghost && !frame && b.kind !== "line" && <div className="px-1 text-[10px] text-[#0f766e] pointer-events-none truncate">{nameOf(b)}</div>}
                  {frame && (["top-0 left-0 right-0 h-[6px] -mt-[3px]", "bottom-0 left-0 right-0 h-[6px] -mb-[3px]", "top-0 bottom-0 left-0 w-[6px] -ml-[3px]", "top-0 bottom-0 right-0 w-[6px] -mr-[3px]"] as const).map((pos) => (
                    <div key={pos} onPointerDown={(e) => start(e, it, "move")} className={cn("absolute pointer-events-auto", pos)} />
                  ))}
                  {/* จุดจับปรับขนาด: ทุกมุมและทุกด้าน (เส้นแนวนอน = ซ้าย/ขวา · แนวตั้ง = บน/ล่าง) */}
                  {on && !multi && canEdit && !b.locked && !fixedBlockSize(b, stampSize) && (b.kind === "line" ? (b.h > b.w ? ["n", "s"] : ["e", "w"]) : ["nw", "n", "ne", "e", "se", "s", "sw", "w"]).map((ed) => (
                    <div key={ed} onPointerDown={(e) => start(e, it, "size", ed)} title={ed.length === 2 ? "ลากปรับขนาด (Shift = คงสัดส่วน)" : "ลากปรับขนาดด้านนี้"}
                      className={cn("absolute w-2 h-2 bg-white border border-[#0d9488] pointer-events-auto z-30", HANDLE_POS[ed])} />
                  ))}
                </div>
              );
            })}
            {/* เส้นนำขณะลาก */}
            {guides.x.map((x, i) => <div key={`gx${i}`} className="absolute top-0 bottom-0 w-px bg-pink-500 z-30 pointer-events-none" style={{ left: x * S }} />)}
            {guides.y.map((y, i) => <div key={`gy${i}`} className="absolute left-0 right-0 h-px bg-pink-500 z-30 pointer-events-none" style={{ top: y * S }} />)}
            {/* ขอบล่างหัวกระดาษ (ลากเพื่อปรับความสูง) */}
            {letterhead && (
              <div onPointerDown={startHead} className={cn("absolute left-0 right-0 z-30 h-[9px] -mt-[4px] flex items-center", canEdit && "cursor-ns-resize")} style={{ top: letterhead.height * S }}>
                <div className="w-full border-t border-dashed border-purple-500/70" />
                <span className="absolute right-1 -top-[16px] text-[10px] px-1.5 rounded bg-purple-600 text-white whitespace-nowrap">ขอบล่างหัวกระดาษ · เนื้อหาเริ่มใต้เส้นนี้</span>
              </div>
            )}
            {!bodyOn && !letterOnly && canEdit && (
              <div className="absolute inset-x-0 top-0 z-40 flex justify-center pointer-events-none">
                <span className="mt-2 text-[11.5px] px-3 py-1.5 rounded-full bg-slate-900/85 text-white shadow">จัดหน้าอัตโนมัติตามแม่แบบ · <b>คลิกหัวข้อบนกระดาษ</b> เพื่อเริ่มจัดตำแหน่งเอง</span>
              </div>
            )}
            {freeMove && moving && <span className="absolute top-2 left-2 z-40 text-[11px] px-2 py-1 rounded-full bg-amber-500/90 text-white">วางอิสระ (ไม่ดูดกริด)</span>}
            {(busy || !image) && <span className="absolute top-2 right-2 z-40 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-slate-800/80 text-white"><Loader2 size={11} className="animate-spin" /> กำลังอัปเดต</span>}
            {error && <span className="absolute bottom-2 left-2 right-2 z-40 text-[11px] px-2 py-1 rounded bg-red-600/90 text-white">วาดตัวอย่างไม่สำเร็จ: {error}</span>}
          </div>
          {inlineEditor}
          </div>
          </div>
        </div>

        {/* แผงขวา (รูปแบบ): ตั้งค่าของกล่องที่เลือก — ย่อเป็นแถบแคบได้ */}
        {!ui.right ? (
          <button type="button" onClick={() => setUiPart({ right: true })} title="ขยายแผงรูปแบบ"
            style={{ top: below }} className="flex-shrink-0 lg:sticky w-full lg:w-[34px] h-10 lg:h-[160px] rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/10 flex lg:flex-col items-center justify-center gap-1.5 text-white/70">
            <PanelRightOpen size={15} /><span className="text-[11.5px] lg:[writing-mode:vertical-rl]">รูปแบบ{problems ? ` · ควรแก้ ${problems}` : ""}</span>
          </button>
        ) : (
        <div className="w-full lg:w-[330px] flex-shrink-0 lg:sticky" style={{ top: below, ["--below" as string]: `${below + 16}px` }}>
        <GlassCard className="p-3 w-full space-y-3 lg:overflow-y-auto lg:pb-14 lg:max-h-[calc(100vh-var(--below))]">
          <div className="flex items-center gap-2 -mb-1">
            <p className="text-[13px] font-bold text-white flex items-center gap-1.5"><Paintbrush size={14} className="text-nexus-teal" /> รูปแบบ</p>
            <button type="button" onClick={() => setUiPart({ right: false })} title="ย่อแผงรูปแบบ" className="ml-auto h-7 w-7 rounded-md flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10"><PanelRightClose size={15} /></button>
          </div>
          {problems > 0 && (
            <details className="rounded-xl border border-warning/30 bg-warning/10 px-2.5 py-2">
              <summary className="cursor-pointer text-[12.5px] font-bold text-warning flex items-center gap-1.5"><AlertTriangle size={13} /> ควรแก้ {problems} จุด</summary>
              <div className="pt-2">{checkPanel}</div>
            </details>
          )}
          {multi ? <p className="text-[12.5px] text-white/70">เลือก {selected.length} กล่อง — กรอบที่คลิกก่อน (เส้นสีส้ม) เป็นกรอบหลัก · ตั้งระยะห่างให้กรอบที่คลิกทีหลังขยับเข้าหาได้ทุกด้านที่แท็บ จัดเรียง</p>
            : primary ? (
              <div className="space-y-2">
                <button type="button" onClick={() => setSel([])} className="text-[12px] text-white/50 hover:text-white flex items-center gap-1"><ChevronLeft size={13} /> ทั้งหน้า</button>
                {props(primary)}
              </div>
            ) : pagePanel}
        </GlassCard>
        </div>
        )}
      </div>

      {showPdf && model && (
        <div className="h-[880px] rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-white/[0.02]">
          <DocumentPdfViewer model={model} className="flex-1" />
        </div>
      )}
    </div>
  );
}
