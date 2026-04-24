"use client";

import React, { useState } from "react";
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
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function EmployeeModal({ isOpen, onClose, onSave }: EmployeeModalProps) {
  const [activeTab, setActiveTab] = useState("basic");
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
    bankName: "KBank",
    bankAccount: ""
  });

  const isDirty = formData.firstName !== "" || formData.lastName !== "";

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName || !formData.position) {
      return alert("กรุณากรอกข้อมูลพื้นฐานและตำแหน่งงานให้ครบถ้วน");
    }
    onSave(formData);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="ลงทะเบียนพนักงานใหม่ (NEW EMPLOYEE REGISTRATION)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">โหมดจัดการบุคลากร (HR_CORE_V3.0)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">ข้อมูลพนักงาน (Employee Profile)</h4>
              </div>
              <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
                 <button onClick={() => setActiveTab("basic")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "basic" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Basic Info</button>
                 <button onClick={() => setActiveTab("job")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "job" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Job & Contract</button>
                 <button onClick={() => setActiveTab("payroll")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "payroll" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Financial</button>
              </div>
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
                              <Field label="ชื่อจริง (First Name) *">
                                 <PillInput value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="ระบุชื่อจริง..." className="w-full" />
                              </Field>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <Field label="นามสกุล (Last Name) *">
                              <PillInput value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="ระบุนามสกุล..." className="w-full" />
                           </Field>
                           <Field label="ชื่อเล่น (Nickname)">
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
                      <Field label="ตำแหน่งงาน (Job Position) *">
                         <PillInput value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} placeholder="เช่น Network Engineer..." className="w-full" />
                      </Field>
                      <Field label="แผนก (Department)">
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
                            <option value="permanent">พนักงานประจำ (Permanent)</option>
                            <option value="contract">สัญญาจ้าง (Contract)</option>
                            <option value="probation">ทดลองงาน (Probation)</option>
                         </PillSelect>
                      </Field>
                      <Field label="วันที่เริ่มงาน (Join Date)">
                         <PillInput type="date" value={formData.joinDate} onChange={(e) => setFormData({...formData, joinDate: e.target.value})} className="w-full" />
                      </Field>
                   </div>
                </div>
              )}

              {activeTab === "payroll" && (
                <div className="space-y-10">
                   <div className="grid grid-cols-2 gap-8">
                      <Field label="เงินเดือนฐาน (Base Salary)">
                         <div className="relative">
                            <PillInput type="number" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} placeholder="0.00" className="w-full pl-10" />
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                         </div>
                      </Field>
                      <Field label="ธนาคารที่รับเงิน">
                         <PillSelect value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} className="w-full">
                            <option>KBank</option>
                            <option>SCB</option>
                            <option>BBL</option>
                         </PillSelect>
                      </Field>
                   </div>
                   <Field label="เลขที่บัญชีธนาคาร">
                      <PillInput value={formData.bankAccount} onChange={(e) => setFormData({...formData, bankAccount: e.target.value})} placeholder="XXX-X-XXXXX-X" className="w-full" />
                   </Field>
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
            <PillButton className="w-full px-8 shadow-neon-teal uppercase tracking-[0.2em]" onClick={handleSave}>
              <ShieldCheck size={22} />
              บันทึกรายชื่อ (ENROLL EMP)
            </PillButton>
            <PillButton variant="glass" className="w-full text-white/20 hover:text-white uppercase tracking-widest" onClick={handleClose}>
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
