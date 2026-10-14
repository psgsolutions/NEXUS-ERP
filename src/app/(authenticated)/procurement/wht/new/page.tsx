"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, FileText } from "lucide-react";
import { PillButton, PillInput, PillSelect, GlassCard } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { nextDocumentNumber } from "@/lib/sequence-client";
import { useAuth } from "@/context/AuthContext";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewWHTPage() {
  const router = useRouter();
  const { user, companyId: currentCompanyId } = useAuth();

  const { showAlert, showConfirm } = useSystemDialog();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    id: "WHT-NEW",
    expenseId: "",
    baseAmount: 0,
    whtRate: 3,
    taxAmount: 0,
    status: "pending",
    filingDate: new Date().toISOString().split('T')[0]
  });

  // ใบสำคัญจ่ายของบริษัทที่ยังไม่ออก 50 ทวิ
  const { data: expenses } = useRealtimeCollection<any>(`companies/${currentCompanyId}/expenses`);
  const openExpenses = expenses.filter((e: any) => !e.whtId && !e.isSample);

  // ฐานภาษีหัก ณ ที่จ่าย = ยอดก่อน VAT ของใบสำคัญจ่าย (แก้ได้)
  const selectExpense = (id: string) => {
    const exp = openExpenses.find((e: any) => e.id === id);
    const base = Number(exp?.subTotal ?? exp?.netTotal ?? 0) || (Number(exp?.totalAmount || 0) - Number(exp?.vatAmount || 0));
    setForm({ ...form, expenseId: id, baseAmount: Math.max(0, Math.round(base * 100) / 100) });
  };

  const isDirty = form.expenseId !== "" || form.baseAmount > 0;

  const handleBack = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการยกเลิกและย้อนกลับโดยไม่บันทึกหรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleCommit = async () => {
    if (!form.expenseId) return void showAlert("กรุณาระบุอ้างอิงใบสำคัญจ่าย");
    if (form.baseAmount <= 0) return void showAlert("จำนวนเงินต้องมากกว่า 0");
    if (!user || !currentCompanyId) return;

    setIsSubmitting(true);
    try {
      const expense = openExpenses.find((e: any) => e.id === form.expenseId);
      const taxAmount = Math.round(form.baseAmount * (form.whtRate / 100) * 100) / 100;
      const whtId = await nextDocumentNumber("WHT", currentCompanyId);
      const whtData = {
        id: whtId,
        whtId,
        expenseId: form.expenseId,
        expRef: form.expenseId,
        vendor: expense?.supplierName || expense?.vendor || expense?.supplier || "",
        supplierId: expense?.supplierId || "",
        baseAmount: form.baseAmount,
        whtRate: form.whtRate,
        taxAmount,
        status: "pending",
        filingDate: form.filingDate,
        companyId: currentCompanyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        isDeleted: false,
      };
      await setDoc(doc(db, `companies/${currentCompanyId}/withholding_taxes`, whtId), whtData);
      await updateDoc(doc(db, `companies/${currentCompanyId}/expenses`, form.expenseId), { whtId, whtAmount: taxAmount, updatedAt: serverTimestamp() });
      await auditService.logCreate(user.uid, currentCompanyId, "PROCURE_WHT", whtId, whtData);
      
      showAlert("บันทึกหนังสือรับรองการหักภาษี ณ ที่จ่ายเรียบร้อยแล้ว", "System Notification", "info");
      router.push("/procurement?tab=wht");
    } catch (err: any) {
      console.error(err);
      showAlert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, "System Notification", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              หนังสือรับรองการหักภาษี ณ ที่จ่าย
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {form.id || "WHT-50"}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย (มาตรา 50 ทวิ) สำหรับค่าบริการและค่าจ้าง
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <GlassCard accentColor="amber" className="p-10 space-y-12">
        <div className="flex items-center gap-4 border-b border-white/5 pb-8">
          <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white uppercase">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h2>
            <p className="text-[12px] text-white/40 uppercase tracking-widest mt-1">Withholding Tax Certificate</p>
          </div>
        </div>

        <div className="space-y-8 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="เลขที่เอกสาร 50 ทวิ (WHT Document Number)">
              <PillInput value="ออกเลขเมื่อบันทึก" disabled className="w-full h-9 px-6 rounded-full font-mono text-amber-500 border-amber-500/30 bg-white/[0.02]" />
            </Field>
            <Field label="อ้างอิงใบสำคัญจ่าย * (Expense Reference)" required>
              <PillSelect
                value={form.expenseId}
                onChange={(e) => selectExpense(e.target.value)}
                className="w-full h-9 px-6 rounded-full font-mono text-white/90 bg-white/[0.02]"
              >
                <option value="">{openExpenses.length === 0 ? "ไม่มีใบสำคัญจ่ายที่ยังไม่ออก 50 ทวิ" : "เลือกใบสำคัญจ่าย..."}</option>
                {openExpenses.map((exp: any) => (
                  <option key={exp.id} value={exp.id}>{exp.expenseId || exp.id} • {exp.supplierName || exp.vendor || "-"}</option>
                ))}
              </PillSelect>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="จำนวนเงินได้ (บาท) * (Base Amount)" required>
              <PillInput 
                type="number"
                value={form.baseAmount} 
                onChange={(e) => setForm({...form, baseAmount: Number(e.target.value)})}
                className="w-full h-9 px-6 rounded-full font-mono font-bold tracking-tight text-right text-emerald-400 border-emerald-500/30 bg-white/[0.02]" 
              />
            </Field>
            <Field label="อัตราภาษี (%) * (WHT Rate)" required>
              <PillInput 
                type="number"
                value={form.whtRate} 
                onChange={(e) => setForm({...form, whtRate: Number(e.target.value)})}
                className="w-full h-9 px-6 rounded-full font-mono font-bold tracking-tight text-right text-amber-500 border-amber-500/30 bg-white/[0.02]" 
              />
            </Field>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard accentColor="amber" className="p-6 space-y-8 sticky top-0 relative overflow-hidden">
       <div className="space-y-1 border-b border-white/5 pb-4 relative z-10">
         <h5 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2">
           สรุปยอดภาษี (Tax Summary)
         </h5>
       </div>

       <div className="p-6 rounded-3xl bg-black/40 border border-white/5 flex flex-col items-center relative overflow-hidden group">
         <span className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-4 z-10 text-center">ภาษีที่หักและนำส่ง<br/>(Tax Amount)</span>
         <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-neon z-10">
           ฿{((form.baseAmount || 0) * ((form.whtRate || 0)/100)).toLocaleString(undefined, {minimumFractionDigits: 2})}
         </span>
         <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] -translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="space-y-3 pt-4 relative z-10">
        <PillButton 
          className="w-full h-9 px-6 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.15)] bg-amber-500/20 text-amber-500 border border-amber-500/30 font-black uppercase tracking-widest text-[12px]" 
          onClick={handleCommit} 
          disabled={isSubmitting}
        >
          {isSubmitting ? <RefreshCw className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-2" />}
          บันทึกข้อมูลภาษี
        </PillButton>
        <PillButton variant="glass" className="w-full h-9 rounded-full uppercase tracking-widest text-[11px] text-white/40 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
      </div>
      
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
    </GlassCard>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
        <span className="flex items-center">
          {thaiText}
          {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        </span>
        {engText && <span className="text-white/40 font-normal uppercase tracking-widest text-[10px]">{engText}</span>}
      </label>
      {children}
    </div>
  );
}
