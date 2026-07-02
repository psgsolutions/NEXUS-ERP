"use client";

import React, { useState } from "react";
import { 
  FileText, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  TrendingUp,
  Percent
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface TaxFilingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void> | void;
}

export function TaxFilingModal({ isOpen, onClose, onConfirm }: TaxFilingModalProps) {
  const [step, setStep] = useState(1);
  const [taxType, setTaxType] = useState("VAT30");
  const [isSaving, setIsSaving] = useState(false);
  
  const mockTaxData = {
    revenue: 2035000,
    inputTax: 82180,
    outputTax: 142450,
    netPayable: 60270
  };

  const handleClose = () => {
    if (isSaving) return;
    onClose();
    setStep(1);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const filing = {
        type: taxType,
        month: new Date().toISOString().slice(0, 7),
        data: mockTaxData
      };
      await onConfirm(filing);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="การยื่นแบบและชำระภาษี (TAX FILING & SETTLEMENT)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                    <Percent size={24} />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">ยื่นแบบภาษีประจำงวด</h4>
                    <p className="text-[12px] font-bold text-white/30 uppercase tracking-[0.2em]">Revenue Department Compliance</p>
                 </div>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-8 p-8 rounded-2xl bg-white/[0.02] border border-white/5">
                   <div className="space-y-3">
                      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ประเภทแบบภาษี</label>
                      <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value)} className="w-full px-6">
                        <option value="VAT30">ภ.พ.30 (VAT 7%)</option>
                        <option value="PND3">ภ.ง.ด.3 (WHT Person)</option>
                        <option value="PND53">ภ.ง.ด.53 (WHT Corp)</option>
                      </PillSelect>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">งวดบัญชี</label>
                      <div className="h-11 px-6 rounded-2xl bg-white/5 border border-white/10 flex items-center text-sm font-bold text-white">
                         เมษายน 2569
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h5 className="text-[12px] font-black text-white/20 uppercase tracking-widest">สรุปรายการภาษี</h5>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                         <p className="text-[10px] font-black text-white/20 uppercase">ภาษีขาย</p>
                         <p className="text-xl font-black text-nexus-blue">฿{mockTaxData.outputTax.toLocaleString()}</p>
                      </div>
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                         <p className="text-[10px] font-black text-white/20 uppercase">ภาษีซื้อ</p>
                         <p className="text-xl font-black text-nexus-teal">฿{mockTaxData.inputTax.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="p-8 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/20 flex justify-between items-center">
                      <div>
                         <p className="text-[11px] font-black text-nexus-blue uppercase tracking-widest">ภาษีที่ต้องชำระสุทธิ</p>
                         <p className="text-3xl font-black text-white mt-1">฿{mockTaxData.netPayable.toLocaleString()}</p>
                      </div>
                      <ShieldCheck size={48} className="text-nexus-blue/20" />
                   </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10">
                 <div className="w-24 h-24 rounded-2xl bg-nexus-blue/10 border border-nexus-blue/20 flex items-center justify-center text-nexus-blue mx-auto shadow-neon-blue/20">
                    <FileText size={48} />
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">ยืนยันการยื่นแบบภาษี?</h4>
                    <p className="text-sm text-white/40 font-bold leading-relaxed max-w-md mx-auto">
                       ระบบจะทำการบันทึกสถานะการยื่นแบบภาษี {taxType} และล็อกรายการภาษีซื้อ-ขายในงวดนี้เพื่อป้องกันการแก้ไขที่ส่งผลต่อการรายงานกรมสรรพากร
                    </p>
                 </div>
                 <div className="flex flex-col gap-3 max-w-sm mx-auto pt-6">
                    <PillButton 
                      className={cn("w-full px-8 shadow-neon-blue", isSaving && "opacity-50 pointer-events-none")} 
                      onClick={handleConfirm}
                      disabled={isSaving}
                    >
                       <ShieldCheck size={20} className={isSaving ? "animate-pulse" : ""} />
                       {isSaving ? "กำลังยื่นแบบ..." : "ยืนยันและส่งแบบ"}
                    </PillButton>
                    <PillButton 
                      variant="ghost" 
                      className={cn("w-full text-white/20", isSaving && "opacity-50 pointer-events-none")} 
                      onClick={() => setStep(1)}
                      disabled={isSaving}
                    >
                       ย้อนกลับไปตรวจสอบ
                    </PillButton>
                 </div>
              </div>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="w-[320px] bg-[#0F0F12] p-12 flex flex-col border-l border-white/5">
             <div className="flex-1 space-y-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ขั้นตอนการดำเนินการ</p>
                  <h5 className="text-sm font-black text-white uppercase tracking-tight">Compliance Flow</h5>
                </div>
                <div className="space-y-4">
                   <div className="p-4 rounded-2xl bg-nexus-blue/10 border border-nexus-blue/20">
                      <p className="text-[10px] font-black text-nexus-blue uppercase tracking-widest mb-1">Step 1</p>
                      <p className="text-xs font-bold text-white">ตรวจสอบยอดภาษี</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 opacity-40">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Step 2</p>
                      <p className="text-xs font-bold text-white">ยื่นแบบออนไลน์</p>
                   </div>
                </div>

                <div className="pt-8 border-t border-white/5 space-y-4">
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">เอกสารแนบ</p>
                   <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] font-bold text-white/60 hover:bg-white/5 transition-all">
                      <span>รายงานภาษีขาย.xlsx</span>
                      <Download size={14} />
                   </button>
                   <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] font-bold text-white/60 hover:bg-white/5 transition-all">
                      <span>รายงานภาษีซื้อ.xlsx</span>
                      <Download size={14} />
                   </button>
                </div>
             </div>
             <PillButton className="w-full shadow-neon-blue" onClick={() => setStep(2)}>
                ตรวจสอบความถูกต้อง <ArrowRight size={18} />
             </PillButton>
          </div>
        )}
      </div>
    </Modal>
  );
}
