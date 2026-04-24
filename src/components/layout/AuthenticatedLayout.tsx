"use client";

import React from "react";
import { 
  LayoutGrid, 
  Receipt, 
  Briefcase, 
  UserCog, 
  BoxSelect, 
  Wallet, 
  Sparkles, 
  ShieldCheck,
  Search,
  Cpu,
  LogOut,
  Bell,
  Command,
  Plus
} from "lucide-react";
import { CommandPalette } from "@/components/ui/CommandPalette";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { auth as firebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(firebaseAuth);
      window.location.reload();
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#020203] text-white">
      <CommandPalette />
      
      {/* Sidebar - Tactical Intelligence V2.9 */}
      <aside className="w-[280px] flex flex-col border-r border-white/5 bg-[#0a0a0c] z-30">
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Logo Section */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 bg-nexus-teal rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,187,168,0.3)] animate-pulse">
              <Cpu size={26} className="text-black" />
            </div>
            <div>
              <h2 className="font-black text-sm tracking-tighter leading-none">STOCKPILOT</h2>
              <p className="text-[10px] text-nexus-teal font-black uppercase tracking-[0.2em] mt-1">V2.9 CORE</p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative mb-8 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-nexus-teal transition-colors" size={14} />
            <input 
              placeholder="COMMAND (CTRL+K)" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-9 pr-4 text-[10px] font-bold tracking-widest focus:outline-none focus:border-nexus-teal/40 focus:bg-white/10 transition-all uppercase"
            />
          </div>

          {/* Navigation Groups */}
          <nav className="space-y-8">
            <NavGroup title="Operation Units">
              <SideLink href="/dashboard" icon={<LayoutGrid size={18} />} label="หน้าหลัก" active={pathname === "/dashboard"} />
              <SideLink href="/sales" icon={<Receipt size={18} />} label="งานขาย / POS" active={pathname === "/sales"} />
              <SideLink href="/projects" icon={<Briefcase size={18} />} label="บริหารโครงการ" active={pathname === "/projects"} />
              <SideLink href="/hr" icon={<UserCog size={18} />} label="จัดการบุคลากร" active={pathname === "/hr"} />
              <SideLink href="/inventory" icon={<BoxSelect size={18} />} label="คลังพัสดุอัจฉริยะ" active={pathname === "/inventory"} />
            </NavGroup>

            <NavGroup title="Strategic Units">
              <SideLink href="/finance" icon={<Wallet size={18} />} label="บัญชีและงบประมาณ" active={pathname === "/finance"} />
              <SideLink href="/ai" icon={<Sparkles size={18} />} label="วิเคราะห์ AI" active={pathname === "/ai"} />
              <SideLink href="/settings" icon={<ShieldCheck size={18} />} label="ตั้งค่าองค์กร" active={pathname === "/settings"} />
            </NavGroup>
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/5 mb-4">
             <div className="w-9 h-9 rounded-xl bg-nexus-blue/20 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                <UserCog size={20} />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white truncate uppercase tracking-tighter">{user?.email || 'OFFLINE'}</p>
                <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">SYSTEM ADMIN</p>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[10px] font-black text-white/30 hover:text-danger hover:bg-danger/10 transition-all uppercase tracking-[0.2em]"
          >
            <LogOut size={14} />
            Termination Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Dynamic Header */}
        <header className="h-16 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-nexus-teal/10 rounded-xl border border-nexus-teal/20 text-nexus-teal">
              <Command size={18} />
            </div>
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="text-white/20 hover:text-white transition-colors cursor-pointer">Nexus OS</span>
              <span className="text-white/10">/</span>
              <span className="text-nexus-teal underline underline-offset-4 decoration-2">Tactical View</span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
              <Bell size={18} />
            </button>
            <div className="h-8 w-[1px] bg-white/5" />
            <div className="flex items-center gap-3 pl-2">
               <div className="text-right hidden md:block">
                  <p className="text-[10px] font-black text-white leading-tight">V2.9 CORE</p>
                  <p className="text-[9px] text-nexus-teal font-black uppercase tracking-widest animate-pulse">Online</p>
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#020203] relative custom-scrollbar">
          {children}
        </main>

        {/* Tactical FAB */}
        <button className="absolute bottom-8 right-8 w-14 h-14 bg-nexus-teal rounded-2xl flex items-center justify-center text-black shadow-[0_0_30px_rgba(16,187,168,0.4)] hover:scale-110 active:scale-95 transition-all z-50 group">
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>
    </div>
  );
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 ml-4">{title}</p>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function SideLink({ href, icon, label, active }: { href: string; icon: any; label: string; active?: boolean }) {
  return (
    <Link 
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative",
        active 
          ? "bg-white/5 text-white border border-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]" 
          : "text-white/40 hover:text-white hover:bg-white/5"
      )}
    >
      <div className={cn(
        "transition-all duration-500",
        active ? "text-nexus-teal scale-110 drop-shadow-[0_0_8px_rgba(16,187,168,0.6)]" : "group-hover:text-nexus-teal"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-xs font-bold transition-all duration-300",
        active ? "tracking-normal" : "tracking-tight"
      )}>{label}</span>
      
      {active && (
        <div className="absolute left-0 w-1 h-5 bg-nexus-teal rounded-r-full shadow-[0_0_15px_rgba(16,187,168,1)]" />
      )}
    </Link>
  );
}
