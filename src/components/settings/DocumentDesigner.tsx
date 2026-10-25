"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Eye, History, LayoutTemplate, ListChecks, Loader2, MousePointerClick, PanelTop, RotateCcw, Save, Trash2, Wand2, X } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DESIGNABLE_DOCS, LETTER_DESIGN, sampleModelFor } from "@/lib/documents/build";
import { EMPTY_SIGNING, applySigning, normalizeSigning, type SigningConfig } from "@/lib/documents/esign";
import { toDateStr } from "@/lib/documents/format";
import type { DocumentModel, DocumentProfile } from "@/lib/documents/model";
import {
  ARCHETYPES, FONT_LABELS, LETTERHEAD_TEMPLATES, PALETTES, TEMPLATES, letterheadTemplate, normalizeDesign, applyLayoutToAll,
  type DocTheme, type DocumentDesign, type FontFamily, type ItemColumn, type Letterhead, type PerDocDesign,
} from "@/lib/documents/design";
import { templateLayout } from "@/lib/documents/layout-templates";
import { dataGroups, ensureLayout, layoutIdFor, toggleData, type DataContext } from "@/lib/documents/design-data";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import { FreeLayoutEditor } from "./FreeLayoutEditor";
import { DataChecklist } from "./DataChecklist";
import { usePdfPageImage, useThumbnail } from "./usePdfPageImage";

/**
 * ออกแบบหน้าเอกสาร (ตั้งค่า › ออกแบบเอกสาร) — 2 แบบ สลับได้ตลอด
 *  - อัตโนมัติ: 1 เลือกแม่แบบ · 2 สีและตัวอักษร · 3 ติ๊กข้อมูลที่แสดง · 4 ชื่อเอกสาร — ตัวอย่างหน้าเอกสารใหญ่อัปเดตทันที
 *  - ออกแบบเอง: เริ่มจากแม่แบบหรือหน้าเปล่า · แถบเพิ่มของ/รูปทรงด้านซ้าย · ลากคลุม/Ctrl+คลิกเลือกหลายกล่อง · คลิกกล่องบนกระดาษแล้วมีแถบเครื่องมือลอยเหนือกล่อง · แผงขวาเฉพาะกล่องที่เลือก
 *  - ทุกเอกสารใช้ผังของแม่แบบ (แม่แบบที่ไม่มีผังเฉพาะใช้ผังที่ใกล้เคียง) — ไม่มีโหมด "จัดอัตโนมัติ" แยกให้สับสน
 *  - แถบเอกสาร: ภาพย่อทุกชนิด กดสลับ · ย้อนกลับ/ทำซ้ำทุกการแก้ · ประวัติเวอร์ชันที่บันทึก · ดูด้วยเอกสารจริงได้
 *  - บันทึก: ปุ่มลอย / Ctrl+S · เตือนก่อนออกเมื่อยังไม่บันทึก
 */
const SHORT: Record<string, string> = {
  quotation: "ใบเสนอราคา", sales_order: "ใบสั่งขาย", invoice: "ใบกำกับภาษี", billing_note: "ใบวางบิล", receipt: "ใบเสร็จ",
  delivery_note: "ใบส่งของ", cndn: "ใบลดหนี้", purchase_order: "ใบสั่งซื้อ", payment: "ใบสำคัญจ่าย", work_order: "ใบสั่งงาน", letter: "หนังสือ",
};
const TARGETS = [...DESIGNABLE_DOCS.map((d) => ({ type: d.type, title: d.title })), LETTER_DESIGN];
/** แม่แบบแนะนำ (หลากหลายแนว) แสดงก่อน ที่เหลือดูในหน้าต่าง "แม่แบบทั้งหมด" */
const RECOMMENDED = ["modern", "psg-form", "banner-a", "minimalLine-d", "sidebar-c", "frame-b"];

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** ใช้แม่แบบกับการออกแบบ: ธีม + ผังของแม่แบบทุกเอกสารการค้า */
function withTemplate(d: DocumentDesign, t: (typeof TEMPLATES)[number]): DocumentDesign {
  const perDoc = { ...d.perDoc };
  for (const x of DESIGNABLE_DOCS) perDoc[x.type] = { ...(perDoc[x.type] || {}), free: templateLayout(layoutIdFor(t.id, t.theme), x.type, t.theme), letterhead: undefined };
  return { ...d, theme: { ...t.theme }, perDoc };
}
/** เอกสารที่ยังไม่เคยจัดผัง: สร้างผังจากแม่แบบที่ใช้อยู่ (หน้าออกแบบแสดงและแก้แบบเดียวกันทุกเอกสาร) */
function withLayouts(d: DocumentDesign): DocumentDesign {
  const perDoc = { ...d.perDoc };
  for (const x of DESIGNABLE_DOCS) if (!perDoc[x.type]?.free?.enabled) perDoc[x.type] = { ...(perDoc[x.type] || {}), free: ensureLayout(perDoc[x.type]?.free, x.type, d.theme) };
  return { ...d, perDoc };
}

