"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlertTriangle, AlignVerticalDistributeCenter, ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, CheckCircle2, Copy, CopyPlus, Database, Eye, ImagePlus, Loader2, Lock, Magnet, Minus, MousePointer2,
  Group as GroupIcon, Pin, PinOff, Redo2, Split, Square, Trash2, Undo2, Ungroup, AlignLeft, AlignCenter, AlignRight, Wand2, X, Rows3,
  Bold, Type, Stamp as StampIcon, MoreHorizontal, Image as ImageIcon, TextCursorInput, BringToFront, SendToBack, ChevronLeft, PanelBottom,
  Circle, Triangle, RotateCcw, StretchHorizontal, StretchVertical,
  Italic, Underline, Strikethrough, AlignJustify, ChevronUp, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  ArrowUpToLine, ArrowDownToLine, BoxSelect, Ruler as RulerIcon, Grid3x3, Paintbrush, ZoomIn,
} from "lucide-react";
import { templateLayout } from "@/lib/documents/layout-templates";
import { DataChecklist } from "./DataChecklist";
import { blankLayout, dataGroups, toggleData, type DataContext } from "@/lib/documents/design-data";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import type { DocumentModel } from "@/lib/documents/model";
import {
  A4, BLOCK_LABELS, BLOCK_PARTS, COLOR_TOKENS, FONT_SCALE, HEAD_KINDS, requiredSatisfied, resolveColor, ITEM_COLUMNS, TEXT_BLOCKS, TEXT_VARIABLES, legalFieldVisible, addableBlocksFor, defaultFreeLayout, docHasAmounts, requiredBlocksFor, requiredColumnsFor, resolveDesign, resolveColumns, ARCHETYPES, FONT_LABELS, type FontFamily,
  type BlockKind, type ColumnSpec, type DocTheme, type FreeBlock, type FreeLayout, type ItemColumn, type Letterhead,
} from "@/lib/documents/design";
import { usePdfPageImage } from "./usePdfPageImage";

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
const MARGIN = 32;
const SINGLE: BlockKind[] = ["seller", "title", "meta", "party", "items", "totals", "words", "notes", "payment", "signatures"];
const DEDUP: BlockKind[] = ["seller", "title", "meta", "party"];
const ALIGNABLE: BlockKind[] = ["seller", "title", "meta", "info", "field", "text", "words", "notes", "payment"];
/** กล่องข้อมูลสำเร็จรูป (สร้างแล้วติ๊กเพิ่ม/ลด/เรียงหัวข้อเองได้) */
const INFO_PRESETS: { id: string; label: string }[] = [
  { id: "seller", label: "ข้อมูลบริษัท" }, { id: "customer", label: "ข้อมูลลูกค้า" }, { id: "doc", label: "เลขที่ · วันที่ · อ้างอิง" },
  { id: "extra", label: "ข้อมูลเพิ่มของเอกสาร" }, { id: "empty", label: "ว่าง (เลือกหัวข้อเอง)" },
];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
type Zone = "head" | "doc";
type Item = { key: string; zone: Zone; b: FreeBlock };
type Guides = { x: number[]; y: number[] };

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

