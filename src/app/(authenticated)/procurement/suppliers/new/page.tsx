"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  X, CheckCircle2, Truck, Building2, 
  MapPin, Phone, Mail, Info, RefreshCw,
  CreditCard, Activity, ShoppingCart, Tag,
  Landmark, Star, Lock, Unlock, Edit3, Package, Layers,
  ChevronRight, Zap, Target, ArrowLeft
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  PillTabs, 
  NexusDataField,
  cn,
  GlassCard
} from "@/components/ui/Base";
import { SmartAddressPicker, ThaiAddress } from "@/components/ui/SmartAddressPicker";
import { formatCurrency } from "@/lib/erp-logic";
import { useSystemDialog } from "@/context/DialogContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { doc, collection, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

const INITIAL_FORM = {
  name: "",
  tax_id: "",
  phone: "",
  email: "",
  address_detail: "",
  subDistrict: "",
  district: "",
  province: "",
  zipCode: "",
  contact_person: "",
  payment_term: "30 Days",
  business_type: "TRADING",
  bank_name: "",
  account_number: "",
  account_name: "",
  payment_method: "TRANSFER", // TRANSFER, CHEQUE, CASH
  cheque_documents: "",
  cheque_pickup_day: "",
  cheque_pickup_time: "",
  rating: 5
};

const BANKS = [
  "ธนาคารกสิกรไทย",
  "ธนาคารไทยพาณิชย์",
  "ธนาคารกรุงเทพ",
  "ธนาคารกรุงไทย",
  "ธนาคารทหารไทยธนชาต"
];

