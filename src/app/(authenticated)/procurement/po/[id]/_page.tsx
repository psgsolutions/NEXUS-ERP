"use client";

import React, { useState } from "react";
import { 
  FileCheck, 
  ChevronLeft, 
  Edit3, 
  Truck, 
  Printer, 
  Mail, 
  AlertCircle, 
  CheckCircle2,
  DollarSign,
  Package,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Building2
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

export default function PODetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "ข้อมูล", icon: <FileCheck size={14} /> },
    { id: "items", label: "สินค้า", icon: <Package size={14} /> },
    { id: "delivery", label: "จัดส่ง", icon: <Truck size={14} /> },
    { id: "logs", label: "ประวัติ", icon: <Clock size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status="pending" label="รอการอนุมัติ" />
               <p className="text-[11px] font-medium text-white/20 uppercase tracking-widest">PO ID: {params.id || 'PO-2604-0012'}</p>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight uppercase">ใบสั่งซื้ออุปกรณ์โครงข่าย</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <PillButton  className="px-6">พิมพ์เอกสาร</PillButton>
          <PillButton  className="px-8">
            <ShieldCheck size={18} />
            อนุมัติใบสั่งซื้อ
          </PillButton>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-start gap-4">
        
        {/* Left Content Area */}
        <div className="flex-1 w-full space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "overview" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MasterMetricCard icon={<DollarSign size={24} />} label="ยอดเงินรวม" value="฿125,000" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Clock size={24} />} label="กำหนดส่งสินค้า" value="12 พ.ค. 2026" color="text-nexus-blue" />
                <MasterMetricCard icon={<AlertCircle size={24} />} label="สถานะการชำระ" value="ยังไม่ชำระ" color="text-warning" />
              </div>

              {/* Vendor & Entity Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <GlassCard className="p-4 border-white/10 space-y-3">
                   <h3 className="text-[13px] font-medium text-nexus-teal uppercase tracking-widest flex items-center gap-2">
                      <Building2 size={16} />
                      ข้อมูลคู่ค้า
                   </h3>
                   <div className="space-y-3">
                      <NexusDataField label="บริษัท" value="Aruba Global (Thailand) Co., Ltd." />
                      <NexusDataField label="เลขผู้เสียภาษี" value="0105564000123" />
                      <NexusDataField label="เครดิตเทอม" value="30 วัน" highlight />
                      <NexusDataField label="ผู้ติดต่อ" value="คุณกฤษดา (081-999-0000)" />
                   </div>
                </GlassCard>

                <GlassCard className="p-4 border-white/10 space-y-3">
                   <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <Truck size={16} />
                      ที่อยู่จัดส่ง & คลังรับพัสดุ
                   </h3>
                   <div className="space-y-3">
                      <NexusDataField label="คลังปลายทาง" value="คลังพัสดุหลัก (WH-BKK-01)" />
                      <NexusDataField label="วิธีจัดส่ง" value="ขนส่งเอกชน" />
                      <NexusDataField label="ผู้รับสินค้า" value="สมชาย (คลังพัสดุ)" />
                      <NexusDataField label="ความสำคัญ" value="เร่งด่วนพิเศษ" highlight />
                   </div>
                </GlassCard>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                 <h3 className="text-sm font-bold text-white uppercase tracking-tight">รายการสินค้าและบริการ</h3>
                 <NexusTable headers={["#", "รายการ", "จำนวน", "ราคาต่อหน่วย", "ส่วนลด", "รวมเงิน"]}>
                    <NexusTableRow>
                       <NexusTableCell>1</NexusTableCell>
                       <NexusTableCell>
                          <p className="text-sm font-bold text-white">Aruba AP-505 Unified Access Point</p>
                          <p className="text-[11px] text-white/20 uppercase font-medium">SKU: AP-505-RW</p>
                       </NexusTableCell>
                       <NexusTableCell className="text-center font-bold">10 Units</NexusTableCell>
                       <NexusTableCell className="text-right font-bold">฿12,500</NexusTableCell>
                       <NexusTableCell className="text-right">0%</NexusTableCell>
                       <NexusTableCell className="text-right font-bold text-nexus-teal">฿125,000</NexusTableCell>
                    </NexusTableRow>
                 </NexusTable>

                 {/* Totals Summary */}
                 <div className="flex justify-end">
                    <div className="w-80 space-y-3 p-5 rounded-3xl bg-white/[0.02] border border-white/5">
                       <div className="flex justify-between items-center text-[11px] font-medium text-white/20 uppercase">
                          <span>มูลค่าสินค้า</span>
                          <span>฿116,822.43</span>
                       </div>
                       <div className="flex justify-between items-center text-[11px] font-medium text-white/20 uppercase">
                          <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                          <span>฿8,177.57</span>
                       </div>
                       <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[13px] font-medium text-nexus-teal uppercase">ยอดเงินสุทธิ</span>
                          <span className="text-xl font-bold text-nexus-teal drop-shadow-neon">฿125,000.00</span>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tactical Info */}
        <div className="space-y-3">
           <GlassCard className="p-4 border-white/10 bg-warning/5">
              <h4 className="text-[12px] font-medium text-warning uppercase tracking-widest mb-6">ลำดับการอนุมัติ</h4>
              <div className="space-y-3">
                 <ApprovalStep label="ผู้จัดการโครงการ" user="Wichai S." status="done" />
                 <ApprovalStep label="ผู้จัดการฝ่ายจัดซื้อ" user="Areeya P." status="done" />
                 <ApprovalStep label="ผู้ดูแลระบบสูงสุด" user="Admin" status="pending" />
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6">เอกสารอ้างอิง</h4>
              <div className="space-y-3">
                 <DocItem label="ใบเสนอราคา" />
                 <DocItem label="ใบขอซื้อ" />
              </div>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ApprovalStep({ label, user, status }: { label: string, user: string, status: "done" | "pending" | "rejected" }) {
  return (
    <div className="flex items-center gap-4 group">
       <div className={cn(
         "w-8 h-8 rounded-full flex items-center justify-center transition-all border",
         status === "done" ? "bg-transparent text-nexus-teal border-nexus-teal/30 shadow-neon-teal" : "bg-white/15 text-white/10 border-white/10"
       )}>
          {status === "done" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
       </div>
       <div>
          <p className="text-[13px] font-medium text-white">{label}</p>
          <p className="text-[11px] font-medium text-white/20 uppercase">{user}</p>
       </div>
    </div>
  );
}

function DocItem({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer">
       <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">{label}</span>
       <ArrowUpRight size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
    </div>
  );
}

