"use client";

import React, { useState, useEffect } from "react";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Clock, 
  MapPin, 
  Camera, 
  ShieldCheck, 
  User, 
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Fingerprint
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void> | void;
}

export function AttendanceModal({ isOpen, onClose, onConfirm }: AttendanceModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceType, setAttendanceType] = useState<"IN" | "OUT">("IN");
  const [employee, setEmployee] = useState("");
  const [site, setSite] = useState("สำนักงานใหญ่");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirm = async () => {
    if (!employee) return void showAlert("กรุณาเลือกชื่อพนักงาน", "System Notification", "warning");
    setIsSaving(true);
    try {
      await onConfirm({ employee, type: attendanceType, time: currentTime, site, note });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="บันทึกเวลาเข้า/ออกงาน (DIGITAL TIME ATTENDANCE)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shadow-neon-blue/20">
                <Clock size={40} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                 <h4 className="text-4xl font-black text-white mono-numbers tracking-tight">
                    {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                 </h4>
                 <p className="text-[12px] font-black text-white/30 uppercase tracking-[0.3em]">
                    {currentTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                 </p>
              </div>
            </div>

            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex p-2 rounded-2xl bg-white/[0.02] border border-white/5">
                  <button 
                    onClick={() => setAttendanceType("IN")}
                    className={cn(
                      "flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                      attendanceType === "IN" ? "bg-nexus-teal text-black shadow-neon-teal" : "text-white/20 hover:text-white/40"
                    )}
                  >
                     <CheckCircle2 size={18} /> เข้างาน (Check-In)
                  </button>
                  <button 
                    onClick={() => setAttendanceType("OUT")}
                    className={cn(
                      "flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                      attendanceType === "OUT" ? "bg-danger text-white shadow-neon-danger" : "text-white/20 hover:text-white/40"
                    )}
                  >
                     <ArrowRight size={18} /> ออกงาน (Check-Out)
                  </button>
               </div>

               <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <Field label="พนักงาน (Employee) *">
                       <PillSelect value={employee} onChange={(e) => setEmployee(e.target.value)} className="w-full px-6">
                          <option value="">ระบุชื่อพนักงาน...</option>
                          <option>Somchai ใจดี</option>
                          <option>Wipawadee รักงาน</option>
                          <option>Kriangkrai มั่นคง</option>
                       </PillSelect>
                    </Field>
                    <Field label="สถานที่ / ไซต์งาน">
                       <PillSelect value={site} onChange={(e) => setSite(e.target.value)} className="w-full px-6">
                          <option>สำนักงานใหญ่</option>
                          <option>SITE-A (Hospital)</option>
                          <option>SITE-B (PTT Tower)</option>
                          <option>WFH (Work From Home)</option>
                       </PillSelect>
                    </Field>
                  </div>

                  <Field label="หมายเหตุ / งานที่ปฏิบัติ">
                     <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เข้าปฏิบัติงานบำรุงรักษาประจำปี..." className="w-full" />
                  </Field>
               </div>
            </div>
          </div>
        </div>

        <div className="w-[380px] flex flex-col bg-[#0F0F12] p-10 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Security Verification</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Identity Guard</h5>
            </div>

            <div className="aspect-square w-full rounded-2xl bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center text-center p-8 space-y-4 group hover:border-nexus-blue/40 transition-all cursor-pointer">
               <div className="w-20 h-20 rounded-full bg-nexus-blue/5 border border-nexus-blue/20 flex items-center justify-center text-nexus-blue group-hover:shadow-neon-blue transition-all">
                  <Fingerprint size={40} />
               </div>
               <div className="space-y-1">
                  <p className="text-[11px] font-black text-white uppercase tracking-widest">แตะลายนิ้วมือเพื่อยืนยัน</p>
                  <p className="text-[9px] text-white/20 font-bold uppercase">หรือใช้ระบบจดจำใบหน้า (Face ID)</p>
               </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
               <NexusDataField label="สถานะ GPS" value="ACTIVE / HIGH ACCURACY" color="text-nexus-teal" />
               <NexusDataField label="ระยะห่างจากเป้าหมาย" value="0.2 km" />
            </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-white/5">
            <PillButton 
              className={cn("w-full px-8 uppercase tracking-[0.2em]", attendanceType === "IN" ? "shadow-neon-teal" : "shadow-neon-danger bg-danger/20 border-danger/40 text-danger", isSaving && "opacity-50 pointer-events-none")} 
              onClick={handleConfirm}
              disabled={isSaving}
            >
              <ShieldCheck size={22} className={isSaving ? "animate-pulse" : ""} />
              {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล (SUBMIT)"}
            </PillButton>
            <PillButton 
              variant="glass" 
              className={cn("w-full text-white/20 hover:text-white uppercase tracking-widest", isSaving && "opacity-50 pointer-events-none")} 
              onClick={onClose}
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
