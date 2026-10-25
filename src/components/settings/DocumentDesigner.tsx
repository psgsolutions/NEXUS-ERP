"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, History, LayoutTemplate, Loader2, PanelTop, RotateCcw, Save, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DESIGNABLE_DOCS, LETTER_DESIGN, sampleModelFor } from "@/lib/documents/build";
import { toDateStr } from "@/lib/documents/format";
import type { DocumentModel, DocumentProfile } from "@/lib/documents/model";
import {
  ARCHETYPES, FONT_LABELS, LETTERHEAD_TEMPLATES, PALETTES, TEMPLATES, defaultFreeLayout, letterheadTemplate, normalizeDesign, applyLayoutToAll,
  type DocTheme, type DocumentDesign, type FontFamily, type ItemColumn, type Letterhead, type PerDocDesign,
} from "@/lib/documents/design";
import { templateLayout } from "@/lib/documents/layout-templates";
import { FreeLayoutEditor } from "./FreeLayoutEditor";
import { useThumbnail } from "./usePdfPageImage";

/**
 * ออกแบบหน้าเอกสาร (ตั้งค่า › ออกแบบเอกสาร) — หน้าเดียว แก้บนกระดาษจริง
 *  - แถบเอกสาร: ภาพย่อเอกสารทุกชนิด กดสลับดู/แก้ (เห็นผลของการเปลี่ยนสี/แม่แบบกับทุกเอกสาร)
 *  - กระดาษตรงกลาง: หน้าแรกของ PDF จริง คลิกหัวข้อเพื่อแก้ (จัดหน้าอัตโนมัติ → คลิกแล้วเริ่มจัดตำแหน่งเอง)
 *  - แผงขวา: แม่แบบ · หน้าตา · แก้ไข · ข้อมูล · ตรวจ — ทุกส่วนมีป้ายบอกว่าใช้กับ "ทุกเอกสาร" หรือ "เฉพาะเอกสารนี้"
 *  - แม่แบบ: คลิกเพื่อลองดูก่อน แล้วกดใช้ · ย้อนกลับ/ทำซ้ำได้ทุกการแก้ · ประวัติเวอร์ชันที่บันทึก (ย้อนทั้งชุด)
 *  - ดูตัวอย่างด้วยเอกสารจริงล่าสุดได้ · บันทึก: ปุ่มลอย / Ctrl+S · เตือนก่อนออกเมื่อยังไม่บันทึก
 */
