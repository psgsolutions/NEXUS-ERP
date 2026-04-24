"use client";

import React, { useState } from "react";
import { 
  BrainCircuit, 
  Sparkles, 
  Search, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Activity,
  Zap,
  ArrowRight,
  PieChart,
  Target,
  Box,
  ChevronRight,
  ShieldCheck,
  Cpu
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  PillTabs,
  GlassCard,
  NexusSearchInput
} from "@/components/ui/Base";

export default function AIHubPage() {
  const [query, setQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("brain");

  const handleNLQ = () => {
    if (query.includes("งบประมาณ") || query.includes("กำไร")) {
      setAiAnswer("โครงการ 'Hospital 01' (PRJ-26-001) กำลังใช้งบประมาณสูงสุดที่ ฿1.8M โดยมี Margin ปัจจุบันที่ 24.5% ซึ่งถือว่าสุขภาพดี แต่อย่างไรก็ตาม พบความเสี่ยงจากต้นทุนอุปกรณ์ Network ที่เพิ่มขึ้น 5% ในสัปดาห์นี้");
    } else {
      setAiAnswer("จากการวิเคราะห์ภาพรวม ระบบพบว่ายอดขายเดือนเมษายนเติบโตขึ้น 12% เมื่อเทียบกับเดือนที่ผ่านมา โดยมีสินค้ากลุ่ม 'Aruba Switch' เป็นตัวขับเคลื่อนหลัก");
    }
  };

  const tabs = [
    { id: "brain", label: "วิเคราะห์ AI (NEXUS BRAIN)", icon: <BrainCircuit size={14} /> },
    { id: "predictive", label: "พยากรณ์ (PREDICTION)", icon: <TrendingUp size={14} /> },
    { id: "insights", label: "ข้อมูลเชิงลึก (INSIGHTS)", icon: <Cpu size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">เลเยอร์ปัญญาประดิษฐ์ระดับควอนตัม</p>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <BrainCircuit size={22} />
             </div>
             <h1 className="text-2xl font-black text-white tracking-tight uppercase">ศูนย์ปัญญาประดิษฐ์ (INTELLIGENCE HUB)</h1>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <PillTabs 
            tabs={tabs} 
            activeTab={activeTab} 
            onTabChange={(id: any) => setActiveTab(id)} 
          />
          <div className="px-5 py-2 rounded-full bg-nexus-teal/10 border border-nexus-teal/20 flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal shadow-neon-teal animate-pulse" />
             <span className="text-[10px] font-black text-nexus-teal uppercase tracking-widest">Gemini 2.5 Flash Online</span>
          </div>
        </div>
      </div>

      {/* AI NLQ Interface */}
      <GlassCard className="p-10 border-nexus-teal/20 bg-nexus-teal/5 shadow-neon-teal relative overflow-hidden group rounded-2xl">
          <div className="absolute -top-10 -right-10 p-20 opacity-5 group-hover:opacity-10 transition-opacity">
             <BrainCircuit size={240} />
          </div>
          
          <div className="relative z-10 space-y-10 max-w-4xl">
             <div className="space-y-4">
                <h2 className="text-2xl font-black text-white flex items-center gap-4">
                   <Sparkles className="text-nexus-teal" size={32} />
                   วิเคราะห์ข้อมูลด้วย NEXUS BRAIN
                </h2>
                <p className="text-base text-white/40 font-bold max-w-2xl leading-relaxed">
                   เข้าถึงข้อมูลมหาศาลผ่านภาษาธรรมชาติ AI จะทำการรวบรวมข้อมูลจาก 10 โมดูลมาสรุปให้คุณทันที 
                   <span className="text-white"> "ถามได้ทุกอย่างเกี่ยวกับธุรกิจของคุณ"</span>
                </p>
             </div>

             <div className="flex flex-col md:flex-row gap-4 items-center bg-black/20 p-2 rounded-full border border-nexus-teal/20 backdrop-blur-xl">
                <NexusSearchInput 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ป้อนคำถามของคุณ... (เช่น: สต็อกอะไรเหลือต่ำสุด? หรือ สรุปกำไรไตรมาสนี้)" 
                  className="flex-1"
                  kbd="ENTER"
                />
                <PillButton onClick={handleNLQ} className="px-12 h-11 shadow-neon-teal">
                   <Sparkles size={18} className="mr-2" />
                   เริ่มการวิเคราะห์
                </PillButton>
             </div>

             {aiAnswer && (
               <div className="p-8 rounded-xl bg-black/60 border border-nexus-teal/30 animate-in slide-in-from-top duration-500 shadow-2xl backdrop-blur-xl">
                  <div className="flex gap-6">
                     <div className="w-12 h-12 rounded-2xl bg-nexus-teal/20 flex items-center justify-center text-nexus-teal shrink-0">
                        <Cpu size={24} className="animate-spin-slow" />
                     </div>
                     <div className="space-y-6">
                        <p className="text-xl text-white leading-relaxed font-bold">
                           {aiAnswer}
                        </p>
                        <div className="flex gap-4">
                           <PillButton variant="glass" className="text-[11px] border-nexus-teal/20 text-nexus-teal">
                              ดูข้อมูลเจาะลึก (DRILL DOWN)
                              <ArrowRight size={14} className="ml-2" />
                           </PillButton>
                           <PillButton variant="glass" className="text-[11px] border-white/10">สร้างใบสั่งซื้อตามแนะนำ</PillButton>
                        </div>
                     </div>
                  </div>
               </div>
             )}
          </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Executive Briefing */}
         <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-4 px-4">
               <Activity className="text-nexus-teal" size={24} />
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">สรุปสถานการณ์ระดับผู้บริหาร (Executive Summary)</p>
                  <h2 className="text-xl font-black text-white uppercase">สรุปสถานการณ์แบบเรียลไทม์</h2>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <BriefItem icon={<Zap className="text-warning" />} label="จุดโฟกัสงานปฏิบัติการ" detail="การติดตั้ง Core Switch ที่ SITE-A กำลังล่าช้ากว่าแผน 2 วัน" />
               <BriefItem icon={<TrendingUp className="text-nexus-teal" />} label="สภาพคล่องทางการเงิน" detail="ยอดเงินสดรับใน 7 วันข้างหน้า คาดการณ์ที่ ฿2.4M" />
               <BriefItem icon={<AlertCircle className="text-danger" />} label="ความเสี่ยงด้านสัญญา" detail="ลูกค้า 2 ราย (PTT, EGAT) สัญญา MA จะหมดอายุในเดือนหน้า" />
               <BriefItem icon={<Box className="text-nexus-blue" />} label="การจัดการทรัพยากร" detail="พบการเบิกจ่าย Aruba AP-505 ผิดปกติในไซต์งาน Hospital 01" />
            </div>
         </div>

         {/* Predictive Layer */}
         <GlassCard className="p-8 border-nexus-blue/20 bg-nexus-blue/5 rounded-xl">
            <h3 className="text-sm font-black text-nexus-blue uppercase tracking-widest mb-8">วิเคราะห์เชิงพยากรณ์ (PREDICTIVE)</h3>
            <div className="space-y-8">
               <TrendItem label="ความต้องการสต็อกเดือนหน้า" value="+24%" isUp />
               <TrendItem label="ดัชนีความเสี่ยงโครงการ" value="Low" isUp={false} isText />
               <TrendItem label="ประสิทธิภาพกำไรต่อโปรเจกต์" value="28.4%" isUp />
            </div>
            <PillButton variant="glass" className="w-full mt-10 border-nexus-blue/20 text-nexus-blue hover:bg-nexus-blue/10 uppercase text-[11px]">
               เปิดรายงานพยากรณ์ฉบับเต็ม
            </PillButton>
         </GlassCard>
      </div>

      {/* Suggested Actions */}
      <div className="space-y-6">
         <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em] px-4">ข้อแนะนำเชิงรุกจาก AI (PROACTIVE RECOMMENDATIONS)</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <ActionCard title="สั่งซื้อ ACCESS POINTS" desc="แนะนำให้สั่งซื้อเพิ่ม 20 ตัว เพื่อรองรับงานเดือนหน้า" />
            <ActionCard title="อัปเดตแผนไซต์งาน A" desc="พบปัญหาคอขวดในการส่งมอบงาน ให้เพิ่มทีมเทคนิค 2 คน" />
            <ActionCard title="ส่งใบแจ้งหนี้ PRJ-002" desc="Milestone 2 เสร็จสมบูรณ์แล้ว สามารถเรียกเก็บเงินได้" />
            <ActionCard title="ตรวจสอบราคา VENDOR B" desc="พบการปรับขึ้นราคาอุปกรณ์ 5% ให้พิจารณาเจ้าอื่น" />
         </div>
      </div>
    </div>
  );
}

