"use client";

import React from "react";
import { 
  Receipt, 
  TrendingUp, 
  Users, 
  CreditCard,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  Monitor
} from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";

export default function SalesPage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">งานขายและลูกค้า (Sales Hub)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Commerce Control Center</p>
        </div>
        <div className="flex gap-4">
          <PillButton variant="glass" className="gap-2">
            <Monitor size={18} />
            เปิดเครื่อง POS
          </PillButton>
          <PillButton className="gap-2">
            <Plus size={18} />
            สร้างใบเสนอราคา
          </PillButton>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SalesMetric icon={<TrendingUp size={20} />} label="ยอดขายวันนี้" value="฿45,200.00" growth="+12%" />
        <SalesMetric icon={<Receipt size={20} />} label="จำนวนบิล" value="24" growth="+5%" />
        <SalesMetric icon={<Users size={20} />} label="ลูกค้าใหม่" value="3" growth="0%" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <PillInput placeholder="ค้นหาเลขอ้างอิง, ชื่อลูกค้า, หรือเบอร์โทร..." className="w-full pl-12 h-12 bg-white/[0.03]" />
        </div>
        <PillButton variant="glass" className="h-12 px-6 border-white/5">
          <Filter size={18} className="mr-2 opacity-50" />
          ตัวกรอง
        </PillButton>
      </div>

      {/* Sales Table Section */}
      <GlassCard className="p-0 overflow-hidden border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">ประวัติการขายล่าสุด</h3>
          <button className="text-[10px] font-black text-nexus-teal uppercase tracking-widest hover:underline">ดูทั้งหมด</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">เลขอ้างอิง</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ชื่อลูกค้า</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ช่องทาง</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] text-right">ยอดสุทธิ</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <SalesRow id="SO-24-001" customer="บริษัท ทดสอบ จำกัด" channel="POS" amount="฿12,500.00" status="Paid" />
            <SalesRow id="SO-24-002" customer="คุณสมศักดิ์ รักดี" channel="Online" amount="฿3,200.00" status="Pending" />
            <SalesRow id="SO-24-003" customer="PSG Solutions" channel="Direct" amount="฿250,000.00" status="Quoted" />
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}

function SalesMetric({ icon, label, value, growth }: { icon: any, label: string, value: string, growth: string }) {
  return (
    <GlassCard className="p-6 border-white/5 hover:border-nexus-teal/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-nexus-teal border border-white/10 group-hover:bg-nexus-teal group-hover:text-black transition-all">
          {icon}
        </div>
        <span className="text-[10px] font-black text-nexus-teal bg-nexus-teal/10 px-2 py-1 rounded-full">{growth}</span>
      </div>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h4 className="text-2xl font-black text-white tracking-tighter mono-numbers">{value}</h4>
    </GlassCard>
  );
}

function SalesRow({ id, customer, channel, amount, status }: { id: string, customer: string, channel: string, amount: string, status: string }) {
  const statusColors: any = {
    Paid: "text-nexus-teal bg-nexus-teal/10 border-nexus-teal/20",
    Pending: "text-warning bg-warning/10 border-warning/20",
    Quoted: "text-nexus-blue bg-nexus-blue/10 border-nexus-blue/20",
  };

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
      <td className="p-4 font-mono text-xs text-nexus-blue">{id}</td>
      <td className="p-4 text-xs font-bold text-white/80">{customer}</td>
      <td className="p-4 text-xs text-white/40">{channel}</td>
      <td className="p-4 text-right font-black text-white mono-numbers">{amount}</td>
      <td className="p-4">
        <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase border", statusColors[status])}>
          {status}
        </span>
      </td>
    </tr>
  );
}
