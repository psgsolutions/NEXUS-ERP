"use client";

import React, { useState } from "react";
import { 
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
} from "lucide-react";
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
import { useParams, useRouter } from "next/navigation";

export default function SerialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("history");

  const tabs = [
    { id: "history", label: "ประวัติ", icon: <History size={14} /> },
    { id: "warranty", label: "รับประกัน", icon: <ShieldCheck size={14} /> },
    { id: "technical", label: "เทคนิค", icon: <Database size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status="active" label="ON SITE / ACTIVE" />
               <p className="text-[11px] font-medium text-white/20 uppercase tracking-widest">Serial Number: {params.id || 'SN-ARUBA-000123'}</p>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight uppercase">Aruba AP-505 (SN-000123)</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <PillButton variant="glass" className="px-6">แจ้งเคลมพัสดุ</PillButton>
          <PillButton className="px-8 shadow-neon-teal">
            <Edit3 size={18} />
            จัดการสถานะ SN
          </PillButton>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-4">
        
        {/* Left Content Area */}
        <div className="flex-1 w-full space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "history" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Vitals Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MasterMetricCard icon={<MapPin size={24} />} label="ตำแหน่งปัจจุบัน" value="SITE-A (Hospital)" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Calendar size={24} />} label="วันที่ติดตั้ง" value="12 เม.ย. 2026" color="text-nexus-blue" />
                <MasterMetricCard icon={<ShieldCheck size={24} />} label="สถานะประกัน" value="ปกติ" color="text-white" />
              </div>

              {/* Movement History */}
              <div className="space-y-3">
                 <h3 className="text-sm font-bold text-white uppercase tracking-tight px-4">Timeline การเคลื่อนย้ายพัสดุ</h3>
                 <div className="space-y-3">
                    <HistoryItem 
                      date="26/04/2026" 
                      action="ติดตั้งที่หน้างาน" 
                      location="SITE-A: อาคาร 1 ชั้น 2" 
                      user="Somchai R. (Engineer)"
                      status="success"
                    />
                    <HistoryItem 
                      date="24/04/2026" 
                      action="เบิกจ่ายจากคลัง" 
                      location="คลังพัสดุหลัก (WH-01)" 
                      user="Kriangkrai M. (Warehouse)"
                      status="success"
                    />
                    <HistoryItem 
                      date="20/04/2026" 
                      action="รับเข้าคลัง" 
                      location="คลังพัสดุหลัก (WH-01)" 
                      user="System (Auto-PO)"
                      status="success"
                    />
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Warranty & Tech */}
        <div className="space-y-3">
           <GlassCard className="p-4 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[12px] font-medium text-nexus-teal uppercase tracking-widest mb-6">ข้อมูลการรับประกัน</h4>
              <div className="space-y-3">
                 <NexusDataField label="เริ่มการรับประกัน" value="20/04/2026" />
                 <NexusDataField label="สิ้นสุดการรับประกัน" value="20/04/2029" highlight />
                 <NexusDataField label="ผู้รับประกัน" value="Aruba Global" />
                 <div className="pt-4 border-t border-white/5">
                    <PillButton variant="glass" className="w-full text-[10px] uppercase">ตรวจสอบสถานะออนไลน์</PillButton>
                 </div>
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6">โครงการที่เกี่ยวข้อง</h4>
              <div className="space-y-3">
                 <LinkedProject label="โครงการหลัก" id="PRJ-26-001" />
                 <LinkedProject label="งานแจ้งซ่อม" id="None" />
              </div>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

import { User } from "lucide-react";

function HistoryItem({ date, action, location, user, status }: { date: string, action: string, location: string, user: string, status: "success" | "warning" }) {
  return (
    <div className="flex gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 relative group hover:bg-white/[0.04] transition-all">
       <div className="shrink-0 flex flex-col items-center">
          <div className={cn(
             "w-10 h-10 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110",
             status === "success" ? "bg-nexus-teal/10 text-nexus-teal border-nexus-teal/20 shadow-neon-teal" : "bg-warning/10 text-warning border-warning/20"
          )}>
             <Activity size={18} />
          </div>
          <div className="w-px h-full bg-white/5 mt-4" />
       </div>
       <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="text-[11px] font-mono text-white/20 uppercase font-medium">{date}</span>
             <h4 className="text-sm font-bold text-white">{action}</h4>
          </div>
          <div className="flex flex-wrap gap-4">
             <div className="flex items-center gap-2 text-[11px] font-medium text-white/40 uppercase">
                <MapPin size={12} className="text-nexus-blue" />
                {location}
             </div>
             <div className="flex items-center gap-2 text-[11px] font-medium text-white/40 uppercase">
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
          <p className="text-[10px] font-normal text-white/20 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-bold text-white group-hover:text-nexus-blue transition-colors">{id}</p>
       </div>
       <ArrowUpRight size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
    </div>
  );
}
