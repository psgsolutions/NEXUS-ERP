"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  UserPlus, 
  Briefcase, 
  Wallet, 
  Camera, 
  ShieldCheck, 
  CheckCircle2,
  DollarSign,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  GlassCard,
  NexusDatePicker,
  cn
} from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";

export default function NewEmployeePage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [formData, setFormData] = useState({
    prefix: "Mr.",
    firstName: "",
    lastName: "",
    nickname: "",
    position: "",
    department: "ENGINEERING",
    employmentType: "permanent",
    joinDate: new Date().toISOString().split('T')[0],
    salary: "",
    taxId: "",
    bankName: "KBank",
    bankAccount: ""
  });

  const handleSalaryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const oldVal = formData.salary;
    
    if (newVal === "") {
      setFormData({...formData, salary: newVal});
      return;
    }

    if (!/^\d*$/.test(newVal)) return;
    
    if (newVal.length >= 6 && oldVal.length < 6) {
      const confirm = await showConfirm("เงินเดือนเกินแสน แน่ใจว่าจะใช้ฐานเงินเดือนนี้?");
      if (confirm) {
        setFormData({...formData, salary: newVal});
      }
    } else {
      setFormData({...formData, salary: newVal});
    }
  };

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 13);
    setFormData({...formData, taxId: val});
  };

  const handleBack = async () => {
    const isDirty = formData.firstName !== "" || formData.lastName !== "";
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.position) {
      await showAlert("กรุณากรอกข้อมูลพื้นฐาน (ชื่อ, นามสกุล, ตำแหน่ง) ให้ครบถ้วน", "System Notification", "warning");
      return;
    }
    showAlert("ลงทะเบียนพนักงานใหม่เรียบร้อยแล้ว");
    router.push("/hr");
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-0.5">HR_CORE_V3.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">เพิ่มพนักงานใหม่ (New Employee)</h1>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Actions can go here if needed */}
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <GlassCard className="p-8 space-y-12 animate-in fade-in duration-500 min-h-[60vh]">
        
        {/* Section 1: Basic Info */}
        <div className="space-y-8">
           <div className="flex items-center gap-2 border-b border-white/5 pb-4">
             <UserPlus className="text-cyan-400" size={20} />
             <h4 className="text-[14px] font-black text-white uppercase tracking-widest">ข้อมูลพนักงาน (Basic Info)</h4>
           </div>

           <div className="flex flex-col md:flex-row items-start gap-10">
              <div className="w-40 h-48 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 group hover:border-cyan-500/40 transition-all cursor-pointer">
                 <Camera className="text-white/10 group-hover:text-cyan-400 transition-colors" size={32} />
                 <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">อัปโหลดรูป</span>
              </div>
              <div className="flex-1 space-y-8">
                 <div className="grid grid-cols-4 gap-6">
                    <Field label="คำนำหน้า (Prefix)">
                       <PillSelect value={formData.prefix} onChange={(e) => setFormData({...formData, prefix: e.target.value})} className="w-full h-9 px-6 rounded-full font-bold">
                          <option>Mr.</option>
                          <option>Mrs.</option>
                          <option>Ms.</option>
                       </PillSelect>
                    </Field>
                    <div className="col-span-3">
                       <Field label="ชื่อจริง * (First Name)" required>
                          <PillInput value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="ระบุชื่อจริง..." className="w-full h-9 px-6 rounded-full font-bold text-white" />
                       </Field>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <Field label="นามสกุล * (Last Name)" required>
                       <PillInput value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="ระบุนามสกุล..." className="w-full h-9 px-6 rounded-full font-bold text-white" />
                    </Field>
                    <Field label="ชื่อเล่น (Nickname)">
                       <PillInput value={formData.nickname} onChange={(e) => setFormData({...formData, nickname: e.target.value})} placeholder="ชื่อเล่น..." className="w-full h-9 px-6 rounded-full font-bold text-white" />
                    </Field>
                 </div>
              </div>
           </div>
        </div>

        {/* Section 2: Job & Contract */}
        <div className="space-y-8 pt-4">
           <div className="flex items-center gap-2 border-b border-white/5 pb-4">
             <Briefcase className="text-cyan-400" size={20} />
             <h4 className="text-[14px] font-black text-white uppercase tracking-widest">การจ้างงานและตำแหน่ง (Job & Contract)</h4>
           </div>

           <div className="grid grid-cols-2 gap-8">
              <Field label="ตำแหน่งงาน * (Position)" required>
                 <PillInput value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} placeholder="เช่น Network Engineer..." className="w-full h-9 px-6 rounded-full font-bold text-white" />
              </Field>
              <Field label="แผนก (Department)">
                 <PillSelect value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full h-9 px-6 rounded-full font-bold">
                    <option value="ENGINEERING">ENGINEERING (วิศวกรรม)</option>
                    <option value="SALES">SALES & MARKETING</option>
                    <option value="FINANCE">FINANCE & ADMIN</option>
                    <option value="HR">HUMAN RESOURCES</option>
                 </PillSelect>
              </Field>
           </div>
           <div className="grid grid-cols-2 gap-8">
              <Field label="ประเภทการจ้างงาน (Employment Type)">
                 <PillSelect value={formData.employmentType} onChange={(e) => setFormData({...formData, employmentType: e.target.value})} className="w-full h-9 px-6 rounded-full font-bold">
                    <option value="permanent">พนักงานประจำ</option>
                    <option value="contract">สัญญาจ้าง</option>
                    <option value="probation">ทดลองงาน</option>
                 </PillSelect>
              </Field>
              <Field label="วันที่เริ่มงาน (Join Date)">
                 <NexusDatePicker value={formData.joinDate} onChange={(e) => setFormData({...formData, joinDate: e.target.value})} className="w-full h-9 px-6 rounded-full" />
              </Field>
           </div>
        </div>

        {/* Section 3: Financial */}
        <div className="space-y-8 pt-4">
           <div className="flex items-center gap-2 border-b border-white/5 pb-4">
             <Wallet className="text-cyan-400" size={20} />
             <h4 className="text-[14px] font-black text-white uppercase tracking-widest">ข้อมูลการเงิน (Financial)</h4>
           </div>

           <div className="grid grid-cols-2 gap-8">
              <Field label="เลขประจำตัวผู้เสียภาษี (Tax ID)">
                 <PillInput value={formData.taxId} onChange={handleTaxIdChange} placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก" className="w-full h-9 px-6 rounded-full font-mono font-bold text-white text-right" />
              </Field>
              <Field label="เงินเดือนฐาน (Base Salary)">
                 <div className="relative">
                    <PillInput type="text" inputMode="numeric" value={formData.salary} onChange={handleSalaryChange} placeholder="0" className="w-full h-9 pl-10 pr-6 rounded-full font-mono font-bold text-white text-right" />
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                 </div>
              </Field>
           </div>
           <div className="grid grid-cols-2 gap-8">
              <Field label="ธนาคารที่รับเงิน (Bank Name)">
                 <PillSelect value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} className="w-full h-9 px-6 rounded-full font-bold">
                    <option>KBank</option>
                    <option>SCB</option>
                    <option>BBL</option>
                 </PillSelect>
              </Field>
              <Field label="เลขที่บัญชีธนาคาร (Bank Account)">
                 <PillInput value={formData.bankAccount} onChange={(e) => setFormData({...formData, bankAccount: e.target.value})} placeholder="XXX-X-XXXXX-X" className="w-full h-9 px-6 rounded-full font-mono font-bold text-white text-right" />
              </Field>
           </div>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 space-y-8 sticky top-0 shadow-2xl bg-[#111111] border-white/5 rounded-3xl overflow-hidden">
      <div className="space-y-1 relative z-10 border-b border-white/5 pb-4">
        <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">ข้อมูลอ้างอิงเบื้องต้น</p>
        <h5 className="text-sm font-black text-white uppercase tracking-tight">Identity Guard</h5>
      </div>

      <div className="space-y-4 relative z-10">
         <NexusDataField label="รหัสพนักงาน" value="รอสร้างอัตโนมัติ" className="font-mono" color="text-white/30" />
         <NexusDataField label="ชื่อ-นามสกุล" value={`${formData.prefix} ${formData.firstName} ${formData.lastName}`} color={formData.firstName ? "text-cyan-400" : "text-white/30"} />
         <NexusDataField label="ตำแหน่ง" value={formData.position || "ไม่ระบุ"} color={formData.position ? "text-cyan-400" : "text-white/30"} />
         <NexusDataField label="แผนก" value={formData.department} />
         <div className="pt-4 border-t border-white/5">
           <NexusDataField label="ฐานเงินเดือน" value={formData.salary ? `฿${parseInt(formData.salary).toLocaleString()}` : "฿0"} className="font-mono" highlight color="text-white" />
         </div>
      </div>
      
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4 relative z-10">
         <div className="flex items-start gap-3">
            <CheckCircle2 className={formData.firstName && formData.lastName ? "text-cyan-400" : "text-white/10"} size={14} />
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">ข้อมูลพื้นฐานครบถ้วน</span>
         </div>
         <div className="flex items-start gap-3">
            <CheckCircle2 className={formData.position ? "text-cyan-400" : "text-white/10"} size={14} />
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">ระบุตำแหน่งงาน</span>
         </div>
         <div className="flex items-start gap-3">
            <CheckCircle2 className={formData.salary ? "text-cyan-400" : "text-white/10"} size={14} />
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">ระบุฐานเงินเดือน</span>
         </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
        <PillButton className="w-full h-11 px-6 rounded-full font-black uppercase tracking-[0.2em] shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[12px]" onClick={handleSave}>
          <ShieldCheck size={18} className="mr-2" />
          บันทึกข้อมูลพนักงาน
        </PillButton>
        <PillButton variant="glass" className="w-full h-11 px-6 rounded-full uppercase tracking-widest text-[11px] text-white/40 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
      </div>
      
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
