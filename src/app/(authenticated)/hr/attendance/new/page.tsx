"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Fingerprint,
  ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  NexusDataField,
  GlassCard,
  cn 
} from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";

export default function NewAttendancePage() {
  const router = useRouter();
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

  const handleBack = async () => {
    if (employee !== "" || note !== "") {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleConfirm = () => {
    if (!employee) return void showAlert("กรุณาเลือกชื่อพนักงาน", "System Notification", "warning");
    showAlert("บันทึกเวลาเข้า/ออกงานเรียบร้อยแล้ว");
    router.push("/hr");
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              บันทึกเวลาเข้าและออกงาน
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              ATTENDANCE
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ลงเวลาเข้างาน ออกงาน หรือปฏิบัติหน้าที่นอกสถานที่ของบุคลากร
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={handleConfirm}>
          <ShieldCheck size={14} className="mr-1.5" /> บันทึกเวลา
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard accentColor="teal" className="p-8 space-y-12 min-h-[60vh] flex flex-col items-center justify-center">
        
        <div className="flex flex-col items-center text-center space-y-4 mt-8">
          <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shadow-[0_0_24px_rgba(6,182,212,0.15)]">
            <Clock size={48} className="animate-pulse" />
          </div>
          <div className="space-y-2">
             <h4 className="text-5xl font-black text-white font-mono tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
             </h4>
             <p className="text-[14px] font-semibold text-white/30 uppercase tracking-[0.3em]">
                {currentTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
             </p>
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex p-2 rounded-3xl bg-white/[0.02] border border-white/5">
              <button 
                onClick={() => setAttendanceType("IN")}
                className={cn(
                  "flex-1 py-4 rounded-[1.25rem] text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                  attendanceType === "IN" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]" : "text-white/20 hover:text-white/40 border border-transparent"
                )}
              >
                 <CheckCircle2 size={20} /> เข้างาน
              </button>
              <button 
                onClick={() => setAttendanceType("OUT")}
                className={cn(
                  "flex-1 py-4 rounded-[1.25rem] text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                  attendanceType === "OUT" ? "bg-danger/20 text-danger border border-danger/30 shadow-neon-danger" : "text-white/20 hover:text-white/40 border border-transparent"
                )}
              >
                 <ArrowRight size={20} /> ออกงาน
              </button>
           </div>

           <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <Field label="พนักงาน * (Employee)" required>
                   <PillSelect value={employee} onChange={(e) => setEmployee(e.target.value)} className="w-full h-9 px-6 rounded-full font-bold">
                      <option value="">ระบุชื่อพนักงาน...</option>
                      <option>Somchai ใจดี</option>
                      <option>Wipawadee รักงาน</option>
                      <option>Kriangkrai มั่นคง</option>
                   </PillSelect>
                </Field>
                <Field label="สถานที่ / ไซต์งาน (Site Location)">
                   <PillSelect value={site} onChange={(e) => setSite(e.target.value)} className="w-full h-9 px-6 rounded-full font-bold">
                      <option>สำนักงานใหญ่</option>
                      <option>SITE-A (Hospital)</option>
                      <option>SITE-B (PTT Tower)</option>
                      <option>WFH (Work From Home)</option>
                   </PillSelect>
                </Field>
              </div>

              <Field label="หมายเหตุ / งานที่ปฏิบัติ (Note / Task)">
                 <PillInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เข้าปฏิบัติงานบำรุงรักษาประจำปี..." className="w-full h-9 px-6 rounded-full font-bold text-white" />
              </Field>
           </div>
        </div>
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard accentColor="blue" className="p-5 space-y-6 sticky top-0 relative overflow-hidden">
      <div className="space-y-1 relative z-10 border-b border-white/5 pb-4">
        <p className="text-[12px] font-semibold text-white/20 uppercase tracking-[0.2em]">Security Verification</p>
        <h5 className="text-sm font-semibold text-white uppercase tracking-tight">Identity Guard</h5>
      </div>

      <div className="relative z-10 aspect-square w-full rounded-[2rem] bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center text-center p-8 space-y-4 group hover:border-cyan-500/40 transition-all cursor-pointer">
         <div className="w-24 h-24 rounded-full bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all">
            <Fingerprint size={48} />
         </div>
         <div className="space-y-1">
            <p className="text-[12px] font-semibold text-white uppercase tracking-widest">แตะลายนิ้วมือเพื่อยืนยัน</p>
            <p className="text-[10px] text-white/20 font-bold uppercase">หรือใช้ระบบจดจำใบหน้า</p>
         </div>
      </div>

      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4 relative z-10">
         <NexusDataField label="สถานะ GPS" value="ACTIVE / HIGH ACCURACY" color="text-cyan-400" />
         <NexusDataField label="ระยะห่างจากเป้าหมาย" value="0.2 km" />
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
        <PillButton 
          className={cn("w-full h-11 px-6 rounded-full uppercase font-black tracking-[0.2em] border text-[12px]", attendanceType === "IN" ? "shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "shadow-neon-danger bg-danger/20 border-danger/40 text-danger", isSaving && "opacity-50 pointer-events-none")} 
          onClick={handleConfirm}
          disabled={isSaving}
        >
          <ShieldCheck size={16} className={cn("mr-2", isSaving && "animate-pulse")} />
          {isSaving ? "กำลังบันทึก..." : "ยืนยันบันทึกเวลา"}
        </PillButton>
        <PillButton 
          variant="glass" 
          className={cn("w-full h-11 px-6 rounded-full text-white/40 hover:text-white uppercase tracking-widest text-[11px]", isSaving && "opacity-50 pointer-events-none")} 
          onClick={handleBack}
          disabled={isSaving}
        >
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
