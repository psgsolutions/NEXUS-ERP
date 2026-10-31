"use client";

import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, PenLine, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { SIGN_MAX, type Signer, type SigningConfig } from "@/lib/documents/esign";
import { CHECKER, SignPad, prepareMark } from "./signature-tools";

/**
 * ลายเซ็นอิเล็กทรอนิกส์ผูกกับรหัสผู้ใช้
 *  - ทุกคน: ตั้ง/เปลี่ยน/ลบลายเซ็นของตัวเอง (เจ้าของยินยอมเอง)
 *  - ฝ่ายบุคคล: ตั้งให้ผู้ใช้คนอื่นในบริษัท (ยืนยันความยินยอมจากเจ้าของ) · ผูกลายเซ็นรุ่นเก่ากับบัญชีผู้ใช้
 * ตราบริษัทและการเลือกว่าช่องลงนามไหนใช้ลายเซ็นใคร อยู่ที่ ตั้งค่า › ลายเซ็น · ตราประทับ (ผู้ดูแลบริษัท)
 */
type Res = { success: boolean; error?: string; mine?: Signer | null; signing?: SigningConfig; users?: { uid: string; name: string }[]; canManageSigners?: boolean };

/** แก้ลายเซ็นหนึ่งคน: รูป (เซ็นในช่อง/อัปโหลด) · ตำแหน่ง · ความยินยอม */
function SignatureEditor({ name, signer, requireConsent, onSave, onRemove }: {
  name: string; signer: Signer | null; requireConsent: boolean;
  onSave: (image: string, position: string, consent: boolean) => Promise<void>; onRemove?: () => Promise<void>;
}) {
  const { showAlert } = useSystemDialog();
  const [image, setImage] = useState(signer?.image || "");
  const [position, setPosition] = useState(signer?.position || "");
  const [consent, setConsent] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setImage(signer?.image || ""); setPosition(signer?.position || ""); setConsent(false); }, [signer]);
  const changed = image !== (signer?.image || "") || position !== (signer?.position || "");
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { setImage(await prepareMark(f, SIGN_MAX, 700)); } catch (err: any) { showAlert(err.message || "เปิดไฟล์รูปนี้ไม่ได้", "ไฟล์ไม่รองรับ", "warning"); }
  };
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); } };
  return (
    <div className="space-y-2.5">
      <div className="flex gap-3">
        <div className="w-44 h-[76px] rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 p-1" style={CHECKER}>
          {image ? <img src={image} alt={`ลายเซ็น ${name}`} className="max-w-full max-h-full object-contain" /> : <PenLine size={20} className="text-black/30" />}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[13.5px] font-semibold text-white truncate" title="ชื่อตามบัญชีผู้ใช้ (พิมพ์ใต้ลายเซ็น)">{name}</p>
          <PillInput value={position} onChange={(e) => setPosition(e.target.value.slice(0, 80))} placeholder="ตำแหน่ง เช่น กรรมการผู้จัดการ" className="h-9 w-full text-sm" />
        </div>
      </div>
      {drawing ? (
        <SignPad onCancel={() => setDrawing(false)} onDone={async (data) => { setDrawing(false); setImage(await prepareMark(data, SIGN_MAX, 700, false)); }} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => setDrawing(true)}><PenLine size={13} /> เซ็นในช่อง</PillButton>
          <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> อัปโหลดรูปลายเซ็น</PillButton>
          {onRemove && signer && <PillButton variant="ghost" className="h-8 px-3 text-xs text-danger" disabled={busy} onClick={() => run(onRemove)}><Trash2 size={13} /> ลบลายเซ็น</PillButton>}
          <PillButton variant="confirm" className="h-8 px-4 text-xs ml-auto" disabled={busy || !image || !changed || (requireConsent && !consent)} onClick={() => run(() => onSave(image, position, consent))}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึก
          </PillButton>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
      {requireConsent && changed && image && <PillCheckbox label="ยืนยันว่าเจ้าของลายเซ็นยินยอมให้ใช้ลายเซ็นนี้บนเอกสารของบริษัท" checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
      {signer?.consentAt && !changed && <p className="text-[11px] text-nexus-teal/80 flex items-center gap-1"><ShieldCheck size={12} /> ยินยอมแล้ว · {signer.consentBy} · {new Date(signer.consentAt).toLocaleString("th-TH")}</p>}
    </div>
  );
}

export function SignatureManager() {
  const { companyId, user } = useAuth() as any;
  const { showConfirm, showAlert } = useSystemDialog();
  const [data, setData] = useState<Res | null>(null);
  const [addFor, setAddFor] = useState("");
  const call = async (body: Record<string, any>) => {
    const res = await apiFetch("/api/settings/document-signing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d: Res = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  };
  const reload = () => call({ action: "get" }).then(setData).catch((e) => showAlert(e.message, "โหลดลายเซ็นไม่สำเร็จ", "error"));
  useEffect(() => { if (companyId) reload(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>;
  const myName = data.mine?.name || user?.displayName || user?.email || "ฉัน";
  const signers = data.signing?.signers || [];
  const users = data.users || [];
  const userName = (uid?: string) => users.find((u) => u.uid === uid)?.name || "";
  const withSig = new Set(signers.map((s) => s.userId).filter(Boolean));

  return (
    <div className="space-y-4 max-w-3xl">
      <GlassCard accentColor="teal" className="p-5 space-y-3">
        <div>
          <h2 className="text-[18px] font-bold text-white">ลายเซ็นของฉัน</h2>
          <p className="text-[12.5px] text-white/50">ลายเซ็นนี้ผูกกับบัญชีของคุณ ใช้บนเอกสารที่ผู้ดูแลบริษัทกำหนดให้ช่องลงนามใช้ลายเซ็นของคุณ — เฉพาะเอกสารที่ออกจริง</p>
        </div>
        <SignatureEditor name={myName} signer={data.mine || null} requireConsent={false}
          onSave={async (image, position) => { setData({ ...data, ...(await call({ action: "saveSigner", image, position })) }); showAlert("บันทึกลายเซ็นของคุณแล้ว"); }}
          onRemove={async () => { if (!(await showConfirm("ลบลายเซ็นของคุณ? ช่องลงนามที่ใช้ลายเซ็นนี้จะว่าง (เซ็นจริง)"))) return; setData({ ...data, ...(await call({ action: "removeSigner" })) }); }} />
      </GlassCard>

      {data.canManageSigners && (
        <GlassCard className="p-5 space-y-4">
          <div>
            <p className="text-[15px] font-bold text-white">ลายเซ็นของพนักงาน (ฝ่ายบุคคล)</p>
            <p className="text-[12px] text-white/45">ตั้งลายเซ็นให้ผู้ใช้ในบริษัท — ทุกลายเซ็นผูกกับบัญชีผู้ใช้คนนั้น และต้องยืนยันความยินยอมจากเจ้าของ</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <PillSelect value={addFor} onChange={(e) => setAddFor(String(e.target.value))} className="h-9 w-full text-sm">
                <option value="">เลือกผู้ใช้ที่จะตั้งลายเซ็น…</option>
                {users.filter((u) => !withSig.has(u.uid)).map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
              </PillSelect>
            </div>
            <UserPlus size={16} className="text-white/40" />
          </div>
          {addFor && (
            <div className="rounded-xl border border-nexus-teal/30 p-3">
              <SignatureEditor name={userName(addFor)} signer={null} requireConsent
                onSave={async (image, position, consent) => { setData({ ...data, ...(await call({ action: "saveSigner", userId: addFor, image, position, consent })) }); setAddFor(""); }} />
            </div>
          )}
          {signers.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 p-3 space-y-2">
              {!s.userId && (
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-amber-200/90">
                  <Link2 size={13} /> ลายเซ็นรุ่นเดิมยังไม่ผูกกับบัญชีผู้ใช้ — เลือกเจ้าของ:
                  <div className="min-w-[200px] flex-1">
                    <PillSelect value="" onChange={async (e) => { const uid = String(e.target.value); if (!uid) return; try { setData({ ...data, ...(await call({ action: "bindSigner", signerId: s.id, userId: uid })) }); } catch (err: any) { showAlert(err.message, "ผูกไม่สำเร็จ", "error"); } }} className="h-8 w-full text-[12px]">
                      <option value="">เลือกผู้ใช้…</option>
                      {users.filter((u) => !withSig.has(u.uid)).map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                    </PillSelect>
                  </div>
                </div>
              )}
              <SignatureEditor name={s.userId ? s.name : `${s.name} (ยังไม่ผูก)`} signer={s} requireConsent
                onSave={async (image, position, consent) => {
                  if (!s.userId) throw new Error("ผูกลายเซ็นนี้กับบัญชีผู้ใช้ก่อนแก้ไข");
                  setData({ ...data, ...(await call({ action: "saveSigner", userId: s.userId, image, position, consent })) });
                }}
                onRemove={async () => { if (!(await showConfirm(`ลบลายเซ็นของ "${s.name}"? ช่องลงนามที่ใช้ลายเซ็นนี้จะว่าง (เซ็นจริง)`))) return; setData({ ...data, ...(await call({ action: "removeSigner", signerId: s.id })) }); }} />
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
