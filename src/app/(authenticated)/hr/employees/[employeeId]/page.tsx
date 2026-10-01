"use client";

import React, { useState } from "react";
import {
  ArrowLeft, 
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
} from 'lucide-react';
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
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { SecureDeleteAction } from "@/components/ui/SecureDeleteAction";

export default function EmployeeDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const resolvedParams = React.use(params);
  const employeeId = resolvedParams.employeeId;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "บุคลากร", icon: <Users size={14} /> },
    { id: "skills", label: "ทักษะ", icon: <Award size={14} /> },
    { id: "attendance", label: "ประวัติ", icon: <History size={14} /> },
    { id: "payroll", label: "เงินเดือน", icon: <DollarSign size={14} /> },
  ];

  const { data: dbEmployees, loading } = useRealtimeCollection<any>('employees');
  
  // Find employee by ID, or use a placeholder if loading/not found
  const employee = dbEmployees.find((e: any) => 
    (e.employeeId && e.employeeId.trim() === employeeId) || 
    (e.id && e.id.trim() === employeeId)
  ) || null;
  
  const isNotFound = !loading && !employee;

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[500px]">
        <p className="text-white/50 animate-pulse">กำลังโหลดข้อมูลบุคลากร...</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[500px]">
        <p className="text-danger mb-4">ไม่พบข้อมูลพนักงานรหัส {employeeId}</p>
        <PillButton onClick={() => router.back()}>กลับไปหน้าก่อนหน้า</PillButton>
      </div>
    );
  }

  const fullName = employee.name || `${employee.prefix === 'Mr.' ? 'นาย' : employee.prefix === 'Mrs.' ? 'นาง' : employee.prefix === 'Ms.' ? 'นางสาว' : 'คุณ'}${employee.firstName || ''} ${employee.lastName || ''}`.trim() || "Unknown Employee";

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
            <ArrowLeft size={20} />
          </PillButton>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">{fullName}</h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                {employeeId}
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">
              ประวัติการทำงาน สัญญาจ้าง ผลการประเมิน และสิทธิการลาของพนักงาน
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <SecureDeleteAction 
            collectionName="employees"
            documentId={employee.id}
            displayName={fullName}
            onSuccess={() => router.push("/hr")}
          />
          <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/70">ระงับการเข้าถึง</PillButton>
          <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold flex items-center gap-1.5">
            <Edit3 size={14} />
            แก้ไขโปรไฟล์
          </PillButton>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-start gap-4">
        
        {/* Left Content Area */}
        <div className="flex-1 w-full space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "overview" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Performance Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MasterMetricCard icon={<UserCheck size={24} />} label="KPI Score" value="94.5%" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Calendar size={24} />} label="อายุงาน" value="4 ปี 2 เดือน" color="text-nexus-blue" />
                <MasterMetricCard icon={<Activity size={24} />} label="Leave Credits" value="12 วัน" color="text-white" />
              </div>

              {/* Personal & Contract Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <GlassCard className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
                   <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                      <Briefcase size={20} className="text-nexus-teal" />
                      ข้อมูลตำแหน่งงาน
                   </h3>
                   <div className="space-y-4">
                        <NexusDataField label="ตำแหน่งปัจจุบัน" value={employee.position || '-'} />
                        <NexusDataField label="แผนก" value={employee.department || '-'} />
                        <NexusDataField label="สาขาที่สังกัด" value={employee.location || 'สำนักงานใหญ่'} />
                        <NexusDataField label="สถานะ" value={employee.status === 'active' ? 'กำลังปฏิบัติงาน' : employee.status} highlight />
                   </div>
                </GlassCard>

                <GlassCard className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
                   <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                      <ShieldCheck size={20} className="text-nexus-blue" />
                      ข้อมูลสัญญาและสวัสดิการ
                   </h3>
                   <div className="space-y-4">
                        <NexusDataField label="ประเภทพนักงาน" value={employee.employeeType || 'พนักงานประจำ'} />
                        <NexusDataField label="อีเมลเข้าระบบ" value={employee.email || '-'} />
                        <NexusDataField label="ระดับการเข้าถึง" value={employee.role || '-'} />
                        <NexusDataField label="วันที่เริ่มงาน" value={employee.createdAt ? new Date(employee.createdAt.seconds * 1000).toLocaleDateString('th-TH') : '-'} highlight />
                   </div>
                </GlassCard>
              </div>

              {/* Contact Info Grid */}
              <GlassCard className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
                 <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                    <Mail size={20} className="text-white/60" />
                    ช่องทางการติดต่อ & ที่อยู่
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <ContactItem icon={<Mail />} label="Email" value={employee.email || '-'} />
                    <ContactItem icon={<Phone />} label="Phone" value={employee.phone || '-'} />
                    <ContactItem icon={<MapPin />} label="Address" value={employee.address || '-'} />
                 </div>
              </GlassCard>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tactical Info */}
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">
           <GlassCard className="bg-surface-1 border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
              <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                 ทักษะและความสามารถ
              </h3>
              <div className="space-y-4">
                 <SkillBar label="Cisco Network" value="95%" />
                 <SkillBar label="Aruba WiFi" value="88%" />
                 <SkillBar label="Fiber Splicing" value="70%" />
                 <SkillBar label="Project Management" value="65%" />
              </div>
           </GlassCard>

           <GlassCard className="bg-surface-1 border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
              <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                 ใบรับรองทางเทคนิค
              </h3>
              <div className="space-y-4">
                 <CertItem label="CCNP Enterprise" date="Expired: 2027" />
                 <CertItem label="Aruba ACSP" date="Expired: 2026" />
                 <CertItem label="PMP Professional" date="Expired: 2025" />
              </div>
              <button className="w-full mt-2 text-sm font-semibold text-white/40 uppercase hover:text-nexus-teal flex items-center justify-center gap-2 transition-colors">
                 ดูไฟล์แนบทั้งหมด <ArrowUpRight size={16} />
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
       <div className="flex items-center gap-2 text-sm font-semibold text-white/40 uppercase tracking-widest">
          {React.cloneElement(icon as React.ReactElement, { size: 14 })}
          {label}
       </div>
       <p className="text-sm font-bold text-white truncate">{value}</p>
    </div>
  );
}

function SkillBar({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-sm font-semibold uppercase tracking-widest">
          <span className="text-white/40">{label}</span>
          <span className="text-nexus-blue">{value}</span>
       </div>
       <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-nexus-blue shadow-neon-blue" style={{ width: value }} />
       </div>
    </div>
  );
}

function CertItem({ label, date }: { label: string, date: string }) {
  return (
    <div className="flex items-center gap-4 group">
       <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-nexus-teal group-hover:border-nexus-teal/30 transition-all">
          <Award size={24} />
       </div>
       <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-sm font-semibold text-white/40 uppercase tracking-widest">{date}</p>
       </div>
    </div>
  );
}
