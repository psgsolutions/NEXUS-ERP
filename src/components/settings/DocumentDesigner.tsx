"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Palette, RotateCcw, Save, Sparkles, Wand2, LayoutTemplate, Move } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { InfoTip } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import { DESIGNABLE_DOCS, sampleModelFor } from "@/lib/documents/build";
import { toDateStr } from "@/lib/documents/format";
import type { DocumentProfile } from "@/lib/documents/model";
import {
  FONT_LABELS, TEMPLATES, defaultFreeLayout, normalizeDesign, applyLayoutToAll,
  type DocTheme, type DocumentDesign, type FontFamily, type PerDocDesign,
} from "@/lib/documents/design";
import { FreeLayoutEditor } from "./FreeLayoutEditor";

/**
 * ออกแบบหน้าเอกสาร (ตั้งค่า › ออกแบบเอกสาร)
 *  - โหมดธีม: เลือกแม่แบบ ปรับฟอนต์ สี หัวเอกสาร ตาราง ยอดรวม ช่องลงนาม — ใช้กับทุกเอกสารของบริษัท
 *    + ปรับเฉพาะชนิดเอกสาร (ชื่อ ข้อความ คอลัมน์ ช่องลงนาม) · AI ช่วยแต่งธีมจากคำบรรยาย/โลโก้
 *  - โหมดลากวาง: วางกล่องได้อิสระต่อชนิดเอกสาร แล้วใช้ผังเดียวกันกับทุกเอกสารได้
 * ตัวอย่าง PDF อัปเดตตามที่แก้ (ยังไม่บันทึก)
 */

