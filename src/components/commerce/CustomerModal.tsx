"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  X, CheckCircle2, Users, MapPin, 
  RefreshCw, Info, Wallet, 
  Lock, Edit3, LayoutList,
  Zap, Target, User,
  Plus, Trash2,
  Building2
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { SmartAddressPicker, ThaiAddress } from "@/components/ui/SmartAddressPicker";
import { CustomerType, CustomerStatus } from "@/lib/erp-logic";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const BUSINESS_GROUPS = [
  "การแพทย์และโรงพยาบาล",
  "การศึกษาและวิจัย",
  "โรงงานและการผลิต",
  "อสังหาริมทรัพย์และก่อสร้าง",
  "เทคโนโลยีและไอที",
  "การเงินและการธนาคาร",
  "ทั่วไป"
];

const INITIAL_FORM = {
  customer_code: "",
  type: "company" as CustomerType,
  status: "draft" as CustomerStatus,
  name: "",
  tax_id: "",
  industry: "ทั่วไป",
  credit_term_days: 30,
  credit_limit: 0,
  addresses: [] as any[],
  contacts: [] as any[]
};

export function CustomerModal({ isOpen, onClose, onSave, initialData }: CustomerModalProps) {
  const [activeTab, setActiveTab] = useState("legal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({ ...INITIAL_FORM, ...initialData });
        setIsLocked(true);
      } else {
        setForm(INITIAL_FORM);
        setIsLocked(false);
      }
      setActiveTab("legal");
    }
  }, [isOpen, initialData]);

  const tabs = [
    { id: "legal", label: "ข้อมูลนิติบุคคล (LEGAL)", icon: <Building2 /> },
    { id: "geo", label: "พิกัดและไซต์งาน (GEO)", icon: <MapPin /> },
    { id: "contacts", label: "ผู้ติดต่อ (CONTACTS)", icon: <User /> }
  ];

  const handleCommit = async () => {
    if (!form.name) return alert("กรุณาระบุชื่อลูกค้า");
    setIsSubmitting(true);
    try {
      await onSave(form);
      setIsLocked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSmartAddress = (addr: ThaiAddress) => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      addresses: [...prev.addresses, {
        address_type: "พิกัดใหม่",
        line1: `ต.${addr.subDistrict} อ.${addr.district} จ.${addr.province} ${addr.zipCode}`,
        is_default: false
      }]
    }));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ลูกค้า"
      maxWidth="max-w-[1300px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        {/* INPUT CANVAS */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]" title="ระบบบริหารความสัมพันธ์ลูกค้า V3.7">CRM V3.7</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">ข้อมูลลูกค้า</h4>
              </div>
              <PillTabs 
                tabs={[
                  { id: "legal", label: "ข้อมูลหลัก", icon: <Building2 /> },
                  { id: "geo", label: "ที่อยู่", icon: <MapPin /> },
                  { id: "contacts", label: "ผู้ติดต่อ", icon: <User /> }
                ]} 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
              />
            </div>

            <div className={cn("space-y-10 transition-all duration-500", isLocked && "opacity-60 pointer-events-none grayscale-[0.5]")}>
              {activeTab === "legal" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                  <section className="space-y-6">
                    <h3 className="text-[12px] font-black text-nexus-teal uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><Zap size={16} /> 1. อัตลักษณ์ธุรกิจ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Field label="ชื่อบริษัท / นิติบุคคล *">
                        <PillInput value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="ระบุชื่อเต็ม..." className="w-full" />
                      </Field>
                      <Field label="เลขผู้เสียภาษี (TAX ID)">
                        <PillInput value={form.tax_id} onChange={(e) => setForm({...form, tax_id: e.target.value})} placeholder="13 หลัก..." className="w-full font-mono" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <Field label="ประเภทลูกค้า">
                        <PillSelect value={form.type} onChange={(e) => setForm({...form, type: e.target.value as CustomerType})} className="w-full">
                          <option value="company">นิติบุคคล (Company)</option>
                          <option value="government">หน่วยงานราชการ (Government)</option>
                          <option value="person">บุคคลธรรมดา (Individual)</option>
                        </PillSelect>
                      </Field>
                      <Field label="กลุ่มอุตสาหกรรม">
                        <PillSelect value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} className="w-full">
                          {BUSINESS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </PillSelect>
                      </Field>
                    </div>
                  </section>

                  <section className="space-y-6 pt-6 border-t border-white/5">
                    <h3 className="text-[12px] font-black text-white/40 uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><Wallet size={16} /> 2. นโยบายสินเชื่อ</h3>
                    <div className="grid grid-cols-2 gap-8 bg-white/[0.02] p-8 rounded-[2rem] border border-white/5">
                      <Field label="เครดิตเทอม (วัน)">
                        <NumberStepper value={form.credit_term_days} onChange={(v) => setForm({...form, credit_term_days: v})} unit="วัน" />
                      </Field>
                      <Field label="วงเงินสินเชื่อ (Credit Limit)">
                        <NumberStepper value={form.credit_limit} onChange={(v) => setForm({...form, credit_limit: v})} unit="฿" step={10000} />
                      </Field>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "geo" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-[12px] font-black text-nexus-teal uppercase italic">พิกัดจัดส่งและไซต์งาน</h3>
                    <PillButton variant="glass" size="sm" onClick={() => setForm({...form, addresses: [...form.addresses, { address_type: "ไซต์งาน", line1: "" }]})}>
                      <Plus size={14} /> เพิ่มพิกัด
                    </PillButton>
                  </div>
                  <SmartAddressPicker onSelect={handleSmartAddress} />
                  <div className="space-y-4 mt-6">
                    {form.addresses.map((addr, idx) => (
                      <div key={idx} className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] flex gap-6 items-end group">
                        <div className="w-48 space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">ป้ายกำกับ</label>
                          <PillInput className="w-full h-8" value={addr.address_type} onChange={(e) => {
                            const na = [...form.addresses];
                            na[idx].address_type = e.target.value;
                            setForm({...form, addresses: na});
                          }} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">ที่อยู่</label>
                          <PillInput className="w-full h-8" value={addr.line1} onChange={(e) => {
                            const na = [...form.addresses];
                            na[idx].line1 = e.target.value;
                            setForm({...form, addresses: na});
                          }} />
                        </div>
                        <button onClick={() => setForm({...form, addresses: form.addresses.filter((_, i) => i !== idx)})} className="p-2 text-white/10 hover:text-danger">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "contacts" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-[12px] font-black text-nexus-teal uppercase italic">ทะเบียนผู้ติดต่อ</h3>
                    <PillButton variant="glass" size="sm" onClick={() => setForm({...form, contacts: [...form.contacts, { name: "", position: "", phone: "" }]})}>
                      <Plus size={14} /> เพิ่มผู้ติดต่อ
                    </PillButton>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {form.contacts.map((cont, idx) => (
                      <div key={idx} className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] grid grid-cols-12 gap-6 items-end">
                        <div className="col-span-5 space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>
                          <PillInput className="w-full h-8" value={cont.name} onChange={(e) => {
                            const nc = [...form.contacts];
                            nc[idx].name = e.target.value;
                            setForm({...form, contacts: nc});
                          }} />
                        </div>
                        <div className="col-span-3 space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">ตำแหน่ง</label>
                          <PillInput className="w-full h-8" value={cont.position} onChange={(e) => {
                            const nc = [...form.contacts];
                            nc[idx].position = e.target.value;
                            setForm({...form, contacts: nc});
                          }} />
                        </div>
                        <div className="col-span-3 space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">เบอร์โทรศัพท์</label>
                          <PillInput className="w-full h-8 font-mono" value={cont.phone} onChange={(e) => {
                            const nc = [...form.contacts];
                            nc[idx].phone = e.target.value;
                            setForm({...form, contacts: nc});
                          }} />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button onClick={() => setForm({...form, contacts: form.contacts.filter((_, i) => i !== idx)})} className="p-2 text-white/10 hover:text-danger">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-[350px] bg-[#0F0F12] p-8 flex flex-col shrink-0 border-l border-white/5 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            {isLocked && (
              <PillButton onClick={() => setIsLocked(false)} className="w-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30">
                <Edit3 size={18} /> เริ่มการแก้ไขข้อมูล
              </PillButton>
            )}

            <div className="p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h4 className="text-[11px] font-black text-white/40 uppercase tracking-widest">สถานะบัญชี</h4>
                <div className={cn("w-2 h-2 rounded-full", form.status === 'active' ? 'bg-nexus-teal shadow-neon-teal' : 'bg-warning')} />
              </div>
              <div className="space-y-4">
                <PillSelect value={form.status} onChange={(e) => setForm({...form, status: e.target.value as CustomerStatus})} className="w-full">
                  <option value="active">เปิดใช้งาน (ACTIVE)</option>
                  <option value="draft">ฉบับร่าง (DRAFT)</option>
                  <option value="suspended">ระงับการบริการ (SUSPENDED)</option>
                </PillSelect>
                <NexusDataField label="รหัสลูกค้า" value={form.customer_code || "AUTO-GEN"} />
                <NexusDataField label="เครดิตรวม" value={form.credit_term_days + " วัน"} />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-white/5">
            <PillButton 
              className="w-full shadow-neon-teal uppercase tracking-[0.2em]" 
              onClick={handleCommit} 
              disabled={isSubmitting || isLocked}
              title="บันทึกข้อมูลลูกค้าลงในฐานข้อมูลกลาง"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={20} />}
              บันทึกข้อมูล
            </PillButton>
            <PillButton variant="glass" className="w-full text-white/20" onClick={onClose}>
              ยกเลิก
            </PillButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
