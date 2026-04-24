"use client";

import React from "react";
import { 
  UserCog, 
  UserPlus, 
  ShieldCheck, 
  Activity,
  Search,
  MoreHorizontal,
  Mail,
  Phone
} from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";

export default function HRPage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">ทรัพยากรบุคคล (HR & Access)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Personnel & Security Management</p>
        </div>
        <PillButton className="gap-2 shadow-nexus-glow">
          <UserPlus size={18} />
          เพิ่มบุคลากร
        </PillButton>
      </div>

      {/* HR Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HRStat label="บุคลากรทั้งหมด" value="28" sub="Active Employees" />
        <HRStat label="ฝ่ายปฏิบัติการ" value="15" sub="Field Engineers" />
        <HRStat label="ฝ่ายบริหาร/บัญชี" value="5" sub="Office Staff" />
        <HRStat label="สิทธิ์ Superadmin" value="2" sub="Security Level 10" />
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <PillInput placeholder="ค้นหาชื่อ, แผนก, หรืออีเมล..." className="w-full pl-12 h-12 bg-white/[0.03]" />
        </div>
      </div>

      {/* Employee List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <EmployeeCard name="admin@admin.com" role="Superadmin" dept="Executive" status="Online" />
        <EmployeeCard name="Somsak Lovegood" role="Senior Engineer" dept="Operations" status="Field" />
        <EmployeeCard name="Wichai Network" role="Technician" dept="Operations" status="Offline" />
        <EmployeeCard name="Kanya Finance" role="Accountant" dept="Finance" status="Online" />
        <EmployeeCard name="Piti Project" role="Project Manager" dept="Management" status="Online" />
      </div>
    </div>
  );
}

function HRStat({ label, value, sub }: { label: string, value: string, sub: string }) {
  return (
    <GlassCard className="p-6 border-white/5 bg-[#0a0a0c]">
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h4 className="text-3xl font-black text-white mb-1">{value}</h4>
      <p className="text-[10px] text-nexus-teal font-bold uppercase tracking-widest">{sub}</p>
    </GlassCard>
  );
}

function EmployeeCard({ name, role, dept, status }: { name: string, role: string, dept: string, status: string }) {
  const statusConfig: any = {
    Online: "bg-nexus-teal shadow-[0_0_8px_rgba(16,187,168,0.5)]",
    Field: "bg-nexus-blue shadow-[0_0_8px_rgba(20,163,204,0.5)]",
    Offline: "bg-white/10",
  };

  return (
    <GlassCard className="p-6 border-white/5 hover:border-nexus-teal/20 transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-nexus-teal transition-colors">
            <UserCog size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white truncate w-32 group-hover:text-nexus-teal transition-colors">{name}</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{role}</p>
          </div>
        </div>
        <div className={cn("w-2 h-2 rounded-full", statusConfig[status])} />
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3 text-[10px] text-white/40 font-bold uppercase tracking-widest">
          <ShieldCheck size={14} className="text-nexus-teal" />
          Dept: {dept}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/40 font-bold uppercase tracking-widest">
          <Mail size={14} />
          {name.toLowerCase()}
        </div>
      </div>

      <div className="flex gap-2">
        <PillButton variant="glass" className="flex-1 h-8 text-[9px] font-black uppercase tracking-widest">Edit Profile</PillButton>
        <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </GlassCard>
  );
}
