"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap, 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  Network,
  Activity,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/components/ui/Base";

export function QuantumRiskEngine() {
  const [riskLevel, setRiskLevel] = useState(12.5);
  const [status, setStatus] = useState<"secure" | "warning" | "critical">("secure");

  useEffect(() => {
    const interval = setInterval(() => {
       const change = (Math.random() - 0.5) * 2;
       setRiskLevel(prev => Math.max(5, Math.min(95, prev + change)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
     if (riskLevel > 80) setStatus("critical");
     else if (riskLevel > 50) setStatus("warning");
     else setStatus("secure");
  }, [riskLevel]);

  return (
    <div className="p-10 rounded-2xl bg-surface-0 border border-white/5 relative overflow-hidden group">
       {/* Animated Background Grid */}
       <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#00f3ff_1px,transparent_1px)] [background-size:20px_20px] animate-pulse" />
       
       <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1 space-y-8">
             <div className="flex items-center gap-4">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700", 
                   status === "secure" ? "bg-nexus-teal/10 text-nexus-teal shadow-neon-teal/20" :
                   status === "warning" ? "bg-warning/10 text-warning shadow-neon-warning/20" :
                   "bg-danger/10 text-danger shadow-neon-danger/20"
                )}>
                   <Cpu size={32} />
                </div>
                <div>
                   <h4 className="text-2xl font-semibold text-white uppercase tracking-tight">Quantum Risk Engine</h4>
                   <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Business Continuity Simulation V6.0</p>
                </div>
             </div>

             <div className="space-y-4">
                <p className="text-[12px] text-white/60 font-bold leading-relaxed max-w-xl">
                   "Engaging multi-layer simulation for current fiscal period. Analysis incorporates supply chain volatility, currency fluctuation (THB/USD), and regional labor metrics."
                </p>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2 text-[10px] font-semibold text-nexus-teal uppercase tracking-widest">
                      <ShieldCheck size={14} /> AI Nodes: Online
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-semibold text-nexus-blue uppercase tracking-widest">
                      <Network size={14} /> Neural Path: Active
                   </div>
                </div>
             </div>
          </div>

          <div className="w-full lg:w-[400px] flex flex-col items-center justify-center space-y-8 p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
             <div className="relative">
                <svg className="w-48 h-48 transform -rotate-90">
                   <circle cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                   <circle 
                      cx="96" 
                      cy="96" 
                      r="80" 
                      fill="transparent" 
                      stroke="currentColor" 
                      strokeWidth="12" 
                      strokeDasharray={502.6} 
                      strokeDashoffset={502.6 - (502.6 * riskLevel / 100)} 
                      className={cn("transition-all duration-1000", 
                         status === "secure" ? "text-nexus-teal drop-shadow-neon-teal" :
                         status === "warning" ? "text-warning drop-shadow-neon-warning" :
                         "text-danger drop-shadow-neon-danger"
                      )} 
                   />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                   <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">Risk Level</p>
                   <p className={cn("text-5xl font-black transition-colors duration-1000", 
                      status === "secure" ? "text-white" :
                      status === "warning" ? "text-warning" :
                      "text-danger"
                   )}>
                      {riskLevel.toFixed(1)}%
                   </p>
                </div>
             </div>

             <div className="w-full space-y-2">
                <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest">
                   <span className="text-white/20">Status:</span>
                   <span className={cn(
                      status === "secure" ? "text-nexus-teal" :
                      status === "warning" ? "text-warning" :
                      "text-danger"
                   )}>{status.toUpperCase()}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                   <div 
                      className={cn("h-full transition-all duration-1000", 
                         status === "secure" ? "bg-nexus-teal" :
                         status === "warning" ? "bg-warning" :
                         "bg-danger"
                      )}
                      style={{ width: `${riskLevel}%` }}
                   />
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}