function BriefItem({ icon, label, detail }: { icon: any, label: string, detail: string }) {
  return (
    <div className="flex gap-4 p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
       <div className="shrink-0 mt-1 transition-transform group-hover:scale-110">{icon}</div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</p>
          <p className="text-sm font-bold text-white leading-snug">{detail}</p>
       </div>
    </div>
  );
}

function TrendItem({ label, value, isUp, isText = false }: { label: string, value: string, isUp: boolean, isText?: boolean }) {
  return (
    <div className="flex justify-between items-center group">
       <div className="space-y-1">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black text-white tracking-tighter">{value}</p>
       </div>
       <div className={cn(
          "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all group-hover:scale-110",
          isUp ? "text-nexus-teal border-nexus-teal/20 bg-nexus-teal/10 shadow-neon-teal" : "text-danger border-danger/20 bg-danger/10"
       )}>
          {isText ? <Activity size={20} /> : isUp ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
       </div>
    </div>
  );
}

function ActionCard({ title, desc }: { title: string, desc: string }) {
  return (
    <GlassCard className="p-6 hover:border-nexus-teal/40 transition-all cursor-pointer group rounded-3xl">
       <div className="flex justify-between items-start mb-4">
          <h4 className="text-xs font-black text-white uppercase group-hover:text-nexus-teal transition-colors leading-tight">{title}</h4>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-nexus-teal/10 group-hover:text-nexus-teal transition-all">
             <ChevronRight size={16} />
          </div>
       </div>
       <p className="text-[10px] font-bold text-white/30 leading-relaxed uppercase tracking-wider">{desc}</p>
    </GlassCard>
  );
}
