"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Building2, Calendar, Percent, Plus, Sparkles, MapPin, Paperclip, File as FileIcon, Trash2, AlertTriangle, Briefcase, ShieldCheck } from "lucide-react";
import { PillButton, PillSelect, cn, NexusDatePicker, GlassCard, PillInput } from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

// Mock Data
const MOCK_CUSTOMERS = [
  { id: "C001", name: "บริษัท เอสซีจี แพคเกจจิ้ง จำกัด (มหาชน)", address: "1 ถ.ปูนซิเมนต์ไทย บางซื่อ กรุงเทพฯ 10800", taxId: "0107557000392", creditLimit: 5000000, currentBalance: 3200000 },
  { id: "C002", name: "บมจ. ซีพี ออลล์", address: "313 อาคาร ซี.พี.ทาวเวอร์ ชั้น 24 ถ.สีลม บางรัก กรุงเทพฯ 10500", taxId: "0107542000011", creditLimit: 2000000, currentBalance: 1950000 },
  { id: "C003", name: "บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน)", address: "414 พหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400", taxId: "0107535000265", creditLimit: 10000000, currentBalance: 1500000 }
];

const MOCK_SITES: Record<string, { id: string, name: string, address: string, branchCode: string }[]> = {
  "C001": [
    { id: "S1", name: "สำนักงานใหญ่ (บางซื่อ)", address: "1 ถ.ปูนซิเมนต์ไทย บางซื่อ กรุงเทพฯ 10800", branchCode: "00000" },
    { id: "S2", name: "สาขาระยอง (โรงงาน)", address: "1 ถ.ปูนซิเมนต์ไทยระยอง ต.ท่าประดู่ อ.เมือง จ.ระยอง 21000", branchCode: "00001" }
  ],
  "C002": [
    { id: "S3", name: "สำนักงานใหญ่ (สีลม)", address: "313 อาคาร ซี.พี.ทาวเวอร์ ชั้น 24 ถ.สีลม บางรัก กรุงเทพฯ 10500", branchCode: "00000" }
  ]
};

const MOCK_PROJECTS = [
  { id: "PRJ-24-001", name: "วางระบบ ERP สนง.ใหญ่", costCenter: "CC-IT-001" },
  { id: "PRJ-24-002", name: "ปรับปรุงสาขาระยอง", costCenter: "CC-ENG-002" },
  { id: "PRJ-24-003", name: "MA Service 2024", costCenter: "CC-SVC-003" }
];

