"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Wallet, 
  Calculator, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Users,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  NexusDataField,
  GlassCard,
  cn 
} from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewPayrollPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState("เมษายน 2569");

  const { data: employees } = useRealtimeCollection("employees");

  const employeeCount = employees?.length || 0;
  const baseSalary = employees?.reduce((sum, emp) => sum + (emp.salary || 0), 0) || 0;
  const overtime = 0; // Requires attendance logic, keeping 0 for now
  
  const socialSecurity = employees?.reduce((sum, emp) => sum + Math.min((emp.salary || 0) * 0.05, 750), 0) || 0;
  const tax = baseSalary * 0.03; // Mock flat 3% tax
  
  const netPayout = baseSalary + overtime - socialSecurity - tax;

  const payrollData = {
    employeeCount,
    baseSalary,
    overtime,
    socialSecurity,
    tax,
    netPayout
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
    showAlert("ระบบกำลังประมวลผลการจ่ายเงินเดือนประจำงวด");
    router.push("/hr");
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-0.5">HR_PAYROLL_V4.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">ประมวลผลเงินเดือนดิจิทัล (Payroll)</h1>
            <DocumentStepper steps={["Review", "Posted"]} currentStep={step - 1} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
         {step === 1 ? (
            <PillButton className="h-9 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-black text-[12px] hover:bg-cyan-500/20" onClick={() => setStep(2)}>
               ตรวจสอบความถูกต้อง <ArrowRight size={14} className="ml-2" />
            </PillButton>
         ) : (
            <PillButton 
              className="h-9 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-[12px] font-black"
              onClick={handleConfirm}
            >
               <ShieldCheck size={14} className="mr-2" />
               ยืนยันโอนเงิน
            </PillButton>
         )}
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <GlassCard className="p-12 space-y-12 animate-in fade-in duration-500 min-h-[60vh] border-white/5 bg-black/20">
        
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shadow-[0_0_24px_rgba(6,182,212,0.15)]">
              <Calculator size={32} />
           </div>
           <div>
              <h4 className="text-2xl font-black text-white uppercase tracking-tight">ประมวลผลเงินเดือนประจำงวด</h4>
              <p className="text-[12px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Automated Salary Calculation</p>
           </div>
        </div>

        {step === 1 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-8 p-8 rounded-3xl bg-white/[0.02] border border-white/5">
               <Field label="งวดการจ่าย (Payment Period)">
                  <PillSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full h-9 px-6 rounded-full font-bold">
                    <option>เมษายน 2569</option>
                    <option>พฤษภาคม 2569</option>
                  </PillSelect>
               </Field>
               <Field label="จำนวนพนักงานที่ร่วมรายการ (Total Employees)">
                  <div className="h-9 px-6 rounded-full bg-white/5 border border-white/10 flex items-center text-sm font-bold text-white w-full">
                     {payrollData.employeeCount} คน (ทั้งหมด)
                  </div>
               </Field>
            </div>

            <div className="grid grid-cols-3 gap-6">
               <SummaryCard icon={<Users size={20} />} label="พนักงาน" value={`${payrollData.employeeCount} คน`} />
               <SummaryCard icon={<TrendingUp size={20} />} label="เงินเดือนฐานรวม" value={formatCurrency(payrollData.baseSalary)} />
               <SummaryCard icon={<TrendingUp size={20} />} label="OT รวม" value={formatCurrency(payrollData.overtime)} color="text-cyan-400" />
            </div>

            <div className="space-y-6">
               <h5 className="text-[13px] font-black text-white/20 uppercase tracking-widest ml-1">รายการหัก (Deductions)</h5>
               <div className="grid grid-cols-2 gap-6">
                   <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-white/40">ประกันสังคม</span>
                      <span className="text-lg font-black text-danger font-mono">-{formatCurrency(payrollData.socialSecurity)}</span>
                   </div>
                   <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-white/40">ภาษีหัก ณ ที่จ่าย (PND1)</span>
                      <span className="text-lg font-black text-danger font-mono">-{formatCurrency(payrollData.tax)}</span>
                   </div>
               </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 py-6">
             <div className="p-16 rounded-[2.5rem] bg-cyan-500/5 border border-cyan-500/20 text-center space-y-8 relative overflow-hidden">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-cyan-400 mx-auto relative z-10">
                   <CheckCircle2 size={48} />
                </div>
                <div className="space-y-2 relative z-10">
                   <h4 className="text-3xl font-black text-white uppercase tracking-tight">ยืนยันยอดจ่ายสุทธิประจำงวด</h4>
                    <p className="text-5xl font-black text-cyan-400 font-mono drop-shadow-[0_0_15px_rgba(6,182,212,0.2)] mt-6 tracking-tight">
                       {formatCurrency(payrollData.netPayout)}
                    </p>
                </div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,163,204,0.1)_0%,transparent_50%)] pointer-events-none" />
             </div>

             <div className="grid grid-cols-2 gap-12">
                <div className="space-y-6">
                   <h5 className="text-[13px] font-black text-white/30 uppercase tracking-widest">การตรวจสอบความถูกต้อง (Verifications)</h5>
                   <div className="space-y-4">
                      <CheckItem label="ยอดเงินในบัญชีบริษัทเพียงพอ" status="pass" />
                      <CheckItem label="ข้อมูลตอกบัตรครบถ้วน" status="pass" />
                      <CheckItem label="รายการโอทีผ่านการอนุมัติแล้ว" status="pass" />
                   </div>
                </div>
                <div className="space-y-6">
                   <h5 className="text-[13px] font-black text-white/30 uppercase tracking-widest">ขั้นตอนถัดไป (Next Steps)</h5>
                   <ul className="space-y-4 text-[13px] text-white/50 font-bold">
                      <li className="flex items-center gap-3"><ArrowRight size={16} className="text-cyan-400" /> สร้างไฟล์ K-Cash Connect / SMART</li>
                      <li className="flex items-center gap-3"><ArrowRight size={16} className="text-cyan-400" /> ส่งสลิปเงินเดือนเข้า Mobile App</li>
                      <li className="flex items-center gap-3"><ArrowRight size={16} className="text-cyan-400" /> บันทึกสมุดรายวันจ่าย อัตโนมัติ</li>
                   </ul>
                </div>
             </div>
          </div>
        )}

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 space-y-8 sticky top-0 bg-[#111111] shadow-2xl border-white/5 rounded-3xl overflow-hidden">
      <div className="space-y-1 relative z-10 border-b border-white/5 pb-4">
        <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">ลำดับขั้นการประมวลผล</p>
        <h5 className="text-sm font-black text-white uppercase tracking-tight">Payroll Engine</h5>
      </div>

      <div className="space-y-4 relative z-10">
         <div className={cn("p-4 rounded-3xl border transition-all", step === 1 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Step 1</p>
            <p className="text-xs font-bold text-white uppercase tracking-widest">คำนวณยอดดิบ</p>
         </div>
         <div className={cn("p-4 rounded-3xl border transition-all", step === 2 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Step 2</p>
            <p className="text-xs font-bold text-white uppercase tracking-widest">ตรวจสอบและยืนยัน</p>
         </div>
      </div>

      <div className="pt-8 border-t border-white/5 space-y-4 relative z-10">
         <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ข้อมูลสรุปผู้บริหาร</p>
         <NexusDataField label="ยอดจ่ายทั้งหมด" value={formatCurrency(payrollData.netPayout)} highlight />
         <NexusDataField label="ภาษีนำส่ง" value={formatCurrency(payrollData.tax)} />
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
        {step === 1 ? (
           <PillButton className="w-full h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 font-black uppercase tracking-widest border border-cyan-500/30 text-[12px]" onClick={() => setStep(2)}>
              ตรวจสอบความถูกต้อง <ArrowRight size={16} className="ml-2" />
           </PillButton>
        ) : (
           <PillButton 
             className="w-full h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 uppercase font-black tracking-[0.2em] border border-cyan-500/30 text-[12px]"
             onClick={handleConfirm}
           >
              <ShieldCheck size={18} className="mr-2" />
              ยืนยันโอนเงิน
           </PillButton>
        )}
        <PillButton 
          variant="glass" 
          className="w-full h-11 rounded-full text-white/40 hover:text-white uppercase tracking-widest text-[11px]" 
          onClick={handleBack}
        >
           ยกเลิก
        </PillButton>
      </div>
      
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
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

function SummaryCard({ icon, label, value, color = "text-white" }: { icon: React.ReactNode, label: string, value: string, color?: string }) {
  return (
    <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
       <div className="text-white/20">{icon}</div>
       <div>
          <p className="text-[12px] font-black text-white/30 uppercase tracking-widest">{label}</p>
          <p className={cn("text-2xl font-black mt-2 font-mono", color)}>{value}</p>
       </div>
    </div>
  );
}

function CheckItem({ label, status }: { label: string, status: "pass" | "fail" }) {
  return (
    <div className="flex items-center gap-3 text-[13px] font-bold text-white/60">
       {status === "pass" ? <CheckCircle2 className="text-cyan-400" size={18} /> : <AlertCircle className="text-danger" size={18} />}
       <span>{label}</span>
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
