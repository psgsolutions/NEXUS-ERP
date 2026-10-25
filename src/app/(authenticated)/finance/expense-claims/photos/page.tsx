"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, FileText, ImagePlus, Loader2, MessageCircle, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, PillTabs, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { EXPENSE_ACCOUNTS } from "@/lib/payables";
import { prepareAttachment } from "@/lib/attachments";
import { AttachmentPicker, uploadAttachments } from "@/components/shared/AttachmentPicker";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { INBOX_DOC_TYPES, INBOX_STATUS, needsSubstitute, normalizeInboxData, type InboxData, type InboxDocType, type InboxStatus } from "@/lib/expense-inbox";
import { money, thaiDate } from "@/lib/documents/format";

/**
 * ถ่ายบิล/ใบเสร็จเบิกเงิน — ถ่ายรูป (หรือเลือกหลายรูป) → AI อ่านร้านค้า รายการ ยอดเงิน → ตรวจ/แก้ → ฝ่ายบัญชียืนยันเป็นรายจ่าย
 * บิลที่ไม่มีใบเสร็จ/ใบกำกับ: ระบบออก "ใบรับรองแทนใบเสร็จรับเงิน" ให้ · ยังไม่ยืนยัน = ยังไม่เป็นรายจ่ายของบริษัท
 * ส่งรูปผ่าน LINE ได้ (เชื่อมบัญชีครั้งเดียว) — เข้ากล่องเดียวกันนี้
 */
type Item = { id: string; status: InboxStatus | "CONFIRMING"; source?: string; data?: InboxData; aiError?: string; createdAt: string; createdByName?: string; createdBy?: string; expenseId?: string; rejectReason?: string; note?: string };
const empName = (e: any) => (e ? e.name || [e.firstName, e.lastName].filter(Boolean).join(" ") || e.employeeCode || e.id : "");

