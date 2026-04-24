"use client";

import React, { useState } from "react";
import { PillButton, GlassCard } from "@/components/ui/Base";
import { 
  Briefcase, 
  Plus, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Users,
  Layers,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/components/ui/Base";

// Mock Project Data
const MOCK_PROJECTS = [
  { id: "PRJ-24-001", name: "ติดตั้ง Network โรงพยาบาลภูมิพล", client: "กองทัพอากาศ", progress: 65, budget: 1500000, margin: 28, status: "Active" },
  { id: "PRJ-24-002", name: "CCTV System - คอนโด Nexus Park", client: "Nexus Property", progress: 100, budget: 450000, margin: 32, status: "Completed" },
  { id: "PRJ-24-003", name: "LED Wall - Event Hall A", client: "Exhibition Thailand", progress: 15, budget: 2800000, margin: 24, status: "Planning" },
];

export default function ProjectsPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent p-8">
      {/* Module Header */}
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-3xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">บริหารโครงการ (Project Hub)</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Strategic Project Control</p>
          </div>
        </div>
        <PillButton className="gap-2 shadow-nexus-glow">
          <Plus size={18} />
          สร้างโครงการใหม่
        </PillButton>
      </header>

      {/* Project Metrics Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <MetricCard icon={<TrendingUp size={20} />} label="โครงการทั้งหมด" value="12" subValue="+2 เดือนนี้" color="text-nexus-blue" />
        <MetricCard icon={<CheckCircle2 size={20} />} label="เสร็จสมบูรณ์" value="8" subValue="85% Success Rate" color="text-nexus-teal" />
        <MetricCard icon={<BarChart3 size={20} />} label="กำไรเฉลี่ย (Avg Margin)" value="28.5%" subValue="สูงกว่าเป้าหมาย 3.5%" color="text-nexus-blue" />
      </section>

      {/* Project List */}
      <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-8">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest ml-4 mb-4">รายชื่อโครงการที่กำลังดำเนินงาน</h2>
        {MOCK_PROJECTS.map((prj) => (
          <GlassCard key={prj.id} className="p-0 border-white/5 hover:border-nexus-blue/30 transition-all cursor-pointer group">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-6 flex-1">
                <div className={cn(
                  "w-2 h-12 rounded-full",
                  prj.status === "Completed" ? "bg-nexus-teal shadow-[0_0_10px_rgba(16,187,168,0.5)]" : 
                  prj.status === "Active" ? "bg-nexus-blue shadow-[0_0_10px_rgba(20,163,204,0.5)]" : "bg-white/10"
                )} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-mono text-nexus-blue tracking-tighter">{prj.id}</span>
                    <span className="text-xs text-white/40">|</span>
                    <span className="text-xs text-white/40 uppercase font-bold tracking-wider">{prj.client}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-nexus-blue transition-colors">{prj.name}</h3>
                </div>
              </div>

              <div className="flex items-center gap-12 text-right">
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">Budget</p>
                  <p className="text-sm font-bold text-white mono-numbers">฿{prj.budget.toLocaleString()}</p>
                </div>
                <div className="w-40">
                  <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-2 flex justify-between">
                    Progress <span>{prj.progress}%</span>
                  </p>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-nexus-blue shadow-nexus-glow transition-all duration-1000" 
                      style={{ width: `${prj.progress}%` }} 
                    />
                  </div>
                </div>
                <div className="w-20">
                  <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">Margin</p>
                  <p className="text-sm font-bold text-nexus-teal mono-numbers">{prj.margin}%</p>
                </div>
                <div className="w-10 flex justify-end">
                  <ArrowUpRight className="text-white/20 group-hover:text-nexus-blue transition-all" size={20} />
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, subValue, color }: { icon: any, label: string, value: string, subValue: string, color: string }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10", color)}>
          {icon}
        </div>
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <h4 className="text-3xl font-bold text-white tracking-tight mono-numbers">{value}</h4>
        <span className="text-[10px] text-white/30 font-bold mb-1">{subValue}</span>
      </div>
    </GlassCard>
  );
}
