// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { 
  X, CheckCircle2, RefreshCw, Users, Star, 
  MapPin, Phone, Mail, FileText, Wrench, Plus, Trash2, Briefcase
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  cn 
} from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";

interface ContractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const INITIAL_FORM = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  rating: 5.0,
  laborRates: [] as any[]
};

export function ContractorModal({ isOpen, onClose, onSave, initialData, showToast }: ContractorModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "projects" | "labor">("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          name: initialData.name || "",
          contactName: initialData.contactName || "",
          phone: initialData.phone || "",
          email: initialData.email || "",
          address: initialData.address || "",
          rating: initialData.rating || 5.0,
          laborRates: initialData.laborRates || []
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setActiveTab("general");
    }
  }, [isOpen, initialData]);

  const handleCommit = async () => {
    if (!form.name.trim()) {
      showToast("กรุณาระบุชื่อทีมช่าง/ผู้รับเหมา", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
      <div className="w-full max-w-[1000px] h-full md:h-[80vh] flex flex-col border border-white/10 bg-zinc-950 shadow-2xl rounded-none md:rounded-[2rem] overflow-hidden">
        
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-900/95 backdrop-blur-xl shrink-0 z-50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-nexus-blue/10 rounded-full text-nexus-blue border border-nexus-blue/20 shrink-0">
              <Users size={18} />
            </div>
            <div className="flex flex-col overflow-hidden">
              <h2 className="text-[15px] font-semibold text-white uppercase tracking-tight leading-none truncate">
                {initialData ? "แก้ไขข้อมูลผู้รับเหมา" : "เพิ่มผู้รับเหมาใหม่"}
              </h2>
              <p className="text-xs font-semibold text-nexus-blue tracking-wider mt-1.5 opacity-80">
                การจัดการผู้รับเหมาและค่าแรง
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/20">
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            {/* Navigation Tabs & Control Action Buttons inline on top row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0 pb-2">
              <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-full backdrop-blur-md w-fit shadow-inner">
                {(["general", "projects", "labor"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "h-8 px-5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      activeTab === tab 
                        ? "bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 backdrop-blur-md shadow-neon-blue font-black" 
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {tab === "general" && <FileText size={14} />}
                    {tab === "projects" && <Briefcase size={14} />}
                    {tab === "labor" && <Wrench size={14} />}
                    {tab === "general" ? "ข้อมูลทั่วไป" : tab === "projects" ? "ประวัติงานติดตั้ง" : "ชุดค่าแรงมาตรฐาน"}
                  </button>
                ))}
              </div>

              {/* Control Action Buttons (Top Row) */}
              <div className="flex items-center gap-2">
                <PillButton 
                  type="button" 
                  variant="glass" 
                  onClick={onClose} 
                  className="h-8 px-4 rounded-full text-[12px] font-bold uppercase text-white/70 hover:text-white border-white/10"
                >
                  ยกเลิก
                </PillButton>
                <PillButton 
                  type="button"
                  variant="confirm"
                  onClick={handleCommit}
                  disabled={isSubmitting}
                  className="h-8 px-5 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </PillButton>
              </div>
            </div>

            <div className="flex-1 transition-all duration-300">
              
              {/* 1. GENERAL TAB */}
              {activeTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                        ชื่อผู้รับเหมา / ทีมช่าง <span className="text-rose-500 font-bold ml-0.5">*</span>
                      </label>
                      <PillInput 
                        placeholder="ระบุชื่อบริษัท หรือชื่อทีม..." 
                        className="w-full bg-white/[0.02]" 
                        value={form.name} 
                        onChange={(e) => setForm({...form, name: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2"><Star size={12} className="text-warning"/> เรตติ้งดาว (เต็ม 5)</label>
                      <NumberStepper 
                        value={form.rating} 
                        onChange={(v) => setForm({...form, rating: Math.min(Math.max(v, 0), 5)})} 
                        step={0.5}
                        unit="ดาว"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2"><MapPin size={12}/> ที่อยู่</label>
                      <textarea 
                        rows={3}
                        className="w-full p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-blue/40 transition-all placeholder:text-white/10 resize-none" 
                        placeholder="ที่อยู่ในการติดต่อ..." 
                        value={form.address} 
                        onChange={(e) => setForm({...form, address: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">ชื่อผู้ติดต่อหลัก</label>
                      <PillInput 
                        placeholder="ชื่อผู้ประสานงาน..." 
                        className="w-full bg-white/[0.02]" 
                        value={form.contactName} 
                        onChange={(e) => setForm({...form, contactName: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2"><Phone size={12}/> เบอร์โทรศัพท์</label>
                      <PillInput 
                        placeholder="08X-XXX-XXXX" 
                        className="w-full bg-white/[0.02]" 
                        value={form.phone} 
                        onChange={(e) => setForm({...form, phone: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2"><Mail size={12}/> อีเมล</label>
                      <PillInput 
                        type="email"
                        placeholder="email@example.com" 
                        className="w-full bg-white/[0.02]" 
                        value={form.email} 
                        onChange={(e) => setForm({...form, email: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PROJECTS TAB */}
              {activeTab === "projects" && (
                <div className="animate-in fade-in duration-300">
                  <div className="border border-white/5 rounded-[2rem] bg-surface-1/40 shadow-inner overflow-hidden min-h-[300px] flex items-center justify-center">
                    <div className="text-center text-white/30 space-y-2">
                      <Briefcase size={32} className="mx-auto opacity-50" />
                      <p className="text-xs font-bold uppercase tracking-wider">ประวัติงานติดตั้ง</p>
                      <p className="text-[10px]">ระบบจะดึงข้อมูลโครงการที่ทีมนี้รับผิดชอบมาแสดงอัตโนมัติ</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. LABOR TAB */}
              {activeTab === "labor" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-[12px] font-semibold text-nexus-blue uppercase flex items-center gap-2 tracking-wider">
                      <Wrench size={14} /> โครงสร้างค่าแรงมาตรฐานของทีมนี้
                    </h3>
                    <PillButton 
                      variant="glass" 
                      className="h-8"
                      onClick={() => setForm(prev => ({
                        ...prev, 
                        laborRates: [...prev.laborRates, { label: "", rate: 0, unit: "จุด" }]
                      }))}
                    >
                      <Plus size={12} /> เพิ่มรายการค่าแรง
                    </PillButton>
                  </div>
                  
                  <div className="border border-white/5 rounded-[2.5rem] bg-surface-1/40 shadow-inner overflow-hidden max-h-[380px] overflow-y-auto">
                    <NexusTable headers={["ประเภทบริการ / งานติดตั้ง", "หน่วยนับ", "อัตรามาตรฐาน (฿/หน่วย)", "การทำงาน"]}>
                      {form.laborRates.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={4} className="text-center py-20 text-white/25 italic text-xs">
                            ยังไม่มีการระบุค่าแรงมาตรฐานสำหรับช่างทีมนี้
                          </NexusTableCell>
                        </NexusTableRow>
                      ) : (
                        form.laborRates.map((item, idx) => (
                          <NexusTableRow key={idx} className="hover:bg-white/[0.02]">
                            <NexusTableCell className="w-[45%]">
                              <PillInput 
                                placeholder="ระบุ เช่น ค่าเดินสาย LAN, ค่าเซ็ตอัพระบบ..." 
                                className="w-full bg-transparent border-none text-white text-xs px-0 focus:bg-transparent" 
                                value={item.label} 
                                onChange={(e) => { 
                                  const nl = [...form.laborRates]; 
                                  nl[idx].label = e.target.value; 
                                  setForm({...form, laborRates: nl}); 
                                }} 
                              />
                            </NexusTableCell>
                            <NexusTableCell className="w-[20%]">
                              <PillInput 
                                placeholder="เช่น จุด, เมตร, งาน" 
                                className="w-full bg-transparent border-none text-center text-white/70 text-xs px-0" 
                                value={item.unit} 
                                onChange={(e) => { 
                                  const nl = [...form.laborRates]; 
                                  nl[idx].unit = e.target.value; 
                                  setForm({...form, laborRates: nl}); 
                                }} 
                              />
                            </NexusTableCell>
                            <NexusTableCell className="w-[25%] text-right">
                              <div className="flex justify-end">
                                <NumberStepper 
                                  size="sm" 
                                  value={item.rate} 
                                  unit="฿" 
                                  step={100}
                                  onChange={(val) => { 
                                    const nl = [...form.laborRates]; 
                                    nl[idx].rate = val; 
                                    setForm({...form, laborRates: nl}); 
                                  }} 
                                />
                              </div>
                            </NexusTableCell>
                            <NexusTableCell className="w-[10%] text-center">
                              <button 
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, laborRates: prev.laborRates.filter((_, i) => i !== idx) }))} 
                                className="text-white/30 hover:text-danger p-2 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </NexusTableCell>
                          </NexusTableRow>
                        ))
                      )}
                    </NexusTable>
                  </div>
                </div>
              )}

            </div>
          </div>
          
          {/* Action Footer */}
          <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-zinc-900/60 shrink-0">
            <PillButton 
              type="button"
              variant="glass"
              onClick={onClose} 
              className="h-8 px-4 text-[11px]"
            >
              ยกเลิก
            </PillButton>
            <PillButton 
              type="button"
              variant="confirm"
              disabled={isSubmitting} 
              onClick={handleCommit} 
              className="h-8 px-5 font-bold text-[12px]"
            >
              {isSubmitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <><CheckCircle2 size={16} /> บันทึกข้อมูลทีมช่าง</>
              )}
            </PillButton>
          </div>
        </div>

      </div>
    </div>
  );
}
