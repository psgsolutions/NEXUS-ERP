"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import { sampleModel } from "@/lib/documents/build";
import { missingTaxFields } from "@/lib/documents/profile";
import { toDateStr } from "@/lib/documents/format";
import type { DocumentProfile } from "@/lib/documents/model";

/**
 * ข้อมูลนิติบุคคลและหัวเอกสาร — ใช้กับทุกเอกสาร (ใบเสนอราคา ใบกำกับภาษี ใบเสร็จ ใบสั่งซื้อ ...)
 * แก้แล้วเห็นตัวอย่าง PDF ทันที (ยังไม่บันทึก)
 */
const COLORS = ["#1f6f5c", "#0d9488", "#1e3a8a", "#334155", "#7c2d12", "#6d28d9"];
const EMPTY: DocumentProfile = { name: "", nameEn: "", address: "", taxId: "", branchCode: "00000", branchName: "", phone: "", email: "", website: "", logo: "", brandColor: COLORS[0], footerNote: "", paymentInfo: "" };

/** ขนาดที่เก็บได้ (data URL) — เก็บในเอกสารบริษัทร่วมกับการออกแบบเอกสาร (รวมไม่เกิน ~1MB) */
const LOGO_MAX = 600_000;

/** ภาพมีพื้นโปร่งใสหรือไม่ (มีพิกเซลที่ไม่ทึบ) */
function hasAlpha(c: HTMLCanvasElement) {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
  return false;
}

/**
 * เตรียมโลโก้ให้คมเมื่อขยายบนเอกสาร: ด้านยาวสูงสุด 1200px (SVG วาดที่ 1200px)
 * พื้นโปร่งใส (PNG/WebP/SVG) เก็บเป็น PNG คงพื้นโปร่ง · ไฟล์ PNG เดิมเก็บ PNG เสมอ · รูปทึบอื่นเป็น JPEG คุณภาพสูง
 * ใหญ่เกินที่เก็บได้จะลดความละเอียดทีละขั้นจนพอดี
 */
async function prepareLogo(file: File): Promise<{ data: string; w: number; h: number; transparent: boolean }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const svg = file.type === "image/svg+xml";
    const W = img.naturalWidth || img.width || 1200, H = img.naturalHeight || img.height || 1200;
    let last = { data: "", w: 0, h: 0, transparent: false };
    for (const max of [1200, 1000, 800, 640, 480]) {
      const scale = svg ? max / Math.max(W, H) : Math.min(1, max / Math.max(W, H));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(W * scale)); c.height = Math.max(1, Math.round(H * scale));
      const g = c.getContext("2d")!;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      const transparent = hasAlpha(c);
      const data = transparent || file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.92);
      last = { data, w: c.width, h: c.height, transparent };
      if (data.length <= LOGO_MAX) return last;
    }
    return last;
  } finally { URL.revokeObjectURL(url); }
}

/** ขนาดและพื้นโปร่งใสของโลโก้ที่เก็บไว้ (แสดงข้อมูลใต้ภาพตัวอย่าง) */
async function logoInfo(data: string): Promise<{ w: number; h: number; transparent: boolean; kb: number }> {
  const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = data; });
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return { w: img.naturalWidth, h: img.naturalHeight, transparent: data.startsWith("data:image/png") && hasAlpha(c), kb: Math.round((data.length * 0.75) / 1024) };
}

