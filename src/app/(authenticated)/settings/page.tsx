"use client";

import React from "react";
import { 
  ShieldCheck, 
  Building2, 
  Globe, 
  Database,
  Bell,
  Lock,
  Palette,
  Layers,
  ChevronRight
} from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">ตั้งค่าองค์กร (Enterprise Settings)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">System Governance & Branding</p>
        </div>
        <PillButton className="gap-2 shadow-nexus-glow">
          บันทึกการตั้งค่า
        </PillButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-4">
          <SettingNavLink icon={<Building2 size={18} />} label="ข้อมูลนิติบุคคล" active />
          <SettingNavLink icon={<ShieldCheck size={18} />} label="ความปลอดภัยและสิทธิ์" />
          <SettingNavLink icon={<Palette size={18} />} label="ธีมและอินเตอร์เฟส" />
          <SettingNavLink icon={<Bell size={18} />} label="การแจ้งเตือน" />
          <SettingNavLink icon={<Database size={18} />} label="ฐานข้อมูล & Storage" />
          <SettingNavLink icon={<Lock size={18} />} label="API & Integrations" />
        </div>

        {/* Settings Content Area */}
        <div className="lg:col-span-2 space-y-8">
          <GlassCard className="p-8 border-white/5 bg-[#0a0a0c]">
            <h3 className="text-xs font-black text-nexus-teal uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
              <Building2 size={16} />
              ENTITY INFORMATION
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingField label="ชื่อองค์กร (TH)" value="บริษัท พีเอสจี โซลูชั่น จำกัด" />
              <SettingField label="Organization Name (EN)" value="PSG Solutions Co., Ltd." />
              <SettingField label="เลขประจำตัวผู้เสียภาษี" value="010XXXXXXXXXX" />
              <SettingField label="เบอร์โทรศัพท์ติดต่อ" value="02-XXX-XXXX" />
            </div>

            <div className="mt-8 space-y-2">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-4">สำนักงานใหญ่ / ที่อยู่</label>
              <textarea 
                className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-xs text-white/80 focus:outline-none focus:border-nexus-teal/50 transition-all h-24"
                defaultValue="123/45 ถนนสายหลัก แขวงบางนา เขตบางนา กรุงเทพมหานคร 10260"
              />
            </div>
          </GlassCard>

          <GlassCard className="p-8 border-white/5 bg-[#0a0a0c]">
             <h3 className="text-xs font-black text-nexus-teal uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
              <Layers size={16} />
              SYSTEM PREFERENCES
            </h3>
            <div className="space-y-6">
               <ToggleItem label="ระบบสำรองข้อมูลอัตโนมัติ (Auto Backup)" description="สำรองข้อมูล Firestore ลง Cloud Storage ทุก 24 ชั่วโมง" active />
               <ToggleItem label="การแจ้งเตือนผ่าน LINE Notify" description="ส่งแจ้งเตือนยอดขายและโครงการเข้ากลุ่ม LINE อัตโนมัติ" active />
               <ToggleItem label="โหมดประหยัดพลังงาน (Frugal Mode)" description="ลดความละเอียดของกราฟและ Animation ในมือถือ" />
            </div>
          </GlassCard>

          <div className="flex justify-end pt-4">
             <button className="text-[10px] font-black text-danger uppercase tracking-[0.3em] hover:underline">ทำลายข้อมูลทั้งหมด (Factory Reset)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingNavLink({ icon, label, active }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group",
      active ? "bg-white/5 border-white/10 text-white" : "bg-transparent border-transparent text-white/40 hover:bg-white/[0.02]"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn("transition-colors", active ? "text-nexus-teal" : "group-hover:text-white")}>
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <ChevronRight size={14} className={cn("opacity-0 transition-all", active ? "opacity-100 translate-x-0" : "group-hover:opacity-40 -translate-x-2")} />
    </div>
  );
}

function SettingField({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-4">{label}</label>
      <PillInput defaultValue={value} className="w-full bg-white/5 border-white/10 text-xs" />
    </div>
  );
}

function ToggleItem({ label, description, active }: { label: string, description: string, active?: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="space-y-1">
        <p className="text-xs font-bold text-white group-hover:text-nexus-teal transition-colors">{label}</p>
        <p className="text-[10px] text-white/30">{description}</p>
      </div>
      <div className={cn(
        "w-12 h-6 rounded-full p-1 transition-all duration-300 cursor-pointer relative border",
        active ? "bg-nexus-teal border-nexus-teal" : "bg-white/5 border-white/10"
      )}>
        <div className={cn(
          "w-4 h-4 rounded-full bg-black shadow-lg transition-all duration-300",
          active ? "translate-x-6" : "translate-x-0"
        )} />
      </div>
    </div>
  );
}
