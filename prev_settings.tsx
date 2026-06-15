"use client";

import React, { useState } from "react";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Fingerprint, 
  Save,
  RefreshCcw,
  Zap,
  ShieldCheck,
  Globe,
  Users,
  Bell,
  Cpu,
  Database,
  Lock,
  ArrowRight,
  FileText,
  Edit3,
  Layout,
  Type,
  Image as ImageIcon
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
  GlassCard
} from "@/components/ui/Base";

import { TemplateArchitectModal } from "@/components/shared/TemplateArchitectModal";

type SettingsTab = "company" | "sequence" | "templates" | "security" | "users";


export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("company");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [toast, setToast] = useState({ message: "", isVisible: false });


  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "company", label: "ข้อมูลนิติบุคคล", icon: <Building2 size={14} /> },
    { id: "users", label: "จัดการผู้ใช้งาน", icon: <Users size={14} /> },
    { id: "sequence", label: "รูปแบบเลขที่ (ID)", icon: <Fingerprint size={14} /> },
    { id: "templates", label: "ต้นแบบเอกสาร", icon: <FileText size={14} /> },
    { id: "security", label: "ความปลอดภัย", icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">เลเยอร์การกำหนดค่าระบบ</p>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <SettingsIcon size={22} />
             </div>
             <h1 className="text-2xl font-black text-white tracking-tight uppercase">การตั้งค่าระบบ (SYSTEM HUB)</h1>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <PillTabs 
            tabs={tabs} 
            activeTab={activeTab} 
            onTabChange={(id: any) => setActiveTab(id)} 
          />
          <PillButton className="px-10 shadow-neon-teal" onClick={() => showToast("บันทึกการตั้งค่าสำเร็จ")}>
            <Save size={18} />
            บันทึกการตั้งค่า
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-10">
          
          {activeTab === "company" && (
            <GlassCard className="p-10 space-y-10 border-white/10 rounded-2xl animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center gap-8">
                  <div className="w-28 h-28 rounded-xl bg-white/[0.02] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-white/20 hover:border-nexus-teal hover:text-nexus-teal hover:bg-nexus-teal/5 transition-all cursor-pointer">
                     <Building2 size={32} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Logo</span>
                  </div>
                  <div className="space-y-1">
                     <h2 className="text-2xl font-black text-white uppercase">โปรไฟล์นิติบุคคล</h2>
                     <p className="text-sm text-white/40 font-bold">ข้อมูลสำหรับออกใบกำกับภาษีและเอกสารทางราชการ</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">ชื่อบริษัท (ภาษาไทย) *</label>
                     <PillInput defaultValue="บริษัท พีเอสจี โซลูชั่น จำกัด" className="bg-white/[0.02] border-white/10" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">ชื่อบริษัท (ENGLISH) *</label>
                     <PillInput defaultValue="PSG SOLUTIONS CO., LTD." className="bg-white/[0.02] border-white/10 uppercase" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">เลขประจำตัวผู้เสียภาษี *</label>
                     <PillInput defaultValue="0105564000000" className="bg-white/[0.02] border-white/10 font-mono" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">เว็บไซต์ / ช่องทางออนไลน์</label>
                     <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={18} />
                        <PillInput defaultValue="www.psgsolutions.com" className="pl-12 bg-white/[0.02] border-white/10" />
                     </div>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">ที่อยู่สำนักงานใหญ่</label>
                     <textarea className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-6 text-sm text-white focus:outline-none focus:border-nexus-teal/40 min-h-[120px] placeholder:text-white/10" defaultValue="เลขที่ 1/1 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900" />
                  </div>
               </div>
            </GlassCard>
          )}

          {activeTab === "sequence" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="px-4">
                  <h2 className="text-xl font-black text-white uppercase">การตั้งค่ารูปแบบเลขที่เอกสาร</h2>
                  <p className="text-xs text-white/40 font-bold mt-1">กำหนดรูปแบบเลขที่เอกสารอัจฉริยะ (Smart Prefix Mapping)</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SequenceCard module="คลังพัสดุ (Inventory)" prefix="NXI" example="NXI-2604-0001" />
                  <SequenceCard module="ใบเสนอราคา (Quotation)" prefix="QT" example="QT-2604-0042" />
                  <SequenceCard module="โครงการ (Project)" prefix="PRJ" example="PRJ-26-001" />
                  <SequenceCard module="ใบสั่งซื้อ (Purchase Order)" prefix="PO" example="PO-2604-0001" />
                  <SequenceCard module="ใบสั่งขาย (Sales Order)" prefix="SO" example="SO-2604-0001" />
                  <SequenceCard module="รายงานปฏิบัติงาน (Service Report)" prefix="SR" example="SR-2604-0001" />
               </div>
            </div>
          )}
          {activeTab === "templates" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="px-4">
                  <h2 className="text-xl font-black text-white uppercase">สถาปนิกต้นแบบเอกสาร (DOCUMENT ARCHITECT)</h2>
                  <p className="text-xs text-white/40 font-bold mt-1">ออกแบบและปรับแต่งรูปแบบการออกรายงานและเอกสารด้วยตัวเอง</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TemplateCard name="ใบเสนอราคา (Quotation)" type="System Default" lastEdit="2 วันที่แล้ว" onEdit={() => setActiveModal("ใบเสนอราคา (Quotation)")} />
                  <TemplateCard name="ใบสั่งซื้อ (Purchase Order)" type="Custom v1.2" lastEdit="1 สัปดาห์ที่แล้ว" onEdit={() => setActiveModal("ใบสั่งซื้อ (Purchase Order)")} />
                  <TemplateCard name="ใบกำกับภาษี (Tax Invoice)" type="Gov. Standard" lastEdit="10 นาทีที่แล้ว" onEdit={() => setActiveModal("ใบกำกับภาษี (Tax Invoice)")} />
                  <TemplateCard name="รายงานสต็อก (Inventory Report)" type="Intelligence View" lastEdit="5 วันที่แล้ว" onEdit={() => setActiveModal("รายงานสต็อก (Inventory Report)")} />
               </div>

            </div>
          )}
        </div>


        {/* Right Sidebar Status */}
        <div className="space-y-6">
           <GlassCard className="p-8 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-8">สถานะระบบ (SYSTEM HEALTH)</h4>
              <div className="space-y-6">
                 <ConfigStatusItem icon={<Database size={14} />} label="Multi-tenancy" status="เปิดใช้งาน" />
                 <ConfigStatusItem icon={<Lock size={14} />} label="การเข้ารหัสข้อมูล" status="ระดับสูงสุด" />
                 <ConfigStatusItem icon={<Cpu size={14} />} label="AI Engine Layer" status="พร้อมใช้งาน" />
                 <ConfigStatusItem icon={<Globe size={14} />} label="Cloud Node" status="BKK-01" />
              </div>
           </GlassCard>

           <GlassCard className="p-8 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6">ประวัติการแก้ไขล่าสุด</h4>
              <div className="space-y-4">
                 <ConfigLogItem label="ปรับปรุงอัตราภาษี" time="2 วันที่แล้ว" user="ผู้ดูแลระบบสูงสุด" />
                 <ConfigLogItem label="แก้ไข Prefix ใบสั่งขาย (SO)" time="5 วันที่แล้ว" user="ผู้ดูแลระบบ" />
              </div>
           </GlassCard>
        </div>
      </div>

      <TemplateArchitectModal 
        isOpen={activeModal !== null} 
        onClose={() => setActiveModal(null)} 
        templateName={activeModal || ""} 
      />

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

    </div>
  );
}

