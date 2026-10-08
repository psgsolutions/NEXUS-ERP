"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileCheck2, Loader2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { expenseAccountOf } from "@/lib/payables";

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TaxInvoiceForm() {
  const router = useRouter();
  const expenseId = useSearchParams()?.get("expense") || "";
  const { companyId, role } = useAuth();
  const canSave = can(role, "finance:edit");
  const { data: e, loading } = useRealtimeDocument<any>(companyId && expenseId ? `companies/${companyId}/expenses/${expenseId}` : null);

  const [taxInvoiceNo, setTaxInvoiceNo] = useState("");
  const [taxInvoiceDate, setTaxInvoiceDate] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const view = useMemo(() => {
    if (!e) return null;
    const total = Number(e.totalAmount) || 0;
    const vat = Number(e.vatAmount) || 0;
    const preVat = Number(e.subTotal ?? total - vat) || 0;
    const isPo = !!e.poRef && e.documentType !== "ExpenseClaim";
    const acct = expenseAccountOf(e);
    const lines = isPo
      ? [{ dr: true, label: "1151-00 ภาษีซื้อ", amt: vat }, { dr: false, label: "2111-00 เจ้าหนี้การค้า", amt: vat }]
      : [
          { dr: true, label: `${acct.code} ${acct.name}`, amt: preVat },
          ...(vat > 0 ? [{ dr: true, label: "1151-00 ภาษีซื้อ", amt: vat }] : []),
          { dr: false, label: "2111-00 เจ้าหนี้การค้า", amt: preVat + vat },
        ];
    return { total, vat, preVat, isPo, lines, docNo: e.expenseId || expenseId, payee: e.supplierName || e.vendor || e.employeeName || "-" };
  }, [e, expenseId]);

  const blocked = !e ? null
    : e.isSample ? "เอกสารตัวอย่าง บันทึกไม่ได้"
    : e.apPosted ? `บันทึกใบกำกับภาษีซื้อแล้ว (${e.supplierTaxInvoiceNo || "-"} วันที่ ${e.supplierTaxInvoiceDate || "-"})`
    : (Number(e.paidAmount) || 0) > 0 ? "มีการจ่ายเงินไปแล้ว ภาษีซื้อถูกบันทึกพร้อมการจ่าย"
    : view?.isPo && (view?.vat || 0) <= 0 ? "รายการนี้ไม่มีภาษีมูลค่าเพิ่ม"
    : null;

  const save = async () => {
    setMessage(null);
    if (!taxInvoiceNo.trim()) return setMessage({ text: "กรุณาระบุเลขที่ใบกำกับภาษี", error: true });
    setSaving(true);
    try {
      const res = await apiFetch("/api/finance/purchase-tax-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, expenseDocId: expenseId, taxInvoiceNo, taxInvoiceDate, supplierTaxId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMessage({ text: `บันทึกใบกำกับภาษีซื้อของ ${data.expenseNo} แล้ว ภาษีซื้อ ฿${baht(data.vat)}` });
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2"><FileCheck2 size={22} className="text-nexus-teal" /> บันทึกรับใบกำกับภาษีซื้อ</h1>
          <p className="text-sm text-white/60 mt-1">ตั้งหนี้และภาษีซื้อตามวันที่ในใบกำกับภาษีของผู้จำหน่าย (เข้า ภ.พ.30 เดือนที่ถูกต้อง)</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PillButton variant="glass" onClick={() => router.back()} className="h-9 px-4 text-xs font-bold text-white/60">ยกเลิก</PillButton>
        <PillButton variant="confirm" onClick={save} disabled={saving || !canSave || !!blocked || !e} className="h-9 px-5 text-xs font-bold">
          {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> กำลังบันทึก...</> : "บันทึกใบกำกับภาษี"}
        </PillButton>
      </div>
    </div>
  );

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60">{k}</span>
      <span className="text-[13px] text-white text-right">{v}</span>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      {message && <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{message.text}</div>}
      {!expenseId && <GlassCard className="p-6 text-sm text-white/60">เลือกรายการจากแท็บค่าใช้จ่ายในหน้า <Link href="/procurement" className="text-nexus-teal underline">จัดซื้อ</Link></GlassCard>}
      {expenseId && !loading && !e && <GlassCard className="p-6 text-sm text-white/60">ไม่พบรายการค่าใช้จ่ายนี้</GlassCard>}
      {blocked && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">{blocked}</div>}
      {e && view && (
        <>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-2">รายการที่ตั้งหนี้</h3>
            {row("เลขที่เอกสาร", <span className="font-mono text-nexus-teal">{view.docNo}</span>)}
            {row("ผู้จำหน่าย / ผู้รับเงิน", view.payee)}
            {row("ที่มา", view.isPo ? `ซื้อตาม ${e.poRef}` : e.documentType === "ExpenseClaim" ? "เบิกค่าใช้จ่ายพนักงาน" : "ค่าใช้จ่าย")}
            {row("ยอดก่อนภาษี", <span className="font-mono">{baht(view.preVat)}</span>)}
            {row("ภาษีมูลค่าเพิ่ม", <span className="font-mono">{baht(view.vat)}</span>)}
            {row("ยอดรวม", <span className="font-mono font-bold">{baht(view.total)}</span>)}
          </GlassCard>
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">ข้อมูลใบกำกับภาษี</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 ml-1">เลขที่ใบกำกับภาษี <span className="text-danger">*</span></label>
                <PillInput value={taxInvoiceNo} onChange={(ev) => setTaxInvoiceNo(ev.target.value)} placeholder="ตามใบกำกับของผู้จำหน่าย" className="w-full h-9 text-sm" disabled={!!blocked} />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 ml-1">วันที่ในใบกำกับ <span className="text-danger">*</span></label>
                <PillInput type="date" value={taxInvoiceDate} onChange={(ev) => setTaxInvoiceDate(ev.target.value)} className="w-full h-9 text-sm font-mono" disabled={!!blocked} />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-white/70 ml-1">เลขประจำตัวผู้เสียภาษีผู้จำหน่าย</label>
                <PillInput value={supplierTaxId} onChange={(ev) => setSupplierTaxId(ev.target.value.replace(/\D/g, "").slice(0, 13))} placeholder="13 หลัก (ถ้ามี)" className="w-full h-9 text-sm font-mono" disabled={!!blocked} />
              </div>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );

  const right = (
    <div className="p-4">
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-white mb-2">รายการบัญชีที่จะบันทึก</h4>
        <div className="space-y-1.5 text-[12px]">
          {(view?.lines || []).map((l) => (
            <div key={l.label + l.dr} className={cn("flex justify-between gap-2", !l.dr && "pl-4")}>
              <span className="text-white/70">{l.dr ? "Dr" : "Cr"} {l.label}</span>
              <span className="font-mono text-white">{baht(l.amt)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/40 mt-2">ลงวันที่ตามใบกำกับ · บันทึกเป็นรายการรออนุมัติลงบัญชี · ตอนจ่ายเงินจะล้างเจ้าหนี้เต็มจำนวน</p>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} rightSidebar={right} />;
}

export default function PurchaseTaxInvoicePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50 text-sm">กำลังโหลด...</div>}>
      <TaxInvoiceForm />
    </Suspense>
  );
}
