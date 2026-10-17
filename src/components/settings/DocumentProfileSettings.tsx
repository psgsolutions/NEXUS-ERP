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

/** ย่อโลโก้ให้ด้านยาวไม่เกิน 480px (PNG คงพื้นโปร่งใส) */
async function shrinkLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
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
    if (!/^image\/(png|jpeg)$/.test(f.type)) return void showAlert("ใช้ไฟล์ PNG หรือ JPG", "ไฟล์ไม่รองรับ", "warning");
    const data = await shrinkLogo(f);
    if (data.length > 380_000) return void showAlert("โลโก้ใหญ่เกินไป ลองไฟล์ที่เล็กลง", "ไฟล์ใหญ่เกินไป", "warning");
    set({ logo: data });
  };

  if (!loaded) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;

  return (
    <div className="flex flex-col 2xl:flex-row gap-4">
      <GlassCard accentColor="teal" className="p-5 space-y-5 2xl:w-[560px] flex-shrink-0 self-start">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-white">ข้อมูลนิติบุคคลและหัวเอกสาร</h2>
            <p className="text-[13px] text-white/50">ใช้พิมพ์บนทุกเอกสาร — ใบกำกับภาษีต้องมีชื่อ ที่อยู่ เลขผู้เสียภาษี และสาขาครบ</p>
          </div>
          {canEdit && <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold flex-shrink-0" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก</PillButton>}
        </div>
        {missing.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> ยังขาด: {missing.join(", ")} — ออกใบกำกับภาษีไม่ครบตามกฎหมาย
          </div>
        )}

        <div className="flex items-center gap-4">
          <button type="button" disabled={!canEdit} onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/15 hover:border-nexus-teal/50 flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
            {form.logo ? <img src={form.logo} alt="โลโก้บริษัท" className="max-w-full max-h-full object-contain" /> : <ImagePlus size={24} className="text-black/30" />}
          </button>
          <div className="space-y-2">
            <p className="text-[13px] text-white/70">โลโก้บนหัวเอกสาร (PNG/JPG)</p>
            {canEdit && form.logo && <PillButton variant="ghost" className="h-8 px-3 text-xs text-danger" onClick={() => set({ logo: "" })}><Trash2 size={13} /> เอาโลโก้ออก</PillButton>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
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
          <Field label="สีหลักของเอกสาร" wide>
            <div className="flex items-center gap-2 h-10">
              {COLORS.map((c) => <button key={c} type="button" onClick={() => set({ brandColor: c })} className={cn("w-8 h-8 rounded-full border-2", form.brandColor === c ? "border-white" : "border-transparent")} style={{ background: c }} aria-label={`สี ${c}`} />)}
            </div>
          </Field>
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
