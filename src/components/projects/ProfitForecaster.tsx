"use client";

import React from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import { 
  GlassCard, 
  NexusDataField, 
  cn 
} from "@/components/ui/Base";

interface ProjectCosting {
  budget: number;
  actualSpend: number;
  progress: number; // 0-100
  estimatedTotal: number;
}

export function ProfitForecaster({ data }: { data: ProjectCosting }) {
  const profitMargin = ((data.budget - data.estimatedTotal) / data.budget) * 100;
  const isOverBudget = data.estimatedTotal > data.budget;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       {/* Left: Financial Overview */}
       <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                <DollarSign size={16} />
             </div>
             <h4 className="text-sm font-black text-white uppercase tracking-widest">Financial Health Forecast</h4>
          </div>

          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 space-y-8">
             <div className="grid grid-cols-2 gap-8">
                <NexusDataField label="Budgeted Revenue" value={`฿${data.budget.toLocaleString()}`} />
                <NexusDataField label="Actual Spend (TD)" value={`฿${data.actualSpend.toLocaleString()}`} color="text-danger" />
             </div>
             <div className="pt-8 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-end">
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Projected Profit Margin</p>
                   <p className={cn("text-3xl font-black drop-shadow-neon", isOverBudget ? "text-danger" : "text-nexus-teal")}>
                      {profitMargin.toFixed(1)}%
                   </p>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                   <div 
                      className={cn("h-full transition-all", isOverBudget ? "bg-danger" : "bg-nexus-teal")}
                      style={{ width: `${Math.max(0, Math.min(100, profitMargin))}%` }}
                   />
                </div>
             </div>
          </div>
       </div>

       {/* Right: AI Analysis */}
       <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <Sparkles size={16} />
             </div>
             <h4 className="text-sm font-black text-white uppercase tracking-widest">AI Intelligence Insights</h4>
          </div>

          <div className={cn("p-8 rounded-2xl border space-y-6", isOverBudget ? "bg-danger/5 border-danger/20" : "bg-nexus-teal/5 border-nexus-teal/20")}>
             <div className="flex items-start gap-4">
                {isOverBudget ? <AlertCircle className="text-danger shrink-0" size={24} /> : <TrendingUp className="text-nexus-teal shrink-0" size={24} />}
                <div className="space-y-2">
                   <p className="text-sm font-black text-white uppercase tracking-tight">
                      {isOverBudget ? "Budget Overrun Warning" : "Optimal Efficiency Detected"}
                   </p>
                   <p className="text-[12px] text-white/60 font-medium leading-relaxed">
                      {isOverBudget 
                        ? `Projected final cost (฿${data.estimatedTotal.toLocaleString()}) exceeds budget by ฿${(data.estimatedTotal - data.budget).toLocaleString()}. Recommended: Audit equipment WIP in Rayong site.`
                        : `Current burn rate is 12% below industry average. Project is on track for a high-margin completion.`
                      }
                   </p>
                </div>
             </div>
             
             <div className="pt-4 flex gap-2">
                <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white hover:bg-white/10 transition-colors uppercase">
                   View Cost Breakdown
                </button>
                <button className="px-4 py-2 rounded-xl bg-nexus-blue/20 border border-nexus-blue/40 text-[10px] font-black text-nexus-blue hover:bg-nexus-blue/40 transition-colors uppercase">
                   Simulate Savings
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}
