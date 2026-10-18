"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Building2, Calendar, CheckCircle2, FileText, MapPin, Truck, XCircle, AlertTriangle, Printer } from "lucide-react";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { PillButton, GlassCard, StatusBadge, NexusTable, NexusTableRow, NexusTableCell } from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { soPickRemaining } from "@/lib/picking";
import { useSystemDialog } from "@/context/DialogContext";

const STEPS = ["ร่าง", "อนุมัติแล้ว", "ส่งมอบแล้ว", "ออกใบกำกับแล้ว"];

function normalizeStatus(status: string) {
  const st = String(status || "").toUpperCase();
  if (["DRAFT", "DELIVERED", "COMPLETED", "CANCELLED"].includes(st)) return st;
  return "CONFIRMED";
}

const STATUS_VIEW: Record<string, { step: number; badge: "active" | "inactive" | "pending" | "warning" | "danger"; label: string }> = {
  DRAFT: { step: 0, badge: "pending", label: "ร่าง" },
  CONFIRMED: { step: 1, badge: "active", label: "อนุมัติแล้ว" },
  DELIVERED: { step: 2, badge: "warning", label: "ส่งมอบแล้ว รอออกใบกำกับ" },
  COMPLETED: { step: 3, badge: "active", label: "ออกใบกำกับแล้ว" },
  CANCELLED: { step: 0, badge: "danger", label: "ยกเลิก" },
};

const toDateStr = (v: any) => {
  if (!v) return "-";
  if (typeof v === "string") return v.split("T")[0];
  if (v.seconds) return new Date(v.seconds * 1000).toISOString().split("T")[0];
  return "-";
};