const Field = ({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={cn("space-y-1", wide && "md:col-span-2")}>
    <label className="block text-[12px] font-semibold text-white/60 ml-1">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-white/35 ml-1">{hint}</p>}
  </div>
);

export function DocumentProfileSettings() {
  const { companyId, roles } = useAuth();
  const { showAlert } = useSystemDialog();
  const canEdit = can(roles, "settings:manage");
  const [form, setForm] = useState<DocumentProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<DocumentProfile>(EMPTY);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoMeta, setLogoMeta] = useState<{ w: number; h: number; transparent: boolean; kb: number } | null>(null);
  useEffect(() => { if (form.logo) logoInfo(form.logo).then(setLogoMeta).catch(() => setLogoMeta(null)); else setLogoMeta(null); }, [form.logo]);

  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) })
      .then((r) => r.json()).then((d) => { if (d.success) { setForm({ ...EMPTY, ...d.profile }); setPreview({ ...EMPTY, ...d.profile }); } setLoaded(true); });
  }, [companyId]);
  // ตัวอย่าง PDF อัปเดตหลังหยุดพิมพ์ครู่หนึ่ง
  useEffect(() => { const t = setTimeout(() => setPreview(form), 800); return () => clearTimeout(t); }, [form]);
  const model = useMemo(() => sampleModel(preview, toDateStr(new Date())), [preview]);

  const set = (patch: Partial<DocumentProfile>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const missing = missingTaxFields(form);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/document-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "save", profile: form }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setDirty(false);
      showAlert("บันทึกข้อมูลบริษัทและหัวเอกสารแล้ว เอกสารที่พิมพ์หลังจากนี้จะใช้ข้อมูลใหม่");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setSaving(false); }
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) return void showAlert("ใช้ไฟล์ PNG, JPG, WebP หรือ SVG", "ไฟล์ไม่รองรับ", "warning");
    const out = await prepareLogo(f).catch(() => null);
    if (!out) return void showAlert("เปิดไฟล์รูปนี้ไม่ได้ ลองบันทึกเป็น PNG ใหม่", "ไฟล์ไม่รองรับ", "warning");
    if (out.data.length > LOGO_MAX) return void showAlert("โลโก้ใหญ่เกินไป ลองไฟล์ที่เล็กลง", "ไฟล์ใหญ่เกินไป", "warning");
    set({ logo: out.data });
  };

  if (!loaded) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;

  return (
    <div className="flex flex-col 2xl:flex-row gap-4">
      <GlassCard accentColor="teal" className="p-5 space-y-5 2xl:w-[560px] flex-shrink-0 self-start">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-white">ข้อมูลนิติบุคคล</h2>
            <p className="text-[13px] text-white/50">ใช้พิมพ์บนทุกเอกสาร — ใบกำกับภาษีต้องมีชื่อ ที่อยู่ เลขผู้เสียภาษี และสาขาครบ · สีและรูปแบบเอกสาร ตั้งที่แท็บ &quot;ออกแบบเอกสาร&quot;</p>
          </div>
          {canEdit && <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold flex-shrink-0" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก</PillButton>}
        </div>
        {missing.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> ยังขาด: {missing.join(", ")} — ออกใบกำกับภาษีไม่ครบตามกฎหมาย
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* พื้นตารางหมากรุก: เห็นชัดว่าโลโก้พื้นโปร่งใสยังโปร่งอยู่ */}
          <button type="button" disabled={!canEdit} onClick={() => fileRef.current?.click()} className="w-40 h-28 rounded-2xl border-2 border-dashed border-white/15 hover:border-nexus-teal/50 flex items-center justify-center overflow-hidden flex-shrink-0 p-2"
            style={{ backgroundColor: "#ffffff", backgroundImage: "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)", backgroundSize: "14px 14px", backgroundPosition: "0 0,0 7px,7px -7px,-7px 0" }}>
            {form.logo ? <img src={form.logo} alt="โลโก้บริษัท" className="max-w-full max-h-full object-contain" /> : <ImagePlus size={24} className="text-black/30" />}
          </button>
          <div className="space-y-1.5">
            <p className="text-[13px] text-white/70">โลโก้บนหัวเอกสาร (PNG · JPG · WebP · SVG)</p>
            {logoMeta && <p className="text-[12px] text-white/50">{logoMeta.w}×{logoMeta.h} px · {logoMeta.kb} KB · {logoMeta.transparent ? <span className="text-nexus-teal">พื้นหลังโปร่งใส ✓</span> : "พื้นหลังทึบ"}</p>}
            <p className="text-[11px] text-white/40 leading-snug">เก็บละเอียดสูงสุด 1200px ขยายบนเอกสารได้คมชัด · ไฟล์พื้นโปร่งใสคงความโปร่งใสไว้ · ปรับขนาดบนเอกสารที่แท็บ &quot;ออกแบบเอกสาร&quot;</p>
            {canEdit && form.logo && <PillButton variant="ghost" className="h-8 px-3 text-xs text-danger" onClick={() => set({ logo: "" })}><Trash2 size={13} /> เอาโลโก้ออก</PillButton>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onLogo} />
          </div>
        </div>

        <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ชื่อบริษัท (ตามหนังสือรับรอง) *" wide><PillInput value={form.name} onChange={(e) => set({ name: e.target.value })} className="h-10" /></Field>
          <Field label="ชื่อภาษาอังกฤษ" wide><PillInput value={form.nameEn || ""} onChange={(e) => set({ nameEn: e.target.value })} className="h-10" /></Field>
          <Field label="ที่อยู่ *" wide><PillInput value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" className="h-10" /></Field>
          <Field label="เลขประจำตัวผู้เสียภาษี *"><PillInput value={form.taxId} onChange={(e) => set({ taxId: e.target.value.replace(/\D/g, "").slice(0, 13) })} inputMode="numeric" className="h-10 font-mono" /></Field>
          <Field label="สาขา" hint="00000 = สำนักงานใหญ่">
            <div className="flex gap-2">
              <PillInput value={form.branchCode} onChange={(e) => set({ branchCode: e.target.value.replace(/\D/g, "").slice(0, 5) })} inputMode="numeric" className="h-10 w-[100px] font-mono" />
              <PillInput value={form.branchName || ""} onChange={(e) => set({ branchName: e.target.value })} placeholder="ชื่อสาขา (ถ้ามี)" className="h-10 flex-1" />
            </div>
          </Field>
          <Field label="โทรศัพท์"><PillInput value={form.phone || ""} onChange={(e) => set({ phone: e.target.value })} className="h-10" /></Field>
          <Field label="อีเมล"><PillInput value={form.email || ""} onChange={(e) => set({ email: e.target.value })} className="h-10" /></Field>
          <Field label="เว็บไซต์" wide><PillInput value={form.website || ""} onChange={(e) => set({ website: e.target.value })} className="h-10" /></Field>
          <Field label="ข้อมูลการชำระเงิน" hint="เช่น ธนาคาร เลขที่บัญชี ชื่อบัญชี (แสดงท้ายเอกสารขาย)" wide><PillInput value={form.paymentInfo || ""} onChange={(e) => set({ paymentInfo: e.target.value })} className="h-10" /></Field>
          <Field label="ข้อความท้ายกระดาษ" wide><PillInput value={form.footerNote || ""} onChange={(e) => set({ footerNote: e.target.value })} placeholder="เช่น ขอบคุณที่ใช้บริการ" className="h-10" /></Field>
        </fieldset>
      </GlassCard>

      <div className="flex-1 min-w-0 h-[860px] rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-white/[0.02]">
        <div className="px-4 pt-3 text-[13px] text-white/60">ตัวอย่างเอกสาร (อัปเดตตามที่แก้ ยังไม่บันทึก)</div>
        <DocumentPdfViewer model={model} className="flex-1" />
      </div>
    </div>
  );
}
