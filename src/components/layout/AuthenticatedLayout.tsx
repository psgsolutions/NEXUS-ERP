"use client";

import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
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
  FileText,
  Layers,
  ShoppingCart,
  Wrench,
  Library,
  Sparkles,
  Settings,
  Lock,
  TrendingUp,
  FileSpreadsheet,
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
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TacticalQuickAction } from "@/components/shared/TacticalQuickAction";
import { FirebaseConnectionStatus } from "@/components/ui/FirebaseConnectionStatus";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { canAccessRoute, roleLabel } from "@/lib/permissions";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, roles, loading } = useAuth();
  // เมนูและหน้าที่เปิดได้ตามตำแหน่ง (server ตรวจสิทธิ์ซ้ำทุกครั้งที่บันทึก)
  const show = (href: string) => canAccessRoute(roles, href);
  const roleText = roles.length ? roles.map(roleLabel).join(" · ") : "ไม่มีสิทธิ์";
  const pageAllowed = loading || !pathname || canAccessRoute(roles, pathname);
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
    <div className="flex h-screen overflow-hidden bg-surface-0 text-white selection:bg-nexus-teal/30">
      <CommandPalette />
      
      {/* [1] Sidebar - Full Intelligence OS Structure */}
      <aside className="w-[240px] hidden lg:flex flex-col border-r border-white/5 bg-surface-0 relative flex-shrink-0 z-[100]">
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Brand Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-nexus-teal/15 rounded-xl flex items-center justify-center shadow-neon-teal border border-nexus-teal/20">
              <Zap size={20} className="text-nexus-teal fill-current drop-shadow-md" />
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-none tracking-tight">NEXUS ERP</h2>
              <p className="text-[14px] leading-none font-bold text-nexus-teal uppercase tracking-[0.2em] mt-1 drop-shadow-neon">Intelligence OS</p>
            </div>
          </div>

          <EntitySelector />

          {/* Navigation Matrix */}
          <nav className="space-y-4 relative z-50">
            {/* SERVICE TIER */}
            <NavGroup title="บริการ">
              {show("/pos") && <SideLink href="/pos" icon={<Store size={20} />} label="ขายหน้าร้าน" active={pathname === "/pos"} title="POS" />}
              {show("/support") && <SideLink href="/support" icon={<Wrench size={20} />} label="งานบริการ" active={pathname === "/support"} title="Service" />}
              {show("/service/dispatch") && <SideLink href="/service/dispatch" icon={<Layers size={20} />} label="ศูนย์จ่ายงาน" active={pathname === "/service/dispatch"} title="Dispatch" />}
              {show("/mobile/technician") && <SideLink href="/mobile/technician" icon={<HardHat size={20} />} label="งานของฉัน" active={pathname === "/mobile/technician"} title="Field" />}
            </NavGroup>

            {/* OPERATIONS TIER */}
            <NavGroup title="การปฏิบัติงาน">
              {show("/dashboard") && <SideLink href="/dashboard" icon={<PieChart size={20} />} label="ภาพรวม" active={pathname === "/dashboard"} title="Dashboard" />}
              {show("/sales") && <SideLink href="/sales" icon={<BadgeDollarSign size={20} />} label="งานขาย" active={pathname === "/sales"} title="Sales" />}
              {show("/projects") && <SideLink href="/projects" icon={<FolderKanban size={20} />} label="โครงการ" active={pathname === "/projects"} title="Projects" />}
              {show("/hr") && <SideLink href="/hr" icon={<UsersRound size={20} />} label="บุคลากร" active={pathname === "/hr"} title="HR" />}
              {show("/inventory") && <SideLink href="/inventory" icon={<Warehouse size={20} />} label="คลังสินค้า" active={pathname === "/inventory"} title="Inventory" />}
              {show("/procurement") && <SideLink href="/procurement" icon={<ShoppingBasket size={20} />} label="จัดซื้อ" active={pathname === "/procurement"} title="Procurement" />}
            </NavGroup>

            {/* MANAGEMENT TIER */}
            <NavGroup title="การบริหารจัดการ">
              {show("/executive") && <SideLink href="/executive" icon={<TrendingUp size={20} />} label="แดชบอร์ดผู้บริหาร" active={pathname === "/executive"} title="Executive" />}
              {show("/finance") && <SideLink href="/finance" icon={<Landmark size={20} />} label="บัญชีแยกประเภท" active={pathname === "/finance"} title="GL" />}
              {show("/finance/subledgers") && <SideLink href="/finance/subledgers" icon={<Library size={20} />} label="บัญชีย่อยและทะเบียน" active={pathname === "/finance/subledgers"} title="Subledgers" />}
              {show("/finance/reports") && <SideLink href="/finance/reports" icon={<FileText size={20} />} label="รายงานบัญชีและภาษี" active={pathname === "/finance/reports"} title="Reports" />}
              {show("/ai") && <SideLink href="/ai" icon={<Bot size={20} />} label="วิเคราะห์ข้อมูล" active={pathname === "/ai"} title="AI Analytics" />}
            </NavGroup>

            {/* SYSTEM TIER */}
            <NavGroup title="ระบบงาน">
              {show("/data-import") && <SideLink href="/data-import" icon={<FileSpreadsheet size={20} />} label="นำเข้าข้อมูล Excel" active={pathname === "/data-import"} title="Import" />}
              {show("/settings") && <SideLink href="/settings" icon={<Settings size={20} />} label="ตั้งค่า" active={pathname?.startsWith("/settings")} title="Settings" />}
            </NavGroup>
          </nav>
        </div>

        {/* User Intelligence Profile */}
        <div className="p-4 pb-6 bg-white/[0.02] border-t border-white/5 space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/15 border border-white/20 group hover:bg-white/20 transition-all cursor-pointer">
             <div className="w-9 h-9 rounded-xl bg-nexus-blue/15 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 flex-shrink-0">
                <UserCog size={18} />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate uppercase leading-none">{user?.email?.split('@')[0] || 'ผู้ใช้งาน'}</p>
                <p className="text-[11px] font-bold text-nexus-teal tracking-wide mt-1 leading-normal truncate" title={roleText}>{roleText}</p>
             </div>
          </div>
          
          <ConnectionStatus className="w-full justify-center text-[11px] py-1 bg-white/[0.02] border-white/5" />
          
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full rounded-full text-[12px] leading-none font-bold text-white/40 hover:text-danger hover:bg-danger/15 transition-all uppercase tracking-widest py-1.5"
          >
            <LogOut size={14} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Command Center Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <header className="h-16 border-b border-white/5 bg-surface-0/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-5">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-4 md:border-r border-white/10 md:pr-5">
               <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-nexus-teal hover:bg-white/10 transition-all cursor-pointer">
                     <Link href="/dashboard"><PieChart size={16} /></Link>
                  </div>
                  {/* จอมือถือ: ซ่อนเส้นทางหน้า (พื้นที่ไม่พอ) */}
                  <nav className="hidden sm:flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-white/20 whitespace-nowrap">
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

          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell />
            <div className="flex items-center gap-4 relative" ref={profileRef}>
               {/* Redesigned Profile Capsule - Premium Static Glassmorphism */}
               <div 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={cn(
                     "h-10 pl-1.5 md:pl-4 pr-1.5 rounded-full bg-white/[0.02] border border-white/5 hover:border-nexus-teal/30 hover:bg-white/[0.06] transition-all cursor-pointer flex items-center gap-3.5 group relative select-none",
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
                 <div className="absolute top-full right-0 mt-3 w-72 z-[99999] bg-surface-0/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] p-2 duration-200">
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nexus-teal via-nexus-blue to-nexus-teal rounded-t-2xl" />
                    
                    {/* User Identity Info Card */}
                    <div className="p-4 border-b border-white/5 mb-2 mt-1 bg-white/[0.01] rounded-xl border border-white/[0.02]">
                       <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest mb-1">USER ACCESS CREDENTIAL</p>
                       <p className="text-[13px] font-black text-white truncate uppercase font-mono tracking-tight">{user?.email || 'admin@nexus.os'}</p>
                       
                       <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
                          <span className="font-bold text-white/30 uppercase tracking-wider">LEVEL:</span>
                          <span className="font-semibold text-nexus-teal uppercase tracking-widest bg-nexus-teal/10 px-2 py-0.5 rounded border border-nexus-teal/20">
                             {roleText}
                          </span>
                       </div>
                       
                       <div className="mt-2 flex items-center justify-between text-[9px] text-white/20 font-mono">
                          <span>SECURE NODE:</span>
                          <span className="font-bold text-white/40">AES_256_ACTIVE</span>
                       </div>
                    </div>

                    <button className="w-full h-9 flex items-center gap-3 px-4 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-left group">
                       <UserCog size={15} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
                       <span className="text-[11px] font-semibold uppercase tracking-wider">ตั้งค่าโปรไฟล์</span>
                    </button>
                    <button className="w-full h-9 flex items-center gap-3 px-4 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-left group">
                       <ShieldCheck size={15} className="text-white/20 group-hover:text-nexus-teal transition-colors" />
                       <span className="text-[11px] font-semibold uppercase tracking-wider">ความปลอดภัย</span>
                    </button>
                    
                    <div className="h-px bg-white/5 my-2 mx-2" />
                    
                    <button 
                       onClick={handleLogout}
                       className="w-full h-9 flex items-center gap-3 px-4 rounded-xl text-white/60 hover:text-danger hover:bg-danger/10 transition-all text-left group"
                    >
                       <LogOut size={15} className="text-white/20 group-hover:text-danger transition-colors" />
                       <span className="text-[11px] font-semibold uppercase tracking-wider">ออกจากระบบ</span>
                    </button>
                 </div>
               )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-0 bg-nexus-grid relative custom-scrollbar">
          {/* Ambient Light Effect */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-nexus-teal/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-nexus-blue/5 blur-[120px] rounded-full pointer-events-none translate-y-1/2" />
          
          <div className="relative z-20">
            {pageAllowed ? children : <NoAccess />}
          </div>
        </main>


        {/* Tactical Quick-Action FAB (Context-Aware) */}
        <TacticalQuickAction />
      </div>
    </div>
  );
}