/** ปุ่มใหญ่ในริบบอน (ไอคอนบน ป้ายล่าง) */
const RBtn = ({ icon, label, onClick, disabled, on, title }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; on?: boolean; title?: string }) => (
  <button type="button" title={title || label} disabled={disabled} onClick={onClick}
    className={cn("h-[58px] min-w-[54px] px-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[11.5px] leading-tight disabled:opacity-30", on ? "bg-nexus-teal/20 text-nexus-teal" : "text-white/80 hover:bg-white/10")}>
    <span className={on ? "text-nexus-teal" : "text-nexus-teal/90"}>{icon}</span>{label}
  </button>
);
/** ปุ่มเล็กในริบบอน (ไอคอนอย่างเดียว) */
const RIcon = ({ title, onClick, disabled, on, children }: { title: string; onClick: () => void; disabled?: boolean; on?: boolean; children: React.ReactNode }) => (
  <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
    className={cn("h-8 min-w-8 px-1.5 rounded-md flex items-center justify-center text-[12px] disabled:opacity-30", on ? "bg-nexus-teal/25 text-nexus-teal" : "text-white/75 hover:bg-white/10")}>{children}</button>
);
/** กลุ่มในริบบอน (ป้ายชื่อกลุ่มด้านล่าง เหมือน Office) */
const RGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col px-2 border-r border-white/10 last:border-r-0 flex-shrink-0">
    <div className="flex items-center gap-1 flex-1 min-h-[62px]">{children}</div>
    <p className="text-[10.5px] text-white/40 text-center pt-0.5">{label}</p>
  </div>
);
/** ไม้บรรทัด (ซม.) ตามขนาดกระดาษบนจอ · hl = ช่วงของกล่องที่เลือก */
function Ruler({ axis, S, hl }: { axis: "x" | "y"; S: number; hl?: [number, number] | null }) {
  const mm = 72 / 25.4, len = axis === "x" ? A4.w : A4.h, n = Math.floor(len / mm);
  const H = 18;
  return (
    <div className={cn("absolute bg-[#1b1b20] border-white/10 overflow-hidden select-none", axis === "x" ? "border-b" : "border-r")}
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

export function FreeLayoutEditor({ docType, theme, layout, onChange, letterhead, onLetterheadChange, letterOnly, model, canEdit, docTitle, defaultColumns, defaultSignatures, docMeta, docFields, history, dataCtx }: {
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
}) {
  const font = theme.font;
  const [sel, setSel] = useState<string[]>([]);
  // พิมพ์ข้อความบนกระดาษ (ดับเบิลคลิกกล่องข้อความ) · เมนูกล่องข้อมูล · ตัวเลือกการวาง (กริด/ดูดติด)
  const [editing, setEditing] = useState<string | null>(null);
  const [infoMenu, setInfoMenu] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  // ริบบอน: แท็บที่เปิด · ย่อเหลือชื่อแท็บ · ไม้บรรทัด · แผงซ้าย/ขวา (จำไว้ในเครื่อง)
  const [rtab, setRtab] = useState("insert");
  const [ui, setUi] = useState({ ribbon: true, ruler: true, left: true, right: true });
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("nexus.designer.ui") || "null"); if (v) setUi((u) => ({ ...u, ...v })); } catch { /* ค่าตั้งต้น */ } }, []);
  const setUiPart = (patch: Partial<typeof ui>) => setUi((u) => { const n = { ...u, ...patch }; try { localStorage.setItem("nexus.designer.ui", JSON.stringify(n)); } catch { /* ไม่เป็นไร */ } return n; });
  // ลากคลุมบนพื้นกระดาษเพื่อเลือกหลายกล่อง (pt) · add = กด Ctrl/Shift ค้าง (เลือกเพิ่ม)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; add: boolean } | null>(null);
  // ระยะห่างระหว่างกล่องเมื่อเรียงต่อกัน (pt)
  const [gap, setGap] = useState(8);
  // ความกว้างจริงของแถบเครื่องมือลอย (ไม่ให้ล้นขอบกระดาษ)
  const barRef = useRef<HTMLDivElement>(null);
  const [barW, setBarW] = useState(360);
  // วัดหลังวาดทุกครั้ง (เนื้อหาแถบเปลี่ยนตามกล่องที่เลือก) — ตั้งค่าเฉพาะเมื่อกว้างต่างจริง จึงไม่วนซ้ำ
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const w = barRef.current?.offsetWidth; if (w && Math.abs(w - barW) > 2) setBarW(w); });
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
    const ro = new ResizeObserver(([e]) => setFitS(Math.round(Math.min(2.4, Math.max(0.8, (e.contentRect.width - 26) / A4.w)) * 20) / 20));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const S = zoom === "fit" ? fitS : zoom; // px ต่อ pt บนจอ
  const [snapOn, setSnapOn] = useState(true);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const [tool, setTool] = useState<"select" | "line" | "rect">("select");
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "size" | "head"; px: number; py: number; orig: Map<string, FreeBlock>; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { image, busy, error } = usePdfPageImage(model, A4.w * S);

  // ---------- ย้อนกลับ/ทำซ้ำ: ประวัติอยู่ที่หน้าหลัก (รวมทุกการแก้ของการออกแบบ) ----------
  const commitLayout = onChange;
  const commitHead = onLetterheadChange;
  const undo = () => { history.undo(); setSel([]); };
  const redo = () => { history.redo(); setSel([]); };

  const bodyOn = !letterOnly && layout.enabled;
  /** ขอบกระดาษสำหรับจัดวาง (เส้นนำ/ดูดติด/จัดชิดขอบ) */
  const margin = layout.margin ?? MARGIN;
  const headKinds = new Set((letterhead?.blocks || []).filter((b) => DEDUP.includes(b.kind)).map((b) => b.kind));
  const items: Item[] = [
    ...(letterhead?.blocks || []).map((b) => ({ key: `h:${b.id}`, zone: "head" as Zone, b })),
    ...(bodyOn ? layout.blocks.filter((b) => !headKinds.has(b.kind)).map((b) => ({ key: `d:${b.id}`, zone: "doc" as Zone, b })) : []),
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

  const clamp = (b: FreeBlock): FreeBlock => {
    const w = Math.max(0.25, Math.min(A4.w, b.w)), h = Math.max(0.25, Math.min(A4.h, b.h));
    return { ...b, w, h, x: Math.max(0, Math.min(A4.w - w, b.x)), y: Math.max(0, Math.min(A4.h - h, b.y)) };
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
  const splitBlock = (it: Item) => {
    const b = it.b, hide = new Set(b.hide || []);
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
      ] : [];
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
    const xs = [margin, A4.w / 2, A4.w - margin], ys = [margin, A4.h / 2, A4.h - margin, ...(letterhead ? [letterhead.height] : [])];
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
        let right = b.x + b.w + dx, bottom = b.y + b.h + dy;
        const sx = free ? null : nearest([right], t.xs), sy = free ? null : nearest([bottom], t.ys);
        if (sx) { right = sx.at; g.x.push(sx.at); } else right = toGrid(right, free);
        if (sy) { bottom = sy.at; g.y.push(sy.at); } else bottom = toGrid(bottom, free);
        applyMany(new Map([[k, { ...b, w: Math.max(4, right - b.x), h: Math.max(1, bottom - b.y) }]]));
      }
      setGuides(g);
    };
    const up = () => {
      if (marquee) {
        const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1), y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
        // คลิกเฉย ๆ (ไม่ได้ลาก) = ยกเลิกการเลือก · ลากคลุม = เลือกทุกกล่องที่แตะกรอบ
        const hit = x1 - x0 < 3 && y1 - y0 < 3 ? [] : items.filter((i) => i.b.x < x1 && i.b.x + i.b.w > x0 && i.b.y < y1 && i.b.y + i.b.h > y0).map((i) => i.key);
        setSel(marquee.add ? [...new Set([...sel, ...hit])] : hit);
        setMarquee(null);
        return;
      }
      setMoving(false);
      setFreeMove(false);
      if (draft) { finishDraw(draft); return; }
      if (drag.current) { drag.current = null; setGuides({ x: [], y: [] }); }
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
      else if (e.key === "Escape") setSel([]);
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
    return { x: Math.max(0, Math.min(A4.w, sx ? sx.at : toGrid(x))), y: Math.max(0, Math.min(A4.h, sy ? sy.at : toGrid(y))) };
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
    const b = tool === "line"
      ? (Math.abs(dx) >= Math.abs(dy) ? newBlock("line", { x, y: d.y0, w: Math.abs(dx), h: 1, color: "@primary" }) : newBlock("line", { x: d.x0, y, w: 1, h: Math.abs(dy), color: "@primary" }))
      : newBlock("rect", { x, y, w: Math.max(4, Math.abs(dx)), h: Math.max(4, Math.abs(dy)), border: "@primary", radius: 0 });
    applyMany(new Map(), [{ zone: addZone, b }]);
    setSel([`${addZone === "head" ? "h" : "d"}:${b.id}`]);
    setTool("select");
  };

  const start = (e: React.PointerEvent, it: Item, mode: "move" | "size") => {
    if (tool !== "select") return; // โหมดวาด: ให้กระดาษรับการลากแทน
    e.stopPropagation();
    let next = sel;
    const members = groupOf(it);
    if ((e.shiftKey || e.ctrlKey || e.metaKey) && mode === "move") next = sel.includes(it.key) ? sel.filter((k) => !members.includes(k)) : [...sel, ...members.filter((k) => !sel.includes(k))];
    else if (mode === "size") next = [it.key];
    else if (!sel.includes(it.key)) next = members; // คลิกสมาชิกกลุ่ม = เลือกทั้งกลุ่ม (ดับเบิลคลิกเพื่อแก้กล่องเดียว)
    setSel(next);
    if (!canEdit || !next.includes(it.key)) return;
    const keys = (mode === "size" ? [it.key] : next).filter((k) => !byKey.get(k)?.b.locked);
    if (!keys.length) return; // กล่องที่ล็อกไว้: เลือกได้แต่ไม่ขยับ
    e.preventDefault();
    setMoving(true);
    drag.current = { mode, px: e.clientX, py: e.clientY, orig: new Map(keys.map((k) => [k, byKey.get(k)!.b])), h: 0 };
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
    const L = multi ? Math.min(...list.map((b) => b.x)) : margin, R = multi ? Math.max(...list.map((b) => b.x + b.w)) : A4.w - margin;
    const T0 = multi ? Math.min(...list.map((b) => b.y)) : 30, B0 = multi ? Math.max(...list.map((b) => b.y + b.h)) : A4.h - 30;
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
    const size: Record<string, [number, number]> = { text: [200, 24], line: [300, 1.5], rect: [200, 80], image: [120, 80], logo: [64, 64], stamp: [72, 72], field: [180, 18] };
    const [w, h] = def ? [def.w, def.h] : size[kind] || [200, 40];
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
    b = { ...b, x: Math.round(Math.max(0, Math.min(A4.w - b.w, c.x - b.w / 2))), y: Math.round(Math.max(0, Math.min(A4.h - b.h, c.y - b.h / 2))) };
    applyMany(new Map(), [{ zone: addZone, b }]);
    setSel([`${addZone === "head" ? "h" : "d"}:${b.id}`]);
  };
  /** ตำแหน่ง (pt) ของจุดกึ่งกลางกระดาษที่มองเห็นบนจอ */
  const visibleCenter = () => {
    const r = paperRef.current?.getBoundingClientRect();
    if (!r) return { x: A4.w / 2, y: 200 };
    return { x: A4.w / 2, y: Math.max(40, Math.min(A4.h - 60, (window.innerHeight / 2 - r.top) / S)) };
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
      { title: `ข้อมูล${docTitle}`, keys: ["number", "date", "title", "titleEn", ...docMeta.map((l) => `m:${l}`)] },
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
        {!b.hideLabel && (
          <Field label={`ความกว้างป้าย ${b.labelWidth ?? 90} pt`}>
            <input type="range" min={20} max={200} step={2} value={b.labelWidth ?? 90} onChange={(e) => update(it, { labelWidth: Number(e.target.value) })} className="w-full accent-[#0d9488] h-7" />
          </Field>
        )}
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
            <PillCheckbox label="แสดงเฉพาะค่า (ไม่มีป้าย)" checked={!!b.hideLabel} onChange={(e) => update(it, { hideLabel: e.target.checked })} />
            <PillCheckbox label="ตัวหนา" checked={!!b.bold} onChange={(e) => update(it, { bold: e.target.checked })} />
          </div>
        )}

        {b.kind === "info" && <div className="rounded-xl border border-white/10 p-2.5">{infoEditor(it)}</div>}

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

        {TEXT_BLOCKS.includes(b.kind) && (
          <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">ตัวอักษร</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={b.kind === "text" ? "ขนาด (pt)" : "ขนาด (pt) ว่าง=ตามแม่แบบ"}>
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
            {parts.filter((p) => !(b.kind === "items" && p.key === "detail" && resolveColumns(b, defaultColumns as ItemColumn[]).some((x) => x.key === "detail"))).map((p) => (
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

        {b.kind === "stamp" && <p className="text-[11px] text-white/45">รูปตราตั้งที่แท็บ &quot;ลายเซ็น · ตราประทับ&quot; · พิมพ์เฉพาะเอกสารที่ออกจริง (ฉบับร่าง/ยกเลิกไม่มีตรา) · ตอนพิมพ์เลือกไม่ใส่ได้</p>}
        {b.kind === "rect" && <p className="text-[11px] text-white/45">กรอบคลิกเลือกที่เส้นขอบ (ข้างในคลิกข้อมูลที่อยู่ในกรอบได้) หรือเลือกจากรายการชั้น</p>}
        {b.kind === "image" && (
          <>
            <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> เลือกรูป (PNG/JPG)</PillButton>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) update(it, { src: await shrinkImage(f) }); }} />
          </>
        )}
        {b.kind === "line" && (() => {
          const vertical = b.h > b.w, thick = vertical ? b.w : b.h;
          return (
            <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
              <p className="text-[11.5px] font-bold text-white/70">เส้น</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="ความหนา (pt)">
                  <PillInput inputMode="decimal" value={thick} onChange={(e) => { const v = Math.max(0.25, Math.min(8, Number(e.target.value.replace(/[^\d.]/g, "")) || 0.25)); update(it, vertical ? { w: v } : { h: v }); }} className="h-8 w-full text-sm font-mono text-right" />
                </Field>
                <Field label="รูปแบบ">
                  <PillSelect value={b.dash || "solid"} onChange={(e) => (e.target.value === "solid" ? unset(it, "dash") : update(it, { dash: e.target.value as any }))} className="h-8 w-full text-sm">
                    <option value="solid">เส้นทึบ</option><option value="dashed">เส้นประ</option><option value="dotted">จุด</option>
                  </PillSelect>
                </Field>
              </div>
              <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={() => update(it, vertical ? { w: b.h, h: thick } : { w: thick, h: Math.max(20, b.w) })}>{vertical ? "เปลี่ยนเป็นแนวนอน" : "เปลี่ยนเป็นแนวตั้ง"}</PillButton>
              {colorRow(it, "สีเส้น", "color")}
            </div>
          );
        })()}
        {b.kind !== "line" && (
          <div className="space-y-2 rounded-xl border border-white/10 p-2.5">
            <p className="text-[11.5px] font-bold text-white/70">กรอบ · พื้น · มุม</p>
            {colorRow(it, "พื้นหลัง", "bg")}
            {colorRow(it, "กรอบ", "border")}
            {b.border && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="ความหนากรอบ (pt)">
                  <PillInput inputMode="decimal" value={b.borderWidth ?? 1} onChange={(e) => update(it, { borderWidth: Math.max(0.25, Math.min(8, Number(e.target.value.replace(/[^\d.]/g, "")) || 0.25)) })} className="h-8 w-full text-sm font-mono text-right" />
                </Field>
                <Field label="รูปแบบเส้น">
                  <PillSelect value={b.dash || "solid"} onChange={(e) => (e.target.value === "solid" ? unset(it, "dash") : update(it, { dash: e.target.value as any }))} className="h-8 w-full text-sm">
                    <option value="solid">เส้นทึบ</option><option value="dashed">เส้นประ</option><option value="dotted">จุด</option>
                  </PillSelect>
                </Field>
              </div>
            )}
            {b.kind !== "shape" && <>
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
            {!["rect", "shape", "image", "logo", "stamp", "items"].includes(b.kind) && (
              <Field label={`ระยะห่างขอบใน ${b.pad ?? (b.kind === "text" ? 2 : b.border || b.bg ? 4 : 0)} pt`}>
                <input type="range" min={0} max={30} step={1} value={b.pad ?? (b.kind === "text" ? 2 : b.border || b.bg ? 4 : 0)} onChange={(e) => update(it, { pad: Number(e.target.value) })} className="w-full accent-[#0d9488] h-8" />
              </Field>
            )}
            {b.kind === "shape" && (
              <Field label="รูปทรง">
                <PillSelect value={b.shape || "ellipse"} onChange={(e) => update(it, { shape: e.target.value as any })} className="h-8 w-full text-sm">
                  <option value="ellipse">วงกลม / วงรี</option><option value="triangle">สามเหลี่ยม</option>
                </PillSelect>
              </Field>
            )}
          </div>
        )}

        {letterhead && !letterOnly && HEAD_KINDS.includes(b.kind) && (
          <PillCheckbox label="อยู่ในหัวกระดาษ (ใช้ร่วมกับเอกสารที่ใช้หัวนี้)" checked={it.zone === "head"} onChange={() => moveZone(it)} />
        )}
        {canEdit && SPLITTABLE.includes(b.kind) && (
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-2.5 space-y-1.5">
            <p className="text-[11.5px] text-white/65 leading-relaxed">ต้องการจัดวางหัวข้อในกล่องนี้เอง (เช่น ย้ายที่อยู่ไปอีกฝั่ง)? แยกเป็นช่องย่อยแล้วลากแต่ละหัวข้อได้อิสระ ข้อมูลยังดึงจากฐานข้อมูลเหมือนเดิม</p>
            <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => splitBlock(it)}><Split size={13} /> แยกหัวข้อเป็นกล่องย่อย</PillButton>
            {b.kind !== "title" && <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => toInfo(it)}><Rows3 size={13} /> เปลี่ยนเป็นกล่องข้อมูล (ติ๊กเลือก/เรียงหัวข้อเอง)</PillButton>}
          </div>
        )}
        {b.group && <p className="text-[11.5px] text-purple-200/80 flex items-center gap-1"><GroupIcon size={12} /> อยู่ในกลุ่ม — คลิกเลือกทั้งกลุ่ม · ดับเบิลคลิกแก้กล่องเดียว</p>}
        <PillCheckbox label="ล็อกตำแหน่ง (กันลากโดยไม่ตั้งใจ)" checked={!!b.locked} onChange={(e) => update(it, { locked: e.target.checked || undefined })} />
        <div className="flex gap-1.5 pt-1">
          <PillButton variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => reorder(it, -1)} title="ไปด้านหลัง"><ArrowDown size={13} /></PillButton>
          <PillButton variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => reorder(it, 1)} title="มาด้านหน้า"><ArrowUp size={13} /></PillButton>
          {!isLocked(it) && <PillButton variant="ghost" className="h-8 px-2.5 text-xs text-danger ml-auto" onClick={() => remove([it])}><Trash2 size={13} /> ลบ</PillButton>}
        </div>
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
      if (b.x < 14 || b.y < 10 || b.x + b.w > A4.w - 14 || b.y + b.h > A4.h - 14) out.push({ text: `${nameOf(b)} ชิดขอบกระดาษเกินไป (เครื่องพิมพ์อาจตัดขอบ)`, keys: [it.key] });
      else if (theme.showPageNumber && b.y + b.h > A4.h - 30) out.push({ text: `${nameOf(b)} ทับบรรทัดท้ายกระดาษ (เลขหน้า)`, keys: [it.key] });
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


  // ---------- แถบเครื่องมือลอยเหนือกล่องที่เลือก ----------
  const pb = primary?.b;
  const textual = !!pb && TEXT_BLOCKS.includes(pb.kind);
  const barTop = pb ? (pb.y * S - 46 < 0 ? (pb.y + pb.h) * S + 8 : pb.y * S - 46) : 0;
  const barLeft = pb ? Math.max(0, Math.min(A4.w * S - barW, pb.x * S)) : 0;
  const FBtn = ({ title, on, onClick, children, danger }: { title: string; on?: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={cn("h-8 min-w-8 px-1.5 rounded-lg flex items-center justify-center text-[12px]", on ? "bg-[#0d9488] text-white" : danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100")}>{children}</button>
  );
  const floatingBar = canEdit && selected.length > 0 && !moving && !editing && (
    <div ref={barRef} className="absolute z-50 flex items-center gap-0.5 rounded-xl bg-white shadow-xl border border-slate-200 px-1 py-1" style={{ left: multi ? Math.max(0, Math.min(A4.w * S - barW, Math.min(...selected.map((i) => i.b.x)) * S)) : barLeft, top: multi ? Math.max(0, Math.min(...selected.map((i) => i.b.y)) * S - 46) : barTop }}
      onPointerDown={(e) => e.stopPropagation()}>
      {multi ? (
        <>
          <FBtn title="ชิดซ้าย" onClick={() => align("left")}><AlignStartVertical size={15} /></FBtn>
          <FBtn title="กึ่งกลางแนวนอน" onClick={() => align("hcenter")}><AlignCenterVertical size={15} /></FBtn>
          <FBtn title="ชิดขวา" onClick={() => align("right")}><AlignEndVertical size={15} /></FBtn>
          <FBtn title="ชิดบน" onClick={() => align("top")}><AlignStartHorizontal size={15} /></FBtn>
          <FBtn title="กึ่งกลางแนวตั้ง" onClick={() => align("vcenter")}><AlignCenterHorizontal size={15} /></FBtn>
          <FBtn title="ชิดล่าง" onClick={() => align("bottom")}><AlignEndHorizontal size={15} /></FBtn>
          {selected.length > 2 && <><FBtn title="กระจายแนวนอนเท่ากัน" onClick={() => distribute("x")}><AlignHorizontalDistributeCenter size={15} /></FBtn><FBtn title="กระจายแนวตั้งเท่ากัน" onClick={() => distribute("y")}><AlignVerticalDistributeCenter size={15} /></FBtn></>}
          <span className="w-px h-5 bg-slate-200 mx-0.5" />
          <span className="text-[11px] text-slate-500 pl-1">ห่าง</span>
          <input type="number" min={0} max={200} value={gap} onChange={(e) => setGap(Math.max(0, Math.min(200, Number(e.target.value) || 0)))} title="ระยะห่างระหว่างกล่อง (pt)" className="w-12 h-7 rounded-md border border-slate-300 !bg-white !text-slate-800 text-[12px] text-right px-1" />
          <FBtn title="เรียงลงมาเว้นระยะตามที่ตั้ง" onClick={() => stack("y")}><StretchVertical size={15} /></FBtn>
          <FBtn title="เรียงไปทางขวาเว้นระยะตามที่ตั้ง" onClick={() => stack("x")}><StretchHorizontal size={15} /></FBtn>
          <span className="w-px h-5 bg-slate-200 mx-0.5" />
          {anyGrouped ? <FBtn title="แยกกลุ่ม (Ctrl+Shift+G)" onClick={ungroupSelected}><Ungroup size={15} /></FBtn> : <FBtn title="จัดกลุ่ม: ย้ายพร้อมกัน (Ctrl+G)" onClick={groupSelected}><GroupIcon size={15} /></FBtn>}
          {selected.some((i) => !isLocked(i)) && <FBtn title="ลบ (Delete)" danger onClick={() => remove(selected)}><Trash2 size={15} /></FBtn>}
        </>
      ) : primary && pb && (
        <>
          {textual && (
            <>
              <FBtn title="ตัวเล็กลง" onClick={() => update(primary, { fontSize: Math.max(6, Math.round(((pb.fontSize ?? theme.fontSize) - 0.5) * 10) / 10) })}><span className="font-bold">A−</span></FBtn>
              <span className="w-9 text-center text-[12px] font-mono text-slate-600" title="ขนาดตัวอักษร (pt)">{pb.fontSize ?? theme.fontSize}</span>
              <FBtn title="ตัวใหญ่ขึ้น" onClick={() => update(primary, { fontSize: Math.min(40, Math.round(((pb.fontSize ?? theme.fontSize) + 0.5) * 10) / 10) })}><span className="font-bold">A+</span></FBtn>
            </>
          )}
          {["text", "field", "info"].includes(pb.kind) && <FBtn title="ตัวหนา" on={!!pb.bold} onClick={() => update(primary, { bold: !pb.bold || undefined })}><Bold size={15} /></FBtn>}
          {ALIGNABLE.includes(pb.kind) && (["left", "center", "right"] as const).map((a) => { const I = ALIGN_ICON[a]; return <FBtn key={a} title={a === "left" ? "ชิดซ้าย" : a === "center" ? "กึ่งกลาง" : "ชิดขวา"} on={pb.align === a} onClick={() => update(primary, { align: a })}><I size={15} /></FBtn>; })}
          {(textual || pb.kind === "line") && (
            <label title="สีตัวอักษร/เส้น" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 cursor-pointer">
              <span className="w-5 h-5 rounded-full border border-slate-300" style={{ background: resolveColor(pb.color, theme) || (pb.kind === "line" ? theme.primary : theme.text) }} />
              <input type="color" className="sr-only" value={resolveColor(pb.color, theme) || theme.text} onChange={(e) => update(primary, { color: e.target.value })} />
            </label>
          )}
          {(pb.kind === "rect" || pb.kind === "shape") && (
            <label title="สีพื้น" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 cursor-pointer">
              <span className="w-5 h-5 rounded border border-slate-300" style={{ background: resolveColor(pb.bg, theme) || "#ffffff" }} />
              <input type="color" className="sr-only" value={resolveColor(pb.bg, theme) || "#ffffff"} onChange={(e) => update(primary, { bg: e.target.value })} />
            </label>
          )}
          {pb.kind === "text" && <FBtn title="พิมพ์ข้อความ (ดับเบิลคลิกที่กล่องก็ได้)" onClick={() => setEditing(primary.key)}><Type size={15} /></FBtn>}
          <span className="w-px h-5 bg-slate-200 mx-0.5" />
          {!SINGLE.includes(pb.kind) && <FBtn title="ทำสำเนา (Ctrl+D)" onClick={duplicate}><CopyPlus size={15} /></FBtn>}
          <FBtn title="นำมาไว้ด้านหน้า" onClick={() => reorder(primary, 1)}><BringToFront size={15} /></FBtn>
          <FBtn title="ส่งไปไว้ด้านหลัง" onClick={() => reorder(primary, -1)}><SendToBack size={15} /></FBtn>
          <FBtn title={pb.locked ? "ปลดล็อกตำแหน่ง" : "ล็อกตำแหน่ง"} on={!!pb.locked} onClick={toggleLock}>{pb.locked ? <PinOff size={15} /> : <Pin size={15} />}</FBtn>
          {!isLocked(primary) && <FBtn title="ลบ (Delete)" danger onClick={() => remove([primary])}><Trash2 size={15} /></FBtn>}
        </>
      )}
    </div>
  );

  // ---------- พิมพ์ข้อความบนกระดาษ ----------
  const editItem = editing ? byKey.get(editing) : null;
  const inlineEditor = editItem && (
    <textarea autoFocus value={editItem.b.text || ""} onChange={(e) => update(editItem, { text: e.target.value })}
      onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-50 resize-none rounded border-2 border-[#0d9488] bg-white/95 text-slate-900 p-0.5 outline-none shadow-lg"
      style={{ left: editItem.b.x * S, top: editItem.b.y * S, width: Math.max(140, editItem.b.w * S), minHeight: Math.max(40, editItem.b.h * S), fontSize: (editItem.b.fontSize || 10) * FONT_SCALE[font] * S, lineHeight: editItem.b.lineHeight ?? 1.35, textAlign: editItem.b.align, fontWeight: editItem.b.bold ? 700 : 400, color: resolveColor(editItem.b.color, theme) || "#111" }} />
  );

  // ---------- แถบเพิ่มของ (ซ้าย): คลิก = วางกลางจอ · ลากไปวางบนกระดาษ ----------
  const palette: { kind: string; label: string; icon: React.ReactNode }[] = [
    { kind: "text", label: "ข้อความ", icon: <Type size={16} /> },
    ...(addable.includes("info") ? [{ kind: "info", label: "กล่องข้อมูล", icon: <Rows3 size={16} /> }] : []),
    ...(addable.includes("field") ? [{ kind: "field", label: "ข้อมูลเดี่ยว", icon: <TextCursorInput size={16} /> }] : []),
    { kind: "line", label: "เส้น", icon: <Minus size={16} /> },
    { kind: "rect", label: "สี่เหลี่ยม / กรอบ", icon: <Square size={16} /> },
    { kind: "shape:ellipse", label: "วงกลม / วงรี", icon: <Circle size={16} /> },
    { kind: "shape:triangle", label: "สามเหลี่ยม", icon: <Triangle size={16} /> },
    { kind: "image", label: "รูปภาพ", icon: <ImageIcon size={16} /> },
    ...(addable.includes("logo") ? [{ kind: "logo", label: "โลโก้", icon: <ImagePlus size={16} /> }] : []),
    ...(addable.includes("stamp") ? [{ kind: "stamp", label: "ตราประทับ", icon: <StampIcon size={16} /> }] : []),
  ];
  const missing = addable.filter((k) => SINGLE.includes(k));
  const dropAt = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData("text/nexus-kind");
    if (!kind || !canEdit) return;
    e.preventDefault();
    const r = paperRef.current!.getBoundingClientRect();
    addAt(kind === "info" ? "info:empty" : kind, { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S });
  };
  const leftBar = canEdit && (bodyOn || letterhead) && (!ui.left ? (
    <div className="relative z-30 flex-shrink-0 lg:sticky lg:top-16 w-full lg:w-[44px] flex lg:flex-col gap-1 items-center">
      <RIcon title="ขยายแผงเพิ่มของ" onClick={() => setUiPart({ left: true })}><PanelLeftOpen size={16} /></RIcon>
      {palette.map((p) => (
        <button key={p.kind} type="button" title={`${p.label} — คลิกหรือลากไปวาง`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/nexus-kind", p.kind === "info" ? "info:empty" : p.kind); e.dataTransfer.effectAllowed = "copy"; }}
          onClick={() => addAt(p.kind === "info" ? "info:empty" : p.kind, visibleCenter())}
          className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] hover:border-nexus-teal/50 hover:bg-nexus-teal/10 flex items-center justify-center text-nexus-teal cursor-grab">{p.icon}</button>
      ))}
    </div>
  ) : (
    <div className="relative z-30 w-full lg:w-[132px] flex-shrink-0 lg:sticky lg:top-16 space-y-1.5">
      <div className="flex items-center gap-1">
        <p className="text-[11px] text-white/45 px-1 leading-snug flex-1">คลิกหรือลากไปวางบนกระดาษ</p>
        <RIcon title="ย่อแผงเพิ่มของ" onClick={() => setUiPart({ left: false })}><PanelLeftClose size={15} /></RIcon>
      </div>
      <div className="grid grid-cols-4 lg:grid-cols-1 gap-1">
        {palette.map((p) => (
          <div key={p.kind} className="relative">
            <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData("text/nexus-kind", p.kind); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => (p.kind === "info" ? setInfoMenu((v) => !v) : addAt(p.kind, visibleCenter()))}
              className="w-full h-10 px-2 rounded-xl border border-white/10 bg-white/[0.03] hover:border-nexus-teal/50 hover:bg-nexus-teal/10 flex items-center gap-2 text-[12.5px] text-white/80 cursor-grab active:cursor-grabbing">
              <span className="text-nexus-teal">{p.icon}</span>{p.label}
            </button>
            {p.kind === "info" && infoMenu && (
              <div className="absolute left-0 lg:left-full lg:ml-1 top-full lg:top-0 z-50 w-[210px] rounded-xl border border-white/10 bg-[#18181d] shadow-2xl p-1">
                {INFO_PRESETS.filter((x) => x.id !== "extra" || docFields.length).map((x) => (
                  <button key={x.id} type="button" onClick={() => { setInfoMenu(false); addInfo(x.id); }} className="w-full text-left h-8 px-2.5 rounded-lg text-[12.5px] text-white/80 hover:bg-white/10">{x.label}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <>
          <p className="text-[11px] text-white/45 px-1 pt-1">ส่วนที่ยังไม่มีบนกระดาษ</p>
          <div className="grid grid-cols-4 lg:grid-cols-1 gap-1">
            {missing.map((k) => (
              <button key={k} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/nexus-kind", k)} onClick={() => addAt(k, visibleCenter())}
                className="w-full h-9 px-2 rounded-xl border border-dashed border-white/15 hover:border-nexus-teal/50 flex items-center gap-2 text-[12px] text-white/65"><PanelBottom size={14} /> {BLOCK_LABELS[k]}</button>
            ))}
          </div>
        </>
      )}
    </div>
  ));

  // ---------- ริบบอน ----------
  const SHAPE_KINDS: BlockKind[] = ["rect", "shape", "line", "image", "logo", "stamp"];
  const textSel = selected.filter((i) => TEXT_BLOCKS.includes(i.b.kind));
  const shapeSel = selected.filter((i) => SHAPE_KINDS.includes(i.b.kind));
  const t0 = textSel[0]?.b, s0 = shapeSel[0]?.b;
  const patchSel = (list: Item[], patch: Partial<FreeBlock> | ((b: FreeBlock) => Partial<FreeBlock>)) => { if (canEdit && list.length) applyMany(new Map(list.map((i) => [i.key, { ...i.b, ...(typeof patch === "function" ? patch(i.b) : patch) }]))); };
  const ctxTab = textSel.length && !shapeSel.length ? "ftext" : shapeSel.length ? "fshape" : null;
  // เลือกข้อความ → แท็บรูปแบบข้อความ · เลือกรูปทรง/รูปภาพ → แท็บรูปแบบรูปทรง (เหมือนแท็บตามบริบทของ Office)
  useEffect(() => { if (ctxTab) setRtab(ctxTab); else setRtab((t) => (t === "ftext" || t === "fshape" ? "insert" : t)); }, [ctxTab, sel.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const dx = axis === "y" ? 0 : (A4.w - (R - L)) / 2 - L, dy = axis === "x" ? 0 : (A4.h - (B - T)) / 2 - T;
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
  const mini = "h-8 rounded-md bg-white/5 border border-white/10 text-[12px] text-white px-1.5";
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
    ...(ctxTab === "ftext" ? [{ id: "ftext", label: "รูปแบบข้อความ", ctx: true }] : ctxTab === "fshape" ? [{ id: "fshape", label: "รูปแบบรูปทรง", ctx: true }] : []),
  ];
  const ribbonBody = (() => {
    switch (rtab) {
      case "home": return (
        <>
          <RGroup label="ประวัติการแก้">
            <RBtn icon={<Undo2 size={18} />} label="ย้อนกลับ" title="ย้อนกลับ (Ctrl+Z)" disabled={!history.canUndo || !canEdit} onClick={undo} />
            <RBtn icon={<Redo2 size={18} />} label="ทำซ้ำ" title="ทำซ้ำ (Ctrl+Y)" disabled={!history.canRedo || !canEdit} onClick={redo} />
          </RGroup>
          <RGroup label="กล่องที่เลือก">
            <RBtn icon={<BoxSelect size={18} />} label="เลือกทั้งหมด" title="เลือกทุกกล่อง (Ctrl+A)" onClick={() => setSel(items.map((i) => i.key))} />
            <RBtn icon={<CopyPlus size={18} />} label="ทำสำเนา" title="ทำสำเนา (Ctrl+D)" disabled={!canEdit || !selected.some((i) => !SINGLE.includes(i.b.kind))} onClick={duplicate} />
            <RBtn icon={allLocked && selected.length ? <PinOff size={18} /> : <Pin size={18} />} label={allLocked && selected.length ? "ปลดล็อก" : "ล็อก"} disabled={!can} onClick={toggleLock} />
            <RBtn icon={<Trash2 size={18} />} label="ลบ" title="ลบ (Delete)" disabled={!can || !selected.some((i) => !isLocked(i))} onClick={() => remove(selected)} />
          </RGroup>
          <RGroup label="มุมมอง">
            <select value={String(zoom)} onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))} className={cn(mini, "w-[124px]")} title="ขนาดกระดาษบนจอ">
              <option value="fit">พอดีความกว้าง</option><option value="1">ซูม 100%</option><option value="1.333">ขนาดจริง</option><option value="1.5">ซูม 150%</option><option value="2">ซูม 200%</option>
            </select>
            <RBtn icon={<Eye size={18} />} label="ดู PDF" on={showPdf} onClick={() => setShowPdf((v) => !v)} />
          </RGroup>
        </>
      );
      case "insert": return (
        <>
          <RGroup label="ข้อความและข้อมูล">
            <RBtn icon={<Type size={18} />} label="ข้อความ" disabled={!canEdit} onClick={() => addAt("text", visibleCenter())} />
            {addable.includes("info") && (
              <div className="relative">
                <RBtn icon={<Rows3 size={18} />} label="กล่องข้อมูล ▾" disabled={!canEdit} onClick={() => setInfoMenu((v) => !v)} />
                {infoMenu && (
                  <div className="absolute left-0 top-full mt-1 z-[60] w-[210px] rounded-xl border border-white/10 bg-[#18181d] shadow-2xl p-1">
                    {INFO_PRESETS.filter((x) => x.id !== "extra" || docFields.length).map((x) => (
                      <button key={x.id} type="button" onClick={() => { setInfoMenu(false); addInfo(x.id); }} className="w-full text-left h-8 px-2.5 rounded-lg text-[12.5px] text-white/80 hover:bg-white/10">{x.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {addable.includes("field") && <RBtn icon={<TextCursorInput size={18} />} label="ข้อมูลเดี่ยว" disabled={!canEdit} onClick={() => addAt("field", visibleCenter())} />}
          </RGroup>
          <RGroup label="รูปทรง">
            <RBtn icon={<Square size={18} />} label="สี่เหลี่ยม" disabled={!canEdit} onClick={() => addAt("rect", visibleCenter())} />
            <RBtn icon={<Circle size={18} />} label="วงกลม" disabled={!canEdit} onClick={() => addAt("shape:ellipse", visibleCenter())} />
            <RBtn icon={<Triangle size={18} />} label="สามเหลี่ยม" disabled={!canEdit} onClick={() => addAt("shape:triangle", visibleCenter())} />
            <RBtn icon={<Minus size={18} />} label="เส้น" disabled={!canEdit} onClick={() => addAt("line", visibleCenter())} />
          </RGroup>
          <RGroup label="ภาพ">
            <RBtn icon={<ImageIcon size={18} />} label="รูปภาพ" disabled={!canEdit} onClick={() => addAt("image", visibleCenter())} />
            {addable.includes("logo") && <RBtn icon={<ImagePlus size={18} />} label="โลโก้" disabled={!canEdit} onClick={() => addAt("logo", visibleCenter())} />}
            {addable.includes("stamp") && <RBtn icon={<StampIcon size={18} />} label="ตราประทับ" disabled={!canEdit} onClick={() => addAt("stamp", visibleCenter())} />}
          </RGroup>
          {missing.length > 0 && (
            <RGroup label="ส่วนของเอกสารที่ยังไม่มี">
              {missing.map((k) => <RBtn key={k} icon={<PanelBottom size={18} />} label={BLOCK_LABELS[k]} disabled={!canEdit} onClick={() => addAt(k, visibleCenter())} />)}
            </RGroup>
          )}
        </>
      );
      case "layout": return (
        <>
          <RGroup label={`ขอบกระดาษ ${margin} pt`}>
            {([["ปกติ", 32], ["แคบ", 18], ["กว้าง", 48]] as const).map(([label, v]) => <RIcon key={label} title={`ขอบกระดาษ${label} (${v} pt)`} on={margin === v} disabled={!canEdit || !bodyOn} onClick={() => commitLayout({ ...layout, margin: v })}>{label}</RIcon>)}
            <input type="number" min={0} max={80} value={margin} disabled={!canEdit || !bodyOn} title="ขอบกระดาษ (pt)" onChange={(e) => commitLayout({ ...layout, margin: Math.max(0, Math.min(80, Number(e.target.value) || 0)) })} className={cn(mini, "w-14 text-right")} />
          </RGroup>
          <RGroup label="เส้นช่วยจัดวาง">
            <RBtn icon={<RulerIcon size={18} />} label="ไม้บรรทัด" on={ui.ruler} onClick={() => setUiPart({ ruler: !ui.ruler })} />
            <RBtn icon={<Magnet size={18} />} label={snapOn ? "ดูดติด" : "วางอิสระ"} on={snapOn} title="ดูดติดกริดและแนวกล่องอื่น (Alt ค้าง = วางอิสระชั่วคราว)" onClick={() => setSnapOn((v) => !v)} />
            <div className="flex flex-col gap-1">
              <select value={gridMode} onChange={(e) => setGridMode(e.target.value as any)} className={cn(mini, "w-[118px] h-7")} title="เส้นกริด">
                <option value="drag">กริด: ขณะลาก</option><option value="always">กริด: ตลอด</option><option value="off">กริด: ปิด</option>
              </select>
              <select value={String(grid)} onChange={(e) => setGrid(Number(e.target.value))} className={cn(mini, "w-[118px] h-7")} title="ระยะกริด">
                {[2, 5, 10, 20].map((g) => <option key={g} value={String(g)}>ระยะกริด {g} pt</option>)}
              </select>
            </div>
          </RGroup>
          {bodyOn && canEdit && (
            <RGroup label="ผังหน้า">
              <div className="relative">
                <RBtn icon={<RotateCcw size={18} />} label="เริ่มผังใหม่ ▾" onClick={() => setRestartOpen((v) => !v)} />
                {restartOpen && (
                  <div className="absolute left-0 top-full mt-1 z-[60] w-[250px] rounded-xl border border-white/10 bg-[#18181d] shadow-2xl p-1 max-h-[60vh] overflow-y-auto">
                    <button type="button" onClick={() => { setRestartOpen(false); commitLayout(blankLayout(docType, theme)); setSel([]); }} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/10">
                      <p className="text-[12.5px] font-bold text-white">หน้ากระดาษเปล่า</p>
                      <p className="text-[11px] text-white/50">เหลือเฉพาะข้อมูลที่กฎหมายกำหนด ไม่มีกรอบ/สี — ออกแบบใหม่ทั้งหมด</p>
                    </button>
                    <p className="px-2.5 pt-2 pb-1 text-[11px] text-white/40">ปรับแก้จากแม่แบบ</p>
                    {ARCHETYPES.map((a) => (
                      <button key={a.id} type="button" onClick={() => { setRestartOpen(false); commitLayout(templateLayout(a.id, docType, theme)); setSel([]); }} className="w-full text-left h-8 px-2.5 rounded-lg text-[12.5px] text-white/80 hover:bg-white/10">{a.name}</button>
                    ))}
                    <p className="px-2.5 py-1.5 text-[11px] text-white/40">ไม่ถูกใจกด ย้อนกลับ (Ctrl+Z)</p>
                  </div>
                )}
              </div>
            </RGroup>
          )}
          {letterhead && (
            <RGroup label="หัวกระดาษ">
              <span className="text-[11.5px] text-white/55">สูง</span>
              <input type="number" min={40} max={320} value={letterhead.height} disabled={!canEdit} onChange={(e) => commitHead({ ...letterhead, height: Math.max(40, Math.min(320, Number(e.target.value) || 40)) })} className={cn(mini, "w-16 text-right")} />
              <span className="text-[11.5px] text-white/55">pt</span>
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
          <RGroup label="กระจาย · เว้นระยะ">
            <RIcon title="กระจายแนวนอนเท่ากัน (3 กล่องขึ้นไป)" disabled={selected.length < 3 || !canEdit} onClick={() => distribute("x")}><AlignHorizontalDistributeCenter size={16} /></RIcon>
            <RIcon title="กระจายแนวตั้งเท่ากัน (3 กล่องขึ้นไป)" disabled={selected.length < 3 || !canEdit} onClick={() => distribute("y")}><AlignVerticalDistributeCenter size={16} /></RIcon>
            <span className="text-[11px] text-white/50 pl-1">ห่าง</span>
            <input type="number" min={0} max={200} value={gap} onChange={(e) => setGap(Math.max(0, Math.min(200, Number(e.target.value) || 0)))} title="ระยะห่างระหว่างกล่อง (pt)" className={cn(mini, "w-14 text-right")} />
            <RIcon title="เรียงลงมาเว้นระยะ" disabled={selected.length < 2 || !canEdit} onClick={() => stack("y")}><StretchVertical size={16} /></RIcon>
            <RIcon title="เรียงไปทางขวาเว้นระยะ" disabled={selected.length < 2 || !canEdit} onClick={() => stack("x")}><StretchHorizontal size={16} /></RIcon>
          </RGroup>
          <RGroup label="ลำดับชั้น">
            <RBtn icon={<ArrowUpToLine size={18} />} label="บนสุด" disabled={!primary || multi || !canEdit} onClick={() => primary && zEnd(primary, "front")} />
            <RBtn icon={<BringToFront size={18} />} label="ขึ้นหนึ่งชั้น" disabled={!primary || multi || !canEdit} onClick={() => primary && reorder(primary, 1)} />
            <RBtn icon={<SendToBack size={18} />} label="ลงหนึ่งชั้น" disabled={!primary || multi || !canEdit} onClick={() => primary && reorder(primary, -1)} />
            <RBtn icon={<ArrowDownToLine size={18} />} label="ล่างสุด" disabled={!primary || multi || !canEdit} onClick={() => primary && zEnd(primary, "back")} />
          </RGroup>
          <RGroup label="กลุ่ม">
            <RBtn icon={<GroupIcon size={18} />} label="จัดกลุ่ม" title="จัดกลุ่ม (Ctrl+G)" disabled={selected.length < 2 || !canEdit} onClick={groupSelected} />
            <RBtn icon={<Ungroup size={18} />} label="แยกกลุ่ม" title="แยกกลุ่ม (Ctrl+Shift+G)" disabled={!anyGrouped || !canEdit} onClick={ungroupSelected} />
          </RGroup>
        </>
      );
      case "ftext": return t0 ? (
        <>
          <RGroup label="แบบอักษร">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <select value={t0.font || ""} onChange={(e) => patchSel(textSel, { font: (e.target.value || undefined) as FontFamily | undefined })} className={cn(mini, "w-[150px] h-7")} title="ฟอนต์">
                  <option value="">ตามธีม ({FONT_LABELS[theme.font].split(" (")[0]})</option>
                  {(Object.keys(FONT_LABELS) as FontFamily[]).map((f) => <option key={f} value={f}>{FONT_LABELS[f].split(" (")[0]}</option>)}
                </select>
                <select value={String(textSize)} onChange={(e) => patchSel(textSel, { fontSize: Number(e.target.value) })} className={cn(mini, "w-[64px] h-7")} title="ขนาดตัวอักษร (pt)">
                  {[...new Set([...SIZES, textSize])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>{v}</option>)}
                </select>
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
              </div>
              <div className="flex items-center gap-1">
                <select value={String(t0.lineHeight ?? 1.35)} onChange={(e) => patchSel(textSel, { lineHeight: Number(e.target.value) })} className={cn(mini, "w-[96px] h-7")} title="ระยะบรรทัด">
                  {[1, 1.15, 1.35, 1.5, 1.75, 2].map((v) => <option key={v} value={String(v)}>บรรทัด {v}</option>)}
                </select>
                <select value={String(t0.letterSpacing ?? 0)} onChange={(e) => patchSel(textSel, { letterSpacing: Number(e.target.value) || undefined })} className={cn(mini, "w-[104px] h-7")} title="ระยะห่างตัวอักษร">
                  {[-0.5, 0, 0.5, 1, 2, 3].map((v) => <option key={v} value={String(v)}>ตัวอักษร {v > 0 ? "+" : ""}{v}</option>)}
                </select>
              </div>
            </div>
          </RGroup>
          <RGroup label="กล่องข้อความ">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1"><span className="text-[11px] text-white/50 w-8">พื้น</span>{colorChips(t0.bg, (v) => patchSel(textSel, { bg: v }), "ไม่มี")}</div>
              <div className="flex items-center gap-1"><span className="text-[11px] text-white/50 w-8">กรอบ</span>{colorChips(t0.border, (v) => patchSel(textSel, { border: v }), "ไม่มี")}</div>
            </div>
            <select value={String(t0.pad ?? "")} onChange={(e) => patchSel(textSel, { pad: e.target.value === "" ? undefined : Number(e.target.value) })} className={cn(mini, "w-[92px] h-7 self-center")} title="ระยะห่างขอบใน">
              <option value="">ขอบใน อัตโนมัติ</option>{[0, 2, 4, 6, 8, 12, 16].map((v) => <option key={v} value={String(v)}>ขอบใน {v}</option>)}
            </select>
          </RGroup>
        </>
      ) : null;
      case "fshape": return s0 ? (
        <>
          {s0.kind !== "line" && !["image", "logo", "stamp"].includes(s0.kind) && (
            <RGroup label="สไตล์รูปทรง">
              {SHAPE_PRESETS.map((p) => {
                const bg = resolveColor(p.style.bg, theme), bd = resolveColor(p.style.border, theme);
                return <button key={p.label} type="button" title={p.label} onClick={() => patchSel(shapeSel, (b) => { const n: Partial<FreeBlock> = { ...p.style }; if (!("dash" in p.style)) n.dash = b.dash; return n; })}
                  className="w-8 h-8 rounded-md hover:ring-2 ring-white/40" style={{ background: bg || "transparent", border: bd ? `2px ${p.style.dash || "solid"} ${bd}` : "1px solid rgba(255,255,255,0.15)" }} />;
              })}
            </RGroup>
          )}
          {!["image", "logo", "stamp"].includes(s0.kind) && (
            <RGroup label="สีและเส้น">
              <div className="flex flex-col gap-1">
                {s0.kind !== "line" && <div className="flex items-center gap-1"><span className="text-[11px] text-white/50 w-8">พื้น</span>{colorChips(s0.bg, (v) => patchSel(shapeSel, { bg: v }), "ไม่มี")}</div>}
                <div className="flex items-center gap-1"><span className="text-[11px] text-white/50 w-8">เส้น</span>{colorChips(s0.kind === "line" ? s0.color : s0.border, (v) => patchSel(shapeSel, (b) => (b.kind === "line" ? { color: v } : { border: v })), s0.kind === "line" ? undefined : "ไม่มี")}</div>
              </div>
              <div className="flex flex-col gap-1">
                <select value={String(s0.kind === "line" ? Math.min(s0.w, s0.h) : s0.borderWidth ?? 1)} onChange={(e) => { const v = Number(e.target.value); patchSel(shapeSel, (b) => (b.kind === "line" ? (b.h > b.w ? { w: v } : { h: v }) : { borderWidth: v })); }} className={cn(mini, "w-[96px] h-7")} title="ความหนาเส้น">
                  {[...new Set([0.5, 0.75, 1, 1.5, 2, 3, 4, 6, s0.kind === "line" ? Math.min(s0.w, s0.h) : s0.borderWidth ?? 1])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>เส้น {v} pt</option>)}
                </select>
                <select value={s0.dash || "solid"} onChange={(e) => patchSel(shapeSel, { dash: e.target.value === "solid" ? undefined : (e.target.value as any) })} className={cn(mini, "w-[96px] h-7")} title="รูปแบบเส้น">
                  <option value="solid">เส้นทึบ</option><option value="dashed">เส้นประ</option><option value="dotted">เส้นจุด</option>
                </select>
              </div>
            </RGroup>
          )}
          {(s0.kind === "rect" || s0.kind === "shape") && (
            <RGroup label="รูปทรง · มุม">
              <RIcon title="สี่เหลี่ยม" on={s0.kind === "rect"} onClick={() => patchSel(shapeSel, () => ({ kind: "rect", shape: undefined }))}><Square size={15} /></RIcon>
              <RIcon title="วงกลม/วงรี" on={s0.kind === "shape" && s0.shape !== "triangle"} onClick={() => patchSel(shapeSel, () => ({ kind: "shape", shape: "ellipse", radii: undefined }))}><Circle size={15} /></RIcon>
              <RIcon title="สามเหลี่ยม" on={s0.shape === "triangle"} onClick={() => patchSel(shapeSel, () => ({ kind: "shape", shape: "triangle", radii: undefined }))}><Triangle size={15} /></RIcon>
              {s0.kind === "rect" && (
                <select value={String(s0.radii ? "x" : s0.radius ?? 0)} onChange={(e) => e.target.value !== "x" && patchSel(shapeSel, { radius: Number(e.target.value), radii: undefined })} className={cn(mini, "w-[92px] h-7")} title="มุมโค้ง (ปรับแยกมุมที่แผงขวา)">
                  {s0.radii && <option value="x">แยกแต่ละมุม</option>}
                  {[0, 2, 4, 8, 12, 20, 30].map((v) => <option key={v} value={String(v)}>{v ? `โค้ง ${v}` : "เหลี่ยม"}</option>)}
                </select>
              )}
            </RGroup>
          )}
          <RGroup label={`ความทึบ ${Math.round((s0.opacity ?? 1) * 100)}%`}>
            <input type="range" min={10} max={100} step={5} value={Math.round((s0.opacity ?? 1) * 100)} onChange={(e) => { const v = Number(e.target.value) / 100; patchSel(shapeSel, { opacity: v >= 1 ? undefined : v }); }} className="w-[110px] accent-[#0d9488]" />
          </RGroup>
          <RGroup label="ลำดับชั้น">
            <RIcon title="บนสุด" disabled={multi} onClick={() => primary && zEnd(primary, "front")}><ArrowUpToLine size={16} /></RIcon>
            <RIcon title="ล่างสุด" disabled={multi} onClick={() => primary && zEnd(primary, "back")}><ArrowDownToLine size={16} /></RIcon>
          </RGroup>
        </>
      ) : null;
      default: return null;
    }
  })();
  const ribbon = (
    <div className="rounded-xl border border-white/10 bg-[#141418]">
      <div className="flex items-center gap-0.5 px-1.5 pt-1 border-b border-white/10">
        <RIcon title="ย้อนกลับ (Ctrl+Z)" disabled={!history.canUndo || !canEdit} onClick={undo}><Undo2 size={14} /></RIcon>
        <RIcon title="ทำซ้ำ (Ctrl+Y)" disabled={!history.canRedo || !canEdit} onClick={redo}><Redo2 size={14} /></RIcon>
        <span className="w-px h-4 bg-white/10 mx-1" />
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => { setRtab(t.id); if (!ui.ribbon) setUiPart({ ribbon: true }); }}
            className={cn("h-8 px-3 text-[12.5px] border-b-2 -mb-px", rtab === t.id && ui.ribbon ? (t.ctx ? "border-purple-400 text-purple-200 font-bold" : "border-nexus-teal text-white font-bold") : t.ctx ? "border-transparent text-purple-200/80 hover:text-purple-100" : "border-transparent text-white/60 hover:text-white")}>{t.label}</button>
        ))}
        <span className="ml-auto text-[11.5px] text-white/40 pr-1 hidden xl:inline">{selected.length ? `เลือก ${selected.length} กล่อง · Ctrl+คลิก เลือกเพิ่ม/ลด` : "คลิกกล่องเพื่อแก้ · ลากคลุมเพื่อเลือกหลายกล่อง"}</span>
        <RIcon title={ui.ribbon ? "ย่อแถบเครื่องมือ (เหลือชื่อแท็บ)" : "ขยายแถบเครื่องมือ"} onClick={() => setUiPart({ ribbon: !ui.ribbon })}>{ui.ribbon ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</RIcon>
      </div>
      {ui.ribbon && <div className="flex items-stretch overflow-x-auto px-1 py-1.5">{ribbonBody || <p className="text-[12px] text-white/45 px-3 py-4">เลือกกล่องบนกระดาษก่อน</p>}</div>}
    </div>
  );

  // ---------- แผงขวา: ไม่ได้เลือก = ทั้งหน้า · เลือก = ตั้งค่ากล่องนั้น ----------
  const problems = legal.filter((l) => !l.ok).length + issues.length;
  const pagePanel = (
    <div className="space-y-3">
      <p className="text-[12px] text-white/55 leading-relaxed">คลิกกล่องบนกระดาษเพื่อแก้ (แถบเครื่องมือจะขึ้นเหนือกล่อง) · ลากเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด · ดับเบิลคลิกข้อความเพื่อพิมพ์ · ลากคลุมพื้นที่ว่างเพื่อเลือกหลายกล่อง</p>
      {!letterOnly && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-bold text-white">ข้อมูลที่แสดงในเอกสารนี้</p>
          <DataChecklist groups={groups} onToggle={toggle} canEdit={canEdit} />
        </div>
      )}
      {bodyOn && (
        <Field label={`ขอบกระดาษ ${margin} pt (เส้นประสีฟ้า · จัดชิดขอบ/ดูดติดตามเส้นนี้)`}>
          <input type="range" min={0} max={80} step={2} value={margin} disabled={!canEdit} onChange={(e) => commitLayout({ ...layout, margin: Number(e.target.value) })} className="w-full accent-[#0d9488] h-8" />
        </Field>
      )}
      <p className="text-[11px] text-white/40 -mt-1">เลือกหลายกล่อง: ลากคลุมบนพื้นกระดาษ หรือกด Ctrl ค้างแล้วคลิกทีละกล่อง แล้วใช้ปุ่ม &quot;เรียงเว้นระยะ&quot; บนแถบเครื่องมือ</p>
      {letterhead && (
        <Field label="ความสูงหัวกระดาษ (pt)">
          <PillInput inputMode="decimal" value={letterhead.height} disabled={!canEdit} onChange={(e) => commitHead({ ...letterhead, height: Math.max(40, Math.min(320, Number(e.target.value.replace(/[^\d.]/g, "")) || 40)) })} className="h-8 w-full text-sm font-mono text-right" />
        </Field>
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
        {leftBar}
        {/* กระดาษ A4: ภาพหน้าจริง + กล่องที่ลากได้ */}
        <div ref={wrapRef} className="flex-1 min-w-0 w-full overflow-auto max-h-[calc(100vh-96px)] rounded-lg pt-12">
          <div className="relative" style={{ paddingLeft: ui.ruler ? 18 : 0, paddingTop: ui.ruler ? 18 : 0, width: A4.w * S + (ui.ruler ? 18 : 0) }}>
          {ui.ruler && (
            <>
              <div className="absolute left-0 top-0 w-[18px] h-[18px] bg-[#1b1b20] border-r border-b border-white/10" title="ไม้บรรทัด (ซม.)" />
              <Ruler axis="x" S={S} hl={selected.length ? [Math.min(...selected.map((i) => i.b.x)), Math.max(...selected.map((i) => i.b.x + i.b.w))] : null} />
              <Ruler axis="y" S={S} hl={selected.length ? [Math.min(...selected.map((i) => i.b.y)), Math.max(...selected.map((i) => i.b.y + i.b.h))] : null} />
            </>
          )}
          <div className="relative" style={{ width: A4.w * S, height: A4.h * S }}>
          <div ref={paperRef} onDragOver={(e) => { if (e.dataTransfer.types.includes("text/nexus-kind")) e.preventDefault(); }} onDrop={dropAt}
            className={cn("relative bg-white rounded-sm shadow-2xl overflow-hidden select-none", tool !== "select" && "cursor-crosshair")} style={{ width: A4.w * S, height: A4.h * S }}
            onPointerDown={(e) => {
              setInfoMenu(false); setRestartOpen(false);
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
            {(showGrid || moving) && <div className="absolute pointer-events-none z-[5] border border-dashed border-sky-400/40" style={{ left: margin * S, top: margin * S, right: margin * S, bottom: margin * S }} />}
            {/* ตัวอย่างขณะวาด */}
            {draft && (tool === "line" ? (() => {
              const horiz = Math.abs(draft.x1 - draft.x0) >= Math.abs(draft.y1 - draft.y0);
              return <div className="absolute z-30 pointer-events-none bg-[#0d9488]" style={horiz
                ? { left: Math.min(draft.x0, draft.x1) * S, top: draft.y0 * S - 1, width: Math.abs(draft.x1 - draft.x0) * S, height: 2 }
                : { left: draft.x0 * S - 1, top: Math.min(draft.y0, draft.y1) * S, width: 2, height: Math.abs(draft.y1 - draft.y0) * S }} />;
            })() : <div className="absolute z-30 pointer-events-none border-2 border-[#0d9488] bg-[#0d9488]/5" style={{ left: Math.min(draft.x0, draft.x1) * S, top: Math.min(draft.y0, draft.y1) * S, width: Math.abs(draft.x1 - draft.x0) * S, height: Math.abs(draft.y1 - draft.y0) * S }} />)}
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
              const frame = b.kind === "rect";
              const fresh = !o;
              return (
                <div key={it.key} onPointerDown={(e) => start(e, it, "move")} onDoubleClick={(e) => { e.stopPropagation(); setSel([it.key]); if (b.kind === "text" && canEdit) setEditing(it.key); }}
                  className={cn("absolute group", canEdit ? "cursor-move" : "cursor-pointer",
                    // กรอบ/เส้น/รูป อยู่ชั้นล่างของการคลิก — คลิกข้อมูลที่อยู่ในกรอบได้ · กรอบเลือกที่ขอบ
                    on ? "outline outline-2 outline-[#0d9488] z-20" : cn("outline outline-1 outline-dashed outline-transparent hover:outline-slate-400", ["rect", "shape", "line", "image"].includes(b.kind) ? "z-[8]" : "z-10"),
                    frame && "pointer-events-none",
                    fresh && !on && "outline-slate-300",
                    ghost && (b.kind === "line" ? "bg-[#0d9488]/70" : frame ? "border-2 border-dashed border-[#0d9488]" : "bg-[#0d9488]/10 border border-dashed border-[#0d9488]/70"))}
                  style={{
                    // เส้นบาง: ขยายพื้นที่คลิกเป็นอย่างน้อย 8px รอบเส้น
                    ...(b.kind === "line"
                      ? (b.h > b.w ? { left: b.x * S - Math.max(0, (8 - b.w * S) / 2), top: b.y * S, width: Math.max(8, b.w * S), height: b.h * S } : { left: b.x * S, top: b.y * S - Math.max(0, (8 - b.h * S) / 2), width: b.w * S, height: Math.max(8, b.h * S) })
                      : { left: b.x * S, top: b.y * S, width: b.w * S, height: Math.max(2, b.h * S) }),
                    ...(moved ? { backgroundImage: `url(${image!.url})`, backgroundSize: `${A4.w * S}px ${A4.h * S}px`, backgroundPosition: `${-o!.x * S}px ${-o!.y * S}px`, backgroundRepeat: "no-repeat" } : {}),
                  }}>
                  <span className={cn("absolute -top-[17px] left-0 px-1.5 rounded-t text-[10px] leading-[17px] whitespace-nowrap pointer-events-none",
                    it.zone === "head" ? "bg-purple-600 text-white" : "bg-[#0d9488] text-white", on && !multi ? "block" : "hidden group-hover:block")}>
                    {BLOCK_LABELS[b.kind]}{b.kind === "field" ? ` · ${fieldOptions.find((f) => f.key === b.field)?.label || ""}` : b.kind === "info" && b.fields?.length ? ` · ${fieldLabel(b.fields[0])}` : ""}{isLocked(it) ? " 🔒" : ""}{it.zone === "head" ? " · หัวกระดาษ" : ""}
                  </span>
                  {fresh && b.kind === "text" && <div className="px-1 text-[10px] text-slate-500 pointer-events-none">{b.text}</div>}
                  {ghost && !frame && b.kind !== "line" && <div className="px-1 text-[10px] text-[#0f766e] pointer-events-none truncate">{nameOf(b)}</div>}
                  {frame && (["top-0 left-0 right-0 h-[6px] -mt-[3px]", "bottom-0 left-0 right-0 h-[6px] -mb-[3px]", "top-0 bottom-0 left-0 w-[6px] -ml-[3px]", "top-0 bottom-0 right-0 w-[6px] -mr-[3px]"] as const).map((pos) => (
                    <div key={pos} onPointerDown={(e) => start(e, it, "move")} className={cn("absolute pointer-events-auto", pos)} />
                  ))}
                  {on && !multi && canEdit && <div onPointerDown={(e) => start(e, it, "size")} className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm bg-[#0d9488] cursor-se-resize pointer-events-auto" />}
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
          {floatingBar}
          {inlineEditor}
          </div>
          </div>
        </div>

        {/* แผงขวา (รูปแบบ): ตั้งค่าของกล่องที่เลือก — ย่อเป็นแถบแคบได้ */}
        {!ui.right ? (
          <button type="button" onClick={() => setUiPart({ right: true })} title="ขยายแผงรูปแบบ"
            className="flex-shrink-0 lg:sticky lg:top-16 w-full lg:w-[34px] h-10 lg:h-[160px] rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/10 flex lg:flex-col items-center justify-center gap-1.5 text-white/70">
            <PanelRightOpen size={15} /><span className="text-[11.5px] lg:[writing-mode:vertical-rl]">รูปแบบ{problems ? ` · ควรแก้ ${problems}` : ""}</span>
          </button>
        ) : (
        <GlassCard className="p-3 w-full lg:w-[330px] flex-shrink-0 space-y-3 lg:sticky lg:top-16 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pb-14">
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
          {multi ? <p className="text-[12.5px] text-white/70">เลือก {selected.length} กล่อง — ลากเพื่อย้ายพร้อมกัน หรือใช้แถบเครื่องมือเหนือกล่องเพื่อจัดแนว</p>
            : primary ? (
              <div className="space-y-2">
                <button type="button" onClick={() => setSel([])} className="text-[12px] text-white/50 hover:text-white flex items-center gap-1"><ChevronLeft size={13} /> ทั้งหน้า</button>
                {props(primary)}
              </div>
            ) : pagePanel}
        </GlassCard>
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
