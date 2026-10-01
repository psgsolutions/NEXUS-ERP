"use client";

import React, { useState } from "react";
import {
  ArrowLeft, 
  ScanBarcode, 
  ChevronLeft, 
  Edit3, 
  Box, 
  History, 
  MapPin, 
  Truck, 
  ShieldCheck, 
  Activity,
  ArrowUpRight,
  Database,
  Calendar,
  AlertCircle
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
  MasterMetricCard,
  PillBackButton,
  NexusDataField
} from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useParams, useRouter } from "next/navigation";

export default function SerialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("history");

  const tabs = [
    { id: "history", label: "ประวัติ (LOGS)", icon: <History size={14} /> },
    { id: "warranty", label: "รับประกัน (WARRANTY)", icon: <ShieldCheck size={14} /> },
    { id: "technical", label: "เทคนิค (INFO)", icon: <Database size={14} /> },
  ];

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">Aruba AP-505 (SN-000123)</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {params.id || 'SN-000123'}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ประวัติการใช้งาน ข้อมูลการรับประกัน และสเปกทางเทคนิคของหมายเลขซีเรียล
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold">แจ้งเคลมพัสดุ</PillButton>
        <PillButton variant="confirm" className="h-8 px-4 text-xs font-bold flex items-center gap-1.5">
          <Edit3 size={14} />
          จัดการสถานะ SN
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-10">
      <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "history" && (
        <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
          {/* Vitals Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MasterMetricCard icon={<MapPin size={24} />} label="ตำแหน่งปัจจุบัน" value="SITE-A (Hospital)" color="text-nexus-teal" neon="shadow-neon-teal" />
            <MasterMetricCard icon={<Calendar size={24} />} label="วันที่ติดตั้ง" value="12 เม.ย. 2026" color="text-nexus-blue" />
            <MasterMetricCard icon={<ShieldCheck size={24} />} label="สถานะประกัน" value="ปกติ" color="text-white" />
          </div>

          {/* Movement History */}
          <div className="space-y-6">
             <h3 className="text-sm font-semibold text-white uppercase tracking-tight px-4">Timeline การเคลื่อนย้ายพัสดุ</h3>
             <div className="space-y-4">
                <HistoryItem 
                  date="26/04/2026" 
                  action="ติดตั้งที่หน้างาน (INSTALLED)" 
                  location="SITE-A: อาคาร 1 ชั้น 2" 
                  user="Somchai R. (Engineer)"
                  status="success"
                />
                <HistoryItem 
                  date="24/04/2026" 
                  action="เบิกจ่ายจากคลัง (ISSUED)" 
                  location="คลังพัสดุหลัก (WH-01)" 
                  user="Kriangkrai M. (Warehouse)"
                  status="success"
                />
                <HistoryItem 
                  date="20/04/2026" 
                  action="รับเข้าคลัง (RECEIVED)" 
                  location="คลังพัสดุหลัก (WH-01)" 
                  user="System (Auto-PO)"
                  status="success"
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );

  const rightSidebar = (
    <div className="space-y-6">
       <GlassCard className="p-8 border-white/10 bg-nexus-teal/5">
          <h4 className="text-[11px] font-semibold text-nexus-teal uppercase tracking-widest mb-6">ข้อมูลการรับประกัน (WARRANTY)</h4>
          <div className="space-y-6">
             <NexusDataField label="เริ่มการรับประกัน" value="20/04/2026" />
             <NexusDataField label="สิ้นสุดการรับประกัน" value="20/04/2029" highlight />
             <NexusDataField label="ผู้รับประกัน (Vendor)" value="Aruba Global" />
             <div className="pt-4 border-t border-white/5">
                <PillButton variant="glass" className="w-full text-[10px] uppercase">ตรวจสอบสถานะออนไลน์</PillButton>
             </div>
          </div>
       </GlassCard>

       <GlassCard className="p-8 border-white/10">
          <h4 className="text-[11px] font-semibold text-white/20 uppercase tracking-widest mb-6">โครงการที่เกี่ยวข้อง</h4>
          <div className="space-y-4">
             <LinkedProject label="โครงการหลัก" id="PRJ-26-001" />
             <LinkedProject label="งานแจ้งซ่อม (MA)" id="None" />
          </div>
       </GlassCard>
    </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}

import { User } from "lucide-react";

function HistoryItem({ date, action, location, user, status }: { date: string, action: string, location: string, user: string, status: "success" | "warning" }) {
  return (
    <div className="flex gap-6 p-6 rounded-xl bg-white/[0.02] border border-white/5 relative group hover:bg-white/[0.04] transition-all">
       <div className="shrink-0 flex flex-col items-center">
          <div className={cn(
             "w-10 h-10 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110",
             status === "success" ? "bg-transparent text-nexus-teal border-nexus-teal/20 shadow-neon-teal" : "bg-transparent text-warning border-warning/20"
          )}>
             <Activity size={18} />
          </div>
          <div className="w-px h-full bg-white/15 mt-4" />
       </div>
       <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-mono text-white/20 uppercase font-black">{date}</span>
             <h4 className="text-sm font-black text-white">{action}</h4>
          </div>
          <div className="flex flex-wrap gap-4">
             <div className="flex items-center gap-2 text-[10px] font-semibold text-white/40 uppercase">
                <MapPin size={12} className="text-nexus-blue" />
                {location}
             </div>
             <div className="flex items-center gap-2 text-[10px] font-semibold text-white/40 uppercase">
                <User size={12} className="text-nexus-teal" />
                {user}
             </div>
          </div>
       </div>
    </div>
  );
}

function LinkedProject({ label, id }: { label: string, id: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer">
       <div>
          <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-bold text-white group-hover:text-nexus-blue transition-colors">{id}</p>
       </div>
       <ArrowUpRight size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
    </div>
  );
}
