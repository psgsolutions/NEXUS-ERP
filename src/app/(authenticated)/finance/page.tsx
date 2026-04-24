"use client";

import React from "react";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";

export default function FinancePage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">การเงินและบัญชี (Finance Center)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">General Ledger & Cash Flow Strategy</p>
        </div>
        <div className="flex gap-4">
          <PillButton variant="glass" className="gap-2 border-white/5">
            <Download size={18} />
            Export Report
          </PillButton>
          <PillButton className="gap-2 shadow-nexus-glow">
            <FileSpreadsheet size={18} />
            ลงบัญชีใหม่ (GL)
          </PillButton>
        </div>
      </div>

      {/* Financial Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FinanceCard 
          label="กระแสเงินสดสุทธิ" 
          value="฿2,450,000.00" 
          change="+฿125,000" 
          isPositive={true} 
          icon={<Wallet className="text-nexus-teal" />} 
        />
        <FinanceCard 
          label="รายได้รวม (Revenue)" 
          value="฿8,120,500.00" 
          change="+15.2%" 
          isPositive={true} 
          icon={<TrendingUp className="text-nexus-blue" />} 
        />
        <FinanceCard 
          label="ค่าใช้จ่ายรวม (Expense)" 
          value="฿5,670,500.00" 
          change="+8.4%" 
          isPositive={false} 
          icon={<TrendingDown className="text-danger" />} 
        />
      </div>

      {/* Chart & Breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <GlassCard className="p-8 border-white/5 bg-[#0a0a0c] h-[400px] relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-nexus-teal" />
              Cash Flow Trend
            </h3>
          </div>
          {/* Mock Visualization Placeholder */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-nexus-blue/5 to-transparent" />
          <div className="w-full h-full flex items-center justify-center border border-white/5 border-dashed rounded-2xl">
             <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Real-time Visualization Engine</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 border-white/5 bg-[#0a0a0c]">
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-8 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-nexus-blue" />
            Expense Breakdown
          </h3>
          <div className="space-y-6">
            <ExpenseItem label="ต้นทุนขาย (COGS)" value="฿4,100,000" percent={72} color="bg-nexus-blue" />
            <ExpenseItem label="เงินเดือนพนักงาน" value="฿850,000" percent={15} color="bg-nexus-teal" />
            <ExpenseItem label="ค่าเช่าและสาธารณูปโภค" value="฿420,000" percent={7} color="bg-warning" />
            <ExpenseItem label="ค่าใช้จ่ายเบ็ดเตล็ด" value="฿300,500" percent={6} color="bg-white/20" />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function FinanceCard({ label, value, change, isPositive, icon }: { label: string, value: string, change: string, isPositive: boolean, icon: any }) {
  return (
    <GlassCard className="p-8 border-white/5 hover:border-white/20 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          {icon}
        </div>
        <div className={cn("flex items-center gap-1 text-[10px] font-black", isPositive ? "text-nexus-teal" : "text-danger")}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
        </div>
      </div>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">{label}</p>
      <h4 className="text-3xl font-black text-white mono-numbers tracking-tighter">{value}</h4>
    </GlassCard>
  );
}

function ExpenseItem({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</p>
        <p className="text-xs font-bold text-white mono-numbers">{value} <span className="text-white/20 ml-2">({percent}%)</span></p>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

import { Activity } from "lucide-react";
