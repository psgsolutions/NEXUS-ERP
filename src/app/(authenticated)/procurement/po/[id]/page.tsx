"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Calendar, CheckCircle2, Truck, XCircle, AlertTriangle, FileText, Printer } from "lucide-react";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { PillButton, GlassCard, StatusBadge, NexusTable, NexusTableRow, NexusTableCell } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { formatCurrency } from "@/lib/erp-logic";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { approvePurchaseOrder, cancelPurchaseOrder } from "@/lib/procurement-service";
import { normalizePoStatus } from "@/lib/procurement-status";
import { useSystemDialog } from "@/context/DialogContext";

const STEPS = ["รออนุมัติ", "อนุมัติแล้ว", "รับบางส่วน", "รับครบแล้ว"];

const VIEW: Record<string, { step: number; badge: "active" | "inactive" | "pending" | "warning" | "danger"; label: string }> = {
  PENDING_APPROVAL: { step: 0, badge: "pending", label: "รออนุมัติ" },
  APPROVED: { step: 1, badge: "active", label: "อนุมัติแล้ว รอรับสินค้า" },
  PARTIAL_RECEIVED: { step: 2, badge: "warning", label: "รับสินค้าบางส่วน" },
  RECEIVED: { step: 3, badge: "active", label: "รับสินค้าครบแล้ว" },
  CANCELLED: { step: 0, badge: "danger", label: "ยกเลิก" },
};

