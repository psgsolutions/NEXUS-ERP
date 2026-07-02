"use client";

import React, { useState, useEffect } from "react";
import { X, FileText, CheckCircle2, AlertCircle, DollarSign, RefreshCw } from "lucide-react";
import { Modal, PillButton, PillInput, NexusDataField, PillSelect, cn, CreatableCombobox } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  initialData?: any;
}

export function ExpenseModal({ isOpen, onClose, onSave, initialData }: ExpenseModalProps) {
  const { showAlert } = useSystemDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    id: "",
    poId: "",
    amount: 0,
    dueDate: "",
    status: "pending",
    whtRate: 3
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
    <Modal isOpen={isOpen} onClose={onClose} title="ใบสำคัญจ่าย">
      <div className="flex flex-col h-full bg-[#0D0D0D]">
        <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <div className="p-3 bg-nexus-blue/10 rounded-2xl text-nexus-blue border border-nexus-blue/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">ใบสำคัญจ่าย</h2>
              <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">Expense Voucher</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">เลขที่ใบสำคัญจ่าย</label>
              <PillInput value={form.id || "-"} disabled className="w-full font-mono text-nexus-blue border-nexus-blue/30" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">อ้างอิง PO</label>
              <PillInput value={form.poId || "-"} disabled className="w-full font-mono text-white/70" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">จำนวนเงิน (ก่อนหัก ณ ที่จ่าย)</label>
              <PillInput value={`฿${(form.amount || 0).toLocaleString()}`} disabled className="w-full font-mono text-emerald-400 border-emerald-500/30" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">อัตราหัก ณ ที่จ่าย (%)</label>
              <CreatableCombobox 
                value={form.whtRate?.toString() || "0"} 
                onChange={(val) => setForm({...form, whtRate: Number(val)})}
                options={[
                  { value: "0", label: "0% (ยกเว้น)" },
                  { value: "1", label: "1% (ค่าขนส่ง)" },
                  { value: "2", label: "2% (ค่าโฆษณา)" },
                  { value: "3", label: "3% (ค่าบริการ)" },
                  { value: "5", label: "5% (ค่าเช่า)" }
                ]}
                allowCustom={true}
              />
            </div>
          </div>
          
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center">
             <span className="text-[11px] text-white/40 uppercase tracking-widest mb-2">ยอดชำระสุทธิ</span>
             <span className="text-3xl font-black text-white font-mono drop-shadow-neon">
               ฿{((form.amount || 0) * (1 - (form.whtRate || 0)/100)).toLocaleString(undefined, {minimumFractionDigits: 2})}
             </span>
             {form.whtRate > 0 && (
               <span className="text-[10px] text-warning mt-2 font-bold">
                 * หักภาษี ณ ที่จ่าย {form.whtRate}% = ฿{((form.amount || 0) * ((form.whtRate || 0)/100)).toLocaleString(undefined, {minimumFractionDigits: 2})}
               </span>
             )}
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <PillButton variant="glass" onClick={onClose} className="px-8">
            ปิด
          </PillButton>
          {onSave && form.status !== 'paid' && (
            <PillButton className="px-8 shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30" onClick={handleCommit} disabled={isSubmitting}>
              {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              บันทึกข้อมูล
            </PillButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
