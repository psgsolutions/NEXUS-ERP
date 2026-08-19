"use client";

import React, { useState, useEffect } from "react";
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
  Lock,
  ArrowLeft
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

  // Strict Disable Global Main Scroll for this Page (Fixed Header Layout)
  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.style.overflowY = "hidden";
      return () => {
        mainEl.style.overflowY = "auto";
      };
    }
  }, []);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] overflow-hidden animate-in fade-in duration-500 bg-[#0D0D0D] relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.03)_0%,transparent_50%)] pointer-events-none" />
      
      {/* 1. Fixed Header Layout */}
      <div className="sticky top-0 z-50 bg-[#020203]/90 backdrop-blur-xl shrink-0 px-5 pt-5 pb-4 border-b border-white/5 space-y-4">
        <div className="max-w-[1800px] mx-auto w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PillButton variant="glass" onClick={() => router.back()} className="h-10 w-10 p-0 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white">
                <ArrowLeft size={18} />
              </PillButton>
              <div className="space-y-1">
                <div className="flex items-center gap-3 mb-1">
                   <StatusBadge status="active" label="บันทึกบัญชีแล้ว / ล็อกรายการ" />
                   <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Journal ID: {params.id || 'FIN-JV-26001'}</p>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight uppercase">บันทึกรับชำระค่าสินค้า (COLLECTION VOUCHER)</h1>
              </div>
            </div>
            <div className="flex gap-3">
              <PillButton variant="glass" className="h-10 px-6 rounded-full text-[12px] font-bold">พิมพ์ใบสำคัญ</PillButton>
              <div className="w-px h-10 bg-white/15 mx-1" />
              <PillButton variant="glass" className="h-10 px-4 text-white/40 border-white/5 cursor-not-allowed rounded-full text-[12px] font-bold">
                <Lock size={16} className="mr-2" />
                รายการถูกล็อก
              </PillButton>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0 max-w-[1800px] w-full mx-auto p-5 relative z-10">
        
        {/* Left Side: Main Form Content (80%) */}
        <div className="w-full xl:w-[80%] flex flex-col overflow-y-auto custom-scrollbar pr-2 pb-10">
          <div className="space-y-8">
            
            <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "ledger" && (
              <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                {/* Vitals Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MasterMetricCard icon={<DollarSign size={24} />} label="จำนวนเงินเดบิต (DR)" value="฿450,000.00" color="text-nexus-teal" neon="shadow-neon-teal" />
                  <MasterMetricCard icon={<DollarSign size={24} />} label="จำนวนเงินเครดิต (CR)" value="฿450,000.00" color="text-nexus-teal" neon="shadow-neon-teal" />
                </div>

                {/* Journal Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <GlassCard className="p-8 border-white/10 space-y-6 bg-black/20">
                     <h3 className="text-[12px] font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
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

                  <GlassCard className="p-8 border-white/10 space-y-6 bg-black/20">
                     <h3 className="text-[12px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
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
                <div className="space-y-4 pt-4">
                   <div className="flex items-center justify-between px-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">รายการแยกประเภท (DOUBLE-ENTRY LEDGER)</h3>
                      <div className="flex items-center gap-2 text-[10px] font-black text-nexus-teal uppercase tracking-widest">
                         <CheckCircle2 size={12} />
                         ตรวจสอบแล้ว (Balanced)
                      </div>
                   </div>
                   <div className="border border-white/10 rounded-3xl overflow-hidden bg-black/40">
                      <NexusTable headers={["รหัสบัญชี", "ชื่อบัญชี (ACCOUNT NAME)", "รายละเอียด", "เดบิต (DR)", "เครดิต (CR)"]}>
                        <NexusTableRow>
                           <NexusTableCell className="font-mono text-nexus-blue text-[13px]">1101-01</NexusTableCell>
                           <NexusTableCell className="text-[13px] font-black text-white">เงินสดในมือ (CASH ON HAND)</NexusTableCell>
                           <NexusTableCell className="text-[11px] text-white/40 uppercase font-bold tracking-tight">รับชำระจากลูกค้า</NexusTableCell>
                           <NexusTableCell className="text-right font-mono font-bold text-[13px] text-white">450,000.00</NexusTableCell>
                           <NexusTableCell className="text-right font-mono font-bold text-[13px] text-white/20">-</NexusTableCell>
                        </NexusTableRow>
                        <NexusTableRow>
                           <NexusTableCell className="font-mono text-nexus-blue text-[13px]">1102-05</NexusTableCell>
                           <NexusTableCell className="text-[13px] font-black text-white">ลูกหนี้การค้า (A/R TRADE)</NexusTableCell>
                           <NexusTableCell className="text-[11px] text-white/40 uppercase font-bold tracking-tight">หักยอดลูกหนี้</NexusTableCell>
                           <NexusTableCell className="text-right font-mono font-bold text-[13px] text-white/20">-</NexusTableCell>
                           <NexusTableCell className="text-right font-mono font-bold text-[13px] text-white">450,000.00</NexusTableCell>
                        </NexusTableRow>
                      </NexusTable>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Summary/Action Sidebar (20%) */}
        <div className="w-full xl:w-[20%] shrink-0 overflow-y-auto custom-scrollbar pb-10">
          <div className="space-y-6">
             <GlassCard className="p-6 border-white/5 bg-[#111111] shadow-2xl sticky top-0">
                <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-6 border-b border-white/5 pb-3">ผู้มีอำนาจลงนาม (SIGNATORIES)</h4>
                <div className="space-y-5">
                   <SignatoryStep label="ผู้จัดทำ" user="Accountant-01" status="done" />
                   <SignatoryStep label="ผู้ตรวจสอบ" user="Finance Manager" status="done" />
                   <SignatoryStep label="ผู้อนุมัติ" user="Managing Director" status="done" />
                </div>
             </GlassCard>

             <GlassCard className="p-6 border-white/5 bg-[#111111]">
                <h4 className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-4 border-b border-white/5 pb-3">เอกสารการเงินที่เกี่ยวข้อง</h4>
                <div className="space-y-3">
                   <LinkedDoc label="TAX INVOICE / RECEIPT" id="TIV-2604-001" />
                   <LinkedDoc label="BANK TRANSFER SLIP" id="BKK-REF-0992" />
                </div>
             </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatoryStep({ label, user, status }: { label: string, user: string, status: "done" | "pending" }) {
  return (
    <div className="flex items-center gap-4 group bg-white/[0.01] p-3 rounded-2xl border border-white/5">
       <div className={cn(
         "w-8 h-8 rounded-full flex items-center justify-center transition-all border shrink-0",
         status === "done" ? "bg-transparent text-nexus-teal border-nexus-teal/30 shadow-neon-teal" : "bg-white/10 text-white/20 border-white/5"
       )}>
          {status === "done" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
       </div>
       <div className="min-w-0">
          <p className="text-[11px] font-black text-white/80">{label}</p>
          <p className="text-[10px] font-bold text-white/40 uppercase truncate">{user}</p>
       </div>
    </div>
  );
}

function LinkedDoc({ label, id }: { label: string, id: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer">
       <div className="min-w-0 pr-2">
          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest truncate">{label}</p>
          <p className="text-[11px] font-bold text-white group-hover:text-nexus-blue transition-colors truncate">{id}</p>
       </div>
       <Share2 size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors shrink-0" />
    </div>
  );
}
