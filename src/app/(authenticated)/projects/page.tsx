"use client";

import React from "react";
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  MoreVertical,
  Target,
  BarChart4
} from "lucide-react";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";

export default function ProjectsPage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">บริหารโครงการ (Project Hub)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Project Strategy & Resource Tracking</p>
        </div>
        <PillButton className="gap-2 shadow-nexus-glow">
          <Plus size={18} />
          เริ่มโครงการใหม่
        </PillButton>
      </div>

      {/* Project Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatusCard icon={<Target size={20} />} label="โครงการทั้งหมด" value="12" color="text-white" />
        <StatusCard icon={<Clock size={20} />} label="กำลังดำเนินการ" value="8" color="text-nexus-blue" />
        <StatusCard icon={<CheckCircle2 size={20} />} label="เสร็จสิ้นแล้ว" value="3" color="text-nexus-teal" />
        <StatusCard icon={<AlertCircle size={20} />} label="ล่าช้า/วิกฤต" value="1" color="text-danger" />
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ProjectCard 
          title="ติดตั้งระบบ Network PSG HQ" 
          client="PSG Solutions" 
          progress={75} 
          budget="฿1,200,000" 
          status="Active" 
          deadline="20 May 2026"
        />
        <ProjectCard 
          title="วางระบบ Fiber Optic โซน B" 
          client="Industrial Estate A" 
          progress={30} 
          budget="฿450,000" 
          status="Active" 
          deadline="15 June 2026"
        />
        <ProjectCard 
          title="MA ระบบ Security CCTV 2026" 
          client="Government Sector X" 
          progress={100} 
          budget="฿85,000" 
          status="Completed" 
          deadline="01 Apr 2026"
        />
        <ProjectCard 
          title="พัฒนา ERP Phase 2 (Intelligence)" 
          client="Internal System" 
          progress={15} 
          budget="฿0" 
          status="Critical" 
          deadline="30 Dec 2026"
        />
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <GlassCard className="p-6 border-white/5 bg-[#0a0a0c]">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-white/5 border border-white/10", color)}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h4 className="text-3xl font-black text-white">{value}</h4>
    </GlassCard>
  );
}

function ProjectCard({ title, client, progress, budget, status, deadline }: { title: string, client: string, progress: number, budget: string, status: string, deadline: string }) {
  const statusConfig: any = {
    Active: { color: "text-nexus-blue", bg: "bg-nexus-blue/10" },
    Completed: { color: "text-nexus-teal", bg: "bg-nexus-teal/10" },
    Critical: { color: "text-danger", bg: "bg-danger/10" },
  };

  return (
    <GlassCard className="p-8 border-white/5 hover:border-white/20 transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase mb-3 inline-block", statusConfig[status].color, statusConfig[status].bg)}>
            {status}
          </span>
          <h3 className="text-lg font-black text-white group-hover:text-nexus-teal transition-colors leading-tight">{title}</h3>
          <p className="text-xs text-white/40 mt-1">{client}</p>
        </div>
        <button className="text-white/20 hover:text-white"><MoreVertical size={20} /></button>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Progress</p>
          <p className="text-xs font-black text-nexus-teal">{progress}%</p>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div 
            className={cn("h-full transition-all duration-1000 ease-out", progress === 100 ? "bg-nexus-teal shadow-[0_0_10px_rgba(16,187,168,0.5)]" : "bg-nexus-blue")} 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Budget</p>
            <p className="text-xs font-bold text-white mono-numbers">{budget}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Deadline</p>
            <p className="text-xs font-bold text-white/60">{deadline}</p>
          </div>
        </div>
        <div className="flex -space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-8 h-8 rounded-full bg-white/5 border-2 border-[#0a0a0c] flex items-center justify-center text-[10px] text-white/40 font-bold">
              U{i}
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
