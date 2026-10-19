"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ChevronLeft, ChevronRight, ClipboardList, Hammer, Loader2, MapPin, Package, Phone, PlayCircle, RefreshCw, Wrench, X } from "lucide-react";
import { PillButton, StatusBadge, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { JOB_PRIORITY, JOB_STATUS, jobTypeLabel, toolsOut, type Job } from "@/lib/jobs";

/**
 * งานของฉัน — ช่าง/พนักงานหลังร้านรับงานที่ถูกมอบหมาย (ข้อมูลจาก /api/jobs ใช้ร่วมกับแอปภายนอกได้)
 * ขั้นตอน: งานใหม่ → กดรับงาน (ยืนยันรับอุปกรณ์) → เริ่มงาน → ติ๊กเช็กลิสต์ → ปิดงาน (คืนเครื่องมือ)
 */
type Tab = "new" | "doing" | "done";
const thDate = (d?: string) => { if (!d) return ""; const [y, m, dd] = d.split("-").map(Number); return `${dd}/${m}/${y + 543}`; };
const PRIORITY_CLS: Record<string, string> = { URGENT: "bg-danger/15 text-danger border-danger/30", HIGH: "bg-warning/15 text-warning border-warning/30", NORMAL: "bg-white/5 text-white/60 border-white/10", LOW: "bg-white/5 text-white/40 border-white/10" };

export default function MyJobsPage() {
  const { companyId, user, displayName } = useAuth();
  const { showAlert } = useSystemDialog();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("new");
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "accept" | "reject" | "complete">(null);

  const call = useCallback(async (body: any) => {
    const res = await apiFetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ดำเนินการไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try { const d = await call({ action: "mine", includeDone: true }); setJobs(d.jobs); setWorkOrders(d.workOrders); }
    catch (e: any) { showAlert(e.message); } finally { setLoading(false); }
  }, [companyId, call, showAlert]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => ({
    new: jobs.filter((j) => j.status === "ASSIGNED"),
    doing: jobs.filter((j) => j.status === "ACCEPTED" || j.status === "IN_PROGRESS"),
    done: jobs.filter((j) => j.status === "DONE").slice(-30).reverse(),
  }), [jobs]);
  const job = jobs.find((j) => j.jobNo === openNo) || null;
  const openWo = workOrders.filter((w) => ["ASSIGNED", "IN_PROGRESS"].includes(String(w.status).toUpperCase())).length;

  const act = async (body: any, after?: () => void) => {
    setBusy(true);
    try { await call(body); setSheet(null); await load(); after?.(); }
    catch (e: any) { showAlert(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-4 pb-24 space-y-4">
      {!job ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-white/50">สวัสดี {displayName}</p>
              <h1 className="text-2xl font-bold text-white leading-normal">งานของฉัน</h1>
            </div>
            <button type="button" onClick={load} className="w-10 h-10 rounded-full border border-white/10 text-white/60 hover:text-white flex items-center justify-center" aria-label="รีเฟรช">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([["new", "งานใหม่", groups.new.length], ["doing", "กำลังทำ", groups.doing.length], ["done", "เสร็จแล้ว", groups.done.length]] as [Tab, string, number][]).map(([id, label, n]) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={cn("rounded-2xl border px-3 py-3 text-left transition-colors", tab === id ? "bg-nexus-teal/15 border-nexus-teal/40" : "bg-white/[0.02] border-white/10")}>
                <p className={cn("text-[22px] font-bold font-mono leading-none", tab === id ? "text-nexus-teal" : "text-white")}>{n}</p>
                <p className="text-[13px] text-white/60 mt-1">{label}</p>
              </button>
            ))}
          </div>

          {openWo > 0 && (
            <Link href="/mobile/technician/work-orders" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <span className="flex items-center gap-2 text-[14px] text-white"><ClipboardList size={18} className="text-nexus-blue" /> ใบสั่งงานบริการจากใบสั่งขาย</span>
              <span className="flex items-center gap-1 text-[13px] text-white/60">{openWo} ใบ <ChevronRight size={16} /></span>
            </Link>
          )}

          <div className="space-y-3">
            {groups[tab].length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-[14px] text-white/40">
                {loading ? "กำลังโหลด…" : tab === "new" ? "ยังไม่มีงานใหม่" : tab === "doing" ? "ไม่มีงานที่กำลังทำ" : "ยังไม่มีงานที่ปิดแล้ว"}
              </div>
            )}
            {groups[tab].map((j) => <JobCard key={j.jobNo} job={j} onOpen={() => setOpenNo(j.jobNo)} />)}
          </div>
        </>
      ) : (
        <JobDetail job={job} busy={busy} onBack={() => setOpenNo(null)}
          onAccept={() => setSheet("accept")} onReject={() => setSheet("reject")} onComplete={() => setSheet("complete")}
          onStart={() => act({ action: "start", jobNo: job.jobNo })}
          onCheck={(index, done) => act({ action: "check", jobNo: job.jobNo, index, done })} />
      )}

      {job && sheet === "accept" && (
        <Sheet title="รับงานและรับอุปกรณ์" onClose={() => setSheet(null)}>
          <AcceptSheet job={job} busy={busy} onConfirm={() => act({ action: "accept", jobNo: job.jobNo }, () => setTab("doing"))} />
        </Sheet>
      )}
      {job && sheet === "reject" && (
        <Sheet title="ปฏิเสธงาน" onClose={() => setSheet(null)}>
          <TextSheet label="เหตุผลที่รับงานไม่ได้" placeholder="เช่น ติดงานอื่น ไม่มีเครื่องมือ" confirm="ปฏิเสธงาน" danger busy={busy} min={3}
            onConfirm={(reason) => act({ action: "reject", jobNo: job.jobNo, reason }, () => setOpenNo(null))} />
        </Sheet>
      )}
      {job && sheet === "complete" && (
        <Sheet title="ปิดงาน" onClose={() => setSheet(null)}>
          <CompleteSheet job={job} busy={busy} onConfirm={(note, returnTools) => act({ action: "complete", jobNo: job.jobNo, note, returnTools }, () => { setOpenNo(null); setTab("done"); })} />
        </Sheet>
      )}
    </div>
  );
}

function JobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const done = job.checklist.filter((c) => c.done).length;
  return (
    <button type="button" onClick={onOpen} className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:border-nexus-teal/40 p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-mono text-white/50">{job.jobNo}</span>
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-nexus-blue/15 text-nexus-blue">{jobTypeLabel(job.type)}</span>
        {job.priority !== "NORMAL" && <span className={cn("text-[12px] px-2 py-0.5 rounded-full border", PRIORITY_CLS[job.priority])}>{JOB_PRIORITY[job.priority]}</span>}
        <span className="ml-auto"><StatusBadge status={JOB_STATUS[job.status].badge} label={JOB_STATUS[job.status].label} /></span>
      </div>
      <p className="text-[16px] font-semibold text-white leading-normal">{job.title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/60">
        {(job.scheduledDate || job.scheduledTime) && <span className="flex items-center gap-1"><CalendarClock size={14} /> {thDate(job.scheduledDate)} {job.scheduledTime}</span>}
        {job.site?.name && <span className="flex items-center gap-1 min-w-0"><MapPin size={14} className="flex-shrink-0" /> <span className="truncate">{job.site.name}</span></span>}
        {job.equipment.length > 0 && <span className="flex items-center gap-1"><Package size={14} /> อุปกรณ์ {job.equipment.length} รายการ</span>}
        {job.checklist.length > 0 && job.status !== "ASSIGNED" && <span className="flex items-center gap-1"><Check size={14} /> {done}/{job.checklist.length}</span>}
      </div>
    </button>
  );
}