const Row = ({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[12px] font-semibold text-white/60 ml-1 flex items-center">{label}{tip && <InfoTip text={tip} />}</label>
    {children}
  </div>
);

const ColorField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-lg bg-transparent border border-white/10 cursor-pointer" aria-label="เลือกสี" />
    <PillInput value={value} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} className="h-9 w-[110px] font-mono text-sm" />
  </div>
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
  // ทำให้เข้มพอให้ตัวอักษรขาวอ่านได้
  const k = Math.min(1, 150 / Math.max(r / n, gg / n, b / n));
  const hex = (v: number) => Math.round((v / n) * k).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(gg)}${hex(b)}`;
}

export function DocumentDesigner() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "settings:manage");
  const [profile, setProfile] = useState<DocumentProfile | null>(null);
  const [design, setDesign] = useState<DocumentDesign>(normalizeDesign(null));
  const [docType, setDocType] = useState(DESIGNABLE_DOCS[0].type);
  const [mode, setMode] = useState<"theme" | "free">("theme");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiUseLogo, setAiUseLogo] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [preview, setPreview] = useState<DocumentDesign | null>(null);

  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) })
      .then((r) => r.json()).then((d) => { if (d.success) { setProfile(d.profile); setDesign(normalizeDesign(d.profile.design, d.profile.brandColor)); } });
  }, [companyId]);
  // ตัวอย่าง PDF อัปเดตหลังหยุดแก้ครู่หนึ่ง
  useEffect(() => { const t = setTimeout(() => setPreview(design), 700); return () => clearTimeout(t); }, [design]);

  const theme = design.theme;
  const per: PerDocDesign = design.perDoc[docType] || {};
  const def = DESIGNABLE_DOCS.find((d) => d.type === docType)!;
  const setTheme = (patch: Partial<DocTheme>) => { setDesign((d) => ({ ...d, theme: { ...d.theme, ...patch } })); setDirty(true); };
  const setPer = (patch: Partial<PerDocDesign>) => { setDesign((d) => ({ ...d, perDoc: { ...d.perDoc, [docType]: { ...(d.perDoc[docType] || {}), ...patch } } })); setDirty(true); };
  const model = useMemo(() => (profile && preview ? sampleModelFor(docType, { ...profile, design: preview }, toDateStr(new Date())) : null), [profile, preview, docType]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "saveDesign", design }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setDesign(d.design); setDirty(false);
      showAlert("บันทึกการออกแบบแล้ว — เอกสารที่พิมพ์หลังจากนี้ใช้รูปแบบใหม่ทั้งหมด");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setSaving(false); }
  };

  const runAi = async () => {
    setAiBusy(true);
    try {
      const res = await apiFetch("/api/ai/document-theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, prompt: aiPrompt, logo: aiUseLogo ? profile?.logo || "" : "", current: theme }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "AI แต่งธีมไม่สำเร็จ");
      setTheme(d.theme);
      showAlert("AI ปรับธีมให้แล้ว — ดูตัวอย่างด้านขวา ถ้าพอใจกดบันทึก (ใช้กับทุกเอกสาร)");
    } catch (e: any) { showAlert(e.message, "AI แต่งธีมไม่สำเร็จ", "error"); } finally { setAiBusy(false); }
  };
  const fromLogo = async () => {
    if (!profile?.logo) return showAlert("ยังไม่มีโลโก้ — อัปโหลดที่แท็บข้อมูลนิติบุคคลก่อน", "ไม่มีโลโก้", "warning");
    const c = await logoColor(profile.logo).catch(() => null);
    if (!c) return showAlert("ดึงสีจากโลโก้ไม่ได้ (โลโก้เป็นสีขาวดำ)", "ไม่พบสีเด่น", "warning");
    setTheme({ primary: c, accent: c });
  };

  if (!profile) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white/5 p-1 border border-white/10">
          {([["theme", "ออกแบบด้วยธีม", <Palette key="p" size={14} />], ["free", "ลากวางอิสระ", <Move key="m" size={14} />]] as const).map(([m, label, icon]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-9 px-4 rounded-full text-[13px] font-semibold flex items-center gap-1.5", mode === m ? "bg-nexus-teal/15 text-nexus-teal" : "text-white/55 hover:text-white")}>{icon}{label}</button>
          ))}
        </div>
        <div className="w-[230px]">
          <PillSelect value={docType} onChange={(e) => setDocType(String(e.target.value))} className="h-9 w-full">
            {DESIGNABLE_DOCS.map((d) => <option key={d.type} value={d.type}>{d.title}</option>)}
          </PillSelect>
        </div>
        <span className="text-[12px] text-white/45">ธีมใช้กับทุกเอกสาร · การปรับรายเอกสารใช้กับ &quot;{def.title}&quot;</span>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-[12px] text-warning">ยังไม่บันทึก</span>}
          {canEdit && <PillButton variant="confirm" className="h-9 px-5 text-xs" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึกการออกแบบ</PillButton>}
        </div>
      </div>

      {mode === "free" ? (
        <FreeLayoutEditor
          layout={per.free || defaultFreeLayout()}
          onChange={(free) => setPer({ free })}
          model={model}
          canEdit={canEdit}
          docTitle={def.title}
          onApplyAll={async () => {
            if (!(await showConfirm(`ใช้ผังของ "${def.title}" กับเอกสารทุกชนิด? (ผังเดิมของเอกสารอื่นจะถูกแทนที่)`))) return;
            setDesign((d) => applyLayoutToAll(d, docType, DESIGNABLE_DOCS.map((x) => x.type))); setDirty(true);
          }}
        />
      ) : (
        <div className="flex flex-col 2xl:flex-row gap-4">
          <fieldset disabled={!canEdit} className="2xl:w-[560px] flex-shrink-0 space-y-4">
            <GlassCard className="p-4 space-y-3">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><LayoutTemplate size={16} className="text-nexus-teal" /> แม่แบบ</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setTheme({ ...t.theme }); }} className={cn("text-left rounded-xl border p-2.5 transition-colors", theme.templateId === t.id ? "border-nexus-teal/60 bg-nexus-teal/10" : "border-white/10 hover:border-white/25")}>
                    <div className="flex gap-1 mb-1.5">{[t.theme.primary, t.theme.accent, t.theme.text].map((c, i) => <span key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />)}</div>
                    <p className="text-[13px] font-bold text-white">{t.name}</p>
                    <p className="text-[11px] text-white/50 leading-snug">{t.description}</p>
                  </button>
                ))}
              </div>
            </GlassCard>

            <GlassCard accentColor="purple" className="p-4 space-y-3">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><Sparkles size={16} className="text-purple-300" /> ให้ AI ช่วยออกแบบ</h3>
              <PillInput value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="เช่น ดูหรู ทางการ โทนน้ำเงินเข้ม เหมาะส่งหน่วยงานราชการ" className="w-full h-10" />
              <div className="flex flex-wrap items-center gap-3">
                <PillCheckbox label="ใช้สีและรูปทรงจากโลโก้บริษัท" checked={aiUseLogo} onChange={(e) => setAiUseLogo(e.target.checked)} />
                <PillButton variant="primary" className="h-9 px-4 text-xs ml-auto" disabled={aiBusy || (!aiPrompt.trim() && !(aiUseLogo && profile.logo))} onClick={runAi}>{aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} ออกแบบให้</PillButton>
                <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={fromLogo}>ดึงสีจากโลโก้</PillButton>
              </div>
              <p className="text-[12px] text-white/45">ธีมที่ได้ใช้กับเอกสารทุกชนิดของบริษัท จึงได้สไตล์เดียวกันทั้งชุด</p>
            </GlassCard>

            <GlassCard className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label="ฟอนต์"><PillSelect value={theme.font} onChange={(e) => setTheme({ font: e.target.value as FontFamily })} className="h-9 w-full">{(Object.keys(FONT_LABELS) as FontFamily[]).map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</PillSelect></Row>
              <Row label={`ขนาดตัวอักษร (${theme.fontSize} pt)`}><input type="range" min={7.5} max={12} step={0.5} value={theme.fontSize} onChange={(e) => setTheme({ fontSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
              <Row label="สีหลัก"><ColorField value={theme.primary} onChange={(v) => setTheme({ primary: v })} /></Row>
              <Row label="สีรอง" tip="ใช้กับพื้นจำนวนเงินตัวอักษร แถวสลับสี"><ColorField value={theme.accent} onChange={(v) => setTheme({ accent: v })} /></Row>
              <Row label="สีตัวอักษร"><ColorField value={theme.text} onChange={(v) => setTheme({ text: v })} /></Row>
              <Row label="สีตัวอักษรรอง"><ColorField value={theme.muted} onChange={(v) => setTheme({ muted: v })} /></Row>
              <Row label="หัวเอกสาร"><PillSelect value={theme.header} onChange={(e) => setTheme({ header: e.target.value as any })} className="h-9 w-full"><option value="logo-left">โลโก้ซ้าย</option><option value="logo-right">โลโก้ขวา</option><option value="centered">กึ่งกลาง (แบบหนังสือ)</option><option value="banner">แถบสีเต็มความกว้าง</option></PillSelect></Row>
              <Row label={`ขนาดโลโก้ (${theme.logoSize} pt)`}><input type="range" min={32} max={120} step={4} value={theme.logoSize} onChange={(e) => setTheme({ logoSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
              <Row label="กรอบข้อมูลลูกค้า"><PillSelect value={theme.party} onChange={(e) => setTheme({ party: e.target.value as any })} className="h-9 w-full"><option value="accent-bar">แถบสีด้านซ้าย</option><option value="boxed">กรอบเต็ม</option><option value="plain">ไม่มีกรอบ</option></PillSelect></Row>
              <Row label="ตารางรายการ"><PillSelect value={theme.table} onChange={(e) => setTheme({ table: e.target.value as any })} className="h-9 w-full"><option value="tint">หัวตารางสีอ่อน</option><option value="solid">หัวตารางสีทึบ</option><option value="lines">เส้นบาง</option><option value="grid">ตารางเส้นครบ</option><option value="zebra">แถวสลับสี</option></PillSelect></Row>
              <Row label="ยอดรวมทั้งสิ้น"><PillSelect value={theme.totals} onChange={(e) => setTheme({ totals: e.target.value as any })} className="h-9 w-full"><option value="solid">พื้นสีเต็ม</option><option value="outline">กรอบสี</option><option value="plain">เส้นคั่น</option></PillSelect></Row>
              <Row label="ช่องลงนาม"><PillSelect value={theme.signatures} onChange={(e) => setTheme({ signatures: e.target.value as any })} className="h-9 w-full"><option value="line">เส้นลงนาม</option><option value="box">กรอบลงนาม</option></PillSelect></Row>
              <Row label={`ระยะขอบกระดาษ (${theme.margin} pt)`}><input type="range" min={20} max={60} step={2} value={theme.margin} onChange={(e) => setTheme({ margin: Number(e.target.value) })} className="w-full accent-[#0d9488] h-9" /></Row>
              <Row label="ลายน้ำ" tip="ข้อความจาง ๆ กลางหน้า เช่น ชื่อบริษัท (เอกสารยกเลิก/ตัวอย่างแสดงลายน้ำของระบบแทน)"><PillInput value={theme.watermark} onChange={(e) => setTheme({ watermark: e.target.value })} placeholder="ไม่มี" className="h-9 w-full" /></Row>
              <div className="md:col-span-2 flex flex-wrap gap-4">
                <PillCheckbox label="มุมโค้ง" checked={theme.rounded} onChange={(e) => setTheme({ rounded: e.target.checked })} />
                <PillCheckbox label="แสดงเลขหน้า" checked={theme.showPageNumber} onChange={(e) => setTheme({ showPageNumber: e.target.checked })} />
              </div>
            </GlassCard>

            <GlassCard accentColor="blue" className="p-4 space-y-3">
              <h3 className="text-[15px] font-bold text-white">ปรับเฉพาะ &quot;{def.title}&quot;</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Row label="ชื่อเอกสาร"><PillInput value={per.title || ""} placeholder={def.title} onChange={(e) => setPer({ title: e.target.value })} className="h-9 w-full" /></Row>
                <Row label="ชื่อภาษาอังกฤษ"><PillInput value={per.titleEn ?? ""} placeholder={def.titleEn} onChange={(e) => setPer({ titleEn: e.target.value })} className="h-9 w-full" /></Row>
                <Row label="ข้อความท้ายเอกสาร (เพิ่ม)"><PillInput value={per.extraNote || ""} placeholder="เช่น เงื่อนไขการรับประกัน" onChange={(e) => setPer({ extraNote: e.target.value })} className="h-9 w-full" /></Row>
                <Row label="ช่องลงนาม (คั่นด้วย ,)"><PillInput value={(per.signatures || []).join(", ")} placeholder={def.signatures.join(", ")} onChange={(e) => setPer({ signatures: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="h-9 w-full" /></Row>
              </div>
              <div className="flex flex-wrap gap-4">
                <span className="text-[12px] text-white/60">ซ่อนคอลัมน์:</span>
                {([["code", "รหัส"], ["unit", "หน่วย"], ["discount", "ส่วนลด"], ["price", "ราคา/หน่วย"]] as const).map(([k, label]) => (
                  <PillCheckbox key={k} label={label} checked={(per.hideColumns || []).includes(k)} onChange={(e) => setPer({ hideColumns: e.target.checked ? [...(per.hideColumns || []), k] : (per.hideColumns || []).filter((x) => x !== k) })} />
                ))}
              </div>
              <p className="text-[12px] text-white/45">ข้อมูลที่กฎหมายกำหนด (ผู้ขาย ผู้ซื้อ เลขผู้เสียภาษี เลขที่ วันที่ รายการ ภาษี) แสดงเสมอ ปิดไม่ได้</p>
            </GlassCard>
            {canEdit && <PillButton variant="ghost" className="h-9 px-4 text-xs" onClick={() => { setDesign(normalizeDesign(null, profile.brandColor)); setDirty(true); }}><RotateCcw size={13} /> คืนค่าเริ่มต้นทั้งหมด</PillButton>}
          </fieldset>

          <div className="flex-1 min-w-0 h-[920px] rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-white/[0.02]">
            <div className="px-4 pt-3 text-[13px] text-white/60">ตัวอย่าง &quot;{def.title}&quot; (อัปเดตตามที่แก้ ยังไม่บันทึก)</div>
            {model && <DocumentPdfViewer model={model} className="flex-1" />}
          </div>
        </div>
      )}
    </div>
  );
}
