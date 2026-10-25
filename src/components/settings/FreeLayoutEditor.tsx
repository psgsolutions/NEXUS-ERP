"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlertTriangle, AlignVerticalDistributeCenter, ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, CheckCircle2, Copy, CopyPlus, Database, Eye, ImagePlus, ListChecks, Loader2, Lock, Magnet, Minus, MousePointer2,
  Group as GroupIcon, Pin, PinOff, Redo2, Split, Square, Trash2, Undo2, Ungroup,
} from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import type { DocumentModel } from "@/lib/documents/model";
import {
  A4, BLOCK_LABELS, BLOCK_PARTS, COLOR_TOKENS, FONT_SCALE, HEAD_KINDS, requiredSatisfied, resolveColor, ITEM_COLUMNS, TEMPLATES, TEXT_BLOCKS, TEXT_VARIABLES, legalFieldVisible, addableBlocksFor, defaultFreeLayout, docHasAmounts, requiredBlocksFor, requiredColumnsFor, resolveDesign,
  type BlockKind, type DocTheme, type FreeBlock, type FreeLayout, type ItemColumn, type Letterhead, type PerDocDesign,
} from "@/lib/documents/design";
import { templateLayout } from "@/lib/documents/layout-templates";
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
const ALIGNABLE: BlockKind[] = ["seller", "title", "meta", "field", "text", "words", "notes", "payment"];
type Zone = "head" | "doc";
type Item = { key: string; zone: Zone; b: FreeBlock };
type Guides = { x: number[]; y: number[] };
type Place = "hidden" | "meta" | "separate";

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

/** ขั้นตอนสร้างฟอร์ม (กดเพื่อไปยังแท็บที่เกี่ยวข้อง) */
const STEPS = [
  { title: "เลือกแม่แบบ", hint: "แท็บ \"แม่แบบ\": คลิกแม่แบบเพื่อลองดูบนกระดาษ ถูกใจกด \"ใช้แม่แบบนี้\" — ใช้กับทุกเอกสารของบริษัท ปรับสีได้ที่แท็บ \"หน้าตา\"" },
  { title: "เลือกข้อมูลที่แสดง", hint: "แท็บ \"ข้อมูล\": ติ๊กข้อมูลที่ต้องการแสดง ทุกช่องดึงจากฐานข้อมูลเอง (บริษัท ลูกค้า รายการ ยอดเงิน) ไม่ต้องพิมพ์ค่าลงกระดาษ" },
  { title: "จัดตำแหน่งและแต่ง", hint: "คลิกหัวข้อบนกระดาษแล้วลากย้าย/ปรับขนาด วาดเส้นหรือกรอบจากแถบเครื่องมือ แต่งตัวอักษร สี มุม ที่แท็บ \"แก้ไข\" · Ctrl+Z ย้อนกลับได้เสมอ" },
  { title: "ตรวจและบันทึก", hint: "แท็บ \"ตรวจ\": ระบบหาหัวข้อทับกัน ชิดขอบ หรือขาดข้อมูลที่กฎหมายกำหนด คลิกเพื่อไปแก้ แล้วกด \"บันทึก\" (Ctrl+S) ด้านบน" },
];
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

/** ตำแหน่งที่ใกล้ที่สุดในระยะดูด */
function nearest(values: number[], targets: number[]): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const v of values) for (const t of targets) { const d = t - v; if (Math.abs(d) <= SNAP_PT && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: t }; }
  return best;
}