const SHORT: Record<string, string> = {
  quotation: "ใบเสนอราคา", sales_order: "ใบสั่งขาย", invoice: "ใบกำกับภาษี", billing_note: "ใบวางบิล", receipt: "ใบเสร็จ",
  delivery_note: "ใบส่งของ", cndn: "ใบลดหนี้", purchase_order: "ใบสั่งซื้อ", payment: "ใบสำคัญจ่าย", work_order: "ใบสั่งงาน", letter: "หนังสือ",
};
const TARGETS = [...DESIGNABLE_DOCS.map((d) => ({ type: d.type, title: d.title })), LETTER_DESIGN];
/** แม่แบบแนะนำ (หลากหลายแนว) แสดงก่อน ที่เหลือดูในหน้าต่าง "แม่แบบทั้งหมด" */
const RECOMMENDED = ["modern", "psg-form", "banner-a", "minimalLine-d", "sidebar-c", "frame-b"];

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** ใช้แม่แบบกับการออกแบบ: ธีม + ผังของแม่แบบ (ถ้ามี) ทุกเอกสารการค้า — แม่แบบไม่มีผัง เนื้อเอกสารกลับไปจัดอัตโนมัติ */
function withTemplate(d: DocumentDesign, t: (typeof TEMPLATES)[number]): DocumentDesign {
  const perDoc = { ...d.perDoc };
  for (const x of DESIGNABLE_DOCS) {
    const cur = perDoc[x.type] || {};
    perDoc[x.type] = t.layout ? { ...cur, free: templateLayout(t.layout, x.type, t.theme), letterhead: undefined } : cur.free ? { ...cur, free: { ...cur.free, enabled: false } } : cur;
  }
  return { ...d, theme: { ...t.theme }, perDoc };
}

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
    const design = normalizeDesign({ theme: t.theme, perDoc: t.layout ? { [type]: { free: templateLayout(t.layout, type, t.theme) } } : {} });
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
  const [design, setDesign] = useState<DocumentDesign>(normalizeDesign(null));
  const [savedJson, setSavedJson] = useState("");
  const [docType, setDocType] = useState(DESIGNABLE_DOCS[0].type);
  const [saving, setSaving] = useState(false);
  const [trial, setTrial] = useState<(typeof TEMPLATES)[number] | null>(null);
  const [modal, setModal] = useState<"" | "templates" | "versions">("");
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
        const nd = normalizeDesign(d.profile.design, d.profile.brandColor);
        setProfile(d.profile); setDesign(nd); setSavedJson(JSON.stringify(nd));
      });
  }, [companyId]);

  const dirty = !!savedJson && JSON.stringify(design) !== savedJson;
  const save = useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "saveDesign", design: designRef.current }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setDesign(d.design); setSavedJson(JSON.stringify(d.design)); setVersions(null);
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

  // ลองแม่แบบ: แสดงผลบนกระดาษก่อน ยังไม่เปลี่ยนการออกแบบจริง
  const shown = useMemo(() => (trial ? withTemplate(design, trial) : design), [design, trial]);
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
  const model = useMemo(() => {
    if (!profile || !preview) return null;
    if (realModel) return { ...realModel, seller: { ...realModel.seller, design: preview } };
    return sampleModelFor(docType, { ...profile, design: preview }, toDateStr(new Date()));
  }, [profile, preview, docType, realModel]);

  const applyTemplate = async (t: (typeof TEMPLATES)[number]) => {
    const overwrites = DESIGNABLE_DOCS.some((d) => design.perDoc[d.type]?.free?.enabled);
    if (overwrites && !(await showConfirm(`ใช้แม่แบบ "${t.name}" กับทุกเอกสาร? ผังที่จัดเองไว้จะถูกแทนที่ (ย้อนกลับได้ด้วย Ctrl+Z หรือ "ประวัติ")`))) return;
    change((d) => withTemplate(d, t));
    setTrial(null);
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
    change(() => r.design);
    setModal("");
    showAlert("เปิดเวอร์ชันที่เลือกแล้ว — ตรวจดูบนกระดาษ ถ้าใช่กด \"บันทึก\" เพื่อใช้จริง");
  };

  if (!profile) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;
  const currentTpl = TEMPLATES.find((t) => t.id === design.theme.templateId);

  // ---------- แท็บ "แม่แบบ" ----------
  const templatesPanel = (
    <div className="space-y-2.5">
      <Section title="แม่แบบ" all>
        <p className="text-[12px] text-white/55">ใช้อยู่: <b className="text-white/85">{currentTpl?.name || "กำหนดเอง"}</b> · คลิกแม่แบบเพื่อลองดูบนกระดาษก่อน</p>
        <div className="grid grid-cols-3 gap-1.5">
          {RECOMMENDED.map((id) => TEMPLATES.find((t) => t.id === id)).filter((t): t is (typeof TEMPLATES)[number] => !!t).map((t) => (
            <TemplateCard key={t.id} t={t} active={(trial?.id || design.theme.templateId) === t.id} docType={docType} profile={profile} onPick={() => setTrial(t)} />
          ))}
        </div>
        <PillButton variant="glass" className="h-9 px-3 text-xs w-full" onClick={() => setModal("templates")}><LayoutTemplate size={14} /> ดูแม่แบบทั้งหมด ({TEMPLATES.length} แบบ)</PillButton>
      </Section>
      {!isLetter && (
        <Section title="ผังของเอกสารนี้" doc={docName}>
          <Row label="เริ่มผังใหม่จากแม่แบบ (เฉพาะเอกสารนี้)">
            <PillSelect value="" disabled={!canEdit || !!trial} onChange={(e) => { const id = String(e.target.value); if (!id) return; const t = TEMPLATES.find((x) => x.id === id); setPer({ free: templateLayout(id === "standard" ? undefined : t?.layout, docType, theme) }); }} className="h-9 w-full">
              <option value="">เลือกผัง…</option>
              <option value="standard">ผังมาตรฐาน</option>
              {ARCHETYPES.filter((a) => a.id !== "standard").map((a) => <option key={a.id} value={TEMPLATES.find((t) => t.family === a.id)?.id || a.id}>{a.name}</option>)}
            </PillSelect>
          </Row>
          {per.free?.enabled && canEdit && (
            <PillButton variant="ghost" className="h-8 px-3 text-xs w-full" onClick={async () => {
              if (!(await showConfirm(`ใช้ผังของ "${def.title}" กับเอกสารทุกชนิด? (ผังเดิมของเอกสารอื่นจะถูกแทนที่ · ย้อนกลับได้)`))) return;
              change((d) => applyLayoutToAll(d, docType, DESIGNABLE_DOCS.map((x) => x.type)));
            }}><Copy size={13} /> ใช้ผังนี้กับทุกเอกสาร</PillButton>
          )}
        </Section>
      )}
      <Section title="ให้ AI ช่วยออกแบบ" all open={false}>
        <PillInput value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="เช่น ดูหรู ทางการ โทนน้ำเงินเข้ม" className="w-full h-9" />
        <PillCheckbox label="ใช้สีและรูปทรงจากโลโก้บริษัท" checked={aiUseLogo} onChange={(e) => setAiUseLogo(e.target.checked)} />
        <PillButton variant="primary" className="h-9 px-4 text-xs w-full" disabled={!canEdit || aiBusy || (!aiPrompt.trim() && !(aiUseLogo && profile.logo))} onClick={runAi}>{aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} ให้ AI ออกแบบสีและรูปแบบ</PillButton>
      </Section>
    </div>
  );

  // ---------- แท็บ "หน้าตา" ----------
  const custom = !PALETTES.some((p) => p.primary === theme.primary && p.accent === theme.accent);
  const lookPanel = (
    <fieldset disabled={!canEdit || !!trial} className="space-y-2.5">
      {!isLetter && (
        <Section title="การจัดหน้า" doc={docName}>
          <div className="grid grid-cols-2 gap-1.5">
            {([[false, "อัตโนมัติตามแม่แบบ", "หัวข้อเรียงลงเอง ยืดตามเนื้อหา"], [true, "จัดตำแหน่งเอง", "ลากวางหัวข้อได้อิสระ"]] as const).map(([on, label, sub]) => (
              <button key={label} type="button" onClick={() => setPer({ free: on ? { ...(per.free?.blocks?.length ? per.free : defaultFreeLayout(docType, theme.font, def.meta)), enabled: true } : per.free ? { ...per.free, enabled: false } : undefined })}
                className={cn("rounded-xl border p-2 text-left", !!per.free?.enabled === on ? "border-nexus-teal/60 bg-nexus-teal/10" : "border-white/10 hover:border-white/25")}>
                <p className="text-[12.5px] font-bold text-white flex items-center gap-1">{!!per.free?.enabled === on && <Check size={13} className="text-nexus-teal" />}{label}</p>
                <p className="text-[11px] text-white/50">{sub}</p>
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section title="สี" all>
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map((p) => (
            <button key={p.id} type="button" title={p.name} aria-label={`ชุดสี ${p.name}`} onClick={() => setTheme({ primary: p.primary, accent: p.accent })}
              className={cn("w-9 h-9 rounded-full border-2 flex items-center justify-center", theme.primary === p.primary && theme.accent === p.accent ? "border-white" : "border-transparent hover:border-white/40")}>
              <span className="w-7 h-7 rounded-full overflow-hidden flex"><span className="w-1/2 h-full" style={{ background: p.primary }} /><span className="w-1/2 h-full" style={{ background: p.accent }} /></span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={fromLogo}>ดึงสีจากโลโก้</PillButton>
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
      </Section>
      <Section title="ตัวอักษร" all>
        <div className="grid grid-cols-2 gap-2">
          <Row label="ฟอนต์"><PillSelect value={theme.font} onChange={(e) => setTheme({ font: e.target.value as FontFamily })} className="h-9 w-full">{(Object.keys(FONT_LABELS) as FontFamily[]).map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</PillSelect></Row>
          <Row label={`ขนาด ${theme.fontSize} pt`}><input type="range" min={7.5} max={12} step={0.5} value={theme.fontSize} onChange={(e) => setTheme({ fontSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
        </div>
      </Section>
      <Section title="รูปแบบ" all open={false}>
        <div className="grid grid-cols-2 gap-2">
          {!per.free?.enabled && !isLetter && <Row label="หัวเอกสาร"><PillSelect value={theme.header} onChange={(e) => setTheme({ header: e.target.value as any })} className="h-9 w-full"><option value="logo-left">โลโก้ซ้าย</option><option value="logo-right">โลโก้ขวา</option><option value="centered">กึ่งกลาง</option><option value="banner">แถบสีเต็ม</option></PillSelect></Row>}
          <Row label={`ขนาดโลโก้ ${theme.logoSize} pt`}><input type="range" min={32} max={200} step={4} value={theme.logoSize} onChange={(e) => setTheme({ logoSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
          <Row label="ตาราง"><PillSelect value={theme.table} onChange={(e) => setTheme({ table: e.target.value as any })} className="h-9 w-full"><option value="tint">หัวสีอ่อน</option><option value="solid">หัวสีทึบ</option><option value="lines">เส้นบาง</option><option value="grid">เส้นครบ</option><option value="zebra">แถวสลับสี</option></PillSelect></Row>
          <Row label="ยอดรวม"><PillSelect value={theme.totals} onChange={(e) => setTheme({ totals: e.target.value as any })} className="h-9 w-full"><option value="solid">พื้นสีเต็ม</option><option value="outline">กรอบสี</option><option value="plain">เส้นคั่น</option><option value="grid">ตารางป้าย/ยอด</option></PillSelect></Row>
          <Row label="กรอบลูกค้า"><PillSelect value={theme.party} onChange={(e) => setTheme({ party: e.target.value as any })} className="h-9 w-full"><option value="accent-bar">แถบสีซ้าย</option><option value="boxed">กรอบเต็ม</option><option value="plain">เส้นใต้</option><option value="none">ไม่มีกรอบ</option></PillSelect></Row>
          <Row label="ช่องลงนาม"><PillSelect value={theme.signatures} onChange={(e) => setTheme({ signatures: e.target.value as any })} className="h-9 w-full"><option value="line">เส้นลงนาม</option><option value="box">กรอบลงนาม</option></PillSelect></Row>
          <Row label={`ขอบกระดาษ ${theme.margin} pt`}><input type="range" min={20} max={60} step={2} value={theme.margin} onChange={(e) => setTheme({ margin: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
          <Row label="ลายน้ำ"><PillInput value={theme.watermark} onChange={(e) => setTheme({ watermark: e.target.value })} placeholder="ไม่มี" className="h-9 w-full" /></Row>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <PillCheckbox label="มุมโค้ง" checked={theme.rounded} onChange={(e) => setTheme({ rounded: e.target.checked })} />
          <PillCheckbox label="เลขหน้า" checked={theme.showPageNumber} onChange={(e) => setTheme({ showPageNumber: e.target.checked })} />
          <PillCheckbox label="ป้ายไทย/อังกฤษ" checked={theme.bilingual} onChange={(e) => setTheme({ bilingual: e.target.checked })} />
          <PillCheckbox label="แบบฟอร์ม (ป้าย : ค่า)" checked={theme.formStyle} onChange={(e) => setTheme({ formStyle: e.target.checked })} />
        </div>
      </Section>
      <Section title="หัวกระดาษ" doc={docName} open={!!letterhead || isLetter}>
        <PillSelect value={per.letterhead || ""} onChange={(e) => assignLetterhead(docType, String(e.target.value) || undefined)} className="h-9 w-full">
          <option value="">{isLetter ? "หัวหนังสือมาตรฐาน (กึ่งกลาง)" : "ตามแม่แบบ (อัตโนมัติ)"}</option>
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
            <p className="text-[11.5px] text-white/50">ใช้หัวนี้กับ <Scope /> ที่เลือก:</p>
            <div className="flex flex-wrap gap-1">
              {TARGETS.map((t) => {
                const on = shown.perDoc[t.type]?.letterhead === letterhead.id;
                return <button key={t.type} type="button" onClick={() => assignLetterhead(t.type, on ? undefined : letterhead.id)} className={cn("h-7 px-2 rounded-full text-[11.5px] border", on ? "border-purple-400/60 bg-purple-500/15 text-purple-100" : "border-white/10 text-white/50 hover:text-white")}>{SHORT[t.type]}</button>;
              })}
            </div>
            <p className="text-[11px] text-white/40">แก้หัวกระดาษบนกระดาษได้เลย (หัวข้อสีม่วง) — เปลี่ยนทุกเอกสารที่ใช้หัวนี้</p>
          </>
        )}
      </Section>
      {!isLetter ? (
        <Section title="ชื่อและข้อความ" doc={docName} open={false}>
          <Row label="ชื่อเอกสาร"><PillInput value={per.title || ""} placeholder={def.title} onChange={(e) => setPer({ title: e.target.value })} className="h-9 w-full" /></Row>
          <Row label="ชื่อภาษาอังกฤษ"><PillInput value={per.titleEn ?? ""} placeholder={def.titleEn} onChange={(e) => setPer({ titleEn: e.target.value })} className="h-9 w-full" /></Row>
          <Row label="ข้อความท้ายเอกสาร (เพิ่ม)"><PillInput value={per.extraNote || ""} placeholder="เช่น เงื่อนไขการรับประกัน" onChange={(e) => setPer({ extraNote: e.target.value })} className="h-9 w-full" /></Row>
          <p className="text-[11px] text-white/40">คอลัมน์ตารางและช่องลงนาม ตั้งที่แท็บ &quot;ข้อมูล&quot;</p>
        </Section>
      ) : (
        <p className="text-[12px] text-white/50 leading-relaxed px-1">หนังสือ (ขอเข้าพื้นที่ · ส่งมอบงาน · ขอคืนหลักประกัน): แก้ได้เฉพาะหัวกระดาษและฟอนต์ เนื้อหาเป็นรูปแบบหนังสือราชการ</p>
      )}
      {canEdit && <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={async () => { if (await showConfirm("คืนค่าการออกแบบทั้งหมดเป็นค่าเริ่มต้น? (ย้อนกลับได้ก่อนบันทึก)")) change(() => normalizeDesign(null, profile.brandColor)); }}><RotateCcw size={13} /> คืนค่าเริ่มต้นทั้งหมด</PillButton>}
    </fieldset>
  );

  const shownTemplates = TEMPLATES.filter((t) => !family || (family === "pick" ? !t.family : t.family === family));
  const trialBar = trial && (
    <div className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-3 py-2 flex flex-wrap items-center gap-2">
      <Sparkles size={15} className="text-purple-200" />
      <span className="text-[13px] text-white">กำลังลองแม่แบบ <b>&quot;{trial.name}&quot;</b> — ยังไม่ได้ใช้จริง · ใช้กับ <Scope /></span>
      <div className="ml-auto flex gap-2">
        <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={() => setTrial(null)}>ยกเลิก</PillButton>
        <PillButton variant="confirm" className="h-8 px-4 text-xs" disabled={!canEdit} onClick={() => applyTemplate(trial)}><Check size={13} /> ใช้แม่แบบนี้</PillButton>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* แถบเอกสาร: ภาพย่อทุกชนิด กดสลับ · ประวัติ · ดูด้วยเอกสารจริง */}
      <GlassCard className="p-2.5 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TARGETS.map((t) => <DocChip key={t.type} type={t.type} active={docType === t.type} design={stripDesign || shown} profile={profile} onClick={() => setDocType(t.type)} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[12.5px] text-white/70">กำลังแก้: <b className="text-white">{def.title}</b></span>
          <span className="text-[11.5px] text-white/40 flex items-center gap-1">ป้าย <Scope /> = เปลี่ยนทุกเอกสาร · <Scope doc="เอกสารนี้" /> = เฉพาะเอกสารที่เลือก</span>
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

      <FreeLayoutEditor
        key={docType}
        docType={docType}
        theme={theme}
        docMeta={def.meta || []}
        docFields={def.fields || []}
        layout={per.free || defaultFreeLayout(docType, theme.font, def.meta)}
        onChange={(free) => setPer({ free })}
        letterhead={letterhead}
        onLetterheadChange={setLetterhead}
        letterOnly={isLetter}
        defaultColumns={defaultColumns}
        defaultSignatures={per.signatures?.length ? per.signatures : def.signatures}
        model={model}
        canEdit={canEdit && !trial}
        docTitle={def.title}
        history={{ undo, redo, canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0 }}
        panelTabs={[{ id: "tpl", label: "แม่แบบ", content: templatesPanel }, { id: "look", label: "หน้าตา", content: lookPanel }]}
        per={per}
        onPer={setPer}
        hint={trialBar}
      />

      {/* บันทึก: ลอยตามเมื่อมีการแก้ (Ctrl+S) */}
      {canEdit && dirty && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2 rounded-full border border-warning/40 bg-[#18181d]/95 backdrop-blur px-3 py-2 shadow-2xl">
          <span className="text-[12.5px] text-warning px-1">ยังไม่บันทึก</span>
          <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={async () => { if (await showConfirm("ยกเลิกการแก้ทั้งหมดที่ยังไม่บันทึก?")) change(() => JSON.parse(savedJson)); }}>ยกเลิกการแก้</PillButton>
          <PillButton variant="confirm" className="h-8 px-4 text-xs" disabled={saving} onClick={save}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึก (Ctrl+S)</PillButton>
        </div>
      )}

      {modal === "templates" && (
        <Modal title={`แม่แบบทั้งหมด ${TEMPLATES.length} แบบ — ภาพจาก "${def.title}" ของบริษัท`} onClose={() => setModal("")} wide>
          <div className="flex flex-wrap gap-1">
            {[["", `ทั้งหมด (${TEMPLATES.length})`], ["pick", "แนะนำ"], ...ARCHETYPES.map((a) => [a.id, a.name])].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFamily(id)} title={ARCHETYPES.find((a) => a.id === id)?.desc}
                className={cn("h-8 px-3 rounded-full text-[12px] border", family === id ? "border-nexus-teal/60 bg-nexus-teal/15 text-nexus-teal" : "border-white/10 text-white/60 hover:text-white")}>{label}</button>
            ))}
          </div>
          <p className="text-[12px] text-white/50">คลิกแม่แบบเพื่อลองดูบนกระดาษ (ยังไม่ใช้จริง) — ถูกใจแล้วกด &quot;ใช้แม่แบบนี้&quot;</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {shownTemplates.map((t) => <TemplateCard key={t.id} t={t} size="lg" active={(trial?.id || design.theme.templateId) === t.id} docType={docType} profile={profile} onPick={() => { setTrial(t); setModal(""); }} />)}
          </div>
        </Modal>
      )}
      {modal === "versions" && (
        <Modal title="ประวัติการออกแบบที่บันทึก" onClose={() => setModal("")}>
          <p className="text-[12px] text-white/50">เปิดเวอร์ชันเก่าเพื่อดูบนกระดาษ แล้วกด &quot;บันทึก&quot; ถ้าต้องการใช้ (เก็บล่าสุด 20 ครั้ง)</p>
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
