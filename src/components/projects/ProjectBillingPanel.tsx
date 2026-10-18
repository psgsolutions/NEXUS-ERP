"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Printer, Receipt, Save, ShieldCheck, XCircle } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, StatusBadge } from "@/components/ui/Base";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { progressBillAmounts } from "@/lib/project-billing";

/**
 * เรียกเก็บเงินตามงวดงาน: ออกใบแจ้งหนี้ทีละงวด (หักเงินประกันผลงาน) ติดตามรับชำระ และเบิกคืนเงินประกัน
 * ใบแจ้งหนี้ไม่ใช่ใบกำกับภาษี — ใบเสร็จรับเงิน/ใบกำกับภาษีออกตอนรับชำระที่หน้ารับชำระเงิน
 */

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

interface Status {
  canBill: boolean;
  billable: boolean;
  projectStatus: string;
  billing: { retentionPercent: number; whtRate: number };
  milestones: { id: string; name: string; endDate: string; progress: number; amount: number }[];
  summary: { contract: number; billedTotal: number; received: number; unbilledAmount: number; retentionHeld: number; retentionReleased: number; retentionOutstanding: number; billedMilestones: string[] };
  bills: { docId: string; invoiceNo: string; docKind: string; milestoneId: string; milestoneName: string; issueDate: string; dueDate: string; grandTotal: number; paidAmount: number; balance: number; paymentStatus: string; status: string; retentionAmount: number }[];
}

