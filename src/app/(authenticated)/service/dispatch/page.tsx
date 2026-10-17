"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Check, ClipboardList, Hammer, Loader2, MapPin, Package, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { GlassCard, NexusSearchInput, PillButton, PillInput, PillSelect, StatusBadge, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { JOB_PRIORITY, JOB_STATUS, JOB_TYPES, jobTypeLabel, toolsOut, type Job, type JobItem, type JobPriority, type JobType } from "@/lib/jobs";

/** ศูนย์จ่ายงาน: สร้างงาน มอบหมายผู้รับงาน และติดตามสถานะ (ข้อมูลผ่าน /api/jobs) */
const COLUMNS: { id: string; title: string; statuses: string[]; hint: string }[] = [
  { id: "todo", title: "รอจ่ายงาน", statuses: ["OPEN", "REJECTED"], hint: "ยังไม่มีผู้รับงาน หรือถูกปฏิเสธ" },
  { id: "assigned", title: "รอรับงาน", statuses: ["ASSIGNED"], hint: "จ่ายแล้ว รอช่างกดรับ" },
  { id: "doing", title: "กำลังดำเนินการ", statuses: ["ACCEPTED", "IN_PROGRESS"], hint: "รับงาน/กำลังทำ" },
  { id: "done", title: "เสร็จแล้ว", statuses: ["DONE"], hint: "ปิดงานล่าสุด" },
];
const thDate = (d?: string) => { if (!d) return ""; const [y, m, dd] = d.split("-").map(Number); return `${dd}/${m}/${y + 543}`; };
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const PRIORITY_CLS: Record<string, string> = { URGENT: "bg-danger/15 text-danger border-danger/30", HIGH: "bg-warning/15 text-warning border-warning/30", NORMAL: "bg-white/5 text-white/60 border-white/10", LOW: "bg-white/5 text-white/40 border-white/10" };

