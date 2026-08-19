"use client";

import React, { useState } from "react";
import { 
  Timer, 
  TrendingUp, 
  Compass, 
  Target,
  Zap,
  Sparkles,
  BarChart
} from "lucide-react";
import { cn } from "@/components/ui/Base";

export function TemporalForecaster() {
  const [selectedYear, setSelectedYear] = useState(2030);

  const projections = {
    2027: { revenue: "฿124M", growth: "+45%", risk: "Low", insight: "Market expansion into South East Asia completed." },
    2030: { revenue: "฿580M", growth: "+120%", risk: "Medium", insight: "Dominating AI-driven infrastructure integration sector." },
    2035: { revenue: "฿2.4B", growth: "+310%", risk: "High", insight: "Autonomous entity network reaches full maturity." },
  };

  const current = projections[selectedYear as keyof typeof projections];

  return (
    <div className="p-12 rounded-2xl bg-[#050505] border border-white/5 relative overflow-hidden group">
       {/* Background Temporal Distortion (CSS Animation) */}
       <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-nexus-teal via-transparent to-nexus-blue animate-pulse" />
          <div className="h-full w-full bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05)_0px,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_40px)]" />
       </div>

       <div className="relative z-10 space-y-12">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-2xl transition-transform group-hover:scale-110">
                   <Timer size={32} className="text-nexus-teal animate-spin-slow" />
                </div>
                <div>
                   <h4 className="text-2xl font-black text-white uppercase tracking-tight">Temporal Forecasting Engine</h4>
                   <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.4em]">Multi-Decade AI Projection V8.0</p>
                </div>
             </div>

             <div className="flex gap-4 p-2 rounded-full bg-white/5 border border-white/5">
                {[2027, 2030, 2035].map(year => (
                   <button 
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={cn(
                        "px-8 py-3 rounded-full text-[12px] font-black transition-all",
                        selectedYear === year ? "bg-nexus-teal text-black shadow-neon-teal" : "text-white/20 hover:text-white"
                      )}
                   >
                      {year}
                   </button>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
             <TemporalMetricCard label="Projected Gross Revenue" value={current.revenue} icon={<BarChart size={24} />} />
             <TemporalMetricCard label="Market Growth Index" value={current.growth} icon={<TrendingUp size={24} />} color="text-nexus-teal" />
             <TemporalMetricCard label="Strategic Risk Level" value={current.risk} icon={<Compass size={24} />} color="text-warning" />
          </div>

          <div className="p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-nexus-teal shadow-neon-teal opacity-50" />
             <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-nexus-teal" />
                <h5 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest">Temporal Intelligence Insight</h5>
             </div>
             <p className="text-xl font-medium text-white/80 leading-relaxed max-w-3xl">
                "{current.insight}"
             </p>
             <div className="pt-6 flex gap-8">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-widest">
                   <Target size={14} /> Confidence: 92.4%
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-widest">
                   <Zap size={14} /> Delta Variance: 4.2%
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

function TemporalMetricCard({ label, value, icon, color = "text-white" }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
  return (
    <div className="p-8 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4 hover:bg-white/[0.03] transition-all group/card">
       <div className="text-white/10 group-hover/card:text-white transition-colors">{icon}</div>
       <div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</p>
          <p className={cn("text-4xl font-black mt-2", color)}>{value}</p>
       </div>
    </div>
  );
}
