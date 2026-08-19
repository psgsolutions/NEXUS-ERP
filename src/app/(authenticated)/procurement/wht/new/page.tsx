"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, FileText } from "lucide-react";
import { PillButton, PillInput, GlassCard } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { doc, collection, setDoc, serverTimestamp } from "firebase/firestore";
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
      const taxAmount = form.baseAmount * (form.whtRate / 100);
      const whtRef = doc(collection(db, "withholding_taxes"));
      const whtData = {
        ...form,
        taxAmount,
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
      };
      await setDoc(whtRef, whtData);
      await auditService.logCreate(user.uid, currentCompanyId, "PROCURE_WHT", "NEW", whtData);
      
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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-0.5">Withholding Tax</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">หัก ณ ที่จ่าย (50 ทวิ)</h1>
          </div>
        </div>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <GlassCard className="p-10 space-y-12 bg-black/20 border-white/5">
        <div className="flex items-center gap-4 border-b border-white/5 pb-8">
          <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h2>
            <p className="text-[12px] text-white/40 uppercase tracking-widest mt-1">Withholding Tax Certificate</p>
          </div>
        </div>

        <div className="space-y-8 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="เลขที่เอกสาร 50 ทวิ (WHT Document Number)">
              <PillInput value={form.id || "-"} disabled className="w-full h-9 px-6 rounded-full font-mono text-amber-500 border-amber-500/30 bg-white/[0.02]" />
            </Field>
            <Field label="อ้างอิงใบสำคัญจ่าย * (Expense Reference)" required>
              <PillInput 
                value={form.expenseId} 
                onChange={(e) => setForm({...form, expenseId: e.target.value})}
                placeholder="เช่น EXP-2604-001..."
                className="w-full h-9 px-6 rounded-full font-mono text-white/90 bg-white/[0.02]" 
              />
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
    <GlassCard className="p-6 border-white/5 bg-[#111111] shadow-2xl space-y-8 sticky top-0 relative overflow-hidden rounded-3xl">
       <div className="space-y-1 border-b border-white/5 pb-4 relative z-10">
         <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
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