function SequenceCard({ module, prefix, example }: { module: string, prefix: string, example: string }) {
  return (
    <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all flex flex-col gap-4">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                <Fingerprint size={18} />
             </div>
             <p className="text-sm font-black text-white">{module}</p>
          </div>
          <button className="p-2 text-white/20 hover:text-nexus-teal transition-colors">
             <RefreshCcw size={16} />
          </button>
       </div>
       <div className="space-y-2">
          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2">Prefix</label>
          <PillInput className="w-full text-center font-mono font-bold bg-black/20" defaultValue={prefix} />
       </div>
       <p className="text-[10px] text-white/20 font-mono uppercase text-center mt-2">Example: {example}</p>
    </div>
  );
}

function ConfigStatusItem({ icon, label, status }: { icon: any, label: string, status: string }) {
  return (
    <div className="flex justify-between items-center group">
       <div className="flex items-center gap-3">
          <div className="text-white/20 group-hover:text-nexus-teal transition-colors">{icon}</div>
          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</span>
       </div>
       <span className="text-[10px] font-black text-nexus-teal uppercase tracking-tighter shadow-neon-teal">{status}</span>
    </div>
  );
}

function ConfigLogItem({ label, time, user }: { label: string, time: string, user: string }) {
  return (
    <div className="flex items-center justify-between group">
       <div>
          <p className="text-xs font-black text-white group-hover:text-nexus-blue transition-colors">{label}</p>
          <p className="text-[10px] font-black text-white/20 uppercase">{user} • {time}</p>
       </div>
       <ArrowRight size={12} className="text-white/10 group-hover:text-white transition-all" />
    </div>
  );
}
function TemplateCard({ name, type, lastEdit, onEdit }: { name: string, type: string, lastEdit: string, onEdit: () => void }) {
  return (
    <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all relative overflow-hidden">
       <div className="flex items-start justify-between relative z-10">
          <div className="space-y-4">
             <div className="w-12 h-12 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <FileText size={24} />
             </div>
             <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{name}</h3>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Type: {type}</p>
             </div>
          </div>
          <div className="flex flex-col gap-2">
             <PillButton variant="glass" className="px-4 text-[10px] uppercase tracking-widest" onClick={onEdit}>
                <Edit3 size={14} /> แก้ไขต้นแบบ
             </PillButton>

             <PillButton variant="glass" className="px-4 text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100">
                <RefreshCcw size={14} /> คืนค่าโรงงาน
             </PillButton>
          </div>
       </div>
       
       <div className="mt-8 flex items-center justify-between relative z-10 pt-6 border-t border-white/5">
          <div className="flex gap-4">
             <div className="flex items-center gap-1.5 text-[10px] font-black text-white/20 uppercase">
                <Layout size={10} /> Header
             </div>
             <div className="flex items-center gap-1.5 text-[10px] font-black text-white/20 uppercase">
                <Type size={10} /> Content
             </div>
             <div className="flex items-center gap-1.5 text-[10px] font-black text-white/20 uppercase">
                <ImageIcon size={10} /> Logo
             </div>
          </div>
          <p className="text-[10px] font-black text-white/10 uppercase italic">Last Edit: {lastEdit}</p>
       </div>
       
       <div className="absolute bottom-0 right-0 w-32 h-32 bg-nexus-teal/5 blur-[60px] translate-y-1/2 translate-x-1/2" />
    </div>
  );
}
