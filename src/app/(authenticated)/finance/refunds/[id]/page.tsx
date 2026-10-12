"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";
import { GlassCard, PillButton, StatusBadge, Toast } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** ใบคืนเงินลูกค้า: ดูรายละเอียด / ยกเลิก */
export default function CustomerRefundPage() {
  const params = useParams();
  const router = useRouter();
  const { companyId, role } = useAuth();
  const refundNo = decodeURIComponent(String(params?.id || ""));
  const { data: d, loading } = useRealtimeDocument<any>(companyId && refundNo ? `companies/${companyId}/customer_refunds/${refundNo}` : null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const cancelled = d?.status === "cancelled";
  const doCancel = async () => {
    try {
      setBusy(true);
      const res = await apiFetch("/api/finance/customer-refunds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "cancel", refundNo, reason }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ยกเลิกไม่สำเร็จ");
      setToast({ message: `ยกเลิก ${refundNo} แล้ว — ยอดค้างคืนกลับไปที่ใบกำกับ${data.journal === "reversed" ? " · สร้างรายการกลับบัญชีรออนุมัติ" : ""}`, isVisible: true });
      setCancelling(false);
    } catch (e: any) {
      setToast({ message: e.message, isVisible: true });
    } finally {
      setBusy(false);
    }
  };

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/50 shrink-0">{k}</span>
      <span className="text-[13px] text-white text-right min-w-0 break-words">{v || "-"}</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[960px]">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl">
        <div className="flex items-center gap-3 min-w-0">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center shrink-0"><ArrowLeft size={20} /></PillButton>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-white">ใบคืนเงิน {refundNo}</h1>
              {d && (cancelled ? <StatusBadge status="danger" label="ยกเลิกแล้ว" /> : <StatusBadge status="active" label="คืนเงินแล้ว" />)}
            </div>
            <p className="text-sm text-white/60">{d?.customerName || (loading ? "กำลังโหลด..." : "ไม่พบเอกสาร")}</p>
          </div>
        </div>
        {d && !cancelled && can(role, "finance:edit") && !cancelling && (
          <PillButton variant="glass" onClick={() => setCancelling(true)} className="h-9 px-4 text-xs font-bold text-danger border-danger/30">
            <Ban size={14} className="mr-1.5" /> ยกเลิกใบคืนเงิน
          </PillButton>
        )}
      </div>

      {cancelling && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl border border-danger/25 bg-danger/[0.04]">
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลการยกเลิก (จำเป็น)" className="h-9 flex-1 min-w-[240px] px-4 rounded-full bg-white/[0.03] border border-white/10 text-[13px] text-white focus:outline-none" />
          <button type="button" disabled={busy || reason.trim().length < 3} onClick={doCancel} className="h-9 px-4 rounded-full border border-danger/40 text-danger text-[12px] font-bold disabled:opacity-40">{busy ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}</button>
          <button type="button" onClick={() => setCancelling(false)} className="h-9 px-4 rounded-full border border-white/10 text-white/60 text-[12px] font-bold">ปิด</button>
        </div>
      )}

      {d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-2">รายละเอียดการคืนเงิน</h3>
            {row("จำนวนเงิน", <b className="font-mono text-nexus-teal">{baht(d.amount)}</b>)}
            {row("วันที่คืนเงิน", d.refundDate)}
            {row("วิธีคืนเงิน", d.paymentMethodLabel)}
            {row("บัญชีธนาคาร", d.bankAccount)}
            {row("เลขอ้างอิง", d.reference)}
            {row("หมายเหตุ", d.note)}
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-2">อ้างอิง</h3>
            {row("ใบกำกับภาษี", d.invoiceNo)}
            {row("ลูกค้า", d.customerName)}
            {row("รายการบัญชี", d.journalId ? <Link href={`/finance/journal/${encodeURIComponent(d.journalId)}`} className="text-nexus-teal hover:underline font-mono">{d.journalId.slice(0, 8)}…</Link> : "-")}
            {cancelled && row("ยกเลิกเมื่อ", `${d.cancelDate} · ${d.cancelReason}`)}
            {cancelled && d.reversalJournalId && row("รายการกลับบัญชี", <Link href={`/finance/journal/${encodeURIComponent(d.reversalJournalId)}`} className="text-nexus-teal hover:underline font-mono">{d.reversalJournalId.slice(0, 8)}…</Link>)}
          </GlassCard>
        </div>
      )}
      {toast.isVisible && <Toast isVisible message={toast.message} onClose={() => setToast((t) => ({ ...t, isVisible: false }))} />}
    </div>
  );
}
