"use client";

import React from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Wrench, 
  Users, 
  Package, 
  FileText, 
  BarChart3, 
  Settings,
  Database,
  Search,
  Bell,
  Cpu,
  LogOut,
  Plus
} from "lucide-react";
import { CommandPalette } from "@/components/ui/CommandPalette";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/Base";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#020203] text-white">
      <CommandPalette />
      
      {/* Sidebar - Tactical Dark V2.7 */}
      <aside className="w-[260px] flex flex-col border-r border-white/5 bg-[#0a0a0c] z-30">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-nexus-teal rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(20,163,204,0.3)]">
              <Cpu size={24} className="text-black" />
            </div>
            <div>
              <h2 className="font-black text-sm tracking-tighter">STOCKPILOT V2.7</h2>
              <p className="text-[10px] text-nexus-teal font-bold uppercase tracking-widest">• ADMIN</p>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input 
              placeholder="ค้นหาฟังก์ชัน..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-nexus-teal/50 transition-all"
            />
          </div>

          <nav className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4 ml-2">การปฏิบัติงาน (OPERATIONS)</p>
              <div className="space-y-1">
                <SideLink href="/" icon={<LayoutDashboard size={18} />} label="หน้าหลัก" active={pathname === "/"} />
                <SideLink href="/sales" icon={<ShoppingCart size={18} />} label="งานขายและลูกค้า" />
                <SideLink href="/projects" icon={<FileText size={18} />} label="บริหารโครงการ" />
                <SideLink href="/hr" icon={<Users size={18} />} label="ทรัพยากรบุคคล" />
                <SideLink href="/inventory" icon={<Package size={18} />} label="บริหารคลังสินค้า" />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4 ml-2">การบริหาร (MANAGEMENT)</p>
              <div className="space-y-1">
                <SideLink href="/finance" icon={<BarChart3 size={18} />} label="รายงานบัญชีและงบ" />
                <SideLink href="/ai" icon={<Database size={18} />} label="วิเคราะห์และตั้งค่า" />
                <SideLink href="/settings" icon={<Settings size={18} />} label="จัดการนิติบุคคล" />
              </div>
            </div>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5">
          <button className="flex items-center gap-3 text-white/40 hover:text-danger transition-colors text-xs font-bold uppercase tracking-widest">
            <LogOut size={16} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header - Unified Build */}
        <header className="h-16 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-white/40">
              <LayoutDashboard size={18} />
            </div>
            <h1 className="text-sm font-bold text-white/60">หน้าหลัก</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs font-bold text-white">admin@admin.com</p>
              <p className="text-[10px] text-nexus-teal font-black uppercase tracking-widest">ADMIN</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-nexus-blue to-nexus-teal opacity-50" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#020203] relative">
          {children}
        </main>

        {/* Floating Command Button */}
        <button className="absolute bottom-8 right-8 w-14 h-14 bg-nexus-teal rounded-2xl flex items-center justify-center text-black shadow-[0_0_20px_rgba(20,163,204,0.4)] hover:scale-110 transition-all z-50">
          <Cpu size={28} />
        </button>
      </div>
    </div>
  );
}

function SideLink({ href, icon, label, active }: { href: string; icon: any; label: string; active?: boolean }) {
  return (
    <Link 
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
        active 
          ? "bg-white/5 text-white border border-white/10" 
          : "text-white/40 hover:text-white hover:bg-white/5"
      )}
    >
      <div className={cn(
        "transition-colors",
        active ? "text-nexus-teal" : "group-hover:text-nexus-teal"
      )}>
        {icon}
      </div>
      <span className="text-xs font-medium">{label}</span>
      {active && (
        <div className="ml-auto w-1 h-4 bg-nexus-teal rounded-full shadow-[0_0_8px_rgba(20,163,204,1)]" />
      )}
    </Link>
  );
}
