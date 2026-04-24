"use client";

import React, { useState } from "react";
import { Mic, X, Sparkles, Activity, BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui/Base";

export function VoiceBIButton() {
  const [isListening, setIsListening] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const toggleListen = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      setShowAnalysis(true);
    }, 3000);
  };

  return (
    <>
      <div className="fixed bottom-8 right-8 z-[100] group">
         <button 
            onClick={toggleListen}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border",
              isListening 
                ? "bg-danger border-danger/40 scale-110 shadow-neon-danger" 
                : "bg-nexus-teal border-nexus-teal/40 shadow-neon-teal hover:scale-110"
            )}
         >
            {isListening ? (
               <div className="flex gap-1 items-center">
                  <div className="w-1 h-4 bg-white animate-pulse" />
                  <div className="w-1 h-8 bg-white animate-pulse" />
                  <div className="w-1 h-4 bg-white animate-pulse" />
               </div>
            ) : (
               <Mic className="text-black" size={28} />
            )}
            
            {/* Tooltip */}
            <div className="absolute right-20 bg-black/80 border border-white/10 px-4 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
               <p className="text-[10px] font-black text-white uppercase tracking-widest">Ask NEXUS AI (Voice)</p>
            </div>
         </button>
      </div>

      {showAnalysis && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="max-w-xl w-full bg-[#0D0D0D] border border-white/10 rounded-2xl p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                 <button onClick={() => setShowAnalysis(false)} className="text-white/20 hover:text-white">
                    <X size={24} />
                 </button>
              </div>

              <div className="space-y-10">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shadow-neon-teal/20">
                       <Sparkles size={24} />
                    </div>
                    <div>
                       <h4 className="text-xl font-black text-white uppercase tracking-tight">AI Voice Query Results</h4>
                       <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">"ขอสรุปกำไรรายไตรมาสของโครงการ LED Wall"</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <AnalysisCard icon={<TrendingUp size={18} />} label="Gross Margin" value="32.5%" />
                    <AnalysisCard icon={<BarChart3 size={18} />} label="Projected Payout" value="฿2.4M" />
                 </div>

                 <div className="p-6 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/10 space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-nexus-teal uppercase tracking-widest">
                       <Activity size={14} /> AI Recommendation
                    </div>
                    <p className="text-[12px] text-white/70 font-medium leading-relaxed">
                       "โครงการมีความเสี่ยงด้านต้นทุนสายสัญญาณที่เพิ่มขึ้น 12% เมื่อเทียบกับแผนงานเบื้องต้น แนะนำให้ตรวจสอบใบสั่งซื้อส่วนเกินในงวดถัดไป"
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
}

function AnalysisCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
       <div className="text-white/20">{icon}</div>
       <div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</p>
          <p className="text-xl font-black text-white mt-1">{value}</p>
       </div>
    </div>
  );
}
