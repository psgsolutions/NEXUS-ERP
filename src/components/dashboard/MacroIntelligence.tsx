"use client";

import React, { useState, useEffect } from "react";
import { 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  AlertCircle,
  Sparkles,
  Zap
} from "lucide-react";
import { cn } from "@/components/ui/Base";

export function MacroIntelligence() {
  const [trends, setTrends] = useState([
    { id: 1, label: "Global Semi Index", value: "+12.4%", status: "positive", detail: "ความต้องการชิปเพิ่มขึ้นในตลาดอาเซียน" },
    { id: 2, label: "THB/USD Exchange", value: "36.85", status: "negative", detail: "เงินบาทอ่อนตัว กระทบต้นทุนนำเข้าพัสดุ 4.2%" },
    { id: 3, label: "Copper Futures", value: "-2.1%", status: "positive", detail: "ต้นทุนสายสัญญาณเริ่มทรงตัวและลดลง" },
  ]);

  return (
    <div className="p-10 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/20 relative overflow-hidden group">
       <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
          <Globe size={180} />
       </div>

       <div className="relative z-10 space-y-10">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shadow-neon-blue/20">
                   <Sparkles size={24} />
                </div>
                <div>
                   <h4 className="text-xl font-semibold text-white uppercase tracking-tight">Macro Intelligence Engine</h4>
                   <p className="text-[10px] font-bold text-nexus-blue uppercase tracking-[0.3em]">Global Market Analysis V7.0</p>
                </div>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                <Zap size={14} className="text-nexus-blue animate-pulse" /> Source: Bloomberg Terminal Node
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {trends.map((trend) => (
                <div key={trend.id} className="p-6 rounded-xl bg-black/40 border border-white/5 space-y-4 hover:border-nexus-blue/30 transition-all group/card">
                   <div className="flex justify-between items-start">
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{trend.label}</p>
                      <div className={cn("p-1 rounded-full", trend.status === "positive" ? "text-nexus-teal" : "text-danger")}>
                         {trend.status === "positive" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                   </div>
                   <div>
                      <p className={cn("text-3xl font-black transition-colors", trend.status === "positive" ? "text-nexus-teal" : "text-danger")}>
                         {trend.value}
                      </p>
                      <p className="text-[11px] text-white/50 font-medium leading-relaxed mt-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                         {trend.detail}
                      </p>
                   </div>
                </div>
             ))}
          </div>

          <div className="p-6 rounded-2xl bg-nexus-blue/10 border border-nexus-blue/20 flex items-center gap-6">
             <div className="w-10 h-10 rounded-xl bg-nexus-blue/20 flex items-center justify-center text-nexus-blue flex-shrink-0">
                <AlertCircle size={20} />
             </div>
             <div>
                <p className="text-[10px] font-black text-nexus-blue uppercase tracking-widest mb-1">AI STRATEGIC ADVISORY</p>
                <p className="text-sm font-bold text-white/80 leading-relaxed">
                   "แนะนำให้เร่งปิดดีลใบสั่งซื้อพัสดุโครงการ <span className="text-nexus-blue">PSG-RAYONG-26</span> ภายในสัปดาห์นี้ เพื่อหลีกเลี่ยงผลกระทบจากค่าเงินบาทที่มีแนวโน้มอ่อนตัวต่อเนื่อง"
                </p>
             </div>
          </div>
       </div>
    </div>
  );
}
