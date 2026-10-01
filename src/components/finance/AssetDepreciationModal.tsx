"use client";

import React, { useState } from "react";
import { 
  Box, 
  Calculator, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  History
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

interface AssetDepreciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void> | void;
}

export function AssetDepreciationModal({ isOpen, onClose, onConfirm }: AssetDepreciationModalProps) {
  const [step, setStep] = useState(1);
  const [period, setPeriod] = useState("เมษายน 2569");
  
  const { data: assets } = useRealtimeCollection("assets");

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

  const handleClose = () => {
    if (isSaving) return;
    onClose();
    setStep(1);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm({ period });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="ระบบคำนวณค่าเสื่อมราคาสินทรัพย์"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full bg-surface-0">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shadow-neon-warning/20">
                    <TrendingDown size={24} />
                 </div>
                 <div>
                    <h4 className="text-xl font-semibold text-white uppercase tracking-tight">ประมวลผลค่าเสื่อมราคาประจำเดือน</h4>
                    <p className="text-[12px] font-bold text-white/30 uppercase tracking-[0.2em]">Automated Depreciation Posting</p>
                 </div>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-8 p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                   <div className="space-y-3">
                      <label className="text-[11px] font-semibold text-white/30 uppercase tracking-widest ml-1">งวดบัญชี</label>
                      <PillSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full px-6">
                        <option>เมษายน 2569</option>
                        <option>พฤษภาคม 2569</option>
                      </PillSelect>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[11px] font-semibold text-white/30 uppercase tracking-widest ml-1">จำนวนสินทรัพย์ที่รอประมวลผล</label>
                      <div className="h-11 px-6 rounded-2xl bg-white/5 border border-white/10 flex items-center text-sm font-bold text-white">
                         {assetSummary.totalAssets} รายการ
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h5 className="text-[12px] font-semibold text-white/20 uppercase tracking-widest ml-1">ประมาณการค่าเสื่อมราคา</h5>
                   <div className="p-8 rounded-[3.5rem] bg-white/[0.02] border border-white/5 space-y-8">
                      <div className="flex justify-between items-end">
                         <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.2em]">ยอดค่าเสื่อมรวบรวมงวดนี้</p>
                            <p className="text-4xl font-black text-warning drop-shadow-neon-warning">฿{assetSummary.depreciationAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                         </div>
                         <div className="text-right space-y-1">
                            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.2em]">มูลค่าทางบัญชีรวมหลังหัก</p>
                            <p className="text-xl font-black text-white/80">฿{(assetSummary.totalBookValue - assetSummary.depreciationAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                         </div>
                      </div>
                      
                      <div className="pt-8 border-t border-white/5 grid grid-cols-2 gap-4 text-[11px] font-bold text-white/40 uppercase tracking-widest">
                         <div className="flex items-center gap-2"><CheckCircle2 className="text-nexus-teal" size={14} /> คำนวณแบบเส้นตรง</div>
                         <div className="flex items-center gap-2"><CheckCircle2 className="text-nexus-teal" size={14} /> บันทึกสมุดรายวัน JV อัตโนมัติ</div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 text-center py-10">
                 <div className="w-24 h-24 rounded-[2.5rem] bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mx-auto shadow-neon-warning/20">
                    <History size={48} />
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-2xl font-semibold text-white uppercase tracking-tight">ยืนยันการบันทึกค่าเสื่อมราคา?</h4>
                    <p className="text-sm text-white/40 font-bold leading-relaxed max-w-md mx-auto">
                       ระบบจะทำการสร้างรายการบัญชี เพื่อบันทึกค่าใช้จ่ายค่าเสื่อมราคา และลดยอดสินทรัพย์สะสมในฐานข้อมูลหลักอย่างถาวร
                    </p>
                 </div>
                 <div className="flex flex-col gap-3 max-w-sm mx-auto pt-6">
                    <PillButton 
                      className={cn("w-full px-8 shadow-neon-warning bg-warning/20 hover:bg-warning/40 border-warning/40 text-warning", isSaving && "opacity-50 pointer-events-none")} 
                      onClick={handleConfirm}
                      disabled={isSaving}
                    >
                       <ShieldCheck size={20} className={isSaving ? "animate-pulse" : ""} />
                       {isSaving ? "กำลังประมวลผล..." : "ยืนยันการประมวลผล"}
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
          <div className="w-[320px] bg-surface-1 p-12 flex flex-col border-l border-white/5 overflow-y-auto custom-scrollbar">
             <div className="flex-1 space-y-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Account Matrix</p>
                  <h5 className="text-sm font-semibold text-white uppercase tracking-tight">Double-Entry Mapping</h5>
                </div>
                <div className="space-y-4">
                   <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] font-black text-nexus-teal uppercase tracking-widest mb-1">Debit (+Expense)</p>
                      <p className="text-[11px] font-bold text-white">5121-00 ค่าเสื่อมราคา</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] font-black text-danger uppercase tracking-widest mb-1">Credit (-Asset)</p>
                      <p className="text-[11px] font-bold text-white">1591-00 ค่าเสื่อมสะสม</p>
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
