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
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] overflow-hidden animate-in fade-in duration-500 bg-surface-0 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.03)_0%,transparent_50%)] pointer-events-none" />
      
            <div className="max-w-[1800px] mx-auto w-full pt-4 px-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
              <ArrowLeft size={20} />
            </PillButton>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
                  บันทึกรับชำระค่าสินค้า
                </h1>
                <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                  {params.id || 'FIN-JV-26001'}
                </span>
              </div>
              <p className="text-sm text-white/60 font-medium mt-1">
                รายละเอียดสมุดรายวันทั่วไป ไฟล์แนบ และประวัติการบันทึกบัญชี
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold">พิมพ์ใบสำคัญ</PillButton>
            <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/40 border-white/5 cursor-not-allowed">
              <Lock size={14} className="mr-1.5" />
              รายการถูกล็อก
            </PillButton>
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
                     <h3 className="text-[12px] font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
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
                     <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
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
                      <h3 className="text-sm font-semibold text-white uppercase tracking-tight">รายการแยกประเภท (DOUBLE-ENTRY LEDGER)</h3>
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-nexus-teal uppercase tracking-widest">
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
             <GlassCard className="p-6 border-white/5 bg-surface-1 shadow-2xl sticky top-0">
                <h4 className="text-[11px] font-semibold text-nexus-teal uppercase tracking-widest mb-6 border-b border-white/5 pb-3">ผู้มีอำนาจลงนาม (SIGNATORIES)</h4>
                <div className="space-y-5">
                   <SignatoryStep label="ผู้จัดทำ" user="Accountant-01" status="done" />
                   <SignatoryStep label="ผู้ตรวจสอบ" user="Finance Manager" status="done" />
                   <SignatoryStep label="ผู้อนุมัติ" user="Managing Director" status="done" />
                </div>
             </GlassCard>

             <GlassCard className="p-6 border-white/5 bg-surface-1">
                <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-4 border-b border-white/5 pb-3">เอกสารการเงินที่เกี่ยวข้อง</h4>
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
          <p className="text-[11px] font-semibold text-white/80">{label}</p>
          <p className="text-[10px] font-bold text-white/40 uppercase truncate">{user}</p>
       </div>
    </div>
  );
}

function LinkedDoc({ label, id }: { label: string, id: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer">
       <div className="min-w-0 pr-2">
          <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest truncate">{label}</p>
          <p className="text-[11px] font-bold text-white group-hover:text-nexus-blue transition-colors truncate">{id}</p>
       </div>
       <Share2 size={14} className="text-white/20 group-hover:text-nexus-blue transition-colors shrink-0" />
    </div>
  );
}
