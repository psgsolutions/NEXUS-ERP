"use client";

import React, { useState } from "react";
import { 
  FileText, 
  ChevronLeft, 
  Edit3, 
  Printer, 
  Share2, 
  CheckCircle2, 
  Clock, 
  Activity,
  DollarSign,
  ShieldCheck,
  Briefcase,
  Building2,
  Lock
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

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("ledger");

  const tabs = [
    { id: "ledger", label: "สมุดรายวัน (LEDGER)", icon: <FileText size={14} /> },
    { id: "attachments", label: "ไฟล์แนบ (FILES)", icon: <Activity size={14} /> },
    { id: "audit", label: "ประวัติแก้ไข (AUDIT)", icon: <Clock size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status="active" label="บันทึกบัญชีแล้ว / ล็อกรายการ" />
               <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Journal ID: {params.id || 'FIN-JV-26001'}</p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">บันทึกรับชำระค่าสินค้า (COLLECTION VOUCHER)</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <PillButton variant="glass" className="px-6">พิมพ์ใบสำคัญ</PillButton>
          <div className="w-px h-10 bg-white/5 mx-2" />
          <PillButton variant="glass" className="px-4 text-white/40 border-white/5 cursor-not-allowed">
            <Lock size={18} />
            รายการถูกล็อก
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Content Area */}
        <div className="lg:col-span-3 space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "ledger" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Vitals Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MasterMetricCard icon={<DollarSign size={24} />} label="จำนวนเงินเดบิต (DR)" value="฿450,000.00" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<DollarSign size={24} />} label="จำนวนเงินเครดิต (CR)" value="฿450,000.00" color="text-nexus-teal" neon="shadow-neon-teal" />
              </div>

              {/* Journal Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-8 border-white/10 space-y-6">
                   <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2">
                      <FileText size={16} />
                      ข้อมูลทั่วไปของรายการ
                   </h3>
                   <div className="space-y-4">
                      <NexusDataField label="วันที่ทำรายการ" value="26 เมษายน 2569" />
                      <NexusDataField label="สมุดรายวัน" value="สมุดรายวันรับ (RECEIPT JOURNAL)" />
                      <NexusDataField label="อ้างอิงเอกสาร" value="IV-2604-0042" highlight />
                      <NexusDataField label="หมายเหตุ" value="รับชำระเงินโอนผ่านธนาคารกสิกรไทย" />
                   </div>
                </GlassCard>

                <GlassCard className="p-8 border-white/10 space-y-6">
                   <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={16} />
                      การผูกบัญชี & มิติข้อมูล
                   </h3>
                   <div className="space-y-4">
                      <NexusDataField label="โครงการ" value="PRJ-26-001 (LED Wall)" />
                      <NexusDataField label="แผนก" value="SALES & MARKETING" />
                      <NexusDataField label="บริษัทลูก" value="PSG SOLUTION HQ" />
                      <NexusDataField label="ผู้ทำรายการ" value="Accountant-01" />
                   </div>
                </GlassCard>
              </div>

              {/* Double-Entry Table */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">รายการแยกประเภท (DOUBLE-ENTRY LEDGER)</h3>
                    <div className="flex items-center gap-2 text-[10px] font-black text-nexus-teal uppercase tracking-widest">
                       <CheckCircle2 size={12} />
                       ตรวจสอบแล้ว (Balanced)
                    </div>
                 </div>
                 <NexusTable headers={["รหัสบัญชี", "ชื่อบัญชี (ACCOUNT NAME)", "รายละเอียด", "เดบิต (DR)", "เครดิต (CR)"]}>
                    <NexusTableRow>
                       <NexusTableCell className="font-mono text-nexus-blue">1101-01</NexusTableCell>
                       <NexusTableCell className="text-sm font-black text-white">เงินสดในมือ (CASH ON HAND)</NexusTableCell>
                       <NexusTableCell className="text-[10px] text-white/40 uppercase font-black tracking-tight">รับชำระจากลูกค้า</NexusTableCell>
                       <NexusTableCell className="text-right font-black text-white">450,000.00</NexusTableCell>
                       <NexusTableCell className="text-right font-black text-white/20">-</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                       <NexusTableCell className="font-mono text-nexus-blue">1102-05</NexusTableCell>
                       <NexusTableCell className="text-sm font-black text-white">ลูกหนี้การค้า (A/R TRADE)</NexusTableCell>
                       <NexusTableCell className="text-[10px] text-white/40 uppercase font-black tracking-tight">หักยอดลูกหนี้</NexusTableCell>
                       <NexusTableCell className="text-right font-black text-white/20">-</NexusTableCell>
                       <NexusTableCell className="text-right font-black text-white">450,000.00</NexusTableCell>
                    </NexusTableRow>
                 </NexusTable>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tactical Info */}
        <div className="space-y-6">
           <GlassCard className="p-8 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-6">ผู้มีอำนาจลงนาม (SIGNATORIES)</h4>
              <div className="space-y-6">
                 <SignatoryStep label="ผู้จัดทำ" user="Accountant-01" status="done" />
                 <SignatoryStep label="ผู้ตรวจสอบ" user="Finance Manager" status="done" />
                 <SignatoryStep label="ผู้อนุมัติ" user="Managing Director" status="done" />
              </div>
           </GlassCard>

           <GlassCard className="p-8 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6">เอกสารการเงินที่เกี่ยวข้อง</h4>
              <div className="space-y-4">
                 <LinkedDoc label="TAX INVOICE / RECEIPT" id="TIV-2604-001" />
                 <LinkedDoc label="BANK TRANSFER SLIP" id="BKK-REF-0992" />
              </div>
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

function SignatoryStep({ label, user, status }: { label: string, user: string, status: "done" | "pending" }) {
  return (
    <div className="flex items-center gap-4 group">
       <div className={cn(
         "w-8 h-8 rounded-full flex items-center justify-center transition-all border",
         status === "done" ? "bg-nexus-teal/10 text-nexus-teal border-nexus-teal/30 shadow-neon-teal" : "bg-white/5 text-white/10 border-white/10"
       )}>
          {status === "done" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
       </div>
       <div>
          <p className="text-xs font-black text-white">{label}</p>
          <p className="text-[10px] font-black text-white/20 uppercase">{user}</p>
       </div>
    </div>
  );
}

function LinkedDoc({ label, id }: { label: string, id: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-full bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer">
       <div>
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-bold text-white group-hover:text-nexus-blue transition-colors">{id}</p>
       </div>
       <Share2 size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
    </div>
  );
}