/** ตัวอย่างหน้าเอกสาร (หน้าแรกของ PDF จริง) ขนาดตามพื้นที่ */
function PagePreview({ model }: { model: DocumentModel | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(620);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.min(860, Math.round(e.contentRect.width / 40) * 40))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { image, busy, error } = usePdfPageImage(model, w);
  return (
    <div ref={ref} className="w-full">
      <div className="relative bg-white rounded-sm shadow-2xl mx-auto overflow-hidden" style={{ width: w, height: Math.round(w * 1.4142) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ภาพหน้าเอกสารที่วาดในเบราว์เซอร์ (data URL) */}
        {image && <img src={image.url} alt="ตัวอย่างหน้าเอกสาร" className="absolute inset-0 w-full h-full" />}
        {(busy || !image) && !error && <span className="absolute top-2 right-2 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-slate-800/80 text-white"><Loader2 size={11} className="animate-spin" /> กำลังอัปเดต</span>}
        {error && <span className="absolute bottom-2 left-2 right-2 text-[11px] px-2 py-1 rounded bg-red-600/90 text-white">วาดตัวอย่างไม่สำเร็จ: {error}</span>}
      </div>
    </div>
  );
}
/** ขั้นในหน้าแบบง่าย (หมายเลข · ชื่อ · ขอบเขต) */
const Step = ({ n, title, scope, children }: { n: number; title: string; scope: React.ReactNode; children: React.ReactNode }) => (
  <GlassCard className="p-3.5 space-y-2.5">
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-nexus-teal text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
      <p className="text-[14px] font-bold text-white">{title}</p>
      <span className="ml-auto">{scope}</span>
    </div>
    {children}
  </GlassCard>
);

/** ดึงสีเด่นของโลโก้ (ไม่ใช้ AI): เฉลี่ยพิกเซลที่มีสีสด ไม่ขาว/ดำ/โปร่งใส */
async function logoColor(dataUrl: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = dataUrl; });
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [R, G, B, A] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    if (A < 200 || max - min < 40 || max > 245 || max < 30) continue;
    r += R; gg += G; b += B; n++;
  }
  if (!n) return null;
  const k = Math.min(1, 150 / Math.max(r / n, gg / n, b / n)); // เข้มพอให้ตัวอักษรขาวอ่านได้
  const hex = (v: number) => Math.round((v / n) * k).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(gg)}${hex(b)}`;
}

/** ป้ายขอบเขต: ใช้กับทุกเอกสาร / เฉพาะเอกสารนี้ */
const Scope = ({ doc }: { doc?: string }) => (
  <span className={cn("text-[10.5px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap", doc ? "bg-purple-500/15 text-purple-200" : "bg-nexus-teal/15 text-nexus-teal")}>{doc ? `เฉพาะ${doc}` : "ทุกเอกสาร"}</span>
);
/** ส่วนในแผง (พับได้) พร้อมป้ายขอบเขต */
const Section = ({ title, doc, all, open = true, children }: { title: string; doc?: string; all?: boolean; open?: boolean; children: React.ReactNode }) => (
  <details open={open} className="group rounded-xl border border-white/10 bg-white/[0.02]">
    <summary className="list-none cursor-pointer select-none px-3 py-2 flex items-center gap-2 text-[12.5px] font-bold text-white/80">
      <span className="text-white/35 group-open:rotate-90 transition-transform">›</span>{title}
      <span className="ml-auto">{all ? <Scope /> : doc ? <Scope doc={doc} /> : null}</span>
    </summary>
    <div className="px-3 pb-3 space-y-2.5">{children}</div>
  </details>
);
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><label className="text-[11.5px] font-semibold text-white/55 ml-1">{label}</label>{children}</div>
);
const ColorField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-1.5">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer" aria-label="เลือกสี" />
    <PillInput value={value} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} className="h-8 w-[96px] font-mono text-xs" />
  </div>
);

/** ภาพย่อแม่แบบ (วาดจากตัวสร้าง PDF ด้วยข้อมูลบริษัทจริง เมื่อเลื่อนมาถึง) */
function TemplateCard({ t, active, docType, profile, onPick, size = "sm" }: { t: (typeof TEMPLATES)[number]; active: boolean; docType: string; profile: DocumentProfile; onPick: () => void; size?: "sm" | "lg" }) {
  const type = DESIGNABLE_DOCS.some((d) => d.type === docType) ? docType : DESIGNABLE_DOCS[0].type;
  const ref = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const url = useThumbnail(`${t.id}:${type}:${profile.logo?.length || 0}:${profile.name}`, () => {
    const design = normalizeDesign({ theme: t.theme, perDoc: { [type]: { free: templateLayout(layoutIdFor(t.id, t.theme), type, t.theme) } } });
    return sampleModelFor(type, { ...profile, design }, toDateStr(new Date()));
  }, size === "lg" ? 220 : 150, seen);
  return (
    <button ref={ref} type="button" onClick={onPick} title={t.description}
      className={cn("text-left rounded-xl border p-1.5 transition-colors flex flex-col gap-1.5", active ? "border-nexus-teal/60 bg-nexus-teal/10" : "border-white/10 hover:border-white/30")}>
      <div className="w-full aspect-[1/1.414] rounded bg-white overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- ภาพย่อที่วาดในเบราว์เซอร์ (data URL) */}
        {url ? <img src={url} alt="" className="w-full h-full object-cover object-top" /> : <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
      <p className={cn("font-bold text-white leading-snug px-0.5", size === "lg" ? "text-[12.5px]" : "text-[11px] line-clamp-2")}>{t.name}</p>
      {size === "lg" && <p className="text-[11px] text-white/50 leading-snug px-0.5 line-clamp-2">{t.description}</p>}
    </button>
  );
}

/** ภาพย่อเอกสารในแถบสลับเอกสาร (อัปเดตเมื่อหยุดแก้สักครู่) */
function DocChip({ type, active, design, profile, onClick }: { type: string; active: boolean; design: DocumentDesign; profile: DocumentProfile; onClick: () => void }) {
  const key = useMemo(() => `strip:${type}:${hash(JSON.stringify([design.theme, design.perDoc[type], design.letterheads]))}:${profile.logo?.length || 0}`, [type, design, profile.logo]);
  const url = useThumbnail(key, () => sampleModelFor(type, { ...profile, design }, toDateStr(new Date())), 60);
  return (
    <button type="button" onClick={onClick} title={TARGETS.find((x) => x.type === type)?.title}
      className={cn("flex-shrink-0 w-[74px] rounded-lg border p-1 flex flex-col items-center gap-1 transition-colors", active ? "border-nexus-teal/70 bg-nexus-teal/15" : "border-white/10 hover:border-white/30")}>
      <div className="w-[42px] h-[59px] rounded-sm bg-white overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- ภาพย่อที่วาดในเบราว์เซอร์ (data URL) */}
        {url ? <img src={url} alt="" className="w-full h-full object-cover object-top" /> : <Loader2 size={11} className="animate-spin text-slate-400" />}
      </div>
      <span className={cn("text-[10.5px] leading-tight text-center", active ? "text-white font-bold" : "text-white/60")}>{SHORT[type] || type}</span>
    </button>
  );
}

const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) => createPortal(
  <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className={cn("w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141418] p-5 space-y-4", wide ? "max-w-6xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        <button type="button" onClick={onClose} aria-label="ปิด" className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>,
  document.body,
);

export function DocumentDesigner() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "settings:manage");
  const [profile, setProfile] = useState<DocumentProfile | null>(null);
  // ลายเซ็น/ตราที่ตั้งไว้ (แสดงบนตัวอย่างให้เห็นตำแหน่งจริง)
  const [signing, setSigning] = useState<SigningConfig>(EMPTY_SIGNING);
  const [design, setDesign] = useState<DocumentDesign>(normalizeDesign(null));
  const [savedJson, setSavedJson] = useState("");
  const [docType, setDocType] = useState(DESIGNABLE_DOCS[0].type);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<"" | "templates" | "versions" | "pdf">("");
  // อัตโนมัติ / ออกแบบเอง (จำไว้ในเครื่อง)
  const [mode, setModeState] = useState<"simple" | "canvas">("simple");
  useEffect(() => { try { if (localStorage.getItem("nexus.designer.mode") === "canvas") setModeState("canvas"); } catch { /* ใช้แบบง่าย */ } }, []);
  const setMode = (m: "simple" | "canvas") => { setModeState(m); try { localStorage.setItem("nexus.designer.mode", m); } catch { /* ไม่เป็นไร */ } };
  const [applied, setApplied] = useState("");
  const [family, setFamily] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiUseLogo, setAiUseLogo] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [realDocs, setRealDocs] = useState<{ id: string; label: string }[]>([]);
  const [realId, setRealId] = useState("");
  const [realModel, setRealModel] = useState<DocumentModel | null>(null);
  const [versions, setVersions] = useState<{ id: string; savedAt: string; savedByName: string; templateId: string }[] | null>(null);

  // ---------- ประวัติการแก้ทั้งการออกแบบ (ย้อนกลับ/ทำซ้ำ) — แก้ต่อเนื่องภายใน 0.6 วินาที นับเป็นขั้นเดียว ----------
  const designRef = useRef(design);
  designRef.current = design;
  const hist = useRef<{ past: DocumentDesign[]; future: DocumentDesign[]; at: number }>({ past: [], future: [], at: 0 });
  const [, bump] = useState(0);
  const change = useCallback((fn: (d: DocumentDesign) => DocumentDesign) => {
    const h = hist.current, now = Date.now();
    if (now - h.at > 600) { h.past.push(designRef.current); if (h.past.length > 100) h.past.shift(); h.future = []; bump((x) => x + 1); }
    h.at = now;
    setDesign((d) => fn(d));
  }, []);
  const undo = useCallback(() => { const h = hist.current, prev = h.past.pop(); if (!prev) return; h.future.push(designRef.current); h.at = 0; setDesign(prev); bump((x) => x + 1); }, []);
  const redo = useCallback(() => { const h = hist.current, next = h.future.pop(); if (!next) return; h.past.push(designRef.current); h.at = 0; setDesign(next); bump((x) => x + 1); }, []);

  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) })
      .then((r) => r.json()).then((d) => {
        if (!d.success) return;
        const nd = withLayouts(normalizeDesign(d.profile.design, d.profile.brandColor));
        setProfile(d.profile); setDesign(nd); setSavedJson(JSON.stringify(nd));
      });
    apiFetch("/api/settings/document-signing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) })
      .then((r) => r.json()).then((d) => { if (d.success) setSigning(normalizeSigning(d.signing)); }).catch(() => {});
  }, [companyId]);

  const dirty = !!savedJson && JSON.stringify(design) !== savedJson;
  const save = useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "saveDesign", design: designRef.current }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      const nd = withLayouts(d.design);
      setDesign(nd); setSavedJson(JSON.stringify(nd)); setVersions(null);
      showAlert("บันทึกการออกแบบแล้ว — เอกสารที่พิมพ์หลังจากนี้ใช้รูปแบบใหม่ทั้งหมด (ย้อนกลับได้จาก \"ประวัติ\")");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setSaving(false); }
  }, [canEdit, saving, companyId, showAlert]);

  // บันทึกด้วย Ctrl+S · เตือนก่อนออกจากหน้า/สลับแท็บตั้งค่าเมื่อยังไม่บันทึก
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) save(); } };
    const leave = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    (window as any).__nexusDesignDirty = dirty;
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("beforeunload", leave); (window as any).__nexusDesignDirty = false; };
  }, [dirty, save]);

  const shown = design;
  const [preview, setPreview] = useState<DocumentDesign | null>(null);
  useEffect(() => { const t = setTimeout(() => setPreview(shown), 120); return () => clearTimeout(t); }, [shown]);
  const [stripDesign, setStripDesign] = useState<DocumentDesign | null>(null);
  useEffect(() => { const t = setTimeout(() => setStripDesign(shown), 2500); return () => clearTimeout(t); }, [shown]);

  // ดูตัวอย่างด้วยเอกสารจริงล่าสุดของชนิดนี้
  useEffect(() => {
    setRealId(""); setRealModel(null); setRealDocs([]);
    if (!companyId || !canEdit || docType === LETTER_DESIGN.type) return;
    apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "sampleDocs", type: docType }) })
      .then((r) => r.json()).then((d) => { if (d.success) setRealDocs(d.docs || []); }).catch(() => {});
  }, [companyId, canEdit, docType]);
  const pickReal = async (id: string) => {
    setRealId(id); setRealModel(null);
    if (!id) return;
    try {
      const res = await apiFetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, type: docType, id, format: "json" }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "เปิดเอกสารไม่สำเร็จ");
      setRealModel(d.document);
    } catch (e: any) { setRealId(""); showAlert(e.message, "เปิดเอกสารจริงไม่สำเร็จ", "error"); }
  };

  const theme = shown.theme;
  const per: PerDocDesign = shown.perDoc[docType] || {};
  const isLetter = docType === LETTER_DESIGN.type;
  const def = DESIGNABLE_DOCS.find((d) => d.type === docType) || { ...DESIGNABLE_DOCS[0], ...LETTER_DESIGN, titleEn: "", signatures: [], meta: [], fields: [] };
  const docName = SHORT[docType] || def.title;
  const letterhead = shown.letterheads.find((l) => l.id === per.letterhead) || null;
  const setTheme = (patch: Partial<DocTheme>) => change((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  const setPer = (patch: Partial<PerDocDesign>) => change((d) => ({ ...d, perDoc: { ...d.perDoc, [docType]: { ...(d.perDoc[docType] || {}), ...patch } } }));
  const setLetterhead = (lh: Letterhead) => change((d) => ({ ...d, letterheads: d.letterheads.map((l) => (l.id === lh.id ? lh : l)) }));
  const assignLetterhead = (type: string, id: string | undefined) => change((d) => ({ ...d, perDoc: { ...d.perDoc, [type]: { ...(d.perDoc[type] || {}), letterhead: id } } }));
  const createLetterhead = (kind: "trade" | "letter" | "banner") => {
    const id = `lh-${Date.now().toString(36)}`;
    change((d) => ({ ...d, letterheads: [...d.letterheads, letterheadTemplate(kind, id, d.theme.primary, d.theme.font)], perDoc: { ...d.perDoc, [docType]: { ...(d.perDoc[docType] || {}), letterhead: id } } }));
  };
  const deleteLetterhead = async (lh: Letterhead) => {
    const used = TARGETS.filter((t) => design.perDoc[t.type]?.letterhead === lh.id).length;
    if (!(await showConfirm(`ลบ "${lh.name}"? เอกสาร ${used} ชนิดที่ใช้หัวนี้จะกลับไปใช้หัวเอกสารตามแม่แบบ`))) return;
    change((d) => ({ ...d, letterheads: d.letterheads.filter((l) => l.id !== lh.id), perDoc: Object.fromEntries(Object.entries(d.perDoc).map(([k, v]) => [k, v.letterhead === lh.id ? { ...v, letterhead: undefined } : v])) }));
  };
  const defaultColumns: ItemColumn[] = ((def.columns || ["no", "description", "qty", "unit", "price", "amount"]) as ItemColumn[]).filter((k) => !(per.hideColumns || []).includes(k));
  // ผังของเอกสารนี้ (เอกสารการค้าทุกชนิดมีผังเสมอ) · รายการติ๊ก "ข้อมูลที่แสดง"
  const curLayout = ensureLayout(per.free, docType, theme);
  const dataCtx: DataContext = {
    docType, docTitle: def.title, meta: def.meta || [], fields: def.fields || [], columns: defaultColumns,
    totals: ["ส่วนลดท้ายบิล", "ยอดหลังหักส่วนลด", "หัก ณ ที่จ่าย", "ยอดชำระสุทธิ"],
  };
  const groups = isLetter ? [] : dataGroups(curLayout, { ...dataCtx, head: letterhead?.blocks });
  const toggle = (key: string, on: boolean) => setPer({ free: toggleData(curLayout, key, on, { ...dataCtx, head: letterhead?.blocks }) });
  const signBlock = curLayout.blocks.find((b) => b.kind === "signatures");
  const setSignLabels = (labels: string[] | undefined) => setPer({ free: { ...curLayout, blocks: curLayout.blocks.map((b) => { if (b !== signBlock) return b; const n = { ...b, labels }; if (!labels) delete n.labels; return n; }) } });
  const model = useMemo(() => {
    if (!profile || !preview) return null;
    if (realModel) return { ...realModel, seller: { ...realModel.seller, design: preview } };
    return applySigning(sampleModelFor(docType, { ...profile, design: preview }, toDateStr(new Date())), signing, def.signatures);
  }, [profile, preview, docType, realModel, signing, def.signatures]);

  /** ใช้แม่แบบกับทุกเอกสารทันที (ย้อนกลับได้ด้วย Ctrl+Z / ปุ่มย้อนกลับ) */
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    change((d) => withTemplate(d, t));
    setApplied(t.name);
  };
  const runAi = async () => {
    setAiBusy(true);
    try {
      const res = await apiFetch("/api/ai/document-theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, prompt: aiPrompt, logo: aiUseLogo ? profile?.logo || "" : "", current: theme }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "AI แต่งธีมไม่สำเร็จ");
      setTheme(d.theme);
    } catch (e: any) { showAlert(e.message, "AI แต่งธีมไม่สำเร็จ", "error"); } finally { setAiBusy(false); }
  };
  const fromLogo = async () => {
    if (!profile?.logo) return showAlert("ยังไม่มีโลโก้ — อัปโหลดที่แท็บข้อมูลนิติบุคคลก่อน", "ไม่มีโลโก้", "warning");
    const c = await logoColor(profile.logo).catch(() => null);
    if (!c) return showAlert("ดึงสีจากโลโก้ไม่ได้ (โลโก้เป็นสีขาวดำ)", "ไม่พบสีเด่น", "warning");
    setTheme({ primary: c, accent: c });
  };
  const openVersions = async () => {
    setModal("versions"); setVersions(null);
    const r = await apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "versions" }) }).then((x) => x.json()).catch(() => null);
    setVersions(r?.success ? r.versions : []);
  };
  const restoreVersion = async (id: string) => {
    const r = await apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "version", id }) }).then((x) => x.json()).catch(() => null);
    if (!r?.success) return showAlert(r?.error || "เปิดเวอร์ชันไม่สำเร็จ", "ย้อนเวอร์ชันไม่สำเร็จ", "error");
    change(() => withLayouts(r.design));
    setModal("");
    showAlert("เปิดเวอร์ชันที่เลือกแล้ว — ตรวจดูบนกระดาษ ถ้าใช่กด \"บันทึก\" เพื่อใช้จริง");
  };

  if (!profile) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;
  const currentTpl = TEMPLATES.find((t) => t.id === design.theme.templateId);
  const custom = !PALETTES.some((p) => p.primary === theme.primary && p.accent === theme.accent);
  const shownTemplates = TEMPLATES.filter((t) => !family || (family === "pick" ? !t.family : t.family === family));

  // ---------- ขั้น 1: แม่แบบ ----------
  const templatesStep = (
    <Step n={1} title="เลือกแม่แบบ" scope={<Scope />}>
      <p className="text-[12px] text-white/55">ใช้อยู่: <b className="text-white/85">{currentTpl?.name || "กำหนดเอง"}</b> · คลิกเพื่อใช้กับทุกเอกสาร (หน้าตาตามแม่แบบ เนื้อหาตามชนิดเอกสาร)</p>
      <div className="grid grid-cols-3 gap-1.5">
        {RECOMMENDED.map((id) => TEMPLATES.find((t) => t.id === id)).filter((t): t is (typeof TEMPLATES)[number] => !!t).map((t) => (
          <TemplateCard key={t.id} t={t} active={design.theme.templateId === t.id} docType={docType} profile={profile} onPick={() => canEdit && applyTemplate(t)} />
        ))}
      </div>
      {applied && <p className="text-[12px] text-nexus-teal">ใช้แม่แบบ &quot;{applied}&quot; แล้ว · ไม่ถูกใจกด ย้อนกลับ (Ctrl+Z)</p>}
      <PillButton variant="glass" className="h-9 px-3 text-xs w-full" onClick={() => setModal("templates")}><LayoutTemplate size={14} /> ดูแม่แบบทั้งหมด ({TEMPLATES.length} แบบ)</PillButton>
    </Step>
  );

  // ---------- ขั้น 2: สีและตัวอักษร ----------
  const lookStep = (
    <Step n={2} title="สีและตัวอักษร" scope={<Scope />}>
      <fieldset disabled={!canEdit} className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map((p) => (
            <button key={p.id} type="button" title={p.name} aria-label={`ชุดสี ${p.name}`} onClick={() => setTheme({ primary: p.primary, accent: p.accent })}
              className={cn("w-9 h-9 rounded-full border-2 flex items-center justify-center", theme.primary === p.primary && theme.accent === p.accent ? "border-white" : "border-transparent hover:border-white/40")}>
              <span className="w-7 h-7 rounded-full overflow-hidden flex"><span className="w-1/2 h-full" style={{ background: p.primary }} /><span className="w-1/2 h-full" style={{ background: p.accent }} /></span>
            </button>
          ))}
          <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={fromLogo}>ดึงสีจากโลโก้</PillButton>
        </div>
        <details open={custom} className="rounded-lg border border-white/10 px-2.5 py-1.5">
          <summary className="cursor-pointer text-[12px] text-white/60">กำหนดสีเอง (รหัสสี)</summary>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Row label="สีหลัก"><ColorField value={theme.primary} onChange={(v) => setTheme({ primary: v })} /></Row>
            <Row label="สีรอง"><ColorField value={theme.accent} onChange={(v) => setTheme({ accent: v })} /></Row>
            <Row label="ตัวอักษร"><ColorField value={theme.text} onChange={(v) => setTheme({ text: v })} /></Row>
            <Row label="ตัวอักษรรอง"><ColorField value={theme.muted} onChange={(v) => setTheme({ muted: v })} /></Row>
          </div>
        </details>
        <div className="grid grid-cols-2 gap-2">
          <Row label="ฟอนต์"><PillSelect value={theme.font} onChange={(e) => setTheme({ font: e.target.value as FontFamily })} className="h-9 w-full">{(Object.keys(FONT_LABELS) as FontFamily[]).map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</PillSelect></Row>
          <Row label={`ขนาดตัวอักษร ${theme.fontSize} pt`}><input type="range" min={7.5} max={12} step={0.5} value={theme.fontSize} onChange={(e) => setTheme({ fontSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
          <Row label={`ขนาดโลโก้ ${theme.logoSize} pt`}><input type="range" min={32} max={200} step={4} value={theme.logoSize} onChange={(e) => setTheme({ logoSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
          <Row label="ตาราง"><PillSelect value={theme.table} onChange={(e) => setTheme({ table: e.target.value as any })} className="h-9 w-full"><option value="tint">หัวสีอ่อน</option><option value="solid">หัวสีทึบ</option><option value="lines">เส้นบาง</option><option value="grid">เส้นครบ</option><option value="zebra">แถวสลับสี</option></PillSelect></Row>
        </div>
      </fieldset>
    </Step>
  );

  // ---------- ขั้น 3: ข้อมูลที่แสดง ----------
  const dataStep = !isLetter && (
    <Step n={3} title={`ข้อมูลที่แสดงใน${docName}`} scope={<Scope doc={docName} />}>
      <p className="text-[12px] text-white/55">ติ๊กเฉพาะที่ต้องการ — ตอนพิมพ์ระบบเติมข้อมูลจริงให้เอง · 🔒 กฎหมายกำหนด แสดงเสมอ</p>
      <DataChecklist groups={groups} onToggle={toggle} canEdit={canEdit} />
      {signBlock && (
        <Row label="ชื่อช่องลงนาม (คั่นด้วย , สูงสุด 4 ช่อง)">
          <PillInput value={(signBlock.labels || []).join(", ")} placeholder={def.signatures.join(", ")} disabled={!canEdit}
            onChange={(e) => { const l = e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 4); setSignLabels(l.length ? l : undefined); }} className="h-9 w-full text-sm" />
        </Row>
      )}
    </Step>
  );

  // ---------- ขั้น 4: ชื่อเอกสารและข้อความ ----------
  const textStep = !isLetter ? (
    <Step n={4} title="ชื่อเอกสารและข้อความ" scope={<Scope doc={docName} />}>
      <fieldset disabled={!canEdit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Row label="ชื่อเอกสาร"><PillInput value={per.title || ""} placeholder={def.title} onChange={(e) => setPer({ title: e.target.value })} className="h-9 w-full" /></Row>
          <Row label="ชื่อภาษาอังกฤษ"><PillInput value={per.titleEn ?? ""} placeholder={def.titleEn} onChange={(e) => setPer({ titleEn: e.target.value })} className="h-9 w-full" /></Row>
        </div>
        <Row label="ข้อความท้ายเอกสาร (เพิ่ม)"><PillInput value={per.extraNote || ""} placeholder="เช่น เงื่อนไขการรับประกัน" onChange={(e) => setPer({ extraNote: e.target.value })} className="h-9 w-full" /></Row>
      </fieldset>
    </Step>
  ) : (
    <GlassCard className="p-3.5 text-[12.5px] text-white/55 leading-relaxed">หนังสือ (ขอเข้าพื้นที่ · ส่งมอบงาน · ขอคืนหลักประกัน): แก้ได้เฉพาะหัวกระดาษ สี และฟอนต์ เนื้อหาเป็นรูปแบบหนังสือราชการ</GlassCard>
  );

  // ---------- ตั้งค่าเพิ่มเติม (พับไว้) ----------
  const moreSettings = (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02]" open={isLetter}>
      <summary className="list-none cursor-pointer select-none px-3.5 py-3 text-[13px] font-bold text-white/75 flex items-center gap-2"><span className="text-white/35 group-open:rotate-90 transition-transform">›</span> ตั้งค่าเพิ่มเติม (รูปแบบ · หัวกระดาษ · AI)</summary>
      <fieldset disabled={!canEdit} className="px-3 pb-3 space-y-2.5">
        <Section title="รูปแบบส่วนต่าง ๆ" all>
          <div className="grid grid-cols-2 gap-2">
            <Row label="ยอดรวม"><PillSelect value={theme.totals} onChange={(e) => setTheme({ totals: e.target.value as any })} className="h-9 w-full"><option value="solid">พื้นสีเต็ม</option><option value="outline">กรอบสี</option><option value="plain">เส้นคั่น</option><option value="grid">ตารางป้าย/ยอด</option></PillSelect></Row>
            <Row label="กรอบลูกค้า"><PillSelect value={theme.party} onChange={(e) => setTheme({ party: e.target.value as any })} className="h-9 w-full"><option value="accent-bar">แถบสีซ้าย</option><option value="boxed">กรอบเต็ม</option><option value="plain">เส้นใต้</option><option value="none">ไม่มีกรอบ</option></PillSelect></Row>
            <Row label="ช่องลงนาม"><PillSelect value={theme.signatures} onChange={(e) => setTheme({ signatures: e.target.value as any })} className="h-9 w-full"><option value="line">เส้นลงนาม</option><option value="box">กรอบลงนาม</option></PillSelect></Row>
            <Row label="ลายน้ำ"><PillInput value={theme.watermark} onChange={(e) => setTheme({ watermark: e.target.value })} placeholder="ไม่มี" className="h-9 w-full" /></Row>
            <Row label={`ขอบกระดาษ ${theme.margin} pt`}><input type="range" min={20} max={60} step={2} value={theme.margin} onChange={(e) => setTheme({ margin: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <PillCheckbox label="มุมโค้ง" checked={theme.rounded} onChange={(e) => setTheme({ rounded: e.target.checked })} />
            <PillCheckbox label="เลขหน้า" checked={theme.showPageNumber} onChange={(e) => setTheme({ showPageNumber: e.target.checked })} />
            <PillCheckbox label="ป้ายไทย/อังกฤษ" checked={theme.bilingual} onChange={(e) => setTheme({ bilingual: e.target.checked })} />
            <PillCheckbox label="แบบฟอร์ม (ป้าย : ค่า)" checked={theme.formStyle} onChange={(e) => setTheme({ formStyle: e.target.checked })} />
          </div>
        </Section>
        {!isLetter && (
          <Section title="ผังของเอกสารนี้" doc={docName} open={false}>
            <Row label="เริ่มผังใหม่จากแบบอื่น (เฉพาะเอกสารนี้)">
              <PillSelect value="" onChange={(e) => { const id = String(e.target.value); if (id) setPer({ free: templateLayout(id, docType, theme) }); }} className="h-9 w-full">
                <option value="">เลือกผัง…</option>
                {ARCHETYPES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </PillSelect>
            </Row>
            <PillButton variant="ghost" className="h-8 px-3 text-xs w-full" onClick={async () => {
              if (!(await showConfirm(`ใช้ผังของ "${def.title}" กับเอกสารทุกชนิด? (ผังเดิมของเอกสารอื่นจะถูกแทนที่ · ย้อนกลับได้)`))) return;
              change((d) => applyLayoutToAll({ ...d, perDoc: { ...d.perDoc, [docType]: { ...(d.perDoc[docType] || {}), free: curLayout } } }, docType, DESIGNABLE_DOCS.map((x) => x.type)));
            }}><Copy size={13} /> ใช้ผังนี้กับทุกเอกสาร</PillButton>
          </Section>
        )}
        <Section title="หัวกระดาษ" doc={docName} open={!!letterhead || isLetter}>
          <PillSelect value={per.letterhead || ""} onChange={(e) => assignLetterhead(docType, String(e.target.value) || undefined)} className="h-9 w-full">
            <option value="">{isLetter ? "หัวหนังสือมาตรฐาน (กึ่งกลาง)" : "ตามแม่แบบ"}</option>
            {shown.letterheads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </PillSelect>
          {shown.letterheads.length < 6 && (
            <PillSelect value="" onChange={(e) => e.target.value && createLetterhead(e.target.value as any)} className="h-9 w-full">
              <option value="">+ สร้างหัวกระดาษใหม่…</option>
              {LETTERHEAD_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </PillSelect>
          )}
          {letterhead && (
            <>
              <div className="flex gap-1.5">
                <PillInput value={letterhead.name} onChange={(e) => setLetterhead({ ...letterhead, name: e.target.value.slice(0, 40) })} className="h-8 flex-1 text-sm" aria-label="ชื่อหัวกระดาษ" />
                <PillButton variant="ghost" className="h-8 px-2.5 text-xs text-danger" onClick={() => deleteLetterhead(letterhead)}><Trash2 size={13} /></PillButton>
              </div>
              <p className="text-[11.5px] text-white/50">ใช้หัวนี้กับเอกสาร:</p>
              <div className="flex flex-wrap gap-1">
                {TARGETS.map((t) => {
                  const on = shown.perDoc[t.type]?.letterhead === letterhead.id;
                  return <button key={t.type} type="button" onClick={() => assignLetterhead(t.type, on ? undefined : letterhead.id)} className={cn("h-7 px-2 rounded-full text-[11.5px] border", on ? "border-purple-400/60 bg-purple-500/15 text-purple-100" : "border-white/10 text-white/50 hover:text-white")}>{SHORT[t.type]}</button>;
                })}
              </div>
              <p className="text-[11px] text-white/40">จัดตำแหน่งในหัวกระดาษได้ที่ &quot;ออกแบบเอง&quot; (กล่องสีม่วง)</p>
            </>
          )}
        </Section>
        <Section title="ให้ AI ช่วยออกแบบ" all open={false}>
          <PillInput value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="เช่น ดูหรู ทางการ โทนน้ำเงินเข้ม" className="w-full h-9" />
          <PillCheckbox label="ใช้สีและรูปทรงจากโลโก้บริษัท" checked={aiUseLogo} onChange={(e) => setAiUseLogo(e.target.checked)} />
          <PillButton variant="primary" className="h-9 px-4 text-xs w-full" disabled={aiBusy || (!aiPrompt.trim() && !(aiUseLogo && profile.logo))} onClick={runAi}>{aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} ให้ AI ออกแบบสีและรูปแบบ</PillButton>
        </Section>
        <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={async () => { if (await showConfirm("คืนค่าการออกแบบทั้งหมดเป็นค่าเริ่มต้น? (ย้อนกลับได้ก่อนบันทึก)")) change(() => withLayouts(normalizeDesign(null, profile.brandColor))); }}><RotateCcw size={13} /> คืนค่าเริ่มต้นทั้งหมด</PillButton>
      </fieldset>
    </details>
  );

  return (
    <div className="space-y-3">
      {/* แถบเอกสาร: ภาพย่อทุกชนิด กดสลับ · แบบง่าย/ลากวาง · ประวัติ · ดูด้วยเอกสารจริง */}
      <GlassCard className="p-2.5 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TARGETS.map((t) => <DocChip key={t.type} type={t.type} active={docType === t.type} design={stripDesign || shown} profile={profile} onClick={() => setDocType(t.type)} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <div className="flex rounded-full bg-white/5 p-1 border border-white/10">
            {([["simple", "อัตโนมัติ", ListChecks], ["canvas", "ออกแบบเอง", MousePointerClick]] as const).map(([m, label, I]) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-8 px-4 rounded-full text-[13px] flex items-center gap-1.5", mode === m ? "bg-nexus-teal/20 text-nexus-teal font-bold" : "text-white/55 hover:text-white")}><I size={14} /> {label}</button>
            ))}
          </div>
          <span className="text-[12.5px] text-white/70">กำลังแก้: <b className="text-white">{def.title}</b></span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!isLetter && realDocs.length > 0 && (
              <div className="w-[230px]" title="ดูตัวอย่างการออกแบบด้วยเอกสารจริง">
                <PillSelect value={realId} onChange={(e) => pickReal(String(e.target.value))} className="h-8 w-full text-[12px]">
                  <option value="">ดูด้วย: ข้อมูลตัวอย่าง</option>
                  {realDocs.map((d) => <option key={d.id} value={d.id}>ดูด้วย: {d.label}</option>)}
                </PillSelect>
              </div>
            )}
            {canEdit && <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={openVersions}><History size={13} /> ประวัติ</PillButton>}
          </div>
        </div>
      </GlassCard>

      {mode === "simple" ? (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="w-full xl:w-[460px] flex-shrink-0 space-y-3">
            {templatesStep}
            {lookStep}
            {dataStep}
            {textStep}
            {moreSettings}
          </div>
          <div className="flex-1 min-w-0 w-full space-y-2 xl:sticky xl:top-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-white/70">ตัวอย่าง{docName} (เปลี่ยนทันทีที่แก้)</p>
              <div className="ml-auto flex gap-2">
                <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => setModal("pdf")}><Eye size={13} /> ดู PDF / พิมพ์</PillButton>
                {canEdit && <PillButton variant="primary" className="h-8 px-3 text-xs" onClick={() => setMode("canvas")}><MousePointerClick size={13} /> ปรับแก้จากแม่แบบนี้ (ออกแบบเอง)</PillButton>}
              </div>
            </div>
            <PagePreview model={model} />
          </div>
        </div>
      ) : (
        <FreeLayoutEditor
          key={docType}
          docType={docType}
          theme={theme}
          docMeta={def.meta || []}
          docFields={def.fields || []}
          layout={curLayout}
          onChange={(free) => setPer({ free })}
          letterhead={letterhead}
          onLetterheadChange={setLetterhead}
          letterOnly={isLetter}
          defaultColumns={defaultColumns}
          defaultSignatures={per.signatures?.length ? per.signatures : def.signatures}
          model={model}
          canEdit={canEdit}
          docTitle={def.title}
          history={{ undo, redo, canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0 }}
          dataCtx={dataCtx}
        />
      )}

      {/* บันทึก: ลอยตามเมื่อมีการแก้ (Ctrl+S) */}
      {canEdit && dirty && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2 rounded-full border border-warning/40 bg-[#18181d]/95 backdrop-blur px-3 py-2 shadow-2xl">
          <span className="text-[12.5px] text-warning px-1">ยังไม่บันทึก</span>
          <PillButton variant="ghost" className="h-8 px-3 text-xs" disabled={!hist.current.past.length} onClick={undo}>ย้อนกลับ</PillButton>
          <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={async () => { if (await showConfirm("ยกเลิกการแก้ทั้งหมดที่ยังไม่บันทึก?")) change(() => JSON.parse(savedJson)); }}>ยกเลิกการแก้</PillButton>
          <PillButton variant="confirm" className="h-8 px-4 text-xs" disabled={saving} onClick={save}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึก (Ctrl+S)</PillButton>
        </div>
      )}

      {modal === "pdf" && model && (
        <Modal title={`ตัวอย่าง${def.title}`} onClose={() => setModal("")} wide>
          <div className="h-[75vh] flex flex-col"><DocumentPdfViewer model={model} className="flex-1" /></div>
        </Modal>
      )}
      {modal === "templates" && (
        <Modal title={`แม่แบบทั้งหมด ${TEMPLATES.length} แบบ — ภาพจาก "${def.title}" ของบริษัท`} onClose={() => setModal("")} wide>
          <div className="flex flex-wrap gap-1">
            {[["", `ทั้งหมด (${TEMPLATES.length})`], ["pick", "แนะนำ"], ...ARCHETYPES.map((a) => [a.id, a.name])].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFamily(id)} title={ARCHETYPES.find((a) => a.id === id)?.desc}
                className={cn("h-8 px-3 rounded-full text-[12px] border", family === id ? "border-nexus-teal/60 bg-nexus-teal/15 text-nexus-teal" : "border-white/10 text-white/60 hover:text-white")}>{label}</button>
            ))}
          </div>
          <p className="text-[12px] text-white/50">คลิกแม่แบบเพื่อใช้กับทุกเอกสาร — ไม่ถูกใจกด ย้อนกลับ (Ctrl+Z)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {shownTemplates.map((t) => <TemplateCard key={t.id} t={t} size="lg" active={design.theme.templateId === t.id} docType={docType} profile={profile} onPick={() => { if (canEdit) applyTemplate(t); setModal(""); }} />)}
          </div>
        </Modal>
      )}
      {modal === "versions" && (
        <Modal title="ประวัติการออกแบบที่บันทึก" onClose={() => setModal("")}>
          <p className="text-[12px] text-white/50">เปิดเวอร์ชันเก่าเพื่อดู แล้วกด &quot;บันทึก&quot; ถ้าต้องการใช้ (เก็บล่าสุด 20 ครั้ง)</p>
          {!versions ? <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-white/40" /></div>
            : !versions.length ? <p className="text-[13px] text-white/60 py-4 text-center">ยังไม่มีประวัติ — จะเริ่มเก็บตั้งแต่การบันทึกครั้งถัดไป</p>
            : (
              <div className="space-y-1.5">
                {versions.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] text-white">{v.savedAt ? new Date(v.savedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-"}{i === 0 && <span className="ml-2 text-[11px] text-nexus-teal">ล่าสุด</span>}</p>
                      <p className="text-[11.5px] text-white/50 truncate">{TEMPLATES.find((t) => t.id === v.templateId)?.name || "กำหนดเอง"}{v.savedByName ? ` · ${v.savedByName}` : ""}</p>
                    </div>
                    <PillButton variant="glass" className="h-8 px-3 text-xs ml-auto" onClick={() => restoreVersion(v.id)}><PanelTop size={13} /> เปิดเวอร์ชันนี้</PillButton>
                  </div>
                ))}
              </div>
            )}
        </Modal>
      )}
    </div>
  );
}
