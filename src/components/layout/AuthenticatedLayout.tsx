"use client";

import React from "react";
import { 
  PieChart,
  MonitorSmartphone,
  BadgeDollarSign,
  FolderKanban, 
  Headset,
  UsersRound,
  Store,
  Warehouse,
  ShoppingBasket,
  Landmark,
  Bot,
  UserCircle2,
  SlidersHorizontal,
  History,
  Zap,
  Search,
  LogOut,
  Plus,
  ChevronRight,
  UserCog,
  Activity,
  ShieldCheck,
  HardHat,
  FileText
} from "lucide-react";
import { CommandPalette } from "@/components/ui/CommandPalette";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { cn, PillButton, NexusSearchInput } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { auth as firebaseAuth } from "@/lib/firebase-client";
import { signOut } from "firebase/auth";
import { EntitySelector } from "@/components/layout/EntitySelector";
import { TacticalQuickAction } from "@/components/shared/TacticalQuickAction";
import { FirebaseConnectionStatus } from "@/components/ui/FirebaseConnectionStatus";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await signOut(firebaseAuth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0D0D0D] text-white selection:bg-nexus-teal/30">
      <CommandPalette />
      
      {/* [1] Sidebar - Full Intelligence OS Structure */}
      <aside className="w-[240px] hidden lg:flex flex-col border-r border-white/5 bg-[#0a0a0c] relative flex-shrink-0">
        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Brand Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-nexus-teal rounded-xl flex items-center justify-center shadow-neon-teal">
              <Zap size={20} className="text-black fill-current drop-shadow-md" />
            </div>
            <div>
              <h2 className="font-black text-lg leading-none tracking-tight">NEXUS ERP</h2>
              <p className="text-[13px] font-bold text-nexus-teal uppercase tracking-[0.2em] mt-1 drop-shadow-neon">Intelligence OS</p>
            </div>
          </div>

          <EntitySelector />

          {/* Navigation Matrix */}
          <nav className="space-y-4">
            {/* SERVICE TIER */}
            <NavGroup title="บริการ">
              <SideLink href="/pos" icon={<MonitorSmartphone size={20} />} label="POS" active={pathname === "/pos"} title="ระบบขายหน้าร้านอัจฉริยะ" />
              <SideLink href="/support" icon={<Headset size={20} />} label="แจ้งซ่อม" active={pathname === "/support"} title="ระบบแจ้งซ่อมและงานบริการเทคนิค" />
            </NavGroup>

            {/* OPERATIONS TIER */}
            <NavGroup title="การปฏิบัติงาน">
              <SideLink href="/dashboard" icon={<Activity size={20} />} label="แดชบอร์ด" enLabel="dashboard" active={pathname === "/dashboard"} title="แดชบอร์ดแสดงสถานะภาพรวมของระบบ" />
              <SideLink href="/sales" icon={<BadgeDollarSign size={20} />} label="งานขาย" enLabel="sales" active={pathname === "/sales"} title="ระบบใบเสนอราคาและบริหารลูกค้าสัมพันธ์" />
              <SideLink href="/projects" icon={<FolderKanban size={20} />} label="โครงการ" enLabel="projects" active={pathname === "/projects" || pathname === "/projects/subcontractors"} title="ระบบบริหารจัดการโครงการและไซต์งาน" />
              <SideLink href="/hr" icon={<UsersRound size={20} />} label="บุคคล" enLabel="hr" active={pathname === "/hr"} title="ระบบบริหารทรัพยากรบุคคลและเงินเดือน" />
              <SideLink href="/inventory" icon={<Warehouse size={20} />} label="คลังสินค้า" enLabel="inventory" active={pathname === "/inventory"} title="ระบบบริหารคลังสินค้าและพัสดุคงคลัง" />
              <SideLink href="/procurement" icon={<ShoppingBasket size={20} />} label="จัดซื้อ" enLabel="purchase" active={pathname === "/procurement"} title="ระบบสั่งซื้อสินค้าและบริหารคู่ค้า" />
              <SideLink href="/projects/subcontractors" icon={<HardHat size={20} />} label="ค่าแรงช่าง" active={pathname === "/projects/subcontractors"} title="จัดการการจ่ายเงินค่าแรงทีมช่าง" />
            </NavGroup>

            {/* MANAGEMENT TIER */}
            <NavGroup title="การบริหาร">
              <SideLink href="/finance" icon={<Landmark size={20} />} label="บัญชี" enLabel="accounting" active={pathname === "/finance"} title="ระบบบัญชีและการเงินภาพรวม" />
              <SideLink href="/ai" icon={<Bot size={20} />} label="ศูนย์วิเคราะห์ AI" active={pathname === "/ai"} title="ศูนย์รวมปัญญาประดิษฐ์" />
            </NavGroup>

            {/* SYSTEM TIER */}
            <NavGroup title="ระบบ">
              <SideLink href="/settings" icon={<SlidersHorizontal size={20} />} label="ตั้งค่า" enLabel="settings" active={pathname?.startsWith("/settings")} title="จัดการการตั้งค่าและผู้ใช้งาน" />
            </NavGroup>
          </nav>
        </div>

        {/* User Intelligence Profile */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5 space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-all cursor-pointer">
             <div className="w-10 h-10 rounded-xl bg-nexus-blue/20 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 flex-shrink-0">
                <UserCog size={20} />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate uppercase">{user?.email?.split('@')[0] || 'ผู้ใช้งาน'}</p>
                <p className="text-[13px] font-bold text-nexus-teal uppercase tracking-widest mt-0.5">{role || 'ไม่มีสิทธิ์'}</p>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full rounded-full text-[13px] font-bold text-white/20 hover:text-danger hover:bg-danger/10 transition-all uppercase tracking-widest"
          >
            <LogOut size={14} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Command Center Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <header className="h-16 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-5">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-4 border-r border-white/10 pr-5">
               <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-nexus-teal hover:bg-white/10 transition-all cursor-pointer">
                     <Link href="/dashboard"><PieChart size={16} /></Link>
                  </div>
                  <nav className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-white/20">
                     <span className="hover:text-white cursor-pointer transition-colors">ภาพรวม</span>
                     <ChevronRight size={10} />
                     <span className="text-nexus-teal bg-nexus-teal/10 px-3 py-1 rounded-full border border-nexus-teal/20">ระบบปฏิบัติการ NEXUS</span>
                  </nav>
               </div>
            </div>
            
            <NexusSearchInput 
              placeholder="พิมพ์เพื่อค้นหา..." 
              className="w-80 hidden md:block"
              kbd="CTRL+K"
            />
            
            <FirebaseConnectionStatus />
            <LanguageSwitcher />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 relative" ref={profileRef}>
               {/* Redesigned Profile Capsule - Premium Static Glassmorphism */}
               <div 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={cn(
                     "h-10 pl-4 pr-1.5 rounded-full bg-white/[0.02] border border-white/5 hover:border-nexus-teal/30 hover:bg-white/[0.06] transition-all cursor-pointer flex items-center gap-3.5 group relative select-none",
                     isProfileOpen && "bg-white/[0.06] border-nexus-teal/40"
                  )}
               >
                  <div className="text-right hidden md:block select-none">
                     <p className="text-xs font-bold text-white leading-none uppercase tracking-wide truncate max-w-[140px]">
                        {user?.email ? user.email.split('@')[0] : 'admin'}
                     </p>
                     <div className="flex items-center justify-end gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal" />
                        <span className="text-[10px] font-bold text-nexus-teal uppercase tracking-widest leading-none font-mono">ONLINE</span>
                     </div>
                  </div>
                  
                  {/* Clean Monogram Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-nexus-teal/20 to-nexus-blue/20 border border-nexus-teal/30 flex items-center justify-center text-[12px] font-black text-nexus-teal select-none group-hover:from-nexus-teal/30 group-hover:to-nexus-blue/30 group-hover:border-nexus-teal/60 transition-all duration-300">
                     {(user?.email || 'A').charAt(0).toUpperCase()}
                  </div>
               </div>

               {isProfileOpen && (
                 <div className="absolute top-full right-0 mt-3 w-72 z-[2000] bg-[#0A0A0C]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] p-2 duration-200">
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nexus-teal via-nexus-blue to-nexus-teal rounded-t-2xl" />
                    
                    {/* User Identity Info Card */}
                    <div className="p-4 border-b border-white/5 mb-2 mt-1 bg-white/[0.01] rounded-xl border border-white/[0.02]">
                       <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">USER ACCESS CREDENTIAL</p>
                       <p className="text-[13px] font-black text-white truncate uppercase font-mono tracking-tight">{user?.email || 'admin@nexus.os'}</p>
                       
                       <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
                          <span className="font-bold text-white/30 uppercase tracking-wider">LEVEL:</span>
                          <span className="font-black text-nexus-teal uppercase tracking-widest bg-nexus-teal/10 px-2 py-0.5 rounded border border-nexus-teal/20">
                             {role || 'SYSTEM_ADMIN'}
                          </span>
                       </div>
                       
                       <div className="mt-2 flex items-center justify-between text-[9px] text-white/20 font-mono">
                          <span>SECURE NODE:</span>
                          <span className="font-bold text-white/40">AES_256_ACTIVE</span>
                       </div>
                    </div>

                    <button className="w-full h-9 flex items-center gap-3 px-4 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-left group">
                       <UserCog size={15} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
                       <span className="text-[11px] font-black uppercase tracking-wider">ตั้งค่าโปรไฟล์</span>
                    </button>
                    <button className="w-full h-9 flex items-center gap-3 px-4 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-left group">
                       <ShieldCheck size={15} className="text-white/20 group-hover:text-nexus-teal transition-colors" />
                       <span className="text-[11px] font-black uppercase tracking-wider">ความปลอดภัย</span>
                    </button>
                    
                    <div className="h-px bg-white/5 my-2 mx-2" />
                    
                    <button 
                       onClick={handleLogout}
                       className="w-full h-9 flex items-center gap-3 px-4 rounded-xl text-white/60 hover:text-danger hover:bg-danger/10 transition-all text-left group"
                    >
                       <LogOut size={15} className="text-white/20 group-hover:text-danger transition-colors" />
                       <span className="text-[11px] font-black uppercase tracking-wider">ออกจากระบบ</span>
                    </button>
                 </div>
               )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#020203] bg-nexus-grid relative custom-scrollbar">
          {/* Ambient Light Effect */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-nexus-teal/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-nexus-blue/5 blur-[120px] rounded-full pointer-events-none translate-y-1/2" />
          
          <div className="relative z-20">
            {children}
          </div>
        </main>


        {/* Tactical Quick-Action FAB (Context-Aware) */}
        <TacticalQuickAction />
      </div>
    </div>
  );
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="tactical-label !text-white/20 px-3">{title}</p>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

