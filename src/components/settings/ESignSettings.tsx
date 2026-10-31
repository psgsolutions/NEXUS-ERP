"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Loader2, PenLine, Save, Stamp, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import { DESIGNABLE_DOCS, sampleModelFor } from "@/lib/documents/build";
import { EMPTY_SIGNING, STAMP_MAX, applySigning, type SigningConfig } from "@/lib/documents/esign";
import { toDateStr } from "@/lib/documents/format";
import type { DocumentProfile } from "@/lib/documents/model";
import { CHECKER, prepareMark } from "./signature-tools";

/**
 * ตราประทับและช่องลงนาม (ผู้ดูแลบริษัท) — ตั้งรูปตราบริษัท แล้วเลือกว่าเอกสารชนิดไหน ช่องลงนามไหน ใส่ลายเซ็นของใคร/ประทับตรา
 * ลายเซ็นเป็นของผู้ใช้แต่ละคน (ผูกกับรหัสผู้ใช้) ตั้งที่หน้า "ลายเซ็นของฉัน" — เจ้าของตั้งเอง หรือฝ่ายบุคคลตั้งให้
 * ระบบใส่ให้เฉพาะเอกสารที่ออกจริง (ไม่ใช่ฉบับร่าง/รออนุมัติ/ยกเลิก) · ตอนสร้างใบเสนอราคาเลือกไม่ใส่ได้
 */
