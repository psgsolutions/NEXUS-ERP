"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, CalendarDays, Wallet, ArrowLeft, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import { PillButton, PillInput, NexusDatePicker, GlassCard, PillSelect } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useCustomers } from "@/hooks/useCustomers";
import { where } from "firebase/firestore";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewBillingNotePage() {
  const router = useRouter();
  const { showAlert } = useSystemDialog();
  const { companyId } = useAuth();
  
  // Tenant Isolation
  const { data: customers = [] } = useCustomers();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    id: "",
    customerId: "",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    totalAmount: 0,
    status: "pending"
  });



  const handleCommit = async () => {
    if (!form.customerId) return void showAlert("กรุณาระบุลูกค้า");
    if (!companyId) return void showAlert("Company ID missing. Cannot save.");

    setIsSubmitting(true);
    try {
      // simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      showAlert("✅ บันทึกใบวางบิลสำเร็จ", "success");
      router.push('/sales');
    } catch (error: any) {
      console.error(error);
      showAlert(`เกิดข้อผิดพลาด: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              สร้างใบวางบิล
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              BILLING-NOTE
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            รวบรวมใบแจ้งหนี้และออกใบวางบิลเพื่อเรียกเก็บเงินจากลูกค้าตามรอบ
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" onClick={handleCommit} disabled={isSubmitting} className="h-8 px-5 font-bold text-xs">
          <CheckCircle2 size={14} className="mr-1.5" /> {isSubmitting ? "กำลังบันทึก..." : "บันทึกใบวางบิล"}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <GlassCard className="p-8 border-white/5 bg-black/20 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/[0.01] p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
                <Field label="ลูกหนี้ (Customer)">
                  <PillSelect 
                    value={form.customerId}
                    onChange={(e) => setForm({...form, customerId: e.target.value})}
                    className="w-full bg-white/[0.02] h-9 rounded-full px-6 text-[13px] font-bold"
                  >
                    <option value="">เลือกจากฐานข้อมูล...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </PillSelect>
                </Field>
                <Field label="เลขที่เอกสาร (Document No.)">
                  <div className="relative">
                     <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                     <PillInput 
                       value={form.id || "AUTO-GENERATE"} 
                       disabled 
                       className="w-full bg-white/[0.02] pl-10 h-9 rounded-full px-6 font-mono text-[13px] text-white/40" 
                     />
                  </div>
                </Field>
            </div>

            <div className="relative z-10 space-y-4">
                <Field label="วันที่ออกเอกสาร (Issue Date)">
                  <NexusDatePicker 
                    value={form.issueDate}
                    onChange={(e) => setForm({...form, issueDate: e.target.value})}
                    className="w-full bg-white/[0.02] h-9 px-6 rounded-full text-[13px] font-bold" 
                  />
                </Field>
                <Field label="วันนัดชำระ (Due Date)">
                  <NexusDatePicker 
                    value={form.dueDate}
                    onChange={(e) => setForm({...form, dueDate: e.target.value})}
                    className="w-full bg-warning/10 text-warning border-warning/20 h-9 px-6 rounded-full text-[13px] font-bold" 
                  />
                </Field>
            </div>
        </div>
        
        <div className="bg-white/[0.01] p-8 rounded-3xl border border-white/5 flex flex-col items-center justify-center min-h-[200px]">
            <Field label="ยอดเรียกเก็บสุทธิ (Total Amount)">
              <div className="w-full max-w-sm">
                <PillInput 
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) => setForm({...form, totalAmount: parseFloat(e.target.value) || 0})}
                  className="w-full h-12 text-center px-6 text-3xl font-mono text-cyan-400 bg-cyan-500/5 border-cyan-500/20 rounded-[2rem] font-bold"
                />
              </div>
            </Field>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 border-white/5 bg-surface-1 shadow-2xl space-y-6 sticky top-0 relative overflow-hidden rounded-3xl">
        <h3 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 relative z-10">
           <Wallet size={16} className="text-cyan-400" /> วางบิล
        </h3>
        
        {/* ACTION BUTTONS */}
        <div className="flex flex-col gap-3 relative z-10">
            <PillButton 
                className="w-full h-9 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] uppercase tracking-widest flex items-center justify-center gap-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 backdrop-blur-md hover:bg-cyan-500/30 font-black text-[12px]" 
                onClick={handleCommit}
                disabled={isSubmitting}
            >
                {isSubmitting ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                บันทึกใบวางบิล
            </PillButton>
            <PillButton 
                variant="glass" 
                className="w-full h-9 px-6 rounded-full uppercase tracking-widest text-[11px] text-white/40 hover:text-white" 
                onClick={() => router.back()}
                disabled={isSubmitting}
            >
                ยกเลิก
            </PillButton>
        </div>
        
        {/* Background glow */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
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