export function FreeLayoutEditor({ docType, theme, layout, onChange, letterhead, onLetterheadChange, letterOnly, model, canEdit, docTitle, defaultColumns, defaultSignatures, docMeta, docFields, history, panelTabs, per, onPer, hint }: {
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
  /** แท็บเพิ่มของแผงขวา (แม่แบบ · หน้าตา) วางก่อนแท็บแก้ไข/ข้อมูล/ตรวจ */
  panelTabs: { id: string; label: string; content: React.ReactNode }[];
  /** ค่าเฉพาะเอกสารนี้ (คอลัมน์/ช่องลงนามตอนจัดหน้าอัตโนมัติ) */
  per: PerDocDesign; onPer: (patch: Partial<PerDocDesign>) => void;
  /** แถบข้อความเหนือกระดาษ (เช่น กำลังลองแม่แบบ) */
  hint?: React.ReactNode;
}) {
  const font = theme.font;
  const [sel, setSel] = useState<string[]>([]);
  const firstTab = panelTabs[0]?.id || "block";
  const [tab, setTab] = useState<string>(!letterOnly && layout.enabled ? "block" : firstTab);
  /** ขั้นตอน 4 ขั้น ผูกกับแท็บ: แม่แบบ → ข้อมูล → แก้ไข → ตรวจ */
  const step = tab === "data" ? 2 : tab === "block" || tab === "look" ? 3 : tab === "check" ? 4 : 1;
  const goStep = (n: number) => setTab(n === 2 ? "data" : n === 3 ? "block" : n === 4 ? "check" : firstTab);
  // วิธีใช้ 4 ขั้น: พับเก็บได้ (จำไว้ในเครื่อง)
  const [stepsOpen, setStepsOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("nexus.designer.steps") === "0") setStepsOpen(false); } catch { /* ไม่มีที่เก็บก็แสดงตามปกติ */ } }, []);
  const toggleSteps = (open: boolean) => { setStepsOpen(open); try { localStorage.setItem("nexus.designer.steps", open ? "1" : "0"); } catch { /* ไม่เป็นไร */ } };
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
    const ro = new ResizeObserver(([e]) => setFitS(Math.round(Math.min(2.4, Math.max(0.8, (e.contentRect.width - 4) / A4.w)) * 20) / 20));
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
    const xs = [MARGIN, A4.w / 2, A4.w - MARGIN], ys = [30, A4.h / 2, A4.h - 30, ...(letterhead ? [letterhead.height] : [])];
    for (const i of items) if (!exclude.has(i.key)) { xs.push(i.b.x, i.b.x + i.b.w / 2, i.b.x + i.b.w); ys.push(i.b.y, i.b.y + i.b.h / 2, i.b.y + i.b.h); }
    return { xs, ys };
  };
  /** free = วางอิสระ (ปิดดูดติด หรือกด Alt ค้าง) — ปัดแค่ 0.1pt */
  const toGrid = (v: number, free = !snapOn) => (free ? Math.round(v * 10) / 10 : Math.round(v / grid) * grid);

  useEffect(() => {
    const move = (e: PointerEvent) => {
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
        if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); } else if (k === "d") { e.preventDefault(); duplicate(); }
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
    setTab("block");
    setTool("select");
  };

  const start = (e: React.PointerEvent, it: Item, mode: "move" | "size") => {
    if (tool !== "select") return; // โหมดวาด: ให้กระดาษรับการลากแทน
    e.stopPropagation();
    let next = sel;
    const members = groupOf(it);
    if (e.shiftKey && mode === "move") next = sel.includes(it.key) ? sel.filter((k) => !members.includes(k)) : [...sel, ...members.filter((k) => !sel.includes(k))];
    else if (mode === "size") next = [it.key];
    else if (!sel.includes(it.key)) next = members; // คลิกสมาชิกกลุ่ม = เลือกทั้งกลุ่ม (ดับเบิลคลิกเพื่อแก้กล่องเดียว)
    setSel(next);
    setTab("block");
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
    const L = multi ? Math.min(...list.map((b) => b.x)) : MARGIN, R = multi ? Math.max(...list.map((b) => b.x + b.w)) : A4.w - MARGIN;
    const T0 = multi ? Math.min(...list.map((b) => b.y)) : 30, B0 = multi ? Math.max(...list.map((b) => b.y + b.h)) : A4.h - 30;
    applyMany(new Map(selected.map((i) => {
      const b = i.b;
      const pos = how === "left" ? { x: L } : how === "right" ? { x: R - b.w } : how === "hcenter" ? { x: (L + R) / 2 - b.w / 2 }
        : how === "top" ? { y: T0 } : how === "bottom" ? { y: B0 - b.h } : { y: (T0 + B0) / 2 - b.h / 2 };
      return [i.key, { ...b, ...pos }];
    })));
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
  const sameSize = (dim: "w" | "h") => { if (primary && multi) applyMany(new Map(selected.map((i) => [i.key, { ...i.b, [dim]: primary.b[dim] }]))); };

  // ---------- เพิ่ม/ย้ายกล่อง ----------
  const addZone: Zone = letterOnly || !bodyOn ? "head" : "doc";
  const addable = (letterOnly ? HEAD_KINDS.filter((k) => k !== "title" && k !== "meta") : !bodyOn ? HEAD_KINDS : addableBlocksFor(docType)).filter((k) => !SINGLE.includes(k) || !items.some((i) => i.b.kind === k));
  const newBlock = (kind: BlockKind, extra: Partial<FreeBlock> = {}): FreeBlock => {
    const id = `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
    const def = defaultFreeLayout(docType, font).blocks.find((b) => b.kind === kind);
    const size: Record<string, [number, number]> = { text: [200, 24], line: [300, 1.5], rect: [200, 80], image: [120, 80], logo: [64, 64], field: [180, 18] };
    const [w, h] = def ? [def.w, def.h] : size[kind] || [200, 40];
    return { id, kind, x: def?.x ?? 60, y: def?.y ?? (addZone === "head" ? 30 : 160), w, h, ...(kind === "text" ? { text: "ข้อความ {{number}}", fontSize: 10 } : {}), ...(kind === "field" ? { field: "number" } : {}), ...extra };
  };
  const add = (kind: BlockKind) => { const b = newBlock(kind); applyMany(new Map(), [{ zone: addZone, b }]); setSel([`${addZone === "head" ? "h" : "d"}:${b.id}`]); setTab("block"); };
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
  const placeOf = (key: string): Place => {
    if (items.some((i) => i.b.kind === "field" && i.b.field === key)) return "separate";
    if (!meta) return "hidden";
    const inMeta = key.startsWith("f:") ? (meta.b.fields || []).includes(key) : !(meta.b.hide || []).includes(key);
    return inMeta ? "meta" : "hidden";
  };
  const setPlace = (key: string, place: Place) => {
    const next = new Map<string, FreeBlock | null>();
    const adds: { zone: Zone; b: FreeBlock }[] = [];
    for (const i of items) if (i.b.kind === "field" && i.b.field === key && place !== "separate") next.set(i.key, null);
    if (meta) {
      const hide = new Set(meta.b.hide || []), fields = new Set(meta.b.fields || []);
      if (key.startsWith("f:")) { if (place === "meta") fields.add(key); else fields.delete(key); }
      else if (place === "meta") hide.delete(key); else hide.add(key);
      next.set(meta.key, { ...meta.b, hide: [...hide], fields: [...fields] });
    }
    if (place === "separate" && !items.some((i) => i.b.kind === "field" && i.b.field === key)) {
      const count = items.filter((i) => i.b.kind === "field").length;
      const anchor = meta?.b;
      adds.push({ zone: meta?.zone || addZone, b: newBlock("field", { field: key, x: anchor?.x ?? 360, y: Math.min(A4.h - 20, (anchor ? anchor.y + anchor.h + 4 : 150) + count * 20), w: anchor?.w ?? 200, h: 18 }) });
    }
    applyMany(next, adds);
  };
  const togglePart = (kind: BlockKind, part: string, show: boolean) => {
    const it = firstOf(kind);
    if (!it) return;
    const hide = new Set(it.b.hide || []);
    if (show) hide.delete(part); else hide.add(part);
    update(it, { hide: [...hide] });
  };
  const partShown = (kind: BlockKind, part: string) => { const it = firstOf(kind); return !!it && !(it.b.hide || []).includes(part); };
  const presence = (kind: BlockKind, on: boolean) => {
    if (on) { if (!firstOf(kind)) applyMany(new Map(), [{ zone: addZone, b: newBlock(kind) }]); }
    else applyMany(new Map(items.filter((i) => i.b.kind === kind).map((i) => [i.key, null])));
  };
  const totalRows = (model?.totals || []).filter((r) => !r.strong && !r.label.startsWith("ภาษีมูลค่าเพิ่ม") && r.label !== "จำนวนเงินรวมทั้งสิ้น");

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
  const placeSelect = (k: string, locked: boolean) => (
    <div className="w-[128px] flex-shrink-0">
      <PillSelect value={placeOf(k) === "hidden" && locked ? "meta" : placeOf(k)} disabled={!canEdit || !meta} onChange={(e) => setPlace(k, e.target.value as Place)} className="h-7 w-full text-[12px]">
        {!locked && <option value="hidden">ไม่แสดง</option>}
        <option value="meta">ในกล่องเลขที่</option>
        <option value="separate">กล่องแยก</option>
      </PillSelect>
    </div>
  );
  const check = (label: string, checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <PillCheckbox key={label} label={label} checked={checked} disabled={disabled || !canEdit} onChange={(e) => onChange(e.target.checked)} />
  );

  const textRef = useRef<HTMLTextAreaElement>(null);
  const variables = [...TEXT_VARIABLES, ...docMeta.map((l) => ({ key: `m:${l}`, label: l, source: docTitle })), ...docFields.map((f) => ({ key: `f:${f.key}`, label: f.label, source: docTitle }))];

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
            {parts.map((p) => (
              <PillCheckbox key={p.key} label={p.label} checked={!hide.has(p.key)} onChange={(e) => update(it, { hide: e.target.checked ? [...hide].filter((k) => k !== p.key) : [...hide, p.key] })} />
            ))}
            {(b.kind === "seller" || b.kind === "party") && <p className="text-[11px] text-white/40">ชื่อ ที่อยู่ เลขผู้เสียภาษี แสดงเสมอ (กฎหมายกำหนด)</p>}
          </div>
        )}
        {(b.kind === "meta" || b.kind === "totals") && (
          <button type="button" onClick={() => setTab("data")} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1"><ListChecks size={13} /> เลือกแถวที่แสดงในแท็บ &quot;ข้อมูลในเอกสาร&quot;</button>
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
            <button type="button" onClick={() => setTab("data")} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1"><ListChecks size={13} /> ตั้งชื่อช่องลงนามที่แท็บ &quot;ข้อมูล&quot;</button>
            <Field label={`ระยะห่างระหว่างช่อง ${b.gap ?? 16} pt (เว้นกลางวางโลโก้/ตราประทับได้)`}>
              <input type="range" min={0} max={300} step={2} value={b.gap ?? 16} onChange={(e) => update(it, { gap: Number(e.target.value) })} className="w-full accent-[#0d9488] h-8" />
            </Field>
          </>
        )}

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
            <Field label={`มุม ${b.radius === undefined ? "ตามแม่แบบ" : b.radius === 0 ? "เหลี่ยม" : `โค้ง ${b.radius} pt`}`}>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={30} step={1} value={b.radius ?? (theme.rounded ? 4 : 0)} onChange={(e) => update(it, { radius: Number(e.target.value) })} className="flex-1 accent-[#0d9488] h-8" />
                <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => update(it, { radius: 0 })}>เหลี่ยม</button>
                {b.radius !== undefined && <button type="button" className="text-[11px] text-white/50 hover:text-white" onClick={() => unset(it, "radius")}>ตามแม่แบบ</button>}
              </div>
            </Field>
            {["items", "totals", "party", "words"].includes(b.kind) && <p className="text-[11px] text-white/40">มุมใช้กับกรอบตาราง/ยอดรวม/ลูกค้าภายในกล่องด้วย</p>}
          </div>
        )}

        {letterhead && !letterOnly && HEAD_KINDS.includes(b.kind) && (
          <PillCheckbox label="อยู่ในหัวกระดาษ (ใช้ร่วมกับเอกสารที่ใช้หัวนี้)" checked={it.zone === "head"} onChange={() => moveZone(it)} />
        )}
        {canEdit && SPLITTABLE.includes(b.kind) && (
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-2.5 space-y-1.5">
            <p className="text-[11.5px] text-white/65 leading-relaxed">ต้องการจัดวางหัวข้อในกล่องนี้เอง (เช่น ย้ายที่อยู่ไปอีกฝั่ง)? แยกเป็นช่องย่อยแล้วลากแต่ละหัวข้อได้อิสระ ข้อมูลยังดึงจากฐานข้อมูลเหมือนเดิม</p>
            <PillButton variant="glass" className="h-8 px-3 text-xs w-full" onClick={() => splitBlock(it)}><Split size={13} /> แยกหัวข้อเป็นกล่องย่อย</PillButton>
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

  const itemsBlock = firstOf("items");
  const totalsBlock = firstOf("totals");
  const itemCols = itemsBlock?.b.cols?.length ? itemsBlock.b.cols : defaultColumns;
  const autoCols = (defaultColumns as ItemColumn[]);
  const sigInput = (value: string[], onSet: (v: string[] | undefined) => void) => (
    <PillInput value={value.join(", ")} placeholder={defaultSignatures.join(", ")} disabled={!canEdit}
      onChange={(e) => { const l = e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 4); onSet(l.length ? l : undefined); }} className="h-8 w-full text-sm" />
  );
  const dataPanel = !bodyOn ? (
    <div className="space-y-2.5">
      <Group title="ตารางรายการ" source="ดึงจาก รายการสินค้า/บริการในเอกสาร">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {ITEM_COLUMNS.filter((c) => ["code", "unit", "discount", "price"].includes(c.key) || autoCols.includes(c.key)).map((c) => check(c.label, autoCols.includes(c.key) || (!["code", "unit", "discount", "price"].includes(c.key)),
            (v) => onPer({ hideColumns: v ? (per.hideColumns || []).filter((k) => k !== c.key) : [...(per.hideColumns || []), c.key] }), !["code", "unit", "discount", "price"].includes(c.key)))}
        </div>
      </Group>
      <Group title="ช่องลงนาม" source="ชื่อช่อง คั่นด้วย , (สูงสุด 4 ช่อง)">
        {sigInput(per.signatures || [], (v) => onPer({ signatures: v }))}
      </Group>
      <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-2.5 text-[12px] text-white/65 leading-relaxed space-y-1.5">
        <p>เลือกหัวข้ออื่น (เลขที่/วันที่ แถวข้อมูล ผู้ติดต่อ แถวยอดเงิน ฯลฯ) ได้เมื่อจัดตำแหน่งเอง</p>
        {canEdit && <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => commitLayout(layout.blocks.length ? { ...layout, enabled: true } : { ...defaultFreeLayout(docType, font, docMeta), enabled: true })}>เริ่มจัดตำแหน่งเอง</PillButton>}
      </div>
    </div>
  ) : (
    <div className="space-y-2.5 max-h-[760px] overflow-y-auto pr-1">
      <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-2.5 text-[11.5px] text-white/65 leading-relaxed">
        <p className="font-bold text-sky-200 flex items-center gap-1"><Database size={12} /> ทุกช่องเชื่อมฐานข้อมูลอัตโนมัติ</p>
        ติ๊กเฉพาะข้อมูลที่ต้องการแสดง ตอนพิมพ์ระบบเติมข้อมูลจริงของเอกสารนั้นให้เอง ไม่ต้องพิมพ์ค่าลงผัง · เลขที่/วันที่/แถวข้อมูล เลือกให้อยู่ในกล่องเลขที่ หรือแยกเป็นกล่องลากวางเองได้ · 🔒 กฎหมายกำหนด
      </div>
      <Group title="ข้อมูลเอกสาร" source={`ดึงจาก ${docTitle} ที่บันทึกในระบบ`}>
        <p className="text-[12px] text-white/50">ชื่อเอกสาร 🔒</p>
        {check("ชื่อภาษาอังกฤษ", partShown("title", "en"), (v) => togglePart("title", "en", v), !firstOf("title"))}
        {check("ป้ายต้นฉบับ/สำเนา", partShown("title", "copy"), (v) => togglePart("title", "copy", v), !firstOf("title"))}
        {fieldOptions.map((o) => (
          <div key={o.key} className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-white/80 truncate">{o.label}{o.key === "number" || o.key === "date" ? " 🔒" : ""}</span>
            {placeSelect(o.key, o.key === "number" || o.key === "date")}
          </div>
        ))}
      </Group>
      <Group title="ผู้ขาย (บริษัท)" source="ดึงจาก ตั้งค่า › ข้อมูลนิติบุคคล">
        {check("โลโก้", !!firstOf("logo"), (v) => presence("logo", v))}
        {check("ชื่อภาษาอังกฤษ", partShown("seller", "nameEn"), (v) => togglePart("seller", "nameEn", v))}
        {check("โทร · อีเมล · เว็บไซต์", partShown("seller", "contact"), (v) => togglePart("seller", "contact", v))}
        <p className="text-[11px] text-white/40">ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา 🔒</p>
      </Group>
      <Group title="ลูกค้า / คู่ค้า" source="ดึงจาก ลูกค้าที่เลือกในเอกสาร (ฐานข้อมูลลูกค้า)">
        {check("ชื่อผู้ติดต่อ", partShown("party", "contact"), (v) => togglePart("party", "contact", v))}
        {check("โทรศัพท์", partShown("party", "phone"), (v) => togglePart("party", "phone", v))}
        {check("อีเมล", partShown("party", "email"), (v) => togglePart("party", "email", v))}
        <p className="text-[11px] text-white/40">ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา 🔒</p>
      </Group>
      {itemsBlock && (
        <Group title="ตารางรายการ" source="ดึงจาก รายการสินค้า/บริการในเอกสาร">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {ITEM_COLUMNS.map((c) => check(c.label, itemCols.includes(c.key), (v) => update(itemsBlock, { cols: ITEM_COLUMNS.map((x) => x.key).filter((k) => (k === c.key ? v : itemCols.includes(k))) }), requiredColumnsFor(docType).includes(c.key)))}
          </div>
          {check("รายละเอียดใต้รายการ", partShown("items", "detail"), (v) => togglePart("items", "detail", v))}
          {check("หัวข้อหมวด", partShown("items", "heading"), (v) => togglePart("items", "heading", v))}
        </Group>
      )}
      {docHasAmounts(docType) && (
        <Group title="ยอดเงิน" source="คำนวณอัตโนมัติจากรายการ ส่วนลด และภาษี">
          {totalRows.map((r) => check(r.label, !!totalsBlock && !(totalsBlock.b.hide || []).includes(`t:${r.label}`),
            (v) => totalsBlock && update(totalsBlock, { hide: v ? (totalsBlock.b.hide || []).filter((k) => k !== `t:${r.label}`) : [...(totalsBlock.b.hide || []), `t:${r.label}`] }), !totalsBlock))}
          <p className="text-[11px] text-white/40">ภาษีมูลค่าเพิ่ม · ยอดรวมทั้งสิ้น 🔒 · แถวส่วนลด/หัก ณ ที่จ่าย แสดงเฉพาะเอกสารที่มี</p>
          {check("จำนวนเงินตัวอักษร", !!firstOf("words"), (v) => presence("words", v))}
        </Group>
      )}
      <Group title="ท้ายเอกสาร" source="หมายเหตุจากเอกสาร · บัญชีรับเงินจากข้อมูลนิติบุคคล">
        {check("หมายเหตุ", !!firstOf("notes"), (v) => presence("notes", v))}
        {check("ข้อมูลการชำระเงิน (บัญชีธนาคาร)", !!firstOf("payment"), (v) => presence("payment", v))}
        {check("ช่องลงนาม", !!firstOf("signatures"), (v) => presence("signatures", v))}
        {check("บรรทัดวันที่ใต้ลายเซ็น", partShown("signatures", "date"), (v) => togglePart("signatures", "date", v), !firstOf("signatures"))}
        {firstOf("signatures") && <Field label="ชื่อช่องลงนาม (คั่นด้วย , สูงสุด 4 ช่อง)">{sigInput(firstOf("signatures")!.b.labels || [], (v) => (v ? update(firstOf("signatures")!, { labels: v }) : unset(firstOf("signatures")!, "labels")))}</Field>}
      </Group>
    </div>
  );

  // ---------- ชั้นของกล่อง (บนสุดอยู่บน) ----------
  const nameOf = (b: FreeBlock) => `${BLOCK_LABELS[b.kind]}${b.kind === "field" ? ` · ${fieldOptions.find((f) => f.key === b.field)?.label || ""}` : b.kind === "text" ? ` · ${(b.text || "").slice(0, 18)}` : ""}`;
  const layersPanel = (
    <div className="space-y-1">
      <p className="text-[11.5px] text-white/45 mb-1">บนสุดอยู่บนรายการ · คลิกเพื่อเลือก · 📌 ล็อกตำแหน่ง</p>
      {[...items].reverse().map((it) => (
        <div key={it.key} className={cn("flex items-center gap-1.5 h-8 px-2 rounded-lg border text-[12px] cursor-pointer", sel.includes(it.key) ? "border-nexus-teal/50 bg-nexus-teal/10 text-white" : "border-transparent text-white/70 hover:bg-white/5")}
          onClick={(e) => { setSel(e.shiftKey ? (sel.includes(it.key) ? sel.filter((k) => k !== it.key) : [...sel, it.key]) : [it.key]); }}>
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
          <button key={i} type="button" onClick={() => { setSel(x.keys); setTab("block"); }} className="w-full text-left text-[12px] text-warning hover:text-white flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> <span>{x.text}</span>
          </button>
        ))}
      </Group>
      <p className="text-[11px] text-white/40">คลิกรายการเพื่อเลือกหัวข้อนั้น · เสร็จแล้วกด &quot;บันทึก&quot; (Ctrl+S) ด้านบน</p>
    </div>
  );

  const tabs = [...panelTabs.map((t) => ({ id: t.id, label: t.label })), { id: "block", label: "แก้ไข" }, ...(letterOnly ? [] : [{ id: "data", label: "ข้อมูล" }]), { id: "check", label: issues.length ? `ตรวจ (${issues.length})` : "ตรวจ" }];
  /** จัดหน้าอัตโนมัติ → คลิกบนกระดาษ: เปิดจัดตำแหน่งเอง (ผังเดิมหรือผังมาตรฐาน) แล้วเลือกหัวข้อที่คลิก */
  const convertAt = (e: React.PointerEvent) => {
    const r = paperRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
    const lay: FreeLayout = layout.blocks.length ? { ...layout, enabled: true } : { ...defaultFreeLayout(docType, font, docMeta), enabled: true };
    commitLayout(lay);
    const hit = lay.blocks.filter((b) => !headKinds.has(b.kind) && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    setSel(hit ? [`d:${hit.id}`] : []);
    setTab("block");
  };

  const gridPx = grid * S;
  const showGrid = gridMode === "always" || (gridMode === "drag" && moving);
  const can = canEdit && selected.length > 0;

  return (
    <div className="space-y-3">
      {hint}
      {/* วิธีใช้ 4 ขั้น (พับเก็บได้) */}
      {!letterOnly && stepsOpen && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {STEPS.map((st, i) => (
              <button key={st.title} type="button" onClick={() => goStep(i + 1)}
                className={cn("h-8 pl-1 pr-3 rounded-full text-[12.5px] flex items-center gap-1.5 border transition-colors", step === i + 1 ? "border-nexus-teal/60 bg-nexus-teal/15 text-white" : "border-white/10 text-white/55 hover:text-white")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold", step === i + 1 ? "bg-nexus-teal text-white" : "bg-white/10")}>{i + 1}</span>{st.title}
              </button>
            ))}
            <button type="button" onClick={() => toggleSteps(false)} className="ml-auto text-[11.5px] text-white/40 hover:text-white">ซ่อนวิธีใช้</button>
          </div>
          <p className="text-[12px] text-white/55 leading-relaxed">{STEPS[step - 1].hint}</p>
        </div>
      )}

      {/* แถบเครื่องมือ (กระทัดรัด): ย้อน/ทำซ้ำ · วาด/แทรก · จัดการกล่อง · จัดแนว · มุมมอง */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#111114]/95 backdrop-blur p-1.5">
        <ToolBtn title="ย้อนกลับ (Ctrl+Z)" disabled={!history.canUndo || !canEdit} onClick={undo}><Undo2 size={15} /></ToolBtn>
        <ToolBtn title="ทำซ้ำ (Ctrl+Y)" disabled={!history.canRedo || !canEdit} onClick={redo}><Redo2 size={15} /></ToolBtn>
        <Sep />
        <ToolBtn title="เลือก/ลากย้าย" on={tool === "select"} onClick={() => setTool("select")}><MousePointer2 size={15} /></ToolBtn>
        <ToolBtn title="วาดเส้น: ลากบนกระดาษ (แนวนอน/แนวตั้งตามทิศที่ลาก)" on={tool === "line"} disabled={!canEdit || (!bodyOn && !letterhead)} onClick={() => setTool(tool === "line" ? "select" : "line")}><Minus size={15} /></ToolBtn>
        <ToolBtn title="วาดกรอบ: ลากบนกระดาษ" on={tool === "rect"} disabled={!canEdit || (!bodyOn && !letterhead)} onClick={() => setTool(tool === "rect" ? "select" : "rect")}><Square size={15} /></ToolBtn>
        {canEdit && (letterhead || bodyOn) && (
          <div className="w-[150px]" title="เพิ่มหัวข้อใหม่บนกระดาษ">
            <PillSelect value="" onChange={(e) => e.target.value && add(e.target.value as BlockKind)} className="h-8 w-full text-[12px]">
              <option value="">+ เพิ่มหัวข้อ{addZone === "head" ? "ในหัวกระดาษ" : ""}</option>
              {addable.map((k) => <option key={k} value={k}>{BLOCK_LABELS[k]}</option>)}
            </PillSelect>
          </div>
        )}
        {/* จัดการหัวข้อ: แสดงเมื่อเลือกหัวข้อแล้ว (ไม่มีปุ่มที่กดไม่ได้ให้รก) */}
        {selected.length > 0 ? (
          <>
            <Sep />
            {selected.length > 1 && <ToolBtn title="จัดกลุ่ม: ย้ายพร้อมกัน (Ctrl+G)" disabled={!canEdit} onClick={groupSelected}><GroupIcon size={15} /></ToolBtn>}
            {anyGrouped && <ToolBtn title="แยกกลุ่ม (Ctrl+Shift+G)" disabled={!canEdit} onClick={ungroupSelected}><Ungroup size={15} /></ToolBtn>}
            {selected.some((i) => !SINGLE.includes(i.b.kind)) && <ToolBtn title="ทำสำเนา (Ctrl+D)" disabled={!canEdit} onClick={duplicate}><CopyPlus size={15} /></ToolBtn>}
            <ToolBtn title={allLocked ? "ปลดล็อกตำแหน่ง" : "ล็อกตำแหน่ง"} on={allLocked} disabled={!can} onClick={toggleLock}>{allLocked ? <PinOff size={15} /> : <Pin size={15} />}</ToolBtn>
            {selected.some((i) => !isLocked(i)) && <ToolBtn title="ลบ (Delete)" disabled={!can} onClick={() => remove(selected)}><Trash2 size={15} /></ToolBtn>}
            <Sep />
            <ToolBtn title={multi ? "ชิดซ้าย" : "ชิดขอบซ้ายกระดาษ"} disabled={!can} onClick={() => align("left")}><AlignStartVertical size={15} /></ToolBtn>
            <ToolBtn title={multi ? "กึ่งกลางแนวนอน" : "กึ่งกลางหน้า"} disabled={!can} onClick={() => align("hcenter")}><AlignCenterVertical size={15} /></ToolBtn>
            <ToolBtn title={multi ? "ชิดขวา" : "ชิดขอบขวากระดาษ"} disabled={!can} onClick={() => align("right")}><AlignEndVertical size={15} /></ToolBtn>
            <ToolBtn title="ชิดบน" disabled={!can} onClick={() => align("top")}><AlignStartHorizontal size={15} /></ToolBtn>
            <ToolBtn title="กึ่งกลางแนวตั้ง" disabled={!can} onClick={() => align("vcenter")}><AlignCenterHorizontal size={15} /></ToolBtn>
            <ToolBtn title="ชิดล่าง" disabled={!can} onClick={() => align("bottom")}><AlignEndHorizontal size={15} /></ToolBtn>
          </>
        ) : (
          <span className="text-[11.5px] text-white/40 ml-2">{!letterOnly && !bodyOn ? "คลิกที่กระดาษเพื่อเริ่มจัดตำแหน่งเอง" : "คลิกหัวข้อบนกระดาษเพื่อแก้ไข"}{!stepsOpen && !letterOnly && <button type="button" onClick={() => toggleSteps(true)} className="ml-2 text-nexus-teal hover:underline">วิธีใช้ 4 ขั้น</button>}</span>
        )}
        {/* เครื่องมือหลายกล่อง: แสดงเมื่อเลือก 2 กล่องขึ้นไป (แถบเครื่องมือไม่รก) */}
        {multi && (
          <>
            <ToolBtn title="กระจายแนวนอนเท่ากัน (3 กล่องขึ้นไป)" disabled={selected.length < 3 || !canEdit} onClick={() => distribute("x")}><AlignHorizontalDistributeCenter size={15} /></ToolBtn>
            <ToolBtn title="กระจายแนวตั้งเท่ากัน (3 กล่องขึ้นไป)" disabled={selected.length < 3 || !canEdit} onClick={() => distribute("y")}><AlignVerticalDistributeCenter size={15} /></ToolBtn>
            <ToolBtn title="กว้างเท่ากล่องแรกที่เลือก" disabled={!canEdit} onClick={() => sameSize("w")}><ArrowLeftRight size={15} /></ToolBtn>
            <ToolBtn title="สูงเท่ากล่องแรกที่เลือก" disabled={!canEdit} onClick={() => sameSize("h")}><ArrowUpDown size={15} /></ToolBtn>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <div className="w-[124px]" title="ตารางกริดช่วยจัดวาง">
            <PillSelect value={gridMode} onChange={(e) => setGridMode(e.target.value as any)} className="h-8 w-full text-[12px]">
              <option value="drag">กริด: ขณะลาก</option><option value="always">กริด: แสดงตลอด</option><option value="off">กริด: ปิด</option>
            </PillSelect>
          </div>
          <div className="w-[76px]" title="ระยะกริด">
            <PillSelect value={String(grid)} onChange={(e) => setGrid(Number(e.target.value))} className="h-8 w-full text-[12px]">
              {[2, 5, 10, 20].map((g) => <option key={g} value={String(g)}>{g} pt</option>)}
            </PillSelect>
          </div>
          <button type="button" title="ดูดติดกริดและเส้นนำ · กด Alt ค้างขณะลาก = วางอิสระชั่วคราว" onClick={() => setSnapOn((v) => !v)}
            className={cn("h-8 px-2 rounded-lg flex items-center gap-1 border text-[11.5px]", snapOn ? "border-nexus-teal/60 bg-nexus-teal/15 text-nexus-teal" : "border-white/10 text-white/60 hover:text-white")}>
            <Magnet size={14} /> {snapOn ? "ดูดติด" : "วางอิสระ"}
          </button>
          <ToolBtn title={showPdf ? "ซ่อน PDF ทุกหน้า" : "ดู PDF ทุกหน้า (พิมพ์/ดาวน์โหลด)"} on={showPdf} onClick={() => setShowPdf((v) => !v)}><Eye size={15} /></ToolBtn>
          <div className="w-[124px]" title="ขนาดกระดาษบนจอ">
            <PillSelect value={String(zoom)} onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))} className="h-8 w-full text-[12px]">
              <option value="fit">พอดีความกว้าง</option><option value="1">ซูม 100%</option><option value="1.333">ขนาดจริง</option><option value="1.5">ซูม 150%</option><option value="2">ซูม 200%</option>
            </PillSelect>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* กระดาษ A4: ภาพหน้าจริง + กล่องที่ลากได้ */}
        <div ref={wrapRef} className="flex-1 min-w-0 w-full overflow-auto max-h-[calc(100vh-96px)] rounded-lg">
          <div ref={paperRef} className={cn("relative bg-white rounded-sm shadow-2xl overflow-hidden select-none", tool !== "select" && "cursor-crosshair", tool === "select" && !bodyOn && !letterOnly && canEdit && "cursor-pointer")} style={{ width: A4.w * S, height: A4.h * S }} onPointerDown={(e) => { if (tool !== "select") startDraw(e); else if (!bodyOn && !letterOnly && canEdit) convertAt(e); else setSel([]); }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพหน้าเอกสารที่วาดในเบราว์เซอร์ (data URL) */}
            {image && <img src={image.url} alt="" className="absolute inset-0 w-full h-full pointer-events-none" />}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-[5]" style={{
                // เส้นกริดบางและจาง (เส้นรองจางมาก ทุก 5 ช่องเข้มขึ้นเล็กน้อย) ไม่บังเนื้อเอกสาร
                backgroundImage: "linear-gradient(to right, rgba(100,116,139,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.035) 1px, transparent 1px), linear-gradient(to right, rgba(100,116,139,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.08) 1px, transparent 1px)",
                backgroundSize: `${gridPx}px ${gridPx}px, ${gridPx}px ${gridPx}px, ${gridPx * 5}px ${gridPx * 5}px, ${gridPx * 5}px ${gridPx * 5}px`,
              }} />
            )}
            {showGrid && <div className="absolute pointer-events-none z-[5] border border-dashed border-sky-400/20" style={{ left: MARGIN * S, top: 30 * S, right: MARGIN * S, bottom: 30 * S }} />}
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
              return o && (o.x !== it.b.x || o.y !== it.b.y) ? <div key={`m-${it.key}`} className="absolute bg-white pointer-events-none z-[6]" style={{ left: o.x * S, top: o.y * S, width: o.w * S, height: Math.max(1, o.h) * S }} /> : null;
            })}
            {items.map((it) => {
              const b = it.b, on = sel.includes(it.key), o = shot.get(it.key);
              const moved = !!(image && o && (o.x !== b.x || o.y !== b.y));
              const fresh = !o;
              return (
                <div key={it.key} onPointerDown={(e) => start(e, it, "move")} onDoubleClick={(e) => { e.stopPropagation(); setSel([it.key]); setTab("block"); }}
                  className={cn("absolute group", canEdit ? "cursor-move" : "cursor-pointer",
                    on ? "outline outline-2 outline-[#0d9488] z-20" : "outline outline-1 outline-dashed outline-transparent hover:outline-slate-400 z-10",
                    fresh && !on && "outline-slate-300")}
                  style={{
                    // เส้นบาง: ขยายพื้นที่คลิกเป็นอย่างน้อย 8px รอบเส้น
                    ...(b.kind === "line"
                      ? (b.h > b.w ? { left: b.x * S - Math.max(0, (8 - b.w * S) / 2), top: b.y * S, width: Math.max(8, b.w * S), height: b.h * S } : { left: b.x * S, top: b.y * S - Math.max(0, (8 - b.h * S) / 2), width: b.w * S, height: Math.max(8, b.h * S) })
                      : { left: b.x * S, top: b.y * S, width: b.w * S, height: Math.max(2, b.h * S) }),
                    ...(moved ? { backgroundImage: `url(${image!.url})`, backgroundSize: `${A4.w * S}px ${A4.h * S}px`, backgroundPosition: `${-o!.x * S}px ${-o!.y * S}px`, backgroundRepeat: "no-repeat" } : {}),
                  }}>
                  <span className={cn("absolute -top-[17px] left-0 px-1.5 rounded-t text-[10px] leading-[17px] whitespace-nowrap pointer-events-none",
                    it.zone === "head" ? "bg-purple-600 text-white" : "bg-[#0d9488] text-white", on && !multi ? "block" : "hidden group-hover:block")}>
                    {BLOCK_LABELS[b.kind]}{b.kind === "field" ? ` · ${fieldOptions.find((f) => f.key === b.field)?.label || ""}` : ""}{isLocked(it) ? " 🔒" : ""}{it.zone === "head" ? " · หัวกระดาษ" : ""}
                  </span>
                  {fresh && b.kind === "text" && <div className="px-1 text-[10px] text-slate-500 pointer-events-none">{b.text}</div>}
                  {on && !multi && canEdit && <div onPointerDown={(e) => start(e, it, "size")} className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm bg-[#0d9488] cursor-se-resize" />}
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
        </div>

        {/* แผงขวา: แม่แบบ · หน้าตา · แก้ไข · ข้อมูล · ตรวจ */}
        <GlassCard className="p-3 w-full lg:w-[340px] flex-shrink-0 space-y-3 lg:sticky lg:top-16 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pb-14">
          <div className="flex rounded-full bg-white/5 p-1 border border-white/10 gap-0.5">
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={cn("flex-1 h-8 px-1 rounded-full text-[12px] font-semibold whitespace-nowrap", tab === t.id ? "bg-nexus-teal/15 text-nexus-teal" : t.id === "check" && issues.length ? "text-warning" : "text-white/55 hover:text-white")}>{t.label}</button>
            ))}
          </div>
          {panelTabs.find((t) => t.id === tab)?.content ?? (tab === "data" && !letterOnly ? dataPanel : tab === "check" ? checkPanel : (
            !letterhead && !bodyOn ? (
              <div className="space-y-2">
                <p className="text-[12.5px] text-white/60 leading-relaxed">
                  {letterOnly ? "เลือกหรือสร้างหัวกระดาษที่แท็บ \"หน้าตา\" แล้วลากจัดวางบนกระดาษได้เลย" : "ตอนนี้จัดหน้าอัตโนมัติตามแม่แบบ — คลิกหัวข้อบนกระดาษ (เช่น ชื่อบริษัท ตาราง) เพื่อเริ่มจัดตำแหน่งเอง"}
                </p>
              </div>
            ) : multi ? (
              <p className="text-[12.5px] text-white/70">เลือก {selected.length} หัวข้อ — ลากเพื่อย้ายพร้อมกัน หรือใช้ปุ่มจัดแนวบนแถบเครื่องมือ</p>
            ) : !primary ? (
              <div className="space-y-3">
                <p className="text-[12px] text-white/50 leading-relaxed">คลิกหัวข้อบนกระดาษเพื่อแต่ง · ลากเพื่อย้าย (เส้นชมพู = ตรงแนว · Alt ค้าง = วางอิสระ) · ลากมุมขวาล่างเพื่อปรับขนาด · Shift+คลิก เลือกหลายหัวข้อ · Ctrl+Z ย้อนกลับ</p>
                {letterhead && (
                  <Field label="ความสูงหัวกระดาษ (pt)">
                    <PillInput inputMode="decimal" value={letterhead.height} disabled={!canEdit} onChange={(e) => commitHead({ ...letterhead, height: Math.max(40, Math.min(320, Number(e.target.value.replace(/[^\d.]/g, "")) || 40)) })} className="h-8 w-full text-sm font-mono text-right" />
                  </Field>
                )}
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-white/70">หัวข้อทั้งหมดบนกระดาษ</p>
                  {layersPanel}
                </div>
              </div>
            ) : props(primary)
          ))}
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
