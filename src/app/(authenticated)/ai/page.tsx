"use client";

import React, { useState } from "react";
import { GlassCard, PillButton } from "@/components/ui/Base";
import { 
  BrainCircuit, 
  Cpu, 
  Scan, 
  BarChart3, 
  Sparkles,
  Zap,
  Loader2,
  ChevronRight
} from "lucide-react";
import { cn } from "@/components/ui/Base";

export default function AIPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent p-8">
      {/* Module Header */}
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-3xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">NEXUS Brain (Intelligence Hub)</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden">
        {/* Left: AI Tools */}
        <div className="space-y-6 overflow-y-auto pr-2">
          <AIActionCard 
            title="Industrial Scanner (OCR)"
            description="สแกนฉลากพัสดุหรือใบเสร็จเพื่อสกัดข้อมูล SKU และ S/N อัตโนมัติ"
            icon={<Scan size={24} />}
            actionText="เปิดกล้องสแกน"
          />
          <AIActionCard 
            title="Inventory Optimization"
            description="วิเคราะห์แนวโน้มการใช้พัสดุและแนะนำจุดสั่งซื้อ (Reorder Point) ที่เหมาะสม"
            icon={<BarChart3 size={24} />}
            actionText="เริ่มวิเคราะห์สต็อก"
            onClick={runAnalysis}
            isLoading={isAnalyzing}
          />
          <AIActionCard 
            title="Project Profitability Predictor"
            description="พยากรณ์กำไรของโครงการในอนาคตโดยอิงจากต้นทุนวัสดุและแรงงานปัจจุบัน"
            icon={<Zap size={24} />}
            actionText="คำนวณความเสี่ยง"
          />
        </div>

        {/* Right: AI Output Console */}
        <GlassCard className="bg-black/40 border-white/5 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-nexus-teal/5 flex items-center gap-2">
            <Sparkles size={16} className="text-nexus-teal" />
            <span className="text-[10px] font-bold text-nexus-teal uppercase tracking-widest">NEXUS Brain Output</span>
          </div>
          <div className="flex-1 p-6 font-mono text-sm space-y-4 overflow-y-auto">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 size={32} className="text-nexus-teal animate-spin" />
                <p className="text-nexus-teal/60 animate-pulse">กำลังประมวลผลข้อมูลผ่าน Gemini 2.5 Flash...</p>
              </div>
            ) : (
              <>
                <p className="text-white/20 italic">// Ready for command...</p>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-white/60 leading-relaxed">
                  <p className="text-nexus-teal font-bold mb-2">บทวิเคราะห์ล่าสุด:</p>
                  "พบว่าโปรเจกต์ <span className="text-nexus-blue">PRJ-24-001</span> มีความเสี่ยงในการใช้ต้นทุนเกินงบ 5% แนะนำให้ตรวจสอบรายการเบิกพัสดุสาย Fiber Optic ที่เกินจากแผนงาน"
                </div>
              </>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function AIActionCard({ title, description, icon, actionText, onClick, isLoading = false }: any) {
  return (
    <GlassCard className="p-6 hover:bg-white/[0.02] transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-nexus-teal transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          <p className="text-sm text-white/40 leading-relaxed mb-4">{description}</p>
          <PillButton 
            variant="glass" 
            className="h-8 text-[10px] border-nexus-teal/20 text-nexus-teal gap-2"
            onClick={onClick}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
            {actionText}
          </PillButton>
        </div>
      </div>
    </GlassCard>
  );
}
