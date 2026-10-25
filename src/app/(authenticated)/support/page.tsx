"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, Check, Clock, FileText, Headset, Image as ImageIcon, Inbox, Link as LinkIcon, Loader2, Phone, Plus, RefreshCw, Search, ShieldCheck, Wrench, X } from "lucide-react";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { GlassCard, NexusSearchInput, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, StatusBadge, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { canAny } from "@/lib/permissions";
import { JOB_STATUS } from "@/lib/jobs";
import { OPEN_TICKET_STATUSES, SLA_HOURS, TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITY, TICKET_STATUS, slaRemainingHours, ticketCategoryLabel, ticketChannelLabel, type TicketPriority } from "@/lib/service-tickets";

/**
 * งานบริการและแจ้งซ่อม: รับเรื่อง → ส่งให้ช่าง (สร้างงานในศูนย์จ่ายงาน) → ช่างปิดงาน = แก้ไขแล้ว → ปิดเรื่อง
 * ติดตาม SLA ตามความเร่งด่วน และรับคำขอที่ลูกค้าแจ้งผ่านพอร์ทัล
 */
type Filter = "open" | "overdue" | "resolved" | "all";
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-");
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function Sla({ t }: { t: any }) {
  if (!OPEN_TICKET_STATUSES.includes(t.status)) return <span className="text-white/30">-</span>;
  const h = slaRemainingHours(t.slaDueAt);
  if (h === null) return <span className="text-white/30">-</span>;
  if (h < 0) return <span className="text-danger font-bold">เกิน {Math.abs(Math.round(h))} ชม.</span>;
  return <span className={cn(h <= 4 ? "text-warning" : "text-white/70")}>เหลือ {h < 1 ? "<1" : Math.round(h)} ชม.</span>;
}

