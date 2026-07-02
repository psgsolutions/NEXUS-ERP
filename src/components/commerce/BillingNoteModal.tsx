"use client";

import React, { useState, useEffect } from "react";
import { FileText, CheckCircle2, ShieldCheck, RefreshCw, CalendarDays, Wallet } from "lucide-react";
import { Modal, PillButton, PillInput, PillSelect, NexusDatePicker } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { cn } from "@/lib/utils";

interface BillingNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  initialData?: any;
}

export function BillingNoteModal({ isOpen, onClose, onSave, initialData }: BillingNoteModalProps) {
  const { showAlert } = useSystemDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    id: "",
    customerId: "",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    status: "pending"
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
    <Modal isOpen={isOpen} onClose={onClose} title="ใบวางบิล / ใบแจ้งหนี้">
      <div className="flex flex-col h-full bg-[#0D0D0D]">
        <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <div className="p-3 bg-nexus-blue/10 rounded-2xl text-nexus-blue border border-nexus-blue/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">ใบวางบิล</h2>
              <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">Billing Note / Statement</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">เลขที่เอกสาร</label>
              <PillInput value={form.id || "-"} disabled className="w-full font-mono text-nexus-blue border-nexus-blue/30" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">รหัสลูกค้า</label>
              <PillInput value={form.customerId || "-"} disabled className="w-full font-mono text-white/70" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">วันที่ออกเอกสาร</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <NexusDatePicker value={form.issueDate} 
                  onChange={(e) => setForm({...form, issueDate: e.target.value})}
                  className="w-full pl-10" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-widest">วันนัดชำระ</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-warning" size={16} />
                <NexusDatePicker value={form.dueDate} 
                  onChange={(e) => setForm({...form, dueDate: e.target.value})}
                  className="w-full pl-10" 
                />
              </div>
            </div>
          </div>
          
          <div className="p-6 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/20 flex flex-col items-center shadow-inner">
             <span className="text-[11px] text-nexus-blue/70 uppercase tracking-widest mb-2 font-bold">ยอดเรียกเก็บสุทธิ</span>
             <span className="text-4xl font-black text-nexus-blue font-mono drop-shadow-neon">
               ฿{(form.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
             </span>
          </div>

        </div>

        <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <PillButton variant="glass" onClick={onClose} className="px-8">
            ปิด
          </PillButton>
          {onSave && (
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
