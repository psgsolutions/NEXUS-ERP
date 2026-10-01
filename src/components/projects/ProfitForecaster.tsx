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
             <h4 className="text-sm font-bold text-white tracking-wider">ประมาณการสุขภาพการเงินโครงการ</h4>
          </div>

          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 space-y-8">
             <div className="grid grid-cols-2 gap-8">
                <NexusDataField label="ประมาณการรายรับตามงบประมาณ" value={`฿${data.budget.toLocaleString()}`} />
                <NexusDataField label="รายจ่ายจริงสะสมจนถึงปัจจุบัน" value={`฿${data.actualSpend.toLocaleString()}`} color="text-danger" />
             </div>
             <div className="pt-8 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-end">
                   <p className="text-xs font-semibold text-white/60 tracking-wider">ประมาณการอัตรากำไรขั้นต้น</p>
                   <p className={cn("text-3xl font-bold drop-shadow-neon", isOverBudget ? "text-danger" : "text-nexus-teal")}>
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
             <h4 className="text-sm font-bold text-white tracking-wider">วิเคราะห์อัจฉริยะ AI</h4>
          </div>

          <div className={cn("p-8 rounded-2xl border space-y-6", isOverBudget ? "bg-danger/5 border-danger/20" : "bg-nexus-teal/5 border-nexus-teal/20")}>
             <div className="flex items-start gap-4">
                {isOverBudget ? <AlertCircle className="text-danger shrink-0" size={24} /> : <TrendingUp className="text-nexus-teal shrink-0" size={24} />}
                <div className="space-y-2">
                   <p className="text-sm font-bold text-white">
                      {isOverBudget ? "คำเตือน: งบประมาณเกินกำหนด" : "ตรวจพบประสิทธิภาพยอดเยี่ยม"}
                   </p>
                   <p className="text-xs text-white/80 font-normal leading-relaxed">
                      {isOverBudget 
                        ? `ประมาณการต้นทุนรวมสุดท้าย (฿${data.estimatedTotal.toLocaleString()}) เกินงบประมาณที่ตั้งไว้ ฿${(data.estimatedTotal - data.budget).toLocaleString()} แนะนำให้ตรวจสอบรายละเอียดค่าใช้จ่ายอุปกรณ์เพิ่มเติม`
                        : `อัตราการใช้งบประมาณปัจจุบันต่ำกว่าค่าเฉลี่ย 12% โครงการมีแนวโน้มปิดงานด้วยอัตรากำไรสูง`
                      }
                   </p>
                </div>
             </div>
             
             <div className="pt-4 flex gap-2">
                <button className="h-8 px-4 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 transition-colors">
                   ดูรายละเอียดสัดส่วนต้นทุน
                </button>
                <button className="h-8 px-4 rounded-full bg-nexus-blue/20 border border-nexus-blue/40 text-xs font-bold text-nexus-blue hover:bg-nexus-blue/40 transition-colors">
                   จำลองการลดต้นทุน
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}
