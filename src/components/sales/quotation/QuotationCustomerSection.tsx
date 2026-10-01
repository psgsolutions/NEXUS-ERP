"use client";

import { useQuotationForm } from "@/context/QuotationFormContext";
import { PillInput, cn } from "@/components/ui/Base";
import { AsyncCustomerSelect } from "@/components/commerce/AsyncCustomerSelect";
import { Building2 } from "lucide-react";

export function QuotationCustomerSection() {
  const { formData, setFormData, handleCustomerChange } = useQuotationForm();

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
      <h3 className="text-xs font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-4 not-italic">
        <Building2 size={14} /> 2. ข้อมูลลูกค้าและที่อยู่
      </h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
                ชื่อลูกค้า <span className="text-red-500 font-bold">*</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={formData.isCompetitorQuote} 
                  onChange={(e) => setFormData({...formData, isCompetitorQuote: e.target.checked})} 
                />
                <div className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${formData.isCompetitorQuote ? 'bg-orange-500/80' : 'bg-white/10'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${formData.isCompetitorQuote ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">เอกสารคู่เทียบ (พิมพ์อิสระ)</span>
              </label>
            </div>
            
            {formData.isCompetitorQuote ? (
              <PillInput
                value={formData.customerName}
                onChange={(e) => setFormData({...formData, customerName: e.target.value, customerId: ''})}
                placeholder="พิมพ์ชื่อลูกค้า (คู่เทียบ)"
                className="h-9 py-0 leading-relaxed border-orange-500/30 bg-orange-500/5 text-orange-100"
              />
            ) : (
              <AsyncCustomerSelect
                value={formData.customerId}
                onChange={handleCustomerChange}
                displayValue={formData.customerName}
                placeholder="-- ค้นหาและเลือกลูกค้า --"
                className="h-9 py-0 leading-relaxed"
              />
            )}
          </div>

          <div className="md:col-span-1 space-y-1">
            <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              เลขประจำตัวผู้เสียภาษี
            </label>
            <PillInput 
              value={formData.customerTaxId}
              onChange={(e) => setFormData({...formData, customerTaxId: e.target.value})}
              className="h-9 py-0 leading-relaxed font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              รหัสสาขา
            </label>
            <PillInput 
              value={formData.customerBranch}
              onChange={(e) => setFormData({...formData, customerBranch: e.target.value})}
              className="h-9 py-0 leading-relaxed font-mono tracking-tight"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              ชื่อผู้ติดต่อ
            </label>
            <PillInput 
              value={formData.contactPerson || ''}
              onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
              placeholder="เช่น คุณสมชาย"
              className="h-9 py-0 leading-relaxed"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              เงื่อนไขการชำระเงิน
            </label>
            <PillInput 
              value={formData.paymentTerms}
              onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}
              placeholder="เช่น เครดิต 30 วัน"
              className="h-9 py-0 leading-relaxed"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            ที่อยู่สำหรับออกบิล
          </label>
          <textarea
            value={formData.billingAddress}
            onChange={(e) => setFormData({...formData, billingAddress: e.target.value})}
            className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-xl px-5 py-2 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 transition-all resize-none"
            placeholder="ที่อยู่ลูกค้า..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            สถานที่จัดส่ง / หน้างาน
          </label>
          <textarea
            value={formData.deliveryAddress}
            onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})}
            className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-xl px-5 py-2 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 transition-all resize-none"
            placeholder="สถานที่จัดส่งสินค้า หรือ สถานที่ปฏิบัติงาน..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            รูปแบบภาษี <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2">
            <div className="flex bg-white/15 p-1 rounded-full w-fit h-9">
              {[
                { val: 'NON_VAT', label: 'ไม่มี VAT' },
                { val: 'VAT_EXCLUDED', label: 'ก่อน VAT' },
                { val: 'VAT_INCLUDED', label: 'รวม VAT' }
              ].map(mode => (
                <button
                  key={mode.val}
                  type="button"
                  onClick={() => setFormData({...formData, taxDisplayMode: mode.val as any})}
                  className={cn(
                    "px-4 h-full rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                    formData.taxDisplayMode === mode.val ? "text-nexus-teal border border-nexus-teal/30 bg-transparent shadow-[0_0_15px_rgba(45,212,191,0.2)]" : "border border-transparent text-white/40 hover:text-white"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {formData.taxDisplayMode === 'VAT_INCLUDED' && (
              <div 
                className={cn(
                  "flex items-center gap-2 px-4 h-9 rounded-full cursor-pointer transition-all flex-shrink-0",
                  formData.vatIncAddPerItem 
                    ? "bg-transparent border border-nexus-teal/30 shadow-[0_0_15px_rgba(45,212,191,0.2)]" 
                    : "bg-white/15 border border-white/10 hover:bg-white/15"
                )}
                onClick={() => setFormData({...formData, vatIncAddPerItem: !formData.vatIncAddPerItem})}
              >
                <div className={cn(
                  "w-3 h-3 rounded-full transition-all flex-shrink-0",
                  formData.vatIncAddPerItem ? "bg-nexus-teal shadow-neon-teal" : "bg-white/20"
                )} />
                <span className={cn(
                  "text-[11px] font-bold uppercase tracking-wider select-none whitespace-nowrap",
                  formData.vatIncAddPerItem ? "text-nexus-teal" : "text-white/60"
                )}>
                  รวม VAT ในราคาสินค้า
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
