"use client";

import React, { useState } from "react";
import {
  ArrowLeft, 
  History, 
  ChevronLeft, 
  Terminal, 
  Activity, 
  User, 
  Globe, 
  Cpu, 
  ShieldCheck, 
  ArrowUpRight,
  Database,
  Lock,
  Clock,
  ExternalLink
} from 'lucide-react';
import { 
  PillButton, 
  GlassCard, 
  cn, 
  PillTabs, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge,
  MasterMetricCard
} from "@/components/ui/Base";
import { useParams, useRouter } from "next/navigation";

export default function LogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("payload");

  const tabs = [
    { id: "payload", label: "ข้อมูลรายละเอียด", icon: <Terminal size={14} /> },
    { id: "context", label: "บริบทของระบบ", icon: <Globe size={14} /> },
    { id: "chain", label: "ตรวจสอบ", icon: <Database size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-7xl mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
            <ArrowLeft size={20} />
          </PillButton>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
                บันทึกการปรับปรุงข้อมูลสต็อก
              </h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                {params.id || 'LOG-001'}
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">
              รายละเอียดบันทึกประวัติการเปลี่ยนแปลงข้อมูล บริบทระบบ และการตรวจสอบความถูกต้อง
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton variant="glass" className="h-8 px-4 text-xs font-bold" onClick={() => navigator.clipboard?.writeText(String(params.id || 'LOG-001'))}>
            คัดลอกรหัสบันทึก
          </PillButton>
          <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck size={14} />
            ตรวจสอบความถูกต้อง
          </PillButton>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-start gap-4">
        
        {/* Left Content Area */}
        <div className="flex-1 w-full space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "payload" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Event Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MasterMetricCard icon={<Clock size={24} />} label="เวลาประมวลผล" value="12ms" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<User size={24} />} label="ผู้ดำเนินการ" value="admin@nexus.os" color="text-white" />
                <MasterMetricCard icon={<Activity size={24} />} label="ระดับความสำคัญ" value="MEDIUM" color="text-warning" />
              </div>

              {/* Data Change Diff */}
              <GlassCard className="p-4 border-white/10 space-y-3">
                 <h3 className="text-[13px] font-medium text-nexus-teal uppercase tracking-widest flex items-center gap-2">
                    <Terminal size={16} />
                    การเปลี่ยนแปลงข้อมูล
                 </h3>
                 <div className="bg-black/40 rounded-2xl p-5 font-mono text-xs overflow-x-auto border border-white/5">
                    <pre className="text-white/60">
{`{
  "module": "INVENTORY",
  "action": "UPDATE_STOCK",
  "payload": {
    "sku": "AP-505-RW",
    "before": { "qty": 12, "reserved": 5 },
    "after": { "qty": 24, "reserved": 5 },
    "reference": "PO-2604-001"
  },
  "metadata": {
    "ip": "182.52.12.44",
    "user_agent": "Nexus_Core_v3.2"
  }
}`}
                    </pre>
                 </div>
              </GlassCard>
            </div>
          )}
        </div>

        {/* Right Sidebar - Security Info */}
        <div className="space-y-3">
           <GlassCard className="p-4 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[12px] font-medium text-nexus-teal uppercase tracking-widest mb-6">ความปลอดภัยทางเทคนิค</h4>
              <div className="space-y-3">
                 <TechnicalItem label="Database" value="Firestore (Multi-tenant)" />
                 <TechnicalItem label="Auth Layer" value="Firebase Identity" />
                 <TechnicalItem label="Engine" value="Quantum Sequence v3" />
                 <TechnicalItem label="Hashing" value="SHA-256 Verified" />
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6">ความเชื่อมโยงระดับระบบ</h4>
              <div className="space-y-3">
                 <LinkedLog label="Auth Session" id="AUTH-9921" />
                 <LinkedLog label="Transaction Ref" id="PO-2604-001" />
              </div>
              <button className="w-full mt-6 text-[11px] font-medium text-white/20 uppercase hover:text-nexus-teal flex items-center justify-center gap-2">
                 เปิดเอกสารอ้างอิง <ExternalLink size={12} />
              </button>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

function TechnicalItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
       <span className="text-[11px] font-medium text-white/20 uppercase tracking-widest">{label}</span>
       <span className="text-[12px] font-medium text-white/80">{value}</span>
    </div>
  );
}

function LinkedLog({ label, id }: { label: string, id: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer">
       <div>
          <p className="text-[10px] font-normal text-white/20 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-bold text-white group-hover:text-nexus-blue transition-colors">{id}</p>
       </div>
       <ArrowUpRight size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
    </div>
  );
}
