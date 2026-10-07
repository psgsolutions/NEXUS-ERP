'use client';

import React, { useState, useMemo } from 'react';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PillInput, PillButton, cn, PillSelect, GlassCard } from '@/components/ui/Base';
import { SmartSelect } from '@/components/ui/SmartComponents';
import { DocumentItemsTable } from '@/components/commerce/DocumentItemsTable';
import { DocumentItem } from '@/types/shared';
import { Save, FileText, Calculator, ShoppingCart, Calendar, ShieldCheck, Building2, FileSignature, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { nexusSequenceEngine } from '@/lib/sequence-engine';
import { arabicNumberToThaiText } from '@/lib/utils/thaiBahtText';
import { useRouter } from 'next/navigation';
import NexusPageLayout from '@/components/layout/NexusPageLayout';
import { DocumentStepper } from '@/components/ui/DocumentStepper';

export default function CreateInvoicePage() {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';
  const router = useRouter();

  const { data: salesOrders } = useRealtimeCollection('sales_orders');
  
  const [formData, setFormData] = useState({
    soId: '',
    soCode: '',
    
    // Header
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    
    // Customer
    customerId: '',
    customerName: '',
    customerTaxId: '',
    billingAddress: '',
    taxDisplayMode: 'VAT_EXCLUDED', // VAT_EXCLUDED, VAT_INCLUDED, NON_VAT
    
    // Financial settings
    whtRate: 0,
    globalDiscount: 0,
    
    // Footer
    remarks: 'กรุณาชำระเงินภายในกำหนดเวลาที่ระบุไว้ในใบวางบิล',
  });

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Financial Calculations
  const rawSubTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  
  const { subTotalAfterDiscount, vatAmount, whtAmount, grandTotal, preVatAmount } = useMemo(() => {
    const sub = rawSubTotal;
    const subAfterDiscount = Math.max(0, sub - formData.globalDiscount);
    
    let vat = 0;
    let preVat = subAfterDiscount;
    let wht = 0;
    let grand = 0;

    if (formData.taxDisplayMode === 'VAT_EXCLUDED') {
      vat = subAfterDiscount * 0.07;
      wht = subAfterDiscount * (formData.whtRate / 100);
      grand = subAfterDiscount + vat - wht;
    } else if (formData.taxDisplayMode === 'VAT_INCLUDED') {
      vat = subAfterDiscount - (subAfterDiscount / 1.07);
      preVat = subAfterDiscount - vat;
      wht = preVat * (formData.whtRate / 100);
      grand = subAfterDiscount - wht;
    } else { // NON_VAT
      vat = 0;
      wht = subAfterDiscount * (formData.whtRate / 100);
      grand = subAfterDiscount - wht;
    }

    return { 
      subTotalAfterDiscount: subAfterDiscount,
      vatAmount: vat, 
      whtAmount: wht, 
      grandTotal: grand,
      preVatAmount: preVat
    };
  }, [rawSubTotal, formData.globalDiscount, formData.taxDisplayMode, formData.whtRate]);

  const thaiBahtText = arabicNumberToThaiText(grandTotal);

  const handleSOChange = (value: string) => {
    const so = salesOrders.find(s => s.id === value);
    if (so) {
      setFormData(prev => ({
        ...prev,
        soId: so.id,
        soCode: so.soCode || so.documentNo || so.id,
        customerId: so.customerId || so.customer?.customerId || '',
        customerName: so.customerName || so.customer?.name || so.customer || '',
        customerTaxId: so.customerTaxId || '',
        billingAddress: so.billingAddress || '',
        taxDisplayMode: so.taxDisplayMode || 'VAT_EXCLUDED',
        globalDiscount: so.globalDiscount || 0,
        whtRate: so.whtRate || 0,
      }));
      // Pull items from SO (allow partial billing)
      if (so.items && Array.isArray(so.items)) {
        const newItems: DocumentItem[] = so.items.map((i: any) => ({
          ...i,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5) // New UUIDs for invoice items to avoid reference collision
        }));
        setItems(newItems);
      }
    } else {
      // Reset
      setFormData(prev => ({ ...prev, soId: '', soCode: '', customerId: '', customerName: '', customerTaxId: '', billingAddress: '' }));
      setItems([]);
    }
  };

  const handleSave = async () => {
    if (!formData.soId || items.length === 0) {
      alert("กรุณาเลือกอ้างอิงใบสั่งขาย (SO) และต้องมีรายการอย่างน้อย 1 รายการ");
      return;
    }
    
    try {
      setLoading(true);
      const invCode = await nexusSequenceEngine('INV', currentCompanyId);
      
      const payload = {
        companyId: currentCompanyId,
        invoiceCode: invCode,
        soId: formData.soId,
        soCode: formData.soCode,
        
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerTaxId: formData.customerTaxId,
        billingAddress: formData.billingAddress,
        taxDisplayMode: formData.taxDisplayMode,
        
        items,
        
        subTotal: rawSubTotal,
        globalDiscount: formData.globalDiscount,
        subTotalAfterDiscount,
        vatRate: formData.taxDisplayMode === 'NON_VAT' ? 0 : 7,
        vatAmount,
        whtRate: formData.whtRate,
        whtAmount,
        grandTotal,
        thaiBahtText,
        
        remarks: formData.remarks,
        salespersonId: user?.uid || 'SYSTEM',
        
        createdBy: user?.uid || 'SYSTEM',
        createdAt: serverTimestamp(),
        isDeleted: false,
        status: 'UNPAID'
      };

      await addDoc(collection(db, `companies/${currentCompanyId}/invoices`), payload);
      
      alert(`บันทึกใบแจ้งหนี้สำเร็จ: ${invCode}`);
      router.push('/finance/invoices');
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
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
              ออกใบแจ้งหนี้และวางบิล
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              INV-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            สร้างใบแจ้งหนี้ อ้างอิงใบสั่งขาย คำนวณภาษีและส่งวางบิลลูกค้า
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" onClick={handleSave} disabled={loading} className="h-8 px-5 font-bold text-xs">
          <CheckCircle2 size={14} className="mr-1.5" /> {loading ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      {/* 1. Document Header & Security */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 h-[36px]">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 ">
          <ShieldCheck size={16} /> ข้อมูลเอกสาร (Document Header)
        </h3>
        </div>
        
        <div className="space-y-4">
          <Field label="อ้างอิงใบสั่งขาย *">
            <SmartSelect
              value={formData.soId}
              onChange={handleSOChange}
              options={salesOrders.map(so => ({
                value: so.id,
                label: `${so.soCode || so.documentNo || so.id} : ${so.customerName || so.customer?.name || so.customer || 'ไม่ระบุลูกค้า'}`,
              }))}
              placeholder="-- ค้นหาและเลือกใบสั่งขาย --"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <Field label="วันที่ออก">
              <PillInput 
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
              />
            </Field>

            <Field label="วันครบกำหนด *">
              <PillInput 
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                className="w-full h-9 px-6 rounded-full bg-white/[0.02] border-white/10 text-[13px] font-bold"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* 2. Customer Profile */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
          <Building2 size={16} /> ข้อมูลลูกค้า (Customer Profile)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="ชื่อลูกค้า">
            <PillInput 
              type="text"
              value={formData.customerName}
              disabled
              className="w-full h-9 px-6 rounded-full bg-white/[0.01] border-white/5 text-white/50 cursor-not-allowed text-[13px] font-bold"
              placeholder="ดึงจากใบสั่งขายอัตโนมัติ"
            />
          </Field>

          <Field label="เลขผู้เสียภาษี / ที่อยู่">
            <PillInput 
              type="text"
              value={formData.customerTaxId ? `${formData.customerTaxId} - ${formData.billingAddress}` : ''}
              disabled
              className="w-full h-9 px-6 rounded-full bg-white/[0.01] border-white/5 text-white/50 cursor-not-allowed font-mono text-[13px] truncate"
              placeholder="Auto-fill"
            />
          </Field>
        </div>
        
        <div className="pt-2 w-full md:w-1/2">
          <Field label="รูปแบบภาษี *">
            <div className="flex bg-white/[0.03] p-1 rounded-full w-full h-9 border border-white/5">
              {[
                { val: 'VAT_EXCLUDED', label: 'ก่อน VAT' },
                { val: 'VAT_INCLUDED', label: 'รวม VAT' },
                { val: 'NON_VAT', label: 'ไม่มี VAT' }
              ].map(mode => (
                <button
                  key={mode.val}
                  type="button"
                  onClick={() => setFormData({...formData, taxDisplayMode: mode.val})}
                  className={cn(
                    "flex-1 h-full rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                    formData.taxDisplayMode === mode.val ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]" : "text-white/40 hover:text-white"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* 3. Line Items */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
          <ShoppingCart size={16} /> รายการสินค้า / บริการ
          <span className="text-[10px] text-cyan-400/80 ml-2">(Partial Billing Allowed)</span>
        </h3>
        
        <DocumentItemsTable items={items} onChange={setItems} />
      </div>

      {/* 6. Footer Remarks */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
          <FileSignature size={16} /> หมายเหตุ / เงื่อนไข (Remarks)
        </h3>
        <textarea
          value={formData.remarks}
          onChange={(e) => setFormData({...formData, remarks: e.target.value})}
          className="w-full h-32 rounded-3xl bg-white/[0.02] border border-white/10 text-white text-[13px] font-bold p-6 focus:outline-none focus:border-cyan-500/40 transition-all custom-scrollbar"
          placeholder="เงื่อนไขการรับประกัน, การชำระเงิน..."
        />
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-4 w-full">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่ารวม (Subtotal)</span>
          <span className="text-white font-mono font-bold tracking-tight text-right">฿ {rawSubTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-cyan-400/70 font-bold uppercase tracking-widest text-[11px]">ส่วนลดท้ายบิล</span>
            <input 
              type="number"
              value={formData.globalDiscount || ''}
              onChange={(e) => setFormData({...formData, globalDiscount: Number(e.target.value)})}
              className="w-24 bg-white/[0.03] border border-white/10 rounded-full px-3 h-9 text-cyan-400 font-bold text-right text-[13px] focus:outline-none focus:border-cyan-500/50 font-mono transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center text-[13px] border-t border-white/5 pt-4">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">หลังหักส่วนลด (Pre-VAT)</span>
          <span className="text-white font-mono font-bold tracking-tight text-right">฿ {subTotalAfterDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">
            ภาษีมูลค่าเพิ่ม ({formData.taxDisplayMode === 'NON_VAT' ? '0%' : '7%'})
          </span>
          <span className="text-white font-mono font-bold tracking-tight text-right">฿ {vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        
        <div className="space-y-3 pb-4 border-b border-white/5">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">หัก ณ ที่จ่าย (WHT)</span>
            <PillSelect
              value={formData.whtRate}
              onChange={(e) => setFormData({...formData, whtRate: Number(e.target.value)})}
              className="w-[140px] h-9 px-4 text-[12px] bg-white/[0.03] border-white/10 rounded-full font-bold"
            >
              <option value={0}>0% (ไม่มี)</option>
              <option value={1}>1% (ค่าขนส่ง)</option>
              <option value={2}>2% (ค่าโฆษณา)</option>
              <option value={3}>3% (ค่าบริการ)</option>
              <option value={5}>5% (ค่าเช่า)</option>
            </PillSelect>
          </div>
          {formData.whtRate > 0 && (
            <div className="text-right font-mono font-bold text-danger text-[13px] drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]">
              - ฿ {whtAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end pt-4 space-y-1">
          <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">ยอดสุทธิ</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-cyan-400 font-mono tracking-tighter text-right drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              ฿ {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span>
          </div>
        </div>
        
        <div className="text-[10px] text-right font-black text-cyan-400/60 bg-cyan-500/10 px-3 py-1.5 rounded-full w-full overflow-hidden text-ellipsis whitespace-nowrap mt-2">
          ({thaiBahtText})
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
