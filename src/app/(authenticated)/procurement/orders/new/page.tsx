"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShoppingCart, 
  Truck, 
  Globe, 
  CreditCard, 
  FileText, 
  LayoutList,
  Package, 
  Briefcase, 
  Tag, 
  ArrowLeft,
  Lock,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect,
  CreatableCombobox, 
  PillTabs, 
  NexusDataField,
  NexusDatePicker,
  GlassCard,
  cn 
} from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { calculateFinancials, formatCurrency, POType, VatType } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

const ORDER_TYPES: { id: POType, label: string, icon: any }[] = [
  { id: 'STOCK', label: 'สต็อกพัสดุ', icon: <Package size={14} /> },
  { id: 'PROJECT', label: 'โครงการ', icon: <Briefcase size={14} /> },
  { id: 'CONSUMABLE', label: 'ของใช้บริษัท', icon: <Tag size={14} /> }
];

const INITIAL_FORM = {
  id: "",
  order_type: 'STOCK' as POType,
  project_id: "",
  department: "",
  supplier: "",
  reference: "",
  date: new Date().toISOString().split('T')[0],
  delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  vat_type: "Exclusive" as VatType,
  currency: "THB",
  exchange_rate: 1.0,
  incoterm: "EXW",
  incoterm_place: "",
  payment_term: "Net 30",
  shipping_method: "Road Freight",
  terms: "1. สินค้าต้องจัดส่งในสภาพสมบูรณ์และถูกต้องตามรุ่นที่สั่งซื้อ\n2. บรรจุภัณฑ์ต้องเหมาะสมกับการขนส่งเพื่อป้องกันการชำรุดเสียหาย\n3. กรุณาแนบใบกำกับภาษี/ใบส่งสินค้าและสำเนาใบสั่งซื้อมาพร้อมกับสินค้า"
};

