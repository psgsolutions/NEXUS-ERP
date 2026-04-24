"use client";

import React from "react";
import { 
  DollarSign, 
  Package, 
  FileText, 
  AlertTriangle,
  Plus,
  ShieldCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  ShoppingCart
} from "lucide-react";
import { cn } from "@/components/ui/Base";
import { GlassCard } from "@/components/ui/Base";

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Title Header with Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-nexus-teal rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(20,163,204,0.3)]">
            <Activity size={24} className="text-black" />
          </div>
          <div>
            <div className="flex gap-2 mb-2">
              <span className="px-2 py-0.5 rounded bg-nexus-teal/10 border border-nexus-teal/20 text-[10px] text-nexus-teal font-black uppercase tracking-widest">Frugal Active</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/40 font-black uppercase tracking-widest">Synced: COMP-24-0001</span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              บริษัท พีเอสจี โซลูชั่น จำกัด
            </h1>
          </div>
        </div>
        <button className="flex items-center gap-2 px-5 h-10 bg-nexus-teal text-black font-black text-xs rounded-full shadow-nexus-glow hover:scale-105 transition-all">
          <Plus size={16} />
          สร้างเอกสารใหม่
        </button>
      </div>

      {/* Metric Cards - StockPilot Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard icon={<DollarSign size={24} />} label="มูลค่าคลังพัสดุ" value="169,565" color="text-nexus-teal" />
        <MetricCard icon={<Package size={24} />} label="รายการสินค้า" value="6" color="text-nexus-teal" />
        <MetricCard icon={<FileText size={24} />} label="พัสดุจองโครงการ" value="0" color="text-nexus-blue" />
        <MetricCard icon={<AlertTriangle size={24} />} label="สต็อกวิกฤต" value="0" color="text-danger" />
      </div>

      {/* System Integrity & Secondary Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-nexus-teal uppercase tracking-widest">System Integrity</p>
                <p className="text-xs text-white/40">ข้อมูลพัสดุและตัวเลขบัญชีถูกต้อง 100%</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0c] border border-white/5 rounded-[2.5rem] p-8 h-[360px] relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-nexus-teal" />
                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">แนวโน้มการเติบโต</h3>
              </div>
            </div>
            {/* Mock Wave Chart Visualization */}
            <div className="absolute bottom-0 left-0 w-full h-[200px] bg-gradient-to-t from-nexus-teal/5 to-transparent" />
            <svg viewBox="0 0 800 200" className="absolute bottom-10 left-0 w-full h-[150px] drop-shadow-[0_0_15px_rgba(20,163,204,0.3)]">
              <path 
                d="M0,100 C100,20 200,180 300,100 C400,20 500,180 600,100 C700,20 800,100" 
                fill="none" 
                stroke="#14a3cc" 
                strokeWidth="4"
                className="animate-pulse"
              />
            </svg>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <GlassCard className="bg-[#0a0a0c] border-white/5 h-[200px] flex flex-col items-center justify-center text-center">
             <AlertTriangle size={32} className="text-danger mb-4 opacity-50" />
             <h4 className="text-xs font-black text-white/40 uppercase tracking-widest">สต็อกวิกฤต</h4>
             <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mt-4">
                <CheckCircle2 size={24} className="text-nexus-teal" />
             </div>
             <p className="text-[10px] text-white/20 uppercase tracking-widest mt-2">สต็อกสินค้าปกติ</p>
          </GlassCard>

          <GlassCard className="bg-[#0a0a0c] border-white/5 h-[200px] flex flex-col items-center justify-center text-center">
             <FileText size={32} className="text-nexus-blue mb-4 opacity-50" />
             <h4 className="text-xs font-black text-white/40 uppercase tracking-widest">ภารกิจเร่งด่วน</h4>
             <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] mt-6">DATA CONSISTENT</p>
          </GlassCard>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-[#0a0a0c] border border-white/5 rounded-[2.5rem] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <ShoppingCart size={18} className="text-nexus-teal" />
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">รายการล่าสุด</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">เลขที่เอกสาร</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ลูกค้า</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] text-right">ยอดสุทธิ</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/5 text-xs text-white/10 italic">
              <td colSpan={4} className="p-8 text-center">ยังไม่มีความเคลื่อนไหวล่าสุด</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-[#0a0a0c] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden group hover:border-nexus-teal/30 transition-all">
      <div className="flex items-center justify-between mb-8">
        <div className={cn("w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center", color)}>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal animate-pulse" />
          <span className="text-[10px] font-black text-white/40 tracking-widest">LIVE</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">{label}</p>
        <h4 className="text-3xl font-black text-white tracking-tight mono-numbers">{value}</h4>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nexus-teal/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
    </div>
  );
}
