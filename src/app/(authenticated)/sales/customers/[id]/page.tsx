"use client";

import React, { useState } from "react";
import { 
  Users, 
  ChevronLeft, 
  Edit3, 
  MapPin, 
  Phone, 
  Mail, 
  Briefcase, 
  CreditCard, 
  History, 
  ArrowUpRight,
  TrendingUp,
  Target,
  FileText
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
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "ภาพรวมคู่ค้า", icon: <Briefcase size={14} /> },
    { id: "history", label: "ประวัติการสั่งซื้อ", icon: <History size={14} /> },
    { id: "sites", label: "ที่ตั้งและไซต์งาน", icon: <MapPin size={14} /> },
    { id: "documents", label: "เอกสารนิติบุคคล", icon: <FileText size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status="active" label="คู่ค้าระดับพรีเมียม (TIER A)" />
               <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Customer ID: {params.id || 'CUS-260003'}</p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">โรงพยาบาลตากสิน (TAK SIN HOSPITAL)</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <PillButton variant="glass" className="px-6">ระงับบัญชี</PillButton>
          <PillButton className="px-8 shadow-neon-teal">
            <Edit3 size={18} />
            แก้ไขข้อมูล
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Content Area */}
        <div className="lg:col-span-3 space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "overview" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Metric Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MasterMetricCard icon={<TrendingUp size={24} />} label="ยอดซื้อสะสม (LTV)" value="฿12.4M" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Target size={24} />} label="โปรเจกต์ที่ทำร่วมกัน" value="14 งาน" color="text-nexus-blue" />
                <MasterMetricCard icon={<CreditCard size={24} />} label="เครดิตคงเหลือ" value="฿2.5M" color="text-white" />
              </div>

              {/* Data Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-8 border-white/10 space-y-6">
                   <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2">
                      <Briefcase size={16} />
                      ข้อมูลนิติบุคคล
                   </h3>
                   <div className="space-y-4">
                      <NexusDataField label="เลขประจำตัวผู้เสียภาษี" value="0105564000000" />
                      <NexusDataField label="ประเภทธุรกิจ" value="สาธารณสุข / หน่วยงานรัฐ (Health Care)" />
                      <NexusDataField label="จดทะเบียนเมื่อ" value="12 มกราคม 2560" />
                      <NexusDataField label="สำนักงานใหญ่" value="เขตคลองสาน กรุงเทพมหานคร" />
                   </div>
                </GlassCard>

                <GlassCard className="p-8 border-white/10 space-y-6">
                   <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <CreditCard size={16} />
                      นโยบายการเงิน
                   </h3>
                   <div className="space-y-4">
                      <NexusDataField label="Credit Term" value="60 วัน" highlight />
                      <NexusDataField label="วงเงินสูงสุด" value="฿5,000,000" />
                      <NexusDataField label="รอบวางบิล" value="ทุกวันที่ 25 ของเดือน" />
                      <NexusDataField label="ธนาคารที่ใช้" value="กสิกรไทย (000-0-00000-0)" />
                   </div>
                </GlassCard>
              </div>

              {/* Recent Activity Table */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">ธุรกรรมล่าสุด</h3>
                    <Link href="/sales/quotations" className="text-[10px] font-black text-nexus-teal uppercase hover:underline">ดูทั้งหมด</Link>
                 </div>
                 <NexusTable headers={["วันที่", "รหัสเอกสาร", "รายการ", "จำนวนเงิน", "สถานะ"]}>
                    <NexusTableRow>
                       <NexusTableCell>26/04/2026</NexusTableCell>
                       <NexusTableCell className="font-mono text-nexus-blue">QT-2604-001</NexusTableCell>
                       <NexusTableCell>MA Service - Network Core</NexusTableCell>
                       <NexusTableCell className="text-right font-black">฿45,000</NexusTableCell>
                       <NexusTableCell><StatusBadge status="active" label="อนุมัติแล้ว" /></NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                       <NexusTableCell>20/04/2026</NexusTableCell>
                       <NexusTableCell className="font-mono text-nexus-blue">INV-2604-042</NexusTableCell>
                       <NexusTableCell>LED Wall Replacement Part</NexusTableCell>
                       <NexusTableCell className="text-right font-black">฿12,500</NexusTableCell>
                       <NexusTableCell><StatusBadge status="pending" label="ค้างชำระ" /></NexusTableCell>
                    </NexusTableRow>
                 </NexusTable>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tactical Info */}
        <div className="space-y-6">
           <GlassCard className="p-8 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-6">ผู้ติดต่อหลัก (Key Contact)</h4>
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                       <Users size={24} />
                    </div>
                    <div>
                       <p className="text-sm font-black text-white">คุณสมชาย ใจดี</p>
                       <p className="text-[10px] font-black text-white/20 uppercase">หัวหน้าฝ่าย IT</p>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/40 hover:text-white transition-colors cursor-pointer">
                       <Phone size={14} />
                       <span className="text-xs font-bold">081-234-5678</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/40 hover:text-white transition-colors cursor-pointer">
                       <Mail size={14} />
                       <span className="text-xs font-bold">somchai@taksin.hospital</span>
                    </div>
                 </div>
                 <PillButton variant="glass" className="w-full">แชทผ่านทีมขาย</PillButton>
              </div>
           </GlassCard>

           <GlassCard className="p-8 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6">ที่ตั้งไซต์งานสำคัญ</h4>
              <div className="space-y-4">
                 <SiteItem name="อาคารสนับสนุน 1" detail="ชั้น 4 ห้อง Server" />
                 <SiteItem name="อาคารผู้ป่วยนอก" detail="เคาน์เตอร์เวชระเบียน" />
              </div>
              <button className="w-full mt-6 text-[10px] font-black text-white/20 uppercase hover:text-nexus-teal flex items-center justify-center gap-2">
                 ดูแผนที่ทั้งหมด <ArrowUpRight size={12} />
              </button>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

function SiteItem({ name, detail }: { name: string, detail: string }) {
  return (
    <div className="flex items-center gap-4 group cursor-pointer">
       <div className="w-2 h-2 rounded-full bg-nexus-blue group-hover:shadow-neon-blue transition-all" />
       <div>
          <p className="text-xs font-black text-white group-hover:text-nexus-blue transition-colors">{name}</p>
          <p className="text-[10px] font-black text-white/20 uppercase">{detail}</p>
       </div>
    </div>
  );
}
