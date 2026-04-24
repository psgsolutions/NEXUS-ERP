"use client";

import React from "react";
import { 
  Target, 
  TrendingUp, 
  Sparkles, 
  ArrowUpRight,
  ShieldCheck,
  Zap,
  MessageSquare
} from "lucide-react";
import { 
  GlassCard, 
  NexusDataField, 
  cn,
  PillButton 
} from "@/components/ui/Base";

interface Lead {
  id: string;
  customerName: string;
  projectValue: number;
  lastContact: string;
  aiScore: number; // 0-100
  sentiment: "Positive" | "Neutral" | "Negative";
  nextStep: string;
}

export function OpportunityScorer({ leads }: { leads: Lead[] }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                   <Target size={16} />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest">High-Probability Opportunities</h4>
             </div>

             <div className="space-y-4">
                {leads.sort((a, b) => b.aiScore - a.aiScore).map((lead) => (
                   <div key={lead.id} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-nexus-teal/20 transition-all group">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-6">
                            <div className="relative">
                               <svg className="w-16 h-16 transform -rotate-90">
                                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={176} strokeDashoffset={176 - (176 * lead.aiScore / 100)} className="text-nexus-teal drop-shadow-neon" />
                               </svg>
                               <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
                                  {lead.aiScore}%
                               </div>
                            </div>
                            <div>
                               <h5 className="text-lg font-black text-white uppercase tracking-tight">{lead.customerName}</h5>
                               <div className="flex items-center gap-4 mt-1">
                                  <span className="text-[10px] font-bold text-white/40">Value: ฿{lead.projectValue.toLocaleString()}</span>
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", 
                                     lead.sentiment === "Positive" ? "bg-nexus-teal/10 text-nexus-teal" : "bg-warning/10 text-warning"
                                  )}>
                                     {lead.sentiment} Sentiment
                                  </span>
                                </div>
                            </div>
                         </div>
                         
                         <div className="text-right space-y-2">
                            <p className="text-[10px] font-black text-nexus-teal uppercase tracking-widest">Recommended Action</p>
                            <div className="flex items-center gap-3">
                               <p className="text-xs font-bold text-white/60 italic">"{lead.nextStep}"</p>
                               <button className="p-2 rounded-lg bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20 hover:bg-nexus-teal hover:text-black transition-all">
                                  <ArrowUpRight size={16} />
                                </button>
                            </div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                   <Sparkles size={16} />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest">AI Sales Assistant</h4>
             </div>

             <div className="p-8 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/20 space-y-8">
                <div className="flex items-center gap-4">
                   <Zap className="text-nexus-blue" size={24} />
                   <h5 className="text-[12px] font-black text-white uppercase tracking-widest">Daily Revenue Hack</h5>
                </div>
                <p className="text-[12px] text-white/60 font-bold leading-relaxed">
                   "AI detected a 24% increase in procurement activity from **Hospital A**. Based on their hardware lifecycle, they are likely to upgrade their core switches in the next 15 days. Suggest sending a follow-up email today."
                </p>
                <PillButton className="w-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border-nexus-blue/40">
                   <MessageSquare size={18} /> Generate Draft
                </PillButton>
             </div>

             <GlassCard className="p-6 border-white/10">
                <h5 className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4">Pipeline Velocity</h5>
                <div className="flex items-end gap-2 h-16">
                   <div className="flex-1 bg-nexus-teal/20 rounded-t-lg h-[40%]" />
                   <div className="flex-1 bg-nexus-teal/20 rounded-t-lg h-[60%]" />
                   <div className="flex-1 bg-nexus-teal/40 rounded-t-lg h-[85%] shadow-neon-teal" />
                   <div className="flex-1 bg-nexus-teal/20 rounded-t-lg h-[30%]" />
                </div>
             </GlassCard>
          </div>
       </div>
    </div>
  );
}
