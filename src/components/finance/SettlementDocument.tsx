"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, Loader2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";

const baht = (n: any) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const journalHref = (companyId: string, id: string) => `/finance/journal/${encodeURIComponent(`companies/${companyId}/journal_entries/${id}`)}`;

/** หน้าเอกสารใบเสร็จรับเงิน / ใบสำคัญจ่าย พร้อมการยกเลิก (คืนยอดค้าง + กลับรายการบัญชี) */
export default function SettlementDocument({ kind }: { kind: "receipt" | "payment" }) {
  const router = useRouter();
  const params = useParams();
  const docNo = decodeURIComponent(String(params?.id || ""));
  const { companyId, role } = useAuth();
  const { showConfirm } = useSystemDialog();
  const isReceipt = kind === "receipt";
  const title = isReceipt ? "ใบเสร็จรับเงิน" : "ใบสำคัญจ่าย";
  const { data: d, loading } = useRealtimeDocument<any>(companyId && docNo ? `companies/${companyId}/${isReceipt ? "receipts" : "payments"}/${docNo}` : null);

  const [reason, setReason] = useState("");
  const [cancelDate, setCancelDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const cancelled = String(d?.status || "").toLowerCase() === "cancelled";
  const lines: any[] = Array.isArray(d?.lines) ? d.lines : [];
  const canCancel = !!d && !cancelled && !d.isSample && lines.length > 0 && can(role, "finance:edit");

  const cancel = async () => {
    if (!reason.trim()) return setMessage({ text: "กรุณาระบุเหตุผลการยกเลิก", error: true });
    if (!(await showConfirm(`ยืนยันยกเลิก${title} ${docNo}? ระบบจะคืนยอดค้างและกลับรายการบัญชี`))) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/finance/document-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, kind, docNo, reason, cancelDate }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ยกเลิกไม่สำเร็จ");
      setMessage({ text: json.journal === "reversed" ? "ยกเลิกแล้ว สร้างรายการกลับบัญชีรออนุมัติ" : "ยกเลิกแล้ว รายการบัญชีที่ยังไม่อนุมัติถูกยกเลิกด้วย" });
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white tracking-tight">{title}</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold">{docNo}</span>
            {d && <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", cancelled ? "bg-danger/10 border-danger/25 text-danger" : "bg-white/[0.05] border-white/15 text-white")}>{cancelled ? "ยกเลิกแล้ว" : "ใช้งาน"}</span>}
          </div>
          <p className="text-sm text-white/60 mt-1">{isReceipt ? d?.customerName : d?.payeeName || ""}</p>
        </div>
      </div>
    </div>
  );

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60 shrink-0">{k}</span>
      <span className="text-[13px] text-white text-right truncate">{v || "-"}</span>
    </div>
  );

  const cols = isReceipt
    ? [{ h: "ใบแจ้งหนี้", k: "invoiceNo" }, { h: "ยอดค้างก่อนรับ", k: "balanceBefore" }, { h: "ยอดรับชำระ", k: "amount" }, { h: "หัก ณ ที่จ่าย", k: "whtAmount" }, { h: "รับสุทธิ", k: "netReceived" }]
    : [{ h: "รายการ", k: "expenseNo" }, { h: "ยอดค้างก่อนจ่าย", k: "balanceBefore" }, { h: "ยอดจ่าย", k: "amount" }, { h: "หัก ณ ที่จ่าย", k: "whtAmount" }, { h: "จ่ายสุทธิ", k: "netPaid" }];

  const left = (
    <div className="space-y-4 pb-10">
      {message && <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>}
      {!loading && !d && <GlassCard className="p-6 text-sm text-white/60">ไม่พบเอกสาร {docNo}</GlassCard>}
      {d && cancelled && (
        <div className="p-3 rounded-xl text-xs border bg-danger/10 border-danger/20 text-danger space-y-1">
          <p className="font-bold">ยกเลิกเมื่อ {d.cancelDate || "-"} · {d.cancelReason || "-"}</p>
          {d.reversalJournalId && companyId && <Link href={journalHref(companyId, d.reversalJournalId)} className="underline">ดูรายการกลับบัญชี</Link>}
        </div>
      )}
      {d && (
        <>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-2">ข้อมูลเอกสาร</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div>
                {row(isReceipt ? "ลูกค้า" : "ผู้รับเงิน", isReceipt ? d.customerName : d.payeeName)}
                {row(isReceipt ? "วันที่รับชำระ" : "วันที่จ่าย", <span className="font-mono">{d.paymentDate}</span>)}
                {row("วิธีชำระ", d.paymentMethodLabel || d.paymentMethod)}
              </div>
              <div>
                {row("บัญชีธนาคาร", d.bankAccount)}
                {row("เลขที่อ้างอิง", d.reference)}
                {row("หมายเหตุ", d.note)}
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-2">รายการ</h3>
            {!lines.length ? <p className="text-[13px] text-white/50">เอกสารรุ่นเก่า ไม่มีรายละเอียดรายการ</p> : (
              <div className="nexus-table-wrap">
                <table className="w-full table-fixed text-[13px]">
                  <colgroup><col /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[16%]" /><col className="w-[18%]" /></colgroup>
                  <thead>
                    <tr className="text-[11px] font-bold text-white/50 border-b border-white/10">
                      {cols.map((c, i) => <th key={c.k} className={cn("py-2 px-1.5", i === 0 ? "text-left" : "text-right")}>{c.h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0">
                        <td className="py-2 px-1.5 font-mono text-nexus-teal truncate">{l[cols[0].k]}</td>
                        {cols.slice(1).map((c) => (
                          <td key={c.k} className="py-2 px-1.5 text-right font-mono text-white whitespace-nowrap" title={c.k === "whtAmount" && l.whtRate ? `${l.whtRate}%` : undefined}>{baht(l[c.k])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 font-mono font-bold text-white">
                      <td className="py-2 px-1.5 text-right font-sans text-[12px] text-white/60">รวม</td>
                      <td />
                      <td className="py-2 px-1.5 text-right whitespace-nowrap">{baht(isReceipt ? d.totalApplied : d.totalAmount)}</td>
                      <td className="py-2 px-1.5 text-right whitespace-nowrap">{baht(d.totalWht)}</td>
                      <td className="py-2 px-1.5 text-right whitespace-nowrap">{baht(isReceipt ? d.cashReceived : d.netPaid)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );

  const right = (
    <div className="p-4 space-y-4">
      {d && (
        <GlassCard className="p-4 space-y-2">
          <h4 className="text-sm font-bold text-white mb-1">เอกสารที่เกี่ยวข้อง</h4>
          {d.journalId && companyId && <Link href={journalHref(companyId, d.journalId)} className="block text-[13px] text-nexus-teal hover:underline">รายการบัญชี{d.journalAction === "voided" ? " (ยกเลิกแล้ว)" : ""}</Link>}
          {(d.whtCertificates || []).map((w: string) => <p key={w} className="text-[13px] text-white/70">หนังสือรับรองหัก ณ ที่จ่าย <span className="font-mono">{w}</span>{cancelled ? " (ยกเลิก)" : ""}</p>)}
        </GlassCard>
      )}
      {canCancel && (
        <GlassCard className="p-4 space-y-2.5">
          <h4 className="text-sm font-bold text-white">ยกเลิก{title}</h4>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">วันที่ยกเลิก</label>
            <PillInput type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value)} className="w-full h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1">เหตุผล <span className="text-danger">*</span></label>
            <PillInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น บันทึกยอดผิด, เช็คคืน" className="w-full h-9 text-sm" />
          </div>
          <PillButton variant="danger" onClick={cancel} disabled={busy} className="w-full h-9 text-xs font-bold">
            {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Ban size={14} className="mr-1.5" />} ยกเลิก{title}
          </PillButton>
          <p className="text-[11px] text-white/40">คืนยอดค้างให้{isReceipt ? "ใบแจ้งหนี้" : "รายการค่าใช้จ่าย"} · รายการบัญชีที่ยังไม่อนุมัติจะถูกยกเลิก ส่วนที่ลงบัญชีแล้วจะกลับรายการ ณ วันที่ยกเลิก{isReceipt ? "" : " · หนังสือรับรองหัก ณ ที่จ่ายที่ออกพร้อมการจ่ายจะถูกยกเลิก"}</p>
        </GlassCard>
      )}
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}
