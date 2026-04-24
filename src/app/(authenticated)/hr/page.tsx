"use client";

import React, { useState } from "react";
import { 
  UserCog, 
  Users, 
  UserPlus, 
  CalendarCheck, 
  Search, 
  ChevronRight,
  Clock,
  MapPin,
  DollarSign,
  ClipboardList,
  Activity,
  ShieldCheck,
  TrendingUp,
  MapIcon,
  Briefcase,
  Sparkles,
  Plus,
  Wallet,
  Filter
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  PillTabs,
  GlassCard,
  NexusSearchInput
} from "@/components/ui/Base";
import { EmployeeModal } from "@/components/hr/EmployeeModal";
import { AttendanceModal } from "@/components/hr/AttendanceModal";
import { PayrollModal } from "@/components/hr/PayrollModal";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import Link from "next/link";

type HRSubModule = "profiles" | "attendance" | "payroll";

export default function HRPage() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<HRSubModule>("profiles");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const initialEmployees = [
    { id: "EMP-001", name: "คุณสมชาย ใจดี", role: "วิศวกรเครือข่ายอาวุโส", dept: "ENGINEERING", location: "SITE-A", status: "active" as const },
    { id: "EMP-042", name: "คุณวิภาวดี รักงาน", role: "พนักงานบัญชี", dept: "FINANCE", location: "สำนักงาน", status: "active" as const },
    { id: "EMP-088", name: "คุณเกรียงไกร มั่นคง", role: "ช่างเทคนิคสนาม", dept: "SERVICE", location: "SITE-B", status: "active" as const },
  ];

  const initialAttendance = [
    { name: "Somchai J.", time: "26/04 08:15", loc: "13.75, 100.52", type: "IN", status: "active" as const },
    { name: "Wipawadee R.", time: "26/04 08:30", loc: "สำนักงาน", type: "IN", status: "active" as const },
    { name: "Kriangkrai M.", time: "26/04 09:12", loc: "13.82, 100.60", type: "IN", status: "active" as const },
  ];

  const initialPayrolls = [
    { period: "เมษายน 2569", count: 48, total: "฿1,420,000", status: "pending" as const },
    { period: "มีนาคม 2569", count: 46, total: "฿1,380,000", status: "active" as const },
  ];

  const filteredEmployees = initialEmployees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAttendance = initialAttendance.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayrolls = initialPayrolls.filter(p => 
    p.period.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "profiles", label: "บุคลากร (PROFILES)", icon: <Users size={14} /> },
    { id: "attendance", label: "ลงเวลาทำงาน (GPS)", icon: <MapPin size={14} /> },
    { id: "payroll", label: "ระบบเงินเดือน (PAYROLL)", icon: <DollarSign size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">ศูนย์บริหารบุคลากร</h1>
            <p className="text-[10px] font-black text-white/30 uppercase mt-1.5 tracking-widest leading-none">Human Capital Management Hub</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Users size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">พนักงานทั้งหมด</span>
              <span className="text-[17px] font-black text-nexus-teal mt-1 mono-numbers leading-none">48 คน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <CalendarCheck size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">มาทำงานวันนี้</span>
              <span className="text-[17px] font-black text-nexus-teal mt-1 mono-numbers leading-none">45 คน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <MapPin size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">ทำงานหน้างาน</span>
              <span className="text-[17px] font-black text-nexus-blue mt-1 mono-numbers leading-none">12 คน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[110px] transition-all hover:border-white/20 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">เข้าสาย</span>
              <span className="text-[17px] font-black text-white mt-1 mono-numbers leading-none">0 คน</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <section className="px-6 py-4 bg-black/10 border-b border-white/5 shrink-0">
        <PillTabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={(id: any) => setActiveTab(id)} 
        />
      </section>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-6 space-y-6 max-w-[1800px] mx-auto">

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-10">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Activity className="text-nexus-teal" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ทะเบียนรายชื่อบุคลากร (2026-ปัจจุบัน)</p>
                    <h2 className="text-xl font-black text-white uppercase">ทะเบียนข้อมูล</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                 <PillButton variant="glass" className="px-8" onClick={() => showToast("กำลังดึงข้อมูลสลิปเงินเดือนระบบ Digital...")}>
                   <ClipboardList size={18} />
                   สลิปเงินเดือน
                 </PillButton>
                   {activeTab === "profiles" && (
                     <PillButton onClick={() => setActiveModal("employee")} className="px-8 shadow-neon-teal">
                       <Plus size={18} />
                       เพิ่มพนักงานใหม่
                     </PillButton>
                   )}
                   {activeTab === "attendance" && (
                     <PillButton onClick={() => setActiveModal("clock")} className="px-8 shadow-neon-teal">
                       <MapIcon size={18} />
                       บันทึกเวลาเข้า/ออก
                     </PillButton>
                   )}
                   {activeTab === "payroll" && (
                     <PillButton onClick={() => setActiveModal("payroll")} className="px-8 shadow-neon-teal">
                       <Wallet size={18} />
                       ประมวลผลเงินเดือน
                     </PillButton>
                   )}
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="ค้นหาพนักงาน, ตำแหน่ง, แผนก หรือรหัส EMP..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1"
                 kbd="F"
               />
               <div className="flex items-center gap-2 pr-1.5">
                  <PillButton variant="glass" className="h-11 w-11 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            {/* Profile / Attendance / Payroll Content - Conditional Rendering wrapped in standard GlassCard viewport */}
            <GlassCard className="p-0 overflow-hidden border-white/5 min-h-[640px] flex flex-col justify-between bg-black/40">
              <div className="overflow-x-auto custom-scrollbar flex-1 w-full p-2">
                {activeTab === "profiles" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["ID / ชื่อพนักงาน", "ตำแหน่ง", "แผนก", "การเข้างาน", "สถานะ"]}>
                      {filteredEmployees.map(e => (
                        <EmployeeRow key={e.id} {...e} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "attendance" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["พนักงาน", "วัน/เวลา", "พิกัด GPS", "ประเภท", "สถานะ"]}>
                      {filteredAttendance.map((a, i) => (
                        <AttendanceRow key={i} {...a} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "payroll" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["งวดเดือน", "จำนวนพนักงาน", "ยอดจ่ายสุทธิ", "สถานะการโอน", "เอกสาร"]}>
                      {filteredPayrolls.map((p, i) => (
                        <PayrollRow key={i} {...p} />
                      ))}
                    </NexusTable>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/10 flex items-center justify-between text-xs text-white/30 font-bold">
                <span>สตรีมข้อมูลคลาวด์สด • NEXUS Real-time Engine</span>
                <span>PSG Master UI Standard V3.1</span>
              </div>
            </GlassCard>
          </div>

        </div>

        {/* Right Sidebar Status */}
        <div className="space-y-6">
           <GlassCard className="p-6 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-6">ดัชนีสุขภาพบุคลากร</h4>
              <div className="space-y-6">
                 <HRMetricItem label="ความพึงพอใจพนักงาน" value="92%" />
                 <HRMetricItem label="การพัฒนาทักษะ" value="78%" />
                 <HRMetricItem label="อัตราการลาออก" value="2.4%" />
              </div>
           </GlassCard>

           <GlassCard className="p-6 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6">บันทึกเวลาเข้างานล่าสุด</h4>
              <div className="space-y-4">
                 <AttendanceFeedItem name="Somchai R." location="ศูนย์ประชุมฯ" time="08:15 AM" />
                 <AttendanceFeedItem name="Kriangkrai M." location="อาคาร PTT" time="08:42 AM" />
              </div>
           </GlassCard>
        </div>
      </div>
      </div>
      </div>

      {/* HR Management Modals */}
      <EmployeeModal 
        isOpen={activeModal === "employee"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          console.log("Saving Employee:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "HR_PROFILES", "NEW", data);
          }
          setActiveModal(null);
          showToast(`ลงทะเบียนพนักงาน ${data.firstName} สำเร็จ`);
        }}
      />

      <AttendanceModal 
        isOpen={activeModal === "clock"} 
        onClose={() => setActiveModal(null)}
        onConfirm={async (data) => {
          console.log("Saving Attendance:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "HR_ATTENDANCE", "NEW", data);
          }
          setActiveModal(null);
          showToast(`บันทึกเวลา ${data.type === "IN" ? "เข้างาน" : "ออกงาน"} สำเร็จ`);
        }}
      />

      <PayrollModal 
        isOpen={activeModal === "payroll"} 
        onClose={() => setActiveModal(null)}
        onConfirm={async (data) => {
          console.log("Confirming Payroll:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "HR_PAYROLL", "NEW", data);
          }
          setActiveModal(null);
          showToast(`ประมวลผลเงินเดือนสำเร็จ (Total: ฿${data.netPayout?.toLocaleString() || '0'})`);
        }}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
}

function EmployeeRow({ id, name, role, dept, location, status }: { id: string, name: string, role: string, dept: string, location: string, status: "active" | "danger" }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[300px]">
        <Link href={`/hr/employees/${id}`} className="block">
           <p className="font-mono text-[10px] text-nexus-blue font-black tracking-tighter">{id}</p>
           <p className="font-black text-white/80 group-hover:text-white transition-colors">{name}</p>
        </Link>
      </NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{role}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[11px] font-black text-white/40 uppercase tracking-widest">{dept}</NexusTableCell>
      <NexusTableCell>
         <div className="flex items-center gap-2">
            <MapIcon size={12} className="text-nexus-blue" />
            <span className="text-[10px] font-black text-white/60 uppercase">{location}</span>
         </div>
      </NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status} label="ปฏิบัติงาน" />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function AttendanceRow({ name, time, loc, type, status }: { name: string, time: string, loc: string, type: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-black text-white">{name}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{time}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[11px] font-black text-nexus-blue uppercase tracking-widest">{loc}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[11px] font-black text-nexus-teal uppercase tracking-widest">{type}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label="บันทึกแล้ว" /></NexusTableCell>
    </NexusTableRow>
  );
}

function PayrollRow({ period, count, total, status }: { period: string, count: number, total: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-black text-white">{period}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[11px] font-black text-white/40 uppercase tracking-widest">{count} คน</NexusTableCell>
      <NexusTableCell className="w-[180px] text-right font-black text-nexus-teal mono-numbers">{total}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label={status === "active" ? "โอนแล้ว" : "รอดำเนินการ"} /></NexusTableCell>
      <NexusTableCell className="w-[120px]"><PillButton variant="glass" className="px-4 text-[10px]">ดาวน์โหลด</PillButton></NexusTableCell>
    </NexusTableRow>
  );
}

function HRMetricItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <span className="text-white/30">{label}</span>
          <span className="text-white/80">{value}</span>
       </div>
       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-nexus-teal" style={{ width: value }} />
       </div>
    </div>
  );
}

function AttendanceFeedItem({ name, location, time }: { name: string, location: string, time: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all">
       <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue group-hover:shadow-neon-blue transition-all">
          <Clock size={16} />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white truncate">{name}</p>
          <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.1em] mt-0.5">{location} • {time}</p>
       </div>
    </div>
  );
}