function generatePONumber(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const sequence = Math.floor(1000 + Math.random() * 8999);
  return `PO-${yy}${mm}-${sequence}`;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("general");
  const [form, setForm] = useState(INITIAL_FORM);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    setForm(prev => ({ ...prev, id: generatePONumber() }));
  }, []);

  const financials = useMemo(() => {
    return calculateFinancials(items, form.vat_type);
  }, [items, form.vat_type]);

  const financialsTHB = useMemo(() => {
    if (form.currency === "THB") return financials;
    const rate = form.exchange_rate || 1.0;
    return {
      net: financials.net * rate,
      cost: financials.cost * rate,
      vat: financials.vat * rate,
      total: financials.total * rate,
      profit: financials.profit * rate,
      gpPercent: financials.gpPercent
    };
  }, [financials, form.currency, form.exchange_rate]);

  const handleBack = async () => {
    const isDirty = items.length > 0 || form.supplier !== "";
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (!form.supplier || items.length === 0) return void showAlert("กรุณาระบุคู่ค้าและรายการสั่งซื้อ");
    
    // Simulate save logic
    showAlert(`สร้างใบสั่งซื้อสำเร็จ (${form.id})`);
    router.push("/procurement");
  };

  const formatForeign = (val: number) => {
    if (form.currency === "THB") return formatCurrency(val);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: form.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val).replace(form.currency, `${form.currency} `);
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              บันทึกใบสั่งซื้อสินค้า
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              {form.id || "PO-NEW"}
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            ออกใบสั่งซื้อสินค้าและบริการ กำหนดเงื่อนไขการส่งมอบและการชำระเงิน
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" onClick={handleSave} className="h-8 px-5 font-bold text-xs">
          <CheckCircle2 size={14} className="mr-1.5" /> อนุมัติและออกใบสั่งซื้อ
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      {/* Header & Order Type */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <span className="px-4 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-[12px] font-mono font-black text-cyan-400 uppercase tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              {form.id || "PO-AUTO-GEN"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 p-1 bg-white/[0.02] rounded-full border border-white/5">
            {ORDER_TYPES.map(type => (
              <button 
                key={type.id}
                onClick={() => setForm({...form, order_type: type.id})}
                className={cn(
                  "h-9 px-6 rounded-full flex items-center gap-2 text-[11px] font-black uppercase transition-all border",
                  form.order_type === type.id 
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                    : "bg-transparent text-white/40 border-transparent hover:bg-white/5"
                )}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <Field label="ผู้จัดจำหน่าย *">
            <CreatableCombobox 
              value={form.supplier} 
              onChange={(val) => setForm({...form, supplier: val})} 
              className="w-full h-9 rounded-full bg-white/[0.02] border-white/10"
              options={[
                { value: "", label: "เลือกคู่ค้า..." },
                { value: "SUP-001", label: "Thai Equipment Co., Ltd." },
                { value: "SUP-002", label: "Global Tech Industries Inc." }
              ]}
              allowCustom={true}
            />
          </Field>

          <Field label="เลขอ้างอิง (REFERENCE NO.)">
            <PillInput 
              value={form.reference} 
              onChange={(e) => setForm({...form, reference: e.target.value})} 
              placeholder="PR No. / Quote No." 
              className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold" 
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {form.order_type === 'PROJECT' && (
            <Field label="โครงการที่อ้างอิง *">
              <PillSelect 
                value={form.project_id} 
                onChange={(e) => setForm({...form, project_id: e.target.value})} 
                className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
              >
                <option value="">เลือกโครงการ...</option>
                <option value="PRJ-2024-001">CCTV Upgrade - Gateway Mall</option>
                <option value="PRJ-2024-002">Network Infrastructure - Nexus Tower</option>
              </PillSelect>
            </Field>
          )}
          {form.order_type === 'CONSUMABLE' && (
            <Field label="แผนกที่ทำรายการเบิก *">
              <PillSelect 
                value={form.department} 
                onChange={(e) => setForm({...form, department: e.target.value})} 
                className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
              >
                <option value="">เลือกแผนก...</option>
                <option value="IT">IT Support</option>
                <option value="ADMIN">HR & Admin</option>
              </PillSelect>
            </Field>
          )}
          {form.order_type === 'STOCK' && (
            <Field label="คลังพัสดุปลายทาง">
              <PillInput 
                value="Main Warehouse (คลังส่วนกลาง)" 
                disabled
                readOnly
                className="w-full h-9 px-6 rounded-full bg-white/[0.01] border-cyan-500/20 text-cyan-400/60 cursor-not-allowed font-bold text-[13px]" 
              />
            </Field>
          )}
        </div>
      </div>

      {/* Dates & Logistics */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 h-[36px]">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 ">
            <Calendar size={16} /> วันที่เอกสาร
          </h3>
          <div className="space-y-4">
            <Field label="วันที่สั่งซื้อ *">
              <NexusDatePicker value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold" />
            </Field>
            <Field label="กำหนดส่งมอบ *">
              <NexusDatePicker value={form.delivery_date} onChange={(e) => setForm({...form, delivery_date: e.target.value})} className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold" />
            </Field>
          </div>
        </div>
        
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
            <Globe size={16} /> การค้าสากลและการเงิน
          </h3>
          <div className="space-y-4">
            <Field label="สกุลเงินชำระเงิน *">
              <PillSelect 
                value={form.currency} 
                onChange={(e) => {
                  const newCurrency = e.target.value;
                  let rate = 1.0;
                  if (newCurrency === "USD") rate = 36.50;
                  else if (newCurrency === "EUR") rate = 39.50;
                  else if (newCurrency === "JPY") rate = 0.235;
                  setForm({...form, currency: newCurrency, exchange_rate: rate});
                }} 
                className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
              >
                <option value="THB">THB - Thai Baht (฿)</option>
                <option value="USD">USD - US Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="JPY">JPY - Japanese Yen (ฅ)</option>
              </PillSelect>
            </Field>

            <Field label="อัตราแลกเปลี่ยนแปลงค่า ต่อ 1 หน่วย">
              <div className="relative w-full">
                <PillInput 
                  type="number"
                  step="0.0001"
                  disabled={form.currency === "THB"}
                  value={form.exchange_rate} 
                  onChange={(e) => setForm({...form, exchange_rate: parseFloat(e.target.value) || 0})} 
                  className="w-full h-9 px-6 pr-14 rounded-full bg-white/[0.02] border-white/10 font-mono font-bold text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white/60 uppercase">
                  THB
                </span>
              </div>
            </Field>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
          <FileText size={16} /> เงื่อนไขและภาษี
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <Field label="ประเภทภาษีมูลค่าเพิ่ม (VAT TYPE) *">
            <PillSelect 
              value={form.vat_type}
              onChange={(e) => setForm({...form, vat_type: e.target.value as VatType})}
              className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
            >
              <option value="Exclusive">แยกภาษี (Exclusive - 7%)</option>
              <option value="Inclusive">รวมภาษี (Inclusive - 7%)</option>
              <option value="Non-VAT">ไม่มีภาษี (Non-VAT)</option>
            </PillSelect>
          </Field>
          <Field label="การชำระเงิน *">
            <PillSelect 
              value={form.payment_term} 
              onChange={(e) => setForm({...form, payment_term: e.target.value})} 
              className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
            >
              <option value="Net 30">Net 30 Days</option>
              <option value="Advanced 100%">Advanced 100%</option>
            </PillSelect>
          </Field>
        </div>
      </div>

      {/* Smart Document Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
          <ShoppingCart size={16} /> รายการสินค้า / บริการ
        </h3>
          </div>
        
        <DocumentItemsTable 
          items={items}
          onChange={setItems}
        />
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-4 w-full">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่าก่อนภาษี</span>
          <span className="text-white font-mono font-bold tracking-tight text-right">{formatForeign(financials.net)}</span>
        </div>
        <div className="flex justify-between items-center text-[13px] pb-4 border-b border-white/5">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">ภาษีมูลค่าเพิ่ม 7%</span>
          <span className="text-white font-mono font-bold tracking-tight text-right">{formatForeign(financials.vat)}</span>
        </div>
        <div className="flex flex-col items-end pt-2 space-y-1">
          <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">ยอดสุทธิ</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-cyan-400 font-mono tracking-tighter text-right drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              {formatForeign(financials.total)}
            </span>
          </div>
        </div>
        
        {form.currency !== "THB" && (
          <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-4">
            <span className="text-[10px] text-cyan-400/60 font-semibold uppercase tracking-widest">Equivalent (THB)</span>
            <span className="text-[13px] font-mono font-bold text-cyan-400 text-right">{formatCurrency(financialsTHB.total)}</span>
          </div>
        )}
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
  let cleanLabel = label.replace('*', '').trim();
  let hasAsterisk = required || label.includes('*');
  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex items-center">
        {cleanLabel.split(' (')[0]}
        {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        {cleanLabel.includes(' (') && (
          <span className="text-white/40 ml-1 font-normal uppercase tracking-widest text-[10px]">
            ({cleanLabel.split(' (')[1]}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
