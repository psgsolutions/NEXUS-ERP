"use client";

import React, { useState } from "react";
import { 
  Users, 
  ChevronLeft, 
  Edit3, 
  Mail, 
  Phone, 
  MapPin, 
  Award, 
  Briefcase, 
  History, 
  DollarSign,
  Calendar,
  ShieldCheck,
  TrendingUp,
  Activity,
  ArrowUpRight,
  UserCheck
} from "lucide-react";
import { 
  PillButton, 
  GlassCard, 
  cn, 
  PillTabs, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge,
  MasterMetricCard,
  PillBackButton,
  NexusDataField
} from "@/components/ui/Base";
import { useParams, useRouter } from "next/navigation";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "บุคลากร (PROFILES)", icon: <Users size={14} /> },
    { id: "skills", label: "ทักษะ (SKILLS)", icon: <Award size={14} /> },
    { id: "attendance", label: "ประวัติ (LOGS)", icon: <History size={14} /> },
    { id: "payroll", label: "เงินเดือน (PAYROLL)", icon: <DollarSign size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status="active" label="SENIOR LEVEL" />
               <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Employee ID: {params.id || 'EMP-001'}</p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">คุณสมชาย ใจดี (SOMCHAI JAIDEE)</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <PillButton variant="glass" className="px-6">ระงับการเข้าถึง</PillButton>
          <PillButton className="px-8 shadow-neon-teal">
            <Edit3 size={18} />
            แก้ไขโปรไฟล์
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Content Area */}
        <div className="lg:col-span-3 space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "overview" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Performance Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MasterMetricCard icon={<UserCheck size={24} />} label="KPI Score" value="94.5%" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Calendar size={24} />} label="อายุงาน (Tenure)" value="4 ปี 2 เดือน" color="text-nexus-blue" />
                <MasterMetricCard icon={<Activity size={24} />} label="Leave Credits" value="12 วัน" color="text-white" />
              </div>

              {/* Personal & Contract Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-8 border-white/10 space-y-6">
                   <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2">
                      <Briefcase size={16} />
                      ข้อมูลตำแหน่งงาน
                   </h3>
                   <div className="space-y-4">
                        <NexusDataField label="ตำแหน่งปัจจุบัน" value="วิศวกรเครือข่ายอาวุโส" />
                        <NexusDataField label="แผนก" value="โครงสร้างพื้นฐานและการติดตั้ง" />
                        <NexusDataField label="สาขาที่สังกัด" value="PSG HQ (กรุงเทพฯ)" />
                        <NexusDataField label="ผู้บังคับบัญชา" value="คุณวิชัย (ผู้อำนวยการ)" highlight />
                   </div>
                </GlassCard>

                <GlassCard className="p-8 border-white/10 space-y-6">
                   <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={16} />
                      ข้อมูลสัญญาและสวัสดิการ
                   </h3>
                   <div className="space-y-4">
                        <NexusDataField label="ประเภทพนักงาน" value="พนักงานประจำ" />
                        <NexusDataField label="ประกันสังคม" value="จดทะเบียน (ม.33)" />
                        <NexusDataField label="ประกันสุขภาพ" value="ประกันกลุ่มระดับมาตรฐาน" />
                        <NexusDataField label="สิทธิเบิกจ่าย" value="Zone A (พรีเมียม)" highlight />
                   </div>
                </GlassCard>
              </div>

              {/* Contact Info Grid */}
              <GlassCard className="p-8 border-white/10 space-y-6">
                 <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Mail size={16} />
                    ช่องทางการติดต่อ & ที่อยู่
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ContactItem icon={<Mail />} label="Email" value="somchai@psg-solution.com" />
                    <ContactItem icon={<Phone />} label="Phone" value="081-234-5678" />
                    <ContactItem icon={<MapPin />} label="Address" value="เขตบางกะปิ กรุงเทพฯ" />
                 </div>
              </GlassCard>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tactical Info */}
        <div className="space-y-6">
           <GlassCard className="p-8 border-white/10 bg-nexus-blue/5">
              <h4 className="text-[11px] font-black text-nexus-blue uppercase tracking-widest mb-6">ทักษะและความสามารถ (SKILLS)</h4>
              <div className="space-y-6">
                 <SkillBar label="Cisco Network" value="95%" />
                 <SkillBar label="Aruba WiFi" value="88%" />
                 <SkillBar label="Fiber Splicing" value="70%" />
                 <SkillBar label="Project Management" value="65%" />
              </div>
           </GlassCard>

           <GlassCard className="p-8 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6">ใบรับรองทางเทคนิค (CERT)</h4>
              <div className="space-y-4">
                 <CertItem label="CCNP Enterprise" date="Expired: 2027" />
                 <CertItem label="Aruba ACSP" date="Expired: 2026" />
                 <CertItem label="PMP Professional" date="Expired: 2025" />
              </div>
              <button className="w-full mt-6 text-[10px] font-black text-white/20 uppercase hover:text-nexus-teal flex items-center justify-center gap-2">
                 ดูไฟล์แนบทั้งหมด <ArrowUpRight size={12} />
              </button>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ContactItem({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
       <div className="flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-widest">
          {React.cloneElement(icon as React.ReactElement, { size: 12 })}
          {label}
       </div>
       <p className="text-xs font-bold text-white truncate">{value}</p>
    </div>
  );
}

function SkillBar({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <span className="text-white/40">{label}</span>
          <span className="text-nexus-blue">{value}</span>
       </div>
       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-nexus-blue shadow-neon-blue" style={{ width: value }} />
       </div>
    </div>
  );
}

function CertItem({ label, date }: { label: string, date: string }) {
  return (
    <div className="flex items-center gap-4 group">
       <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-nexus-teal group-hover:border-nexus-teal/30 transition-all">
          <Award size={20} />
       </div>
       <div>
          <p className="text-xs font-black text-white">{label}</p>
          <p className="text-[10px] font-black text-white/20 uppercase">{date}</p>
       </div>
    </div>
  );
}
