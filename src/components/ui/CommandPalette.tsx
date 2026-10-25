"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Package, ShoppingCart, Briefcase, Users, Wallet, BrainCircuit, X, PlusCircle, ScanBarcode, Sparkles } from "lucide-react";
import { cn } from "@/components/ui/Base";
import { useRouter } from "next/navigation";

/**
 * [UX] Command Palette (Ctrl+K)
 * Fast navigation and search for NEXUS ERP.
 */
export const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  if (!isOpen) return null;

  const results = [
    { id: "nav-1", label: "ภาพรวมระบบ", icon: <LayoutDashboard size={16} />, path: "/", type: "NAV" },
    { id: "nav-2", label: "คลังสินค้าและพัสดุ", icon: <Package size={16} />, path: "/inventory", type: "NAV" },
    { id: "nav-3", label: "งานขาย", icon: <ShoppingCart size={16} />, path: "/sales", type: "NAV" },
    { id: "nav-4", label: "บริหารโครงการ", icon: <Briefcase size={16} />, path: "/projects", type: "NAV" },
    { id: "nav-5", label: "การเงินและบัญชี", icon: <Wallet size={16} />, path: "/finance", type: "NAV" },
    { id: "ai-1", label: "NEXUS Brain (AI วิเคราะห์)", icon: <BrainCircuit size={16} />, path: "/ai", type: "NAV" },
    // Actions
    { id: "act-1", label: "สร้างใบเสนอราคาใหม่", icon: <PlusCircle size={16} />, action: () => router.push("/sales?new=true"), type: "ACT" },
    { id: "act-2", label: "สแกน Serial Number", icon: <ScanBarcode size={16} />, action: () => router.push("/inventory?scan=true"), type: "ACT" },
    { id: "act-3", label: "AI: ตรวจสอบความเสี่ยงโครงการ", icon: <Sparkles size={16} />, action: () => router.push("/projects?ai=risk"), type: "ACT" },
  ].filter(item => item.label.includes(search));

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsOpen(false)} />
      
      <div className="w-full max-w-2xl glass-card bg-zinc-900/90 border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <Search className="text-nexus-blue" size={20} />
          <input 
            autoFocus
            placeholder="พิมพ์เพื่อค้นหาหรือสั่งการ..." 
            className="flex-1 bg-transparent border-none outline-none text-white text-xl font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[11px] text-white/40 font-mono">ESC</div>
        </div>

        <div className="p-2 max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else if (item.path) {
                      router.push(item.path);
                    }
                    setIsOpen(false);
                  }}
                  className="w-full p-3 rounded-xl flex items-center gap-3 text-white/60 hover:text-white hover:bg-nexus-blue/10 hover:border-nexus-blue/20 border border-transparent transition-all group"
                >
                  <span className="text-white/20 group-hover:text-nexus-blue">{item.icon}</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[13px] font-bold">{item.label}</span>
                    <span className="text-[11px] text-white/20 uppercase font-bold tracking-widest">{item.type === "NAV" ? "Navigation" : "Action"}</span>
                  </div>
                  <span className="ml-auto text-[11px] text-white/20 uppercase tracking-[0.2em] font-bold">
                    {item.type === "NAV" ? "GO TO" : "RUN"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-white/20">
              <p className="text-sm">ไม่พบข้อมูลที่ค้นหา</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-6">
            <Hint label="Enter" action="เพื่อเลือก" />
            <Hint label="↑↓" action="เพื่อย้าย" />
          </div>
          <span className="text-[11px] text-white/20 font-bold uppercase tracking-[0.2em]">NEXUS Intelligence Command</span>
        </div>
      </div>
    </div>
  );
};

const Hint = ({ label, action }: { label: string, action: string }) => (
  <div className="flex items-center gap-2 text-[11px] text-white/40 font-bold">
    <span className="px-2 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-white/60">{label}</span>
    <span>{action}</span>
  </div>
);

const LayoutDashboard = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
);
