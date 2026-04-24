"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { 
  Plus, 
  ScanBarcode, 
  Receipt, 
  Briefcase, 
  Sparkles, 
  ChevronUp,
  X,
  PlusCircle,
  FileText,
  Truck,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/components/ui/Base";

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  isAI?: boolean;
}

/**
 * [UX-PROTOCOL-V3.5]
 * Tactical Quick-Action (FAB)
 * Context-Aware: Changes behavior based on current module.
 */
export function TacticalQuickAction() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Define actions based on current path
  const getContextActions = (): QuickAction[] => {
    if (pathname.includes("/inventory")) {
      return [
        { label: "สแกนพัสดุ / ซีเรียล (SERIAL)", icon: <ScanBarcode size={18} />, action: () => console.log("Scan SN") },
        { label: "บันทึกรับสินค้า (GOODS RECEIPT)", icon: <Truck size={18} />, action: () => console.log("Receive Item") },
        { label: "AI: พยากรณ์ความต้องการสต็อก", icon: <Sparkles size={18} />, action: () => console.log("AI Forecast"), isAI: true },
      ];
    }
    if (pathname.includes("/sales")) {
      return [
        { label: "สร้างใบเสนอราคา (QUOTATION)", icon: <FileText size={18} />, action: () => console.log("New QT") },
        { label: "เปิดจุดขายอัจฉริยะ (POS)", icon: <Receipt size={18} />, action: () => console.log("Open POS") },
        { label: "AI: วิเคราะห์อัตรากำไร", icon: <Sparkles size={18} />, action: () => console.log("AI Margin"), isAI: true },
      ];
    }
    if (pathname.includes("/projects")) {
      return [
        { label: "บันทึกใบงานบริการ (SERVICE REPORT)", icon: <PlusCircle size={18} />, action: () => console.log("New Report") },
        { label: "บันทึกความคืบหน้าโครงการ", icon: <Briefcase size={18} />, action: () => console.log("Update Milestone") },
        { label: "AI: ตรวจสอบความเสี่ยงโครงการ", icon: <ShieldCheck size={18} />, action: () => console.log("AI Risk Check"), isAI: true },
      ];
    }
    // Default Global Actions
    return [
      { label: "สร้างใบงานด่วน", icon: <PlusCircle size={18} />, action: () => console.log("Global New") },
      { label: "ค้นหาอัจฉริยะ", icon: <Sparkles size={18} />, action: () => console.log("Global AI Search"), isAI: true },
    ];
  };

  const actions = getContextActions();

  return (
    <div className="absolute bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
      {/* Action Menu */}
      {isOpen && (
        <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300">
          {actions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                item.action();
                setIsOpen(false);
              }}
              className={cn(
                "group flex items-center gap-3 px-5 h-9 rounded-full border transition-all whitespace-nowrap shadow-2xl backdrop-blur-xl",
                item.isAI 
                  ? "bg-nexus-teal/10 border-nexus-teal/30 text-nexus-teal hover:bg-nexus-teal/20" 
                  : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
              <div className={cn(
                "p-1.5 rounded-lg border",
                item.isAI ? "bg-nexus-teal text-black border-nexus-teal" : "bg-white/10 border-white/10"
              )}>
                {item.icon}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center text-black transition-all shadow-2xl active:scale-90 group",
          isOpen 
            ? "bg-white rotate-90" 
            : "bg-nexus-teal shadow-neon-teal hover:scale-110"
        )}
      >
        {isOpen ? <X size={28} /> : <Plus size={28} className="group-hover:rotate-90 transition-transform duration-500" />}
        
        {!isOpen && (
          <div className="absolute inset-0 rounded-2xl animate-ping bg-nexus-teal/20 -z-10" />
        )}
      </button>
    </div>
  );
}
