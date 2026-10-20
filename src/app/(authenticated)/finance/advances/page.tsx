"use client";

import React, { useMemo, useState } from "react";
import { HandCoins, Plus, Trash2 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect, PillTabs, cn } from "@/components/ui/Base";
import { EmptyGuide, InfoTip, WhatHappens } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useCompanyProjects } from "@/hooks/useCompanyProjects";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { ADVANCE_STATUS_TH, clearingJournal, normalizeClearItems, type AdvanceStatus } from "@/lib/cash-advance";

/**
 * เงินทดรองจ่าย: ผู้ทำงานหน้างานขอเบิกเงินสดไปซื้อของก่อน → แอดมินการเงินจ่าย → ผู้เบิกเคลียร์ด้วยใบเสร็จ
 * ของโครงการเข้าต้นทุนจริงของโครงการอัตโนมัติ
 */

const money = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const TONE: Record<AdvanceStatus, string> = { REQUESTED: "text-warning", PAID: "text-nexus-blue", CLEARED: "text-nexus-teal", REJECTED: "text-white/40" };
const daysSince = (d?: string) => (d ? Math.floor((Date.parse(`${todayBkk()}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400e3) : 0);

export default function CashAdvancesPage() {
  const { companyId, roles, user, displayName } = useAuth();
  const { showConfirm, showPrompt } = useSystemDialog() as any;
  const finance = can(roles, "finance:edit");
  const { data: advances } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/cash_advances` : "");
  const { data: projects } = useCompanyProjects();
  const [tab, setTab] = useState(finance ? "todo" : "mine");
  const [form, setForm] = useState({ amount: "", purpose: "", projectId: "", neededDate: todayBkk() });
  const [clearing, setClearing] = useState<any | null>(null);
  const [items, setItems] = useState<{ description: string; amount: string; vat: string; taxInvoiceNo: string }[]>([]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const post = async (body: any) => {
    const res = await apiFetch("/api/finance/cash-advances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
    return d;
  };
  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setMsg(null);
    try { setMsg({ text: await fn() }); } catch (e: any) { setMsg({ text: e.message, error: true }); } finally { setBusy(false); }
  };

  const sorted = useMemo(() => [...advances].sort((a, b) => String(b.advanceNo || b.id).localeCompare(String(a.advanceNo || a.id))), [advances]);
  const rows = tab === "mine" ? sorted.filter((a) => a.requesterUid === user?.uid) : tab === "todo" ? sorted.filter((a) => a.status === "REQUESTED" || a.status === "PAID") : sorted;
  const openProjects = (projects as any[]).filter((p) => !["Cancelled", "Completed"].includes(String(p.status))).slice(0, 200);

  const request = () => run(async () => {
    const d = await post({ action: "request", amount: Number(form.amount), purpose: form.purpose, projectId: form.projectId, neededDate: form.neededDate, requesterName: displayName });
    setForm({ amount: "", purpose: "", projectId: "", neededDate: todayBkk() });
    return `ขอเบิกแล้ว เลขที่ ${d.advanceNo} — รอแอดมินการเงินจ่ายเงิน`;
  });
  const pay = (a: any, method: "CASH" | "TRANSFER") => run(async () => {
    if (!(await showConfirm(`จ่ายเงินทดรอง ${a.advanceNo} ให้ ${a.requesterName} ${money(a.amount)} บาท (${method === "CASH" ? "เงินสด" : "โอน"})?`))) return "ยกเลิกแล้ว";
    await post({ action: "pay", id: a.id, method, paymentDate: todayBkk() });
    return `จ่ายเงินทดรอง ${a.advanceNo} แล้ว — รอผู้เบิกเคลียร์ใบเสร็จ`;
  });
  const reject = (a: any) => run(async () => {
    const reason = await showPrompt?.("เหตุผลที่ไม่อนุมัติ");
    if (reason === null || reason === undefined) return "ยกเลิกแล้ว";
    await post({ action: "reject", id: a.id, reason });
    return `ไม่อนุมัติ ${a.advanceNo}`;
  });

  const clearItems = normalizeClearItems(items.map((i) => ({ ...i, amount: Number(i.amount), vat: Number(i.vat) })));
  const preview = clearing ? clearingJournal(Number(clearing.paidAmount ?? clearing.amount) || 0, clearItems, clearing.projectId ? { code: "1161-00", name: "งานระหว่างทำ (WIP)" } : { code: "5300-00", name: "ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป" }) : null;
  const submitClear = () => run(async () => {
    await post({ action: "clear", id: clearing.id, items: clearItems, method: "CASH", clearDate: todayBkk() });
    const done = clearing.advanceNo;
    setClearing(null); setItems([]);
    return `เคลียร์ ${done} แล้ว${preview && preview.diff > 0 ? ` — คืนเงิน ${money(preview.diff)} บาทให้การเงิน` : preview && preview.diff < 0 ? ` — การเงินจ่ายเพิ่ม ${money(-preview.diff)} บาท` : ""}`;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><HandCoins size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">เงินทดรองจ่าย</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">เบิกเงินสดไปซื้อของหน้างานก่อน แล้วเคลียร์ด้วยใบเสร็จ</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1600px] mx-auto space-y-4">
          {msg && <div className={cn("p-3 rounded-xl text-xs font-bold border", msg.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{msg.text}</div>}

          <GlassCard className="p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-white"><Plus size={16} className="text-nexus-teal" /> ขอเบิกเงินทดรอง</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">จำนวนเงิน (บาท)</label><PillInput inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} className="w-full h-9 text-sm text-right font-mono" /></div>
              <div className="space-y-1 xl:col-span-2"><label className="text-[12px] font-bold text-white/70 ml-1">ใช้ทำอะไร</label><PillInput value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="เช่น ซื้อสายไฟและอุปกรณ์ยึดหน้างาน" className="w-full h-9 text-sm" /></div>
              <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1 flex items-center">โครงการ<InfoTip text="เลือกโครงการ ค่าใช้จ่ายที่เคลียร์จะเข้าต้นทุนจริงของโครงการให้อัตโนมัติ" /></label>
                <PillSelect value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full h-9 text-sm">
                  <option value="">ไม่ระบุ (ค่าใช้จ่ายทั่วไป)</option>
                  {openProjects.map((p: any) => <option key={p.id} value={p.id}>{p.projectCode || p.projectNo || ""} {p.projectName || p.name}</option>)}
                </PillSelect>
              </div>
              <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">ต้องการวันที่</label><PillInput type="date" value={form.neededDate} onChange={(e) => setForm({ ...form, neededDate: e.target.value })} className="w-full h-9 text-sm font-mono" /></div>
            </div>
            <div className="flex justify-end"><PillButton variant="primary" disabled={busy || !(Number(form.amount) > 0) || !form.purpose.trim()} onClick={request} className="h-9 px-5 text-xs">ส่งขอเบิก</PillButton></div>
          </GlassCard>

          {clearing && preview && (
            <GlassCard accentColor="blue" className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-white">เคลียร์ {clearing.advanceNo} · รับไป {money(clearing.paidAmount ?? clearing.amount)} บาท</h2>
                <button type="button" onClick={() => { setClearing(null); setItems([]); }} className="text-[13px] text-white/50 hover:text-white">ปิด</button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_160px_36px] gap-2 items-center">
                  <PillInput placeholder="รายการตามใบเสร็จ" value={it.description} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} className="h-9 text-sm" />
                  <PillInput placeholder="ยอดจ่าย (รวม VAT)" inputMode="decimal" value={it.amount} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))} className="h-9 text-sm text-right font-mono" />
                  <PillInput placeholder="VAT ในยอด" inputMode="decimal" value={it.vat} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, vat: e.target.value.replace(/[^\d.]/g, "") } : x)))} className="h-9 text-sm text-right font-mono" />
                  <PillInput placeholder="เลขที่ใบกำกับภาษี (ถ้ามี)" value={it.taxInvoiceNo} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, taxInvoiceNo: e.target.value } : x)))} className="h-9 text-sm" />
                  <button type="button" aria-label="ลบรายการ" onClick={() => setItems(items.filter((_, k) => k !== i))} className="p-2 text-white/40 hover:text-danger"><Trash2 size={15} /></button>
                </div>
              ))}
              <PillButton variant="glass" className="h-8 px-3 text-xs" onClick={() => setItems([...items, { description: "", amount: "", vat: "", taxInvoiceNo: "" }])}><Plus size={13} className="mr-1" /> เพิ่มใบเสร็จ</PillButton>
              <WhatHappens items={[
                `ใช้จริง ${money(preview.spent)} บาท (ภาษีซื้อ ${money(preview.vat)} บาท ขอคืนได้เมื่อมีใบกำกับภาษีเต็มรูป)`,
                preview.diff > 0 ? `ใช้ไม่หมด ต้องคืนเงิน ${money(preview.diff)} บาทให้การเงิน` : preview.diff < 0 ? `ใช้เกิน การเงินจ่ายเพิ่มให้ ${money(-preview.diff)} บาท` : "ใช้พอดีกับเงินที่เบิก",
                clearing.projectId ? `ค่าใช้จ่ายเข้าต้นทุนจริงของโครงการ ${clearing.projectName || ""}` : "บันทึกเป็นค่าใช้จ่ายทั่วไป",
                "ส่งรายการบัญชีให้ฝ่ายบัญชีอนุมัติ",
              ]} />
              <div className="flex justify-end"><PillButton variant="confirm" disabled={busy || !clearItems.length} onClick={submitClear} className="h-9 px-5 text-xs">บันทึกเคลียร์เงินทดรอง</PillButton></div>
            </GlassCard>
          )}

          <PillTabs tabs={[...(finance ? [{ id: "todo", label: "รอจ่าย / รอเคลียร์" }] : []), { id: "mine", label: "ของฉัน" }, ...(finance ? [{ id: "all", label: "ทั้งหมด" }] : [])]} activeTab={tab} onTabChange={setTab} />
          <GlassCard className="p-2">
            <NexusTable headers={["เลขที่", "ผู้เบิก", "ใช้ทำอะไร", "โครงการ", "จำนวนเงิน", "สถานะ", "จัดการ"]}>
              {!rows.length && <EmptyGuide cols={7} text="ยังไม่มีรายการเงินทดรอง" hint="กรอกฟอร์มด้านบนเพื่อขอเบิก" />}
              {rows.map((a) => {
                const st = a.status as AdvanceStatus;
                const late = st === "PAID" && daysSince(a.paidDate) > 7;
                return (
                  <NexusTableRow key={a.id}>
                    <NexusTableCell className="font-mono text-nexus-blue">{a.advanceNo || a.id}</NexusTableCell>
                    <NexusTableCell className="text-white/80">{a.requesterName}</NexusTableCell>
                    <NexusTableCell className="text-white/70" title={a.purpose}>{a.purpose}</NexusTableCell>
                    <NexusTableCell className="text-white/60">{a.projectName || "-"}</NexusTableCell>
                    <NexusTableCell className="font-mono text-white">{money(a.amount)}</NexusTableCell>
                    <NexusTableCell><span className={cn("text-[12px] font-bold", TONE[st])}>{ADVANCE_STATUS_TH[st] || st}{late ? ` · ${daysSince(a.paidDate)} วัน` : ""}</span></NexusTableCell>
                    <NexusTableCell>
                      <div className="flex gap-2">
                        {finance && st === "REQUESTED" && <>
                          <PillButton variant="confirm" className="h-8 px-3 text-xs" disabled={busy} onClick={() => pay(a, "CASH")}>จ่ายเงินสด</PillButton>
                          <PillButton variant="glass" className="h-8 px-3 text-xs" disabled={busy} onClick={() => pay(a, "TRANSFER")}>โอน</PillButton>
                          <PillButton variant="ghost" className="h-8 px-3 text-xs" disabled={busy} onClick={() => reject(a)}>ไม่อนุมัติ</PillButton>
                        </>}
                        {st === "PAID" && (a.requesterUid === user?.uid || finance) && <PillButton variant="primary" className="h-8 px-3 text-xs" onClick={() => { setClearing(a); setItems([{ description: "", amount: "", vat: "", taxInvoiceNo: "" }]); }}>เคลียร์ใบเสร็จ</PillButton>}
                      </div>
                    </NexusTableCell>
                  </NexusTableRow>
                );
              })}
            </NexusTable>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
