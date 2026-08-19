"use client";

import React, { useState } from "react";
import { 
  Wallet, 
  Calculator, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  TrendingUp,
  FileBarChart,
  Users
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

interface PayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void> | void;
}

export function PayrollModal({ isOpen, onClose, onConfirm }: PayrollModalProps) {
  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState("เมษายน 2569");
  const [isSaving, setIsSaving] = useState(false);
  
  const { data: employees } = useRealtimeCollection("employees");

  const employeeCount = employees?.length || 0;
  const baseSalary = employees?.reduce((sum, emp) => sum + (emp.salary || 0), 0) || 0;
  const overtime = 0; // Requires attendance logic, keeping 0 for now
  
  // Basic Thai payroll calculation
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

  const handleClose = () => {
    onClose();
    setStep(1);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm(payrollData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="ประมวลผลเงินเดือนดิจิทัล"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shadow-neon-teal/20">
                    <Calculator size={24} />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">ประมวลผลเงินเดือนประจำงวด</h4>
                    <p className="text-[12px] font-bold text-white/30 uppercase tracking-[0.2em]">Automated Salary Calculation</p>
                 </div>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-8 p-8 rounded-2xl bg-white/[0.02] border border-white/5">
                   <div className="space-y-3">
                      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">งวดการจ่าย (Payment Period)</label>
                      <PillSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full h-9 px-6 rounded-full">
                        <option>เมษายน 2569</option>
                        <option>พฤษภาคม 2569</option>
                      </PillSelect>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">จำนวนพนักงานที่ร่วมรายการ (Total Employees)</label>
                      <div className="h-9 px-6 rounded-full bg-white/5 border border-white/10 flex items-center text-sm font-bold text-white">
                         {payrollData.employeeCount} คน (ทั้งหมด)
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                   <SummaryCard icon={<Users size={18} />} label="พนักงาน" value={`${payrollData.employeeCount} คน`} />
                   <SummaryCard icon={<TrendingUp size={18} />} label="เงินเดือนฐานรวม" value={`฿${payrollData.baseSalary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                   <SummaryCard icon={<TrendingUp size={18} />} label="OT รวม" value={`฿${payrollData.overtime.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} color="text-nexus-blue" />
                </div>

                <div className="space-y-6">
                   <h5 className="text-[12px] font-black text-white/20 uppercase tracking-widest ml-1">รายการหัก</h5>
                   <div className="grid grid-cols-2 gap-6">
                       <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                          <span className="text-[12px] font-bold text-white/40">ประกันสังคม</span>
                          <span className="text-sm font-black text-danger">-฿{payrollData.socialSecurity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                       </div>
                       <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                          <span className="text-[12px] font-bold text-white/40">ภาษีหัก ณ ที่จ่าย (PND1)</span>
                          <span className="text-sm font-black text-danger">-฿{payrollData.tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                       </div>
                   </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 py-6">
                 <div className="p-12 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/20 text-center space-y-6">
                    <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center text-nexus-teal mx-auto">
                       <CheckCircle2 size={40} />
                    </div>
                    <div className="space-y-2">
                       <h4 className="text-2xl font-black text-white uppercase tracking-tight">ยืนยันยอดจ่ายสุทธิประจำงวด</h4>
                        <p className="text-4xl font-black text-nexus-teal mono-numbers drop-shadow-neon mt-4">
                           ฿{payrollData.netPayout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h5 className="text-[12px] font-black text-white/20 uppercase tracking-widest">การตรวจสอบความถูกต้อง</h5>
                       <div className="space-y-2">
                          <CheckItem label="ยอดเงินในบัญชีบริษัทเพียงพอ" status="pass" />
                          <CheckItem label="ข้อมูลตอกบัตรครบถ้วน" status="pass" />
                          <CheckItem label="รายการโอทีผ่านการอนุมัติแล้ว" status="pass" />
                       </div>
                    </div>
                    <div className="space-y-4">
                       <h5 className="text-[12px] font-black text-white/20 uppercase tracking-widest">ขั้นตอนถัดไป</h5>
                       <ul className="space-y-2 text-[12px] text-white/40 font-bold">
                          <li className="flex items-center gap-2"><ArrowRight size={14} className="text-nexus-teal" /> สร้างไฟล์ K-Cash Connect / SMART</li>
                          <li className="flex items-center gap-2"><ArrowRight size={14} className="text-nexus-teal" /> ส่งสลิปเงินเดือนเข้า Mobile App</li>
                          <li className="flex items-center gap-2"><ArrowRight size={14} className="text-nexus-teal" /> บันทึกสมุดรายวันจ่าย อัตโนมัติ</li>
                       </ul>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-[380px] bg-[#0F0F12] p-12 flex flex-col border-l border-white/5">
           <div className="flex-1 space-y-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ลำดับขั้นการประมวลผล</p>
                <h5 className="text-sm font-black text-white uppercase tracking-tight">Payroll Engine</h5>
              </div>
              <div className="space-y-4">
                 <div className={cn("p-4 rounded-2xl border transition-all", step === 1 ? "bg-nexus-teal/10 border-nexus-teal/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
                    <p className="text-[10px] font-black text-nexus-teal uppercase tracking-widest mb-1">Step 1</p>
                    <p className="text-xs font-bold text-white">คำนวณยอดดิบ</p>
                 </div>
                 <div className={cn("p-4 rounded-2xl border transition-all", step === 2 ? "bg-nexus-teal/10 border-nexus-teal/20" : "bg-white/[0.02] border-white/5 opacity-40")}>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Step 2</p>
                    <p className="text-xs font-bold text-white">ตรวจสอบและยืนยัน</p>
                 </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-4">
                 <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ข้อมูลสรุปผู้บริหาร</p>
                 <NexusDataField label="ยอดจ่ายทั้งหมด" value={`฿${payrollData.netPayout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} highlight />
                 <NexusDataField label="ภาษีนำส่ง" value={`฿${payrollData.tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
              </div>
           </div>

           <div className="space-y-4">
             {step === 1 ? (
                <PillButton className="w-full shadow-neon-blue" onClick={() => setStep(2)}>
                   ตรวจสอบความถูกต้อง <ArrowRight size={18} />
                </PillButton>
             ) : (
                <PillButton 
                  className={cn("w-full shadow-neon-teal uppercase tracking-[0.2em]", isSaving && "opacity-50 pointer-events-none")} 
                  onClick={handleConfirm}
                  disabled={isSaving}
                >
                   <ShieldCheck size={22} className={isSaving ? "animate-pulse" : ""} />
                   {isSaving ? "กำลังประมวลผล..." : "ยืนยันโอนเงิน"}
                </PillButton>
             )}
             <PillButton 
               variant="ghost" 
               className={cn("w-full text-white/20 hover:text-white uppercase tracking-widest", isSaving && "opacity-50 pointer-events-none")} 
               onClick={handleClose}
               disabled={isSaving}
             >
                ยกเลิก
             </PillButton>
           </div>
        </div>
      </div>
    </Modal>
  );
}

function SummaryCard({ icon, label, value, color = "text-white" }: { icon: React.ReactNode, label: string, value: string, color?: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
       <div className="text-white/20">{icon}</div>
       <div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</p>
          <p className={cn("text-lg font-black mt-1", color)}>{value}</p>
       </div>
    </div>
  );
}

function CheckItem({ label, status }: { label: string, status: "pass" | "fail" }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-bold text-white/60">
       {status === "pass" ? <CheckCircle2 className="text-nexus-teal" size={14} /> : <AlertCircle className="text-danger" size={14} />}
       <span>{label}</span>
    </div>
  );
}
