"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  FileText, Plus, Trash2, ShieldCheck, Search, ArrowUpRight,
  Calculator, Box, TrendingUp, Percent, Zap, LayoutList,
  Layers, ClipboardList, Target, RefreshCw, Edit3
} from "lucide-react";
import { PillButton, PillInput, PillSelect, Modal, PillTabs, NexusDataField, PillCheckbox, cn, NexusDatePicker } from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { calculateFinancials, formatCurrency, getProfitRainbowColor, VatType } from "@/lib/erp-logic";
import { useSystemDialog } from "@/context/DialogContext";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { SmartScanner } from "@/components/shared/SmartScanner";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useCustomers } from "@/hooks/useCustomers";
import { where } from "firebase/firestore";

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onApprove?: (quoteId: string) => void;
  initialData?: any;
}

const INITIAL_FORM = {
  subject: "",
  customer: "",
  customerName: "",
  customerAddress: "",
  customerTaxId: "",
  customerContact: "",
  date: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  taxMode: "Inclusive" as VatType,
  salesPerson: "Kriangkrai M.",
  paymentTerms: "30 Days",
  isDraftProject: false,
  terms: "1. ราคานี้ยืนอยู่ได้ 30 วันนับจากวันที่ออกเอกสาร\n2. กำหนดส่งมอบภายใน 15-30 วันหลังจากได้รับใบสั่งซื้อ\n3. รับประกันคุณภาพสินค้า 1 ปีเต็ม",
  items: [] as any[]
};