export default function NewSupplierPage() {
  const router = useRouter();
  const { user, companyId: currentCompanyId } = useAuth();

  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const tabs = [
    { id: "profile", label: "ข้อมูลทั่วไป", icon: <Building2 size={14} /> },
    { id: "bank", label: "บัญชีธนาคาร", icon: <Landmark size={14} /> }
  ];

  const handleBack = async () => {
    if (form.name || form.tax_id) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการยกเลิกและย้อนกลับโดยไม่บันทึกหรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleCommit = async () => {
    // 1. Validate all fields
    if (!form.name.trim()) return void showAlert("กรุณาระบุชื่อคู่ค้า");
    
    // Tax ID check: Only digits, exactly 13 characters
    if (!form.tax_id) return void showAlert("กรุณาระบุเลขประจำตัวผู้เสียภาษี");
    if (form.tax_id.length !== 13) return void showAlert("เลขประจำตัวผู้เสียภาษี ต้องมีครบ 13 หลักตามกฎหมายกำหนด");
    if (!/^\d{13}$/.test(form.tax_id)) return void showAlert("เลขประจำตัวผู้เสียภาษี ต้องเป็นตัวเลขเท่านั้น");

    // Contact info check
    if (!form.phone.trim()) return void showAlert("กรุณาระบุเบอร์โทรศัพท์ติดต่อ");
    if (!/^\d{9,10}$/.test(form.phone.replace(/[-+\s]/g, ""))) return void showAlert("เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลัก)");
    if (!form.email.trim()) return void showAlert("กรุณาระบุอีเมล");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return void showAlert("รูปแบบอีเมลไม่ถูกต้อง");

    // Address check
    if (!form.province || !form.zipCode) {
      return void showAlert("กรุณาค้นหาที่อยู่ผ่าน Smart Address Picker และระบุให้ครบถ้วน");
    }

    // Financial check based on payment method
    if (form.payment_method === "TRANSFER") {
      if (!form.bank_name) return void showAlert("กรุณาเลือกธนาคารของคู่ค้า");
      if (!form.account_number.trim()) return void showAlert("กรุณาระบุเลขที่บัญชีธนาคาร");
      if (!/^\d+$/.test(form.account_number.replace(/[-+\s]/g, ""))) return void showAlert("เลขที่บัญชีธนาคารต้องเป็นตัวเลขเท่านั้น");
      if (!form.account_name.trim()) return void showAlert("กรุณาระบุชื่อบัญชีธนาคาร");
    } else if (form.payment_method === "CHEQUE") {
      if (!form.cheque_documents.trim()) return void showAlert("กรุณาระบุเอกสารที่ต้องเตรียมในการรับเช็ค");
      if (!form.cheque_pickup_day.trim()) return void showAlert("กรุณาระบุวันที่รับเช็ค (เช่น ทุกวันศุกร์)");
      if (!form.cheque_pickup_time.trim()) return void showAlert("กรุณาระบุช่วงเวลารับเช็ค");
    }

    if (!user || !currentCompanyId) return;

    setIsSubmitting(true);
    try {
      const supplierRef = doc(collection(db, "suppliers"));
      await setDoc(supplierRef, {
        ...form,
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
        status: "active"
      });
      await auditService.logCreate(user.uid, currentCompanyId, "PROCUREMENT_SUPPLIER", "NEW", form);
      
      showAlert("บันทึกข้อมูลคู่ค้าใหม่สำเร็จ", "System Notification", "info");
      router.push('/procurement?tab=suppliers');
    } catch (err: any) {
      console.error(err);
      showAlert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, "System Notification", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSmartAddress = (addr: ThaiAddress) => {
    if (isLocked) return;
    setForm(prev => ({ 
      ...prev, 
      subDistrict: addr.subDistrict, 
      district: addr.district, 
      province: addr.province, 
      zipCode: addr.zipCode 
    }));
  };

  const headerContent = (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-0.5">ระบบบริหารคู่ค้า (SUPPLIER)</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">คู่ค้า (Supplier Registration)</h1>
          </div>
        </div>
      </div>
      <div className="flex justify-end hidden md:flex">
        <PillTabs 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <GlassCard className="p-8 bg-black/20 border-white/5">
        
        {/* Mobile Tabs */}
        <div className="md:hidden mb-6">
          <PillTabs 
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className={cn("min-h-[500px] transition-all duration-500", isLocked && "opacity-60 pointer-events-none grayscale-[0.5]")}>
          {activeTab === "profile" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 max-w-4xl">
              <section className="space-y-6">
                <h3 className="text-[13px] font-black text-nexus-blue uppercase flex items-center gap-2 border-b border-white/5 pb-3">
                  <Zap size={16} /> ข้อมูลทั่วไป
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="ชื่อคู่ค้า * (Supplier Name)">
                    <PillInput value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="ระบุชื่อเต็ม..." className="w-full h-9 rounded-full bg-white/[0.02] px-6" />
                  </Field>
                  <Field label="TAX ID * (เลขประจำตัวผู้เสียภาษี)">
                    <PillInput 
                      value={form.tax_id} 
                      onChange={(e) => {
                        const numericVal = e.target.value.replace(/[^0-9]/g, "").slice(0, 13);
                        setForm({...form, tax_id: numericVal});
                      }} 
                      placeholder="13 หลัก (ตัวเลขเท่านั้น)..." 
                      className="w-full h-9 rounded-full px-6 font-mono text-cyan-400 bg-white/[0.02]" 
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-6 pt-6 border-t border-white/5">
                <h3 className="text-[13px] font-black text-white/80 uppercase flex items-center gap-2 border-b border-white/5 pb-3">
                  <MapPin size={16} /> พิกัดและการติดต่อ
                </h3>
                <SmartAddressPicker onSelect={handleSmartAddress} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  <Field label="จังหวัด (Province)">
                    <PillInput value={form.province} readOnly className="w-full h-9 px-6 rounded-full opacity-60 bg-white/[0.01] border-white/5" />
                  </Field>
                  <Field label="รหัสไปรษณีย์ (Zip Code)">
                    <PillInput value={form.zipCode} readOnly className="w-full h-9 px-6 rounded-full opacity-60 bg-white/[0.01] border-white/5 font-mono" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="เบอร์โทรศัพท์ * (Phone)">
                    <PillInput 
                      value={form.phone} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                        setForm({...form, phone: val});
                      }} 
                      placeholder="08XXXXXXXX (ตัวเลขเท่านั้น)..."
                      className="w-full h-9 px-6 rounded-full font-mono text-cyan-400 bg-white/[0.02]" 
                    />
                  </Field>
                  <Field label="อีเมล (Email)">
                    <PillInput value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full h-9 px-6 rounded-full bg-white/[0.02]" placeholder="example@domain.com" />
                  </Field>
                </div>
              </section>
            </div>
          )}

          {activeTab === "bank" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 max-w-4xl">
              <section className="space-y-6">
                <h3 className="text-[13px] font-black text-warning uppercase flex items-center gap-2 border-b border-white/5 pb-3">
                  <Landmark size={16} /> วิธีการชำระเงินและข้อมูลการเงิน
                </h3>
                <div className="grid grid-cols-1 gap-8">
                  <Field label="วิธีการรับเงิน / ชำระเงิน * (Payment Method)">
                    <PillSelect value={form.payment_method} onChange={(e) => setForm({...form, payment_method: e.target.value})} className="w-full h-9 px-6 rounded-full font-black text-cyan-400 bg-white/[0.02] text-[13px]">
                      <option value="TRANSFER">โอนเงินผ่านบัญชีธนาคาร</option>
                      <option value="CHEQUE">รับด้วยเช็ค</option>
                      <option value="CASH">ชำระด้วยเงินสด</option>
                    </PillSelect>
                  </Field>

                  {form.payment_method === "TRANSFER" && (
                    <div className="space-y-6 animate-in fade-in duration-300 bg-white/[0.02] p-8 rounded-3xl border border-white/5">
                      <Field label="ธนาคาร * (Bank)">
                        <PillSelect value={form.bank_name} onChange={(e) => setForm({...form, bank_name: e.target.value})} className="w-full h-9 px-6 rounded-full bg-white/[0.02] font-bold text-[13px]">
                          <option value="">เลือกธนาคาร...</option>
                          {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </PillSelect>
                      </Field>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Field label="เลขที่บัญชี * (Account No.)">
                          <PillInput 
                            value={form.account_number} 
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 15);
                              setForm({...form, account_number: val});
                            }} 
                            placeholder="ตัวเลขเท่านั้น..."
                            className="w-full h-9 px-6 rounded-full font-mono text-cyan-400 text-[16px] bg-white/[0.02]" 
                          />
                        </Field>
                        <Field label="ชื่อบัญชี * (Account Name)">
                          <PillInput value={form.account_name} onChange={(e) => setForm({...form, account_name: e.target.value})} placeholder="ระบุชื่อบัญชี..." className="w-full h-9 px-6 rounded-full bg-white/[0.02]" />
                        </Field>
                      </div>
                    </div>
                  )}

                  {form.payment_method === "CHEQUE" && (
                    <div className="space-y-6 animate-in fade-in duration-300 bg-white/[0.02] p-8 rounded-3xl border border-white/5">
                      <Field label="เอกสารที่ต้องเตรียมมารับเช็ค *">
                        <PillInput 
                          value={form.cheque_documents} 
                          onChange={(e) => setForm({...form, cheque_documents: e.target.value})} 
                          placeholder="เช่น ใบเสนอราคาจริง, สำเนาหนังสือรับรองบริษัท, ใบมอบอำนาจ..." 
                          className="w-full h-9 px-6 rounded-full bg-white/[0.02]" 
                        />
                      </Field>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Field label="วันที่รับเช็คได้ *">
                          <PillInput 
                            value={form.cheque_pickup_day} 
                            onChange={(e) => setForm({...form, cheque_pickup_day: e.target.value})} 
                            placeholder="เช่น ทุกวันศุกร์ หรือ ทุกวันที่ 25 ของเดือน..." 
                            className="w-full h-9 px-6 rounded-full bg-white/[0.02]" 
                          />
                        </Field>
                        <Field label="ช่วงเวลาที่รับเช็คได้ *">
                          <PillInput 
                            value={form.cheque_pickup_time} 
                            onChange={(e) => setForm({...form, cheque_pickup_time: e.target.value})} 
                            placeholder="เช่น 09:00 - 12:00 หรือ 13:00 - 16:00..." 
                            className="w-full h-9 px-6 rounded-full bg-white/[0.02]" 
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  {form.payment_method === "CASH" && (
                    <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 text-center text-white/50 text-[13px] font-bold uppercase tracking-widest animate-in fade-in duration-300">
                       ชำระเงินสดหน้าร้านหรือตามตกลง (ไม่ต้องระบุเอกสารเพิ่มเติม)
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <GlassCard className="p-6 border-white/5 bg-[#111111] shadow-2xl space-y-6 sticky top-0 relative overflow-hidden rounded-3xl">
      {isLocked && (
        <PillButton onClick={() => setIsLocked(false)} className="w-full h-9 px-6 rounded-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30 text-[12px] font-black uppercase tracking-widest">
          <Edit3 size={16} className="mr-2" /> แก้ไขข้อมูล
        </PillButton>
      )}

      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6 relative overflow-hidden group relative z-10">
        <div className="flex justify-between items-center border-b border-white/5 pb-4 relative z-10">
          <h4 className="text-[11px] font-black text-white/40 uppercase tracking-widest">นโยบายการจัดซื้อ</h4>
          <Target size={16} className="text-nexus-blue animate-pulse" />
        </div>
        <div className="space-y-6 relative z-10">
          <Field label="เครดิตเทอม (Credit Term)">
            <PillSelect value={form.payment_term} onChange={(e) => setForm({...form, payment_term: e.target.value})} className="w-full h-9 px-6 rounded-full bg-white/[0.03] font-bold text-[12px]">
              <option>Cash</option>
              <option>7 Days</option>
              <option>15 Days</option>
              <option>30 Days</option>
              <option>60 Days</option>
            </PillSelect>
          </Field>
          <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 flex flex-col items-center gap-3">
             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Supplier Rating</span>
             <div className="flex gap-1 text-warning">
                {[1,2,3,4,5].map(i => <Star key={i} size={16} fill={i <= form.rating ? "currentColor" : "none"} />)}
             </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-blue/10 blur-[50px] -translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="space-y-3 pt-4 relative z-10">
        <PillButton 
          className="w-full h-9 px-6 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-black uppercase tracking-widest text-[12px]" 
          onClick={handleCommit} 
          disabled={isSubmitting || isLocked}
          title="บันทึกข้อมูล"
        >
          {isSubmitting ? <RefreshCw className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-2" />}
          บันทึกข้อมูลคู่ค้า
        </PillButton>
        <PillButton variant="glass" className="w-full h-9 rounded-full uppercase tracking-widest text-[11px] text-white/40 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
      </div>
      
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
    </GlassCard>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
        <span className="flex items-center">
          {thaiText}
          {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        </span>
        {engText && <span className="text-white/40 font-normal uppercase tracking-widest text-[10px]">{engText}</span>}
      </label>
      {children}
    </div>
  );
}