export default function PODetailPage() {
  const params = useParams();
  const router = useRouter();
  const poDocId = decodeURIComponent(String(params.id || ""));
  const { user, companyId, role } = useAuth();
  const { showConfirm } = useSystemDialog();
  const path = companyId && poDocId ? `companies/${companyId}/purchase_orders/${poDocId}` : null;
  const { data: po, loading } = useRealtimeDocument<any>(path);

  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (loading) return <div className="p-10 text-white/40 text-sm">กำลังโหลดใบสั่งซื้อ...</div>;
  if (!po) {
    return (
      <div className="p-10 space-y-4">
        <p className="text-white/60 text-sm">ไม่พบใบสั่งซื้อ &ldquo;{poDocId}&rdquo;</p>
        <PillButton variant="glass" onClick={() => router.push("/procurement")}>กลับหน้าจัดซื้อ</PillButton>
      </div>
    );
  }

  const status = normalizePoStatus(po.status);
  const view = VIEW[status];
  const items: any[] = (po.items || []).filter((it: any) => it.itemType !== "GROUP_HEADER");
  const nothingReceived = items.every((it) => !(Number(it.qtyReceived) > 0));

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ type: "ok", text: ok });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const approve = () => run(async () => {
    if (!user || !companyId) throw new Error("ไม่พบข้อมูลผู้ใช้");
    await approvePurchaseOrder(poDocId, companyId);
  }, "อนุมัติใบสั่งซื้อแล้ว");

  const cancel = async () => {
    if (!(await showConfirm("ยืนยันยกเลิกใบสั่งซื้อนี้?"))) return;
    run(async () => {
      if (!companyId) throw new Error("ไม่พบรหัสบริษัท");
      await cancelPurchaseOrder(poDocId, companyId);
    }, "ยกเลิกใบสั่งซื้อแล้ว");
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/procurement")} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ใบสั่งซื้อ</h1>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-mono font-bold">{po.poCode || poDocId}</span>
            <StatusBadge status={view.badge} label={view.label} />
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">{po.supplierName || po.supplierId || "-"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {true && (
          <>
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => setPrintOpen(true)}><Printer size={14} className="mr-1.5" /> พิมพ์</PillButton>
            <DocumentPdfModal open={printOpen} onClose={() => setPrintOpen(false)} source={{ type: "purchase_order", id: poDocId }} title={`ใบสั่งซื้อ ${po.poCode || poDocId}`} />
          </>
        )}
        {status !== "CANCELLED" && <DocumentStepper steps={STEPS} currentStep={view.step} />}
        {status === "PENDING_APPROVAL" && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={approve}>
            <CheckCircle2 size={14} className="mr-1.5" /> อนุมัติ
          </PillButton>
        )}
        {po.isSample && (
          <span className="text-[11px] text-warning">ข้อมูลตัวอย่าง: รับสินค้าเข้าคลังไม่ได้</span>
        )}
        {!po.isSample && (status === "APPROVED" || status === "PARTIAL_RECEIVED") && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={() => router.push(`/inventory/in/new?po=${encodeURIComponent(path!)}`)}>
            <Truck size={14} className="mr-1.5" /> รับสินค้าเข้าคลัง
          </PillButton>
        )}
        {(status === "PENDING_APPROVAL" || status === "APPROVED") && nothingReceived && (
          <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-red-400" disabled={busy} onClick={cancel}>
            <XCircle size={14} className="mr-1.5" /> ยกเลิก
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
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3"><Building2 size={16} className="text-purple-300" /> ผู้จัดจำหน่าย</h3>
          <Row label="ชื่อ" value={po.supplierName || "-"} />
          <Row label="อ้างอิง" value={po.reference || "-"} />
          <Row label="ประเภทการสั่งซื้อ" value={po.orderType === "PROJECT" ? "โครงการ" : po.orderType === "CONSUMABLE" ? "ของใช้บริษัท" : "สต็อกพัสดุ"} />
          {po.projectName && <Row label="โครงการ" value={po.projectName} />}
          {po.department && <Row label="แผนก" value={po.department} />}
        </GlassCard>
        <GlassCard className="p-4 border-white/10 rounded-3xl space-y-2 text-[12px]">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3"><Calendar size={16} className="text-nexus-blue" /> เงื่อนไข</h3>
          <Row label="วันที่สั่งซื้อ" value={po.date || "-"} />
          <Row label="กำหนดส่ง" value={po.expectedDate || "-"} />
          <Row label="การชำระเงิน" value={po.paymentTerm || "-"} />
          <Row label="ภาษี" value={po.vatType || "-"} />
          <Row label="สกุลเงิน" value={`${po.currency || "THB"}${po.currency && po.currency !== "THB" ? ` @ ${po.exchangeRate}` : ""}`} />
        </GlassCard>
      </div>

      <GlassCard className="p-4 border-white/10 rounded-3xl space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 border-b border-white/10 pb-3">รายการสั่งซื้อ ({items.length})</h3>
        <NexusTable headers={["รายการ", "สั่ง", "รับแล้ว", "ราคา/หน่วย", "รวม"]}>
          {items.map((it: any, idx: number) => {
            const qty = Number(it.qty ?? it.qtyOrdered ?? 0);
            const got = Number(it.qtyReceived) || 0;
            const price = Number(it.price ?? it.unitCost ?? 0);
            return (
              <NexusTableRow key={it.id || idx}>
                <NexusTableCell>
                  <div className="text-white text-[13px] font-bold">{it.name || it.description || "-"}</div>
                  {it.sku && <div className="text-[11px] text-white/40 font-mono">{it.sku}</div>}
                </NexusTableCell>
                <NexusTableCell className="text-right" mono>{qty.toLocaleString()} {it.unit || ""}</NexusTableCell>
                <NexusTableCell className={`text-right ${got >= qty ? "text-emerald-400" : got > 0 ? "text-warning" : ""}`} mono>{got.toLocaleString()}</NexusTableCell>
                <NexusTableCell className="text-right" mono>{formatCurrency(price)}</NexusTableCell>
                <NexusTableCell className="text-right text-white" mono>{formatCurrency(qty * price)}</NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
      </GlassCard>

      {po.terms && (
        <GlassCard className="p-4 border-white/10 rounded-3xl space-y-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2"><FileText size={16} /> เงื่อนไขเพิ่มเติม</h3>
          <p className="text-[12px] text-white/60 whitespace-pre-line">{po.terms}</p>
        </GlassCard>
      )}
    </div>
  );

  const right = (
    <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-4 w-full h-fit">
      <Row label="ยอดก่อนภาษี" value={`${formatCurrency(po.subTotal ?? 0)} บาท`} />
      <Row label="ภาษีมูลค่าเพิ่ม" value={`${formatCurrency(po.vatAmount ?? 0)} บาท`} />
      <div className="flex justify-between items-end pt-4 border-t border-white/5">
        <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">ยอดรวมสุทธิ</span>
        <span className="text-3xl font-black font-mono tracking-tighter text-purple-300">{formatCurrency(po.totalAmount ?? po.netTotal ?? 0)} <span className="text-[14px]">THB</span></span>
      </div>
      {Number(po.totalAmount) > 50000 && status === "PENDING_APPROVAL" && (
        <p className="text-[11px] text-warning">ยอดเกิน 50,000 บาท ต้องให้ SUPERADMIN อนุมัติ</p>
      )}
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
