"use client";

import React, { useState } from "react";
import { 
  Lock, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  Banknote,
  ArrowRight,
  Calculator,
  History
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface ShiftCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
}

export function ShiftCloseModal({ isOpen, onClose, onConfirm }: ShiftCloseModalProps) {
  const [step, setStep] = useState(1);
  const [cashInDrawer, setCashInDrawer] = useState("");
  
  const mockSystemData = {
    expectedCash: 45000,
    totalSales: 125400,
    openingCash: 5000
  };

  const handleClose = () => {
    onClose();
    setStep(1);
  };

  const cashDiff = parseFloat(cashInDrawer || "0") - mockSystemData.expectedCash;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="ปิดกะการขายและปิดยอด (SHIFT & PERIOD CLOSE)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20">
                    <Lock size={24} />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">ปิดรอบการขายประจำวัน</h4>
                    <p className="text-[12px] font-bold text-white/30 uppercase tracking-[0.2em]">Terminal Settlement Operation</p>
                 </div>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-6">
                   <h5 className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">1. ตรวจนับเงินสดในลิ้นชัก (Cash Count)</h5>
                   <div className="p-10 rounded-2xl bg-white/[0.02] border border-white/5 space-y-8">
                      <div className="space-y-3">
                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1 text-center block">ระบุจำนวนเงินสดที่นับได้จริง *</label>
                         <PillInput 
                           type="number" 
                           value={cashInDrawer}
                           onChange={(e) => setCashInDrawer(e.target.value)}
                           placeholder="0.00"
                           className="w-full h-16 text-center text-3xl font-black text-nexus-teal mono-numbers bg-black/40 border-white/10 focus:border-nexus-teal/40" 
                         />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ยอดเงินสดในระบบ</p>
                            <p className="text-xl font-black text-white mt-1">฿{mockSystemData.expectedCash.toLocaleString()}</p>
                         </div>
                         <div className={cn(
                           "p-6 rounded-2xl border",
                           cashDiff === 0 ? "bg-nexus-teal/5 border-nexus-teal/20" : "bg-danger/5 border-danger/20"
                         )}>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ผลต่าง (Difference)</p>
                            <p className={cn("text-xl font-black mt-1", cashDiff === 0 ? "text-nexus-teal" : "text-danger")}>
                               {cashDiff > 0 ? "+" : ""}{cashDiff.toLocaleString()}
                            </p>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h5 className="text-[12px] font-black text-white/20 uppercase tracking-widest">ระบบตรวจสอบความพร้อม (Settlement Check)</h5>
                   <div className="space-y-3">
                      <CheckItem label="รายการที่ยังไม่ชำระ (Pending Orders)" value="0 รายการ" status="pass" />
                      <CheckItem label="การซิงค์ข้อมูลกับระบบคลัง (Stock Sync)" value="สมบูรณ์" status="pass" />
                   </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10">
                 <div className="w-24 h-24 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mx-auto shadow-neon-danger/20">
                    <History size={48} />
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">ยืนยันการปิดยอดและส่งข้อมูล?</h4>
                    <p className="text-sm text-white/40 font-bold leading-relaxed max-w-md mx-auto">
                       ระบบจะทำการปิดกะการขายของเครื่อง Terminal 01 และทำการ Post ยอดขายรายวันเข้าสู่ระบบบัญชีและหักสต็อกพัสดุถาวร
                    </p>
                 </div>
                 <div className="flex flex-col gap-3 max-w-sm mx-auto pt-6">
                    <PillButton className="w-full px-8 shadow-neon-danger bg-danger/20 hover:bg-danger/40 border-danger/40 text-danger" onClick={() => onConfirm({ cashInDrawer })}>
                       <ShieldCheck size={20} />
                       ยืนยันปิดยอดประจำวัน
                    </PillButton>
                    <PillButton variant="glass" className="w-full text-white/20" onClick={() => setStep(1)}>
                       ย้อนกลับไปแก้ไข
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
                  <h5 className="text-sm font-black text-white uppercase tracking-tight">Settlement Process</h5>
                </div>
                <div className="space-y-4">
                   <div className="p-4 rounded-2xl bg-danger/10 border border-danger/20">
                      <p className="text-[10px] font-black text-danger uppercase tracking-widest mb-1">Step 1</p>
                      <p className="text-xs font-bold text-white">ตรวจนับเงินสด</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 opacity-40">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Step 2</p>
                      <p className="text-xs font-bold text-white">ส่งข้อมูลเข้าบัญชี</p>
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
           <Calculator className="text-warning" size={18} />}
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
