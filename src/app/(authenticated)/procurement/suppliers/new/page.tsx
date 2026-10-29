"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  X, CheckCircle2, Truck, Building2, 
  MapPin, Phone, Mail, Info, RefreshCw,
  CreditCard, Activity, ShoppingCart, Tag,
  Landmark, Star, Lock, Unlock, Edit3, Package, Layers,
  ChevronRight, Zap, Target, ArrowLeft, Users, Wrench, Trash2, Plus
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
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import NexusPageLayout from "@/components/layout/NexusPageLayout";

interface LaborRateItem {
  id: string;
  itemCode?: string;
  serviceType: string;
  unit: string;
  ratePerUnit: number;           // ต้นทุนจ่ายช่าง (Subcontractor Cost Rate)
  standardSellingPrice?: number;  // ราคาเสนอขายลูกค้า (Selling Price to Client)
  remarks?: string;
}

const INITIAL_FORM = {
  name: "",
  entity_category: "TEAM" as "TEAM" | "COMPANY" | "STORE", // ทีมช่าง | บริษัท | ห้าง/ร้าน
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
  business_type: "SERVICE",
  bank_name: "",
  account_number: "",
  account_name: "",
  payment_method: "TRANSFER", // TRANSFER, CHEQUE, CASH
  cheque_documents: "",
  cheque_pickup_day: "",
  cheque_pickup_time: "",
  rating: 5,
  labor_rates: [] as LaborRateItem[]
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

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
    // 1. Validate fields
    if (!form.name.trim()) return void showAlert("กรุณาระบุชื่อช่าง/ทีมช่าง/นิติบุคคล");
    
    // Tax ID / National ID check: Only digits, exactly 13 characters
    if (!form.tax_id) return void showAlert("กรุณาระบุเลขประจำตัวประชาชนหรือเลขประจำตัวผู้เสียภาษี");
    if (form.tax_id.length !== 13) return void showAlert("เลขประจำตัวต้องมีครบ 13 หลักตามกฎหมายกำหนด");
    if (!/^\d{13}$/.test(form.tax_id)) return void showAlert("เลขประจำตัวต้องเป็นตัวเลข 13 หลักเท่านั้น");

    // Contact info check
    if (!form.phone.trim()) return void showAlert("กรุณาระบุเบอร์โทรศัพท์ติดต่อ");
    if (!/^\d{9,10}$/.test(form.phone.replace(/[-+\s]/g, ""))) return void showAlert("เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลัก)");

    // Address check
    if (!form.province || !form.zipCode) {
      return void showAlert("กรุณาค้นหาที่อยู่ผ่าน Smart Address Picker และระบุให้ครบถ้วน");
    }

    // Financial check based on payment method
    if (form.payment_method === "TRANSFER") {
      if (!form.bank_name) return void showAlert("กรุณาเลือกธนาคาร");
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

      const categoryLabel = form.entity_category === "TEAM" ? "ทีมช่าง" : form.entity_category === "COMPANY" ? "บริษัท" : "ห้าง/ร้าน";
      const payload = {
        ...form,
        category: categoryLabel,
        contractor_type: form.entity_category,
        taxId: form.tax_id,
        status: "active",
        isActive: true
      };

      // บันทึกผ่าน API: ผู้ขายและผู้รับเหมาใช้รหัสเดียวกัน (ตรวจเลขผู้เสียภาษีซ้ำในเครือ)
      const createParty = async (entity: "suppliers" | "contractors", id?: string) => {
        const res = await apiFetch("/api/master-data", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: currentCompanyId, action: "create", entity, ...(id ? { id } : {}), data: payload }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.error || "บันทึกข้อมูลไม่สำเร็จ");
        return d.id as string;
      };
      const supplierRef = { id: await createParty("suppliers") };
      await createParty("contractors", supplierRef.id);

      // Save labor wage rates to subcontractor_rates AND products collections for seamless integration with Quotation & BOQ
      if (form.labor_rates && form.labor_rates.length > 0) {
        for (const rate of form.labor_rates) {
          if (rate.serviceType && rate.ratePerUnit > 0) {
            const costVal = Number(rate.ratePerUnit);
            const sellVal = Number(rate.standardSellingPrice || rate.ratePerUnit * 1.3); // Default 30% margin if unspecified
            const itemCode = rate.itemCode || `SRV-${Math.floor(1000 + Math.random() * 9000)}`;

            // 1. Subcontractor Rate record
            const rateRes = await apiFetch("/api/procurement/subcontractor-rates", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyId: currentCompanyId, action: "create", rate: {
                subcontractorId: supplierRef.id, subcontractorName: form.name, itemCode, serviceType: rate.serviceType,
                unit: rate.unit || "จุด", ratePerUnit: costVal, standardSellingPrice: sellVal, remarks: rate.remarks || "",
              } }),
            });
            const savedRate = await rateRes.json().catch(() => ({}));
            if (!rateRes.ok || !savedRate.success) throw new Error(savedRate.error || `บันทึกอัตราค่าแรง ${rate.serviceType} ไม่สำเร็จ`);

            // 2. Service Item Catalog record in products (searchable in Quotation & Project BOQ)
            const productData = {
              sku: itemCode,
              name: `[ค่าแรง] ${rate.serviceType} (${form.name})`,
              category: "SERVICES",
              type: "SERVICE",
              unit: rate.unit || "จุด",
              costPrice: costVal,               // ต้นทุนจ่ายช่าง
              price: sellVal,                   // ราคาขายเสนอสั่งซื้อ/เสนอราคา
              sellingPrice: sellVal,
              subcontractorId: supplierRef.id,
              subcontractorName: form.name,
              whtRate: 3,                       // หัก ณ ที่จ่าย 3% สำหรับบริการ
              isActive: true,
              itemType: "SERVICE",
            };

            const res = await apiFetch("/api/master-data", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyId: currentCompanyId, action: "create", entity: "products", data: productData }),
            });
            const created = await res.json();
            if (!res.ok || !created.success) throw new Error(created.error || `สร้างรายการค่าแรง ${itemCode} ไม่สำเร็จ`);
          }
        }
      }

      await auditService.logCreate(user.uid, currentCompanyId, "TECHNICIAN_CONTRACTOR", "NEW", payload);
      
      showAlert("บันทึกข้อมูลช่างและอัตราค่าแรงเรียบร้อยแล้ว", "แจ้งเตือน", "info");
      router.back();
    } catch (err: any) {
      console.error(err);
      showAlert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, "แจ้งเตือน", "error");
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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              ทะเบียนช่างและผู้รับเหมา
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              SUB-CONTRACT
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ลงทะเบียนข้อมูลช่าง ผู้รับเหมาช่วง คู่ค้า และข้อมูลความเชี่ยวชาญ
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" onClick={handleBack} className="h-8 px-4 text-xs font-bold text-white/50">
          ยกเลิก
        </PillButton>
        <PillButton variant="save" onClick={handleCommit} disabled={isSubmitting} className="h-8 px-5 text-xs font-bold">
          {isSubmitting ? <RefreshCw className="animate-spin mr-1.5" size={14} /> : <CheckCircle2 size={14} className="mr-1.5" />}
          บันทึกข้อมูลช่าง
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-7 pr-2 pb-10">
      
      {/* 1. การ์ดข้อมูลทั่วไป */}
      <GlassCard accentColor="teal" className="p-0 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 font-mono font-black text-xs shadow-sm">
              01
            </span>
            <div className="flex items-center gap-2 text-nexus-teal">
              <Building2 size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                ข้อมูลทั่วไป
              </h3>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          <Field label="ประเภทสถานประกอบการ / ช่าง * (Entity Category)">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <button
                type="button"
                onClick={() => setForm({ ...form, entity_category: "TEAM" })}
                className={cn(
                  "h-9 px-4 rounded-full text-xs font-bold transition-all border flex items-center justify-center gap-2",
                  form.entity_category === "TEAM" 
                    ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/40 backdrop-blur-md shadow-neon-teal" 
                    : "bg-white/[0.02] text-white/50 border-white/10 hover:bg-white/[0.05]"
                )}
              >
                <Users size={14} /> ทีมช่าง / ช่างอิสระ
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, entity_category: "COMPANY" })}
                className={cn(
                  "h-9 px-4 rounded-full text-xs font-bold transition-all border flex items-center justify-center gap-2",
                  form.entity_category === "COMPANY" 
                    ? "bg-nexus-blue/20 text-nexus-blue border-nexus-blue/40 backdrop-blur-md shadow-neon-blue" 
                    : "bg-white/[0.02] text-white/50 border-white/10 hover:bg-white/[0.05]"
                )}
              >
                <Building2 size={14} /> บริษัท
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, entity_category: "STORE" })}
                className={cn(
                  "h-9 px-4 rounded-full text-xs font-bold transition-all border flex items-center justify-center gap-2",
                  form.entity_category === "STORE" 
                    ? "bg-purple-500/20 text-purple-400 border-purple-500/40 backdrop-blur-md" 
                    : "bg-white/[0.02] text-white/50 border-white/10 hover:bg-white/[0.05]"
                )}
              >
                <Package size={14} /> ห้าง / ร้าน
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="ชื่อช่าง / บริษัท / ห้างร้าน * (Name)">
              <PillInput value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="ระบุชื่อทีมช่าง หรือชื่อนิติบุคคลเต็ม..." className="w-full h-9 rounded-full bg-white/[0.02] px-6" />
            </Field>
            <Field label={form.entity_category === "TEAM" ? "เลขประจำตัวประชาชน/ผู้เสียภาษี * (ID / Tax ID)" : "เลขประจำตัวผู้เสียภาษี * (Corporate Tax ID)"}>
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

          <section className="space-y-6 pt-6 border-t border-white/5">
            <h4 className="text-[13px] font-semibold text-white/80 uppercase flex items-center gap-2 border-b border-white/5 pb-3">
              <MapPin size={16} /> พิกัดและการติดต่อ
            </h4>
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
                  className="w-full h-9 rounded-full font-mono text-cyan-400 bg-white/[0.02]" 
                />
              </Field>
              <Field label="อีเมล (Email)">
                <PillInput value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full h-9 rounded-full bg-white/[0.02]" placeholder="example@domain.com" />
              </Field>
            </div>
          </section>
        </div>
      </GlassCard>

      {/* 2. การ์ดรายการราคาค่าแรง */}
      <GlassCard accentColor="blue" className="p-0 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 font-mono font-black text-xs shadow-sm">
              02
            </span>
            <div className="flex items-center gap-2 text-nexus-blue">
              <Wrench size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                ราคาค่าแรง
              </h3>
            </div>
          </div>
          <PillButton 
            variant="glass" 
            type="button"
            onClick={() => {
              setForm(prev => ({
                ...prev,
                labor_rates: [
                  ...prev.labor_rates,
                  { id: `rate_${Date.now()}`, serviceType: "", unit: "จุด", ratePerUnit: 0, remarks: "" }
                ]
              }));
            }}
            className="h-8 text-nexus-blue border-nexus-blue/30 text-xs px-4"
          >
            <Plus size={14} className="mr-1" /> เพิ่มรายการค่าแรง
          </PillButton>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Quick Presets Bar */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">คำแนะนำรายการงานยอดนิยม (Quick Add Preset):</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { name: "งานติดตั้งสายสัญญาณ LAN CAT6", unit: "จุด", rate: 350 },
                { name: "งานติดตั้งกล้องวงจรปิด CCTV", unit: "จุด", rate: 500 },
                { name: "งานติดตั้ง Core Switch & Access Point", unit: "ชุด", rate: 1200 },
                { name: "งานเข้าหัวและสพลายส์สาย Fiber Optic", unit: "จุด", rate: 450 },
                { name: "งานซ่อมบำรุงและตรวจเช็คระบบรายวัน", unit: "วัน", rate: 1500 }
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({
                      ...prev,
                      labor_rates: [
                        ...prev.labor_rates,
                        { id: `preset_${Date.now()}_${idx}`, serviceType: preset.name, unit: preset.unit, ratePerUnit: preset.rate, remarks: "Preset" }
                      ]
                    }));
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 hover:border-nexus-blue/40 hover:bg-nexus-blue/10 text-xs font-bold text-white/70 hover:text-nexus-blue transition-all flex items-center gap-1.5"
                >
                  <Plus size={12} /> {preset.name} ({preset.rate} ฿/{preset.unit})
                </button>
              ))}
            </div>
          </div>

          {/* Rates Table / List */}
          {form.labor_rates.length === 0 ? (
            <div className="p-10 border border-dashed border-white/10 rounded-3xl text-center text-white/40 text-xs space-y-3">
              <Wrench size={32} className="mx-auto text-white/20" />
              <p>ยังไม่มีรายการอัตราค่าแรง สามารถคลิกปุ่มด้านบนหรือเลือกคำแนะนำด้านบนเพื่อเพิ่มรายการ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.labor_rates.map((rate, index) => (
                <div key={rate.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 hover:border-white/15 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-nexus-blue/10 text-nexus-blue border border-nexus-blue/30 font-mono text-[11px] font-bold">
                      #{index + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <PillInput
                          value={rate.serviceType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm(prev => ({
                              ...prev,
                              labor_rates: prev.labor_rates.map(r => r.id === rate.id ? { ...r, serviceType: val } : r)
                            }));
                          }}
                          placeholder="ชื่องาน/ประเภทงานบริการ..."
                          className="w-full h-8 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <PillInput
                          value={rate.unit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm(prev => ({
                              ...prev,
                              labor_rates: prev.labor_rates.map(r => r.id === rate.id ? { ...r, unit: val } : r)
                            }));
                          }}
                          placeholder="หน่วย (จุด, เมตร, วัน)..."
                          className="w-full h-8 text-xs font-bold text-center"
                        />
                      </div>
                      <div>
                        <PillInput
                          type="number"
                          value={rate.ratePerUnit || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setForm(prev => ({
                              ...prev,
                              labor_rates: prev.labor_rates.map(r => r.id === rate.id ? { ...r, ratePerUnit: val } : r)
                            }));
                          }}
                          placeholder="ต้นทุนจ่ายช่าง ฿"
                          title="ต้นทุนจ่ายช่าง (Cost Price)"
                          className="w-full h-8 text-xs font-bold font-mono text-right text-rose-400 bg-rose-500/5 border-rose-500/20"
                        />
                      </div>
                      <div>
                        <PillInput
                          type="number"
                          value={rate.standardSellingPrice || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setForm(prev => ({
                              ...prev,
                              labor_rates: prev.labor_rates.map(r => r.id === rate.id ? { ...r, standardSellingPrice: val } : r)
                            }));
                          }}
                          placeholder="ราคาขายลูกค้า ฿"
                          title="ราคาเสนอขายลูกค้า (Selling Price)"
                          className="w-full h-8 text-xs font-bold font-mono text-right text-emerald-400 bg-emerald-500/5 border-emerald-500/20"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          labor_rates: prev.labor_rates.filter(r => r.id !== rate.id)
                        }));
                      }}
                      className="p-1.5 text-white/30 hover:text-danger transition-colors shrink-0"
                      title="ลบรายการ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* 3. การ์ดข้อมูลการเงิน */}
      <GlassCard accentColor="purple" className="p-0 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 font-mono font-black text-xs shadow-sm">
              03
            </span>
            <div className="flex items-center gap-2 text-purple-400">
              <Landmark size={20} />
              <h3 className="text-base font-bold uppercase tracking-wider text-white">
                ข้อมูลการเงิน
              </h3>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          <Field label="วิธีการรับเงิน / ชำระเงิน * (Payment Method)">
            <PillSelect value={form.payment_method} onChange={(e) => setForm({...form, payment_method: e.target.value})} className="w-full h-9 px-6 rounded-full font-black text-purple-400 bg-white/[0.02] text-[13px]">
              <option value="TRANSFER">โอนเงินผ่านบัญชีธนาคาร</option>
              <option value="CHEQUE">รับด้วยเช็ค</option>
              <option value="CASH">ชำระด้วยเงินสด</option>
            </PillSelect>
          </Field>

          {form.payment_method === "TRANSFER" && (
            <div className="space-y-6 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
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
            <div className="space-y-6 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
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
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-center text-white/50 text-[13px] font-bold uppercase tracking-widest">
               ชำระเงินสดหน้าร้านหรือตามตกลง (ไม่ต้องระบุเอกสารเพิ่มเติม)
            </div>
          )}
        </div>
      </GlassCard>

    </div>
  );

  const rightSidebar = (
    <div className="p-4 xl:p-6 space-y-7">
      {/* 4. ตารางสรุป (Summary & Rating Panel Card) */}
      <GlassCard accentColor="emerald" className="p-0 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between bg-white/[0.04] border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-black text-xs shadow-sm">
              04
            </span>
            <div className="flex items-center gap-2 text-emerald-400">
              <Target size={20} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                ตารางสรุป
              </h3>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5 text-xs">
              <span className="text-white/40 font-bold uppercase tracking-widest">ประเภทช่าง:</span>
              <span className="text-nexus-teal font-bold font-mono">
                {form.entity_category === "TEAM" ? "ทีมช่าง/ช่างอิสระ" : form.entity_category === "COMPANY" ? "บริษัท" : "ห้าง/ร้าน"}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5 text-xs">
              <span className="text-white/40 font-bold uppercase tracking-widest">รายการค่าแรงที่ตั้ง:</span>
              <span className="text-nexus-blue font-bold font-mono">
                {form.labor_rates.length} รายการ
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5 text-xs">
              <span className="text-white/40 font-bold uppercase tracking-widest">การชำระเงิน:</span>
              <span className="text-purple-400 font-bold font-mono">
                {form.payment_method === "TRANSFER" ? "โอนเงิน" : form.payment_method === "CHEQUE" ? "เช็ค" : "เงินสด"}
              </span>
            </div>
          </div>

          <Field label="เครดิตเทอม (Credit Term)">
            <PillSelect value={form.payment_term} onChange={(e) => setForm({...form, payment_term: e.target.value})} className="w-full h-9 px-6 rounded-full bg-white/[0.03] font-bold text-[12px]">
              <option>Cash</option>
              <option>7 Days</option>
              <option>15 Days</option>
              <option>30 Days</option>
              <option>60 Days</option>
            </PillSelect>
          </Field>

          <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Technician Rating</span>
            <div className="flex gap-1 text-warning">
              {[1,2,3,4,5].map(i => <Star key={i} size={16} fill={i <= form.rating ? "currentColor" : "none"} />)}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
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