function SideLink({ href, icon, label, enLabel, active, title }: { href: string; icon: any; label: string; enLabel?: string; active?: boolean; title?: string }) {
  return (
    <Link 
      href={href}
      title={title}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all group relative",
        active 
          ? "bg-white/5 text-white border border-white/10 shadow-lg" 
          : "text-white/40 hover:text-white hover:bg-white/[0.03]"
      )}
    >
      <div className={cn(
        "transition-all duration-300 flex-shrink-0",
        active ? "text-nexus-teal drop-shadow-neon" : "group-hover:text-white"
      )}>
        {React.cloneElement(icon as React.ReactElement, { size: 18 })}
      </div>
      <div className="flex flex-col">
        <span className={cn(
          "text-[13px] font-bold transition-all duration-300",
          active ? "text-white" : "text-white/60 group-hover:text-white"
        )}>{label}</span>
        {enLabel && (
          <span className={cn(
            "text-[10px] font-medium uppercase tracking-widest transition-all duration-300",
            active ? "text-nexus-teal/80" : "text-white/20 group-hover:text-white/40"
          )}>({enLabel})</span>
        )}
      </div>
      
      {active && (
        <div className="absolute left-0 w-1 h-5 bg-nexus-teal rounded-r-full shadow-neon-teal" />
      )}
    </Link>
  );
}