export default function ServicePage() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = canAny(roles, ["sales:edit", "projects:edit", "inventory:edit", "projects:approve"]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [portal, setPortal] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>(null);
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [showAllPortal, setShowAllPortal] = useState(false);

  const call = useCallback(async (url: string, body: any) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ดำเนินการไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const d = await call("/api/service/tickets", { action: "list" });
      setTickets(d.tickets); setPortal(d.portal);
      if (canEdit && !people.length) { try { const a = await call("/api/jobs", { action: "assignees" }); setPeople(a.assignees); } catch { /* ผู้ใช้ที่จ่ายงานไม่ได้ */ } }
    } catch (e: any) { showAlert(e.message); } finally { setLoading(false); }
  }, [companyId, call, canEdit, people.length, showAlert]);
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = tickets.filter((t) => OPEN_TICKET_STATUSES.includes(t.status));
  const overdue = open.filter((t) => (slaRemainingHours(t.slaDueAt) ?? 1) < 0);
  const resolvedMonth = tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status) && String(t.createdAt || "").slice(0, 7) === today().slice(0, 7));
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = filter === "open" ? open : filter === "overdue" ? overdue : filter === "resolved" ? tickets.filter((t) => t.status === "RESOLVED") : tickets;
    return base.filter((t) => !s || [t.ticketNo, t.customerName, t.phone, t.symptom, t.serialNumber, t.productName].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [tickets, open, overdue, filter, q]);
  const ticket = tickets.find((t) => t.ticketNo === openNo) || null;

  const run = async (url: string, body: any, msg?: string) => {
    setBusy(true);
    try { const d = await call(url, body); await load(); if (msg) showAlert(msg); return d; }
    catch (e: any) { showAlert(e.message); return null; } finally { setBusy(false); }
  };

  return (
    <div className="px-6 py-4 space-y-4 max-w-[1800px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-nexus-teal/20 border border-nexus-teal/20 rounded-xl flex items-center justify-center"><Headset size={22} className="text-nexus-teal" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-normal">งานบริการและแจ้งซ่อม</h1>
            <p className="text-[13px] text-white/50">รับเรื่อง → ส่งให้ช่าง → ช่างปิดงาน → ปิดเรื่อง · ติดตามเวลาแก้ไขตามความเร่งด่วน</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={load} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</PillButton>
          <PillButton variant="glass" className="h-9 px-4 text-xs" title="ลิงก์ให้ลูกค้าแจ้งซ่อมเอง (ส่งทาง LINE/อีเมล หรือทำเป็น QR)" onClick={async () => { const url = `${window.location.origin}/portal/repair?company=${encodeURIComponent(companyId || "")}`; try { await navigator.clipboard.writeText(url); showAlert(`คัดลอกลิงก์แจ้งซ่อมสำหรับลูกค้าแล้ว
${url}`); } catch { showAlert(url, "ลิงก์แจ้งซ่อมสำหรับลูกค้า"); } }}><LinkIcon size={14} /> ลิงก์แจ้งซ่อม</PillButton>
          <Link href="/service/dispatch"><PillButton variant="glass" className="h-9 px-4 text-xs font-bold">ศูนย์จ่ายงาน</PillButton></Link>
          {canEdit && <PillButton variant="primary" className="h-9 px-5 text-xs font-bold" onClick={() => setForm({ priority: "NORMAL", category: "REPAIR", channel: "PHONE" })}><Plus size={14} className="mr-1" /> รับแจ้งซ่อม</PillButton>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([["open", "เรื่องที่เปิดอยู่", open.length, Inbox], ["overdue", "เกินเวลาที่กำหนด", overdue.length, AlertTriangle], ["resolved", "แก้ไขแล้ว รอปิดเรื่อง", tickets.filter((t) => t.status === "RESOLVED").length, Check], ["all", "แก้ไขเสร็จเดือนนี้", resolvedMonth.length, ShieldCheck]] as [Filter, string, number, any][]).map(([id, label, n, Icon]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={cn("rounded-xl border px-4 py-3 text-left", filter === id ? "bg-nexus-teal/10 border-nexus-teal/40" : "border-white/10 bg-white/[0.02]")}>
            <p className="text-[12px] text-white/50 flex items-center gap-1.5"><Icon size={13} className={id === "overdue" && n > 0 ? "text-danger" : ""} /> {label}</p>
            <p className={cn("text-[20px] font-bold font-mono", id === "overdue" && n > 0 ? "text-danger" : "text-white")}>{n}</p>
          </button>
        ))}
      </div>

      {portal.length > 0 && canEdit && (
        <GlassCard className="p-4 space-y-2 border-warning/30">
          <p className="text-[14px] font-semibold text-white flex items-center gap-2"><Inbox size={16} className="text-warning" /> ลูกค้าแจ้งผ่านพอร์ทัล รอรับเรื่อง ({portal.length})</p>
          {(showAllPortal ? portal : portal.slice(0, 5)).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-[13px] border-t border-white/5 pt-2">
              <span className="text-white/80 min-w-0 truncate">{fmt(p.createdAt)} · {p.customerName ? `${p.customerName} ` : ""}{p.phoneNumber}{p.serialNumber ? ` · S/N ${p.serialNumber}` : ""} · {p.symptom}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {p.hasPhoto && <PillButton variant="ghost" className="h-8 px-3 text-xs" disabled={busy} onClick={async () => { const d = await run("/api/service/tickets", { action: "portalPhoto", portalId: p.id }); if (d?.photo) setPhoto(d.photo); }}><ImageIcon size={13} /> รูป</PillButton>}
                <PillButton variant="ghost" className="h-8 px-3 text-xs text-white/50" disabled={busy} onClick={async () => { if (await showConfirm(`ไม่รับเรื่องจากเบอร์ ${p.phoneNumber}? (เช่น แจ้งซ้ำหรือข้อความรบกวน)`)) run("/api/service/tickets", { action: "dismissPortal", portalId: p.id }); }}>ไม่รับ</PillButton>
                <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => setForm({ priority: "NORMAL", category: "REPAIR", channel: "PORTAL", customerName: p.customerName || "", phone: p.phoneNumber, symptom: p.symptom, serialNumber: p.serialNumber, portalId: p.id })}>รับเรื่อง</PillButton>
              </div>
            </div>
          ))}
          {portal.length > 5 && <button type="button" onClick={() => setShowAllPortal((v) => !v)} className="text-[13px] text-nexus-teal hover:underline">{showAllPortal ? "ย่อ" : `ดูทั้งหมด ${portal.length} รายการ`}</button>}
        </GlassCard>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <NexusSearchInput placeholder="ค้นหาเลขที่ ลูกค้า เบอร์โทร อาการ หมายเลขเครื่อง…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full md:w-[380px]" />
      </div>

      <GlassCard accentColor="teal" className="p-0 overflow-hidden">
        <NexusTable headers={["เลขที่", "วันที่แจ้ง", "ลูกค้า", "อาการ/เรื่อง", "ประเภท", "ความเร่งด่วน", "เวลาที่เหลือ", "ช่างผู้รับผิดชอบ", "สถานะ"]} itemCount={shown.length}>
          {shown.length === 0 && <NexusTableRow className="cursor-default"><NexusTableCell colSpan={9} className="text-center text-[13px] text-white/40 py-10">{loading ? "กำลังโหลด…" : "ไม่มีใบแจ้งในรายการนี้"}</NexusTableCell></NexusTableRow>}
          {shown.map((t) => (
            <NexusTableRow key={t.ticketNo} onClick={() => setOpenNo(t.ticketNo)}>
              <NexusTableCell mono>{t.ticketNo}</NexusTableCell>
              <NexusTableCell mono>{fmt(t.createdAt)}</NexusTableCell>
              <NexusTableCell title={`${t.customerName} ${t.phone}`}>{t.customerName || t.phone || "-"}</NexusTableCell>
              <NexusTableCell title={t.symptom}>{t.symptom}</NexusTableCell>
              <NexusTableCell>{ticketCategoryLabel(t.category)}</NexusTableCell>
              <NexusTableCell>{TICKET_PRIORITY[t.priority as TicketPriority]?.split(" ")[0] || t.priority}</NexusTableCell>
              <NexusTableCell><Sla t={t} /></NexusTableCell>
              <NexusTableCell title={t.jobs?.[0]?.assigneeNames?.join(", ")}>{t.jobs?.length ? t.jobs[t.jobs.length - 1].assigneeNames?.join(", ") || "รอจ่ายงาน" : "-"}</NexusTableCell>
              <NexusTableCell><StatusBadge status={TICKET_STATUS[t.status as keyof typeof TICKET_STATUS]?.badge || "pending"} label={TICKET_STATUS[t.status as keyof typeof TICKET_STATUS]?.label || t.status} /></NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      </GlassCard>

      {photo && <PhotoViewer src={photo} onClose={() => setPhoto(null)} />}
      {form && <TicketForm initial={form} busy={busy} call={call} onClose={() => setForm(null)}
        onSave={async (ticket, portalId) => { const d = await run("/api/service/tickets", { action: "create", ticket, portalId }); if (d) { setForm(null); setOpenNo(d.ticketNo); } }} />}
      {ticket && !form && <TicketDrawer ticket={ticket} people={people} canEdit={canEdit} busy={busy} onClose={() => setOpenNo(null)}
        onAction={(action, extra = {}) => run(extra.url || "/api/service/tickets", { action, ticketNo: ticket.ticketNo, ...extra }, extra.msg)} />}
    </div>
  );
}

function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="รูปที่ลูกค้าแนบ" className="relative max-w-full max-h-[90vh] rounded-2xl" />
    </div>,
    document.body
  );
}

