"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Activity,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  GlassCard,
  cn 
} from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewPeriodClosePage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState({
    month: "April",
    year: "2026"
  });

  const [checks, setChecks] = useState({
    unpostedJVs: 0,
    unbalancedAccounts: 0,
    pendingTax: true
  });
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
      showAlert(`ล็อกงวดบัญชี ${period.month} ${period.year} สำเร็จ`);
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
              การปิดงวดบัญชี
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              PERIOD-CLOSE
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ตรวจสอบความพร้อมและยืนยันการปิดงวดบัญชีรายเดือน
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
            className={cn("h-8 px-5 font-bold text-xs", isSaving && "opacity-50 pointer-events-none grayscale")} 
            onClick={handleConfirm}
            disabled={isSaving}
          >
            <ShieldCheck size={14} className={cn("mr-1.5", isSaving && "animate-pulse")} />
            {isSaving ? "กำลังล็อก..." : "ยืนยันและล็อก"}
          </PillButton>
        )}
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-12 space-y-12 animate-in fade-in duration-500 min-h-[60vh] flex flex-col justify-center border-white/5 bg-black/20">
        
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
              <Calendar size={32} />
           </div>
           <div>
              <h4 className="text-2xl font-semibold text-white uppercase tracking-tight">ปิดงวดบัญชีรายเดือน</h4>
              <p className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Fiscal Period Execution</p>
           </div>
        </div>

        {step === 1 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto w-full">
            <div className="grid grid-cols-2 gap-8 p-10 rounded-3xl bg-white/[0.02] border border-white/5">
               <Field label="ปีปฏิทิน">
                  <PillSelect value={period.year} onChange={(e) => setPeriod({...period, year: e.target.value})} className="w-full px-6 h-11 font-bold rounded-full">
                    <option>2025</option>
                    <option>2026</option>
                  </PillSelect>
               </Field>
               <Field label="เดือนที่ต้องการปิด">
                  <PillSelect value={period.month} onChange={(e) => setPeriod({...period, month: e.target.value})} className="w-full px-6 text-cyan-400 font-black h-11 rounded-full">
                    <option>January</option>
                    <option>February</option>
                    <option>March</option>
                    <option>April</option>
                    <option>May</option>
                  </PillSelect>
               </Field>
            </div>

            <div className="space-y-6">
               <h5 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">ระบบตรวจสอบความพร้อม (Readiness Check)</h5>
               <div className="space-y-4">
                  <CheckItem label="รายการรายวันที่ยังไม่ผ่านเช็ค" value={checks.unpostedJVs === 0 ? "ผ่าน" : `${checks.unpostedJVs} รายการ`} status={checks.unpostedJVs === 0 ? "pass" : "fail"} />
                  <CheckItem label="ยอดสมดุลผังบัญชี" value={checks.unbalancedAccounts === 0 ? "สมดุล" : "ไม่สมดุล"} status={checks.unbalancedAccounts === 0 ? "pass" : "fail"} />
                  <CheckItem label="รายงานภาษีซื้อ-ขาย" value={checks.pendingTax ? "รอยืนยัน" : "เรียบร้อย"} status="warning" />
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10 max-w-2xl mx-auto w-full">
             <div className="w-32 h-32 rounded-3xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mx-auto shadow-[0_0_24px_rgba(234,179,8,0.15)]">
                <Lock size={64} />
             </div>
             <div className="space-y-6">
                <h4 className="text-3xl font-semibold text-white uppercase tracking-tight">ยืนยันการปิดงวดบัญชี?</h4>
                <p className="text-[14px] text-white/40 font-bold leading-relaxed max-w-lg mx-auto">
                   เมื่อปิดงวดบัญชีแล้ว คุณจะไม่สามารถบันทึกหรือแก้ไขรายการใดๆ ในเดือน <span className="text-cyan-400">{period.month} {period.year}</span> ได้อีกต่อไป 
                   เว้นแต่จะได้รับการอนุมัติปลดล็อกพิเศษจากระดับบริหาร
                </p>
             </div>
          </div>
        )}

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
       <div className="space-y-1 relative z-10 border-b border-white/5 pb-4">
         <p className="text-[12px] font-semibold text-white/20 uppercase tracking-[0.2em]">ลำดับขั้น</p>
         <h5 className="text-sm font-semibold text-white uppercase tracking-tight">Close Process</h5>
       </div>
       
       <div className="space-y-4 relative z-10">
          <div className={cn("p-6 rounded-3xl transition-all border", step === 1 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
             <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest mb-2">Step 1</p>
             <p className="text-[13px] font-bold text-white">ตรวจสอบความถูกต้อง</p>
          </div>
          <div className={cn("p-6 rounded-3xl transition-all border", step === 2 ? "bg-warning/10 border-warning/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
             <p className="text-[11px] font-semibold text-warning uppercase tracking-widest mb-2">Step 2</p>
             <p className="text-[13px] font-bold text-white">ล็อกบัญชีแยกประเภท</p>
          </div>
       </div>

       <div className="space-y-4 pt-8 border-t border-white/5 relative z-10">
          {step === 1 ? (
             <PillButton className="w-full h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-[12px]" onClick={() => setStep(2)}>
                ดำเนินการต่อ <ArrowRight size={16} className="ml-2" />
             </PillButton>
          ) : (
             <div className="space-y-4">
                <PillButton 
                  className={cn("w-full h-11 rounded-full shadow-[0_0_12px_rgba(234,179,8,0.15)] bg-warning/20 text-warning border border-warning/40 uppercase tracking-widest font-black text-[12px] hover:bg-warning/30", isSaving && "opacity-50 pointer-events-none grayscale")} 
                  onClick={handleConfirm}
                  disabled={isSaving}
                >
                   <ShieldCheck size={18} className={cn("mr-2", isSaving && "animate-pulse")} />
                   {isSaving ? "กำลังล็อก..." : "ยืนยันและล็อก"}
                </PillButton>
                <PillButton 
                  variant="glass" 
                  className={cn("w-full h-11 rounded-full text-white/40 hover:text-white uppercase tracking-widest text-[11px]", isSaving && "opacity-50 pointer-events-none")} 
                  onClick={() => setStep(1)}
                  disabled={isSaving}
                >
                   ย้อนกลับ
                </PillButton>
             </div>
          )}
       </div>
       
       <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
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

function CheckItem({ label, value, status }: { label: string, value: string, status: "pass" | "fail" | "warning" }) {
  return (
    <div className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all">
       <div className="flex items-center gap-4">
          {status === "pass" ? <CheckCircle2 className="text-cyan-400" size={24} /> : 
           status === "fail" ? <AlertTriangle className="text-danger" size={24} /> : 
           <Activity className="text-warning" size={24} />}
          <span className="text-[13px] font-bold text-white/70">{label}</span>
       </div>
       <span className={cn(
         "text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border",
         status === "pass" ? "text-cyan-400 border-cyan-500/20 bg-cyan-500/5" :
         status === "fail" ? "text-danger border-danger/20 bg-danger/5" :
         "text-warning border-warning/20 bg-warning/5"
       )}>{value}</span>
    </div>
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