/** หน้าที่ตำแหน่งของผู้ใช้ไม่มีสิทธิ์เปิด */
function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-32 px-4">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
        <Lock size={22} />
      </div>
      <p className="text-[15px] font-semibold text-white">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      <p className="text-[13px] text-white/50 max-w-sm leading-relaxed">ตำแหน่งของคุณยังไม่ได้รับสิทธิ์ใช้งานส่วนนี้ หากต้องใช้งาน กรุณาติดต่อผู้ดูแลสูงสุดเพื่อกำหนดตำแหน่งเพิ่ม</p>
      <Link href="/" className="text-[13px] text-nexus-teal hover:underline">กลับหน้าแรก</Link>
    </div>
  );
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  // ซ่อนหัวข้อกลุ่มเมื่อไม่มีเมนูที่ผู้ใช้เปิดได้
  if (!React.Children.toArray(children).some(Boolean)) return null;
  return (
    <div className="space-y-4">
      <p className="tactical-label !text-white/20 px-4">{title}</p>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function SideLink({ href, icon, label, active, title }: { href: string; icon: any; label: string; active?: boolean; title?: string }) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const handleMouseEnter = () => {
    if (linkRef.current) {
      setRect(linkRef.current.getBoundingClientRect());
    }
    setIsHovered(true);
  };

  return (
    <>
      <Link 
        ref={linkRef}
        href={href}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group relative",
          active 
            ? "bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20" 
            : "text-white/40 hover:text-white hover:bg-white/15"
        )}
      >
        <div className={cn(
          "transition-all duration-300 flex-shrink-0",
          active ? "text-nexus-teal drop-shadow-neon" : "group-hover:text-white"
        )}>
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
        <span className={cn(
          "text-[14px] leading-none font-bold transition-all duration-300",
          active ? "text-white" : "text-white/40 group-hover:text-white/60"
        )}>{label}</span>
        
        {active && (
          <div className="absolute left-0 w-1 h-5 bg-nexus-teal rounded-r-full shadow-neon-teal" />
        )}
      </Link>

      {title && isHovered && rect && typeof window !== "undefined" && createPortal(
        <div 
          className="fixed px-3 py-1.5 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.15)] pointer-events-none z-[9999] whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 hidden lg:block"
          style={{
            top: rect.top + (rect.height / 2),
            left: rect.right + 12,
            transform: 'translateY(-50%)'
          }}
        >
          <p className="text-[10px] font-mono text-cyan-100 uppercase tracking-widest leading-none drop-shadow-neon">{title}</p>
        </div>,
        document.body
      )}
    </>
  );
}
