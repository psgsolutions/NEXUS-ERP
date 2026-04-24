"use client";

import React, { useState } from "react";
import { 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileBarChart,
  Activity
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface PeriodCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
}

export function PeriodCloseModal({ isOpen, onClose, onConfirm }: PeriodCloseModalProps) {
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

  const handleClose = () => {
    onClose();
    setStep(1);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="การปิดงวดบัญชี (FINANCIAL PERIOD CLOSE)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                    <Calendar size={24} />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">ปิดงวดบัญชีรายเดือน</h4>
                    <p className="text-[12px] font-bold text-white/30 uppercase tracking-[0.2em]">Fiscal Period Execution</p>
                 </div>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-8 p-8 rounded-2xl bg-white/[0.02] border border-white/5">
                   <div className="space-y-3">
                      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ปีปฏิทิน (Fiscal Year)</label>
                      <PillSelect value={period.year} onChange={(e) => setPeriod({...period, year: e.target.value})} className="w-full px-6">
                        <option>2025</option>
                        <option>2026</option>
                      </PillSelect>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">เดือนที่ต้องการปิด (Month)</label>
                      <PillSelect value={period.month} onChange={(e) => setPeriod({...period, month: e.target.value})} className="w-full px-6 text-nexus-blue font-black">
                        <option>January</option>
                        <option>February</option>
                        <option>March</option>
                        <option>April</option>
                        <option>May</option>
                      </PillSelect>
                   </div>
                </div>

                <div className="space-y-6">
                   <h5 className="text-[12px] font-black text-white/20 uppercase tracking-widest">ระบบตรวจสอบความพร้อม (System Readiness Check)</h5>
                   <div className="space-y-3">
                      <CheckItem label="รายการรายวันที่ยังไม่ผ่านเช็ค (Unposted JVs)" value={checks.unpostedJVs === 0 ? "ผ่าน" : `${checks.unpostedJVs} รายการ`} status={checks.unpostedJVs === 0 ? "pass" : "fail"} />
                      <CheckItem label="ยอดสมดุลผังบัญชี (Trial Balance)" value={checks.unbalancedAccounts === 0 ? "สมดุล" : "ไม่สมดุล"} status={checks.unbalancedAccounts === 0 ? "pass" : "fail"} />
                      <CheckItem label="รายงานภาษีซื้อ-ขาย (Tax Filing)" value={checks.pendingTax ? "รอยืนยัน" : "เรียบร้อย"} status="warning" />
                   </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10">
                 <div className="w-24 h-24 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mx-auto shadow-neon-warning/20">
                    <Lock size={48} />
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">ยืนยันการปิดงวดบัญชี?</h4>
                    <p className="text-sm text-white/40 font-bold leading-relaxed max-w-md mx-auto">
                       เมื่อปิดงวดบัญชีแล้ว คุณจะไม่สามารถบันทึกหรือแก้ไขรายการใดๆ ในเดือน {period.month} {period.year} ได้อีกต่อไป 
                       เว้นแต่จะได้รับการอนุมัติปลดล็อกพิเศษ
                    </p>
                 </div>
                 <div className="flex flex-col gap-3 max-w-sm mx-auto pt-6">
                    <PillButton className="w-full px-8 shadow-neon-teal" onClick={() => onConfirm(period)}>
                       <ShieldCheck size={20} />
                       ยืนยันและล็อกงวดบัญชี
                    </PillButton>
                    <PillButton variant="glass" className="w-full text-white/20" onClick={() => setStep(1)}>
                       ย้อนกลับไปตรวจสอบ
                    </PillButton>
                 </div>
              </div>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="w-[320px] bg-[#0F0F12] p-12 flex flex-col border-l border-white/5 overflow-y-auto custom-scrollbar">
             <div className="flex-1 space-y-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ลำดับขั้น</p>
                  <h5 className="text-sm font-black text-white uppercase">Close Process</h5>
                </div>
                <div className="space-y-4">
                   <div className="p-4 rounded-2xl bg-nexus-blue/10 border border-nexus-blue/20">
                      <p className="text-[10px] font-black text-nexus-blue uppercase tracking-widest mb-1">Step 1</p>
                      <p className="text-xs font-bold text-white">ตรวจสอบความถูกต้อง</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 opacity-40">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Step 2</p>
                      <p className="text-xs font-bold text-white">ล็อกบัญชีแยกประเภท</p>
                   </div>
                </div>
             </div>
             <PillButton className="w-full px-8 shadow-neon-blue" onClick={() => setStep(2)}>
                ดำเนินการต่อ <ArrowRight size={18} />
             </PillButton>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CheckItem({ label, value, status }: { label: string, value: string, status: "pass" | "fail" | "warning" }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all">
       <div className="flex items-center gap-4">
          {status === "pass" ? <CheckCircle2 className="text-nexus-teal" size={18} /> : 
           status === "fail" ? <AlertTriangle className="text-danger" size={18} /> : 
           <Activity className="text-warning" size={18} />}
          <span className="text-[12px] font-bold text-white/70">{label}</span>
       </div>
       <span className={cn(
         "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border",
         status === "pass" ? "text-nexus-teal border-nexus-teal/20 bg-nexus-teal/5" :
         status === "fail" ? "text-danger border-danger/20 bg-danger/5" :
         "text-warning border-warning/20 bg-warning/5"
       )}>{value}</span>
    </div>
  );
}
