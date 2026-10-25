"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, ImagePlus, Loader2, PenLine, Plus, Save, ShieldCheck, Stamp, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";
import { DESIGNABLE_DOCS, sampleModelFor } from "@/lib/documents/build";
import { EMPTY_SIGNING, SIGN_MAX, STAMP_MAX, MAX_SIGNERS, applySigning, type Signer, type SigningConfig } from "@/lib/documents/esign";
import { toDateStr } from "@/lib/documents/format";
import type { DocumentProfile } from "@/lib/documents/model";

/**
 * ลายเซ็นและตราประทับอิเล็กทรอนิกส์ — ผู้ดูแลระบบตั้งรูปตรา/ลายเซ็น แล้วเลือกว่าเอกสารชนิดไหน ช่องลงนามไหน ใส่ของใคร
 * ระบบใส่ให้เฉพาะเอกสารที่ออกจริง (ไม่ใช่ฉบับร่าง/รออนุมัติ/ยกเลิก) · ตอนพิมพ์เลือกไม่ใส่ได้
 */
type EditSigner = Signer & { consent?: boolean };
type Cfg = Omit<SigningConfig, "signers"> & { signers: EditSigner[] };
const CHECKER = { backgroundColor: "#ffffff", backgroundImage: "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)", backgroundSize: "14px 14px", backgroundPosition: "0 0,0 7px,7px -7px,-7px 0" };

/**
 * เตรียมรูปตรา/ลายเซ็น: ย่อด้านยาวไม่เกิน max px · เก็บ PNG คงพื้นโปร่ง
 * dropWhite = ทำพื้นขาว/เทาอ่อนเป็นโปร่งใส (รูปสแกนหรือถ่ายจากกระดาษ) แล้วตัดขอบว่างออก
 */
async function prepareMark(src: File | string, limit: number, max = 600, dropWhite = true): Promise<string> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    for (const m of [max, 480, 360, 260]) {
      const k = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, c.width, c.height);
      const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let i = 0; i < d.length; i += 4) {
        if (dropWhite) {
          const light = Math.min(d[i], d[i + 1], d[i + 2]);
          // ขาว → โปร่งใส · เกือบขาว → โปร่งบางส่วน (ขอบหมึกเนียน)
          if (light > 235) d[i + 3] = 0; else if (light > 200) d[i + 3] = Math.min(d[i + 3], Math.round(((235 - light) / 35) * 255));
        }
        if (d[i + 3] > 16) { const p = i / 4, x = p % c.width, y = (p - x) / c.width; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      g.putImageData(px, 0, 0);
      let out = c;
      if (x1 >= x0 && y1 >= y0) {
        const pad = 4, w = Math.min(c.width, x1 - x0 + 1 + pad * 2), h = Math.min(c.height, y1 - y0 + 1 + pad * 2);
        out = document.createElement("canvas"); out.width = w; out.height = h;
        out.getContext("2d")!.drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), w, h, 0, 0, w, h);
      }
      const data = out.toDataURL("image/png");
      if (data.length <= limit) return data;
    }
    throw new Error("รูปใหญ่เกินไป ลองไฟล์ที่เล็กลง");
  } finally { if (typeof src !== "string") URL.revokeObjectURL(url); }
}

/** ช่องเซ็นด้วยเมาส์/นิ้ว */
function SignPad({ onDone, onCancel }: { onDone: (data: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height }; };
  const down = (e: React.PointerEvent) => { ref.current!.setPointerCapture(e.pointerId); last.current = pos(e); };
  const move = (e: React.PointerEvent) => {
    if (!last.current) return;
    const p = pos(e), g = ref.current!.getContext("2d")!;
    g.strokeStyle = "#0f2a6b"; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    last.current = p; setDrawn(true);
  };
  const clear = () => { ref.current!.getContext("2d")!.clearRect(0, 0, 900, 300); setDrawn(false); };
  return (
    <div className="space-y-2">
      <canvas ref={ref} width={900} height={300} onPointerDown={down} onPointerMove={move} onPointerUp={() => (last.current = null)} onPointerLeave={() => (last.current = null)}
        className="w-full aspect-[3/1] rounded-xl bg-white touch-none cursor-crosshair border border-white/10" aria-label="ช่องเซ็นชื่อ" />
      <div className="flex gap-2 justify-end">
        <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={clear}><Eraser size={13} /> ล้าง</PillButton>
        <PillButton variant="ghost" className="h-8 px-3 text-xs" onClick={onCancel}>ยกเลิก</PillButton>
        <PillButton variant="confirm" className="h-8 px-3 text-xs" disabled={!drawn} onClick={() => onDone(ref.current!.toDataURL("image/png"))}>ใช้ลายเซ็นนี้</PillButton>
      </div>
    </div>
  );
}