export default function SalesOrderPage() {
  const router = useRouter();
  
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxType, setTaxType] = useState("exclusive");
  const [selectedCustomer, setSelectedCustomer] = useState(MOCK_CUSTOMERS[0].id);
  const [selectedSite, setSelectedSite] = useState<string>("S1");
  const [items, setItems] = useState<any[]>([]);
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);

  // Feature A: Delivery Address
  const [isSameAsBilling, setIsSameAsBilling] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Feature B & D: Project & Payment Terms
  const [projectId, setProjectId] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("30"); // days
  
  // Feature C: Multi-Attachment Vault
  const [attachments, setAttachments] = useState<{name: string, size: string}[]>([]);

  const customer = MOCK_CUSTOMERS.find(c => c.id === selectedCustomer);
  const sites = customer ? (MOCK_SITES[customer.id] || []) : [];
  const activeSite = sites.find(s => s.id === selectedSite) || sites[0];

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

  const creditRemaining = customer ? customer.creditLimit - customer.currentBalance : 0;
  const isCreditExceeded = summary.grandTotal > creditRemaining;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + " KB"
      }));
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">สร้างใบสั่งขายใหม่</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              SO-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">สร้างใบสั่งขาย ระบุรายการสินค้า บริการ และเงื่อนไขการส่งมอบ</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <DocumentStepper steps={["ร่าง", "รออนุมัติ", "อนุมัติแล้ว"]} currentStep={0} />
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
      
      <div className="flex flex-col gap-6">
        {/* Customer Column */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-teal hover:border-white/25">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
            <Building2 size={16} className="text-nexus-teal" /> ข้อมูลลูกค้า
          </h3>
          
          <div className="space-y-4 relative">
            <Field label="ชื่อลูกค้า *">
              
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
                        onClick={() => { 
                          setSelectedCustomer(c.id); 
                          setSelectedSite(MOCK_SITES[c.id]?.[0]?.id || "");
                          setIsCustomerSelectorOpen(false); 
                        }}
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
              <div className="space-y-3">
                <Field label="สาขา / ที่อยู่สำหรับออกบิล (Billing Address)">
                  <div className="flex items-center gap-2 mb-2">
                     <MapPin size={14} className="text-white/40" /> 
                  </div>
                  {sites.length > 0 ? (
                    <PillSelect value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className="w-full h-9 px-6 rounded-full bg-white/[0.02] text-[13px] font-bold">
                      {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name} (สาขา {site.branchCode})</option>
                      ))}
                    </PillSelect>
                  ) : (
                    <p className="text-[13px] text-white/40">ไม่มีข้อมูลสาขาสำหรับลูกค้ารายนี้</p>
                  )}
                  {activeSite && (
                    <p className="text-[13px] font-bold text-white/60 min-h-[40px] leading-relaxed pt-2">
                      {activeSite.address}
                    </p>
                  )}
                </Field>
              </div>
              <div className="space-y-3 border-l border-white/5 pl-6">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <MapPin size={12} className="text-cyan-400" /> สถานที่ส่งมอบ / หน้างาน
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] text-cyan-400/80 hover:text-cyan-400">
                    <input 
                      type="checkbox" 
                      checked={isSameAsBilling} 
                      onChange={e => setIsSameAsBilling(e.target.checked)}
                      className="w-3 h-3 rounded-sm border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                    />
                    [ 📍 ใช้ที่อยู่เดียวกับสำนักงานใหญ่ ]
                  </label>
                </div>
                {!isSameAsBilling ? (
                  <textarea 
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="ระบุสถานที่จัดส่งหรือไซต์งาน..."
                    className="w-full h-24 p-3 text-[13px] bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                  />
                ) : (
                  <p className="text-[13px] font-bold text-white/30">
                    {activeSite ? activeSite.address : "-"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dates & Tax & Terms Column */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-blue hover:border-white/25">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
              <Calendar size={16} className="text-nexus-blue" /> เงื่อนไขและโครงการ
            </h3>
            <div className="space-y-4">
              <Field label="วันที่ออก *">
                <NexusDatePicker value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold" />
              </Field>
              
              <div className="grid grid-cols-2 gap-4">
                <Field label="เงื่อนไขการชำระเงิน">
                  <PillSelect value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                    <option value="0">เงินสด (Cash)</option>
                    <option value="15">เครดิต 15 วัน</option>
                    <option value="30">เครดิต 30 วัน</option>
                    <option value="45">เครดิต 45 วัน</option>
                    <option value="60">เครดิต 60 วัน</option>
                  </PillSelect>
                </Field>
                <Field label="โครงการ / Cost Center">
                  <PillSelect value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                    <option value="">-- ไม่ระบุโครงการ --</option>
                    {MOCK_PROJECTS.map(p => (
                      <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                    ))}
                  </PillSelect>
                </Field>
              </div>
            </div>
          </div>
          
          <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-purple-500 hover:border-white/25">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
              <Percent size={16} className="text-purple-400" /> ข้อมูลราคาและภาษี
            </h3>
            <div className="space-y-4">
              <Field label="ประเภทราคา *">
                <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                  <option value="exclusive">แยกภาษี (Exclusive)</option>
                  <option value="inclusive">รวมภาษี (Inclusive)</option>
                  <option value="none">ไม่มีภาษี</option>
                </PillSelect>
              </Field>
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">สกุลเงินเอกสาร</p>
                  <p className="text-[13px] text-white font-bold mt-1">THB - บาทไทย</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">อัตราแลกเปลี่ยน</p>
                  <p className="text-[13px] text-white font-mono mt-1">1.00000</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-emerald-500 hover:border-white/25">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
            รายการสินค้า / บริการ
          </h3>
          
          <DocumentItemsTable 
            items={items} 
            onChange={setItems} 
          />
        </div>

        {/* Multi-Attachment Vault */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-amber-500 hover:border-white/25">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 h-[36px]">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
              <Paperclip size={16} className="text-amber-400" /> เอกสารแนบ (Attachments)
            </h3>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              <div className="h-8 px-4 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 text-[11px] font-semibold uppercase tracking-widest flex items-center transition-all">
                <Plus size={12} className="mr-2" /> เพิ่มไฟล์แนบ
              </div>
            </label>
          </div>
          
          {attachments.length === 0 ? (
            <div className="w-full py-8 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 bg-black/30">
              <Paperclip size={24} className="mb-2 opacity-30" />
              <p className="text-[12px] font-bold">ลากไฟล์มาวาง หรือคลิกเพื่ออัปโหลด (Drag & Drop)</p>
              <p className="text-[10px] font-mono mt-1 opacity-50">รองรับ PDF, JPG, PNG ขนาดไม่เกิน 10MB</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {attachments.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileIcon size={16} className="text-cyan-400 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-[12px] font-bold text-white truncate">{file.name}</p>
                      <p className="text-[10px] font-mono text-white/40">{file.size}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeAttachment(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      
      {/* Credit Limit Checking Card */}
      <GlassCard className={cn(
        "p-5 border-white/15 rounded-3xl shadow-2xl w-full flex flex-col gap-3 transition-colors border-t-4 border-t-nexus-teal",
        isCreditExceeded ? "bg-red-500/10 border-red-500/30" : "bg-neutral-900/90"
      )}>
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">วงเงินเครดิต (Credit Limit)</span>
          {isCreditExceeded ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">
              <AlertTriangle size={12} /> เกินวงเงิน
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              <ShieldCheck size={12} /> อนุมัติได้
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-white/60 font-bold">วงเงินที่ได้รับ:</span>
            <span className="text-white font-mono font-bold">{formatCurrency(customer?.creditLimit || 0)}</span>
          </div>
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-white/60 font-bold">ยอดหนี้ค้างชำระ:</span>
            <span className="text-white font-mono font-bold">{formatCurrency(customer?.currentBalance || 0)}</span>
          </div>
          <div className="flex justify-between items-center text-[12px] pt-2 border-t border-white/5">
            <span className={cn("font-black uppercase tracking-widest", isCreditExceeded ? "text-red-400" : "text-emerald-400")}>วงเงินคงเหลือ:</span>
            <span className={cn("font-mono font-black", isCreditExceeded ? "text-red-400" : "text-emerald-400")}>
              {formatCurrency(creditRemaining)}
            </span>
          </div>
        </div>
        {isCreditExceeded && (
          <div className="mt-2 p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-[11px] text-red-400 font-bold leading-relaxed">
            ยอดเงินคงเหลือไม่เพียงพอสำหรับการเปิดใบสั่งขายนี้ กรุณาติดต่อฝ่ายสินเชื่อเพื่อขออนุมัติวงเงินชั่วคราว
          </div>
        )}
      </GlassCard>

      {/* Summary Card */}
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
          <span className={cn(
            "text-3xl font-black font-mono tracking-tighter",
            isCreditExceeded ? "text-red-400" : "text-cyan-400"
          )}>
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