// @ts-nocheck
"use client";

import React, { useState } from "react";
import { 
  LifeBuoy, 
  Settings, 
  Calendar, 
  Clock, 
  MessageSquare, 
  User, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  MapPin,
  FileText,
  Zap,
  Kanban,
  Plus,
  Search,
  Activity,
  ShieldCheck,
  Filter
} from "lucide-react";
import { GlassCard, PillButton, PillInput, MasterMetricCard, cn, Modal, PillSelect, Toast, PillTabs, NexusTable, NexusTableRow, NexusTableCell, StatusBadge, NexusSearchInput } from "@/components/ui/Base";

type SupportView = "tickets" | "pm" | "sla";

export default function SupportPage() {
  const [activeView, setActiveView] = useState<SupportView>("tickets");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      
      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <LifeBuoy size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">งานบริการและแจ้งซ่อม</h1>
            <p className="text-[10px] font-black text-white/30 uppercase mt-1.5 tracking-widest leading-none">SUPPORT HUB</p>
          </div>
        </div>

        {/* Compact Metrics Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Card 1: Ticket Active */}
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Zap size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Ticket Active</span>
              <span className="text-[17px] font-black text-nexus-teal mt-1 mono-numbers leading-none">12</span>
            </div>
          </div>
          {/* Card 2: Response Time */}
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Response Time</span>
              <span className="text-[17px] font-black text-nexus-blue mt-1 mono-numbers leading-none">18m</span>
            </div>
          </div>
          {/* Card 3: SLA Risk */}
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-danger/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">SLA Risk</span>
              <span className="text-[17px] font-black text-danger mt-1 mono-numbers leading-none">2</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <section className="px-6 py-4 bg-black/10 border-b border-white/5 shrink-0">
        <PillTabs 
          tabs={[
             { id: "tickets", label: "รายการแจ้งซ่อม (Tickets)", icon: <MessageSquare size={14} /> },
             { id: "pm", label: "การซ่อมบำรุงเชิงป้องกัน (PM)", icon: <Calendar size={14} /> },
             { id: "sla", label: "ประสิทธิภาพตาม SLA", icon: <Clock size={14} /> }
          ]} 
          activeTab={activeView} 
          onTabChange={(id: any) => setActiveView(id)} 
        />
      </section>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-6 max-w-[1800px] mx-auto animate-in fade-in duration-700">
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-10">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Kanban className="text-nexus-teal" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">การบริหารจัดการ Ticket และงานซ่อมบำรุง</p>
                    <h2 className="text-xl font-black text-white uppercase">ทะเบียนข้อมูล</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                 {activeView === "tickets" && (
                   <PillButton onClick={() => setIsCreateOpen(true)} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     เปิด Ticket ใหม่
                   </PillButton>
                 )}
                 {activeView === "pm" && (
                   <PillButton onClick={() => setIsCreateOpen(true)} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     สร้างแผน PM
                   </PillButton>
                 )}
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="ค้นหาข้อมูล Ticket หรือชื่อลูกค้า..." 
                 className="flex-1"
                 kbd="F"
               />
               <div className="flex items-center gap-2 pr-1.5">
                  <PillButton variant="glass" className="h-11 w-11 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            {/* View Content */}
             {activeView === "tickets" && (
               <div className="animate-in fade-in duration-500">
                 <TicketKanban />
               </div>
             )}
             
             {activeView === "pm" && (
               <div className="animate-in fade-in duration-500">
                 <PMSchedulingView />
               </div>
             )}

             {activeView === "sla" && (
               <div className="animate-in fade-in duration-500">
                 <NexusTable headers={["ประเภทบริการ", "เป้าหมาย SLA", "ผลงานจริง", "แนวโน้ม", "สถานะ"]}>
                   <SLARow type="การตอบกลับ (Response Time)" target="15 min" actual="12 min" trend="up" status="active" />
                   <SLARow type="การแก้ไข (Resolution Time)" target="4 hours" actual="3.2 hours" trend="up" status="active" />
                   <SLARow type="Uptime Guarantee" target="99.9%" actual="99.92%" trend="flat" status="active" />
                 </NexusTable>
               </div>
             )}
          </div>

        </div>

        <div className="space-y-6">
           <GlassCard className="p-5 border-white/5 bg-nexus-teal/5">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-4 text-center">ความสมบูรณ์ของ SLA</h4>
              <div className="space-y-6">
                 <SLABar label="เวลาในการตอบกลับ" value={98} />
                 <SLABar label="เวลาในการแก้ไขปัญหา" value={85} />
              </div>
           </GlassCard>

           <GlassCard className="p-6 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6">ภารกิจที่มอบหมาย</h4>
              <div className="space-y-4">
                 <div className="text-[10px] text-white/20 italic">ไม่มีภารกิจค้างในขณะนี้</div>
              </div>
           </GlassCard>
        </div>
      </div>

        </div>
      </div>

      <Modal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        title={activeView === "tickets" ? "เปิดบันทึกแจ้งซ่อม (NEW SERVICE TICKET)" : "กำหนดแผนซ่อมบำรุง (NEW PM PLAN)"}
        maxWidth="max-w-7xl"
      >
        <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
           <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-12">
                 <PillTabs 
                    tabs={activeView === "tickets" ? [
                       { id: "basic", label: "ข้อมูลแจ้งซ่อม" },
                       { id: "assign", label: "การมอบหมายและลูกค้า" },
                       { id: "sla", label: "SLA และไฟล์แนบ" }
                    ] : [
                       { id: "basic", label: "รายละเอียดแผน PM" },
                       { id: "checklist", label: "รายการตรวจสอบ (Checklist)" },
                       { id: "automation", label: "การตั้งค่าอัตโนมัติ" }
                    ]}
                    activeTab={modalActiveTab}
                    onTabChange={setModalActiveTab}
                 />
                 <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
                    {activeView === "tickets" ? (
                       <>
                          {modalActiveTab === "basic" && (
                             <div className="space-y-10">
                                <div className="space-y-6">
                                   <div className="flex items-center gap-3 text-nexus-teal"><Zap size={18} /><h4 className="text-[13px] font-black uppercase tracking-widest">1. รายละเอียดปัญหา (Ticket Details)</h4></div>
                                   <div className="space-y-4">
                                      <div className="space-y-2">
                                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">หัวข้อปัญหา / อาการที่พบ *</label>
                                         <PillInput placeholder="ระบุอาการเสียเบื้องต้น..." className="w-full" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ประเภทบริการ (Category)</label>
                                            <PillSelect className="w-full px-6">
                                               <option>Incident (แจ้งซ่อม/เสีย)</option>
                                               <option>Request (ขอรับบริการใหม่)</option>
                                               <option>Question (สอบถามข้อมูล)</option>
                                               <option>Bug (แจ้งบัคระบบ)</option>
                                            </PillSelect>
                                         </div>
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ความเร่งด่วน (Priority)</label>
                                            <PillSelect className="w-full px-6 text-danger font-black">
                                               <option>LOW (ทั่วไป)</option>
                                               <option>MEDIUM (ปกติ)</option>
                                               <option>HIGH (ด่วน)</option>
                                               <option>URGENT (ด่วนที่สุด)</option>
                                            </PillSelect>
                                         </div>
                                      </div>
                                      <div className="space-y-2">
                                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">คำอธิบายรายละเอียดเพิ่มเติม</label>
                                         <textarea 
                                            className="w-full h-32 rounded-lg bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-5 focus:outline-none focus:border-nexus-teal/40 transition-all placeholder:text-white/5"
                                            placeholder="ระบุรายละเอียดเพิ่มเติมเพื่อช่วยในการคัดกรองงาน..."
                                         />
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}

                          {modalActiveTab === "assign" && (
                             <div className="space-y-10">
                                <div className="space-y-6">
                                   <div className="flex items-center gap-3 text-nexus-blue"><User size={18} /><h4 className="text-[13px] font-black uppercase tracking-widest">2. ข้อมูลผู้ขอรับบริการและการมอบหมาย (Assignment)</h4></div>
                                   <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ลูกค้า / นิติบุคคล (Customer)</label>
                                            <PillSelect className="w-full px-6">
                                               <option>เลือกรายชื่อลูกค้า...</option>
                                               <option>Hospital A</option>
                                               <option>Site X (Condo)</option>
                                            </PillSelect>
                                         </div>
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">โครงการที่เกี่ยวข้อง (Optional)</label>
                                            <PillSelect className="w-full px-6">
                                               <option>ไม่ระบุโครงการ...</option>
                                               <option>PRJ-26-001: LED Wall</option>
                                            </PillSelect>
                                         </div>
                                      </div>
                                      <div className="space-y-2">
                                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">วิศวกรผู้รับผิดชอบ (Assigned Agent)</label>
                                         <PillSelect className="w-full px-6">
                                            <option>เลือกวิศวกร...</option>
                                            <option>Kriangkrai M.</option>
                                            <option>Somchai J.</option>
                                         </PillSelect>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}

                          {modalActiveTab === "sla" && (
                             <div className="space-y-10">
                                <div className="space-y-6">
                                   <div className="flex items-center gap-3 text-white"><ShieldCheck size={18} /><h4 className="text-[13px] font-black uppercase tracking-widest">3. การควบคุมคุณภาพและไฟล์แนบ (SLA & Attachments)</h4></div>
                                   <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">เส้นตายตามสัญญา (SLA Due Date)</label>
                                            <PillInput type="datetime-local" className="w-full" />
                                         </div>
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">แท็ก (Tags)</label>
                                            <PillInput placeholder="เช่น #Internet, #CCTV..." className="w-full" />
                                         </div>
                                      </div>
                                      <div className="space-y-2">
                                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ไฟล์แนบ / ภาพถ่ายอาการเสีย</label>
                                         <div className="p-8 rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 hover:bg-white/[0.04] transition-all cursor-pointer">
                                            <Plus size={32} className="text-white/10" />
                                            <div className="space-y-1">
                                               <p className="text-[12px] font-bold text-white/40 uppercase tracking-widest">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่ออัปโหลด</p>
                                               <p className="text-[10px] text-white/10 font-black uppercase tracking-widest">รองรับ JPG, PNG, PDF (สูงสุด 10MB)</p>
                                            </div>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}
                       </>
                    ) : (
                       <>
                          {modalActiveTab === "basic" && (
                             <div className="space-y-10 animate-in slide-in-from-left-4 duration-500">
                                <div className="space-y-6">
                                   <div className="flex items-center gap-3 text-nexus-teal"><Calendar size={18} /><h4 className="text-[13px] font-black uppercase tracking-widest">1. รายละเอียดแผนบำรุงรักษา (PM Plan Details)</h4></div>
                                   <div className="space-y-4">
                                      <div className="space-y-2">
                                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ชื่อแผนงาน / รายละเอียดหลัก *</label>
                                         <PillInput placeholder="เช่น แผนตรวจเช็คระบบเครือข่ายรายเดือน..." className="w-full" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ความถี่ในการเข้าบริการ (Frequency)</label>
                                            <PillSelect className="w-full px-6">
                                               <option>Monthly (รายเดือน)</option>
                                               <option>Quarterly (ราย 3 เดือน)</option>
                                               <option>Semi-Annually (ราย 6 เดือน)</option>
                                               <option>Annually (รายปี)</option>
                                            </PillSelect>
                                         </div>
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">วันที่เริ่มแผนงาน (Start Date)</label>
                                            <PillInput type="date" className="w-full" />
                                         </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">ลูกค้าที่รับบริการ</label>
                                            <PillSelect className="w-full px-6">
                                               <option>เลือกรายชื่อลูกค้า...</option>
                                               <option>Hospital A</option>
                                               <option>Site X (Condo)</option>
                                            </PillSelect>
                                         </div>
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">โครงการที่เกี่ยวข้อง (Optional)</label>
                                            <PillSelect className="w-full px-6">
                                               <option>ระบุโครงการ...</option>
                                               <option>PRJ-26-001: LED Wall</option>
                                            </PillSelect>
                                         </div>
                                      </div>
                                      <div className="space-y-2">
                                         <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">อุปกรณ์ที่ต้องตรวจสอบ (Target Equipment/Asset) *</label>
                                         <PillSelect className="w-full px-6 text-nexus-blue">
                                            <option>เลือกอุปกรณ์ในโครงการ...</option>
                                            <option>Cisco Catalyst 9200 (SN-2600412)</option>
                                            <option>Core Server R740 (SN-SRV-99)</option>
                                         </PillSelect>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}

                          {modalActiveTab === "checklist" && (
                             <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex justify-between items-center">
                                   <div className="flex items-center gap-3 text-nexus-blue">
                                      <ClipboardList size={18} />
                                      <h4 className="text-[13px] font-bold text-white uppercase tracking-widest">รายการตรวจสอบมาตรฐาน (Maintenance Checklist)</h4>
                                   </div>
                                   <PillButton variant="glass"><Plus size={14} /> เพิ่มรายการ</PillButton>
                                </div>
                                <div className="space-y-3">
                                   {[
                                      "ตรวจสอบความร้อนของอุปกรณ์ (Thermal Check)",
                                      "ทำความสะอาดตัวเครื่องและช่องระบายอากาศ",
                                      "สำรองข้อมูลระบบ (System Backup)",
                                      "อัปเดต Firmware ล่าสุด",
                                      "ตรวจสอบสถานะไฟสำรอง (UPS Battery Test)"
                                   ].map((task, idx) => (
                                      <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-nexus-teal/30 transition-all group">
                                         <div className="w-6 h-6 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal text-[10px] font-black">{idx + 1}</div>
                                         <p className="flex-1 text-[13px] font-bold text-white/60">{task}</p>
                                         <PillButton variant="ghost" className="w-8 p-0 text-white/10 opacity-0 group-hover:opacity-100 transition-all hover:text-danger"><X size={14} /></PillButton>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          )}

                          {modalActiveTab === "automation" && (
                             <div className="space-y-10 animate-in fade-in duration-500">
                                <div className="space-y-8">
                                   <div className="flex items-center gap-3 text-nexus-blue"><Activity size={18} /><h4 className="text-[13px] font-black uppercase tracking-widest">3. การตั้งค่าอัตโนมัติและคุณภาพ (Quality Control)</h4></div>
                                   <div className="space-y-6">
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="flex items-center justify-between p-6 rounded-xl bg-white/[0.02] border border-white/5">
                                            <div>
                                               <p className="text-[13px] font-black text-white uppercase tracking-widest">เปิด Ticket อัตโนมัติ</p>
                                               <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">สร้างงานล่วงหน้า 7 วัน</p>
                                            </div>
                                            <div className="w-12 h-6 bg-nexus-teal/20 rounded-full p-1 cursor-pointer">
                                               <div className="w-4 h-4 bg-nexus-teal rounded-full translate-x-6" />
                                            </div>
                                         </div>
                                         <div className="flex items-center justify-between p-6 rounded-xl bg-white/[0.02] border border-white/5">
                                            <div>
                                               <p className="text-[13px] font-black text-white uppercase tracking-widest">บังคับถ่ายภาพหลักฐาน</p>
                                               <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">ต้องแนบรูปก่อนปิด Ticket</p>
                                            </div>
                                            <div className="w-12 h-6 bg-white/10 rounded-full p-1 cursor-pointer">
                                               <div className="w-4 h-4 bg-white/20 rounded-full" />
                                            </div>
                                         </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-6">
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">วิศวกรผู้ดูแลหลัก (Lead Technician)</label>
                                            <PillSelect className="w-full px-6">
                                               <option>เลือกรายชื่อวิศวกร...</option>
                                               <option>Kriangkrai M.</option>
                                               <option>Somchai J.</option>
                                            </PillSelect>
                                         </div>
                                         <div className="space-y-2">
                                            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">SLA Completion (Days)</label>
                                            <PillInput type="number" placeholder="เช่น 3 วันหลังวันนัด" className="w-full" />
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}
                       </>
                    )}
                 </div>
              </div>
           </div>
           <div className="w-[420px] flex flex-col bg-[#0F0F12] p-12 flex-shrink-0">
              <div className="flex-1 space-y-8">
                 <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 space-y-6">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-nexus-teal animate-ping" /><h5 className="text-[13px] font-bold text-white/60 uppercase tracking-widest">Ticket Intelligence</h5></div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-[13px] text-white/30">ID อ้างอิง</span><span className="text-sm font-black text-nexus-teal">AUTO_SYSTEM</span></div>
                 </div>
              </div>
              <div className="space-y-4 pt-10 border-t border-white/5">
                 <PillButton className="w-full shadow-neon-teal" onClick={() => { setIsCreateOpen(false); showToast("เปิด Ticket แจ้งซ่อมสำเร็จ"); }}>
                    <LifeBuoy size={22} />ยืนยันเปิด Ticket
                 </PillButton>
                 <PillButton variant="glass" className="w-full text-white/40" onClick={() => setIsCreateOpen(false)}>ยกเลิกรายการ</PillButton>
              </div>
           </div>
        </div>
      </Modal>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
}

function TicketKanban() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px] animate-in slide-in-from-bottom duration-500">
       <KanbanColumn title="รายการใหม่ / คัดกรอง" count={4}>
          <TicketCard id="TK-0042" title="อินเทอร์เน็ตใช้งานไม่ได้ที่อาคาร B" user="Hospital A" urgency="ด่วน" />
          <TicketCard id="TK-0045" title="ตั้งค่าโน้ตบุ๊กเครื่องใหม่" user="Internal" urgency="ปกติ" />
       </KanbanColumn>
       <KanbanColumn title="กำลังดำเนินการ" count={3} color="border-nexus-blue/20">
          <TicketCard id="TK-0038" title="กล้อง CCTV ออฟไลน์" user="Site X" urgency="ปกติ" />
       </KanbanColumn>
       <KanbanColumn title="รอ / เสี่ยงผิด SLA" count={2} color="border-danger/20">
          <TicketCard id="TK-0035" title="ระบบระบายความร้อนตู้ Server" user="DataCenter" urgency="ด่วน" />
       </KanbanColumn>
    </div>
  );
}

function KanbanColumn({ title, count, children, color = "border-white/5" }: { title: string, count: number, children: any, color?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 rounded-3xl bg-white/[0.02] border", color)}>
       <div className="flex items-center justify-between px-2">
          <span className="tactical-label">{title}</span>
          <span className="text-[13px] font-bold text-white/20">{count}</span>
       </div>
       <div className="flex-1 space-y-3">
          {children}
       </div>
    </div>
  );
}

function TicketCard({ id, title, user, urgency }: { id: string, title: string, user: string, urgency: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-nexus-teal/30 transition-all cursor-grab active:cursor-grabbing">
       <div className="flex justify-between items-start mb-2">
          <span className="text-[13px] font-bold text-nexus-blue uppercase">{id}</span>
          <span className={cn(
             "text-[13px] font-bold uppercase px-1.5 py-0.5 rounded",
             urgency === "Urgent" ? "bg-danger/20 text-danger" : "bg-white/5 text-white/40"
          )}>{urgency}</span>
       </div>
       <p className="text-xs font-bold text-white mb-2 line-clamp-2">{title}</p>
       <div className="flex items-center gap-2 text-[13px] font-bold text-white/30 uppercase">
          <User size={10} /> {user}
       </div>
    </div>
  );
}

function PMSchedulingView() {
  return (
    <div className="h-[400px] flex items-center justify-center tactical-label opacity-20 italic">
       ระบบสร้างปฏิทินแผนซ่อมบำรุงอัตโนมัติ (ล่วงหน้า 15 วัน)
    </div>
  );
}

function SLABar({ label, value, color = "bg-nexus-teal" }: { label: string, value: number, color?: string }) {
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between text-[13px] font-bold uppercase">
          <span className="text-white/30">{label}</span>
          <span className="text-white/80">{value}%</span>
       </div>
       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className={cn("h-full", color)} style={{ width: value + "%" }} />
       </div>
    </div>
  );
}

function HealthItem({ name, issue, project }: { name: string, issue: string, project: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
       <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center text-danger">
          <AlertCircle size={14} />
       </div>
       <div>
          <p className="text-xs font-bold text-white">{name}</p>
          <p className="text-[9px] text-danger/60 font-black uppercase tracking-widest">{issue}</p>
          <p className="text-[8px] text-white/20 uppercase font-black">{project}</p>
       </div>
    </div>
  );
}

function SLARow({ type, target, actual, trend, status }: { type: string, target: string, actual: string, trend: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-black text-white">{type}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[11px] font-black text-white/40 uppercase tracking-widest">{target}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[11px] font-black text-nexus-teal mono-numbers">{actual}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[11px] font-black text-white/20 uppercase tracking-widest">{trend}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label="สมบูรณ์" /></NexusTableCell>
    </NexusTableRow>
  );
}

