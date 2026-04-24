"use client";

import React from "react";
import { GlassCard, PillButton } from "@/components/ui/Base";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart, 
  FileText, 
  Download,
  Calendar,
  Layers,
  PieChart
} from "lucide-react";
import { cn } from "@/components/ui/Base";

export default function FinancePage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent p-8">
      {/* Module Header */}
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-3xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">การเงินและบัญชี (Finance Hub)</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold">General Ledger & Real-time P&L</p>
          </div>
        </div>
        <div className="flex gap-3">
          <PillButton variant="glass" className="gap-2 h-9 text-xs">
            <Download size={16} />
            Export Report
          </PillButton>
          <PillButton className="gap-2 h-9 text-xs shadow-nexus-glow">
            <Calendar size={16} />
            ปิดงวดบัญชี
          </PillButton>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <FinancialStat label="รายได้รวม (Revenue)" value="2,450,000" delta="+12%" type="up" />
        <FinancialStat label="ต้นทุนขาย (COGS)" value="1,120,500" delta="-5%" type="down" />
        <FinancialStat label="ค่าใช้จ่ายโครงการ" value="680,200" delta="+8%" type="up" />
        <FinancialStat label="กำไรสุทธิ (Net Profit)" value="649,300" delta="+15%" type="up" highlight />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* P&L Breakdown */}
        <GlassCard className="lg:col-span-2 flex flex-col p-0 overflow-hidden border-white/5 bg-black/40">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">งบกำไรขาดทุน (Profit & Loss)</h2>
            <div className="flex gap-1">
              <button className="px-3 py-1 rounded-full bg-nexus-blue text-black text-[10px] font-bold">รายเดือน</button>
              <button className="px-3 py-1 rounded-full bg-white/5 text-white/40 text-[10px] font-bold hover:text-white transition-colors">รายไตรมาส</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <PLRow label="รายได้จากการขาย (Sales Income)" amount={2150000} />
            <PLRow label="รายได้งานโครงการ (Project Revenue)" amount={300000} />
            <div className="border-t border-white/10 pt-4" />
            <PLRow label="ต้นทุนขาย (COGS)" amount={-1120500} type="expense" />
            <PLRow label="ต้นทุนพัสดุโครงการ" amount={-450000} type="expense" />
            <PLRow label="ค่าแรงติดตั้ง" amount={-230200} type="expense" />
            <div className="border-t border-white/10 pt-4" />
            <PLRow label="กำไรขั้นต้น (Gross Profit)" amount={649300} isTotal />
          </div>
        </GlassCard>

        {/* Tax & Accounts Status */}
        <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
          <GlassCard className="flex-1 p-6 flex flex-col justify-between border-l-4 border-l-nexus-teal">
            <div>
              <div className="flex items-center gap-2 text-nexus-teal mb-4">
                <FileText size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">ภาษีขายรอนำส่ง (VAT 7%)</span>
              </div>
              <h3 className="text-4xl font-bold text-white mono-numbers">171,500</h3>
              <p className="text-xs text-white/30 mt-2">คำนวณจากยอดขาย 2,450,000 บาท</p>
            </div>
            <PillButton variant="glass" className="w-full h-8 text-[10px] mt-4">ดูรายงาน ภ.พ.30</PillButton>
          </GlassCard>

          <GlassCard className="flex-1 p-6 flex flex-col justify-between border-l-4 border-l-nexus-blue">
            <div>
              <div className="flex items-center gap-2 text-nexus-blue mb-4">
                <PieChart size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">สถานะลูกหนี้ (AR Status)</span>
              </div>
              <h3 className="text-4xl font-bold text-white mono-numbers">850,000</h3>
              <p className="text-xs text-white/30 mt-2">4 โครงการรอยืนยันการชำระเงิน</p>
            </div>
            <PillButton variant="glass" className="w-full h-8 text-[10px] mt-4">จัดการใบวางบิล</PillButton>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function FinancialStat({ label, value, delta, type, highlight = false }: any) {
  return (
    <GlassCard className={cn("p-6", highlight && "bg-nexus-blue/5 border-nexus-blue/20")}>
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-bold text-white mono-numbers">฿{value}</h4>
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
          type === "up" ? "text-nexus-teal bg-nexus-teal/10" : "text-danger bg-danger/10"
        )}>
          {type === "up" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {delta}
        </div>
      </div>
    </GlassCard>
  );
}

function PLRow({ label, amount, type = "income", isTotal = false }: any) {
  return (
    <div className={cn(
      "flex justify-between items-center",
      isTotal ? "text-lg font-bold" : "text-sm"
    )}>
      <span className={cn(isTotal ? "text-white" : "text-white/60")}>{label}</span>
      <span className={cn(
        "mono-numbers",
        isTotal ? "text-nexus-blue" : type === "income" ? "text-white" : "text-danger"
      )}>
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
