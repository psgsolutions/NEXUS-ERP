"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  X, CheckCircle2, Truck, Building2, 
  MapPin, Phone, Mail, Info, RefreshCw,
  CreditCard, Activity, ShoppingCart, Tag,
  Landmark, Star, Lock, Unlock, Edit3, Package, Layers,
  ChevronRight, Zap, Target
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
import { formatCurrency } from "@/lib/erp-logic";
import { useSystemDialog } from "@/context/DialogContext";

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

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
  "ธนาคารกสิกรไทย (KBANK)",
  "ธนาคารไทยพาณิชย์ (SCB)",
  "ธนาคารกรุงเทพ (BBL)",
  "ธนาคารกรุงไทย (KTB)",
  "ธนาคารทหารไทยธนชาต (TTB)"
];

export function SupplierModal({ isOpen, onClose, onSave, initialData }: SupplierModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("profile");
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
      setActiveTab("profile");
    }
  }, [isOpen, initialData]);

  const tabs = [
    { id: "profile", label: "ข้อมูลทั่วไป (PROFILE)", icon: <Building2 /> },
    { id: "bank", label: "บัญชีธนาคาร (FINANCIAL)", icon: <Landmark /> }
  ];

  const handleCommit = async () => {
    // 1. Validate all fields (ให้เช็คการบันทึกทุกช่อง)
    if (!form.name.trim()) return void showAlert("กรุณาระบุชื่อคู่ค้า");
    
    // Tax ID check: Only digits, exactly 13 characters
    if (!form.tax_id) return void showAlert("กรุณาระบุเลขประจำตัวผู้เสียภาษี (Tax ID)");
    if (form.tax_id.length !== 13) return void showAlert("เลขประจำตัวผู้เสียภาษี (Tax ID) ต้องมีครบ 13 หลักตามกฎหมายกำหนด");
    if (!/^\d{13}$/.test(form.tax_id)) return void showAlert("เลขประจำตัวผู้เสียภาษี (Tax ID) ต้องเป็นตัวเลขเท่านั้น");

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
      subDistrict: addr.subDistrict, 
      district: addr.district, 
      province: addr.province, 
      zipCode: addr.zipCode 
    }));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="คู่ค้า"
      maxWidth="max-w-[1300px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        {/* INPUT CANVAS */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]" title="ระบบบริหารคู่ค้า">SUPPLIER</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">คู่ค้า</h4>
              </div>
              <PillTabs 
                tabs={[
                  { id: "profile", label: "ข้อมูลทั่วไป", icon: <Building2 /> },
                  { id: "bank", label: "ข้อมูลการเงิน", icon: <Landmark /> }
                ]} 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
              />
            </div>

            <div className={cn("space-y-10 transition-all duration-500", isLocked && "opacity-60 pointer-events-none grayscale-[0.5]")}>
              {activeTab === "profile" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                  <section className="space-y-6">
                    <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><Zap size={16} /> ข้อมูลทั่วไป</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Field label="ชื่อคู่ค้า *">
                        <PillInput value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="ระบุชื่อเต็ม..." className="w-full" />
                      </Field>
                      <Field label="TAX ID *">
                        <PillInput 
                          value={form.tax_id} 
                          onChange={(e) => {
                            const numericVal = e.target.value.replace(/[^0-9]/g, "").slice(0, 13);
                            setForm({...form, tax_id: numericVal});
                          }} 
                          placeholder="13 หลัก (ตัวเลขเท่านั้น)..." 
                          className="w-full font-mono text-nexus-teal" 
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="space-y-6 pt-6 border-t border-white/5">
                    <h3 className="text-[12px] font-black text-white/40 uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><MapPin size={16} /> พิกัดและการติดต่อ</h3>
                    <SmartAddressPicker onSelect={handleSmartAddress} />
                    <div className="grid grid-cols-2 gap-8 mt-6">
                      <Field label="จังหวัด">
                        <PillInput value={form.province} readOnly className="w-full opacity-60" />
                      </Field>
                      <Field label="รหัสไปรษณีย์">
                        <PillInput value={form.zipCode} readOnly className="w-full opacity-60" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <Field label="เบอร์โทรศัพท์ *">
                        <PillInput 
                          value={form.phone} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                            setForm({...form, phone: val});
                          }} 
                          placeholder="08XXXXXXXX (ตัวเลขเท่านั้น)..."
                          className="w-full font-mono text-nexus-teal" 
                        />
                      </Field>
                      <Field label="อีเมล">
                        <PillInput value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full" />
                      </Field>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "bank" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                  <section className="space-y-6">
                    <h3 className="text-[12px] font-black text-warning uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><Landmark size={16} /> วิธีการชำระเงินและข้อมูลการเงิน</h3>
                    <div className="grid grid-cols-1 gap-8">
                      <Field label="วิธีการรับเงิน / ชำระเงิน *">
                        <PillSelect value={form.payment_method} onChange={(e) => setForm({...form, payment_method: e.target.value})} className="w-full font-black text-nexus-teal">
                          <option value="TRANSFER">โอนเงินผ่านบัญชีธนาคาร (Bank Transfer)</option>
                          <option value="CHEQUE">รับด้วยเช็ค (Cheque Collection)</option>
                          <option value="CASH">ชำระด้วยเงินสด (Cash Payment)</option>
                        </PillSelect>
                      </Field>

                      {form.payment_method === "TRANSFER" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <Field label="ธนาคาร *">
                            <PillSelect value={form.bank_name} onChange={(e) => setForm({...form, bank_name: e.target.value})} className="w-full">
                              <option value="">เลือกธนาคาร...</option>
                              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </PillSelect>
                          </Field>
                          <div className="grid grid-cols-2 gap-8">
                            <Field label="เลขที่บัญชี *">
                              <PillInput 
                                value={form.account_number} 
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 15);
                                  setForm({...form, account_number: val});
                                }} 
                                placeholder="ตัวเลขเท่านั้น..."
                                className="w-full font-mono text-nexus-teal" 
                              />
                            </Field>
                            <Field label="ชื่อบัญชี *">
                              <PillInput value={form.account_name} onChange={(e) => setForm({...form, account_name: e.target.value})} placeholder="ระบุชื่อบัญชี..." className="w-full" />
                            </Field>
                          </div>
                        </div>
                      )}

                      {form.payment_method === "CHEQUE" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <Field label="เอกสารที่ต้องเตรียมมารับเช็ค *">
                            <PillInput 
                              value={form.cheque_documents} 
                              onChange={(e) => setForm({...form, cheque_documents: e.target.value})} 
                              placeholder="เช่น ใบเสนอราคาจริง, สำเนาหนังสือรับรองบริษัท, ใบมอบอำนาจ..." 
                              className="w-full" 
                            />
                          </Field>
                          <div className="grid grid-cols-2 gap-8">
                            <Field label="วันที่รับเช็คได้ *">
                              <PillInput 
                                value={form.cheque_pickup_day} 
                                onChange={(e) => setForm({...form, cheque_pickup_day: e.target.value})} 
                                placeholder="เช่น ทุกวันศุกร์ หรือ ทุกวันที่ 25 ของเดือน..." 
                                className="w-full" 
                              />
                            </Field>
                            <Field label="ช่วงเวลาที่รับเช็คได้ *">
                              <PillInput 
                                value={form.cheque_pickup_time} 
                                onChange={(e) => setForm({...form, cheque_pickup_time: e.target.value})} 
                                placeholder="เช่น 09:00 - 12:00 หรือ 13:00 - 16:00..." 
                                className="w-full" 
                              />
                            </Field>
                          </div>
                        </div>
                      )}

                      {form.payment_method === "CASH" && (
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-white/50 text-xs italic animate-in fade-in duration-300">
                           ชำระเงินสดหน้าร้านหรือตามตกลง (ไม่ต้องระบุเอกสารเพิ่มเติม)
                        </div>
                      )}
                    </div>
                  </section>
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
                <Edit3 size={18} /> แก้ไขข้อมูล
              </PillButton>
            )}

            <div className="p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 space-y-8 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h4 className="text-[11px] font-black text-white/40 uppercase tracking-widest">นโยบายการจัดซื้อ</h4>
                <Target size={18} className="text-nexus-blue animate-pulse" />
              </div>
              <div className="space-y-6">
                <Field label="เครดิตเทอม">
                  <PillSelect value={form.payment_term} onChange={(e) => setForm({...form, payment_term: e.target.value})} className="w-full">
                    <option>Cash</option>
                    <option>7 Days</option>
                    <option>15 Days</option>
                    <option>30 Days</option>
                    <option>60 Days</option>
                  </PillSelect>
                </Field>
                <div className="p-5 bg-white/[0.02] rounded-[2rem] border border-white/5 flex flex-col items-center gap-2">
                   <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Supplier Rating</span>
                   <div className="flex gap-1 text-warning">
                      {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={i <= form.rating ? "currentColor" : "none"} />)}
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-white/5">
            <PillButton 
              className="w-full shadow-neon-teal uppercase tracking-[0.2em]" 
              onClick={handleCommit} 
              disabled={isSubmitting || isLocked}
              title="บันทึกข้อมูล"
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
