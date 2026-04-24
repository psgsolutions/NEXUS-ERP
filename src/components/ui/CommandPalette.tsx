"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Package, ShoppingCart, Briefcase, Users, Wallet, BrainCircuit, X } from "lucide-react";
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
    { id: "nav-1", label: "ภาพรวมระบบ", icon: <LayoutDashboard size={16} />, path: "/" },
    { id: "nav-2", label: "คลังสินค้าและพัสดุ", icon: <Package size={16} />, path: "/inventory" },
    { id: "nav-3", label: "งานขาย (POS)", icon: <ShoppingCart size={16} />, path: "/sales" },
    { id: "nav-4", label: "บริหารโครงการ", icon: <Briefcase size={16} />, path: "/projects" },
    { id: "nav-5", label: "การเงินและบัญชี", icon: <Wallet size={16} />, path: "/finance" },
    { id: "ai-1", label: "NEXUS Brain (AI วิเคราะห์)", icon: <BrainCircuit size={16} />, path: "/ai" },
  ].filter(item => item.label.includes(search));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      <div className="w-full max-w-2xl glass-card bg-zinc-900/90 border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <Search className="text-nexus-blue" size={20} />
          <input 
            autoFocus
            placeholder="พิมพ์เพื่อค้นหาหรือสั่งการ..." 
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20 text-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[10px] text-white/40 font-mono">ESC</div>
        </div>

        <div className="p-2 max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.path);
                    setIsOpen(false);
                  }}
                  className="w-full p-3 rounded-xl flex items-center gap-3 text-white/60 hover:text-white hover:bg-nexus-blue/10 hover:border-nexus-blue/20 border border-transparent transition-all group"
                >
                  <span className="text-white/20 group-hover:text-nexus-blue">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="ml-auto text-[10px] text-white/20 uppercase tracking-widest font-bold">นำทางไป</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-white/20">
              <p className="text-sm">ไม่พบข้อมูลที่ค้นหา</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-4">
            <Hint label="Enter" action="เพื่อเลือก" />
            <Hint label="↑↓" action="เพื่อย้าย" />
          </div>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">NEXUS Quick Access</span>
        </div>
      </div>
    </div>
  );
};

const Hint = ({ label, action }: { label: string, action: string }) => (
  <div className="flex items-center gap-1.5 text-[10px] text-white/40">
    <span className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-white/60">{label}</span>
    <span>{action}</span>
  </div>
);

const LayoutDashboard = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
);
