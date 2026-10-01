"use client";

import React from "react";
import { cn } from "@/components/ui/Base";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Milestone {
  id: string;
  task: string;
  start: string; // e.g. "2026-04-01"
  end: string;
  progress: number;
  status: "completed" | "in-progress" | "pending";
}

interface GanttChartProps {
  milestones: Milestone[];
}

export function GanttChart({ milestones }: GanttChartProps) {
  // Simple Gantt Logic for V4.0
  const months = ["เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค."];
  
  return (
    <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
       <div className="grid grid-cols-[300px_1fr] divide-x divide-white/5">
          {/* Left Side: Task List */}
          <div className="bg-black/20">
             <div className="h-14 border-b border-white/5 flex items-center px-8">
                <span className="text-xs font-semibold text-white/60 tracking-wider">ชื่อแผนงาน</span>
             </div>
             <div className="divide-y divide-white/5">
                {milestones.map((m) => (
                   <div key={m.id} className="h-16 flex flex-col justify-center px-8 space-y-1">
                      <p className="text-sm font-bold text-white tracking-tight truncate">{m.task}</p>
                      <div className="flex items-center gap-2">
                         <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", 
                            m.status === "completed" ? "bg-nexus-teal/10 text-nexus-teal" :
                            m.status === "in-progress" ? "bg-nexus-blue/10 text-nexus-blue" :
                            "bg-white/5 text-white/40"
                         )}>
                            {m.status === "completed" ? "เสร็จสิ้น" : m.status === "in-progress" ? "กำลังดำเนินการ" : "รอดำเนินการ"}
                         </span>
                         <span className="text-xs font-semibold text-white/60">{m.progress}%</span>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Right Side: Timeline Grid */}
          <div className="overflow-x-auto custom-scrollbar">
             <div className="min-w-[800px]">
                <div className="h-14 border-b border-white/5 grid grid-cols-4 divide-x divide-white/5">
                   {months.map((month) => (
                      <div key={month} className="flex items-center justify-center text-xs font-semibold text-white/60 tracking-wider">
                         {month} 2569
                      </div>
                   ))}
                </div>
                <div className="relative divide-y divide-white/5">
                   {/* Background Grid Lines */}
                   <div className="absolute inset-0 grid grid-cols-4 divide-x divide-white/5 pointer-events-none" />
                   
                   {milestones.map((m, idx) => (
                      <div key={m.id} className="h-16 relative flex items-center px-4">
                         {/* Gantt Bar */}
                         <div 
                            className={cn("h-8 rounded-xl relative group cursor-pointer transition-all hover:scale-[1.02]",
                               m.status === "completed" ? "bg-nexus-teal/20 border border-nexus-teal/30" :
                               m.status === "in-progress" ? "bg-nexus-blue/20 border border-nexus-blue/30" :
                               "bg-white/5 border border-white/10"
                            )}
                            style={{ 
                               marginLeft: `${idx * 15}%`, // Simple positioning for demo
                               width: `${25 + (m.progress / 2)}%` 
                            }}
                         >
                            <div 
                               className={cn("absolute inset-y-0 left-0 rounded-l-xl transition-all opacity-50",
                                  m.status === "completed" ? "bg-nexus-teal shadow-neon-teal" :
                                  m.status === "in-progress" ? "bg-nexus-blue shadow-neon-blue animate-pulse" :
                                  "bg-white/10"
                               )}
                               style={{ width: `${m.progress}%` }}
                            />
                            
                            {/* Tooltip on Hover */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-xl whitespace-nowrap z-[9999] shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                <p className="text-xs font-bold text-cyan-100">เสร็จสมบูรณ์ {m.progress}%</p>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}