export function ESignSettings() {
  const { companyId, roles } = useAuth();
  const { showAlert } = useSystemDialog();
  const canEdit = can(roles, "settings:manage");
  const [cfg, setCfg] = useState<SigningConfig>(EMPTY_SIGNING);
  const [profile, setProfile] = useState<DocumentProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewType, setPreviewType] = useState(DESIGNABLE_DOCS[0].type);
  const stampRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId || !canEdit) { setLoaded(true); return; }
    const post = (url: string) => apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) }).then((r) => r.json());
    Promise.all([post("/api/settings/document-signing"), post("/api/settings/document-profile")]).then(([s, p]) => {
      if (s.success) setCfg(s.signing);
      if (p.success) setProfile(p.profile);
    }).finally(() => setLoaded(true));
  }, [companyId, canEdit]);

  const set = (patch: Partial<SigningConfig>) => { setCfg((c) => ({ ...c, ...patch })); setDirty(true); };
  const rule = (type: string, label: string) => cfg.assign[type]?.[label] || {};
  const setRule = (type: string, label: string, patch: { signer?: string; stamp?: boolean }) => {
    const next = { ...rule(type, label), ...patch };
    if (!next.signer) delete next.signer;
    if (!next.stamp) delete next.stamp;
    const slots = { ...(cfg.assign[type] || {}) };
    if (next.signer || next.stamp) slots[label] = next; else delete slots[label];
    const assign = { ...cfg.assign };
    if (Object.keys(slots).length) assign[type] = slots; else delete assign[type];
    set({ assign });
  };

  const onStamp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { set({ stamp: await prepareMark(f, STAMP_MAX, 700) }); } catch (err: any) { showAlert(err.message || "เปิดไฟล์รูปนี้ไม่ได้", "ไฟล์ไม่รองรับ", "warning"); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/document-signing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "saveCompany", signing: { stamp: cfg.stamp, stampSize: cfg.stampSize, assign: cfg.assign } }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setCfg(d.signing); setDirty(false);
      showAlert("บันทึกตราประทับและช่องลงนามแล้ว เอกสารที่ออกจริงจะพิมพ์พร้อมลายเซ็น/ตราตามที่ตั้งไว้");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setSaving(false); }
  };

  const model = useMemo(() => {
    if (!profile) return null;
    const def = DESIGNABLE_DOCS.find((d) => d.type === previewType)!;
    return applySigning(sampleModelFor(previewType, profile, toDateStr(new Date())), cfg, def.signatures);
  }, [profile, cfg, previewType]);

  if (!loaded) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;
  if (!canEdit) return <GlassCard className="p-6 text-[13px] text-white/60">ตราประทับและช่องลงนามตั้งได้เฉพาะผู้ดูแลบริษัท · ลายเซ็นของคุณตั้งได้ที่ <Link href="/my-signature" className="text-nexus-teal hover:underline">ลายเซ็นของฉัน</Link></GlassCard>;

  return (
    <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
      <div className="space-y-4 xl:w-[540px] 2xl:w-[620px] flex-shrink-0">
        <GlassCard accentColor="teal" className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold text-white">ตราประทับและช่องลงนาม</h2>
              <p className="text-[13px] text-white/50">ใส่ให้อัตโนมัติเฉพาะเอกสารที่ออกจริง — ฉบับร่าง รออนุมัติ และเอกสารยกเลิกไม่มีลายเซ็น/ตรา</p>
            </div>
            <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold flex-shrink-0" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก</PillButton>
          </div>

          {/* ตราประทับบริษัท (ผู้ดูแลบริษัท) */}
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => stampRef.current?.click()} className="w-32 h-32 rounded-2xl border-2 border-dashed border-white/15 hover:border-nexus-teal/50 flex items-center justify-center overflow-hidden flex-shrink-0 p-2" style={CHECKER}>
              {cfg.stamp ? <img src={cfg.stamp} alt="ตราประทับบริษัท" className="max-w-full max-h-full object-contain" /> : <Stamp size={26} className="text-black/30" />}
            </button>
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-[13px] text-white/80 font-semibold">ตราประทับบริษัท</p>
              <p className="text-[11.5px] text-white/45 leading-snug">สแกน/ถ่ายรูปตราบนกระดาษขาว ระบบทำพื้นขาวเป็นโปร่งใสและตัดขอบให้ · ไฟล์ PNG พื้นโปร่งใสได้ผลดีที่สุด</p>
              <label className="block text-[11.5px] text-white/55">ขนาดบนเอกสาร {cfg.stampSize} pt
                <input type="range" min={40} max={140} step={2} value={cfg.stampSize} onChange={(e) => set({ stampSize: Number(e.target.value) })} className="w-full accent-[#0d9488] h-7" />
              </label>
              <div className="flex gap-2">
                <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => stampRef.current?.click()}><ImagePlus size={13} /> {cfg.stamp ? "เปลี่ยนรูปตรา" : "อัปโหลดตรา"}</PillButton>
                {cfg.stamp && <PillButton variant="ghost" className="h-8 px-3 text-xs text-danger" onClick={() => set({ stamp: "" })}><Trash2 size={13} /> เอาตราออก</PillButton>}
              </div>
              <input ref={stampRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onStamp} />
            </div>
          </div>
        </GlassCard>

        {/* ลายเซ็นที่มีในบริษัท (อ่านอย่างเดียว — จัดการที่หน้าลายเซ็น) */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-bold text-white">ลายเซ็นในบริษัท ({cfg.signers.length})</p>
            <Link href="/my-signature" className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1"><PenLine size={12} /> จัดการลายเซ็น</Link>
          </div>
          <p className="text-[12px] text-white/45">ลายเซ็นผูกกับบัญชีผู้ใช้ — เจ้าของตั้งเองที่ &quot;ลายเซ็นของฉัน&quot; หรือฝ่ายบุคคลตั้งให้</p>
          {cfg.signers.length === 0 && <p className="text-[12.5px] text-white/45">ยังไม่มีลายเซ็นในบริษัท</p>}
          <div className="grid grid-cols-2 gap-2">
            {cfg.signers.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 p-2 flex items-center gap-2">
                <div className="w-20 h-9 rounded flex items-center justify-center overflow-hidden flex-shrink-0" style={CHECKER}><img src={s.image} alt={`ลายเซ็น ${s.name}`} className="max-w-full max-h-full object-contain" /></div>
                <div className="min-w-0">
                  <p className="text-[12.5px] text-white truncate">{s.name}</p>
                  <p className={cn("text-[11px] truncate", s.userId ? "text-white/45" : "text-amber-200/80")}>{s.userId ? s.position || "-" : "ยังไม่ผูกกับผู้ใช้"}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ใส่ในเอกสารไหน ช่องไหน */}
        <GlassCard className="p-5 space-y-3">
          <div>
            <p className="text-[14px] font-bold text-white">ใส่ในเอกสารและช่องลงนาม</p>
            <p className="text-[12px] text-white/45">เลือกลายเซ็นของแต่ละช่อง และช่องที่ประทับตรา · ช่องที่ต้องเซ็นจริง (เช่น ลูกค้า ผู้รับของ) ปล่อยว่างไว้ · คลิกชื่อเอกสารเพื่อดูตัวอย่าง</p>
          </div>
          {DESIGNABLE_DOCS.map((d) => (
            <div key={d.type} className={cn("rounded-xl border p-2.5 space-y-1.5", previewType === d.type ? "border-nexus-teal/40 bg-nexus-teal/[0.04]" : "border-white/10")}>
              <button type="button" onClick={() => setPreviewType(d.type)} className="text-[13px] font-semibold text-white hover:text-nexus-teal">{d.title}</button>
              {d.signatures.map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[130px] text-[12px] text-white/65 truncate" title={label}>{label}</span>
                  <div className="flex-1 min-w-0">
                    <PillSelect value={rule(d.type, label).signer || ""} onChange={(e) => { setPreviewType(d.type); setRule(d.type, label, { signer: String(e.target.value) || undefined }); }} className="h-8 w-full text-[12px]">
                      <option value="">ไม่ใส่ลายเซ็น (เซ็นจริง)</option>
                      {cfg.signers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.position ? ` · ${s.position}` : ""}</option>)}
                    </PillSelect>
                  </div>
                  <PillCheckbox label="ตรา" disabled={!cfg.stamp} checked={!!rule(d.type, label).stamp} onChange={(e) => { setPreviewType(d.type); setRule(d.type, label, { stamp: e.target.checked }); }} />
                </div>
              ))}
            </div>
          ))}
        </GlassCard>
      </div>

      <div className="flex-1 min-w-0 h-[880px] xl:h-[calc(100vh-120px)] rounded-2xl border border-white/10 overflow-hidden flex flex-col bg-white/[0.02] xl:sticky xl:top-20">
        <div className="px-4 pt-3 text-[13px] text-white/60">ตัวอย่าง: {DESIGNABLE_DOCS.find((d) => d.type === previewType)?.title} (ตามที่ตั้ง ยังไม่บันทึก)</div>
        {model && <DocumentPdfViewer model={model} className="flex-1" />}
      </div>
    </div>
  );
}