export function ProjectBillingPanel({ companyId, docId, customerId }: { companyId: string; docId: string; customerId?: string }) {
  const { showConfirm, showPrompt, showAlert } = useSystemDialog();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [retention, setRetention] = useState("");
  const [wht, setWht] = useState("0");
  const [print, setPrint] = useState<{ id: string; no: string } | null>(null);

  const call = useCallback(async (body: Record<string, any>) => {
    const res = await apiFetch("/api/projects/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, projectDocId: docId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ทำรายการไม่สำเร็จ");
    return d;
  }, [companyId, docId]);

  const load = useCallback(async () => {
    try {
      const d = await call({ action: "status" });
      setSt(d);
      setRetention(String(d.billing.retentionPercent));
      setWht(String(d.billing.whtRate));
    } catch (e: any) { showAlert(e.message, "แจ้งเตือน", "error"); }
  }, [call, showAlert]);
  useEffect(() => { if (companyId && docId) load(); }, [companyId, docId, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await load(); } catch (e: any) { await showAlert(e.message, "แจ้งเตือน", "error"); } finally { setBusy(""); }
  };

  if (!st) return <div className="p-8 text-white/50 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> กำลังโหลด…</div>;
  const s = st.summary;
  const billOf = (mid: string) => st.bills.find((b) => b.milestoneId === mid && b.status !== "cancelled");
  const pct = Number(st.billing.retentionPercent) || 0;
  const retentionBills = st.bills.filter((b) => b.docKind === "retention");
  const cancelledBills = st.bills.filter((b) => b.status === "cancelled");

  const issue = (m: Status["milestones"][number]) => run(`bill:${m.id}`, async () => {
    const a = progressBillAmounts(m.amount, pct);
    if (!(await showConfirm(`ออกใบแจ้งหนี้งวด "${m.name}"\nมูลค่างาน ${baht(a.workValue)}${a.retention ? ` หักเงินประกัน ${baht(a.retention)}` : ""} + VAT ${baht(a.vat)}\nยอดเรียกเก็บ ${baht(a.total)} บาท`))) return;
    const d = await call({ action: "bill", milestoneId: m.id });
    setPrint({ id: d.invoiceNo, no: d.invoiceNo });
  });

  const release = () => run("release", async () => {
    if (!(await showConfirm(`ออกใบแจ้งหนี้เบิกคืนเงินประกันผลงาน ${baht(s.retentionOutstanding)} บาท + VAT ?`))) return;
    const d = await call({ action: "releaseRetention" });
    setPrint({ id: d.invoiceNo, no: d.invoiceNo });
  });

  const cancel = (b: Status["bills"][number]) => run(`cancel:${b.docId}`, async () => {
    const reason = await showPrompt(`ระบุเหตุผลที่ยกเลิกใบแจ้งหนี้ ${b.invoiceNo}`, "ยกเลิกใบแจ้งหนี้", "เช่น ยอดงวดไม่ถูกต้อง");
    if (!reason?.trim()) return;
    await call({ action: "cancel", invoiceDocId: b.docId, reason: reason.trim() });
  });

  const payLabel = (b: Status["bills"][number]) => b.status === "cancelled" ? { status: "danger" as const, label: "ยกเลิก" }
    : b.paymentStatus === "paid" ? { status: "active" as const, label: "รับชำระแล้ว" }
    : b.paymentStatus === "partial" ? { status: "warning" as const, label: `ค้าง ${baht(b.balance)}` }
    : { status: "pending" as const, label: "รอชำระ" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[["มูลค่าสัญญา", s.contract], ["เรียกเก็บแล้ว", s.billedTotal], ["รับชำระแล้ว", s.received], ["ยังไม่เรียกเก็บ", s.unbilledAmount], ["เงินประกันคงค้าง", s.retentionOutstanding]].map(([label, v]) => (
          <GlassCard key={String(label)} className="p-4">
            <p className="text-[12px] text-white/50 truncate">{label}</p>
            <p className="text-lg font-bold text-white font-mono mt-1">{baht(Number(v))}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[12px] font-bold text-white/60 ml-1">เงินประกันผลงาน (%)</label>
          <PillInput inputMode="decimal" value={retention} onChange={(e) => setRetention(e.target.value.replace(/[^\d.]/g, ""))} disabled={!st.canBill} className="h-9 w-28 text-right font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-bold text-white/60 ml-1">ลูกค้าหัก ณ ที่จ่าย</label>
          <select value={wht} onChange={(e) => setWht(e.target.value)} disabled={!st.canBill} className="h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] leading-[1.9]">
            {[0, 1, 2, 3, 5].map((r) => <option key={r} value={r} className="bg-surface-1">{r === 0 ? "ไม่หัก" : `${r}%`}</option>)}
          </select>
        </div>
        {st.canBill && (
          <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" disabled={!!busy} onClick={() => run("settings", async () => { await call({ action: "settings", retentionPercent: Number(retention) || 0, whtRate: Number(wht) || 0 }); })}>
            {busy === "settings" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก
          </PillButton>
        )}
        <p className="text-[12px] text-white/45 flex-1 min-w-[240px]">ใบแจ้งหนี้งวดงานยังไม่ใช่ใบกำกับภาษี เมื่อรับชำระที่ <Link href={`/finance/receipts/new${customerId ? `?customer=${encodeURIComponent(customerId)}` : ""}`} className="text-nexus-teal underline">หน้ารับชำระเงิน</Link> ระบบออกใบเสร็จรับเงิน/ใบกำกับภาษีให้ (VAT ถึงกำหนดเดือนที่รับเงิน)</p>
      </GlassCard>

      {!st.billable && <p className="text-[13px] text-warning px-1">โครงการสถานะ "{st.projectStatus}" ยังเรียกเก็บเงินไม่ได้ ต้องอนุมัติโครงการก่อน</p>}
      <NexusTable headers={["รายการ", "กำหนดเสร็จ", "ความคืบหน้า", "ยอดงวด (รวม VAT)", "เลขที่ใบแจ้งหนี้", "สถานะ", ""]}>
        {st.milestones.length === 0 ? (
          <NexusTableRow><NexusTableCell colSpan={7} className="text-center text-white/50 py-8">ยังไม่มีงวดงาน (กำหนดที่แท็บภาพรวม)</NexusTableCell></NexusTableRow>
        ) : st.milestones.map((m) => {
          const b = billOf(m.id);
          const pl = b ? payLabel(b) : null;
          return (
            <NexusTableRow key={m.id}>
              <NexusTableCell className="w-full font-bold text-white/85 truncate max-w-0">{m.name}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-white/60">{thDate(m.endDate)}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-mono text-white/70">{m.progress}%</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-mono text-white">{baht(m.amount)}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-nexus-blue">{b ? b.invoiceNo : "-"}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap text-center">{pl ? <StatusBadge status={pl.status} label={pl.label} /> : <span className="text-white/40 text-[12px]">ยังไม่เรียกเก็บ</span>}</NexusTableCell>
              <NexusTableCell className="w-[1%] whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  {!b && st.canBill && st.billable && m.amount > 0 && (
                    <PillButton variant="confirm" className="h-8 px-3 text-xs font-bold" disabled={!!busy} onClick={() => issue(m)} title="ออกใบแจ้งหนี้งวดนี้">
                      {busy === `bill:${m.id}` ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />} เรียกเก็บ
                    </PillButton>
                  )}
                  {b && b.status !== "cancelled" && b.paymentStatus !== "paid" && (
                    <Link href={`/finance/receipts/new?invoice=${encodeURIComponent(b.docId)}`} className="h-8 px-3 rounded-full border border-nexus-teal/30 text-nexus-teal text-[12px] font-bold flex items-center hover:bg-nexus-teal/10">รับชำระ</Link>
                  )}
                  {b && st.canBill && !(b.paidAmount > 0) && (
                    <button type="button" className="h-8 px-3 rounded-full border border-danger/30 text-danger text-[12px] font-bold hover:bg-danger/10" disabled={!!busy} onClick={() => cancel(b)}>ยกเลิก</button>
                  )}
                  {b && (
                    <button type="button" onClick={() => setPrint({ id: b.docId, no: b.invoiceNo })} className="w-8 h-8 rounded-full border border-white/15 text-white/60 hover:text-white inline-flex items-center justify-center" title={`พิมพ์/ส่ง ${b.invoiceNo}`} aria-label={`พิมพ์/ส่ง ${b.invoiceNo}`}><Printer size={14} /></button>
                  )}
                </div>
              </NexusTableCell>
            </NexusTableRow>
          );
        })}
      </NexusTable>

      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck size={16} className="text-nexus-teal" /> เงินประกันผลงาน</h3>
          {st.canBill && st.billable && s.retentionOutstanding > 0.009 && (
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" disabled={!!busy} onClick={release}>
              {busy === "release" ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />} เบิกคืนเงินประกัน {baht(s.retentionOutstanding)}
            </PillButton>
          )}
        </div>
        <p className="text-[13px] text-white/60">ลูกค้าหักไว้ {baht(s.retentionHeld)} · เบิกคืนแล้ว {baht(s.retentionReleased)} · คงค้าง <span className="text-white font-bold">{baht(s.retentionOutstanding)}</span> บาท (ก่อน VAT)</p>
        {[...retentionBills, ...cancelledBills.filter((b) => b.docKind === "progress")].map((b) => {
          const pl = payLabel(b);
          return (
            <div key={b.docId} className="flex items-center justify-between gap-3 text-[13px] border-t border-white/5 pt-2">
              <span className="text-white/70 truncate">{b.invoiceNo} · {b.docKind === "retention" ? "เบิกคืนเงินประกัน" : b.milestoneName} · {thDate(b.issueDate)} · {baht(b.grandTotal)}</span>
              <span className="flex items-center gap-2 shrink-0">
                <StatusBadge status={pl.status} label={pl.label} />
                {b.docKind === "retention" && b.status !== "cancelled" && b.paymentStatus !== "paid" && (
                  <Link href={`/finance/receipts/new?invoice=${encodeURIComponent(b.docId)}`} className="text-nexus-teal text-[12px] font-bold hover:underline">รับชำระ</Link>
                )}
                {b.docKind === "retention" && b.status !== "cancelled" && st.canBill && !(b.paidAmount > 0) && (
                  <button type="button" className="text-danger/80 hover:text-danger" onClick={() => cancel(b)} title="ยกเลิก" aria-label="ยกเลิก"><XCircle size={15} /></button>
                )}
                <button type="button" onClick={() => setPrint({ id: b.docId, no: b.invoiceNo })} className="text-white/60 hover:text-white" title="พิมพ์" aria-label="พิมพ์"><Printer size={15} /></button>
              </span>
            </div>
          );
        })}
      </GlassCard>

      <DocumentPdfModal open={!!print} onClose={() => setPrint(null)} source={print ? { type: "invoice", id: print.id } : undefined} title={`ใบแจ้งหนี้ ${print?.no || ""}`} />
    </div>
  );
}
