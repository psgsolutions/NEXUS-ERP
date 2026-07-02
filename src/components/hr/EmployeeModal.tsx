"use client";

import React, { useState } from "react";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  UserPlus, 
  Briefcase, 
  Wallet, 
  FileText, 
  Camera, 
  ShieldCheck, 
  Trash2, 
  CheckCircle2,
  X,
  DollarSign
} from "lucide-react";
import { PillButton, PillInput, PillSelect, Modal, PillTabs, NexusDataField, cn, Toast, NexusDatePicker } from "@/components/ui/Base";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
}

export function EmployeeModal({ isOpen, onClose, onSave }: EmployeeModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("basic");
  const [isSaving, setIsSaving] = useState(false);
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

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
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
      setActiveTab("basic");
    }
  }, [isOpen]);

  const isDirty = formData.firstName !== "" || formData.lastName !== "";

  const handleClose = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSalaryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const oldVal = formData.salary;
    
    // Allow empty string
    if (newVal === "") {
      setFormData({...formData, salary: newVal});
      return;
    }

    // Allow only digits
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
    // Only digits, max 13
    const val = e.target.value.replace(/\D/g, '').slice(0, 13);
    setFormData({...formData, taxId: val});
  };

  // Removed local Toast state


  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.position) {
      await showAlert("กรุณากรอกข้อมูลพื้นฐาน (ชื่อ, นามสกุล, ตำแหน่ง) ให้ครบถ้วน", "System Notification", "warning");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="ลงทะเบียนพนักงานใหม่"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">โหมดจัดการบุคลากร (HR_CORE_V3.0)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">ข้อมูลพนักงาน</h4>
              </div>
              <PillTabs 
                 tabs={[
                   { id: "basic", label: "Basic Info" },
                   { id: "job", label: "Job & Contract" },
                   { id: "payroll", label: "Financial" }
                 ]}
                 activeTab={activeTab}
                 onTabChange={setActiveTab}
              />
            </div>

            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
              {activeTab === "basic" && (
                <div className="space-y-10">
                  <div className="flex items-start gap-10">
                     <div className="w-40 h-48 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 group hover:border-nexus-teal/40 transition-all cursor-pointer">
                        <Camera className="text-white/10 group-hover:text-nexus-teal transition-colors" size={32} />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">อัปโหลดรูป</span>
                     </div>
                     <div className="flex-1 space-y-8">
                        <div className="grid grid-cols-4 gap-6">
                           <Field label="คำนำหน้า">
                              <PillSelect value={formData.prefix} onChange={(e) => setFormData({...formData, prefix: e.target.value})} className="w-full">
                                 <option>Mr.</option>
                                 <option>Mrs.</option>
                                 <option>Ms.</option>
                              </PillSelect>
                           </Field>
                           <div className="col-span-3">
                              <Field label="ชื่อจริง *">
                                 <PillInput value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="ระบุชื่อจริง..." className="w-full" />
                              </Field>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <Field label="นามสกุล *">
                              <PillInput value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="ระบุนามสกุล..." className="w-full" />
                           </Field>
                           <Field label="ชื่อเล่น">
                              <PillInput value={formData.nickname} onChange={(e) => setFormData({...formData, nickname: e.target.value})} placeholder="ชื่อเล่น..." className="w-full" />
                           </Field>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === "job" && (
                <div className="space-y-10">
                   <div className="grid grid-cols-2 gap-8">
                      <Field label="ตำแหน่งงาน *">
                         <PillInput value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} placeholder="เช่น Network Engineer..." className="w-full" />
                      </Field>
                      <Field label="แผนก">
                         <PillSelect value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full">
                            <option value="ENGINEERING">ENGINEERING (วิศวกรรม)</option>
                            <option value="SALES">SALES & MARKETING</option>
                            <option value="FINANCE">FINANCE & ADMIN</option>
                            <option value="HR">HUMAN RESOURCES</option>
                         </PillSelect>
                      </Field>
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                      <Field label="ประเภทการจ้างงาน">
                         <PillSelect value={formData.employmentType} onChange={(e) => setFormData({...formData, employmentType: e.target.value})} className="w-full">
                            <option value="permanent">พนักงานประจำ</option>
                            <option value="contract">สัญญาจ้าง</option>
                            <option value="probation">ทดลองงาน</option>
                         </PillSelect>
                      </Field>
                      <Field label="วันที่เริ่มงาน">
                         <NexusDatePicker value={formData.joinDate} onChange={(e) => setFormData({...formData, joinDate: e.target.value})} className="w-full" />
                      </Field>
                   </div>
                </div>
              )}

               {activeTab === "payroll" && (
                <div className="space-y-10">
                   <div className="grid grid-cols-2 gap-8">
                      <Field label="เลขประจำตัวผู้เสียภาษี">
                         <PillInput value={formData.taxId} onChange={handleTaxIdChange} placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก" className="w-full" />
                      </Field>
                      <Field label="เงินเดือนฐาน">
                         <div className="relative">
                            <PillInput type="text" inputMode="numeric" value={formData.salary} onChange={handleSalaryChange} placeholder="0" className="w-full pl-10" />
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                         </div>
                      </Field>
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                      <Field label="ธนาคารที่รับเงิน">
                         <PillSelect value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} className="w-full">
                            <option>KBank</option>
                            <option>SCB</option>
                            <option>BBL</option>
                         </PillSelect>
                      </Field>
                      <Field label="เลขที่บัญชีธนาคาร">
                         <PillInput value={formData.bankAccount} onChange={(e) => setFormData({...formData, bankAccount: e.target.value})} placeholder="XXX-X-XXXXX-X" className="w-full" />
                      </Field>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[420px] flex flex-col bg-[#0F0F12] p-12 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">ข้อมูลอ้างอิงเบื้องต้น</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Identity Guard</h5>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
              <NexusDataField label="รหัสพนักงาน" value="EMP-AUTO-GEN" highlight />
              <NexusDataField label="สถานะโปรไฟล์" value="INCOMPLETE" color="text-warning" />
              <NexusDataField label="ระดับการเข้าถึง" value="STANDARD USER" />
            </div>

            <div className="p-6 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/10 flex items-start gap-4">
               <CheckCircle2 className="text-nexus-teal flex-shrink-0" size={18} />
               <p className="text-[11px] text-nexus-teal/60 font-bold uppercase leading-relaxed tracking-widest">
                  การลงทะเบียนพนักงานใหม่จะทำการสร้าง Account สำหรับระบบตอกบัตรและ Digital Payroll อัตโนมัติ
               </p>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <PillButton 
              className={cn("w-full px-8 shadow-neon-teal uppercase tracking-[0.2em]", isSaving && "opacity-50 pointer-events-none")} 
              onClick={handleSave}
              disabled={isSaving}
            >
              <ShieldCheck size={22} className={isSaving ? "animate-pulse" : ""} />
              {isSaving ? "กำลังบันทึกข้อมูล (SAVING...)" : "บันทึกรายชื่อ"}
            </PillButton>
            <PillButton 
              variant="ghost" 
              className={cn("w-full text-white/20 hover:text-white uppercase tracking-widest", isSaving && "opacity-50 pointer-events-none")} 
              onClick={handleClose}
              disabled={isSaving}
            >
              ยกเลิก
            </PillButton>
          </div>
        </div>
      </div>
      {/* Toast removed in favor of System Dialog */}
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
