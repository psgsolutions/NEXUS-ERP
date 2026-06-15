// @ts-nocheck
"use client";

import React, { useState } from "react";
import { 
  DollarSign, 
  Package, 
  Briefcase, 
  AlertTriangle,
  Plus,
  TrendingUp,
  Activity,
  CheckCircle2,
  Zap,
  Layout,
  ChevronRight,
  Bell,
  Sparkles,
  ArrowUpRight,
  Target,
  Users,
  MessageSquare,
  ShieldCheck,
  Search,
  Monitor,
  Cpu,
  Globe,
  Timer
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  GlassCard,
  StatusBadge,
  PillTabs,
  NexusSearchInput
} from "@/components/ui/Base";
import { SystemHealthIndicator } from "@/components/shared/SystemHealthIndicator";
import { QuantumRiskEngine } from "@/components/dashboard/QuantumRiskEngine";
import { MacroIntelligence } from "@/components/dashboard/MacroIntelligence";
import { TemporalForecaster } from "@/components/ai/TemporalForecaster";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"standard" | "quantum" | "macro" | "temporal">("standard");
  const [neuralEnabled, setNeuralEnabled] = useState(false);

  return (
    <div className={cn(
      "p-6 space-y-6 max-w-[1800px] mx-auto animate-in fade-in duration-700",
      neuralEnabled && "blur-[0.5px] brightness-110 contrast-125"
    )}>
      
      {/* --- TOP COMMAND HEADER --- */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <SystemHealthIndicator />
            <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 font-black uppercase flex items-center gap-2 tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal shadow-neon-teal animate-pulse" />
              โหนด: NEXUS-BKK-GLOBAL
            </div>
            <div className="flex gap-2">
               <div 
                  onClick={() => setViewMode(viewMode === "standard" ? "quantum" : "standard")}
                  className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-2 tracking-widest cursor-pointer transition-all",
                     viewMode === "quantum" ? "bg-warning/20 border-warning text-warning shadow-neon-warning" : "bg-nexus-blue/10 border-nexus-blue/20 text-nexus-blue"
                  )}
               >
                 <Cpu size={12} />
                 วิเคราะห์: {viewMode === "quantum" ? "QUANTUM" : "STANDARD"}
               </div>
               <div 
                  onClick={() => setViewMode(viewMode === "macro" ? "standard" : "macro")}
                  className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-2 tracking-widest cursor-pointer transition-all",
                     viewMode === "macro" ? "bg-nexus-blue/20 border-nexus-blue text-nexus-blue shadow-neon-blue" : "bg-white/5 border-white/10 text-white/40"
                  )}
               >
                 <Globe size={12} />
                 โหมด: MACRO
               </div>
               <div 
                  onClick={() => setViewMode(viewMode === "temporal" ? "standard" : "temporal")}
                  className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-2 tracking-widest cursor-pointer transition-all",
                     viewMode === "temporal" ? "bg-nexus-teal/20 border-nexus-teal text-nexus-teal shadow-neon-teal" : "bg-white/5 border-white/10 text-white/40"
                  )}
               >
                 <Timer size={12} />
                 โหมด: TEMPORAL
               </div>
               <div 
                  onClick={() => setNeuralEnabled(!neuralEnabled)}
                  className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-2 tracking-widest cursor-pointer transition-all",
                     neuralEnabled ? "bg-danger/20 border-danger text-danger shadow-neon-danger" : "bg-white/5 border-white/10 text-white/40"
                  )}
               >
                 <Zap size={12} />
                 NEURAL: {neuralEnabled ? "CONNECTED" : "OFF"}
               </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-nexus-teal rounded-xl flex items-center justify-center shadow-neon-teal">
              <Zap size={28} className="text-black fill-current drop-shadow-md" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1 ml-1" title="หน้าหลักควบคุมการปฏิบัติงานรวม">หน้าแรก</p>
              <h1 className="text-3xl font-black text-white tracking-tighter leading-none uppercase">ภาพรวมระบบ</h1>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <NexusSearchInput 
              placeholder="ค้นหาข้อมูล หรือสั่งการ..." 
              className="w-80 hidden xl:block"
              kbd="CTRL+K"
            />
          <PillButton className="px-8 shadow-neon-teal">
            <Plus size={18} />
            สร้างรายการใหม่
          </PillButton>
        </div>
      </div>

      {/* --- QUANTUM ENGINE LAYER (V6.0) --- */}
      {viewMode === "quantum" && (
         <div className="animate-in zoom-in-95 duration-500">
            <QuantumRiskEngine />
         </div>
      )}

      {/* --- MACRO INTELLIGENCE LAYER (V7.0) --- */}
      {viewMode === "macro" && (
         <div className="animate-in slide-in-from-top-4 duration-500">
            <MacroIntelligence />
         </div>
      )}

      {/* --- TEMPORAL FORECASTING LAYER (V8.0) --- */}
      {viewMode === "temporal" && (
         <div className="animate-in fade-in zoom-in-110 duration-700">
            <TemporalForecaster />
         </div>
      )}

      {/* --- TOP METRICS & QUICK ACTIONS --- */}
      <div className="flex flex-col 2xl:flex-row justify-between w-full gap-6">
        
        {/* HERO METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <div className="w-full">
            <MasterMetricCard 
              icon={<DollarSign size={24} />} 
              label="รายได้เดือนนี้" 
              value="฿2.45M" 
              color="text-nexus-teal" 
              neon="shadow-neon-teal" 
              onClick={() => router.push('/sales')}
              title="ยอดขายรวมสุทธิในเดือนปัจจุบัน"
            />
          </div>
          <div className="w-full">
            <MasterMetricCard 
              icon={<TrendingUp size={24} />} 
              label="กำไรสุทธิ" 
              value="24.8%" 
              color="text-nexus-blue" 
              neon="shadow-neon-blue" 
              onClick={() => router.push('/finance')}
              title="เปอร์เซ็นต์กำไรสุทธิหลังหักค่าใช้จ่าย"
            />
          </div>
          <div className="w-full">
            <MasterMetricCard 
              icon={<Briefcase size={24} />} 
              label="โครงการ" 
              value="12 งาน" 
              color="text-white" 
              onClick={() => router.push('/projects')}
              title="จำนวนโครงการที่กำลังดำเนินการอยู่"
            />
          </div>
          <div className="w-full">
            <MasterMetricCard 
              icon={<AlertTriangle size={24} />} 
              label="จุดวิกฤต" 
              value="3 จุด" 
              color="text-danger" 
              onClick={() => setViewMode('quantum')}
              title="รายการที่ต้องได้รับการแก้ไขทันที"
            />
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-4 gap-3 xl:flex xl:flex-nowrap xl:w-auto">
           <div className="w-full xl:w-[110px]">
             <QuickActionCard icon={<DollarSign size={16} />} label="เสนอราคา" color="bg-nexus-teal" link="/sales?action=new-quotation" title="สร้างเอกสารใบเสนอราคาใหม่" />
           </div>
           <div className="w-full xl:w-[110px]">
             <QuickActionCard icon={<Package size={16} />} label="คลังสินค้า" color="bg-nexus-blue" link="/inventory" title="ตรวจสอบและบริหารพัสดุ" />
           </div>
           <div className="w-full xl:w-[110px]">
             <QuickActionCard icon={<Users size={16} />} label="ลูกค้า" color="bg-white/5" link="/sales" title="ฐานข้อมูลและประวัติลูกค้า" />
           </div>
           <div className="w-full xl:w-[110px]">
             <QuickActionCard icon={<Plus size={16} />} label="สั่งซื้อ" color="bg-white/5" link="/procurement" title="สร้างเอกสารใบสั่งซื้อ (PO)" />
           </div>
        </div>
      </div>

      {/* --- MAIN OPERATIONAL LAYER --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: PERFORMANCE & GRAPHS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* AI Briefing Bar */}
          <div className="bg-nexus-teal/5 border border-nexus-teal/20 rounded-xl p-6 flex items-center gap-6 animate-shimmer relative overflow-hidden group">
             <div className="w-14 h-14 rounded-2xl bg-nexus-teal/20 flex items-center justify-center text-nexus-teal border border-nexus-teal/30 shadow-neon-teal">
                <Sparkles size={28} className="animate-pulse" />
             </div>
             <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                   <h3 className="text-[13px] font-bold text-nexus-teal uppercase tracking-[0.2em]">การวิเคราะห์สถานการณ์โดย AI (Strategic Insights)</h3>
                   <div className="w-1 h-1 rounded-full bg-nexus-teal animate-ping" />
                </div>
                <p className="text-base font-bold text-white leading-relaxed">
                   สต็อก Aruba AP-505 เหลือเพียง 2 ชิ้น ในขณะที่โปรเจกต์ <span className="text-nexus-teal">PRJ-26-001</span> รอเบิก 5 ชิ้น 
                   <span className="text-white/40"> • แนะนำให้เปิด PO จัดซื้อด่วนทันที</span>
                </p>
             </div>
             <PillButton variant="glass" className="hidden md:flex border-nexus-teal/20 text-nexus-teal px-6 uppercase text-[10px]">ดำเนินการทันที</PillButton>
          </div>

          {/* Revenue Intelligence Graph */}
          <GlassCard className="p-8 h-[420px] relative overflow-hidden group border-white/5 rounded-2xl">
            <div className="flex items-center justify-between mb-10">
               <div className="space-y-1">
                  <h3 className="text-xs font-black text-white uppercase flex items-center gap-2 tracking-[0.2em]">
                     <Activity size={16} className="text-nexus-teal animate-pulse" />
                     การวิเคราะห์และพยากรณ์ข้อมูลธุรกิจ
                  </h3>
                  <p className="text-xs text-white/20 uppercase font-black tracking-widest mt-2">การวิเคราะห์การเติบโตของรายได้ (Q2 2026)</p>
               </div>
               <div className="flex gap-6">
                  <div className="flex items-center gap-3">
                     <div className="w-2.5 h-2.5 rounded-full bg-nexus-teal shadow-neon-teal" />
                     <span className="text-[13px] font-bold text-white/40 uppercase tracking-widest">เกิดขึ้นจริง</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                     <span className="text-[13px] font-bold text-white/40 uppercase tracking-widest">เป้าหมาย</span>
                  </div>
               </div>
            </div>
            
            <div className="relative h-[250px] w-full mt-12">
               <svg viewBox="0 0 800 200" className="w-full h-full preserve-3d">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10bba8" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#10bba8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  <path 
                    d="M0,150 C50,140 100,160 150,110 C200,60 250,100 300,40 C350,20 400,80 450,120 C500,160 550,130 600,70 C650,40 700,90 800,50 L800,200 L0,200 Z" 
                    fill="url(#chartGradient)"
                    className="animate-fade-in-up"
                  />
                  
                  <path 
                    d="M0,150 C50,140 100,160 150,110 C200,60 250,100 300,40 C350,20 400,80 450,120 C500,160 550,130 600,70 C650,40 700,90 800,50" 
                    fill="none" 
                    stroke="#10bba8" 
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="drop-shadow-neon animate-draw"
                  />

                  <line x1="0" y1="60" x2="800" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="10,10" />
               </svg>
            </div>
            
            <div className="absolute inset-x-10 bottom-10 flex justify-between items-end text-[13px] font-bold text-white/10 uppercase tracking-[0.4em] border-t border-white/5 pt-6">
               <span>สัปดาห์ 1</span>
               <span>สัปดาห์ 2</span>
               <span>สัปดาห์ 3</span>
               <span className="text-nexus-teal shadow-neon-teal">สถานะปัจจุบัน</span>
               <span>สัปดาห์ 5</span>
            </div>
          </GlassCard>

          {/* Bottom Operational Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <GlassCard className="p-6 border-white/5 bg-[#0a0a0c]/40 rounded-2xl">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                      <Briefcase size={16} className="text-nexus-blue" />
                      ความคืบหน้าโครงการติดตั้ง
                   </h3>
                   <span className="text-[13px] font-bold text-white/20 uppercase tracking-widest">งานที่ดำเนินการอยู่</span>
                </div>
                <div className="space-y-6">
                   <ProjectProgressRow name="ติดตั้ง LED Wall - ศูนย์ประชุม" progress={75} id="PRJ-26-001" status="กำลังดำเนินการ" />
                   <ProjectProgressRow name="วางระบบ Network - PSG HQ" progress={40} id="PRJ-26-003" status="ล่าช้ากว่าแผน" isRisk />
                   <ProjectProgressRow name="MA Service - PTT" progress={100} id="SRV-26-012" status="เสร็จสมบูรณ์" />
                </div>
             </GlassCard>

             <GlassCard className="p-6 border-white/5 bg-[#0a0a0c]/40 rounded-2xl">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                      <Package size={16} className="text-nexus-teal" />
                      การติดตามพัสดุและสินค้าคงคลัง
                   </h3>
                   <span className="text-[13px] font-bold text-white/20 uppercase tracking-widest">สต็อกวิกฤต</span>
                </div>
                <div className="space-y-5">
                   <StockAlertRow item="Aruba AP-505" stock={2} min={10} trend="down" />
                   <StockAlertRow item="Cat6 Cable 305m" stock={5} min={20} trend="down" />
                   <StockAlertRow item="Cisco C9200L" stock={1} min={2} trend="stable" />
                </div>
                <PillButton variant="glass" className="w-full mt-8 border-white/5 hover:bg-white/5 uppercase text-[10px] tracking-widest">
                   ดูสต็อกทั้งหมด
                   <ChevronRight size={14} className="ml-2" />
                </PillButton>
             </GlassCard>
          </div>
        </div>

        {/* RIGHT: TACTICAL SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">
           {/* System Activity Feed (Moved up due to Quick Operations relocation) */}
           <GlassCard className="border-white/10 flex flex-col rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex flex-wrap items-center justify-between bg-white/[0.02] gap-4">
                 <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3 min-w-0">
                    <Bell size={16} className="text-warning flex-shrink-0 animate-pulse" />
                    <span className="truncate">บันทึกกิจกรรมและความปลอดภัย</span>
                 </h3>
                 <div className="w-2 h-2 rounded-full bg-nexus-teal shadow-neon-teal flex-shrink-0" />
              </div>
              
              <div className="flex-1 p-0 h-[420px] overflow-y-auto custom-scrollbar">
                  <TacticalLogItem type="วิกฤต" msg="พบความพยายามเข้าสู่ระบบที่ผิดปกติ: 192.168.1.5" time="2 นาทีที่แล้ว" />
                  <TacticalLogItem type="ข้อมูล" msg="อนุมัติใบสั่งซื้อใหม่ PO-2604-001 เรียบร้อยแล้ว" time="15 นาทีที่แล้ว" />
                  <TacticalLogItem type="สำเร็จ" msg="ซิงค์ข้อมูลการเงินรายสัปดาห์เสร็จสมบูรณ์" time="1 ชม. ที่แล้ว" />
                  <TacticalLogItem type="แจ้งเตือน" msg="พื้นที่ดิสก์ในโหนด BKK Node-01 ใกล้เต็ม" time="3 ชม. ที่แล้ว" />
                  <TacticalLogItem type="ข้อมูล" msg="ตรวจสอบสต็อกสินค้าเสร็จสิ้นโดย: ผู้ดูแลระบบ" time="เมื่อวานนี้" />
              </div>
              
              <Link href="/logs" className="w-full py-5 px-4 text-[11px] sm:text-[13px] font-bold text-white/20 uppercase hover:text-white hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2 border-t border-white/5 tracking-wider sm:tracking-[0.2em] text-center">
                 เข้าสู่ศูนย์ประวัติระบบ (AUDIT HUB) <ArrowUpRight size={14} className="flex-shrink-0" />
              </Link>
           </GlassCard>

           {/* AI Performance Insight */}
           <GlassCard className="p-6 border-white/10 bg-nexus-blue/5 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Cpu size={80} />
              </div>
              <div className="flex flex-wrap items-center justify-between mb-8 gap-3">
                 <h3 className="text-[13px] font-bold text-nexus-blue uppercase tracking-widest min-w-0 flex-1 truncate">ประสิทธิภาพการใช้ทรัพยากร</h3>
                 <span className="px-2 py-0.5 rounded-full bg-nexus-blue/10 text-[11px] sm:text-[13px] font-bold text-nexus-blue uppercase whitespace-nowrap">AI เรียลไทม์</span>
              </div>
              <div className="flex items-center justify-center py-6 relative">
                 <svg className="w-40 h-40 transform -rotate-90">
                    <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                    <circle 
                      cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" 
                      strokeDasharray="452" 
                      strokeDashoffset="90"
                      className="text-nexus-blue drop-shadow-neon transition-all duration-1000" 
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white tracking-tighter">82%</span>
                    <span className="text-[13px] font-bold text-white/20 uppercase tracking-widest mt-2">ดัชนี SLA ภาพรวม</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-8 border-t border-white/5 pt-8">
                 <div className="text-center min-w-0">
                    <p className="text-[11px] sm:text-[13px] font-bold text-white/20 uppercase tracking-widest mb-1 truncate">รายการรอดำเนินการ</p>
                    <p className="text-xl sm:text-2xl font-black text-white">12</p>
                 </div>
                 <div className="text-center min-w-0">
                    <p className="text-[11px] sm:text-[13px] font-bold text-white/20 uppercase tracking-widest mb-1 truncate">ระยะเวลาเฉลี่ย</p>
                    <p className="text-xl sm:text-2xl font-black text-white tracking-tighter">4ชม. 20น.</p>
                 </div>
              </div>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

