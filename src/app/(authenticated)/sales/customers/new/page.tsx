"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Building2, Calendar, Percent, Plus } from "lucide-react";
import { PillButton, PillInput, PillSelect, cn, NexusDatePicker, GlassCard } from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

// Mock Data
const MOCK_CUSTOMERS = [
  { id: "C001", name: "บริษัท เอสซีจี แพคเกจจิ้ง จำกัด (มหาชน)", address: "1 ถ.ปูนซิเมนต์ไทย บางซื่อ กรุงเทพฯ 10800", taxId: "0107557000392" },
  { id: "C002", name: "บมจ. ซีพี ออลล์", address: "313 อาคาร ซี.พี.ทาวเวอร์ ชั้น 24 ถ.สีลม บางรัก กรุงเทพฯ 10500", taxId: "0107542000011" },
  { id: "C003", name: "บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน)", address: "414 พหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400", taxId: "0107535000265" }
];

const MOCK_PRODUCTS = [
  { id: "P01", name: "Nexus Pro Server Node", unitPrice: 45000, type: "hardware", unit: "Node" },
  { id: "P02", name: "Enterprise DB License (1 YR)", unitPrice: 120000, type: "software", unit: "License" },
  { id: "P03", name: "Implementation Service", unitPrice: 15000, type: "service", unit: "Man-Day" },
  { id: "P04", name: "Cloud Storage 10TB", unitPrice: 8500, type: "subscription", unit: "Month" }
];

export default function CustomerPage() {
  const router = useRouter();
  
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [taxType, setTaxType] = useState("exclusive");
  const [selectedCustomer, setSelectedCustomer] = useState(MOCK_CUSTOMERS[0].id);
  const [items, setItems] = useState<any[]>([]);
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);

  const customer = MOCK_CUSTOMERS.find(c => c.id === selectedCustomer);

  // Auto-calculated summary
  const summary = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const discount = items.reduce((acc, item) => acc + (item.discount || 0), 0);
    const afterDiscount = subtotal - discount;
    const vat = taxType !== "none" ? afterDiscount * 0.07 : 0;
    const grandTotal = taxType === "inclusive" ? afterDiscount : afterDiscount + vat;
    const preVat = taxType === "inclusive" ? grandTotal - vat : afterDiscount;

    return { subtotal, discount, preVat, vat, grandTotal };
  }, [items, taxType]);

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ข้อมูลลูกค้าใหม่</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              CRM-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">สร้างทะเบียนข้อมูลลูกค้า รายละเอียดผู้ติดต่อ และเงื่อนไขการค้า</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/80">
          <Save size={14} className="mr-1.5" /> บันทึกร่าง
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs">
          <Send size={14} className="mr-1.5" /> บันทึกและอนุมัติ
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-6 pr-2 pb-10">
      
      {/* Customer and Dates */}
      <div className="flex flex-col gap-6">
        {/* Customer Column */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-teal hover:border-white/25">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 h-[36px]">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
            <Building2 size={16} className="text-nexus-teal" /> ข้อมูลลูกค้า
          </h3>
          
          <div className="space-y-4 relative">
            <Field label="ชื่อลูกค้า *">
              
              {/* Smart Dropdown Mockup */}
              <div className="relative w-full">
                <div 
                  onClick={() => setIsCustomerSelectorOpen(!isCustomerSelectorOpen)}
                  className="w-full h-9 bg-white/[0.02] rounded-full px-6 flex items-center justify-between cursor-pointer hover:border-cyan-500/50 transition-all group"
                >
                  <span className={cn("text-[13px] font-bold", customer ? "text-white" : "text-white/30")}>
                    {customer ? customer.name : "พิมพ์เพื่อค้นหาผู้ติดต่อ หรือสร้างผู้ติดต่อใหม่"}
                  </span>
                  <Plus size={16} className="text-white/30 group-hover:text-cyan-400 transition-all" />
                </div>
                
                {isCustomerSelectorOpen && (
                  <div className="absolute top-11 left-0 w-full bg-surface-2 border border-white/10 rounded-xl shadow-2xl p-2 z-50">
                    {MOCK_CUSTOMERS.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedCustomer(c.id); setIsCustomerSelectorOpen(false); }}
                        className="p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all"
                      >
                        <p className="text-[13px] font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-white/30 mt-1 font-mono">{c.taxId} • <span className="font-sans">{c.address}</span></p>
                      </div>
                    ))}
                    <div className="p-3 mt-2 border-t border-white/5 hover:bg-cyan-500/10 rounded-lg cursor-pointer text-cyan-400 flex items-center gap-2">
                      <Plus size={14} /> <span className="text-[13px] font-bold">เพิ่มลูกค้าใหม่...</span>
                    </div>
                  </div>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">ที่อยู่</label>
                <p className="text-[13px] font-bold text-white/60 min-h-[40px] leading-relaxed">{customer?.address || "-"}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">เลขประจำตัวผู้เสียภาษี</label>
                <p className="text-[13px] font-bold font-mono text-white/60">{customer?.taxId || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dates & Tax Column */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-blue hover:border-white/25">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
              <Calendar size={16} className="text-nexus-blue" /> วันที่เอกสาร
            </h3>
            <div className="space-y-6">
              <Field label="วันที่ออก">
                <NexusDatePicker value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold" />
              </Field>
              <Field label="วันที่ใช้ได้ถึง">
                <NexusDatePicker value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold" />
              </Field>
            </div>
          </div>
          
          <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-purple-500 hover:border-white/25">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
              <Percent size={16} className="text-purple-400" /> ข้อมูลราคาและภาษี
            </h3>
            <Field label="ประเภทราคา">
              <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                <option value="exclusive">แยกภาษี (Exclusive)</option>
                <option value="inclusive">รวมภาษี (Inclusive)</option>
                <option value="none">ไม่มีภาษี</option>
              </PillSelect>
            </Field>
          </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
            รายการสินค้า / บริการ
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
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่ารวมก่อนภาษี (Subtotal)</span>
          <span className="text-white font-mono font-bold">{formatCurrency(summary.subtotal)} บาท</span>
        </div>
        {summary.discount > 0 && (
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-cyan-400/70 font-bold uppercase tracking-widest text-[11px]">ส่วนลดรวม (Total Discount)</span>
            <span className="text-cyan-400 font-mono font-bold">-{formatCurrency(summary.discount)} บาท</span>
          </div>
        )}
        {taxType !== "none" && (
          <div className="flex justify-between items-center text-[13px] border-t border-white/5 pt-4">
            <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่าก่อนภาษี (Pre-VAT)</span>
            <span className="text-white font-mono font-bold">{formatCurrency(summary.preVat)} บาท</span>
          </div>
        )}
        {taxType !== "none" && (
          <div className="flex justify-between items-center text-[13px] pb-4 border-b border-white/5">
            <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">ภาษีมูลค่าเพิ่ม 7% (VAT)</span>
            <span className="text-white font-mono font-bold">{formatCurrency(summary.vat)} บาท</span>
          </div>
        )}
        <div className="flex justify-between items-end pt-4">
          <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">จำนวนเงินทั้งสิ้น</span>
          <span className="text-3xl font-black text-cyan-400 font-mono tracking-tighter">
            {formatCurrency(summary.grandTotal)} <span className="text-[14px]">THB</span>
          </span>
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