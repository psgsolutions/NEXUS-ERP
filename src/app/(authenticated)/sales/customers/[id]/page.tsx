"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Building2, Calendar, Percent, Plus } from "lucide-react";
import { PillButton, PillInput, PillSelect, cn, NexusDatePicker } from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { formatCurrency } from "@/lib/erp-logic";

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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans relative pb-24">
      
      {/* Top Navigation / Action Bar */}
      <div className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-all">
               <ArrowLeft size={20} />
            </button>
            <div>
               <p className="text-[10px] font-black text-nexus-teal uppercase tracking-widest mb-1">สร้างเอกสารใหม่</p>
               <h1 className="text-xl font-black uppercase tracking-tight">ข้อมูลลูกค้า (Customer Profile)</h1>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <PillButton variant="ghost" className="text-white/50 hover:text-white">
               ยกเลิก
            </PillButton>
            <PillButton className="bg-white/5 border-white/10 hover:bg-white/10">
               <Save size={16} /> บันทึกร่าง
            </PillButton>
            <PillButton className="bg-nexus-teal text-black hover:bg-nexus-teal/90 shadow-[0_0_20px_rgba(45,212,191,0.2)]">
               <Send size={16} /> บันทึกและอนุมัติ
            </PillButton>
         </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 px-4 py-6 w-full max-w-[1800px] mx-auto">
         <div className="flex-1 space-y-4">
         
         {/* Document Flow Tracker */}
         

         {/* Customer and Dates */}
         <div className="flex flex-col gap-4">
            {/* Customer Column */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-white/40 flex items-center gap-2 border-b border-white/5 pb-4">
                  <Building2 size={16} /> ข้อมูลลูกค้า
               </h3>
               
               <div className="space-y-4 relative">
                  <label className="text-[11px] font-black uppercase tracking-widest text-white/30">ชื่อลูกค้า *</label>
                  
                  {/* Smart Dropdown Mockup */}
                  <div className="relative">
                     <div 
                        onClick={() => setIsCustomerSelectorOpen(!isCustomerSelectorOpen)}
                        className="w-full h-12 bg-[#0D0D0D] border border-white/10 rounded-xl px-4 flex items-center justify-between cursor-pointer hover:border-nexus-teal/50 transition-all group"
                     >
                        <span className={cn("text-sm font-bold", customer ? "text-white" : "text-white/30")}>
                           {customer ? customer.name : "พิมพ์เพื่อค้นหาผู้ติดต่อ หรือสร้างผู้ติดต่อใหม่"}
                        </span>
                        <Plus size={16} className="text-white/30 group-hover:text-nexus-teal transition-all" />
                     </div>
                     
                     {isCustomerSelectorOpen && (
                        <div className="absolute top-14 left-0 w-full bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl p-2 z-50">
                           {MOCK_CUSTOMERS.map(c => (
                              <div 
                                 key={c.id} 
                                 onClick={() => { setSelectedCustomer(c.id); setIsCustomerSelectorOpen(false); }}
                                 className="p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all"
                              >
                                 <p className="text-sm font-bold text-white">{c.name}</p>
                                 <p className="text-[10px] text-white/30 mt-1">{c.taxId} • {c.address}</p>
                              </div>
                           ))}
                           <div className="p-3 mt-2 border-t border-white/5 hover:bg-nexus-teal/10 rounded-lg cursor-pointer text-nexus-teal flex items-center gap-2">
                              <Plus size={14} /> <span className="text-sm font-bold">เพิ่มลูกค้าใหม่...</span>
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-2">
                     <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-white/30">ที่อยู่</label>
                        <p className="text-sm text-white/60 min-h-[40px] leading-relaxed">{customer?.address || "-"}</p>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-white/30">เลขประจำตัวผู้เสียภาษี</label>
                        <p className="text-sm text-white/60">{customer?.taxId || "-"}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Dates & Tax Column */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/40 flex items-center gap-2 border-b border-white/5 pb-4">
                     <Calendar size={16} /> วันที่เอกสาร
                  </h3>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-white/30">วันที่ออก</label>
                        <NexusDatePicker value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full bg-[#0D0D0D]" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-white/30">วันที่ใช้ได้ถึง</label>
                        <NexusDatePicker value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full bg-[#0D0D0D]" />
                     </div>
                  </div>
               </div>
               
               <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/40 flex items-center gap-2 border-b border-white/5 pb-4">
                     <Percent size={16} /> ข้อมูลราคาและภาษี
                  </h3>
                  <div className="space-y-2">
                     <label className="text-[11px] font-black uppercase tracking-widest text-white/30">ประเภทราคา</label>
                     <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value)} className="w-full bg-[#0D0D0D]">
                        <option value="exclusive">แยกภาษี (Exclusive)</option>
                        <option value="inclusive">รวมภาษี (Inclusive)</option>
                        <option value="none">ไม่มีภาษี</option>
                     </PillSelect>
                  </div>
               </div>
               </div>
            </div>

            {/* Line Items Table */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-white/40 flex items-center gap-2 border-b border-white/5 pb-4">
                  รายการสินค้า / บริการ
               </h3>
               
               <DocumentItemsTable 
                  items={items} 
                  onChange={setItems} 
               />
            </div>
         </div> {/* This closes flex-1 */}

         {/* Summary Section (Sticky Right) */}
         <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4 h-fit">
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4 w-full">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40 font-bold">มูลค่ารวมก่อนภาษี (Subtotal)</span>
                  <span className="text-white font-mono">{formatCurrency(summary.subtotal)} บาท</span>
               </div>
               {summary.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-nexus-teal/70 font-bold">ส่วนลดรวม (Total Discount)</span>
                     <span className="text-nexus-teal font-mono">-{formatCurrency(summary.discount)} บาท</span>
                  </div>
               )}
               {taxType !== "none" && (
                  <div className="flex justify-between items-center text-sm border-t border-white/5 pt-4">
                     <span className="text-white/40 font-bold">มูลค่าก่อนภาษี (Pre-VAT)</span>
                     <span className="text-white font-mono">{formatCurrency(summary.preVat)} บาท</span>
                  </div>
               )}
               {taxType !== "none" && (
                  <div className="flex justify-between items-center text-sm pb-4 border-b border-white/5">
                     <span className="text-white/40 font-bold">ภาษีมูลค่าเพิ่ม 7% (VAT)</span>
                     <span className="text-white font-mono">{formatCurrency(summary.vat)} บาท</span>
                  </div>
               )}
               <div className="flex justify-between items-end pt-4">
                  <span className="text-base font-black text-white/70 uppercase tracking-widest">จำนวนเงินทั้งสิ้น</span>
                  <span className="text-3xl font-black text-nexus-teal font-mono tracking-tighter">
                     {formatCurrency(summary.grandTotal)} <span className="text-lg">THB</span>
                  </span>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}