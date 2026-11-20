"use client";

/**
 * ตั้งค่า › แม่แบบโครงการ: ปรับคลังงานมาตรฐานของบริษัท (ชื่อ จำนวนวัน ผู้รับผิดชอบ ใช้/ไม่ใช้)
 * เพิ่มงานของบริษัทเอง (เลือกระบบที่ใช้ได้) · ค่าเริ่มต้นการคำนวณ · นำเข้า/ส่งออก YAML
 * มีผลกับแผนงานที่สร้าง/บันทึกหลังจากนี้ (โครงการเดิมคำนวณใหม่เมื่อบันทึกโครงการอีกครั้ง)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { Field, NumCell, FIELD_W } from "@/components/projects/ProjectPlanEditors";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import {
  DEFAULT_PLAN_DEFAULTS, OWNERS, PHASE_LABELS, SYSTEM_TYPES, normalizeTemplate,
  type OwnerKey, type PlanDefaults, type SystemType, type TemplateConfig, type TemplateExtraTask,
} from "@/lib/project-plan";

type CatRow = { id: string; name: string; phase: number; days: number | null; owner: OwnerKey; system?: SystemType; after: string[]; when: string };
const SYS_LABEL = Object.fromEntries(SYSTEM_TYPES.map((s) => [s.code, s.label.replace(/\s*\(.*\)$/, "")]));
const DEFAULT_FIELDS: [keyof PlanDefaults, string, string][] = [
  ["pointsPerDay", "เดินสายได้ต่อวัน", "จุด"], ["leadTimeDays", "ระยะเวลาสั่งของ", "วัน"], ["clientDays", "หน่วยงานอนุมัติ TOR", "วัน"],
  ["announcementDays", "ประกาศ/ยื่นซอง", "วัน"], ["beforeContractDays", "เตรียมเอกสารสัญญา", "วัน"], ["civilDays", "งานโยธา", "วัน"], ["rainBufferDays", "เผื่อหน้าฝน", "วัน"],
];

export function ProjectTemplateSettings() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "settings:manage");
  const [catalog, setCatalog] = useState<CatRow[]>([]);
  const [tpl, setTpl] = useState<TemplateConfig>({ tasks: {}, extra: [] });
  const [saved, setSaved] = useState("");
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<{ template: TemplateConfig; notes: string[]; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const post = useCallback(async (body: any) => {
    const res = await apiFetch("/api/settings/project-template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setBusy("load");
    try {
      const d = await post({ action: "get" });
      const t = normalizeTemplate(d.template);
      setCatalog(d.catalog || []); setTpl(t); setSaved(JSON.stringify(t));
      setMeta(d.updatedAt ? `แก้ล่าสุด ${new Date(d.updatedAt).toLocaleString("th-TH")} โดย ${d.updatedBy}` : "ยังใช้แม่แบบมาตรฐาน");
    } catch (e: any) { showAlert(e.message); } finally { setBusy(""); }
  }, [companyId, post, showAlert]);
  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(normalizeTemplate(tpl)) !== saved;
  const setTask = (id: string, patch: Partial<{ name: string; days: number; owner: OwnerKey; disabled: boolean }>, base: CatRow) => {
    const cur = { ...(tpl.tasks[id] || {}), ...patch };
    if (cur.name === base.name || !cur.name) delete cur.name;
    if (cur.days === base.days || !cur.days) delete cur.days;
    if (cur.owner === base.owner) delete cur.owner;
    if (!cur.disabled) delete cur.disabled;
    const tasks = { ...tpl.tasks };
    if (Object.keys(cur).length) tasks[id] = cur; else delete tasks[id];
    setTpl({ ...tpl, tasks });
  };
  const defaults = tpl.defaults || DEFAULT_PLAN_DEFAULTS;
  const setExtra = (i: number, patch: Partial<TemplateExtraTask>) => setTpl({ ...tpl, extra: tpl.extra.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const allIds = useMemo(() => [...catalog.map((c) => c.id), ...tpl.extra.map((x) => x.id)], [catalog, tpl.extra]);

  const save = async () => {
    setBusy("save");
    try { const d = await post({ action: "save", template: tpl }); const t = normalizeTemplate(d.template); setTpl(t); setSaved(JSON.stringify(t)); showAlert("บันทึกแม่แบบโครงการแล้ว — มีผลกับแผนงานที่สร้าง/บันทึกหลังจากนี้", "บันทึกแล้ว", "info"); load(); }
    catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };
  const exportYaml = async () => {
    setBusy("export");
    try {
      const d = await post({ action: "exportYaml" });
      const blob = new Blob([d.yaml], { type: "text/yaml;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexus_project_template-${companyId}.yaml`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e: any) { showAlert(e.message); } finally { setBusy(""); }
  };
  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy("import");
    try { const text = await f.text(); const d = await post({ action: "importYaml", text }); setPreview({ template: normalizeTemplate(d.template), notes: d.notes || [], text }); }
    catch (e: any) { showAlert(e.message, "นำเข้าไม่สำเร็จ", "error"); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  };
  const applyImport = async () => {
    if (!preview) return;
    setBusy("apply");
    try { await post({ action: "importYaml", text: preview.text, apply: true }); setPreview(null); await load(); showAlert("นำเข้าแม่แบบแล้ว", "นำเข้าแล้ว", "info"); }
    catch (e: any) { showAlert(e.message, "นำเข้าไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };

  const phases = Array.from(new Set(catalog.map((c) => c.phase))).sort();
  const changedCount = Object.keys(tpl.tasks).length;

  return (
    <div className="space-y-4" data-project-template>
      <GlassCard className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-white">แม่แบบแผนงานโครงการ</h3>
            <p className="text-[12px] text-white/50">ปรับคลังงานที่ใช้สร้างแผนงานอัตโนมัติ (ขั้นแผนงานและงวดงาน) · {meta} · แก้แล้ว {changedCount} งาน · งานของบริษัท {tpl.extra.length} งาน</p>
          </div>
          <span className="flex-1" />
          <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={exportYaml} disabled={!!busy}>{busy === "export" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} ส่งออก YAML</PillButton>
          {canEdit && <>
            <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={() => fileRef.current?.click()} disabled={!!busy} data-import-yaml>{busy === "import" ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} นำเข้า YAML</PillButton>
            <input ref={fileRef} type="file" accept=".yaml,.yml,text/yaml" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} data-yaml-file />
            <PillButton variant="ghost" className="h-9 px-4 text-xs" disabled={!!busy || (!changedCount && !tpl.extra.length && !tpl.defaults)}
              onClick={async () => { if (await showConfirm("กลับเป็นแม่แบบมาตรฐานทั้งหมด? (ยังไม่บันทึกจนกว่าจะกดบันทึก)")) setTpl({ tasks: {}, extra: [] }); }}><RotateCcw size={13} /> แม่แบบมาตรฐาน</PillButton>
            <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={!dirty || !!busy} onClick={save} data-save-template>{busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึก</PillButton>
          </>}
        </div>

        {preview && (
          <div className="rounded-xl border border-nexus-teal/30 bg-nexus-teal/[0.05] p-3 space-y-2" data-import-preview>
            <p className="text-[14px] font-bold text-white">ผลการอ่านไฟล์ (ยังไม่บันทึก)</p>
            {preview.notes.map((n, i) => <p key={i} className="text-[12px] text-white/75">• {n}</p>)}
            <div className="flex gap-2">
              <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold" onClick={applyImport} disabled={busy === "apply"} data-apply-import>ใช้แม่แบบนี้</PillButton>
              <PillButton variant="ghost" className="h-8 px-4 text-xs" onClick={() => setPreview(null)}>ยกเลิก</PillButton>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <span className="text-[12px] font-bold text-white/70 w-full">ค่าเริ่มต้นการคำนวณ (ใช้กับโครงการใหม่)</span>
          {DEFAULT_FIELDS.map(([k, label, unit]) => (
            <Field key={k} label={label} w={FIELD_W.days + 20}>
              <NumCell value={defaults[k]} disabled={!canEdit} onChange={(v) => setTpl({ ...tpl, defaults: { ...defaults, [k]: Math.round(v) } })} suffix={unit} />
            </Field>
          ))}
        </div>
      </GlassCard>

      {busy === "load" && !catalog.length && <GlassCard className="p-5 text-white/50 text-[14px]"><Loader2 size={14} className="inline animate-spin mr-2" />กำลังโหลด…</GlassCard>}

      {phases.map((ph) => (
        <GlassCard key={ph} className="p-4 space-y-2">
          <h3 className="text-[14px] font-bold text-white">{ph}. {PHASE_LABELS[ph]}</h3>
          <NexusTable headers={["รหัส", "งาน", "ระบบ", "จำนวนวัน", "ผู้รับผิดชอบ", "ใช้"]}>
            {catalog.filter((c) => c.phase === ph).map((c) => {
              const o = tpl.tasks[c.id] || {};
              return (
                <NexusTableRow key={c.id} className={cn(o.disabled && "opacity-40")}>
                  <NexusTableCell mono>{c.id}</NexusTableCell>
                  <NexusTableCell title={c.when !== "always" ? `ใช้เมื่อ: ${c.when}` : c.name}>
                    {canEdit ? <PillInput value={o.name ?? c.name} onChange={(e) => setTask(c.id, { name: e.target.value }, c)} className={cn("h-8 w-full min-w-[220px] text-[12px]", o.name && "border-warning/50")} aria-label={`ชื่องาน ${c.id}`} /> : (o.name || c.name)}
                  </NexusTableCell>
                  <NexusTableCell><span className="text-[12px] text-white/55">{c.system ? SYS_LABEL[c.system] : "ทุกระบบ"}</span></NexusTableCell>
                  <NexusTableCell align="right">
                    {c.days === null ? <span className="text-[12px] text-white/45" title="คำนวณจากค่าเริ่มต้น/กำหนดส่ง">ตามค่าคำนวณ</span>
                      : <div className="w-[96px] ml-auto"><NumCell value={o.days ?? c.days} disabled={!canEdit} warn={!!o.days} onChange={(v) => setTask(c.id, { days: Math.round(v) }, c)} suffix="วัน" /></div>}
                  </NexusTableCell>
                  <NexusTableCell>
                    <PillSelect value={o.owner || c.owner} disabled={!canEdit} onChange={(e) => setTask(c.id, { owner: e.target.value as OwnerKey }, c)} className="h-8 w-[180px] text-[12px]" aria-label={`ผู้รับผิดชอบ ${c.id}`}>
                      {(Object.keys(OWNERS) as OwnerKey[]).map((k) => <option key={k} value={k}>{OWNERS[k].label}</option>)}
                    </PillSelect>
                  </NexusTableCell>
                  <NexusTableCell align="center"><PillCheckbox checked={!o.disabled} disabled={!canEdit} onChange={(e) => setTask(c.id, { disabled: !e.target.checked }, c)} aria-label={`ใช้งาน ${c.id}`} /></NexusTableCell>
                </NexusTableRow>
              );
            })}
          </NexusTable>
        </GlassCard>
      ))}

      <GlassCard className="p-4 space-y-2" >
        <div data-template-extra className="space-y-2">
        <h3 className="text-[14px] font-bold text-white">งานของบริษัท (เพิ่มเอง)</h3>
        <p className="text-[12px] text-white/50">ใส่ในแผนของทุกโครงการ หรือเฉพาะโครงการที่เลือกระบบนั้น · เลือกงานที่ต้องเสร็จก่อนได้</p>
        {tpl.extra.map((x, i) => (
          <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
            <span className="w-10 font-mono text-[12px] text-white/50">{x.id}</span>
            <PillInput value={x.name} disabled={!canEdit} onChange={(e) => setExtra(i, { name: e.target.value })} className="h-8 flex-1 min-w-[200px] text-[12px]" aria-label="ชื่องาน" />
            <PillSelect value={String(x.phase)} disabled={!canEdit} onChange={(e) => setExtra(i, { phase: Number(e.target.value) })} className="h-8 w-[170px] text-[12px]">
              {Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}
            </PillSelect>
            <PillSelect value={x.after[0] || ""} disabled={!canEdit} onChange={(e) => setExtra(i, { after: e.target.value ? [e.target.value] : [] })} className="h-8 w-[150px] text-[12px]" aria-label="ต่อจากงาน">
              <option value="">— เริ่มต้นช่วง —</option>
              {allIds.filter((id) => id !== x.id).map((id) => <option key={id} value={id}>ต่อจาก {id}</option>)}
            </PillSelect>
            <div className="w-[96px]"><NumCell value={x.days} disabled={!canEdit} onChange={(v) => setExtra(i, { days: Math.max(1, Math.round(v)) })} suffix="วัน" /></div>
            <PillSelect value={x.owner} disabled={!canEdit} onChange={(e) => setExtra(i, { owner: e.target.value as OwnerKey })} className="h-8 w-[170px] text-[12px]">
              {(Object.keys(OWNERS) as OwnerKey[]).map((k) => <option key={k} value={k}>{OWNERS[k].label}</option>)}
            </PillSelect>
            <PillSelect value={x.systems?.[0] || ""} disabled={!canEdit} onChange={(e) => setExtra(i, { systems: e.target.value ? [e.target.value as SystemType] : undefined })} className="h-8 w-[150px] text-[12px]" aria-label="ใช้กับระบบ">
              <option value="">ทุกโครงการ</option>
              {SYSTEM_TYPES.map((s) => <option key={s.code} value={s.code}>เฉพาะ {SYS_LABEL[s.code]}</option>)}
            </PillSelect>
            {canEdit && <PillButton variant="ghost" className="h-8 w-8 px-0 text-danger/80" aria-label="ลบงาน" onClick={() => setTpl({ ...tpl, extra: tpl.extra.filter((_, k) => k !== i) })}><Trash2 size={12} /></PillButton>}
          </div>
        ))}
        {canEdit && (
          <PillButton variant="ghost" className="h-8 px-3 text-[12px] text-nexus-teal normal-case tracking-normal" data-add-extra
            onClick={() => { const used = new Set(tpl.extra.map((x) => x.id)); let n = 1; while (used.has(`C${n}`)) n++; setTpl({ ...tpl, extra: [...tpl.extra, { id: `C${n}`, name: "", phase: 4, after: [], days: 1, owner: "pm" }] }); }}>
            <Plus size={12} /> เพิ่มงานของบริษัท
          </PillButton>
        )}
        </div>
      </GlassCard>
    </div>
  );
}
