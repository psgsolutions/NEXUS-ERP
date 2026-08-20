"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
import { DocumentFlowStepper } from "@/components/ui/DocumentFlowStepper";

import { EmployeeModal } from "@/components/hr/EmployeeModal";
import { AttendanceModal } from "@/components/hr/AttendanceModal";
import { PayrollModal } from "@/components/hr/PayrollModal";
import { getAuth } from "firebase/auth";
import { nexusSequenceEngine } from "@/lib/sequence-engine";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { saveToFirestore } from "@/lib/firebaseUtils";
import { SecureDeleteAction } from "@/components/ui/SecureDeleteAction";
import Link from "next/link";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
type HRSubModule = "profiles" | "attendance" | "payroll" | "expenses";

export default function HRPage() {
  const router = useRouter();
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<HRSubModule>("profiles");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const { showAlert } = useSystemDialog();

  const { data: dbEmployees, loading: employeesLoading } = useRealtimeCollection<any>('employees');
  const { data: dbAttendance, loading: attendanceLoading } = useRealtimeCollection<any>('attendance');
  const { data: dbPayrolls, loading: payrollsLoading } = useRealtimeCollection<any>('payrolls');
  const { data: dbExpenses, loading: expensesLoading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/expenses` : 'expenses');

  const employeesList = dbEmployees.map(e => ({
    id: e.employeeId || e.id,
    name: e.name || `${e.prefix === 'Mr.' ? 'นาย' : e.prefix === 'Mrs.' ? 'นาง' : e.prefix === 'Ms.' ? 'นางสาว' : 'คุณ'}${e.firstName || ''} ${e.lastName || ''}`.trim(),
    role: e.position || e.role || 'Unknown',
    dept: e.department || e.dept || 'Unknown',
    location: e.location || 'สำนักงาน',
    status: e.status || 'active'
  }));

  const attendanceList = dbAttendance.map(a => ({
    name: a.name || 'Unknown',
    time: a.time || '-',
    loc: a.loc || 'สำนักงาน',
    type: a.type || 'IN',
    status: a.status || 'active'
  }));

  const payrollsList = dbPayrolls.map(p => ({
    period: p.period || '-',
    count: p.count || 0,
    total: p.total || '฿0',
    status: p.status || 'pending'
  }));

  const expensesList = dbExpenses.map(e => ({
    id: e.id,
    date: e.date || '-',
    employeeName: e.employeeName || e.requestedBy || 'Unknown',
    description: e.description || '-',
    amount: e.amount || 0,
    status: e.status || 'pending_approval'
  }));

  const filteredEmployees = employeesList.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAttendance = attendanceList.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayrolls = payrollsList.filter(p => 
    p.period.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExpenses = expensesList.filter(e => 
    e.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const showToast = (message: string) => {
    showAlert(message, "System Notification", "info");
  };

  const tabs = [
    { id: "profiles", label: "บุคลากร", icon: <Users size={14} /> },
    { id: "attendance", label: "ลงเวลาทำงาน", icon: <MapPin size={14} /> },
    { id: "payroll", label: "ระบบเงินเดือน", icon: <DollarSign size={14} /> },
    { id: "expenses", label: "อนุมัติเบิกจ่าย", icon: <Wallet size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ศูนย์บริหารบุคลากร</h1>
            <p className="text-[11px] font-medium text-white/30 uppercase mt-1.5 tracking-widest leading-none">Human Capital Management Hub</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Users size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">พนักงานทั้งหมด</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-1 mono-numbers leading-none">48 คน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <CalendarCheck size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">มาทำงานวันนี้</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-1 mono-numbers leading-none">45 คน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <MapPin size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">ทำงานหน้างาน</span>
              <span className="text-[17px] font-bold text-nexus-blue mt-1 mono-numbers leading-none">12 คน</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[110px] transition-all hover:border-white/20 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">เข้าสาย</span>
              <span className="text-[17px] font-bold text-white mt-1 mono-numbers leading-none">0 คน</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-5 space-y-3 max-w-[1800px] mx-auto">

      <div className="flex flex-col xl:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-10">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Activity className="text-nexus-teal" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-white/20 uppercase tracking-widest">ทะเบียนรายชื่อบุคลากร (2026-ปัจจุบัน)</p>
                    <h2 className="text-xl font-bold text-white uppercase">ทะเบียนข้อมูล</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                 <PillButton variant="glass" className="h-9 px-6 rounded-full" onClick={() => showToast("กำลังดึงข้อมูลสลิปเงินเดือนระบบ Digital...")}>
                   <ClipboardList size={18} />
                   สลิปเงินเดือน
                 </PillButton>
                 <PillButton 
                    onClick={() => {
                       if (activeTab === "profiles") router.push("/hr/employees/new");
                       else if (activeTab === "attendance") router.push("/hr/attendance/new");
                       else if (activeTab === "payroll") router.push("/hr/payroll/new");
                    }} 
                 >
                    {activeTab === "profiles" ? <Plus size={18} /> : 
                     activeTab === "attendance" ? <MapIcon size={18} /> : 
                     <Wallet size={18} />}
                    {
                       activeTab === "profiles" ? "เพิ่มพนักงานใหม่" : 
                       activeTab === "attendance" ? "บันทึกเวลาเข้า/ออก" : 
                       activeTab === "expenses" ? "บันทึกค่าใช้จ่ายใหม่" :
                       "ประมวลผลเงินเดือน"
                    }
                 </PillButton>
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="พิมพ์เพื่อค้นหา..." 
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
                    <NexusTable headers={["รหัสพนักงาน", "ตำแหน่ง", "แผนก", "สถานที่ทำงาน", "สถานะ", "จัดการ"]}>
                      {employeesLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredEmployees.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredEmployees.map(e => (
                        <EmployeeRow key={e.id} {...e} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "attendance" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["พนักงาน", "วัน/เวลา", "พิกัด GPS", "ประเภท", "สถานะ"]}>
                      {attendanceLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredAttendance.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredAttendance.map((a, i) => (
                        <AttendanceRow key={i} {...a} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "payroll" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["งวดเดือน", "จำนวนพนักงาน", "ยอดจ่ายสุทธิ", "สถานะการโอน", "เอกสาร"]}>
                      {payrollsLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredPayrolls.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredPayrolls.map((p, i) => (
                        <PayrollRow key={i} {...p} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "expenses" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["วันที่", "ผู้เบิก / พนักงาน", "รายละเอียด", "จำนวนเงิน", "สถานะ", "จัดการ"]}>
                      {expensesLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredExpenses.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ไม่มีรายการรออนุมัติ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredExpenses.map((e, i) => (
                        <ExpenseRow key={i} {...e} onApprove={() => showToast(`อนุมัติรายการ ${e.description} แล้ว (ข้อมูลไหลไปตั้งหนี้ AP)`)} />
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
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
           <GlassCard className="p-4 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[12px] font-medium text-nexus-teal uppercase tracking-widest mb-6">ดัชนีสุขภาพบุคลากร</h4>
              <div className="space-y-3">
                 <HRMetricItem label="ความพึงพอใจพนักงาน" value="92%" />
                 <HRMetricItem label="การพัฒนาทักษะ" value="78%" />
                 <HRMetricItem label="อัตราการลาออก" value="2.4%" />
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6">บันทึกเวลาเข้างานล่าสุด</h4>
              <div className="space-y-3">
                 <AttendanceFeedItem name="Somchai R." location="ศูนย์ประชุมฯ" time="08:15 AM" />
                 <AttendanceFeedItem name="Kriangkrai M." location="อาคาร PTT" time="08:42 AM" />
              </div>
           </GlassCard>
        </div>
      </div>
      </div>
      </div>

      {/* HR Management Modals */}
      

      

      
    </div>
  );
}

function EmployeeRow({ id, name, role, dept, location, status }: { id: string, name: string, role: string, dept: string, location: string, status: "active" | "danger" }) {
  const router = useRouter();
  return (
    <NexusTableRow onClick={() => router.push(`/hr/employees/${id}`)}>
      <NexusTableCell className="w-[300px]">
        <div className="block">
           <p className="font-mono text-[12px] text-nexus-blue font-medium tracking-tighter">{id}</p>
           <p className="font-bold text-white/80 group-hover:text-white transition-colors">{name}</p>
        </div>
      </NexusTableCell>
      <NexusTableCell className="w-[180px] text-[12px] font-medium text-white/40 uppercase tracking-widest">{role}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[12px] font-medium text-white/40 uppercase tracking-widest">{dept}</NexusTableCell>
      <NexusTableCell>
         <div className="flex items-center gap-2">
            <MapIcon size={12} className="text-nexus-blue" />
            <span className="text-[11px] font-medium text-white/60 uppercase">{location}</span>
         </div>
      </NexusTableCell>
      <NexusTableCell className="text-center w-[180px]">
        <StatusBadge status={status} label="ปฏิบัติงาน" />
      </NexusTableCell>
      <NexusTableCell className="w-[80px]">
         <div onClick={(e) => e.stopPropagation()}>
            <SecureDeleteAction collectionName="employees" documentId={id} displayName={name} compact />
         </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function AttendanceRow({ name, time, loc, type, status }: { name: string, time: string, loc: string, type: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white">{name}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[12px] font-medium text-white/40 uppercase tracking-widest">{time}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[12px] font-medium text-nexus-blue uppercase tracking-widest">{loc}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[12px] font-medium text-nexus-teal uppercase tracking-widest">{type}</NexusTableCell>
      <NexusTableCell className="text-center w-[180px]">
        <StatusBadge status={status} label="บันทึกแล้ว" />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PayrollRow({ period, count, total, status }: { period: string, count: number, total: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white">{period}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[12px] font-medium text-white/40 uppercase tracking-widest">{count} คน</NexusTableCell>
      <NexusTableCell className="w-[180px] text-right font-bold text-nexus-teal mono-numbers">{total}</NexusTableCell>
      <NexusTableCell className="text-center w-[180px]">
        <StatusBadge status={status} label={status === "active" ? "โอนแล้ว" : "รอดำเนินการ"} />
      </NexusTableCell>
      <NexusTableCell className="w-[120px]"><PillButton variant="glass" className="px-4 text-[10px]">ดาวน์โหลด</PillButton></NexusTableCell>
    </NexusTableRow>
  );
}

function HRMetricItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[11px] font-medium uppercase tracking-widest">
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
          <p className="text-sm font-medium text-white truncate">{name}</p>
          <p className="text-[12px] text-white/30 uppercase font-medium tracking-[0.1em] mt-0.5">{location} • {time}</p>
       </div>
    </div>
  );
}

function ExpenseRow({ id, date, employeeName, description, amount, status, onApprove }: any) {
  const isPending = status === 'pending_approval';
  
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[120px] font-mono text-[11px] text-white/50">{date}</NexusTableCell>
      <NexusTableCell className="font-bold text-white">{employeeName}</NexusTableCell>
      <NexusTableCell className="text-[12px] text-white/70">{description}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-warning mono-numbers">฿{amount.toLocaleString()}</NexusTableCell>
      <NexusTableCell className="text-center w-[180px]">
        <StatusBadge status={isPending ? "pending" : "active"} label={isPending ? "รออนุมัติ" : "อนุมัติแล้ว"} />
      </NexusTableCell>
      <NexusTableCell className="w-[150px]">
        {isPending && (
          <div className="flex gap-2">
            <PillButton className="h-7 px-3 text-[10px] bg-nexus-teal shadow-neon-teal" onClick={onApprove}>Approve</PillButton>
          </div>
        )}
      </NexusTableCell>
    </NexusTableRow>
  );
}