{/* --- HELPER COMPONENTS --- */}

function ProjectProgressRow({ name, progress, id, status, isRisk = false }: { name: string, progress: number, id: string, status: string, isRisk?: boolean }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-end">
          <div className="min-w-0">
             <p className="text-[13px] font-bold text-nexus-blue uppercase tracking-widest mb-1">{id}</p>
             <p className="text-sm font-bold text-white truncate">{name}</p>
          </div>
          <span className={cn("text-[13px] font-bold uppercase px-2 py-0.5 rounded border tracking-widest", isRisk ? "text-danger border-danger/30 bg-danger/10" : "text-white/40 border-white/10")}>
             {status}
          </span>
       </div>
       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div 
            className={cn("h-full transition-all duration-1000", isRisk ? "bg-danger" : "bg-nexus-teal shadow-neon-teal")} 
            style={{ width: `${progress}%` }} 
          />
       </div>
    </div>
  );
}

function StockAlertRow({ item, stock, min, trend }: { item: string, stock: number, min: number, trend: 'up' | 'down' | 'stable' }) {
  return (
    <div className="flex items-center justify-between group p-3 rounded-2xl bg-white/[0.02] border border-transparent hover:border-white/5 transition-all">
       <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-nexus-teal group-hover:shadow-neon-teal transition-all">
             <Package size={18} />
          </div>
          <div>
             <p className="text-xs font-bold text-white">{item}</p>
             <p className="text-[13px] font-bold text-white/20 uppercase tracking-widest">Threshold: {min} units</p>
          </div>
       </div>
        <div className="text-right">
          <p className={cn("text-lg font-black", stock <= 2 ? "text-danger animate-pulse" : "text-white")}>{stock}</p>
          <p className="text-[13px] font-bold text-white/10 uppercase tracking-widest">สต็อกปัจจุบัน</p>
        </div>
    </div>
  );
}

