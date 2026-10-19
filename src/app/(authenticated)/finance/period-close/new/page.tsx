"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Lock, Unlock } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { InfoTip, WhatHappens } from "@/components/guide/Guidance";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { THAI_MONTHS } from "@/lib/period-close-service";

interface JournalRow { id: string; path: string; journalNo: string; date: string; description: string; amount: number; diff?: number }
interface PeriodRow { id: string; year: number; month: number; status: string; closedAt: string | null; closedBy: string; reopenedAt: string | null; reopenedBy: string; reopenReason: string }
interface Inspection {
  period: { year: number; month: number; label: string };
  status: "open" | "closed";
  isFuture: boolean;
  drafts: JournalRow[];
  unbalanced: JournalRow[];
  posted: number;
  totalDebit: number;
  previousOpen: { label: string } | null;
  periods: PeriodRow[];
}

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");
const nowBkk = () => { const d = new Date(Date.now() + 7 * 3600e3); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }; };

export default function PeriodClosePage() {
  const router = useRouter();
  const { companyId, role } = useAuth();
  const { showConfirm } = useSystemDialog();
  const isSuper = String(role || "").toUpperCase() === "SUPERADMIN";

  // ค่าเริ่มต้น: เดือนก่อนหน้า (งวดที่มักปิดในต้นเดือน)
  const [sel, setSel] = useState(() => { const n = nowBkk(); return n.month === 1 ? { year: n.year - 1, month: 12 } : { year: n.year, month: n.month - 1 }; });
  const [data, setData] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/accounting/period-close?companyId=${encodeURIComponent(companyId)}&year=${sel.year}&month=${sel.month}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ตรวจสอบงวดไม่สำเร็จ");
      setData(json);
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setLoading(false);
    }
  }, [companyId, sel.year, sel.month]);
  useEffect(() => { setData(null); load(); }, [load]);

  const label = `${THAI_MONTHS[sel.month - 1]} ${sel.year + 543}`;
  const current = data && data.period.year === sel.year && data.period.month === sel.month ? data : null;
  const blocked = !current || current.status === "closed" || current.isFuture || current.drafts.length > 0 || current.unbalanced.length > 0;

  const post = async (url: string, body: any) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, year: sel.year, month: sel.month, ...body }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ดำเนินการไม่สำเร็จ");
      setMessage({ text: json.message });
      setReason("");
      await load();
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    if (await showConfirm(`ยืนยันปิดงวด ${label}? หลังปิดแล้วจะบันทึกรายการบัญชีที่ลงวันที่ในงวดนี้ไม่ได้`)) post("/api/accounting/period-close", {});
  };
  const reopen = async () => {
    if (!reason.trim()) return setMessage({ text: "กรุณาระบุเหตุผลในการเปิดงวดอีกครั้ง", error: true });
    if (await showConfirm(`ยืนยันเปิดงวด ${label} อีกครั้ง?`)) post("/api/accounting/period-reopen", { reopenReason: reason });
  };

  const n = nowBkk();
  const years = Array.from({ length: 4 }, (_, i) => n.year - 2 + i).filter((y) => y <= n.year);

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">ปิดงวดบัญชี</h1>
          <p className="text-sm text-white/60 mt-1">ตรวจความพร้อมและล็อกงวดรายเดือน ไม่ให้บันทึกรายการย้อนหลังเข้างวดที่ปิดแล้ว</p>
        </div>
      </div>
      <PillButton variant="confirm" onClick={close} disabled={blocked || busy} className="h-9 px-5 text-xs font-bold">
        {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Lock size={14} className="mr-1.5" />} ปิดงวด {label}
      </PillButton>
    </div>
  );

  const check = (state: "ok" | "fail" | "warn", title: string, detail?: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      {state === "ok" ? <CheckCircle2 size={17} className="text-nexus-teal shrink-0 mt-0.5" /> : state === "warn" ? <AlertTriangle size={17} className="text-warning shrink-0 mt-0.5" /> : <AlertCircle size={17} className="text-danger shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-white">{title}</p>
        {detail && <p className="text-[12px] text-white/50 mt-0.5">{detail}</p>}
      </div>
    </div>
  );

  const issues = current ? [...current.drafts.map((j) => ({ ...j, kind: "รออนุมัติ" })), ...current.unbalanced.map((j) => ({ ...j, kind: "ไม่สมดุล" }))] : [];

  const left = (
    <div className="space-y-4 pb-10">
      {message && <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>}

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">เดือน</label>
            <PillSelect value={String(sel.month)} onChange={(e) => setSel((s) => ({ ...s, month: Number(e.target.value) }))} className="w-[150px] h-9 text-sm">
              {THAI_MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </PillSelect>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">ปี</label>
            <PillSelect value={String(sel.year)} onChange={(e) => setSel((s) => ({ ...s, year: Number(e.target.value) }))} className="w-[110px] h-9 text-sm">
              {years.map((y) => <option key={y} value={String(y)}>{y + 543}</option>)}
            </PillSelect>
          </div>
          <div className="h-9 flex items-center ml-auto">
            {loading || !current ? <span className="text-xs text-white/40 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> กำลังตรวจสอบ...</span>
              : current.status === "closed"
                ? <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/[0.06] border border-white/15 text-white flex items-center gap-1.5"><Lock size={12} /> ปิดงวดแล้ว</span>
                : <span className="px-3 py-1 rounded-full text-xs font-bold bg-nexus-teal/10 border border-nexus-teal/25 text-nexus-teal flex items-center gap-1.5"><Unlock size={12} /> งวดเปิดอยู่</span>}
          </div>
        </div>
      </GlassCard>

      {current && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-1">ตรวจความพร้อมก่อนปิดงวด</h3>
          {check(current.isFuture ? "fail" : "ok", current.isFuture ? "งวดนี้ยังไม่สิ้นสุด" : "งวดสิ้นสุดแล้ว")}
          {check(current.drafts.length ? "fail" : "ok", current.drafts.length ? `มีรายการบัญชีรออนุมัติ ${current.drafts.length} รายการ` : "ไม่มีรายการบัญชีรออนุมัติ", current.drafts.length ? "อนุมัติลงบัญชีหรือยกเลิกรายการด้านล่างก่อน" : undefined)}
          {check(current.unbalanced.length ? "fail" : "ok", current.unbalanced.length ? `มีรายการที่ลงบัญชีแล้วไม่สมดุล ${current.unbalanced.length} รายการ` : "รายการที่ลงบัญชีแล้วสมดุลทุกรายการ")}
          {current.previousOpen && check("warn", `งวดก่อนหน้า (${current.previousOpen.label}) ยังไม่ได้ปิด`, "ปิดงวดได้ แต่ควรปิดตามลำดับเดือน")}

          {issues.length > 0 && (
            <div className="nexus-table-wrap mt-3">
              <table className="w-full table-fixed text-[13px]">
                <colgroup><col className="w-[150px]" /><col className="w-[92px]" /><col /><col className="w-[120px]" /><col className="w-[84px]" /></colgroup>
                <thead>
                  <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                    <th className="py-2 px-1.5 text-left">เลขที่</th>
                    <th className="py-2 px-1.5 text-center">วันที่</th>
                    <th className="py-2 px-1.5 text-left">คำอธิบาย</th>
                    <th className="py-2 px-1.5 text-right">จำนวนเงิน</th>
                    <th className="py-2 px-1.5 text-center">ปัญหา</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((j) => (
                    <tr key={j.kind + j.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                      <td className="py-2 px-1.5 whitespace-nowrap"><Link href={`/finance/journal/${encodeURIComponent(j.path)}`} className="font-mono text-nexus-teal hover:underline">{j.journalNo}</Link></td>
                      <td className="py-2 px-1.5 text-center font-mono text-white/70 whitespace-nowrap">{j.date || "-"}</td>
                      <td className="py-2 px-1.5 text-white/80 truncate" title={j.description}>{j.description || "-"}</td>
                      <td className="py-2 px-1.5 text-right font-mono text-white whitespace-nowrap">{baht(j.amount)}</td>
                      <td className="py-2 px-1.5 text-center whitespace-nowrap"><span className={cn("text-[11px] font-bold", j.kind === "ไม่สมดุล" ? "text-danger" : "text-warning")}>{j.kind}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-2">ประวัติงวดบัญชี</h3>
        {!data?.periods.length ? <p className="text-[13px] text-white/40 py-2">ยังไม่เคยปิดงวด</p> : (
          <div className="nexus-table-wrap">
            <table className="w-full table-fixed text-[13px]">
              <colgroup><col className="w-[130px]" /><col className="w-[96px]" /><col className="w-[90px]" /><col /><col className="w-[30%]" /></colgroup>
              <thead>
                <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                  <th className="py-2 px-1.5 text-left">งวด</th>
                  <th className="py-2 px-1.5 text-center">สถานะ</th>
                  <th className="py-2 px-1.5 text-center">ปิดเมื่อ</th>
                  <th className="py-2 px-1.5 text-left">ผู้ปิด</th>
                  <th className="py-2 px-1.5 text-left">เปิดอีกครั้ง</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((p) => (
                  <tr key={p.id} onClick={() => setSel({ year: p.year, month: p.month })} className={cn("border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03]", p.year === sel.year && p.month === sel.month && "bg-white/[0.04]")}>
                    <td className="py-2 px-1.5 text-white whitespace-nowrap">{THAI_MONTHS[p.month - 1]} {p.year + 543}</td>
                    <td className="py-2 px-1.5 text-center whitespace-nowrap"><span className={cn("text-[12px] font-bold", p.status === "closed" ? "text-white" : "text-nexus-teal")}>{p.status === "closed" ? "ปิดแล้ว" : "เปิดอีกครั้ง"}</span></td>
                    <td className="py-2 px-1.5 text-center text-white/70 whitespace-nowrap">{thDate(p.closedAt)}</td>
                    <td className="py-2 px-1.5 text-white/70 truncate" title={p.closedBy}>{p.closedBy || "-"}</td>
                    <td className="py-2 px-1.5 text-white/60 truncate" title={p.reopenReason}>{p.reopenedAt ? `${thDate(p.reopenedAt)} · ${p.reopenReason || "-"}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );

  const right = (
    <div className="p-4 space-y-4">
      <GlassCard className="p-4 space-y-2">
        <h4 className="text-sm font-bold text-white mb-1">สรุปงวด {label}</h4>
        <div className="flex justify-between text-[13px]"><span className="text-white/60">รายการที่ลงบัญชีแล้ว</span><span className="font-mono text-white">{current ? current.posted.toLocaleString("th-TH") : "-"}</span></div>
        <div className="flex justify-between text-[13px]"><span className="text-white/60">ยอดเดบิตรวม</span><span className="font-mono text-white">{current ? baht(current.totalDebit) : "-"}</span></div>
        <div className="flex justify-between text-[13px]"><span className="text-white/60">รออนุมัติ</span><span className={cn("font-mono", current?.drafts.length ? "text-warning" : "text-white")}>{current ? current.drafts.length : "-"}</span></div>
      </GlassCard>
      {current?.status === "closed" && (
        <GlassCard className="p-4 space-y-2">
          <h4 className="text-sm font-bold text-white">เปิดงวดอีกครั้ง</h4>
          {isSuper ? (
            <>
              <PillInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล (จำเป็น)" className="w-full h-9 text-sm" />
              <PillButton variant="danger" onClick={reopen} disabled={busy} className="w-full h-9 text-xs font-bold"><Unlock size={14} className="mr-1.5" /> เปิดงวดอีกครั้ง</PillButton>
            </>
          ) : <p className="text-[12px] text-white/50">เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่เปิดงวดที่ปิดแล้วได้</p>}
        </GlassCard>
      )}
      <WhatHappens title="เมื่อปิดงวด" items={[
        "ล็อกงวดนี้ — เอกสารที่ลงวันที่ในงวด (ใบเสร็จ ใบสำคัญจ่าย ใบกำกับภาษีซื้อ บันทึกบัญชีด้วยมือ) บันทึกหรือแก้ไม่ได้",
        "ต้องไม่มีรายการรออนุมัติค้างในงวด",
        "ควรยื่น ภ.พ.30 และ ภ.ง.ด.3/53 ของงวดให้เรียบร้อยก่อนปิด",
        "เปิดงวดอีกครั้งได้เฉพาะผู้ดูแลระบบสูงสุด พร้อมระบุเหตุผล (เก็บประวัติไว้)",
      ]} />
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}
