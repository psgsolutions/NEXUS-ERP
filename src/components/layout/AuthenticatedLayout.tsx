"use client";

import { cn } from "@/components/ui/Base";
import { PillInput } from "@/components/ui/Base";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Briefcase, 
  Users, 
  Wallet, 
  BrainCircuit,
  Search,
  Bell,
  Settings,
  Cpu,
  LogOut,
  Beaker
} from "lucide-react";
import { CommandPalette } from "@/components/ui/CommandPalette";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      <CommandPalette />
      {/* Sidebar - Tactical & Precise [Blueprint] */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col p-4 z-20">
        <div className="flex items-center gap-3 px-2 mb-10 mt-2">
          <div className="w-8 h-8 bg-nexus-blue rounded-full flex items-center justify-center shadow-nexus-glow">
            <Cpu className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-bold tracking-wider text-white">NEXUS <span className="text-nexus-blue">ERP</span></span>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem 
            href="/" 
            icon={<LayoutDashboard size={18} />} 
            label="ภาพรวมระบบ" 
            active={pathname === "/"} 
          />
          <NavItem 
            href="/inventory" 
            icon={<Package size={18} />} 
            label="คลังสินค้าและพัสดุ" 
            active={pathname === "/inventory"} 
          />
          <NavItem href="/sales" icon={<ShoppingCart size={18} />} label="งานขาย (POS)" />
          <NavItem href="/projects" icon={<Briefcase size={18} />} label="บริหารโครงการ" />
          <NavItem href="/finance" icon={<Wallet size={18} />} label="การเงินและบัญชี" />
          <NavItem href="/hr" icon={<Users size={18} />} label="ทรัพยากรบุคคล" />
          <NavItem 
            href="/simulation" 
            icon={<Beaker size={18} />} 
            label="Simulation Lab" 
            active={pathname === "/simulation"} 
            className="mt-4 border border-white/5 bg-white/5"
          />
        </nav>

        <div className="mt-auto pt-4 border-t border-white/5 space-y-1">
          <NavItem 
            href="/ai" 
            icon={<BrainCircuit size={18} />} 
            label="NEXUS Brain (AI)" 
            className="text-nexus-teal border border-nexus-teal/20 bg-nexus-teal/5" 
          />
          <NavItem href="/settings" icon={<Settings size={18} />} label="ตั้งค่าระบบ" />
          <button className="w-full h-9 px-3 rounded-full flex items-center gap-3 text-danger/60 hover:text-danger hover:bg-danger/10 transition-all text-sm mt-4">
            <LogOut size={18} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Actions - Standard for all pages */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-black/20 z-10">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <PillInput placeholder="ค้นหาด่วน (Ctrl+K)..." className="w-full pl-11" />
          </div>

          <div className="flex items-center gap-4">
            <button className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors border border-white/10">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right">
                <p className="text-sm font-medium text-white">ADMIN USER</p>
                <p className="text-xs text-white/40">NEXUS ENTERPRISE</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-nexus-blue p-[1px]">
                <div className="w-full h-full rounded-full bg-[#09090b] flex items-center justify-center overflow-hidden text-nexus-blue font-bold text-xs">
                  NX
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ 
  href, 
  icon, 
  label, 
  active = false, 
  className 
}: { 
  href: string;
  icon: React.ReactNode; 
  label: string; 
  active?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "w-full h-9 px-3 rounded-full flex items-center gap-3 transition-all duration-200 group text-sm tracking-normal",
        active 
          ? "bg-nexus-blue text-black font-bold shadow-nexus-glow" 
          : "text-white/60 hover:text-white hover:bg-white/5",
        className
      )}
    >
      <span className={active ? "text-black" : "text-white/40 group-hover:text-nexus-blue transition-colors"}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