export function QuotationModal({ isOpen, onClose, onSave, onApprove, initialData }: QuotationModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();
  const { companyId } = useAuth();
  
  const { data: customers = [] } = useCustomers();

  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (initialData && isOpen) {
      setForm({
        ...INITIAL_FORM,
        subject: initialData.title || initialData.subject || "",
        customer: initialData.customerId || initialData.customer || "",
        customerName: initialData.customerName || "",
        customerAddress: initialData.customerAddress || "",
        customerTaxId: initialData.customerTaxId || "",
        customerContact: initialData.customerContact || "",
        date: initialData.date || INITIAL_FORM.date,
        validUntil: initialData.validUntil || INITIAL_FORM.validUntil,
        taxMode: initialData.taxMode || INITIAL_FORM.taxMode,
        paymentTerms: initialData.paymentTerms || INITIAL_FORM.paymentTerms,
        terms: initialData.terms || INITIAL_FORM.terms,
        items: initialData.items || []
      });
      setIsLocked(false);
    } else if (isOpen) {
      setForm(INITIAL_FORM);
      setIsLocked(false);
    }
  }, [initialData, isOpen]);

  const handleCustomerChange = (customerId: string) => {
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      setForm(prev => ({
        ...prev,
        customer: customerId,
        customerName: selectedCustomer.name || "",
        customerAddress: selectedCustomer.address || selectedCustomer.shippingAddress || "",
        customerTaxId: selectedCustomer.taxId || selectedCustomer.tax_id || "",
        customerContact: selectedCustomer.contactPerson || selectedCustomer.phone || "",
        paymentTerms: selectedCustomer.creditTerm || prev.paymentTerms
      }));
    } else {
      setForm(prev => ({ ...prev, customer: customerId }));
    }
  };

  const financials = useMemo(() => calculateFinancials(form.items, form.taxMode), [form.items, form.taxMode]);
  const rainbow = useMemo(() => getProfitRainbowColor(financials.gpPercent), [financials.gpPercent]);

  const handleSave = async () => {
    if (!form.customer && !form.subject) return void showAlert("กรุณาระบุข้อมูลหัวข้อโครงการและลูกค้า");
    setIsSubmitting(true);
    try {
      const mappedVatType = form.taxMode === "Inclusive" ? "Include VAT" : form.taxMode === "Exclusive" ? "Exclude VAT" : "Non-VAT";
      await onSave({ ...form, vatType: mappedVatType, financials });
      setIsLocked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (initialData && initialData.id && onApprove) {
      setIsSubmitting(true);
      try {
        await onApprove(initialData.id);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ใบเสนอราคา (Quotation)"
      maxWidth="max-w-[1200px]"
    >
      <div className="flex flex-col h-full bg-surface-0 relative overflow-hidden">
        
        {/* STICKY HEADER ACTIONS */}
        <div className="sticky top-0 z-50 flex justify-between items-center px-8 py-4 bg-surface-0/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-4">
             {isLocked ? (
               <PillButton onClick={() => setIsLocked(false)} className="h-9 px-6 rounded-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30">
                 <Edit3 size={16} className="mr-2" /> แก้ไขข้อมูล
               </PillButton>
             ) : (
                <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-nexus-teal animate-pulse" /> Editing Mode
                </span>
             )}
          </div>
          <div className="flex items-center gap-3">
             <PillButton variant="ghost" className="h-9 px-6 rounded-full uppercase tracking-widest" onClick={onClose}>
                ยกเลิก
             </PillButton>
             <PillButton 
                className="h-9 px-6 rounded-full shadow-neon-teal uppercase tracking-[0.2em] flex items-center justify-center gap-2" 
                onClick={handleSave}
                disabled={isSubmitting || isLocked}
             >
                {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                บันทึกเอกสาร
             </PillButton>
             {initialData && initialData.status !== "Approved" && onApprove && (
               <PillButton 
                 className="h-9 px-6 rounded-full shadow-neon-teal bg-nexus-teal uppercase tracking-[0.2em] flex items-center justify-center gap-2" 
                 onClick={handleApprove}
                 disabled={isSubmitting}
               >
                 <Zap size={16} /> อนุมัติ (Approve)
               </PillButton>
             )}
          </div>
        </div>

        {/* MAIN SCROLLABLE DOCUMENT */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          <div className={cn("max-w-5xl mx-auto space-y-6 transition-all duration-500 pb-20 relative z-10", isLocked && "opacity-80 pointer-events-none grayscale-[0.2]")}>
            
            {/* 1. DOCUMENT HEADER */}
            <div className="flex justify-between items-start border-b border-white/5 pb-5">
              <div className="space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-3 shadow-xl">
                   <div className="text-nexus-blue font-semibold text-2xl tracking-tighter">PSG</div>
                </div>
                <h4 className="text-lg font-semibold text-white uppercase tracking-tight">PSG Solutions Co., Ltd. (Head Office)</h4>
                <p className="text-[12px] text-white/40 font-bold">บริษัท พีเอสจี โซลูชั่น จำกัด (สำนักงานใหญ่)</p>
              </div>
              <div className="text-right space-y-4">
                 <div className="inline-block bg-nexus-blue/10 border border-nexus-blue/20 rounded-xl px-6 py-3 shadow-neon-blue">
                    <p className="text-[12px] font-semibold text-nexus-blue uppercase tracking-widest mb-1">ใบเสนอราคา / Quotation</p>
                    <p className="text-lg font-mono text-white font-black">{initialData?.id || "QTA-DRAFT-001"}</p>
                 </div>
              </div>
            </div>

            {/* 2. CUSTOMER & TERMS (2 Columns - Split Layout) */}
            <div className="grid grid-cols-2 gap-8 bg-white/[0.01] p-6 rounded-3xl border border-white/5">
                {/* Left: Customer Profile & Address */}
                <div className="space-y-4">
                    <Field label="ชื่อลูกค้า * (Customer Name)" required>
                      <PillSelect 
                        value={form.customer}
                        onChange={(e) => handleCustomerChange(e.target.value)}
                        className="w-full bg-white/[0.02] h-9 rounded-full"
                      >
                        <option value="">เลือกจากฐานข้อมูล...</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </PillSelect>
                    </Field>
                    <Field label="เลขประจำตัวผู้เสียภาษี (Tax ID.)">
                      <PillInput 
                        value={form.customerTaxId}
                        onChange={(e) => setForm({...form, customerTaxId: e.target.value})}
                        className="w-full bg-white/[0.02] font-mono tracking-widest h-9 rounded-full text-white" 
                        placeholder="0000000000000"
                      />
                    </Field>
                    <Field label="ที่อยู่ (Address)">
                      <PillInput 
                        value={form.customerAddress}
                        onChange={(e) => setForm({...form, customerAddress: e.target.value})}
                        className="w-full bg-white/[0.02] text-[13px] h-9 rounded-full text-white" 
                      />
                    </Field>
                    <Field label="ผู้ติดต่อ (Contact Name)">
                      <PillInput 
                        value={form.customerContact}
                        onChange={(e) => setForm({...form, customerContact: e.target.value})}
                        className="w-full bg-white/[0.02] h-9 rounded-full text-white" 
                      />
                    </Field>
                </div>

                {/* Right: Document Info & Terms */}
                <div className="space-y-4">
                    <Field label="วันที่ (Date)">
                      <NexusDatePicker 
                        value={form.date}
                        onChange={(e) => setForm({...form, date: e.target.value})}
                        className="w-full bg-white/[0.02] h-9 rounded-full" 
                      />
                    </Field>
                    <Field label="ยืนราคาถึงวันที่ (Price Validation)">
                      <NexusDatePicker 
                        value={form.validUntil}
                        onChange={(e) => setForm({...form, validUntil: e.target.value})}
                        className="w-full bg-white/[0.02] h-9 rounded-full" 
                      />
                    </Field>
                    <Field label="เงื่อนไขการชำระเงิน (Terms of Payment)">
                      <PillSelect 
                        value={form.paymentTerms}
                        onChange={(e) => setForm({...form, paymentTerms: e.target.value})}
                        className="w-full bg-white/[0.02] h-9 rounded-full"
                      >
                        <option value="Cash">เงินสด (Cash)</option>
                        <option value="30 Days">เครดิต 30 วัน</option>
                        <option value="45 Days">เครดิต 45 วัน</option>
                        <option value="60 Days">เครดิต 60 วัน</option>
                      </PillSelect>
                    </Field>
                    <Field label="ระบบภาษี">
                      <PillSelect 
                        value={form.taxMode}
                        onChange={(e) => setForm({...form, taxMode: e.target.value as VatType})}
                        className="w-full bg-white/[0.02] h-9 rounded-full"
                      >
                        <option value="Inclusive">รวมภาษี (Inclusive 7%)</option>
                        <option value="Exclusive">แยกภาษี (Exclusive 7%)</option>
                        <option value="Non-VAT">ไม่มีภาษี</option>
                      </PillSelect>
                    </Field>
                </div>
            </div>

            {/* 3. PROJECT NAME */}
            <div className="bg-nexus-teal/5 p-6 rounded-3xl border border-nexus-teal/20 relative overflow-hidden group">
                <div className="relative z-10">
                    <Field label="หัวข้อโครงการ * (Project Name)" required>
                        <PillInput 
                            value={form.subject}
                            onChange={(e) => setForm({...form, subject: e.target.value})}
                            placeholder="ระบุชื่อโครงการ..." 
                            className="w-full text-white font-black text-xl bg-transparent border-b-2 border-transparent focus:border-nexus-teal/40 rounded-none px-0 py-2 placeholder:text-white/20 h-10" 
                        />
                    </Field>
                </div>
                <div className="absolute right-0 top-0 w-32 h-32 bg-nexus-teal/10 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* 4. ITEMS TABLE */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <Layers className="text-nexus-blue" size={20} />
                        <h4 className="text-[13px] font-semibold text-white/80 uppercase tracking-[0.2em]">รายการสินค้า / บริการ</h4>
                    </div>
                    {!isLocked && (
                      <SmartScanner 
                        type="quotation"
                        buttonLabel="AI ดึงข้อมูลจากเอกสาร"
                        onDataExtracted={(data) => {
                          if (data.items && data.items.length > 0) {
                            const mappedItems = data.items.map((it: any, idx: number) => ({
                              id: `ITEM-AI-${Date.now()}-${idx}`,
                              sku: "AI-EXTRACTED",
                              name: it.description || "",
                              qty: it.quantity || 1,
                              unit: "รายการ",
                              unitCost: (it.unitPrice || 0) * 0.7, // Assume 30% margin for cost
                              unitPrice: it.unitPrice || 0
                            }));
                            setForm(prev => ({
                              ...prev,
                              items: [...prev.items, ...mappedItems]
                            }));
                          }
                        }}
                      />
                    )}
                </div>

                {/* ITEMS GRID */}
                <DocumentItemsTable 
                    items={form.items} 
                    onChange={(items) => setForm(prev => ({ ...prev, items }))} 
                    isLocked={isLocked}
                />
            </div>

            {/* 5. FOOTER & SUMMARY */}
            <div className="grid grid-cols-12 gap-8 pt-6 border-t border-white/5">
                {/* Left: Remarks */}
                <div className="col-span-7 space-y-4">
                    <Field label="หมายเหตุ (Remarks)">
                        <textarea 
                            className="w-full h-32 rounded-2xl bg-white/[0.02] border border-white/10 text-white text-[14px] p-4 focus:outline-none focus:border-nexus-blue/40 transition-all shadow-inner"
                            value={form.terms}
                            onChange={(e) => setForm({...form, terms: e.target.value})}
                        />
                    </Field>
                    <div className="flex items-center gap-4 bg-nexus-teal/10 border border-nexus-teal/20 p-4 rounded-2xl">
                        <TrendingUp size={20} className="text-nexus-teal flex-shrink-0" />
                        <div>
                           <p className="text-[11px] uppercase font-black tracking-widest text-white/60 mb-1">Profitability Forecast</p>
                           <p className={cn("text-[15px] font-bold", rainbow.text)}>
                               GP: {financials.gpPercent}% | Total Profit: {formatCurrency(financials.profit)}
                           </p>
                        </div>
                    </div>
                </div>

                {/* Right: Financial Summary */}
                <div className="col-span-5 bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-center text-white/80">
                            <span className="text-[14px] font-bold">รวมเป็นเงิน (Total Amount)</span>
                            <span className="font-mono text-[16px] tracking-tight text-right">{formatCurrency(financials.net)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/80">
                            <span className="text-[14px] font-bold">ส่วนลด (Discount)</span>
                            <span className="font-mono text-[16px] text-danger tracking-tight text-right">0.00</span>
                        </div>
                        <div className="flex justify-between items-center text-white/80">
                            <span className="text-[14px] font-bold">ยอดรวมหลังหักส่วนลด (Net Total)</span>
                            <span className="font-mono text-[16px] tracking-tight text-right">{formatCurrency(financials.net)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/80 pb-6 border-b border-white/10">
                            <span className="text-[14px] font-bold">ภาษีมูลค่าเพิ่ม 7% (VAT)</span>
                            <span className="font-mono text-[16px] tracking-tight text-right">{formatCurrency(financials.vat)}</span>
                        </div>
                        <div className="flex justify-between items-end pt-2">
                            <span className="text-[18px] font-black text-white">จำนวนเงินรวมทั้งสิ้น</span>
                            <span className="font-mono text-3xl font-black text-nexus-teal drop-shadow-neon tracking-tight text-right">{formatCurrency(financials.total)}</span>
                        </div>
                    </div>
                    {/* Background glow for total */}
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-nexus-teal/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
                </div>
            </div>

          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  // Use regex to parse and format the label standard: "ภาษาไทย * (English Specific)"
  let formattedLabel = label;
  let hasAsterisk = required || label.includes('*');
  let cleanLabel = label.replace('*', '').trim();
  
  return (
    <div className="space-y-2 w-full">
      <label className="text-[12px] font-bold text-white/70">
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