export default function SalesOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const soDocId = decodeURIComponent(String(params.id || ""));
  const { companyId } = useAuth();
  const { showConfirm } = useSystemDialog();
  const { data: so, loading } = useRealtimeDocument<any>(companyId && soDocId ? `companies/${companyId}/sales_orders/${soDocId}` : null);

  const [busy, setBusy] = useState(false);
  const [printDoc, setPrintDoc] = useState<{ type: string; id: string; title: string } | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const status = normalizeStatus(so?.status);
  const view = STATUS_VIEW[status];
  const items: any[] = (so?.items || []).filter((it: any) => it.itemType !== "GROUP_HEADER");
  // มีสินค้าที่ต้องเบิกจากคลัง: ส่งมอบผ่านหน้าเบิกสินค้า (ตัดสต็อก + ลงต้นทุนขาย) แทนการกดส่งมอบตรง
  const needsPicking = so ? soPickRemaining(so).size > 0 : false;

  // เปลี่ยนสถานะที่ server: ตรวจวงเงินเครดิต ตรวจการเบิกสินค้า และคืนยอดจองเมื่อยกเลิก
  const setStatus = async (action: "confirm" | "deliver" | "cancel") => {
    if (!companyId || !so) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/sales/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, soId: soDocId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "อัปเดตสถานะไม่สำเร็จ");
      setMessage({ type: "ok", text: "อัปเดตสถานะเรียบร้อย" });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "อัปเดตสถานะไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const issueTaxInvoice = async () => {
    if (!companyId || !so) return;
    if (!(await showConfirm("ยืนยันออกใบกำกับภาษีและใบวางบิล? ระบบจะลงบัญชีรายได้และภาษีขายทันที"))) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await issueTaxInvoiceApi(companyId, soDocId);
      setMessage({ type: "ok", text: `ออกใบกำกับภาษี ${result.taxInvoiceNo} และใบวางบิล ${result.billingNoteNo} แล้ว` });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "ออกใบกำกับภาษีไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-white/40 text-sm">กำลังโหลดใบสั่งขาย...</div>;
  }

  if (!so) {
    return (
      <div className="p-10 space-y-4">
        <p className="text-white/60 text-sm">ไม่พบใบสั่งขาย &quot;{soDocId}&quot;</p>
        <PillButton variant="glass" onClick={() => router.push("/sales/orders")}>กลับไปหน้ารายการใบสั่งขาย</PillButton>
      </div>
    );
  }

  const docNo = so.documentNo || so.soId || soDocId;
  const customerName = so.customerName || so.customerSnapshot?.name || so.customerId || "-";

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/sales/orders")} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ใบสั่งขาย</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold">
              {docNo}
            </span>
            <StatusBadge status={view.badge} label={view.label} />
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">{customerName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        {status !== "CANCELLED" && <DocumentStepper steps={STEPS} currentStep={view.step} />}
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => setPrintDoc({ type: "sales_order", id: soDocId, title: `ใบสั่งขาย ${docNo}` })}>
          <Printer size={14} className="mr-1.5" /> พิมพ์
        </PillButton>
        {(Array.isArray(so.deliveryNotes) ? so.deliveryNotes : []).map((dn: string) => (
          <PillButton key={dn} variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => setPrintDoc({ type: "delivery_note", id: dn, title: `ใบส่งของ ${dn}` })}>
            <Printer size={14} className="mr-1.5" /> ใบส่งของ {dn}
          </PillButton>
        ))}
        <DocumentPdfModal open={!!printDoc} onClose={() => setPrintDoc(null)} source={printDoc ? { type: printDoc.type, id: printDoc.id } : undefined} title={printDoc?.title || ""} />
        {status === "DRAFT" && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={() => setStatus("confirm")}>
            <CheckCircle2 size={14} className="mr-1.5" /> อนุมัติใบสั่งขาย
          </PillButton>
        )}
        {status === "CONFIRMED" && needsPicking && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={() => router.push(`/inventory/pick?so=${encodeURIComponent(soDocId)}`)}>
            <Truck size={14} className="mr-1.5" /> จัดของ / เบิกสินค้า{so.picked ? " (เบิกต่อ)" : ""}
          </PillButton>
        )}
        {status === "CONFIRMED" && !needsPicking && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={() => setStatus("deliver")}>
            <Truck size={14} className="mr-1.5" /> บันทึกส่งมอบแล้ว
          </PillButton>
        )}
        {status === "DELIVERED" && (
          <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" disabled={busy} onClick={issueTaxInvoice}>
            <FileText size={14} className="mr-1.5" /> ออกใบกำกับภาษี + ใบวางบิล
          </PillButton>
        )}
        {(status === "DRAFT" || status === "CONFIRMED") && (
          <PillButton
            variant="glass"
            className="h-8 px-4 text-xs font-bold text-red-400"
            disabled={busy}
            onClick={async () => { if (await showConfirm("ยืนยันยกเลิกใบสั่งขายนี้?")) setStatus("cancel"); }}
          >
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

  const leftContent = (
    <div className="space-y-6 pr-2 pb-10">
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4 border-white/10 rounded-3xl space-y-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3">
            <Building2 size={16} className="text-nexus-teal" /> ลูกค้า
          </h3>
          <p className="text-[14px] font-bold text-white">{customerName}</p>
          <p className="text-[12px] text-white/50 font-mono">เลขผู้เสียภาษี {so.customerSnapshot?.taxId || so.customerInfo?.taxId || "-"} • สาขา {so.customerSnapshot?.branch || "-"}</p>
          <p className="text-[12px] text-white/60 flex gap-2"><MapPin size={14} className="shrink-0 mt-0.5" /> {so.billingAddress || so.customerSnapshot?.address || "-"}</p>
          {so.deliveryAddress && so.deliveryAddress !== so.billingAddress && (
            <p className="text-[12px] text-cyan-400/80 flex gap-2"><Truck size={14} className="shrink-0 mt-0.5" /> ส่งมอบที่: {so.deliveryAddress}</p>
          )}
        </GlassCard>
        <GlassCard className="p-4 border-white/10 rounded-3xl space-y-2 text-[12px]">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-3">
            <Calendar size={16} className="text-nexus-blue" /> เงื่อนไข
          </h3>
          <Row label="วันที่เอกสาร" value={toDateStr(so.docDate || so.date || so.createdAt)} />
          <Row label="เครดิต" value={so.paymentTermDays !== undefined ? `${so.paymentTermDays} วัน` : (so.paymentTerms || "-")} />
          <Row label="โครงการ" value={so.projectName || so.projectId || "-"} />
          <Row label="ประเภทภาษี" value={so.vatType || so.taxMode || "-"} />
          <Row label="อ้างอิงใบเสนอราคา" value={so.quoteId || so.quotationRefNo || "-"} />
          {so.invoiceNo && <Row label="ใบกำกับภาษี" value={so.invoiceNo} />}
          {so.billingNoteNo && <Row label="ใบวางบิล" value={so.billingNoteNo} />}
        </GlassCard>
      </div>

      <GlassCard className="p-4 border-white/10 rounded-3xl space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 border-b border-white/10 pb-3">
          รายการสินค้า / บริการ ({items.length})
        </h3>
        <NexusTable headers={["รายการ", "จำนวน", "ราคา/หน่วย", "ส่วนลด", "รวม"]}>
          {items.map((it: any, idx: number) => {
            const qty = Number(it.qty ?? it.quantity ?? 0);
            const price = Number(it.price ?? it.unitPrice ?? 0);
            const lineSub = qty * price;
            const disc = it.discountType === "PERCENT" ? lineSub * ((Number(it.discountValue) || 0) / 100) : Number(it.discountValue ?? it.discount ?? 0);
            return (
              <NexusTableRow key={it.id || idx}>
                <NexusTableCell>
                  <div className="text-white text-[13px] font-bold">{it.name || it.description || "-"}</div>
                  {it.sku && <div className="text-[11px] text-white/40 font-mono">{it.sku}</div>}
                </NexusTableCell>
                <NexusTableCell className="text-right" mono>{qty.toLocaleString()} {it.unit || ""}</NexusTableCell>
                <NexusTableCell className="text-right" mono>{formatCurrency(price)}</NexusTableCell>
                <NexusTableCell className="text-right" mono>{disc > 0 ? formatCurrency(disc) : "-"}</NexusTableCell>
                <NexusTableCell className="text-right text-white" mono>{formatCurrency(Math.max(0, lineSub - disc))}</NexusTableCell>
              </NexusTableRow>
            );
          })}
        </NexusTable>
        {items.length === 0 && <p className="text-[12px] text-white/40">ไม่มีรายการ</p>}
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-4 w-full h-fit">
      <Row label="ยอดก่อนภาษี" value={`${formatCurrency(so.subTotal ?? so.netTotal ?? so.totalRevenue ?? 0)} บาท`} />
      {Number(so.totalDiscount || 0) > 0 && <Row label="ส่วนลดรวม" value={`-${formatCurrency(so.totalDiscount)} บาท`} />}
      <Row label="ภาษีมูลค่าเพิ่ม 7%" value={`${formatCurrency(so.vatAmount ?? 0)} บาท`} />
      <div className="flex justify-between items-end pt-4 border-t border-white/5">
        <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">จำนวนเงินทั้งสิ้น</span>
        <span className="text-3xl font-black font-mono tracking-tighter text-cyan-400">
          {formatCurrency(so.grandTotal ?? so.totalAmount ?? so.totalRevenue ?? 0)} <span className="text-[14px]">THB</span>
        </span>
      </div>
    </GlassCard>
  );

  return <NexusPageLayout header={headerContent} leftContent={leftContent} rightSidebar={rightSidebar} />;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 text-[12px]">
      <span className="text-white/50 font-bold">{label}</span>
      <span className="text-white font-mono font-bold text-right">{value}</span>
    </div>
  );
}

/** ออกใบกำกับภาษี + ใบวางบิลจากใบสั่งขาย ผ่านเซิร์ฟเวอร์ (เลขเรียงต่อเนื่อง ออกได้ครั้งเดียว) */
async function issueTaxInvoiceApi(companyId: string, salesOrderId: string) {
  const res = await apiFetch("/api/sales/tax-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, salesOrderId }) });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "ออกใบกำกับภาษีไม่สำเร็จ");
  return json as { taxInvoiceNo: string; billingNoteNo: string };
}