function TacticalLogItem({ type, msg, time }: { type: string, msg: string, time: string }) {
  const dotColors: any = {
    "วิกฤต": "bg-danger shadow-neon-danger",
    "แจ้งเตือน": "bg-warning shadow-neon-warning",
    "ข้อมูล": "bg-nexus-blue shadow-neon-blue",
    "สำเร็จ": "bg-nexus-teal shadow-neon-teal",
  };

  const badgeColors: any = {
    "วิกฤต": "text-danger border-danger/20 bg-danger/10",
    "แจ้งเตือน": "text-warning border-warning/20 bg-warning/10",
    "ข้อมูล": "text-nexus-blue border-nexus-blue/20 bg-nexus-blue/10",
    "สำเร็จ": "text-nexus-teal border-nexus-teal/20 bg-nexus-teal/10",
  };

  return (
    <div className="p-5 flex gap-5 items-start hover:bg-white/[0.03] transition-all cursor-pointer group border-b border-white/[0.02] last:border-0">
       <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse", dotColors[type])} />
       <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white/80 group-hover:text-white transition-colors leading-relaxed line-clamp-2">{msg}</p>
          <div className="flex items-center gap-3 mt-2">
             <span className="text-[13px] font-bold text-white/20 uppercase tracking-widest">{time}</span>
             <span className="text-[13px] font-bold text-white/10">•</span>
             <span className={cn("text-[13px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border", badgeColors[type])}>
                {type}
             </span>
          </div>
       </div>
       <ChevronRight size={14} className="text-white/0 group-hover:text-white/20 transition-all -translate-x-2 group-hover:translate-x-0" />
    </div>
  );
}

function QuickActionCard({ icon, label, color, link }: { icon: any, label: string, color: string, link: string }) {
  return (
    <Link href={link} className="contents">
      <div className={cn("p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/[0.08] hover:border-white/20 transition-all active:scale-95 group relative overflow-hidden shadow-2xl backdrop-blur-lg")}>
         <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xl transition-transform group-hover:scale-110", color)}>
            {React.cloneElement(icon as React.ReactElement, { size: 20 })}
         </div>
         <span className="text-[10px] font-black text-white uppercase text-center tracking-widest leading-snug truncate w-full px-1">{label}</span>
         <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity", color)} />
         <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-nexus-teal transition-colors" />
      </div>
    </Link>
  );
}

