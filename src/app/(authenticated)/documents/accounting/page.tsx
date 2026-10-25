"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Mail, Save, Send } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { money, thaiDate } from "@/lib/documents/format";

/**
 * ส่งเอกสารให้สำนักบัญชี — เลือกเดือน ชนิดเอกสาร ติ๊กฉบับที่ต้องการ แล้วดาวน์โหลด ZIP หรือส่งอีเมลถึงสำนักบัญชีที่ตั้งไว้
 * ZIP มี PDF ทุกฉบับ (แยกโฟลเดอร์ตามชนิด) + สรุปรายการ.csv · ครั้งละไม่เกิน 60 ฉบับ (มากกว่านั้นแบ่งเป็นหลายชุดให้อัตโนมัติ)
 */
const TYPES: { type: string; label: string; on: boolean }[] = [
  { type: "invoice", label: "ใบกำกับภาษีขาย", on: true }, { type: "receipt", label: "ใบเสร็จรับเงิน", on: true }, { type: "cndn", label: "ใบลดหนี้/เพิ่มหนี้", on: true },
  { type: "payment", label: "ใบสำคัญจ่าย", on: true }, { type: "wht", label: "หนังสือรับรองหัก ณ ที่จ่าย", on: true }, { type: "journal", label: "ใบสำคัญบัญชี", on: false },
  { type: "billing_note", label: "ใบวางบิล", on: false }, { type: "purchase_order", label: "ใบสั่งซื้อ", on: false },
];
const PER_BATCH = 60;
type Row = { type: string; id: string; number: string; party: string; date: string; amount: number | null; cancelled: boolean };
const monthNow = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const lastMonth = () => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
const monthEnd = (m: string) => { const [y, mo] = m.split("-").map(Number); return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`; };
const thaiMonth = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });

export default function AccountingPackPage() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canSave = can(roles, "finance:edit");
  const [month, setMonth] = useState(lastMonth());
  const [types, setTypes] = useState(TYPES.filter((t) => t.on).map((t) => t.type));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [office, setOffice] = useState({ name: "", email: "", cc: "" });
  const [mailReady, setMailReady] = useState(true);
  const [message, setMessage] = useState("");

  const post = useCallback(async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    return res;
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    post("/api/documents/bundle", { action: "config" }).then((r) => r.json()).then((d) => { if (d.success) { setOffice(d.office); setMailReady(d.mailReady); } }).catch(() => {});
  }, [companyId, post]);

  const load = async () => {
    setLoading(true); setRows(null); setPicked(new Set());
    try {
      const res = await post("/api/documents/history", { types, from: `${month}-01`, to: monthEnd(month) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "โหลดรายการไม่สำเร็จ");
      setRows(d.docs);
      setPicked(new Set(d.docs.filter((r: Row) => !r.cancelled).map((r: Row) => `${r.type}:${r.id}`)));
    } catch (e: any) { showAlert(e.message, "โหลดไม่สำเร็จ", "error"); } finally { setLoading(false); }
  };

  const chosen = useMemo(() => (rows || []).filter((r) => picked.has(`${r.type}:${r.id}`)), [rows, picked]);
  const batches = useMemo(() => { const out: Row[][] = []; for (let i = 0; i < chosen.length; i += PER_BATCH) out.push(chosen.slice(i, i + PER_BATCH)); return out; }, [chosen]);
  const title = (n: number) => `เอกสารบัญชี ${thaiMonth(month)}${batches.length > 1 ? ` ชุดที่ ${n}` : ""}`;

  const download = async () => {
    for (let b = 0; b < batches.length; b++) {
      setBusy(`กำลังสร้าง ZIP ${batches.length > 1 ? `ชุดที่ ${b + 1}/${batches.length}` : ""}…`);
      try {
        const res = await post("/api/documents/bundle", { action: "zip", items: batches[b].map((r) => ({ type: r.type, id: r.id })), title: title(b + 1) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "สร้าง ZIP ไม่สำเร็จ"); }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${title(b + 1)}.zip`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        const failed = Number(res.headers.get("x-bundle-failed") || 0);
        if (failed) showAlert(`มี ${failed} ฉบับที่สร้างไม่สำเร็จ — ดูรายละเอียดในไฟล์ สรุปรายการ.csv`, "สร้างไม่ครบ", "warning");
      } catch (e: any) { showAlert(e.message, "ดาวน์โหลดไม่สำเร็จ", "error"); break; }
    }
    setBusy("");
  };

  const email = async () => {
    if (!office.email) return void showAlert("ตั้งอีเมลสำนักบัญชีก่อน", "ยังไม่มีอีเมลผู้รับ", "warning");
    if (!(await showConfirm(`ส่งเอกสาร ${chosen.length} ฉบับ${batches.length > 1 ? ` (${batches.length} อีเมล)` : ""} ถึง ${office.email}?`))) return;
    let sent = 0;
    for (let b = 0; b < batches.length; b++) {
      setBusy(`กำลังส่งอีเมล ${batches.length > 1 ? `ชุดที่ ${b + 1}/${batches.length}` : ""}…`);
      try {
        const res = await post("/api/documents/bundle", { action: "email", items: batches[b].map((r) => ({ type: r.type, id: r.id })), title: title(b + 1), subject: title(b + 1), ...(message.trim() ? { message } : {}) });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.error || "ส่งอีเมลไม่สำเร็จ");
        sent += d.count;
      } catch (e: any) { showAlert(e.message, "ส่งไม่สำเร็จ", "error"); break; }
    }
    setBusy("");
    if (sent) showAlert(`ส่งเอกสาร ${sent} ฉบับถึง ${office.email} แล้ว`);
  };

  const saveOffice = async () => {
    const res = await post("/api/documents/bundle", { action: "saveConfig", office });
    const d = await res.json();
    if (!res.ok || !d.success) return void showAlert(d.error || "บันทึกไม่สำเร็จ", "บันทึกไม่สำเร็จ", "error");
    showAlert("บันทึกสำนักบัญชีแล้ว");
  };
  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <Link href="/documents" className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-white border border-white/10" aria-label="กลับไปประวัติเอกสาร"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">ส่งเอกสารให้สำนักบัญชี</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">เลือกเดือนและชนิดเอกสาร แล้วดาวน์โหลด ZIP หรือส่งอีเมลครั้งเดียวหลายไฟล์</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1400px] mx-auto space-y-4">
          <GlassCard className="p-4 space-y-3">
            <p className="text-[14px] font-bold text-white flex items-center gap-2"><Mail size={15} className="text-nexus-teal" /> สำนักบัญชีผู้รับ</p>
            <fieldset disabled={!canSave} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PillInput value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} placeholder="ชื่อสำนักงานบัญชี" className="h-9 w-full text-sm" />
              <PillInput value={office.email} onChange={(e) => setOffice({ ...office, email: e.target.value })} placeholder="อีเมลสำนักบัญชี (คั่นด้วย , ได้ 3 อีเมล)" className="h-9 w-full text-sm" />
              <PillInput value={office.cc} onChange={(e) => setOffice({ ...office, cc: e.target.value })} placeholder="สำเนาถึง (ไม่บังคับ)" className="h-9 w-full text-sm" />
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              {canSave && <PillButton variant="glass" className="h-8 px-4 text-xs" onClick={saveOffice}><Save size={13} /> บันทึกสำนักบัญชี</PillButton>}
              {!mailReady && <span className="text-[12px] text-warning">ยังไม่ได้ตั้งค่าอีเมลผู้ส่ง (SMTP) — ใช้ดาวน์โหลด ZIP แล้วส่งเองได้</span>}
            </div>
          </GlassCard>

          <GlassCard className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-[13px] text-white/70">เดือน</label>
              <input type="month" value={month} max={monthNow()} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-full bg-white/5 border border-white/10 px-3 text-sm text-white" />
              <span className="text-[12px] text-white/45">{thaiMonth(month)}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {TYPES.map((t) => <PillCheckbox key={t.type} label={t.label} checked={types.includes(t.type)} onChange={(e) => setTypes((v) => (e.target.checked ? [...v, t.type] : v.filter((x) => x !== t.type)))} />)}
            </div>
            <PillButton variant="primary" className="h-9 px-5 text-xs" disabled={loading || !types.length} onClick={load}>{loading ? <Loader2 size={14} className="animate-spin" /> : null} แสดงเอกสารของเดือนนี้</PillButton>
          </GlassCard>

          {rows && (
            <>
              <div className="flex flex-wrap items-center gap-3 px-1 text-[13px] text-white/60">
                <span>พบ <b className="text-white font-mono">{rows.length}</b> ฉบับ · เลือก <b className="text-nexus-teal font-mono">{chosen.length}</b>{batches.length > 1 ? ` (แบ่ง ${batches.length} ชุด ชุดละไม่เกิน ${PER_BATCH})` : ""}</span>
                <button type="button" className="text-nexus-teal hover:underline" onClick={() => setPicked(new Set(rows.map((r) => `${r.type}:${r.id}`)))}>เลือกทั้งหมด</button>
                <button type="button" className="text-white/50 hover:text-white" onClick={() => setPicked(new Set())}>ไม่เลือกเลย</button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <PillButton variant="glass" className="h-9 px-4 text-xs" disabled={!chosen.length || !!busy} onClick={download}><Download size={14} /> ดาวน์โหลด ZIP</PillButton>
                  <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!chosen.length || !!busy || !mailReady} onClick={email}><Send size={14} /> ส่งอีเมลถึงสำนักบัญชี</PillButton>
                </div>
              </div>
              {busy && <div className="p-3 rounded-xl text-xs font-bold border bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy}</div>}
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="ข้อความในอีเมล (ไม่บังคับ — ว่าง = ข้อความมาตรฐาน)" className="w-full min-h-[70px] rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-2 text-[13px] leading-[1.9] text-white" />
              <GlassCard className="p-0 overflow-hidden">
                <NexusTable headers={["", "วันที่", "ชนิด", "เลขที่", "คู่ค้า", "จำนวนเงิน", "สถานะ"]} itemCount={rows.length}>
                  {rows.length === 0 && <NexusTableRow className="cursor-default"><NexusTableCell colSpan={7} className="text-center text-[13px] text-white/40 py-8">ไม่มีเอกสารในเดือนนี้</NexusTableCell></NexusTableRow>}
                  {rows.map((r) => {
                    const k = `${r.type}:${r.id}`;
                    return (
                      <NexusTableRow key={k} onClick={() => toggle(k)}>
                        <NexusTableCell><input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} onClick={(e) => e.stopPropagation()} aria-label={`เลือก ${r.number}`} className="accent-[#0d9488] w-4 h-4" /></NexusTableCell>
                        <NexusTableCell mono>{thaiDate(r.date)}</NexusTableCell>
                        <NexusTableCell>{TYPES.find((t) => t.type === r.type)?.label || r.type}</NexusTableCell>
                        <NexusTableCell mono>{r.number}</NexusTableCell>
                        <NexusTableCell title={r.party}>{r.party || "-"}</NexusTableCell>
                        <NexusTableCell mono className="text-right">{r.amount !== null ? money(r.amount) : "-"}</NexusTableCell>
                        <NexusTableCell>{r.cancelled ? <span className={cn("text-[12px] font-bold text-danger")}>ยกเลิก</span> : <span className="text-[12px] text-white/50">-</span>}</NexusTableCell>
                      </NexusTableRow>
                    );
                  })}
                </NexusTable>
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
