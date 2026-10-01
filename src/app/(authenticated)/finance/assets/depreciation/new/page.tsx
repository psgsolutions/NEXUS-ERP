"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Box, 
  Calculator, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  History,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  GlassCard,
  cn 
} from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { where } from "firebase/firestore";
import { formatCurrency } from "@/lib/erp-logic";
import { useAuth } from "@/context/AuthContext";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewAssetDepreciationPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState("เมษายน 2569");
  const { companyId: currentCompanyId } = useAuth();
  
  const { data: assets } = useRealtimeCollection("assets", currentCompanyId ? [where('companyId', '==', currentCompanyId)] : []);

  const totalAssets = assets?.length || 0;
  const totalBookValue = assets?.reduce((sum, a) => sum + (a.netBookValue || 0), 0) || 0;
  
  // Calculate mock monthly depreciation: 1/12 of ((purchasePrice - salvage) / usefulLifeYears)
  const depreciationAmount = assets?.reduce((sum, a) => {
     if (a.usefulLifeYears > 0) {
        return sum + (((a.purchasePrice || 0) - (a.salvageValue || 0)) / a.usefulLifeYears) / 12;
     }
     return sum;
  }, 0) || 0;

  const assetSummary = {
    totalAssets,
    totalBookValue,
    depreciationAmount,
    accountsAffected: totalAssets > 0 ? 2 : 0
  };
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = async () => {
    if (step > 1) {
      if (await showConfirm("คุณกำลังทำรายการค้างอยู่ ต้องการยกเลิกและย้อนกลับหรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleConfirm = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showAlert(`ประมวลผลค่าเสื่อมราคางวด ${period} สำเร็จ`);
      router.push("/finance");
    }, 1500);
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
              ระบบคำนวณค่าเสื่อมราคาสินทรัพย์
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              ASSET-DEP
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            คำนวณและบันทึกบัญชีค่าเสื่อมราคาสินทรัพย์รายงวดอัตโนมัติตามมาตรฐานบัญชี
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        {step === 1 ? (
          <PillButton variant="primary" className="h-8 px-5 font-bold text-xs" onClick={() => setStep(2)}>
            ดำเนินการต่อ <ArrowRight size={14} className="ml-1.5" />
          </PillButton>
        ) : (
          <PillButton 
            variant="confirm"
            className="h-8 px-5 font-bold text-xs" 
            onClick={handleConfirm}
            disabled={isSaving}
          >
            <ShieldCheck size={14} className={cn("mr-1.5", isSaving && "animate-pulse")} />
            {isSaving ? "กำลังประมวลผล..." : "ยืนยันการประมวลผล"}
          </PillButton>
        )}
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-12 space-y-12 min-h-[60vh] flex flex-col justify-center border-white/5 bg-black/20">
        
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shadow-[0_0_24px_rgba(234,179,8,0.15)]">
              <TrendingDown size={32} />
           </div>
           <div>
              <h4 className="text-2xl font-semibold text-white uppercase tracking-tight">ประมวลผลค่าเสื่อมราคาประจำเดือน</h4>
              <p className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Automated Depreciation Posting</p>
           </div>
        </div>

        {step === 1 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-8 p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
               <Field label="งวดบัญชี * (Accounting Period)">
                  <PillSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full px-6 h-9 rounded-full font-bold">
                    <option>เมษายน 2569</option>
                    <option>พฤษภาคม 2569</option>
                  </PillSelect>
               </Field>
               <Field label="จำนวนสินทรัพย์ที่รอประมวลผล (Pending Assets)">
                  <div className="h-9 px-6 rounded-full bg-white/5 border border-white/10 flex items-center text-sm font-bold text-white w-full">
                     {assetSummary.totalAssets} รายการ
                  </div>
               </Field>
            </div>

            <div className="space-y-8">
               <h5 className="text-[14px] font-semibold text-white/40 uppercase tracking-widest ml-1">ประมาณการค่าเสื่อมราคา (Depreciation Estimate)</h5>
               <div className="p-10 rounded-[3.5rem] bg-white/[0.02] border border-white/5 space-y-10">
                  <div className="flex justify-between items-end">
                     <div className="space-y-2">
                        <p className="text-[12px] font-semibold text-white/40 uppercase tracking-[0.2em]">ยอดค่าเสื่อมรวบรวมงวดนี้</p>
                        <p className="text-5xl font-black text-warning drop-shadow-[0_0_15px_rgba(234,179,8,0.2)] font-mono tracking-tight">{formatCurrency(assetSummary.depreciationAmount)}</p>
                     </div>
                     <div className="text-right space-y-2">
                        <p className="text-[12px] font-semibold text-white/40 uppercase tracking-[0.2em]">มูลค่าทางบัญชีรวมหลังหัก</p>
                        <p className="text-2xl font-black text-white/80 font-mono tracking-tight">{formatCurrency(assetSummary.totalBookValue - assetSummary.depreciationAmount)}</p>
                     </div>
                  </div>
                  
                  <div className="pt-10 border-t border-white/5 grid grid-cols-2 gap-6 text-[12px] font-bold text-white/50 uppercase tracking-widest">
                     <div className="flex items-center gap-3"><CheckCircle2 className="text-cyan-400" size={18} /> คำนวณแบบเส้นตรง (Straight Line)</div>
                     <div className="flex items-center gap-3"><CheckCircle2 className="text-cyan-400" size={18} /> บันทึกสมุดรายวัน JV อัตโนมัติ</div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10 w-full max-w-2xl mx-auto">
             <div className="w-32 h-32 rounded-[2.5rem] bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mx-auto shadow-[0_0_24px_rgba(234,179,8,0.15)]">
                <History size={64} />
             </div>
             <div className="space-y-6">
                <h4 className="text-3xl font-semibold text-white uppercase tracking-tight">ยืนยันการบันทึกค่าเสื่อมราคา?</h4>
                <p className="text-[14px] text-white/40 font-bold leading-relaxed max-w-lg mx-auto">
                   ระบบจะทำการสร้างรายการบัญชี เพื่อบันทึกค่าใช้จ่ายค่าเสื่อมราคา และลดยอดสินทรัพย์สะสมในฐานข้อมูลหลักอย่างถาวร
                </p>
             </div>
          </div>
        )}

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
       <div className="space-y-1 border-b border-white/5 pb-4 relative z-10">
         <h5 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2">
           Account Matrix
         </h5>
       </div>
       <div className="space-y-4 relative z-10">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
             <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest mb-2">Debit (+Expense)</p>
             <p className="text-[13px] font-bold text-white">5121-00 ค่าเสื่อมราคา</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
             <p className="text-[11px] font-black text-danger uppercase tracking-widest mb-2">Credit (-Asset)</p>
             <p className="text-[13px] font-bold text-white">1591-00 ค่าเสื่อมสะสม</p>
          </div>
       </div>

       <div className="space-y-4 pt-4 relative z-10">
          {step === 1 ? (
             <PillButton className="w-full h-11 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-black uppercase tracking-[0.2em] text-[12px] hover:bg-cyan-500/20" onClick={() => setStep(2)}>
                ดำเนินการต่อ <ArrowRight size={16} className="ml-2" />
             </PillButton>
          ) : (
             <div className="space-y-4">
                <PillButton 
                  className={cn("w-full h-11 px-6 rounded-full shadow-[0_0_12px_rgba(234,179,8,0.15)] bg-warning/20 hover:bg-warning/30 border border-warning/40 text-warning uppercase tracking-widest font-black text-[12px]", isSaving && "opacity-50 pointer-events-none grayscale")} 
                  onClick={handleConfirm}
                  disabled={isSaving}
                >
                   <ShieldCheck size={16} className={cn("mr-2", isSaving && "animate-pulse")} />
                   {isSaving ? "กำลังประมวลผล..." : "ยืนยันการประมวลผล"}
                </PillButton>
                <PillButton 
                  variant="glass" 
                  className={cn("w-full h-11 px-6 rounded-full text-white/40 hover:text-white uppercase tracking-widest text-[11px]", isSaving && "opacity-50 pointer-events-none")} 
                  onClick={() => setStep(1)}
                  disabled={isSaving}
                >
                   ย้อนกลับไปตรวจสอบ
                </PillButton>
             </div>
          )}
       </div>
       <div className="absolute bottom-0 right-0 w-48 h-48 bg-warning/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
    </div>
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
