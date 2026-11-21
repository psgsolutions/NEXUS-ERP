"use client";

/**
 * คุณลักษณะเฉพาะของสินค้า (ใช้ในร่าง TOR) — แก้เป็นข้อ ๆ ได้เสมอ
 *  - AI อ่าน datasheet: อัปโหลดไฟล์ (PDF/รูป ≤ 10 MB) หรือเลือกไฟล์ที่แนบไว้ → ได้ร่างข้อกำหนดแบบ TOR (ไม่ระบุยี่ห้อ) → ตรวจ/แก้ → บันทึก
 *  - ไฟล์ที่อัปโหลดเก็บไว้ที่ "เอกสารประกอบสินค้า" ด้วย ถ้าขนาดไม่เกินที่ระบบเก็บได้
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { ATTACHMENT_MAX, prepareAttachment } from "@/lib/attachments";
import { can } from "@/lib/permissions";
import { normalizeSpecItems } from "@/lib/spec-items";

export function SpecItemsCard({ product }: { product: any }) {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = ["inventory:edit", "sales:edit", "projects:edit"].some((p) => can(roles, p as any));
  const savedItems = useMemo(() => normalizeSpecItems(product?.specItems?.length ? product.specItems : product?.technicalSpecs), [product?.specItems, product?.technicalSpecs]);
  const [items, setItems] = useState<string[]>(savedItems);
  const [files, setFiles] = useState<{ id: string; name: string; mime: string }[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setItems(savedItems); }, [savedItems]);
  useEffect(() => {
    if (!companyId || !product?.id) return;
    apiFetch("/api/attachments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "list", ownerType: "product", ownerId: product.id }) })
      .then((r) => r.json()).then((d) => d.success && setFiles((d.files || []).filter((f: any) => /pdf|image/.test(f.mime)))).catch(() => undefined);
  }, [companyId, product?.id]);
  const dirty = JSON.stringify(normalizeSpecItems(items)) !== JSON.stringify(savedItems);

  const useResult = async (d: any) => {
    const got: string[] = d.items || [];
    const replace = !items.filter((x) => x.trim()).length || await showConfirm(`AI ได้คุณลักษณะ ${got.length} ข้อ — แทนที่รายการเดิม? (ยกเลิก = ต่อท้ายรายการเดิม)`);
    setItems(replace ? got : normalizeSpecItems([...items, ...got]));
    setHint([d.productType, d.brand && `ยี่ห้อในไฟล์: ${d.brand}`, d.model && `รุ่น: ${d.model}`].filter(Boolean).join(" · "));
  };
  const runFile = async (f?: File) => {
    if (!f || !companyId) return;
    setBusy("ai");
    try {
      const fd = new FormData();
      fd.set("companyId", companyId); fd.set("productName", String(product?.name || "")); fd.set("file", f);
      const r = await apiFetch("/api/ai/datasheet-spec", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || "AI อ่าน datasheet ไม่สำเร็จ");
      await useResult(d);
      // เก็บไฟล์ไว้ที่เอกสารประกอบสินค้า (ถ้าเล็กพอ และมีสิทธิ์แนบ)
      if (can(roles, "inventory:edit")) {
        try {
          const pf = await prepareAttachment(f);
          if (pf.data.length <= ATTACHMENT_MAX) await apiFetch("/api/attachments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "upload", ownerType: "product", ownerId: product.id, file: pf }) });
        } catch { /* ไฟล์ใหญ่เกินที่ระบบเก็บ — ใช้วิเคราะห์อย่างเดียว */ }
      }
    } catch (e: any) { showAlert(e.message, "AI อ่าน datasheet ไม่สำเร็จ", "warning"); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  };
  const runAttachment = async () => {
    if (!pick || !companyId) return;
    setBusy("ai");
    try {
      const r = await apiFetch("/api/ai/datasheet-spec", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, attachmentId: pick, productName: product?.name || "" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || "AI อ่าน datasheet ไม่สำเร็จ");
      await useResult(d);
    } catch (e: any) { showAlert(e.message, "AI อ่าน datasheet ไม่สำเร็จ", "warning"); } finally { setBusy(""); }
  };
  const save = async () => {
    setBusy("save");
    try {
      const specItems = normalizeSpecItems(items);
      const r = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "products", id: product.id, scope: "company",
        changes: { specItems, specSource: hint ? "datasheet" : product?.specSource || "manual" } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      showAlert(`บันทึกคุณลักษณะเฉพาะ ${specItems.length} ข้อแล้ว — ร่าง TOR ของโครงการที่ใช้สินค้านี้จะใช้ข้อความชุดนี้`, "บันทึกแล้ว", "info");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };
  const move = (i: number, d: number) => setItems((x) => { const y = [...x]; const j = i + d; if (j < 0 || j >= y.length) return y; [y[i], y[j]] = [y[j], y[i]]; return y; });

  return (
    <GlassCard className="p-4 border-white/5 space-y-3">
      <div data-spec-items className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ClipboardList size={14} className="text-nexus-teal" />
          <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">คุณลักษณะเฉพาะ (ใช้ในร่าง TOR)</h4>
          <span className="text-[11px] text-white/45">{product?.specSource === "datasheet" ? "จาก datasheet (AI) · แก้แล้วได้" : ""}</span>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-nexus-teal/20 bg-nexus-teal/[0.04] p-2.5">
            <Sparkles size={14} className="text-nexus-teal" />
            <span className="text-[12px] text-white/75">AI อ่าน datasheet แล้วเขียนคุณลักษณะให้</span>
            <span className="flex-1" />
            <PillButton variant="confirm" className="h-8 px-3 text-xs" disabled={!!busy} onClick={() => fileRef.current?.click()} data-ai-datasheet>
              {busy === "ai" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} อัปโหลด datasheet
            </PillButton>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => runFile(e.target.files?.[0])} data-datasheet-file />
            {files.length > 0 && (<>
              <div className="w-[200px]"><PillSelect value={pick} onChange={(e) => setPick(e.target.value)} className="h-8 w-full text-[12px]" placeholder="หรือใช้ไฟล์ที่แนบไว้…">
                {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </PillSelect></div>
              <PillButton variant="glass" className="h-8 px-3 text-xs" disabled={!pick || !!busy} onClick={runAttachment}>อ่านไฟล์นี้</PillButton>
            </>)}
          </div>
        )}
        {hint && <p className="text-[12px] text-nexus-teal">AI: {hint} — ตรวจและแก้แต่ละข้อก่อนบันทึก (ไม่ใส่ยี่ห้อ/รุ่นในข้อกำหนด)</p>}
        {items.length ? (
          <ol className="space-y-1.5">
            {items.map((t, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-6 text-right text-[12px] text-white/45 font-mono">{i + 1}.</span>
                <PillInput value={t} disabled={!canEdit} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? e.target.value : y)))} className="h-8 flex-1 min-w-0 text-[12px]" aria-label={`คุณลักษณะข้อ ${i + 1}`} />
                {canEdit && <>
                  <PillButton variant="ghost" className="h-8 w-8 px-0" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={12} /></PillButton>
                  <PillButton variant="ghost" className="h-8 w-8 px-0" aria-label="เลื่อนลง" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={12} /></PillButton>
                  <PillButton variant="ghost" className="h-8 w-8 px-0 text-danger/80" aria-label="ลบข้อนี้" onClick={() => setItems((x) => x.filter((_, k) => k !== i))}><Trash2 size={12} /></PillButton>
                </>}
              </li>
            ))}
          </ol>
        ) : <p className="text-[12px] text-white/45">ยังไม่มีคุณลักษณะเฉพาะ — อัปโหลด datasheet ให้ AI ช่วย หรือเพิ่มข้อเอง</p>}
        {canEdit && (
          <div className="flex gap-2">
            <PillButton variant="ghost" className="h-8 px-3 text-[12px] text-nexus-teal normal-case tracking-normal" onClick={() => setItems((x) => [...x, ""])} data-add-spec><Plus size={12} /> เพิ่มข้อ</PillButton>
            <span className="flex-1" />
            {dirty && <PillButton variant="primary" className="h-8 px-4 text-xs" disabled={!!busy} onClick={save} data-save-spec>{busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึกคุณลักษณะ</PillButton>}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