export default function DispatchPage() {
  const { companyId } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [form, setForm] = useState<any>(null);
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (body: any) => {
    const res = await apiFetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ดำเนินการไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try { const [b, a] = await Promise.all([call({ action: "board" }), call({ action: "assignees" })]); setJobs(b.jobs); setPeople(a.assignees); }
    catch (e: any) { showAlert(e.message); } finally { setLoading(false); }
  }, [companyId, call, showAlert]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return jobs.filter((j) => (typeFilter === "ALL" || j.type === typeFilter) && (!s || [j.jobNo, j.title, j.site?.name, j.customerName, ...(j.assigneeNames || [])].some((v) => String(v || "").toLowerCase().includes(s))));
  }, [jobs, q, typeFilter]);
  const job = jobs.find((j) => j.jobNo === openNo) || null;
  const toolsPending = jobs.filter((j) => toolsOut(j).length > 0).length;
  const todayCount = jobs.filter((j) => j.scheduledDate === today() && !["DONE", "CANCELLED"].includes(j.status)).length;

  const run = async (body: any, msg?: string) => {
    setBusy(true);
    try { await call(body); await load(); if (msg) showAlert(msg); return true; }
    catch (e: any) { showAlert(e.message); return false; } finally { setBusy(false); }
  };

  return (
    <div className="px-6 py-4 space-y-4 max-w-[1800px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white leading-normal">ศูนย์จ่ายงาน</h1>
          <p className="text-[13px] text-white/50">มอบหมายงานบริการ ติดตั้ง MA จัดของ ขนย้าย และส่งของ ให้ช่างและพนักงาน · ผู้รับงานกดรับที่หน้า &quot;งานของฉัน&quot;</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={load} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</PillButton>
          <PillButton variant="primary" className="h-9 px-5 text-xs font-bold" onClick={() => setForm({ type: "SERVICE", priority: "NORMAL", scheduledDate: today(), equipment: [], checklist: JOB_TYPES[0].checklist, assignees: [], site: {} })}><Plus size={14} className="mr-1" /> สร้างงาน</PillButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[["นัดวันนี้", todayCount], ["รอจ่ายงาน", jobs.filter((j) => ["OPEN", "REJECTED"].includes(j.status)).length], ["รอรับงาน", jobs.filter((j) => j.status === "ASSIGNED").length], ["กำลังดำเนินการ", jobs.filter((j) => ["ACCEPTED", "IN_PROGRESS"].includes(j.status)).length], ["เครื่องมือค้างคืน", toolsPending]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <p className="text-[12px] text-white/50">{l}</p>
            <p className="text-[20px] font-bold font-mono text-white">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NexusSearchInput placeholder="ค้นหาเลขงาน ชื่องาน สถานที่ ผู้รับงาน…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full md:w-[360px]" />
        <div className="flex gap-1.5 flex-wrap">
          {[{ value: "ALL", label: "ทุกประเภท" }, ...JOB_TYPES].map((t) => (
            <button key={t.value} type="button" onClick={() => setTypeFilter(t.value)} className={cn("h-8 px-3 rounded-full border text-[12px]", typeFilter === t.value ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "border-white/10 text-white/60 hover:text-white")}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const items = filtered.filter((j) => col.statuses.includes(j.status)).slice(0, col.id === "done" ? 20 : 200);
          return (
            <div key={col.id} className="rounded-2xl border border-white/10 bg-white/[0.015] p-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div><p className="text-[14px] font-semibold text-white">{col.title}</p><p className="text-[11px] text-white/40">{col.hint}</p></div>
                <span className="text-[13px] font-mono text-white/60">{items.length}</span>
              </div>
              {items.length === 0 && <p className="text-[12px] text-white/30 text-center py-6">ไม่มีงาน</p>}
              {items.map((j) => (
                <button key={j.jobNo} type="button" onClick={() => setOpenNo(j.jobNo)} className="w-full text-left rounded-xl border border-white/10 bg-surface-0 hover:border-nexus-teal/40 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono text-white/40">{j.jobNo}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-nexus-blue/15 text-nexus-blue">{jobTypeLabel(j.type)}</span>
                    {j.priority !== "NORMAL" && <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full border", PRIORITY_CLS[j.priority])}>{JOB_PRIORITY[j.priority]}</span>}
                    {j.status === "REJECTED" && <span className="text-[11px] text-danger">ถูกปฏิเสธ</span>}
                  </div>
                  <p className="text-[14px] font-semibold text-white leading-normal">{j.title}</p>
                  <div className="text-[12px] text-white/50 space-y-0.5">
                    {(j.scheduledDate || j.scheduledTime) && <p className="flex items-center gap-1"><CalendarClock size={12} /> {thDate(j.scheduledDate)} {j.scheduledTime}</p>}
                    {j.site?.name && <p className="flex items-center gap-1 truncate"><MapPin size={12} className="flex-shrink-0" /> {j.site.name}</p>}
                    <p className="flex items-center gap-1 truncate"><Users size={12} className="flex-shrink-0" /> {j.assigneeNames?.length ? j.assigneeNames.join(", ") : <span className="text-warning">ยังไม่มีผู้รับงาน</span>}</p>
                    {toolsOut(j).length > 0 && j.status === "DONE" && <p className="text-warning flex items-center gap-1"><Hammer size={12} /> เครื่องมือยังไม่คืน</p>}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {form && <JobForm initial={form} people={people} busy={busy} onClose={() => setForm(null)}
        onSave={async (job) => { const ok = await run(job.jobNo ? { action: "update", jobNo: job.jobNo, job } : { action: "create", job }, job.jobNo ? "บันทึกการแก้ไขแล้ว" : undefined); if (ok) setForm(null); }} />}
      {job && !form && <JobDrawer job={job} people={people} busy={busy} onClose={() => setOpenNo(null)}
        onEdit={() => setForm({ ...job })}
        onAssign={(assignees) => run({ action: "assign", jobNo: job.jobNo, assignees }, assignees.length ? "จ่ายงานแล้ว ผู้รับงานจะเห็นในหน้า งานของฉัน" : undefined)}
        onReturnTools={() => run({ action: "returnTools", jobNo: job.jobNo }, "บันทึกการคืนเครื่องมือแล้ว")}
        onCancel={async (reason) => { if (await showConfirm(`ยกเลิกงาน ${job.jobNo}?`)) { if (await run({ action: "cancel", jobNo: job.jobNo, reason })) setOpenNo(null); } }} />}
    </div>
  );
}

function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100000] flex justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-[720px] h-full bg-surface-0 border-l border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10"><h3 className="text-[17px] font-semibold text-white">{title}</h3><button type="button" onClick={onClose} className="text-white/50 hover:text-white" aria-label="ปิด"><X size={20} /></button></div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2 flex-wrap">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1", className)}><label className="block text-[12px] font-bold text-white/70 ml-1">{label}</label>{children}</div>
);

function PeoplePicker({ people, value, onChange }: { people: any[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {people.length === 0 && <p className="text-[13px] text-white/40">ไม่พบผู้ใช้ในบริษัท</p>}
      {people.map((p) => {
        const on = value.includes(p.uid);
        return (
          <button key={p.uid} type="button" onClick={() => onChange(on ? value.filter((x) => x !== p.uid) : [...value, p.uid])}
            className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-left", on ? "bg-nexus-teal/10 border-nexus-teal/40" : "border-white/10 hover:bg-white/5")}>
            <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0", on ? "bg-nexus-teal border-nexus-teal text-surface-0" : "border-white/30")}>{on && <Check size={13} strokeWidth={3} />}</span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] text-white truncate">{p.name}</span><span className="block text-[11px] text-white/40">งานค้าง {p.openJobs} งาน</span></span>
          </button>
        );
      })}
    </div>
  );
}

function JobForm({ initial, people, busy, onClose, onSave }: { initial: any; people: any[]; busy: boolean; onClose: () => void; onSave: (job: any) => void }) {
  const [f, setF] = useState<any>(() => ({ ...initial, site: { ...(initial.site || {}) }, equipment: [...(initial.equipment || [])], checklist: (initial.checklist || []).map((c: any) => (typeof c === "string" ? c : c.text)) }));
  const { data: products } = useProducts<any>();
  const [pq, setPq] = useState("");
  const [freeName, setFreeName] = useState("");
  const isEdit = !!f.jobNo;
  const locked = isEdit && ["ACCEPTED", "IN_PROGRESS"].includes(f.status);
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const setType = (t: JobType) => set({ type: t, checklist: JOB_TYPES.find((x) => x.value === t)!.checklist });
  const matches = pq.trim().length >= 1 ? products.filter((p: any) => (p.itemType || "PRODUCT") === "PRODUCT" && [p.name, p.sku].some((v: any) => String(v || "").toLowerCase().includes(pq.trim().toLowerCase()))).slice(0, 8) : [];
  const addItem = (item: JobItem) => { set({ equipment: [...f.equipment, item] }); setPq(""); };
  const valid = String(f.title || "").trim().length > 0;
  return (
    <Drawer title={isEdit ? `แก้ไขงาน ${f.jobNo}` : "สร้างงาน"} onClose={onClose}
      footer={<><PillButton variant="ghost" className="h-10 px-5 text-xs" onClick={onClose}>ยกเลิก</PillButton>
        <PillButton variant="confirm" className="h-10 px-6 text-xs font-bold" disabled={busy || !valid} onClick={() => onSave({ ...f, checklist: f.checklist.filter((c: string) => c.trim()) })}>{busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />} {isEdit ? "บันทึก" : f.assignees.length ? "สร้างและจ่ายงาน" : "สร้างงาน (ยังไม่จ่าย)"}</PillButton></>}>
      <Field label="ประเภทงาน">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {JOB_TYPES.map((t) => (
            <button key={t.value} type="button" disabled={locked} onClick={() => setType(t.value)} className={cn("rounded-xl border px-3 py-2 text-left", f.type === t.value ? "bg-nexus-teal/10 border-nexus-teal/40" : "border-white/10 hover:bg-white/5")}>
              <span className="block text-[13px] font-semibold text-white">{t.label}</span>
              <span className="block text-[11px] text-white/40 leading-snug">{t.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="ชื่องาน *"><PillInput value={f.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder="เช่น ซ่อมกล้องวงจรปิด ร้านสาขา 3" className="w-full h-10 text-sm" /></Field>
      <Field label="รายละเอียด"><textarea value={f.description || ""} onChange={(e) => set({ description: e.target.value })} rows={3} className="w-full rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-sm text-white leading-relaxed outline-none focus:border-nexus-teal/50" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field label="วันที่นัด"><PillInput type="date" value={f.scheduledDate || ""} onChange={(e) => set({ scheduledDate: e.target.value })} className="w-full h-10 text-sm" /></Field>
        <Field label="เวลา"><PillInput type="time" value={f.scheduledTime || ""} onChange={(e) => set({ scheduledTime: e.target.value })} className="w-full h-10 text-sm" /></Field>
        <Field label="ใช้เวลาประมาณ (ชม.)"><PillInput type="number" value={f.estimatedHours || ""} onChange={(e) => set({ estimatedHours: e.target.value })} className="w-full h-10 text-sm font-mono" /></Field>
        <Field label="ความเร่งด่วน">
          <PillSelect value={f.priority} onChange={(e) => set({ priority: e.target.value as JobPriority })} className="w-full h-10 text-sm">
            {Object.entries(JOB_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </PillSelect>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="สถานที่/จุดงาน"><PillInput value={f.site.name || ""} onChange={(e) => set({ site: { ...f.site, name: e.target.value } })} placeholder="เช่น คลังหลัก หรือ บ้านลูกค้า" className="w-full h-10 text-sm" /></Field>
        <Field label="ลูกค้า (ถ้ามี)"><PillInput value={f.customerName || ""} onChange={(e) => set({ customerName: e.target.value })} className="w-full h-10 text-sm" /></Field>
        <Field label="ที่อยู่" className="sm:col-span-2"><PillInput value={f.site.address || ""} onChange={(e) => set({ site: { ...f.site, address: e.target.value } })} className="w-full h-10 text-sm" /></Field>
        <Field label="ผู้ติดต่อ"><PillInput value={f.site.contact || ""} onChange={(e) => set({ site: { ...f.site, contact: e.target.value } })} className="w-full h-10 text-sm" /></Field>
        <Field label="เบอร์โทร"><PillInput value={f.site.phone || ""} onChange={(e) => set({ site: { ...f.site, phone: e.target.value } })} className="w-full h-10 text-sm font-mono" /></Field>
      </div>

      <Field label={`อุปกรณ์ที่ต้องใช้${locked ? " (รับไปแล้ว แก้ไขไม่ได้)" : ""}`}>
        <div className="space-y-2">
          {f.equipment.map((e: JobItem, i: number) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full", e.kind === "TOOL" ? "bg-warning/15 text-warning" : "bg-nexus-teal/15 text-nexus-teal")}>{e.kind === "TOOL" ? "เครื่องมือ" : "วัสดุ"}</span>
              <span className="flex-1 min-w-0 text-[13px] text-white truncate">{e.name}{e.productId ? <span className="text-white/40"> · ตัดสต็อก</span> : null}</span>
              <PillInput type="number" value={e.qty} disabled={locked} onChange={(ev) => set({ equipment: f.equipment.map((x: JobItem, k: number) => (k === i ? { ...x, qty: Number(ev.target.value) } : x)) })} className="h-8 w-[80px] text-sm font-mono" />
              <span className="text-[12px] text-white/50 w-10">{e.unit || ""}</span>
              {!locked && <button type="button" onClick={() => set({ equipment: f.equipment.filter((_: any, k: number) => k !== i) })} className="text-white/40 hover:text-danger" aria-label="ลบ"><Trash2 size={15} /></button>}
            </div>
          ))}
          {!locked && (
            <div className="space-y-1.5">
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <PillInput value={pq} onChange={(e) => setPq(e.target.value)} placeholder="ค้นหาสินค้าในคลัง เพื่อเพิ่มเป็นวัสดุ (ตัดสต็อกตอนรับงาน)" className="w-full h-10 text-sm pl-10" />
              </div>
              {matches.length > 0 && (
                <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                  {matches.map((p: any) => (
                    <button key={p.id} type="button" onClick={() => addItem({ kind: "MATERIAL", productId: p.id, sku: p.sku, name: p.name || p.sku, qty: 1, unit: p.unit })} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5">
                      <span className="text-[13px] text-white truncate">{p.sku ? `${p.sku} · ` : ""}{p.name}</span>
                      <span className="text-[12px] text-white/50 whitespace-nowrap">คงเหลือ {Number(p.stockStatus?.onHand ?? 0).toLocaleString("th-TH")} {p.unit || ""}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <PillInput value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="ชื่อเครื่องมือ หรือวัสดุที่ไม่มีในคลัง" className="h-9 flex-1 min-w-[200px] text-sm" />
                <PillButton variant="glass" className="h-9 px-4 text-xs" disabled={!freeName.trim()} onClick={() => { addItem({ kind: "TOOL", name: freeName.trim(), qty: 1 }); setFreeName(""); }}><Hammer size={14} className="mr-1" /> เพิ่มเป็นเครื่องมือ (ยืม-คืน)</PillButton>
                <PillButton variant="glass" className="h-9 px-4 text-xs" disabled={!freeName.trim()} onClick={() => { addItem({ kind: "MATERIAL", name: freeName.trim(), qty: 1 }); setFreeName(""); }}><Package size={14} className="mr-1" /> เพิ่มเป็นวัสดุ</PillButton>
              </div>
            </div>
          )}
        </div>
      </Field>

      <Field label="ขั้นตอนงาน (เช็กลิสต์)">
        <div className="space-y-1.5">
          {f.checklist.map((c: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[12px] text-white/40 w-5 text-right">{i + 1}.</span>
              <PillInput value={c} disabled={locked} onChange={(e) => set({ checklist: f.checklist.map((x: string, k: number) => (k === i ? e.target.value : x)) })} className="flex-1 h-9 text-sm" />
              {!locked && <button type="button" onClick={() => set({ checklist: f.checklist.filter((_: any, k: number) => k !== i) })} className="text-white/40 hover:text-danger" aria-label="ลบ"><Trash2 size={14} /></button>}
            </div>
          ))}
          {!locked && <button type="button" onClick={() => set({ checklist: [...f.checklist, ""] })} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1 ml-7"><Plus size={12} /> เพิ่มขั้นตอน</button>}
        </div>
      </Field>

      {!isEdit && <Field label="ผู้รับงาน (เลือกได้หลายคน · ไม่เลือก = เก็บไว้จ่ายทีหลัง)"><PeoplePicker people={people} value={f.assignees} onChange={(v) => set({ assignees: v })} /></Field>}
    </Drawer>
  );
}

function JobDrawer({ job, people, busy, onClose, onEdit, onAssign, onReturnTools, onCancel }: { job: Job; people: any[]; busy: boolean; onClose: () => void; onEdit: () => void; onAssign: (a: string[]) => void; onReturnTools: () => void; onCancel: (reason: string) => void }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [assignees, setAssignees] = useState<string[]>(job.assignees || []);
  useEffect(() => setAssignees(job.assignees || []), [job.jobNo, job.assignees]);
  const closed = ["DONE", "CANCELLED"].includes(job.status);
  const issued = job.equipment.some((e) => (Number(e.issuedQty) || 0) > 0);
  const changed = JSON.stringify([...assignees].sort()) !== JSON.stringify([...(job.assignees || [])].sort());
  const out = toolsOut(job);
  return (
    <Drawer title={`${job.jobNo} · ${jobTypeLabel(job.type)}`} onClose={onClose}
      footer={<>
        {!closed && !cancelling && <PillButton variant="ghost" className="h-10 px-4 text-xs text-danger" onClick={() => setCancelling(true)} disabled={busy}>ยกเลิกงาน</PillButton>}
        {cancelling && <>
          <PillInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลที่ยกเลิก" className="h-10 w-[240px] text-sm" />
          <PillButton variant="ghost" className="h-10 px-4 text-xs text-danger border border-danger/30" disabled={busy || reason.trim().length < 3} onClick={() => onCancel(reason.trim())}>ยืนยันยกเลิก</PillButton>
          <PillButton variant="ghost" className="h-10 px-3 text-xs" onClick={() => setCancelling(false)}>ไม่ยกเลิก</PillButton>
        </>}
        {out.length > 0 && <PillButton variant="glass" className="h-10 px-4 text-xs" onClick={onReturnTools} disabled={busy}><Hammer size={14} className="mr-1" /> บันทึกคืนเครื่องมือ</PillButton>}
        {!closed && <PillButton variant="glass" className="h-10 px-4 text-xs" onClick={onEdit} disabled={busy}>แก้ไขรายละเอียด</PillButton>}
      </>}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={JOB_STATUS[job.status].badge} label={JOB_STATUS[job.status].label} />
          {job.priority !== "NORMAL" && <span className={cn("text-[12px] px-2 py-0.5 rounded-full border", PRIORITY_CLS[job.priority])}>{JOB_PRIORITY[job.priority]}</span>}
        </div>
        <h2 className="text-[19px] font-bold text-white leading-normal">{job.title}</h2>
        {job.description && <p className="text-[14px] text-white/70 whitespace-pre-line">{job.description}</p>}
        <div className="text-[13px] text-white/60 space-y-1">
          {(job.scheduledDate || job.scheduledTime) && <p className="flex items-center gap-2"><CalendarClock size={14} /> {thDate(job.scheduledDate)} {job.scheduledTime}{job.estimatedHours ? ` · ประมาณ ${job.estimatedHours} ชม.` : ""}</p>}
          {(job.site?.name || job.site?.address) && <p className="flex items-center gap-2"><MapPin size={14} /> {[job.site?.name, job.site?.address].filter(Boolean).join(" · ")}</p>}
          {job.site?.contact && <p>ผู้ติดต่อ {job.site.contact} {job.site.phone}</p>}
          {job.rejectReason && job.status === "REJECTED" && <p className="text-danger">เหตุผลที่ปฏิเสธ: {job.rejectReason}</p>}
          {job.resultNote && <p>สรุปผล: {job.resultNote}</p>}
        </div>
      </div>

      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-white flex items-center gap-2"><Users size={15} /> ผู้รับงาน</h3>
          {!closed && changed && <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold" disabled={busy || (issued && ["ACCEPTED", "IN_PROGRESS"].includes(job.status))} onClick={() => onAssign(assignees)}>{assignees.length ? "จ่ายงาน" : "ถอนผู้รับงาน"}</PillButton>}
        </div>
        {closed ? <p className="text-[13px] text-white/70">{job.assigneeNames?.join(", ") || "-"}</p> : <PeoplePicker people={people} value={assignees} onChange={setAssignees} />}
        {issued && !closed && <p className="text-[12px] text-white/40">ผู้รับงานเบิกอุปกรณ์แล้ว เปลี่ยนผู้รับงานไม่ได้จนกว่าจะปิดงาน</p>}
      </GlassCard>

      {job.equipment.length > 0 && (
        <GlassCard className="p-4 space-y-1">
          <h3 className="text-[14px] font-semibold text-white mb-1">อุปกรณ์</h3>
          {job.equipment.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-[13px] py-1 border-b border-white/5 last:border-0">
              <span className="text-white">{e.kind === "TOOL" ? "เครื่องมือ" : "วัสดุ"} · {e.name}</span>
              <span className="text-white/60 font-mono">{e.qty} {e.unit || ""} {e.kind === "TOOL" && (Number(e.issuedQty) || 0) > 0 ? ((Number(e.returnedQty) || 0) >= (Number(e.issuedQty) || 0) ? "· คืนแล้ว" : "· ยืมอยู่") : (Number(e.issuedQty) || 0) > 0 ? "· รับแล้ว" : ""}</span>
            </div>
          ))}
        </GlassCard>
      )}

      {job.checklist.length > 0 && (
        <GlassCard className="p-4 space-y-1">
          <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2"><ClipboardList size={15} /> ความคืบหน้า {job.checklist.filter((c) => c.done).length}/{job.checklist.length}</h3>
          {job.checklist.map((c, i) => <p key={i} className={cn("text-[13px]", c.done ? "text-nexus-teal" : "text-white/60")}>{c.done ? "✓" : "○"} {c.text}</p>)}
        </GlassCard>
      )}

      <div className="space-y-1">
        <h3 className="text-[13px] font-semibold text-white/70">ประวัติ</h3>
        {[...(job.history || [])].reverse().map((h, i) => (
          <p key={i} className="text-[12px] text-white/50"><span className="font-mono text-white/40">{new Date(h.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span> · {h.action}{h.note ? `: ${h.note}` : ""} · {h.byName}</p>
        ))}
      </div>
    </Drawer>
  );
}
