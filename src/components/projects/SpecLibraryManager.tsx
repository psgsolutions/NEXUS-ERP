"use client";

/**
 * จัดการคลังคุณลักษณะเฉพาะ (สเปก TOR) — ตั้งค่า › คลังสเปก TOR
 * แม่แบบมาตรฐานแก้ไขได้ (บันทึกเป็นฉบับของบริษัท) ซ่อนได้ และคืนค่ามาตรฐานได้
 */

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, EyeOff, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, Toast, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DEFAULT_SPEC_TEMPLATES, mergeSpecLibrary, type SpecTemplate } from "@/lib/spec-library";

type Draft = Omit<SpecTemplate, "keywords" | "variants"> & {
  keywords: string;
  variants: { id: string; name: string; clauses: string; isDefault?: boolean }[];
};

const toDraft = (t: SpecTemplate): Draft => ({
  ...t,
  keywords: t.keywords.join(", "),
  variants: t.variants.map((v) => ({ ...v, clauses: v.clauses.join("\n") })),
});
const newId = (p: string) => `${p}${Date.now().toString(36).toUpperCase()}`;
const textareaCls = "w-full bg-black/20 border border-white/10 focus:border-nexus-teal/50 rounded-xl p-3 text-[13px] text-white focus:outline-none resize-y leading-relaxed placeholder:text-white/30";