export function ESignSettings() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "settings:manage");
  const [cfg, setCfg] = useState<Cfg>(EMPTY_SIGNING);
  const [profile, setProfile] = useState<DocumentProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState(DESIGNABLE_DOCS[0].type);
  const stampRef = useRef<HTMLInputElement>(null);
  const signRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string>("");

  useEffect(() => {
    if (!companyId || !canEdit) { setLoaded(true); return; }
    const post = (url: string) => apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) }).then((r) => r.json());
    Promise.all([post("/api/settings/document-signing"), post("/api/settings/document-profile")]).then(([s, p]) => {
      if (s.success) setCfg(s.signing);
      if (p.success) setProfile(p.profile);
    }).finally(() => setLoaded(true));
  }, [companyId, canEdit]);

  const set = (patch: Partial<Cfg>) => { setCfg((c) => ({ ...c, ...patch })); setDirty(true); };
  const setSigner = (id: string, patch: Partial<EditSigner>) => set({ signers: cfg.signers.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
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
  const onSign = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !uploadFor.current) return;
    try { setSigner(uploadFor.current, { image: await prepareMark(f, SIGN_MAX, 700), consent: false, consentAt: undefined, consentBy: undefined }); } catch (err: any) { showAlert(err.message || "เปิดไฟล์รูปนี้ไม่ได้", "ไฟล์ไม่รองรับ", "warning"); }
  };
  const addSigner = () => set({ signers: [...cfg.signers, { id: `s-${Date.now().toString(36)}`, name: "", position: "", image: "", consent: false }] });
  const removeSigner = async (s: EditSigner) => {
    if (!(await showConfirm(`ลบลายเซ็นของ "${s.name || "ผู้ลงนาม"}"? เอกสารที่พิมพ์หลังบันทึกจะไม่มีลายเซ็นนี้`))) return;
    const assign: SigningConfig["assign"] = {};
    for (const [t, slots] of Object.entries(cfg.assign)) {
      const n = Object.fromEntries(Object.entries(slots).map(([l, r]) => [l, r.signer === s.id ? { stamp: r.stamp } : r]).filter(([, r]: any) => r.signer || r.stamp));
      if (Object.keys(n).length) assign[t] = n as any;
    }
    set({ signers: cfg.signers.filter((x) => x.id !== s.id), assign });
  };

  const save = async () => {
    const bad = cfg.signers.find((s) => !s.name.trim() || !s.image);
    if (bad) return void showAlert("ผู้ลงนามทุกคนต้องมีชื่อและรูปลายเซ็น", "ข้อมูลไม่ครบ", "warning");
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/document-signing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "save", signing: cfg }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setCfg(d.signing); setDirty(false);
      showAlert("บันทึกลายเซ็นและตราประทับแล้ว เอกสารที่ออกจริงจะพิมพ์พร้อมลายเซ็น/ตราตามที่ตั้งไว้");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setSaving(false); }
  };

  const model = useMemo(() => {
    if (!profile) return null;
    const def = DESIGNABLE_DOCS.find((d) => d.type === previewType)!;
    return applySigning(sampleModelFor(previewType, profile, toDateStr(new Date())), { ...cfg, signers: cfg.signers.filter((s) => s.image) }, def.signatures);
  }, [profile, cfg, previewType]);

  if (!loaded) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;
  if (!canEdit) return <GlassCard className="p-6 text-[13px] text-white/60">ตั้งค่าลายเซ็นและตราประทับได้เฉพาะผู้ดูแลระบบ</GlassCard>;

  return (
    <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
      <div className="space-y-4 xl:w-[540px] 2xl:w-[620px] flex-shrink-0">
        <GlassCard accentColor="teal" className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold text-white">ลายเซ็นและตราประทับอิเล็กทรอนิกส์</h2>
              <p className="text-[13px] text-white/50">ใส่ให้อัตโนมัติเฉพาะเอกสารที่ออกจริง — ฉบับร่าง รออนุมัติ และเอกสารยกเลิกไม่มีลายเซ็น/ตรา · ตอนพิมพ์เลือกไม่ใส่ได้</p>
            </div>
            <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold flex-shrink-0" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก</PillButton>
          </div>

          {/* ตราประทับ */}
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

        {/* ผู้ลงนาม */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-white">ผู้ลงนาม ({cfg.signers.length}/{MAX_SIGNERS})</p>
            {cfg.signers.length < MAX_SIGNERS && <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={addSigner}><Plus size={13} /> เพิ่มผู้ลงนาม</PillButton>}
          </div>
          {cfg.signers.length === 0 && <p className="text-[12.5px] text-white/45">ยังไม่มีลายเซ็น — เพิ่มผู้ลงนาม เช่น กรรมการผู้จัดการ ผู้จัดการฝ่ายขาย แล้วอัปโหลดหรือเซ็นในช่อง</p>}
          {cfg.signers.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 p-3 space-y-2.5">
              <div className="flex gap-3">
                <div className="w-40 h-[72px] rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 p-1" style={CHECKER}>
                  {s.image ? <img src={s.image} alt={`ลายเซ็น ${s.name}`} className="max-w-full max-h-full object-contain" /> : <PenLine size={20} className="text-black/30" />}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <PillInput value={s.name} onChange={(e) => setSigner(s.id, { name: e.target.value })} placeholder="ชื่อ-นามสกุล (พิมพ์ใต้ลายเซ็น)" className="h-9 w-full text-sm" />
                  <PillInput value={s.position} onChange={(e) => setSigner(s.id, { position: e.target.value })} placeholder="ตำแหน่ง เช่น กรรมการผู้จัดการ" className="h-9 w-full text-sm" />
                </div>
              </div>
              {drawing === s.id ? (
                <SignPad onCancel={() => setDrawing(null)} onDone={async (data) => { setDrawing(null); setSigner(s.id, { image: await prepareMark(data, SIGN_MAX, 700, false), consent: false, consentAt: undefined, consentBy: undefined }); }} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => setDrawing(s.id)}><PenLine size={13} /> เซ็นในช่อง</PillButton>
                  <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => { uploadFor.current = s.id; signRef.current?.click(); }}><ImagePlus size={13} /> อัปโหลดรูปลายเซ็น</PillButton>
                  <PillButton variant="ghost" className="h-8 px-3 text-xs text-danger ml-auto" onClick={() => removeSigner(s)}><Trash2 size={13} /> ลบ</PillButton>
                </div>
              )}
              {s.consentAt ? (
                <p className="text-[11px] text-nexus-teal/80 flex items-center gap-1"><ShieldCheck size={12} /> ยืนยันความยินยอมแล้ว · {s.consentBy} · {new Date(s.consentAt).toLocaleString("th-TH")}</p>
              ) : s.image ? (
                <PillCheckbox label="ยืนยันว่าเจ้าของลายเซ็นยินยอมให้ใช้ลายเซ็นนี้บนเอกสารของบริษัท" checked={!!s.consent} onChange={(e) => setSigner(s.id, { consent: e.target.checked })} />
              ) : null}
            </div>
          ))}
          <input ref={signRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onSign} />
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
                      {cfg.signers.filter((s) => s.name).map((s) => <option key={s.id} value={s.id}>{s.name}{s.position ? ` · ${s.position}` : ""}</option>)}
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
