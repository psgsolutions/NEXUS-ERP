"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertTriangle, BookOpen, Scale } from "lucide-react";
import { PillButton, GlassCard, StatusBadge, NexusTable, NexusTableRow, NexusTableCell } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { formatCurrency } from "@/lib/erp-logic";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { JOURNAL_POSTING_ROLES, isOwnJournal } from "@/lib/journal-posting";

const toDate = (v: any) => {
  if (!v) return "-";
  const ms = v.seconds ? v.seconds * 1000 : new Date(v).getTime();
  return ms ? new Date(ms).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-";
};

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, companyId, role } = useAuth();
  const { showConfirm } = useSystemDialog();

  // id = path ของเอกสาร (companies/{companyId}/journal_entries/{id} หรือ journal_entries/{id}) หรือ ID อย่างเดียว
  const raw = decodeURIComponent(String(params.id || ""));
  const path = raw.includes("/") ? raw : companyId ? `companies/${companyId}/journal_entries/${raw}` : null;
  const allowedPath = path && (path.startsWith(`companies/${companyId}/journal_entries/`) || path.startsWith("journal_entries/")) ? path : null;
  const { data: jv, loading } = useRealtimeDocument<any>(allowedPath);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (loading) return <div className="p-10 text-white/40 text-sm">กำลังโหลดรายการบัญชี...</div>;
  if (!jv || (jv.companyId && jv.companyId !== companyId && role !== "SUPERADMIN")) {
    return (
      <div className="p-10 space-y-4">
        <p className="text-white/60 text-sm">ไม่พบรายการบัญชีนี้</p>
        <PillButton variant="glass" onClick={() => router.push("/finance")}>กลับหน้าการเงิน</PillButton>
      </div>
    );
  }

  const lines: any[] = jv.items || jv.lines || [];
  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;
  const isDraft = String(jv.status || "posted").toLowerCase() === "draft";
  const roleUpper = String(role || "").toUpperCase();
  // ลงบัญชีผ่าน API เท่านั้น (รายการรุ่นเก่าที่ root ลงบัญชีจากหน้านี้ไม่ได้)
  const isCompanyJournal = !!allowedPath && allowedPath.startsWith(`companies/${companyId}/journal_entries/`);
  const ownEntry = isOwnJournal(jv, user?.uid, user?.email) && roleUpper !== "SUPERADMIN";
  const canPost = isDraft && balanced && isCompanyJournal && !ownEntry && JOURNAL_POSTING_ROLES.includes(roleUpper);

  const post = async () => {
    if (!(await showConfirm("ยืนยันอนุมัติลงบัญชีรายการนี้? หลังลงบัญชีแล้วแก้ไขไม่ได้ ต้องกลับรายการเท่านั้น"))) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/accounting/journal-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, journalId: allowedPath!.split("/").pop() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ลงบัญชีไม่สำเร็จ");
      setMessage({ type: "ok", text: "อนุมัติลงบัญชีแล้ว" });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "ลงบัญชีไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/finance")} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">รายการบัญชี</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-blue/10 border border-nexus-blue/30 text-nexus-blue text-sm font-mono font-bold">{jv.jvId || jv.journalNo || jv.id}</span>
            <StatusBadge status={isDraft ? "pending" : "active"} label={isDraft ? "รอตรวจ (ร่าง)" : "ลงบัญชีแล้ว"} />
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">{jv.description || "-"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {canPost && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={post}>
            <CheckCircle2 size={14} className="mr-1.5" /> อนุมัติลงบัญชี
          </PillButton>
        )}
        {isDraft && !balanced && <span className="text-[11px] text-danger">เดบิตไม่เท่ากับเครดิต ลงบัญชีไม่ได้</span>}
        {isDraft && balanced && !canPost && (
          <span className="text-[11px] text-white/40">
            {ownEntry ? "รายการที่คุณสร้าง ต้องให้ผู้อื่นในฝ่ายบัญชีอนุมัติ" : !isCompanyJournal ? "รายการรุ่นเก่า อนุมัติจากหน้านี้ไม่ได้" : "รอนักบัญชีหรือผู้ดูแลระบบอนุมัติ"}
          </span>
        )}
      </div>
      {message && (
        <div className={`w-full sm:basis-full p-3 rounded-xl text-[12px] font-bold flex items-center gap-2 ${message.type === "ok" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
          {message.type === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {message.text}
        </div>
      )}
    </div>
  );

  const left = (
    <div className="space-y-6 pr-2 pb-10">
      <GlassCard className="p-4 border-white/10 rounded-3xl space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3">
          <BookOpen size={16} className="text-nexus-blue" /> รายการเดบิต / เครดิต ({lines.length})
        </h3>
        <NexusTable headers={["รหัสบัญชี", "ชื่อบัญชี", "เดบิต", "เครดิต"]}>
          {lines.map((l: any, idx: number) => (
            <NexusTableRow key={idx}>
              <NexusTableCell className="whitespace-nowrap text-nexus-blue" mono>{l.accountCode || l.accountId || l.code || "-"}</NexusTableCell>
              <NexusTableCell className="text-white text-[13px]">{l.accountName || l.name || "-"}{l.description ? <span className="block text-[11px] text-white/40">{l.description}</span> : null}</NexusTableCell>
              <NexusTableCell className="text-right" mono>{Number(l.debit) ? formatCurrency(Number(l.debit)) : "-"}</NexusTableCell>
              <NexusTableCell className="text-right" mono>{Number(l.credit) ? formatCurrency(Number(l.credit)) : "-"}</NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      </GlassCard>
    </div>
  );

  const right = (
    <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-3 w-full h-fit text-[12px]">
      <Row label="วันที่" value={toDate(jv.date || jv.createdAt)} />
      <Row label="สมุด" value={jv.bookType || "-"} />
      <Row label="อ้างอิง" value={jv.reference || jv.referenceId || "-"} />
      {jv.postedBy && <Row label="ผู้อนุมัติ" value={jv.postedBy} />}
      <div className="pt-3 border-t border-white/5 space-y-2">
        <Row label="รวมเดบิต" value={formatCurrency(totalDr)} />
        <Row label="รวมเครดิต" value={formatCurrency(totalCr)} />
        <div className={`flex items-center gap-2 font-bold ${balanced ? "text-emerald-400" : "text-danger"}`}>
          <Scale size={14} /> {balanced ? "สมดุล" : `ไม่สมดุล (ต่าง ${formatCurrency(Math.abs(totalDr - totalCr))})`}
        </div>
      </div>
    </GlassCard>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 text-[12px]">
      <span className="text-white/50 font-bold">{label}</span>
      <span className="text-white font-mono font-bold text-right">{value}</span>
    </div>
  );
}
