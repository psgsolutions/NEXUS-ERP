"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { FileText, ShieldCheck, CheckCircle2, Download, ArrowRight, Percent, ArrowLeft, AlertTriangle } from "lucide-react";
import { PillButton, PillSelect, PillInput, GlassCard, NexusTable, NexusTableRow, NexusTableCell, cn } from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { apiFetch } from "@/lib/api-client";
import {
  calculatePP30Tax, fetchWHTTaxRecords, checkTaxFilingExportLock,
  exportPP30ToCSV, exportWHTToCSV, PP30TaxData, WHTTaxRecord, TaxFilingLock,
} from "@/lib/tax-filing-service";

type TaxType = "VAT30" | "PND3" | "PND53";
const TAX_LABEL: Record<TaxType, string> = { VAT30: "ภ.พ.30 (ภาษีมูลค่าเพิ่ม)", PND3: "ภ.ง.ด.3 (หัก ณ ที่จ่าย บุคคลธรรมดา)", PND53: "ภ.ง.ด.53 (หัก ณ ที่จ่าย นิติบุคคล)" };
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

// งวดภาษีที่ยื่นปกติ = เดือนก่อนหน้า
const defaultPeriod = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const periodLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return y && m ? `${THAI_MONTHS[m - 1]} ${y + 543}` : "-";
};

