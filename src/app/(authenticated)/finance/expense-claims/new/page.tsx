"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  FileText, 
  ShieldCheck, 
  Camera,
  Image as ImageIcon,
  Trash2,
  Receipt,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  GlassCard,
  cn 
} from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewExpenseClaimPage() {
  const router = useRouter();
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

  useEffect(() => {
    let vat = 0;
    if (formData.hasVat) {
      vat = formData.subtotal * 0.07;
    }
    setVatAmount(vat);
    setGrandTotal(formData.subtotal + vat);
  }, [formData.subtotal, formData.hasVat]);

  const handleBack = async () => {
    if (formData.description !== "" || formData.subtotal > 0) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (formData.subtotal <= 0) return void showAlert("กรุณาระบุยอดเงินเบิก", "System Notification", "warning");
    if (!formData.description) return void showAlert("กรุณาระบุรายละเอียดการเบิก", "System Notification", "warning");
    
    showAlert("ส่งคำขอเบิกเงินภายในเรียบร้อยแล้ว");
    router.push("/finance");
  };

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

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">INTERNAL_EXPENSE_V1.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">เบิกเงินภายใน (Expense Claim)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Approved"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton className="h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-2" /> ส่งคำขอเบิกเงิน
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 border-white/5 bg-black/20">
        <div className="grid grid-cols-2 gap-6">
          <Field label="เลขที่เอกสาร (CLAIM ID)">
            <PillInput 
              value={formData.claimId} 
              readOnly 
              className="w-full text-white/50 bg-white/5 border-white/5 font-mono cursor-not-allowed" 
            />
          </Field>
          <Field label="รหัสพนักงาน (EMPLOYEE ID) *">
            <PillInput 
              value={formData.employeeId} 
              onChange={e => setFormData({ ...formData, employeeId: e.target.value })} 
              className="w-full" 
            />
          </Field>
        </div>
        
        <Field label="รหัสบัญชีค่าใช้จ่าย (EXPENSE ACCOUNT) *">
          <PillSelect 
            value={formData.expenseAccountCode} 
            onChange={e => setFormData({ ...formData, expenseAccountCode: e.target.value })}
            className="w-full"
          >
            <option value="53000-00">53000-00 - ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป</option>
            <option value="53000-01">53000-01 - ค่าเดินทางและพาหนะ</option>
            <option value="53000-02">53000-02 - ค่ารับรองลูกค้า</option>
            <option value="53000-03">53000-03 - ค่าวัสดุสิ้นเปลืองสำนักงาน</option>
          </PillSelect>
        </Field>

        <Field label="รายละเอียดการเบิก (DESCRIPTION) *">
          <PillInput 
            value={formData.description} 
            onChange={e => setFormData({ ...formData, description: e.target.value })} 
            placeholder="ระบุรายละเอียดค่าใช้จ่ายที่ต้องการเบิก..."
            className="w-full" 
          />
        </Field>

        <div className="grid grid-cols-2 gap-6">
          <Field label="ยอดเงินเบิกก่อนภาษี (SUBTOTAL) *">
            <PillInput 
              type="number" 
              value={formData.subtotal || ''} 
              onChange={e => setFormData({ ...formData, subtotal: Number(e.target.value) })} 
              className="w-full font-mono" 
            />
          </Field>
          
          <div className="flex flex-col justify-center space-y-2 mt-8">
            <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-white/70 hover:text-white">
              <input 
                type="checkbox" 
                checked={formData.hasVat} 
                onChange={e => setFormData({ ...formData, hasVat: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
              />
              รวมภาษีมูลค่าเพิ่ม 7% (INCLUDES VAT)
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <Field label="แนบรูปถ่ายใบเสร็จ (RECEIPTS) *">
              <div />
            </Field>
            <PillButton 
              variant="ghost" 
              className="h-8 px-4 text-[11px] bg-white/5 border-white/10 hover:bg-white/10"
              onClick={handleUploadReceipt}
            >
              <Camera size={12} className="mr-2" /> ถ่ายรูป / อัปโหลด
            </PillButton>
          </div>
          
          {formData.receiptUrls.length === 0 ? (
            <div className="w-full p-8 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 bg-white/[0.02]">
              <ImageIcon size={32} className="mb-2 opacity-50" />
              <p className="text-[11px] uppercase tracking-widest font-black">No receipts attached</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {formData.receiptUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-black/40 group">
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 font-mono text-xs">
                    [RECEIPT IMAGE]
                  </div>
                  <button 
                    onClick={() => handleRemoveReceipt(idx)}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 sticky top-[96px] bg-[#111111] border-white/5 shadow-2xl flex flex-col min-h-[400px]">
      <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
        <Receipt size={16} className="text-cyan-400" />
        <h3 className="text-base font-black text-white/80 uppercase tracking-widest mb-0">Summary</h3>
      </div>
      
      <div className="space-y-4 flex-1">
        <div className="flex justify-between items-center">
          <span className="text-[12px] font-black text-white/40 uppercase tracking-widest">ยอดก่อนภาษี</span>
          <span className="text-[13px] font-mono text-white/80">{formatCurrency(formData.subtotal)}</span>
        </div>
        
        {formData.hasVat && (
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-black text-white/40 uppercase tracking-widest">ภาษีมูลค่าเพิ่ม (7%)</span>
            <span className="text-[13px] font-mono text-cyan-400">{formatCurrency(vatAmount)}</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <span className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">ยอดสุทธิที่ขอเบิก</span>
            <span className="block text-2xl font-mono text-cyan-400">
              {formatCurrency(grandTotal)}
            </span>
          </div>
          <span className="text-[12px] font-black text-white/40 uppercase tracking-widest pb-1">THB</span>
        </div>

        <PillButton 
          className="w-full h-11 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] font-black uppercase tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[12px] hover:bg-cyan-500/30" 
          onClick={handleSave}
        >
          <ShieldCheck size={16} className="mr-2" />
          ส่งคำขอเบิกเงิน
        </PillButton>
      </div>
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
