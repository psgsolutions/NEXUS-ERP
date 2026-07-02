"use client";

import React, { useState, useEffect } from "react";
import { FileText, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { Modal, PillButton, PillInput, PillSelect } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";

interface WHTModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  initialData?: any;
}

export function WHTModal({ isOpen, onClose, onSave, initialData }: WHTModalProps) {
  const { showAlert } = useSystemDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    id: "",
    expenseId: "",
    baseAmount: 0,
    whtRate: 3,
    taxAmount: 0,
    status: "pending",
    filingDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setForm(initialData);
    }
  }, [isOpen, initialData]);

  const handleCommit = async () => {
    if (!onSave) return onClose();
    setIsSubmitting(true);
    try {
      await onSave(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)">
      <div className="flex flex-col h-full bg-[#0D0D0D]">
        <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">หัก ณ ที่จ่าย 50 ทวิ</h2>
              <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">Withholding Tax Certificate</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">เลขที่เอกสาร 50 ทวิ</label>
              <PillInput value={form.id || "-"} disabled className="w-full font-mono text-amber-500 border-amber-500/30" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">อ้างอิงใบสำคัญจ่าย</label>
              <PillInput value={form.expenseId || "-"} disabled className="w-full font-mono text-white/70" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">จำนวนเงินได้</label>
              <PillInput value={`฿${(form.baseAmount || 0).toLocaleString()}`} disabled className="w-full font-mono border-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">อัตราภาษี (%)</label>
              <PillInput value={`${form.whtRate || 0}%`} disabled className="w-full font-mono border-white/5 text-warning" />
            </div>
          </div>
          
          <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col items-center shadow-inner">
             <span className="text-[11px] text-amber-500/70 uppercase tracking-widest mb-2 font-bold">ภาษีที่หักและนำส่ง</span>
             <span className="text-4xl font-black text-amber-500 font-mono drop-shadow-neon">
               ฿{(form.taxAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
             </span>
          </div>

          {form.status === 'filed' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-emerald-400 font-bold text-sm">✓ ยื่นแบบ ภ.ง.ด. แล้ว</span>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <PillButton variant="glass" onClick={onClose} className="px-8">
            ปิด
          </PillButton>
          {onSave && form.status !== 'filed' && (
            <PillButton className="px-8 shadow-neon-amber bg-amber-500/20 text-amber-500 border border-amber-500/30" onClick={handleCommit} disabled={isSubmitting}>
              {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              บันทึกข้อมูล
            </PillButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