function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100000] flex justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-[640px] h-full bg-surface-0 border-l border-white/10 flex flex-col">
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
const Chips = ({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex gap-1.5 flex-wrap">{options.map((o) => <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn("h-9 px-3 rounded-full border text-[13px]", value === o.value ? "bg-nexus-teal/15 border-nexus-teal/40 text-nexus-teal" : "border-white/10 text-white/60 hover:text-white")}>{o.label}</button>)}</div>
);

function TicketForm({ initial, busy, call, onClose, onSave }: { initial: any; busy: boolean; call: (url: string, body: any) => Promise<any>; onClose: () => void; onSave: (t: any, portalId?: string) => void }) {
  const [f, setF] = useState<any>(initial);
  const [serial, setSerial] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const set = (p: any) => setF((x: any) => ({ ...x, ...p }));
  const check = async () => {
    if (!f.serialNumber?.trim()) return;
    setChecking(true);
    try { const d = await call("/api/service/tickets", { action: "lookupSerial", serial: f.serialNumber.trim() }); setSerial(d.found ? d.serial : { notFound: true }); if (d.found) set({ productName: f.productName || d.serial.productName, customerName: f.customerName || d.serial.customerName, inWarranty: d.serial.inWarranty }); }
    catch { setSerial(null); } finally { setChecking(false); }
  };
  const valid = f.symptom?.trim() && (f.customerName?.trim() || f.phone?.trim());
  return (
    <Drawer title={f.portalId ? "รับเรื่องจากพอร์ทัลลูกค้า" : "รับแจ้งซ่อม/งานบริการ"} onClose={onClose}
      footer={<><PillButton variant="ghost" className="h-10 px-5 text-xs" onClick={onClose}>ยกเลิก</PillButton><PillButton variant="confirm" className="h-10 px-6 text-xs font-bold" disabled={busy || !valid} onClick={() => onSave(f, f.portalId)}>{busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />} บันทึกใบแจ้ง</PillButton></>}>
      <Field label="ประเภทเรื่อง"><Chips options={TICKET_CATEGORIES} value={f.category} onChange={(v) => set({ category: v })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="ชื่อลูกค้า"><PillInput value={f.customerName || ""} onChange={(e) => set({ customerName: e.target.value })} className="w-full h-10 text-sm" /></Field>
        <Field label="เบอร์โทร"><PillInput value={f.phone || ""} onChange={(e) => set({ phone: e.target.value })} className="w-full h-10 text-sm font-mono" /></Field>
        <Field label="ที่อยู่/สถานที่ซ่อม" className="sm:col-span-2"><PillInput value={f.address || ""} onChange={(e) => set({ address: e.target.value })} className="w-full h-10 text-sm" /></Field>
      </div>
      <Field label="อาการ/เรื่องที่แจ้ง *"><textarea value={f.symptom || ""} onChange={(e) => set({ symptom: e.target.value })} rows={3} placeholder="เช่น กล้องตัวที่ 3 ภาพไม่ขึ้นตั้งแต่เมื่อวาน" className="w-full rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-sm text-white leading-relaxed outline-none focus:border-nexus-teal/50" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="หมายเลขเครื่อง (Serial)">
          <div className="flex gap-2">
            <PillInput value={f.serialNumber || ""} onChange={(e) => { set({ serialNumber: e.target.value }); setSerial(null); }} className="flex-1 h-10 text-sm font-mono" />
            <PillButton variant="glass" className="h-10 px-3 text-xs" onClick={check} disabled={checking || !f.serialNumber?.trim()}>{checking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ตรวจประกัน</PillButton>
          </div>
          {serial && (serial.notFound ? <p className="text-[12px] text-white/50 ml-1">ไม่พบหมายเลขนี้ในระบบ</p>
            : <p className={cn("text-[12px] ml-1", serial.inWarranty ? "text-nexus-teal" : "text-warning")}>{serial.productName} · {serial.inWarranty ? `อยู่ในประกันถึง ${serial.warrantyEndDate}` : serial.warrantyEndDate ? `หมดประกัน ${serial.warrantyEndDate}` : "ไม่มีข้อมูลประกัน"}</p>)}
        </Field>
        <Field label="สินค้า/อุปกรณ์"><PillInput value={f.productName || ""} onChange={(e) => set({ productName: e.target.value })} className="w-full h-10 text-sm" /></Field>
      </div>
      <Field label="ความเร่งด่วน (กำหนดเวลาแก้ไข)">
        <Chips options={(Object.keys(SLA_HOURS) as TicketPriority[]).reverse().map((k) => ({ value: k, label: TICKET_PRIORITY[k] }))} value={f.priority} onChange={(v) => set({ priority: v })} />
      </Field>
      <Field label="ช่องทางที่แจ้ง"><PillSelect value={f.channel} onChange={(e) => set({ channel: e.target.value })} className="w-full sm:w-[240px] h-10 text-sm">{TICKET_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</PillSelect></Field>
    </Drawer>
  );
}

function TicketDrawer({ ticket: t, people, canEdit, busy, onClose, onAction }: { ticket: any; people: any[]; canEdit: boolean; busy: boolean; onClose: () => void; onAction: (action: string, extra?: any) => Promise<any> }) {
  const [assignees, setAssignees] = useState<string[]>([]);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"" | "dispatch" | "cancel">("");
  const [doc, setDoc] = useState(false);
  const isOpen = OPEN_TICKET_STATUSES.includes(t.status);
  const st = TICKET_STATUS[t.status as keyof typeof TICKET_STATUS];
  return (
    <Drawer title={`${t.ticketNo} · ${ticketCategoryLabel(t.category)}`} onClose={onClose}
      footer={<>
        <PillButton variant="glass" className="h-10 px-4 text-xs" onClick={() => setDoc(true)} title="พิมพ์ หรือส่งใบเปิดเคสให้ลูกค้า (ลิงก์/อีเมล/LINE)"><FileText size={14} className="mr-1" /> ใบเปิดเคส</PillButton>
        {canEdit && <>
        {isOpen && mode !== "cancel" && <PillButton variant="ghost" className="h-10 px-4 text-xs text-danger" onClick={() => setMode("cancel")}>ยกเลิกเรื่อง</PillButton>}
        {isOpen && <PillButton variant="glass" className="h-10 px-4 text-xs" disabled={busy} onClick={() => onAction("resolve", { note: "แก้ไขแล้ว (ไม่ต้องส่งช่าง)" })}><Check size={14} className="mr-1" /> แก้ไขแล้ว</PillButton>}
        {t.status === "RESOLVED" && <PillButton variant="confirm" className="h-10 px-4 text-xs font-bold" disabled={busy} onClick={() => onAction("close")}>ปิดเรื่อง</PillButton>}
        {["RESOLVED", "CLOSED"].includes(t.status) && <PillButton variant="glass" className="h-10 px-4 text-xs" disabled={busy} onClick={() => onAction("reopen")}>เปิดเรื่องอีกครั้ง</PillButton>}
        {isOpen && mode !== "dispatch" && <PillButton variant="primary" className="h-10 px-5 text-xs font-bold" onClick={() => setMode("dispatch")}><Wrench size={14} className="mr-1" /> ส่งให้ช่าง</PillButton>}
        </>}
      </>}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap"><StatusBadge status={st?.badge || "pending"} label={st?.label || t.status} /><span className="text-[13px]"><Sla t={t} /></span></div>
        <p className="text-[16px] text-white leading-relaxed whitespace-pre-line">{t.symptom}</p>
        <div className="text-[13px] text-white/60 space-y-1">
          <p>{t.customerName || "-"}{t.phone ? <> · <a href={`tel:${t.phone}`} className="text-nexus-teal inline-flex items-center gap-1"><Phone size={12} /> {t.phone}</a></> : null}</p>
          {t.address && <p>{t.address}</p>}
          {(t.serialNumber || t.productName) && <p>{t.productName} {t.serialNumber ? `· S/N ${t.serialNumber}` : ""} {t.inWarranty ? <span className="text-nexus-teal">· อยู่ในประกัน</span> : null}</p>}
          <p className="flex items-center gap-1"><Clock size={12} /> แจ้งเมื่อ {fmt(t.createdAt)} ทาง{ticketChannelLabel(t.channel)} · ต้องแก้ไขภายใน {fmt(t.slaDueAt)}</p>
        </div>
      </div>

      {mode === "dispatch" && (
        <GlassCard className="p-4 space-y-3 border-nexus-teal/30">
          <p className="text-[14px] font-semibold text-white">ส่งให้ช่าง (สร้างงานในศูนย์จ่ายงาน)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันที่นัด"><PillInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 text-sm" /></Field>
            <Field label="เวลา"><PillInput type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-10 text-sm" /></Field>
          </div>
          <Field label="ผู้รับงาน (ไม่เลือก = ไปจ่ายในศูนย์จ่ายงาน)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto">
              {people.map((p) => {
                const on = assignees.includes(p.uid);
                return (
                  <button key={p.uid} type="button" onClick={() => setAssignees((a) => (on ? a.filter((x) => x !== p.uid) : [...a, p.uid]))} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-left", on ? "bg-nexus-teal/10 border-nexus-teal/40" : "border-white/10 hover:bg-white/5")}>
                    <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center", on ? "bg-nexus-teal border-nexus-teal text-surface-0" : "border-white/30")}>{on && <Check size={13} strokeWidth={3} />}</span>
                    <span className="min-w-0"><span className="block text-[13px] text-white truncate">{p.name}</span><span className="block text-[11px] text-white/40">งานค้าง {p.openJobs}</span></span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="หมายเหตุถึงช่าง"><PillInput value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-10 text-sm" /></Field>
          <div className="flex justify-end gap-2">
            <PillButton variant="ghost" className="h-9 px-4 text-xs" onClick={() => setMode("")}>ยกเลิก</PillButton>
            <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={busy} onClick={async () => { const d = await onAction("toJob", { assignees, scheduledDate: date, scheduledTime: time, note, msg: "" }); if (d) { setMode(""); setNote(""); } }}>สร้างงาน{assignees.length ? "และจ่ายงาน" : ""}</PillButton>
          </div>
        </GlassCard>
      )}
      {mode === "cancel" && (
        <GlassCard className="p-4 space-y-2 border-danger/30">
          <Field label="เหตุผลที่ยกเลิก"><PillInput value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-10 text-sm" /></Field>
          <div className="flex justify-end gap-2">
            <PillButton variant="ghost" className="h-9 px-4 text-xs" onClick={() => setMode("")}>ไม่ยกเลิก</PillButton>
            <PillButton variant="ghost" className="h-9 px-4 text-xs text-danger border border-danger/30" disabled={busy || note.trim().length < 3} onClick={async () => { if (await onAction("cancel", { note })) { setMode(""); setNote(""); } }}>ยืนยันยกเลิก</PillButton>
          </div>
        </GlassCard>
      )}

      {t.jobs?.length > 0 && (
        <GlassCard className="p-4 space-y-2">
          <p className="text-[14px] font-semibold text-white">งานช่างที่ผูกกับเรื่องนี้</p>
          {t.jobs.map((j: any) => (
            <div key={j.jobNo} className="flex items-center justify-between text-[13px]">
              <span className="text-white/80 font-mono">{j.jobNo}</span>
              <span className="text-white/60">{j.assigneeNames?.join(", ") || "รอจ่ายงาน"} {j.scheduledDate ? `· ${j.scheduledDate}` : ""}</span>
              <StatusBadge status={JOB_STATUS[j.status as keyof typeof JOB_STATUS]?.badge || "pending"} label={JOB_STATUS[j.status as keyof typeof JOB_STATUS]?.label || j.status} />
            </div>
          ))}
        </GlassCard>
      )}

      {canEdit && mode === "" && (
        <div className="flex gap-2">
          <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="บันทึกการติดตาม เช่น โทรแจ้งลูกค้าแล้ว" className="flex-1 h-10 text-sm" />
          <PillButton variant="glass" className="h-10 px-4 text-xs" disabled={busy || !note.trim()} onClick={async () => { if (await onAction("note", { note })) setNote(""); }}>บันทึก</PillButton>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-white/70">ประวัติ</p>
        {[...(t.history || [])].reverse().map((h: any, i: number) => (
          <p key={i} className="text-[12px] text-white/50"><span className="font-mono text-white/40">{fmt(h.at)}</span> · {h.action}{h.note ? `: ${h.note}` : ""} · {h.byName}</p>
        ))}
      </div>
      <DocumentPdfModal open={doc} onClose={() => setDoc(false)} title={`ใบเปิดเคส ${t.ticketNo}`} source={{ type: "service_ticket", id: t.ticketNo }} shareSource={{ type: "service_ticket", id: t.ticketNo }} />
    </Drawer>
  );
}
