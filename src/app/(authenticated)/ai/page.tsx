"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Brain, 
  MessageSquare, 
  Zap,
  Send,
  Cpu,
  Database,
  BarChart4
} from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";

export default function AIHubPage() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 h-[calc(100vh-64px)] flex flex-col">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-nexus-blue to-nexus-teal rounded-2xl flex items-center justify-center text-black shadow-nexus-glow">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white mb-1">AI Intelligence Hub</h1>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Genkit + Gemini 2.5 Flash Engine</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/20 text-[10px] text-nexus-teal font-black uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal animate-pulse" />
            Core Synced
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
        {/* AI Capabilities Sidebar */}
        <div className="space-y-6">
          <GlassCard className="p-6 border-white/5 bg-[#0a0a0c]">
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-6">Cognitive Functions</h3>
            <div className="space-y-2">
              <AICapability icon={<BarChart4 size={16} />} label="Stock Forecasting" active />
              <AICapability icon={<Database size={16} />} label="OCR Document Scan" />
              <AICapability icon={<MessageSquare size={16} />} label="Smart Assistant" />
              <AICapability icon={<Zap size={16} />} label="Auto GL Posting" />
            </div>
          </GlassCard>

          <GlassCard className="p-6 border-white/5 bg-[#0a0a0c]">
             <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-4">Neural Status</h3>
             <div className="space-y-4">
                <NeuralStatus label="Core Temperature" value="38°C" progress={40} />
                <NeuralStatus label="Memory Usage" value="1.2GB" progress={15} />
                <NeuralStatus label="Inference Speed" value="14ms" progress={90} />
             </div>
          </GlassCard>
        </div>

        {/* AI Interaction Zone */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
          <GlassCard className="flex-1 border-white/5 bg-[#0a0a0c] p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Brain className="text-nexus-teal" size={18} />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Neural Link Active</span>
              </div>
              <PillButton variant="ghost" className="h-8 text-[9px]">Clear Buffer</PillButton>
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
              <AIMessage role="assistant" content="สวัสดีครับพี่ ผมคือ Nexus Intelligence Engine พร้อมช่วยวิเคราะห์ข้อมูลคลังพัสดุและโปรเจกต์ให้พี่แล้วครับ วันนี้อยากให้ผมช่วยอะไรเป็นพิเศษไหมครับ?" />
              <AIMessage role="user" content="ช่วยวิเคราะห์แนวโน้มสต็อกของ Cisco Switch ในช่วง 3 เดือนหน้าหน่อย" />
              <AIMessage role="assistant" content="จากการวิเคราะห์ข้อมูลประวัติการเบิกใช้ในโปรเจกต์ที่ผ่านมา พบว่า Cisco Switch จะมีความต้องการเพิ่มขึ้น 15% ในช่วงเดือนหน้า แนะนำให้สำรองสต็อกเพิ่มอีก 5 หน่วยครับ" />
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5">
              <div className="relative">
                <PillInput 
                  placeholder="Ask Nexus Intelligence..." 
                  className="w-full h-14 pl-6 pr-16 bg-white/5 border-white/10 text-sm"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-nexus-teal rounded-full flex items-center justify-center text-black shadow-nexus-glow hover:scale-105 transition-all">
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[9px] text-white/20 text-center mt-4 uppercase tracking-[0.3em]">Neural Interface Encryption: AES-256 Enabled</p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function AICapability({ icon, label, active }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
      active ? "bg-nexus-teal/10 border-nexus-teal/30 text-nexus-teal" : "bg-white/5 border-white/5 text-white/40 hover:text-white"
    )}>
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}

function NeuralStatus({ label, value, progress }: { label: string, value: string, progress: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
        <span className="text-white/40">{label}</span>
        <span className="text-nexus-teal">{value}</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-nexus-teal" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function AIMessage({ role, content }: { role: "assistant" | "user", content: string }) {
  return (
    <div className={cn("flex gap-4", role === "user" ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
        role === "assistant" ? "bg-nexus-teal text-black" : "bg-white/5 text-white/40 border border-white/10"
      )}>
        {role === "assistant" ? <Sparkles size={16} /> : <UserCog size={16} />}
      </div>
      <div className={cn(
        "max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed",
        role === "assistant" ? "bg-white/5 border border-white/5 text-white/80" : "bg-nexus-blue/10 border border-nexus-blue/20 text-white"
      )}>
        {content}
      </div>
    </div>
  );
}

import { UserCog } from "lucide-react";