export default function NewTaxFilingPage() {
  const router = useRouter();
  const { showAlert } = useSystemDialog();
  const { user, companyId } = useAuth();

  const [step, setStep] = useState(1);
  const [taxType, setTaxType] = useState<TaxType>("VAT30");
  const [period, setPeriod] = useState(defaultPeriod());
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vat, setVat] = useState<PP30TaxData | null>(null);
  const [wht, setWht] = useState<WHTTaxRecord[]>([]);
  const [lock, setLock] = useState<TaxFilingLock | null>(null);

  // คำนวณจากข้อมูลจริงทุกครั้งที่เปลี่ยนประเภทแบบ/งวด
  useEffect(() => {
    if (!companyId || !/^\d{4}-\d{2}$/.test(period)) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [lockInfo, vatData, whtData] = await Promise.all([
        checkTaxFilingExportLock(companyId, taxType, period),
        taxType === "VAT30" ? calculatePP30Tax(companyId, period) : Promise.resolve(null),
        taxType !== "VAT30" ? fetchWHTTaxRecords(companyId, period, taxType) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setLock(lockInfo);
      setVat(vatData);
      setWht(whtData);
      setLoading(false);
    })().catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [companyId, taxType, period]);

  const whtBase = wht.reduce((s, r) => s + r.baseAmount, 0);
  const whtTotal = wht.reduce((s, r) => s + r.whtAmount, 0);
  const taxDue = taxType === "VAT30" ? (vat?.netVatPayable ?? 0) : whtTotal;
  const baseAmount = taxType === "VAT30" ? (vat?.salesBase ?? 0) : whtBase;

  const downloadCsv = () => {
    const csv = taxType === "VAT30" ? (vat ? exportPP30ToCSV(vat) : "") : exportWHTToCSV(wht, taxType, period);
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${taxType}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    if (!companyId || !user) return;
    setIsSaving(true);
    try {
      // บันทึกที่ server: คำนวณยอดซ้ำจากข้อมูลจริง ล็อกงวด และเก็บประวัติการยื่นในทรานแซกชันเดียว
      const res = await apiFetch("/api/finance/tax-filings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, taxType, period }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      showAlert(`บันทึกการยื่น ${TAX_LABEL[taxType]} งวด ${periodLabel(period)} แล้ว`);
      router.push("/finance");
    } catch (err: any) {
      showAlert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => (step > 1 ? setStep(1) : router.back())} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">การยื่นแบบและชำระภาษี</h1>
          <p className="text-sm text-white/60 font-medium mt-1">คำนวณจากรายการบัญชีและเอกสารภาษีจริงของบริษัท แล้วบันทึกการยื่นเพื่อกันการยื่นซ้ำ</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 font-bold text-xs" onClick={downloadCsv} disabled={loading || (taxType === "VAT30" ? !vat : wht.length === 0)}>
          <Download size={14} className="mr-1.5" /> ดาวน์โหลด CSV
        </PillButton>
        {step === 1 ? (
          <PillButton variant="primary" className="h-8 px-5 font-bold text-xs" onClick={() => setStep(2)} disabled={loading || !!lock}>
            ตรวจสอบและยืนยัน <ArrowRight size={14} className="ml-1.5" />
          </PillButton>
        ) : (
          <PillButton variant="confirm" className={cn("h-8 px-5 font-bold text-xs", isSaving && "opacity-50")} onClick={handleConfirm} disabled={isSaving}>
            <ShieldCheck size={14} className="mr-1.5" /> {isSaving ? "กำลังบันทึก..." : "ยืนยันบันทึกการยื่น"}
          </PillButton>
        )}
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pb-10">
      <GlassCard className="p-6 space-y-6 border-white/5 bg-black/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20"><Percent size={24} /></div>
          <div>
            <h4 className="text-xl font-semibold text-white tracking-tight">ยื่นแบบภาษีประจำงวด</h4>
            <p className="text-[12px] text-white/40">{TAX_LABEL[taxType]} • งวด {periodLabel(period)}</p>
          </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-6">
            <Field label="ประเภทแบบภาษี">
              <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value as TaxType)} className="w-full h-9 px-6 rounded-full font-bold">
                <option value="VAT30">{TAX_LABEL.VAT30}</option>
                <option value="PND3">{TAX_LABEL.PND3}</option>
                <option value="PND53">{TAX_LABEL.PND53}</option>
              </PillSelect>
            </Field>
            <Field label="งวดภาษี (เดือน)">
              <PillInput type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full h-9 px-6 rounded-full font-bold" />
            </Field>
          </div>
        )}

        {lock && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-300 font-bold flex items-center gap-2">
            <AlertTriangle size={14} /> งวดนี้บันทึกการยื่นไปแล้วเมื่อ {new Date(lock.exportedAt).toLocaleString("th-TH")} ยื่นซ้ำไม่ได้
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-white/40">กำลังคำนวณจากข้อมูลจริง...</p>
        ) : taxType === "VAT30" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="ยอดขาย (ฐานภาษีขาย)" value={vat?.salesBase ?? 0} />
              <Stat label="ยอดซื้อ (ฐานภาษีซื้อ)" value={vat?.purchaseBase ?? 0} />
              <Stat label="ภาษีขาย" value={vat?.outputVat ?? 0} accent />
              <Stat label="ภาษีซื้อ" value={vat?.inputVat ?? 0} accent />
            </div>
            <div className="p-6 rounded-3xl bg-cyan-500/5 border border-cyan-500/20 flex justify-between items-center">
              <div>
                <p className="text-[12px] font-semibold text-cyan-400 tracking-widest">{(vat?.netVatPayable ?? 0) >= 0 ? "ภาษีที่ต้องชำระสุทธิ" : "ภาษีชำระเกิน (ขอคืน/ยกไป)"}</p>
                <p className="text-4xl font-black text-white mt-1 font-mono tracking-tight">{formatCurrency(Math.abs(vat?.netVatPayable ?? 0))}</p>
              </div>
              <p className="text-[11px] text-white/40 text-right">จากรายการบัญชี {vat?.journalCount ?? 0} รายการ</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="จำนวนหนังสือรับรอง" value={wht.length} plain />
              <Stat label="รวมเงินได้" value={whtBase} />
              <Stat label="รวมภาษีที่หักนำส่ง" value={whtTotal} accent />
            </div>
            {wht.length === 0 ? (
              <p className="text-[12px] text-white/40">ไม่มีหนังสือรับรองหัก ณ ที่จ่ายประเภทนี้ในงวด {periodLabel(period)}</p>
            ) : (
              <NexusTable headers={["เลขที่", "วันที่", "ผู้ถูกหัก", "เลขผู้เสียภาษี", "เงินได้", "อัตรา", "ภาษีที่หัก"]}>
                {wht.map((r) => (
                  <NexusTableRow key={r.id}>
                    <NexusTableCell className="whitespace-nowrap text-amber-300" mono>{r.docNo}</NexusTableCell>
                    <NexusTableCell className="whitespace-nowrap" mono>{r.date}</NexusTableCell>
                    <NexusTableCell className="text-white">{r.vendorName}</NexusTableCell>
                    <NexusTableCell mono>{r.taxId}</NexusTableCell>
                    <NexusTableCell className="text-right" mono>{formatCurrency(r.baseAmount)}</NexusTableCell>
                    <NexusTableCell className="text-right" mono>{r.whtRate}%</NexusTableCell>
                    <NexusTableCell className="text-right text-white" mono>{formatCurrency(r.whtAmount)}</NexusTableCell>
                  </NexusTableRow>
                ))}
              </NexusTable>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-center space-y-3">
            <FileText size={40} className="mx-auto text-cyan-400" />
            <h4 className="text-xl font-semibold text-white">ยืนยันบันทึกการยื่นแบบ?</h4>
            <p className="text-[13px] text-white/50 max-w-lg mx-auto">
              ระบบจะบันทึกว่ายื่น {TAX_LABEL[taxType]} งวด {periodLabel(period)} แล้ว ยอดภาษี {formatCurrency(taxDue)} บาท และล็อกงวดนี้ไม่ให้ยื่นซ้ำ
              (การยื่นจริงกับกรมสรรพากรทำผ่านระบบ e-Filing โดยใช้ไฟล์ CSV ที่ดาวน์โหลดได้)
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 sticky top-0">
      <p className="text-[12px] font-semibold text-white/40 tracking-widest">ขั้นตอนการดำเนินการ</p>
      <div className={cn("p-4 rounded-2xl border", step === 1 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-50")}>
        <p className="text-[11px] font-semibold text-cyan-400 tracking-widest mb-1">ขั้นที่ 1</p>
        <p className="text-[13px] font-bold text-white">ตรวจสอบยอดภาษี</p>
      </div>
      <div className={cn("p-4 rounded-2xl border", step === 2 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-50")}>
        <p className="text-[11px] font-semibold text-white/40 tracking-widest mb-1">ขั้นที่ 2</p>
        <p className="text-[13px] font-bold text-white flex items-center gap-2">บันทึกการยื่น {lock && <CheckCircle2 size={14} className="text-emerald-400" />}</p>
      </div>
    </div>
  );

  return <NexusPageLayout header={headerContent} leftContent={leftContent} rightSidebar={rightSidebar} />;
}

function Stat({ label, value, accent, plain }: { label: string; value: number; accent?: boolean; plain?: boolean }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
      <p className="text-[12px] font-semibold text-white/40">{label}</p>
      <p className={cn("text-2xl font-black font-mono", accent ? "text-cyan-400" : "text-white")}>{plain ? value.toLocaleString() : formatCurrency(value)}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 ml-1">{label}</label>
      {children}
    </div>
  );
}