export function SpecLibraryManager() {
  const { companyId, role } = useAuth();
  const canManage = can(role, "settings:manage");
  const { data: docs } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/spec_templates` : "");
  const library = useMemo(() => mergeSpecLibrary(docs), [docs]);
  const overridden = useMemo(() => new Set(docs.filter((d: any) => !d.isDeleted).map((d: any) => d.id)), [docs]);
  const hidden = useMemo(() => DEFAULT_SPEC_TEMPLATES.filter((t) => docs.some((d: any) => d.id === t.id && d.isDeleted)), [docs]);

  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ message: "", isVisible: false });
  const notify = (message: string) => setToast({ message, isVisible: true });

  useEffect(() => {
    if (draft && draft.id === selectedId) return;
    const t = library.find((x) => x.id === selectedId) || library[0];
    if (t) { setSelectedId(t.id); setDraft(toDraft(t)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, selectedId]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = library.filter((t) => !q || t.name.toLowerCase().includes(q) || t.keywords.some((k) => k.includes(q)));
    const map = new Map<string, SpecTemplate[]>();
    list.forEach((t) => map.set(t.category, [...(map.get(t.category) || []), t]));
    return Array.from(map.entries());
  }, [library, query]);

  const call = async (body: any, okMsg: string) => {
    if (!companyId) return false;
    try {
      setBusy(true);
      const res = await apiFetch("/api/settings/spec-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ไม่สำเร็จ");
      notify(okMsg);
      return true;
    } catch (e: any) {
      notify(e.message || "ไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const template = {
      ...draft,
      keywords: draft.keywords.split(","),
      variants: draft.variants.map((v) => ({ ...v, clauses: v.clauses.split("\n") })),
    };
    await call({ action: "save", template }, `บันทึกแม่แบบ "${draft.name}" แล้ว`);
  };

  const setVariant = (i: number, patch: Partial<Draft["variants"][number]>) =>
    setDraft((d) => (d ? { ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) } : d));

  const isBuiltIn = !!draft && DEFAULT_SPEC_TEMPLATES.some((t) => t.id === draft.id);

  return (
    <div className="flex flex-col xl:flex-row items-start gap-4">
      <GlassCard className="p-4 w-full xl:w-[300px] shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><BookOpen size={16} className="text-nexus-teal" /> คลังสเปก TOR ({library.length})</h3>
          {canManage && (
            <PillButton variant="glass" onClick={() => {
              const t: SpecTemplate = { id: newId("T"), name: "แม่แบบใหม่", category: "อื่น ๆ", appliesTo: "PRODUCT", keywords: [], variants: [{ id: "V1", name: "มาตรฐาน", clauses: [], isDefault: true }] };
              setSelectedId(t.id); setDraft(toDraft(t));
            }} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30"><Plus size={13} className="mr-1" /> เพิ่ม</PillButton>
          )}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <PillInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาแม่แบบ / คำค้น" className="h-9 text-sm pl-9" />
        </div>
        <div className="space-y-3">
          {groups.map(([cat, list]) => (
            <div key={cat} className="space-y-1">
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-wide px-1">{cat}</p>
              {list.map((t) => (
                <button key={t.id} type="button" onClick={() => { setSelectedId(t.id); setDraft(toDraft(t)); }}
                  className={cn("w-full text-left px-3 py-2 rounded-xl border text-[13px] flex items-center justify-between gap-2",
                    t.id === draft?.id ? "border-nexus-teal/40 bg-nexus-teal/10 text-nexus-teal font-bold" : "border-transparent text-white/75 hover:bg-white/5")}>
                  <span className="truncate">{t.name}</span>
                  <span className="text-[10px] text-white/40 shrink-0">{t.variants.length} แบบ{overridden.has(t.id) && t.builtIn === undefined && DEFAULT_SPEC_TEMPLATES.some((d) => d.id === t.id) ? " · แก้ไข" : ""}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        {hidden.length > 0 && canManage && (
          <div className="pt-2 border-t border-white/10 space-y-1">
            <p className="text-[11px] font-bold text-white/40 px-1">ซ่อนอยู่</p>
            {hidden.map((t) => (
              <button key={t.id} type="button" disabled={busy} onClick={() => call({ action: "reset", id: t.id }, `แสดงแม่แบบ "${t.name}" อีกครั้ง`)}
                className="w-full text-left px-3 py-1.5 rounded-xl text-[12px] text-white/50 hover:text-nexus-teal flex items-center gap-2">
                <EyeOff size={12} /> <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {draft && (
        <GlassCard className="p-5 flex-1 w-full space-y-4 min-w-0">
          <fieldset disabled={!canManage || busy} className="space-y-4 min-w-0">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1" style={{ flex: "1 1 260px" }}>
                <label className="text-[12px] font-bold text-white/70 ml-1">ชื่อแม่แบบ</label>
                <PillInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 text-sm font-bold" />
              </div>
              <div className="space-y-1" style={{ flex: "0 1 200px" }}>
                <label className="text-[12px] font-bold text-white/70 ml-1">หมวด</label>
                <PillInput value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 ml-1">ใช้กับ</label>
                <div className="flex gap-2">
                  {(["PRODUCT", "SERVICE"] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setDraft({ ...draft, appliesTo: k })}
                      className={cn("h-9 px-4 rounded-full border text-[13px] font-bold", draft.appliesTo === k ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "border-white/10 text-white/50")}>
                      {k === "PRODUCT" ? "สินค้า/อุปกรณ์" : "งานบริการ"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-white/70 ml-1">คำค้นสำหรับจับคู่กับชื่อรายการ (คั่นด้วยจุลภาค)</label>
              <PillInput value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="เช่น กล้อง, camera, cctv" className="h-9 text-sm" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-bold text-white">รูปแบบการเขียน ({draft.variants.length})</h4>
                <PillButton variant="glass" onClick={() => setDraft({ ...draft, variants: [...draft.variants, { id: newId("V"), name: "", clauses: "" }] })} className="h-8 px-3 text-xs font-bold text-nexus-teal border-nexus-teal/30">
                  <Plus size={13} className="mr-1" /> เพิ่มรูปแบบ
                </PillButton>
              </div>
              {draft.variants.map((v, i) => (
                <div key={v.id} className="p-3 rounded-2xl border border-white/10 bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2">
                    <PillInput value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="ชื่อรูปแบบ เช่น ร้อยท่อ EMT" className="h-9 text-sm font-bold" />
                    <button type="button" onClick={() => setVariant(i, { isDefault: !v.isDefault })}
                      className={cn("h-9 px-3 rounded-full border text-[12px] font-bold whitespace-nowrap", v.isDefault ? "border-nexus-teal/40 bg-nexus-teal/10 text-nexus-teal" : "border-white/10 text-white/50")}
                      title="เลือกให้อัตโนมัติเมื่อจับคู่แม่แบบได้">
                      {v.isDefault ? "✓ เลือกอัตโนมัติ" : "เลือกอัตโนมัติ"}
                    </button>
                    <button type="button" onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })} className="p-1 text-white/40 hover:text-danger" title="ลบรูปแบบ"><Trash2 size={15} /></button>
                  </div>
                  <textarea
                    value={v.clauses}
                    onChange={(e) => setVariant(i, { clauses: e.target.value })}
                    rows={Math.max(2, v.clauses.split("\n").length + 1)}
                    style={{ fieldSizing: "content", minHeight: "3rem" } as React.CSSProperties}
                    placeholder={"ข้อความคุณลักษณะ 1 ข้อต่อบรรทัด เช่น\nสายสัญญาณเป็นชนิด UTP Category 6 หรือดีกว่า"}
                    className={textareaCls}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          {canManage ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex gap-2">
                <PillButton variant="glass" disabled={busy} onClick={() => call({ action: "delete", id: draft.id }, isBuiltIn ? `ซ่อนแม่แบบ "${draft.name}" แล้ว` : `ลบแม่แบบ "${draft.name}" แล้ว`).then((ok) => ok && setSelectedId(""))} className="h-9 px-4 text-xs font-bold text-danger border-danger/30">
                  {isBuiltIn ? <><EyeOff size={13} className="mr-1.5" /> ซ่อนแม่แบบ</> : <><Trash2 size={13} className="mr-1.5" /> ลบแม่แบบ</>}
                </PillButton>
                {isBuiltIn && overridden.has(draft.id) && (
                  <PillButton variant="glass" disabled={busy} onClick={() => call({ action: "reset", id: draft.id }, "คืนค่ามาตรฐานแล้ว").then((ok) => { if (ok) { const t = DEFAULT_SPEC_TEMPLATES.find((x) => x.id === draft.id); if (t) setDraft(toDraft(t)); } })} className="h-9 px-4 text-xs font-bold text-white/60">
                    <RotateCcw size={13} className="mr-1.5" /> คืนค่ามาตรฐาน
                  </PillButton>
                )}
              </div>
              <PillButton variant="confirm" disabled={busy} onClick={save} className="h-9 px-5 text-xs font-bold">
                <Save size={13} className="mr-1.5" /> {busy ? "กำลังบันทึก..." : "บันทึกแม่แบบ"}
              </PillButton>
            </div>
          ) : (
            <p className="text-[12px] text-white/40">แก้ไขคลังสเปกได้เฉพาะผู้ดูแลระบบ</p>
          )}
        </GlassCard>
      )}
      {toast.isVisible && <Toast isVisible message={toast.message} onClose={() => setToast((t) => ({ ...t, isVisible: false }))} />}
    </div>
  );
}
