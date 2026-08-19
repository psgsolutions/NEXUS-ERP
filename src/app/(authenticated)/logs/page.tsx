"use client";

import React, { useState } from "react";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  User, 
  Clock, 
  Database,
  ShieldAlert,
  Activity,
  History,
  ShieldCheck,
  Cpu,
  Lock,
  ArrowRight
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  PillTabs,
  GlassCard,
  NexusSearchInput
} from "@/components/ui/Base";
import Link from "next/link";

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  return (
    <div className="p-10 space-y-10 max-w-[1800px] mx-auto">
      
      {/* Header Section */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-white/20 uppercase tracking-[0.2em]">การตรวจสอบประวัติและการปฏิบัติตามข้อกำหนด</p>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <History size={22} />
             </div>
             <h1 className="text-2xl font-bold text-white tracking-tight uppercase leading-none">ศูนย์ตรวจสอบความปลอดภัยและกิจกรรม</h1>
          </div>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-white/5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-nexus-teal shadow-neon-teal animate-pulse" />
              <span className="text-[11px] font-medium text-white/60 uppercase tracking-widest">ความปลอดภัยของระบบ: ปลอดภัยสูงสุด</span>
           </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-10">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Cpu className="text-nexus-teal" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-white/20 uppercase tracking-widest">การตรวจสอบย้อนกลับระดับควอนตัม (WEB3 AUDIT TRAIL)</p>
                    <h2 className="text-xl font-bold text-white uppercase">Decentralized Log Chain</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                 <div className="flex items-center gap-2 px-4 h-10 rounded-full bg-nexus-teal/5 border border-nexus-teal/20 text-[11px] font-medium text-nexus-teal uppercase tracking-widest">
                    <Lock size={14} /> Immutable Node: ON
                 </div>
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="พิมพ์เพื่อค้นหา..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1"
                 kbd="F"
               />
               <div className="flex items-center gap-2 pr-1.5">
                  <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            <GlassCard className="p-0 overflow-hidden border-white/5 min-h-[640px] flex flex-col justify-between bg-black/40">
              <div className="overflow-x-auto custom-scrollbar flex-1 w-full p-2">
                <NexusTable headers={["วันเวลา", "ผู้ดำเนินการ", "รายละเอียดกิจกรรม", "รหัสตรวจสอบ", "สถานะความถูกต้อง"]}>
                  <LogRow 
                    id="LOG-001" 
                    time="10:45:22" 
                    user="admin@nexus.os" 
                    module="INVENTORY" 
                    action="UPDATE_STOCK" 
                    hash="0x72a...f41e"
                    status="active" 
                  />
                  <LogRow 
                    id="LOG-042" 
                    time="09:12:05" 
                    user="engineer-01@nexus.os" 
                    module="PROJECTS" 
                    action="CREATE_REPORT" 
                    hash="0xb41...c2d9"
                    status="active" 
                  />
                  <LogRow 
                    id="LOG-088" 
                    time="Yesterday" 
                    user="superadmin@nexus.os" 
                    module="SECURITY" 
                    action="CHANGE_ROLE" 
                    hash="0xfe1...a003"
                    status="active" 
                  />
                </NexusTable>
              </div>
              <div className="p-4 border-t border-white/5 bg-black/10 flex items-center justify-between text-xs text-white/30 font-bold">
                <span>สตรีมข้อมูลคลาวด์สด • NEXUS Real-time Engine</span>
                <span>PSG Master UI Standard V3.1</span>
              </div>
            </GlassCard>
          </div>

          {/* Metric Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <MasterMetricCard icon={<Activity size={24} />} label="Blockchain Events" value="1,242" color="text-nexus-teal" neon="shadow-neon-teal" />
            <MasterMetricCard icon={<ShieldAlert size={24} />} label="Audit Failures" value="0" color="text-danger" />
            <MasterMetricCard icon={<Lock size={24} />} label="Hashed Blocks" value="4.2k" color="text-white" />
            <MasterMetricCard icon={<Database size={24} />} label="Network Nodes" value="12 Nodes" color="text-nexus-blue" />
          </div>
        </div>

        {/* Right Sidebar Status */}
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
           <GlassCard className="p-4 border-white/10 bg-nexus-teal/5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-nexus-teal opacity-5 rotate-12">
                 <Cpu size={120} />
              </div>
              <h4 className="text-[12px] font-medium text-nexus-teal uppercase tracking-widest mb-6">Quantum Integrity</h4>
              <div className="space-y-3">
                 <SecurityItem label="Chain Synchronicity" count={100} status="healthy" />
                 <SecurityItem label="Node Latency" count={12} status="healthy" />
                 <SecurityItem label="Encryption Load" count={65} status="warning" />
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6">ความปลอดภัยระดับเซิร์ฟเวอร์</h4>
              <div className="space-y-3">
                 <CriticalActionItem label="Hash Verified" user="Node-01" detail="Signature Matches" />
                 <CriticalActionItem label="Node Peer Sync" user="System" detail="12/12 Peers Connected" />
              </div>
           </GlassCard>
        </div>
      </div>

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}

function LogRow({ id, time, user, module, action, hash, status }: { id: string, time: string, user: string, module: string, action: string, hash: string, status: "active" | "danger" }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[120px]">
        <Link href={`/logs/${id}`} className="block">
           <p className="font-mono text-[12px] text-nexus-blue font-medium tracking-tighter">{time}</p>
        </Link>
      </NexusTableCell>
      <NexusTableCell className="text-sm font-bold text-white/80 group-hover:text-white transition-colors w-[180px]">{user}</NexusTableCell>
      <NexusTableCell>
         <p className="text-[12px] font-medium text-white/80 uppercase tracking-widest">{action}</p>
         <p className="text-xs font-bold text-white/30 uppercase">{module}</p>
      </NexusTableCell>
      <NexusTableCell>
         <div className="flex items-center gap-3">
            <div className="w-1.5 h-4 bg-nexus-teal/20 rounded-full" />
            <p className="font-mono text-[12px] text-nexus-teal font-medium tracking-widest drop-shadow-neon-teal">{hash}</p>
         </div>
      </NexusTableCell>
      <NexusTableCell className="w-[150px]">
        <div className="flex items-center gap-2 text-[11px] font-medium text-nexus-teal uppercase tracking-widest">
           <ShieldCheck size={14} /> VERIFIED
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function SecurityItem({ label, count, status }: { label: string, count: number, status: "healthy" | "warning" }) {
  return (
    <div className="flex items-center justify-between group">
       <div>
          <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">{label}</p>
          <p className="text-xl font-bold text-white">{count}</p>
       </div>
       <div className={cn(
         "w-1.5 h-8 rounded-full transition-all",
         status === "healthy" ? "bg-nexus-teal shadow-neon-teal" : "bg-warning shadow-neon-warning"
       )} />
    </div>
  );
}

function CriticalActionItem({ label, user, detail }: { label: string, user: string, detail: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all">
       <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center group-hover:shadow-neon-danger transition-all">
          <ShieldAlert size={16} />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{label}</p>
          <p className="text-[12px] text-white/30 uppercase font-medium tracking-[0.1em] mt-0.5">{user} • {detail}</p>
       </div>
    </div>
  );
}
