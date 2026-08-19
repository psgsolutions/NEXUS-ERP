"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  FileText, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  TrendingUp,
  Percent,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  GlassCard,
  cn 
} from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewTaxFilingPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [step, setStep] = useState(1);
  const [taxType, setTaxType] = useState("VAT30");
  const [isSaving, setIsSaving] = useState(false);
  
  const mockTaxData = {
    revenue: 2035000,
    inputTax: 82180,
    outputTax: 142450,
    netPayable: 60270
  };



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
      showAlert(`ยื่นแบบภาษี ${taxType} สำเร็จ`);
      router.push("/finance");
    }, 1500);
  };


  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">TAX_FILING_V2.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">การยื่นแบบและชำระภาษี (Tax Filing)</h1>
            <DocumentStepper steps={["Review", "Filed"]} currentStep={step - 1} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {step === 1 ? (
           <PillButton className="h-9 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] font-black border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-[12px]" onClick={() => setStep(2)}>
              ตรวจสอบความถูกต้อง <ArrowRight size={14} className="ml-2" />
           </PillButton>
        ) : (
           <PillButton 
             className={cn("h-9 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[12px] hover:bg-cyan-500/20", isSaving && "opacity-50 pointer-events-none grayscale")} 
             onClick={handleConfirm}
             disabled={isSaving}
           >
              <ShieldCheck size={14} className={cn("mr-2", isSaving && "animate-pulse")} />
              {isSaving ? "กำลังยื่นแบบ..." : "ยืนยันและส่งแบบ"}
           </PillButton>
        )}
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-12 space-y-12 animate-in fade-in duration-500 min-h-[60vh] flex flex-col justify-center border-white/5 bg-black/20">
        
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
              <Percent size={32} />
           </div>
           <div>
              <h4 className="text-2xl font-black text-white uppercase tracking-tight">ยื่นแบบภาษีประจำงวด</h4>
              <p className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Revenue Department Compliance</p>
           </div>
        </div>

        {step === 1 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-8 p-10 rounded-3xl bg-white/[0.02] border border-white/5">
               <Field label="ประเภทแบบภาษี">
                  <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value)} className="w-full px-6 h-11 rounded-full font-bold">
                    <option value="VAT30">ภ.พ.30 (VAT 7%)</option>
                    <option value="PND3">ภ.ง.ด.3 (WHT Person)</option>
                    <option value="PND53">ภ.ง.ด.53 (WHT Corp)</option>
                  </PillSelect>
               </Field>
               <Field label="งวดบัญชี">
                  <div className="h-11 px-6 rounded-full bg-white/5 border border-white/10 flex items-center text-sm font-bold text-white">
                     เมษายน 2569
                  </div>
               </Field>
            </div>

            <div className="space-y-8">
               <h5 className="text-[11px] font-black text-white/40 uppercase tracking-widest">สรุปรายการภาษี (Tax Summary)</h5>
               <div className="grid grid-cols-2 gap-6">
                  <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
                     <p className="text-[12px] font-black text-white/30 uppercase">ภาษีขาย (Output Tax)</p>
                     <p className="text-3xl font-black text-cyan-400 font-mono">{formatCurrency(mockTaxData.outputTax)}</p>
                  </div>
                  <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
                     <p className="text-[12px] font-black text-white/30 uppercase">ภาษีซื้อ (Input Tax)</p>
                     <p className="text-3xl font-black text-cyan-500 font-mono">{formatCurrency(mockTaxData.inputTax)}</p>
                  </div>
               </div>
               <div className="p-10 rounded-3xl bg-cyan-500/5 border border-cyan-500/20 flex justify-between items-center">
                  <div className="space-y-2">
                     <p className="text-[12px] font-black text-cyan-400 uppercase tracking-widest">ภาษีที่ต้องชำระสุทธิ (Net Payable)</p>
                     <p className="text-5xl font-black text-white mt-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] font-mono tracking-tight">{formatCurrency(mockTaxData.netPayable)}</p>
                  </div>
                  <ShieldCheck size={64} className="text-cyan-500/20" />
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10 w-full max-w-2xl mx-auto">
             <div className="w-32 h-32 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_24px_rgba(6,182,212,0.15)]">
                <FileText size={64} />
             </div>
             <div className="space-y-6">
                <h4 className="text-3xl font-black text-white uppercase tracking-tight">ยืนยันการยื่นแบบภาษี?</h4>
                <p className="text-[14px] text-white/40 font-bold leading-relaxed max-w-lg mx-auto">
                   ระบบจะทำการบันทึกสถานะการยื่นแบบภาษี <span className="text-cyan-400">{taxType}</span> และล็อกรายการภาษีซื้อ-ขายในงวดนี้เพื่อป้องกันการแก้ไขที่ส่งผลต่อการรายงานกรมสรรพากร
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
         <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">ขั้นตอนการดำเนินการ</p>
         <h5 className="text-sm font-black text-white uppercase tracking-tight">Compliance Flow</h5>
       </div>
       
       <div className="space-y-4 relative z-10">
          <div className={cn("p-6 rounded-3xl border transition-all", step === 1 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
             <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest mb-2">Step 1</p>
             <p className="text-[13px] font-bold text-white">ตรวจสอบยอดภาษี</p>
          </div>
          <div className={cn("p-6 rounded-3xl border transition-all", step === 2 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
             <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Step 2</p>
             <p className="text-[13px] font-bold text-white">ยื่นแบบออนไลน์</p>
          </div>
       </div>

       <div className="pt-8 border-t border-white/5 space-y-4 relative z-10">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">เอกสารแนบ (Attachments)</p>
          <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[12px] font-bold text-white/60 hover:bg-white/5 transition-all">
             <span>รายงานภาษีขาย.xlsx</span>
             <Download size={16} />
          </button>
          <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[12px] font-bold text-white/60 hover:bg-white/5 transition-all">
             <span>รายงานภาษีซื้อ.xlsx</span>
             <Download size={16} />
          </button>
       </div>

       <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
          {step === 1 ? (
             <PillButton className="w-full h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[12px] hover:bg-cyan-500/30" onClick={() => setStep(2)}>
                ตรวจสอบความถูกต้อง <ArrowRight size={16} className="ml-2" />
             </PillButton>
          ) : (
             <div className="space-y-4">
                <PillButton 
                  className={cn("w-full h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[12px] hover:bg-cyan-500/30", isSaving && "opacity-50 pointer-events-none grayscale")} 
                  onClick={handleConfirm}
                  disabled={isSaving}
                >
                   <ShieldCheck size={18} className={cn("mr-2", isSaving && "animate-pulse")} />
                   {isSaving ? "กำลังยื่นแบบ..." : "ยืนยันและส่งแบบ"}
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