export default function ExpensePhotosPage() {
  const { companyId, roles, user } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canConfirm = can(roles, "finance:edit");
  const [tab, setTab] = useState<"open" | "done" | "rejected">("open");
  const [scope, setScope] = useState<"mine" | "all">(can(roles, "finance:view") ? "all" : "mine");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [oneBill, setOneBill] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [lineCode, setLineCode] = useState<{ code: string; expiresAt: string; botName?: string } | null>(null);
  const { data: projects } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/projects` : "");
  const openProjects = projects.filter((p: any) => p.isDeleted !== true && !["cancelled", "completed", "closed"].includes(String(p.status || "").toLowerCase()));
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const post = useCallback(async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try { setItems((await post("/api/expense-inbox", { action: "list", scope })).items); } catch (e: any) { showAlert(e.message, "โหลดไม่สำเร็จ", "error"); } finally { setLoading(false); }
  }, [companyId, post, scope, showAlert]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!companyId || !canConfirm) return;
    post("/api/hr/directory", {}).then((d) => setEmployees(d.employees || [])).catch(() => setEmployees([]));
  }, [companyId, canConfirm, post]);

  /** ส่งรูป: ทีละรูปเป็นบิลละใบ (หรือรวมทุกรูปเป็นบิลเดียว) → อัปโหลด → ให้ AI อ่าน */
  const addPhotos = async (list: FileList | null) => {
    if (!list?.length || !companyId) return;
    const files = Array.from(list);
    const groups = oneBill ? [files] : files.map((f) => [f]);
    for (const [g, group] of groups.entries()) {
      try {
        setBusy(`บิล ${g + 1}/${groups.length}: กำลังย่อรูป…`);
        const prepared = await Promise.all(group.map(prepareAttachment));
        const { id } = await post("/api/expense-inbox", { action: "create" });
        setBusy(`บิล ${g + 1}/${groups.length}: กำลังอัปโหลด…`);
        await uploadAttachments(companyId, "photo_inbox", id, prepared);
        setBusy(`บิล ${g + 1}/${groups.length}: AI กำลังอ่านบิล…`);
        await post("/api/expense-inbox", { action: "analyze", id });
      } catch (e: any) { showAlert(e.message, "ส่งรูปไม่สำเร็จ", "error"); }
    }
    setBusy("");
    setTab("open");
    await load();
  };

  const linkLine = async () => {
    try { setLineCode(await post("/api/line/link", { action: "code" })); } catch (e: any) { showAlert(e.message, "เชื่อม LINE ไม่ได้", "warning"); }
  };

  const shown = items.filter((x) => (tab === "open" ? ["DRAFT", "REVIEW", "CONFIRMING"].includes(x.status) : tab === "done" ? x.status === "CONFIRMED" : x.status === "REJECTED"));
  const counts = { open: items.filter((x) => ["DRAFT", "REVIEW", "CONFIRMING"].includes(x.status)).length, done: items.filter((x) => x.status === "CONFIRMED").length, rejected: items.filter((x) => x.status === "REJECTED").length };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><Camera size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">ถ่ายบิลเบิกเงิน</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ถ่ายรูปบิล/ใบเสร็จ AI อ่านให้ · ฝ่ายบัญชียืนยันก่อนเป็นรายจ่าย · ไม่มีใบเสร็จได้ใบรับรองแทน</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 sm:p-5 max-w-[1200px] mx-auto space-y-4">
          <GlassCard className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={!!busy} onClick={() => camRef.current?.click()} className="h-24 rounded-2xl bg-nexus-teal/15 border border-nexus-teal/40 text-nexus-teal flex flex-col items-center justify-center gap-1.5 font-bold text-[15px] hover:bg-nexus-teal/25 disabled:opacity-50"><Camera size={28} /> ถ่ายรูปบิล</button>
              <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="h-24 rounded-2xl bg-white/[0.04] border border-white/15 text-white/80 flex flex-col items-center justify-center gap-1.5 font-bold text-[15px] hover:bg-white/10 disabled:opacity-50"><ImagePlus size={28} /> เลือกรูป (หลายรูป)</button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            <PillCheckbox label="รูปที่เลือกพร้อมกันเป็นบิลเดียวกัน (บิลยาวหลายหน้า)" checked={oneBill} onChange={(e) => setOneBill(e.target.checked)} />
            {busy && <p className="text-[13px] text-nexus-teal flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
              <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={linkLine}><MessageCircle size={13} /> ส่งรูปผ่าน LINE</PillButton>
              {lineCode && <span className="text-[12.5px] text-white/70">เพิ่มเพื่อน LINE ของบริษัท{lineCode.botName ? ` (${lineCode.botName})` : ""} แล้วพิมพ์ <b className="text-nexus-teal font-mono text-[14px]">เชื่อม {lineCode.code}</b> (ภายใน 10 นาที) — จากนั้นส่งรูปบิลในแชตได้เลย</span>}
            </div>
          </GlassCard>

          <div className="flex flex-wrap items-center gap-2">
            <PillTabs className="flex-1 min-w-[260px]" tabs={[{ id: "open", label: `รอยืนยัน (${counts.open})` }, { id: "done", label: `ยืนยันแล้ว (${counts.done})` }, { id: "rejected", label: `ไม่อนุมัติ (${counts.rejected})` }]} activeTab={tab} onTabChange={(id: any) => setTab(id)} />
            {can(roles, "finance:view") && (
              <div className="w-[170px]"><PillSelect value={scope} onChange={(e) => setScope(e.target.value as any)} className="h-9 w-full text-[12.5px]"><option value="all">ของทุกคน</option><option value="mine">ของฉัน</option></PillSelect></div>
            )}
            <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={load}><RefreshCw size={13} /> โหลดใหม่</PillButton>
          </div>

          {loading ? <div className="py-10 flex justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>
            : !shown.length ? <GlassCard className="p-8 text-center text-[13px] text-white/55">{tab === "open" ? "ยังไม่มีบิลรอยืนยัน — กดถ่ายรูปบิลด้านบน" : "ไม่มีรายการ"}</GlassCard>
            : shown.map((it) => <InboxCard key={it.id} item={it} canConfirm={canConfirm} mine={it.createdBy === user?.uid} employees={employees} projects={openProjects} post={post} onDone={load} showAlert={showAlert} showConfirm={showConfirm} />)}
        </div>
      </div>
    </div>
  );
}

function InboxCard({ item, canConfirm, mine, employees, projects, post, onDone, showAlert, showConfirm }: {
  item: Item; canConfirm: boolean; mine: boolean; employees: any[]; projects: any[];
  post: (url: string, body: Record<string, any>) => Promise<any>; onDone: () => void;
  showAlert: (m: string, t?: string, k?: any) => void; showConfirm: (m: string) => Promise<boolean>;
}) {
  const [d, setD] = useState<InboxData>(normalizeInboxData(item.data));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [emp, setEmp] = useState("");
  const [acct, setAcct] = useState(item.data?.suggestedAccount || EXPENSE_ACCOUNTS[0].code);
  const [proj, setProj] = useState("");
  const [doc, setDoc] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const open = item.status === "DRAFT" || item.status === "REVIEW";
  const editable = open && (mine || canConfirm);
  useEffect(() => { setD(normalizeInboxData(item.data)); setDirty(false); }, [item.data]);
  const set = (patch: Partial<InboxData>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); };
  const setLine = (i: number, patch: Partial<InboxData["items"][number]>) => set({ items: d.items.map((l, j) => (j === i ? { ...l, ...patch, ...(patch.qty !== undefined || patch.unitPrice !== undefined ? { amount: Math.round(((patch.qty ?? l.qty) * (patch.unitPrice ?? l.unitPrice)) * 100) / 100 } : {}) } : l)) });
  const sum = normalizeInboxData({ ...d, subtotal: d.docType === "TAX_INVOICE" ? d.subtotal : 0, total: 0 });

  const run = async (label: string, fn: () => Promise<any>) => { setBusy(label); try { await fn(); } catch (e: any) { showAlert(e.message, "ไม่สำเร็จ", "error"); } finally { setBusy(""); } };
  const save = () => run("กำลังบันทึก…", async () => { const r = await post("/api/expense-inbox", { action: "update", id: item.id, data: d }); setD(r.data); setDirty(false); });
  const confirm = () => run("กำลังยืนยัน…", async () => {
    if (!emp) throw new Error("เลือกพนักงานผู้จ่ายเงิน (ผู้เบิก) ก่อน");
    if (dirty) await post("/api/expense-inbox", { action: "update", id: item.id, data: d });
    if (!(await showConfirm(`ยืนยันเป็นรายจ่าย ${money(sum.total)} บาท? ระบบสร้างใบเบิกรอจ่ายให้${needsSubstitute(d) ? " พร้อมใบรับรองแทนใบเสร็จ" : ""}`))) return;
    const r = await post("/api/expense-inbox", { action: "confirm", id: item.id, employeeId: emp, expenseAccountCode: acct, projectId: proj });
    showAlert(`สร้างใบเบิก ${r.expenseId} แล้ว — จ่ายชำระได้ที่ บุคลากร › เบิกค่าใช้จ่าย`);
    onDone();
  });
  const reject = () => run("กำลังบันทึก…", async () => {
    if (!reason.trim()) throw new Error("ระบุเหตุผลที่ไม่อนุมัติ");
    await post("/api/expense-inbox", { action: "reject", id: item.id, reason });
    setRejecting(false);
    onDone();
  });
  const reread = () => run("AI กำลังอ่านบิลใหม่…", async () => { const r = await post("/api/expense-inbox", { action: "analyze", id: item.id }); setD(normalizeInboxData(r.data)); if (r.error) showAlert(r.error, "อ่านรูปไม่ได้", "warning"); onDone(); });

  return (
    <GlassCard className={cn("p-4 space-y-3", item.status === "CONFIRMED" && "opacity-90")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-[11.5px] px-2 py-0.5 rounded-full font-bold", item.status === "CONFIRMED" ? "bg-nexus-teal/15 text-nexus-teal" : item.status === "REJECTED" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning")}>{INBOX_STATUS[item.status as InboxStatus] || "กำลังยืนยัน"}</span>
        {item.source === "line" && <span className="text-[11.5px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300">ส่งทาง LINE</span>}
        <span className="text-[12px] text-white/50">{item.createdByName} · {item.createdAt ? new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : ""}</span>
        {item.expenseId && <span className="text-[12px] text-nexus-teal font-mono">ใบเบิก {item.expenseId}</span>}
        <span className="ml-auto text-[16px] font-bold text-white font-mono">{money(sum.total)}</span>
      </div>
      {item.aiError && open && <p className="text-[12px] text-warning flex items-center gap-1.5"><Sparkles size={12} /> {item.aiError}</p>}
      {item.rejectReason && <p className="text-[12px] text-danger">ไม่อนุมัติ: {item.rejectReason}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr] gap-4">
        <AttachmentPicker ownerType={item.status === "CONFIRMED" ? "expense" : "photo_inbox"} ownerId={item.status === "CONFIRMED" ? item.expenseId || item.id : item.id} disabled={!editable} />
        <fieldset disabled={!editable} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <PillSelect value={d.docType} onChange={(e) => set({ docType: e.target.value as InboxDocType })} className="h-9 w-full text-sm">
              {(Object.keys(INBOX_DOC_TYPES) as InboxDocType[]).map((k) => <option key={k} value={k}>{INBOX_DOC_TYPES[k]}</option>)}
            </PillSelect>
            <PillInput type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className="h-9 w-full text-sm font-mono" />
            <PillInput value={d.vendorName} onChange={(e) => set({ vendorName: e.target.value })} placeholder="ร้านค้า / ผู้รับเงิน" className="h-9 w-full text-sm" />
            <PillInput value={d.docNo} onChange={(e) => set({ docNo: e.target.value })} placeholder="เลขที่บิล" className="h-9 w-full text-sm" />
            {d.docType === "TAX_INVOICE" && <PillInput value={d.vendorTaxId} onChange={(e) => set({ vendorTaxId: e.target.value.replace(/\D/g, "").slice(0, 13) })} placeholder="เลขผู้เสียภาษีผู้ขาย" className="h-9 w-full text-sm font-mono" />}
          </div>
          <div className="space-y-1">
            {d.items.map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <PillInput value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="รายการ" className="h-8 flex-1 min-w-0 text-[13px]" />
                <PillInput inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-8 w-14 text-[13px] text-right font-mono" title="จำนวน" />
                <PillInput inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-8 w-24 text-[13px] text-right font-mono" title="ราคาต่อหน่วย" />
                <span className="w-24 text-right text-[13px] font-mono text-white/80">{money(l.amount)}</span>
                {editable && <button type="button" onClick={() => set({ items: d.items.filter((_x, j) => j !== i) })} aria-label="ลบรายการ" className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-danger"><Trash2 size={13} /></button>}
              </div>
            ))}
            {editable && <button type="button" onClick={() => set({ items: [...d.items, { description: "", qty: 1, unitPrice: 0, amount: 0 }] })} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1"><Plus size={12} /> เพิ่มรายการ</button>}
          </div>
          {d.docType === "TAX_INVOICE" && (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-white/60">
              ก่อน VAT <PillInput inputMode="decimal" value={d.subtotal} onChange={(e) => set({ subtotal: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-8 w-28 text-right font-mono text-[13px]" />
              VAT <PillInput inputMode="decimal" value={d.vat} onChange={(e) => set({ vat: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-8 w-24 text-right font-mono text-[13px]" />
            </div>
          )}
          {needsSubstitute(d) && <p className="text-[12px] text-sky-200/80 flex items-center gap-1.5"><FileText size={12} /> ไม่มีใบเสร็จ — ระบบออกใบรับรองแทนใบเสร็จรับเงินให้ (ไม่มีภาษีซื้อ)</p>}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
        {editable && dirty && <PillButton variant="glass" className="h-9 px-4 text-xs" disabled={!!busy} onClick={save}>บันทึกการแก้</PillButton>}
        {editable && <PillButton variant="ghost" className="h-9 px-3 text-xs" disabled={!!busy} onClick={reread}><Sparkles size={13} /> ให้ AI อ่านใหม่</PillButton>}
        {needsSubstitute(d) && <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={() => setDoc(true)}><FileText size={13} /> ใบรับรองแทนใบเสร็จ</PillButton>}
        {busy && <span className="text-[12px] text-nexus-teal flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {busy}</span>}
        {open && canConfirm && (
          <div className="w-full flex flex-wrap items-center gap-2 pt-1">
            <div className="w-full sm:w-[210px]"><PillSelect value={emp} onChange={(e) => setEmp(String(e.target.value))} className="h-9 w-full text-[12.5px]"><option value="">ผู้จ่ายเงิน (ผู้เบิก)…</option>{employees.map((e) => <option key={e.id} value={e.id}>{empName(e)}</option>)}</PillSelect></div>
            <div className="w-full sm:w-[230px]"><PillSelect value={acct} onChange={(e) => setAcct(String(e.target.value))} className="h-9 w-full text-[12.5px]">{EXPENSE_ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</PillSelect></div>
            <div className="w-full sm:w-[210px]"><PillSelect value={proj} onChange={(e) => setProj(String(e.target.value))} className="h-9 w-full text-[12.5px]"><option value="">ไม่เข้าโครงการ</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.projectName || p.title || p.id}</option>)}</PillSelect></div>
            <div className="ml-auto flex gap-2">
              {rejecting ? (
                <>
                  <PillInput autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลที่ไม่อนุมัติ" className="h-9 w-[200px] text-sm" />
                  <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={() => setRejecting(false)}>ยกเลิก</PillButton>
                  <PillButton variant="ghost" className="h-9 px-4 text-xs text-danger" disabled={!!busy || !reason.trim()} onClick={reject}><X size={13} /> ยืนยันไม่อนุมัติ</PillButton>
                </>
              ) : <PillButton variant="ghost" className="h-9 px-4 text-xs text-danger" disabled={!!busy} onClick={() => setRejecting(true)}><X size={13} /> ไม่อนุมัติ</PillButton>}
              <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!!busy || !(sum.total > 0)} onClick={confirm}><Check size={13} /> ยืนยันเป็นรายจ่าย</PillButton>
            </div>
          </div>
        )}
        {open && !canConfirm && <span className="text-[12px] text-white/45 ml-auto">รอฝ่ายบัญชียืนยัน{d.date ? ` · ${thaiDate(d.date)}` : ""}</span>}
      </div>
      <DocumentPdfModal open={doc} onClose={() => setDoc(false)} title="ใบรับรองแทนใบเสร็จรับเงิน" source={{ type: "substitute_receipt", id: item.id }} />
    </GlassCard>
  );
}