function JobDetail({ job, busy, onBack, onAccept, onReject, onStart, onComplete, onCheck }: { job: Job; busy: boolean; onBack: () => void; onAccept: () => void; onReject: () => void; onStart: () => void; onComplete: () => void; onCheck: (i: number, done: boolean) => void }) {
  const canCheck = job.status === "ACCEPTED" || job.status === "IN_PROGRESS";
  const out = toolsOut(job);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[14px] text-nexus-teal"><ChevronLeft size={18} /> งานของฉัน</button>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-mono text-white/50">{job.jobNo}</span>
          <span className="text-[12px] px-2 py-0.5 rounded-full bg-nexus-blue/15 text-nexus-blue">{jobTypeLabel(job.type)}</span>
          {job.priority !== "NORMAL" && <span className={cn("text-[12px] px-2 py-0.5 rounded-full border", PRIORITY_CLS[job.priority])}>{JOB_PRIORITY[job.priority]}</span>}
          <span className="ml-auto"><StatusBadge status={JOB_STATUS[job.status].badge} label={JOB_STATUS[job.status].label} /></span>
        </div>
        <h2 className="text-[19px] font-bold text-white leading-normal">{job.title}</h2>
        {job.description && <p className="text-[14px] text-white/70 whitespace-pre-line leading-relaxed">{job.description}</p>}
        <div className="grid grid-cols-1 gap-2 text-[14px]">
          {(job.scheduledDate || job.scheduledTime) && <p className="flex items-center gap-2 text-white/80"><CalendarClock size={16} className="text-white/40" /> นัดหมาย {thDate(job.scheduledDate)} {job.scheduledTime}{job.estimatedHours ? ` · ประมาณ ${job.estimatedHours} ชม.` : ""}</p>}
          {(job.site?.name || job.site?.address) && <p className="flex items-start gap-2 text-white/80"><MapPin size={16} className="text-white/40 mt-0.5 flex-shrink-0" /> <span>{job.site?.name}{job.site?.address ? <><br /><span className="text-white/50 text-[13px]">{job.site.address}</span></> : null}</span></p>}
          {job.customerName && <p className="text-white/60 text-[13px]">ลูกค้า: {job.customerName}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {job.site?.phone && <a href={`tel:${job.site.phone}`} className="h-10 px-4 rounded-full border border-white/10 text-[14px] text-white flex items-center gap-2"><Phone size={16} /> โทร {job.site.contact || ""}</a>}
          {(job.site?.mapUrl || job.site?.address) && (
            <a href={job.site?.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.site?.address || "")}`} target="_blank" rel="noreferrer" className="h-10 px-4 rounded-full border border-white/10 text-[14px] text-white flex items-center gap-2"><MapPin size={16} /> นำทาง</a>
          )}
        </div>
      </div>

      {job.equipment.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
          <h3 className="text-[15px] font-semibold text-white flex items-center gap-2"><Hammer size={16} className="text-warning" /> อุปกรณ์สำหรับงานนี้</h3>
          {job.equipment.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate">{e.name}</p>
                <p className="text-[12px] text-white/50">{e.kind === "TOOL" ? "เครื่องมือ (ยืม-คืน)" : e.productId ? "วัสดุ (ตัดสต็อก)" : "วัสดุ"}{e.sku ? ` · ${e.sku}` : ""}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[14px] font-mono text-white">{e.qty} {e.unit || ""}</p>
                {e.kind === "TOOL" && (Number(e.issuedQty) || 0) > 0 && <p className={cn("text-[12px]", (Number(e.returnedQty) || 0) >= (Number(e.issuedQty) || 0) ? "text-nexus-teal" : "text-warning")}>{(Number(e.returnedQty) || 0) >= (Number(e.issuedQty) || 0) ? "คืนแล้ว" : "ยังไม่คืน"}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {job.checklist.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-1">
          <h3 className="text-[15px] font-semibold text-white mb-1">ขั้นตอนงาน {job.checklist.filter((c) => c.done).length}/{job.checklist.length}</h3>
          {job.checklist.map((c, i) => (
            <button key={i} type="button" disabled={!canCheck || busy} onClick={() => onCheck(i, !c.done)}
              className={cn("w-full flex items-center gap-3 py-2.5 text-left", !canCheck && "opacity-60")}>
              <span className={cn("w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0", c.done ? "bg-nexus-teal border-nexus-teal text-surface-0" : "border-white/30")}>{c.done && <Check size={15} strokeWidth={3} />}</span>
              <span className={cn("text-[15px]", c.done ? "text-white/50 line-through" : "text-white")}>{c.text}</span>
            </button>
          ))}
          {!canCheck && job.status === "ASSIGNED" && <p className="text-[12px] text-white/40">กดรับงานก่อนจึงติ๊กขั้นตอนได้</p>}
        </div>
      )}

      {job.status === "DONE" && job.resultNote && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[14px] text-white/80"><p className="text-[12px] text-white/40 mb-1">บันทึกการปิดงาน</p>{job.resultNote}</div>}
      {job.status === "DONE" && out.length > 0 && <p className="text-[13px] text-warning">ยังมีเครื่องมือค้างคืน {out.length} รายการ กรุณาคืนหัวหน้างาน</p>}

      {/* ปุ่มหลักตามสถานะ (ตรึงด้านล่างบนมือถือ) */}
      <div className="sticky bottom-0 z-10 flex gap-2 pt-6 pb-3 -mx-4 px-4 bg-gradient-to-t from-surface-0 via-surface-0/95 to-transparent">
        {job.status === "ASSIGNED" && <>
          <PillButton variant="ghost" className="h-12 px-5 text-[15px] text-danger" onClick={onReject} disabled={busy}>ปฏิเสธ</PillButton>
          <PillButton variant="confirm" className="h-12 flex-1 text-[16px] font-bold" onClick={onAccept} disabled={busy}><Check size={18} className="mr-1.5" /> รับงาน</PillButton>
        </>}
        {job.status === "ACCEPTED" && <PillButton variant="confirm" className="h-12 flex-1 text-[16px] font-bold" onClick={onStart} disabled={busy}>{busy ? <Loader2 size={18} className="animate-spin mr-1.5" /> : <PlayCircle size={18} className="mr-1.5" />} เริ่มงาน</PillButton>}
        {job.status === "IN_PROGRESS" && <PillButton variant="confirm" className="h-12 flex-1 text-[16px] font-bold" onClick={onComplete} disabled={busy}><Wrench size={18} className="mr-1.5" /> ปิดงาน</PillButton>}
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-[520px] max-h-[85vh] overflow-y-auto bg-surface-0 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-[18px] font-bold text-white">{title}</h3><button type="button" onClick={onClose} className="text-white/50" aria-label="ปิด"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

function AcceptSheet({ job, busy, onConfirm }: { job: Job; busy: boolean; onConfirm: () => void }) {
  const [got, setGot] = useState<boolean[]>(() => job.equipment.map(() => false));
  const all = got.every(Boolean);
  return (
    <>
      {job.equipment.length === 0 ? <p className="text-[14px] text-white/70">งานนี้ไม่มีอุปกรณ์ที่ต้องรับ กดรับงานได้เลย</p> : (
        <>
          <p className="text-[13px] text-white/60">ตรวจรับอุปกรณ์ให้ครบแล้วติ๊กทีละรายการ วัสดุที่มีรหัสสินค้าจะถูกตัดสต็อกเมื่อกดรับงาน</p>
          <div className="space-y-1">
            {job.equipment.map((e, i) => (
              <button key={i} type="button" onClick={() => setGot((g) => g.map((x, k) => (k === i ? !x : x)))} className="w-full flex items-center gap-3 py-2.5 text-left">
                <span className={cn("w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0", got[i] ? "bg-nexus-teal border-nexus-teal text-surface-0" : "border-white/30")}>{got[i] && <Check size={15} strokeWidth={3} />}</span>
                <span className="flex-1 min-w-0"><span className="block text-[15px] text-white truncate">{e.name}</span><span className="block text-[12px] text-white/50">{e.kind === "TOOL" ? "เครื่องมือ ต้องคืนเมื่อปิดงาน" : "วัสดุ"}</span></span>
                <span className="text-[14px] font-mono text-white">{e.qty} {e.unit || ""}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <PillButton variant="confirm" className="h-12 w-full text-[16px] font-bold" disabled={busy || !all} onClick={onConfirm}>{busy ? <Loader2 size={18} className="animate-spin mr-1.5" /> : <Check size={18} className="mr-1.5" />} {all ? "ยืนยันรับงาน" : "ติ๊กอุปกรณ์ให้ครบก่อน"}</PillButton>
    </>
  );
}

function TextSheet({ label, placeholder, confirm, danger, busy, min = 0, onConfirm }: { label: string; placeholder?: string; confirm: string; danger?: boolean; busy: boolean; min?: number; onConfirm: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <>
      <label className="block text-[13px] text-white/70">{label}</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-[15px] text-white leading-relaxed outline-none focus:border-nexus-teal/50" />
      <PillButton variant={danger ? "ghost" : "confirm"} className={cn("h-12 w-full text-[16px] font-bold", danger && "text-danger border border-danger/30")} disabled={busy || text.trim().length < min} onClick={() => onConfirm(text.trim())}>{confirm}</PillButton>
    </>
  );
}

function CompleteSheet({ job, busy, onConfirm }: { job: Job; busy: boolean; onConfirm: (note: string, returnTools: boolean) => void }) {
  const [note, setNote] = useState("");
  const tools = toolsOut(job);
  const [returned, setReturned] = useState(true);
  const remaining = job.checklist.filter((c) => !c.done).length;
  return (
    <>
      {remaining > 0 && <p className="text-[13px] text-warning">ยังมีขั้นตอนที่ไม่ได้ติ๊ก {remaining} รายการ</p>}
      <label className="block text-[13px] text-white/70">สรุปผลงาน</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="เช่น เปลี่ยนสายไฟ 2 เมตร ทดสอบแล้วใช้งานได้" className="w-full rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-[15px] text-white leading-relaxed outline-none focus:border-nexus-teal/50" />
      {tools.length > 0 && (
        <button type="button" onClick={() => setReturned(!returned)} className="w-full flex items-center gap-3 py-2 text-left">
          <span className={cn("w-6 h-6 rounded-md border flex items-center justify-center", returned ? "bg-nexus-teal border-nexus-teal text-surface-0" : "border-white/30")}>{returned && <Check size={15} strokeWidth={3} />}</span>
          <span className="text-[15px] text-white">คืนเครื่องมือครบแล้ว ({tools.map((t) => t.name).join(", ")})</span>
        </button>
      )}
      <PillButton variant="confirm" className="h-12 w-full text-[16px] font-bold" disabled={busy} onClick={() => onConfirm(note.trim(), returned)}>{busy ? <Loader2 size={18} className="animate-spin mr-1.5" /> : <Check size={18} className="mr-1.5" />} ยืนยันปิดงาน</PillButton>
    </>
  );
}
