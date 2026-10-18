"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShoppingCart, User, Calendar, Printer } from "lucide-react";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { PillButton, GlassCard, StatusBadge, NexusTable, NexusTableRow, NexusTableCell } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { formatCurrency } from "@/lib/erp-logic";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { apiFetch } from "@/lib/api-client";
import { useSystemDialog } from "@/context/DialogContext";
import { can } from "@/lib/permissions";

const VIEW: Record<string, { badge: "active" | "inactive" | "pending" | "warning" | "danger"; label: string }> = {
  PENDING_APPROVAL: { badge: "pending", label: "รออนุมัติ" },
  APPROVED: { badge: "active", label: "อนุมัติแล้ว" },
  CONVERTED: { badge: "active", label: "ออกใบสั่งซื้อแล้ว" },
  REJECTED: { badge: "danger", label: "ไม่อนุมัติ" },
  CANCELLED: { badge: "danger", label: "ยกเลิก" },
};
const PRIORITY: Record<string, string> = { low: "ทั่วไป", medium: "ปกติ", high: "ด่วน", urgent: "ด่วนที่สุด" };

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const prDocId = decodeURIComponent(String(params.id || ""));
  const { user, companyId, role, roles } = useAuth();
  const { showConfirm } = useSystemDialog();
  const path = companyId && prDocId ? `companies/${companyId}/purchase_requests/${prDocId}` : null;
  const { data: pr, loading } = useRealtimeDocument<any>(path);
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (loading) return <div className="p-10 text-white/40 text-sm">กำลังโหลดใบขอซื้อ...</div>;
  if (!pr) {
    return (
      <div className="p-10 space-y-4">
        <p className="text-white/60 text-sm">ไม่พบใบขอซื้อ &ldquo;{prDocId}&rdquo;</p>
        <PillButton variant="glass" onClick={() => router.push("/procurement")}>กลับหน้าจัดซื้อ</PillButton>
      </div>
    );
  }

  const status = String(pr.status || "PENDING_APPROVAL").toUpperCase();
  const view = VIEW[status] || VIEW.PENDING_APPROVAL;
  const items: any[] = (pr.items || []).filter((it: any) => it.itemType !== "GROUP_HEADER");
  // อนุมัติได้เฉพาะฝ่ายบัญชี/ผู้บริหาร และผู้ขอซื้ออนุมัติใบของตัวเองไม่ได้ (ยกเว้น SUPERADMIN)
  const canApprove = status === "PENDING_APPROVAL" && can(roles, "procurement:approve")
    && (role === "SUPERADMIN" || (pr.requesterUid && pr.requesterUid !== user?.uid));

  const setStatus = async (next: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const action = next === "APPROVED" ? "approve" : next === "REJECTED" ? "reject" : "cancel";
      const res = await apiFetch("/api/procurement/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action, prId: path!.split("/").pop() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      setMessage({ type: "ok", text: next === "APPROVED" ? "อนุมัติใบขอซื้อแล้ว" : next === "REJECTED" ? "ไม่อนุมัติใบขอซื้อ" : "ยกเลิกใบขอซื้อแล้ว" });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/procurement")} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ใบขอซื้อ</h1>
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-mono font-bold">{pr.prCode || prDocId}</span>
            <StatusBadge status={view.badge} label={view.label} />
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">{pr.requester || "-"} • {pr.department || "-"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {true && (
          <>
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => setPrintOpen(true)}><Printer size={14} className="mr-1.5" /> พิมพ์</PillButton>
            <DocumentPdfModal open={printOpen} onClose={() => setPrintOpen(false)} source={{ type: "purchase_request", id: prDocId }} title={`ใบขอซื้อ ${pr.prCode || prDocId}`} />
          </>
        )}
        {canApprove && (
          <>
            <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={() => setStatus("APPROVED")}>
              <CheckCircle2 size={14} className="mr-1.5" /> อนุมัติ
            </PillButton>
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-red-400" disabled={busy} onClick={async () => { if (await showConfirm("ยืนยันไม่อนุมัติใบขอซื้อนี้?")) setStatus("REJECTED"); }}>
              <XCircle size={14} className="mr-1.5" /> ไม่อนุมัติ
            </PillButton>
          </>
        )}
        {status === "PENDING_APPROVAL" && !canApprove && (
          <span className="text-[11px] text-white/40">รอผู้มีสิทธิ์อนุมัติ (ผู้ขอซื้ออนุมัติใบของตัวเองไม่ได้)</span>
        )}
        {pr.isSample && status === "APPROVED" && (
          <span className="text-[11px] text-warning">ข้อมูลตัวอย่าง: สร้างใบสั่งซื้อจริงไม่ได้</span>
        )}
        {!pr.isSample && status === "APPROVED" && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={() => router.push(`/procurement/orders/new?pr=${encodeURIComponent(prDocId)}`)}>
            <ShoppingCart size={14} className="mr-1.5" /> สร้างใบสั่งซื้อจากใบขอซื้อนี้
          </PillButton>
        )}
        {status === "CONVERTED" && pr.poCode && (
          <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => router.push(`/procurement/po/${encodeURIComponent(pr.poCode)}`)}>
            ดูใบสั่งซื้อ {pr.poCode}
          </PillButton>
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
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4 border-white/10 rounded-3xl space-y-2 text-[12px]">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3"><User size={16} className="text-cyan-300" /> ผู้ขอซื้อ</h3>
          <Row label="ผู้ยื่นคำขอ" value={pr.requester || "-"} />
          <Row label="แผนก" value={pr.department || "-"} />
          <Row label="โครงการ" value={pr.projectName || pr.projectId || "-"} />
          <Row label="ผู้จำหน่ายที่แนะนำ" value={pr.suggestedSupplierName || "-"} />
        </GlassCard>
        <GlassCard className="p-4 border-white/10 rounded-3xl space-y-2 text-[12px]">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3"><Calendar size={16} className="text-nexus-blue" /> กำหนดการ</h3>
          <Row label="วันที่ขอ" value={pr.requestDate || "-"} />
          <Row label="วันที่ต้องการใช้" value={pr.requiredDate || "-"} />
          <Row label="ความสำคัญ" value={PRIORITY[pr.priority] || pr.priority || "-"} />
        </GlassCard>
      </div>
      <GlassCard className="p-4 border-white/10 rounded-3xl space-y-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80">วัตถุประสงค์ / ความจำเป็น</h3>
        <p className="text-[13px] text-white/70 whitespace-pre-line">{pr.reason || "-"}</p>
      </GlassCard>
      <GlassCard className="p-4 border-white/10 rounded-3xl space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 border-b border-white/10 pb-3">รายการขอซื้อ ({items.length})</h3>
        <NexusTable headers={["รายการ", "จำนวน", "ราคาประมาณ/หน่วย", "รวม"]}>
          {items.map((it: any, idx: number) => {
            const qty = Number(it.qty || 0);
            const price = Number(it.price || 0);
            return (
              <NexusTableRow key={it.id || idx}>
                <NexusTableCell>
                  <div className="text-white text-[13px] font-bold">{it.name || "-"}</div>
                  {it.sku && <div className="text-[11px] text-white/40 font-mono">{it.sku}</div>}
                </NexusTableCell>
                <NexusTableCell className="text-right" mono>{qty.toLocaleString()} {it.unit || ""}</NexusTableCell>
                <NexusTableCell className="text-right" mono>{formatCurrency(price)}</NexusTableCell>
                <NexusTableCell className="text-right text-white" mono>{formatCurrency(qty * price)}</NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </GlassCard>
    </div>
  );

  const right = (
    <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-4 w-full h-fit">
      <Row label="ยอดก่อนภาษี" value={`${formatCurrency(pr.subTotal ?? 0)} บาท`} />
      <Row label="ภาษีมูลค่าเพิ่ม" value={`${formatCurrency(pr.vatAmount ?? 0)} บาท`} />
      {Number(pr.whtAmount) > 0 && <Row label="หัก ณ ที่จ่าย" value={`-${formatCurrency(pr.whtAmount)} บาท`} />}
      <div className="flex justify-between items-end pt-4 border-t border-white/5">
        <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">ยอดประมาณการ</span>
        <span className="text-3xl font-black font-mono tracking-tighter text-cyan-300">{formatCurrency(pr.totalAmount ?? 0)}</span>
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
