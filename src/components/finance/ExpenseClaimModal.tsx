"use client";

import React, { useState, useEffect } from "react";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  FileText, 
  ShieldCheck, 
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  Receipt
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface ExpenseClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
}

export function ExpenseClaimModal({ isOpen, onClose, onSave }: ExpenseClaimModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [formData, setFormData] = useState({
    claimId: "EX-" + new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2) + "-" + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
    employeeId: "EMP-001", // Demo default
    expenseAccountCode: "53000-00", // Default to General Expense
    description: "",
    hasVat: false,
    subtotal: 0,
    receiptUrls: [] as string[]
  });

  const [vatAmount, setVatAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let vat = 0;
    if (formData.hasVat) {
      vat = formData.subtotal * 0.07;
    }
    setVatAmount(vat);
    setGrandTotal(formData.subtotal + vat);
  }, [formData.subtotal, formData.hasVat]);

  const handleClose = async () => {
    if (formData.description !== "" || formData.subtotal > 0) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (formData.subtotal <= 0) return void showAlert("กรุณาระบุยอดเงินเบิก", "System Notification", "warning");
    if (!formData.description) return void showAlert("กรุณาระบุรายละเอียดการเบิก", "System Notification", "warning");
    
    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        vatAmount,
        grandTotal,
        status: "submitted"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Mock function to add a receipt
  const handleUploadReceipt = () => {
    const mockUrl = `/mock-receipts/receipt-${Date.now()}.png`;
    setFormData(prev => ({
      ...prev,
      receiptUrls: [...prev.receiptUrls, mockUrl]
    }));
  };

  const handleRemoveReceipt = (index: number) => {
    setFormData(prev => ({
      ...prev,
      receiptUrls: prev.receiptUrls.filter((_, i) => i !== index)
    }));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="เบิกเงินภายใน (PETTY CASH / REIMBURSEMENT)"
      maxWidth="max-w-[1200px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">รายการเบิกเงินภายใน</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">Internal Expense Claim</h4>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">รหัสใบเบิก</p>
                 <p className="text-lg font-mono font-black text-white/80">{formData.claimId}</p>
              </div>
            </div>

            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
              
              <div className="grid grid-cols-2 gap-8">
                <Field label="พนักงานที่เบิก (Employee ID)">
                  <PillInput 
                    value={formData.employeeId}
                    onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    className="w-full font-mono text-nexus-teal" 
                  />
                </Field>
                <Field label="รหัสบัญชีค่าใช้จ่าย (Expense GL)">
                  <PillSelect 
                    value={formData.expenseAccountCode}
                    onChange={(e) => setFormData({...formData, expenseAccountCode: e.target.value})}
                    className="w-full font-mono text-nexus-blue"
                  >
                     <option value="53000-00">53000-00 - ค่าใช้จ่ายเบ็ดเตล็ด (General)</option>
                     <option value="53010-00">53010-00 - ค่าเดินทาง/ที่พัก (Travel)</option>
                     <option value="53020-00">53020-00 - ค่ารับรองลูกค้า (Entertainment)</option>
                     <option value="53030-00">53030-00 - วัสดุสิ้นเปลือง (Supplies)</option>
                  </PillSelect>
                </Field>
              </div>

              <Field label="รายละเอียดค่าใช้จ่าย (Description) *">
                <textarea 
                  className="w-full h-24 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-6 focus:outline-none focus:border-nexus-teal/40 transition-all"
                  placeholder="ระบุรายละเอียดค่าใช้จ่าย เช่น ค่าแท็กซี่ไปพบลูกค้า, ค่าเลี้ยงรับรอง..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </Field>

              <div className="p-8 rounded-2xl bg-black/40 border border-white/5 space-y-6">
                 <div className="flex justify-between items-center pb-6 border-b border-white/5">
                    <h5 className="text-[12px] font-black text-white/50 uppercase tracking-widest">ข้อมูลภาษีและยอดเงิน (Tax & Amount)</h5>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-[11px] font-black uppercase tracking-widest text-white/60">รวม VAT (7%)</span>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={formData.hasVat} onChange={(e) => setFormData({...formData, hasVat: e.target.checked})} />
                        <div className={cn("w-10 h-5 bg-white/10 rounded-full transition-colors", formData.hasVat && "bg-nexus-teal")}></div>
                        <div className={cn("absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform", formData.hasVat && "translate-x-5")}></div>
                      </div>
                    </label>
                 </div>

                 <div className="grid grid-cols-3 gap-6 items-end">
                    <div className="col-span-1">
                      <Field label="ยอดก่อนภาษี (Subtotal)">
                         <PillInput 
                           type="number"
                           value={formData.subtotal || ''}
                           onChange={(e) => setFormData({...formData, subtotal: parseFloat(e.target.value) || 0})}
                           className="w-full text-right font-mono text-white text-lg" 
                           placeholder="0.00"
                         />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="ภาษีมูลค่าเพิ่ม (VAT 7%)">
                         <div className="h-9 px-5 rounded-full bg-white/[0.01] border border-white/5 flex items-center justify-end">
                            <span className="font-mono text-nexus-blue">{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                         </div>
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="ยอดรวมทั้งสิ้น (Grand Total)">
                         <div className="h-9 px-5 rounded-full bg-nexus-teal/10 border border-nexus-teal/20 flex items-center justify-end">
                            <span className="font-mono text-nexus-teal font-black text-lg">{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                         </div>
                      </Field>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h5 className="text-[12px] font-black text-white/50 uppercase tracking-widest">หลักฐานใบเสร็จ (Receipts)</h5>
                    <PillButton variant="glass" onClick={handleUploadReceipt} className="h-8 text-[11px] px-4">
                      <Camera size={14} /> แนบรูปภาพ
                    </PillButton>
                 </div>
                 
                 {formData.receiptUrls.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-white/20 gap-3">
                       <ImageIcon size={32} className="opacity-50" />
                       <span className="text-[11px] font-bold tracking-widest uppercase">ไม่มีรูปภาพแนบ</span>
                    </div>
                 ) : (
                    <div className="grid grid-cols-4 gap-4">
                       {formData.receiptUrls.map((url, i) => (
                          <div key={i} className="relative aspect-square rounded-2xl bg-white/5 border border-white/10 overflow-hidden group">
                             <div className="absolute inset-0 flex items-center justify-center">
                                <Receipt className="text-white/20" size={32} />
                             </div>
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => handleRemoveReceipt(i)} className="p-2 bg-danger/20 text-danger rounded-full hover:bg-danger hover:text-white transition-colors">
                                   <Trash2 size={16} />
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>

            </div>
          </div>
        </div>

        <div className="w-[360px] flex flex-col bg-[#0F0F12] p-10 flex-shrink-0">
          <div className="flex-1 space-y-8">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปรายการ</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Claim Summary</h5>
            </div>

            <div className="space-y-4">
               <NexusDataField label="รหัสบัญชี" value={formData.expenseAccountCode} fontMono color="text-nexus-blue" />
               <NexusDataField label="ยอดก่อนภาษี" value={`฿${formData.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} fontMono />
               <NexusDataField label="ภาษีมูลค่าเพิ่ม" value={`฿${vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`} fontMono color={formData.hasVat ? "text-nexus-teal" : "text-white/30"} />
               <div className="pt-4 border-t border-white/5">
                 <NexusDataField label="ยอดสุทธิที่ต้องจ่าย" value={`฿${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} fontMono highlight color="text-nexus-teal" />
               </div>
            </div>
            
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] font-bold text-white/40 leading-relaxed text-center">
               *การเบิกจ่ายภายใน ระบบจะทำการบันทึกตัดเงินสดย่อย (Petty Cash) และบันทึกบัญชีค่าใช้จ่ายอัตโนมัติ
            </div>

          </div>

          <div className="space-y-4 pt-10 border-t border-white/5">
            <PillButton 
              className={cn("w-full px-8 shadow-neon-teal uppercase tracking-[0.2em] bg-nexus-teal text-black", (formData.subtotal <= 0 || isSaving) && "opacity-50 pointer-events-none grayscale")} 
              onClick={handleSave}
              disabled={isSaving}
            >
              <ShieldCheck size={20} className={isSaving ? "animate-pulse" : ""} />
              {isSaving ? "PROCESSING..." : "สร้างใบเบิก (SUBMIT)"}
            </PillButton>
            <PillButton 
              variant="glass" 
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

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
