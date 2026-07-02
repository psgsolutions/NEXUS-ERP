// @ts-nocheck
"use client";

import React from "react";
import { 
  DollarSign, 
  Package, 
  FileText, 
  AlertTriangle,
  Plus,
  ShieldCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { 
  PillButton, 
  Modal, 
  Toast, 
  PillTabs, 
  GlassCard,
  PillInput,
  PillSelect
} from "@/components/ui/Base";
import { ShoppingCart, Users, Briefcase, LifeBuoy, FileText as FileIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [isQuickActionOpen, setIsQuickActionOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("sales");
  const [toast, setToast] = React.useState({ message: "", isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };
  return (
    <div className="p-5 space-y-3 animate-in fade-in duration-700 max-w-7xl mx-auto">
      {/* Title Header with Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-nexus-teal rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(20,163,204,0.3)]">
            <Activity size={24} className="text-black" />
          </div>
          <div>
            <div className="flex gap-2 mb-2">
              <span className="px-2 py-0.5 rounded bg-nexus-teal/10 border border-nexus-teal/20 text-[12px] text-nexus-teal font-medium uppercase tracking-widest">เปิดใช้งานการตรวจสอบ</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[12px] text-white/40 font-medium uppercase tracking-widest">เชื่อมข้อมูล: COMP-24-0001</span>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              บริษัท พีเอสจี โซลูชั่น จำกัด
            </h1>
          </div>
        </div>
         <PillButton onClick={() => setIsQuickActionOpen(true)} className="px-8 shadow-neon-teal text-black font-medium uppercase tracking-widest text-[12px]">
           <Plus size={18} />
           สร้างเอกสารด่วน
         </PillButton>
      </div>

      {/* Metric Cards - NEXUS ERP Style */}
      <div className="grid grid-cols-4 gap-5">
        <MasterMetricCard icon={<DollarSign />} label="มูลค่าคลังพัสดุ" value="฿169,565" color="text-nexus-teal" neon="shadow-neon-teal/20" />
        <MasterMetricCard icon={<Package />} label="รายการสินค้า" value="6 ITEMS" color="text-nexus-teal" />
        <MasterMetricCard icon={<FileText />} label="พัสดุจองโครงการ" value="0 PRJ" color="text-nexus-blue" />
        <MasterMetricCard icon={<AlertTriangle />} label="สต็อกวิกฤต" value="0 UNITS" color="text-danger" />
      </div>

      {/* System Integrity & Secondary Widgets */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-nexus-teal uppercase tracking-widest">ความสมบูรณ์ของระบบ</p>
                <p className="text-xs text-white/40">ข้อมูลพัสดุและตัวเลขบัญชีถูกต้อง 100%</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-5 h-[360px] relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-nexus-teal" />
                <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">แนวโน้มการเติบโต</h3>
              </div>
            </div>
            {/* Mock Wave Chart Visualization */}
            <div className="absolute bottom-0 left-0 w-full h-[200px] bg-gradient-to-t from-nexus-teal/5 to-transparent" />
            <svg viewBox="0 0 800 200" className="absolute bottom-10 left-0 w-full h-[150px] drop-shadow-[0_0_15px_rgba(20,163,204,0.3)]">
              <path 
                d="M0,100 C100,20 200,180 300,100 C400,20 500,180 600,100 C700,20 800,100" 
                fill="none" 
                stroke="#14a3cc" 
                strokeWidth="4"
                className="animate-wave"
              />
            </svg>
          </div>
        </div>

        <div className="col-span-1 space-y-3">
          <GlassCard className="bg-[#0a0a0c] border-white/5 h-[200px] flex flex-col items-center justify-center text-center">
             <AlertTriangle size={32} className="text-danger mb-4 opacity-50" />
             <h4 className="text-sm font-medium text-white/40 uppercase tracking-widest">สต็อกวิกฤต</h4>
             <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mt-4">
                <CheckCircle2 size={24} className="text-nexus-teal" />
             </div>
             <p className="text-[10px] text-white/20 uppercase tracking-widest mt-2">สต็อกสินค้าปกติ</p>
          </GlassCard>

          <GlassCard className="bg-[#0a0a0c] border-white/5 h-[200px] flex flex-col items-center justify-center text-center">
             <FileText size={32} className="text-nexus-blue mb-4 opacity-50" />
             <h4 className="text-sm font-medium text-white/40 uppercase tracking-widest">ภารกิจเร่งด่วน</h4>
             <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] mt-6">DATA CONSISTENT</p>
          </GlassCard>
        </div>
      </div>

      <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <ShoppingCart size={18} className="text-nexus-teal" />
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">รายการล่าสุด</h3>
        </div>
        <div className="p-2">
          <NexusTable headers={["เลขที่เอกสาร", "ลูกค้า / ผู้ติดต่อ", "ยอดสุทธิ", "สถานะ"]}>
             <tr className="border-t border-white/5">
                <td colSpan={4} className="p-12 text-center text-[12px] text-white/10 uppercase font-medium tracking-[0.3em] italic">
                   ยังไม่มีความเคลื่อนไหวล่าสุดในฐานข้อมูล
                </td>
             </tr>
          </NexusTable>
        </div>
      </div>

      {/* Global Quick Action Modal */}
      <Modal 
        isOpen={isQuickActionOpen} 
        onClose={() => setIsQuickActionOpen(false)} 
        title="สร้างเอกสารด่วน"
        maxWidth="max-w-7xl"
      >
        <div className="flex h-full divide-x divide-white/5 bg-[#0a0a0c]">
           <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-12">
                 <PillTabs 
                    tabs={[
                       { id: "sales", label: "งานขาย & CRM", icon: <ShoppingCart size={14} /> },
                       { id: "inventory", label: "คลังพัสดุ", icon: <Package size={14} /> },
                       { id: "hr", label: "บุคลากร", icon: <Users size={14} /> },
                       { id: "projects", label: "โครงการ", icon: <Briefcase size={14} /> }
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id: any) => setActiveTab(id)}
                 />
                 
                 <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="space-y-3">
                       <div className="flex items-center gap-3 text-nexus-teal"><Sparkles size={18} /><h4 className="text-[13px] font-bold uppercase tracking-widest">1. รายละเอียดการออกเอกสารด่วน</h4></div>
                       <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                          <Field label="ประเภทเอกสาร * (Document Type)">
                             <PillSelect className="w-full font-bold text-white">
                                {activeTab === "sales" && <><option>ใบเสนอราคา</option><option>ใบสั่งขาย</option></>}
                                {activeTab === "inventory" && <><option>ใบรับสินค้า</option><option>ใบเบิกพัสดุ</option></>}
                                {activeTab === "hr" && <><option>บันทึกเวลาปฏิบัติงาน</option><option>ขออนุมัติโอที</option></>}
                                {activeTab === "projects" && <><option>บันทึก Service Report</option><option>เบิกงบโครงการ</option></>}
                             </PillSelect>
                          </Field>
                          <Field label="ชื่อรายการ / หัวข้อ * (Title / Subject)">
                             <PillInput placeholder="ระบุข้อมูล..." className="w-full" />
                          </Field>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
           <div className="w-[420px] flex flex-col bg-[#0d0d10] p-10 flex-shrink-0">
              <div className="flex-1 space-y-3">
                 <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-nexus-teal animate-ping" /><h5 className="text-[14px] font-medium text-white/60 uppercase tracking-widest">Operational Intel</h5></div>
                    <p className="text-xs text-white/40 leading-relaxed">ระบบจะทำการสร้างเอกสารและเชื่อมโยงข้อมูลไปยังโมดูลหลักโดยอัตโนมัติ พร้อมแจ้งเตือนผู้ที่เกี่ยวข้อง</p>
                 </div>
              </div>
              <div className="space-y-3 pt-10 border-t border-white/5">
                 <PillButton className="w-full shadow-neon-teal" onClick={() => { setIsQuickActionOpen(false); showToast("ดำเนินการสร้างเอกสารด่วนสำเร็จ"); }}>
                    <ShieldCheck size={22} />ยืนยันดำเนินการ
                 </PillButton>
                 <PillButton variant="glass" className="w-full text-nexus-teal border-nexus-teal/20" onClick={() => router.push('/settings/document-builder')}>
                    <FileIcon size={22} />ออกแบบฟอร์มเอกสาร
                 </PillButton>
                 <PillButton variant="ghost" className="w-full" onClick={() => setIsQuickActionOpen(false)}>ยกเลิก</PillButton>
              </div>
           </div>
        </div>
      </Modal>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-[#0a0a0c] border border-white/5 rounded-xl p-5 relative overflow-hidden group hover:border-nexus-teal/30 transition-all">
      <div className="flex items-center justify-between mb-8">
        <div className={cn("w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center", color)}>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal animate-pulse" />
          <span className="text-[11px] font-medium text-white/40 tracking-widest">สด</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-medium text-white/30 uppercase tracking-[0.2em] mb-2">{label}</p>
        <h4 className="text-3xl font-bold text-white tracking-tight mono-numbers">{value}</h4>
      </div>
      {/* Decorative Line */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nexus-teal/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
    </div>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-medium text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
