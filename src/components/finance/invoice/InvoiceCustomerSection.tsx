"use client";

import { useInvoiceForm } from "@/context/InvoiceFormContext";
import { cn } from "@/components/ui/Base";
import { Building2 } from "lucide-react";

export function InvoiceCustomerSection() {
  const { formData, setFormData } = useInvoiceForm();

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
      <h3 className="text-xs font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-4 not-italic">
        <Building2 size={14} /> ข้อมูลลูกค้า
      </h3>
      
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            ชื่อลูกค้า (Customer Name)
          </label>
          <input 
            type="text"
            value={formData.customerName}
            disabled
            className="w-full bg-black/15 border border-white/10 rounded-full px-5 h-9 text-white text-sm focus:outline-none transition-all opacity-50 cursor-not-allowed font-bold"
            placeholder="ดึงจากใบสั่งขายอัตโนมัติ"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            เลขผู้เสียภาษี / ที่อยู่ (Tax ID & Address)
          </label>
          <input 
            type="text"
            value={formData.customerTaxId ? `${formData.customerTaxId} - ${formData.billingAddress}` : ''}
            disabled
            className="w-full bg-black/15 border border-white/10 rounded-full px-5 h-9 text-white text-sm focus:outline-none transition-all opacity-50 cursor-not-allowed font-mono truncate"
            placeholder="Auto-fill"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            รูปแบบภาษี <span className="text-red-500 font-bold">*</span> (Tax Display Mode)
          </label>
          <div className="flex bg-white/15 p-1 rounded-full w-full h-9">
            {[
              { val: 'VAT_EXCLUDED', label: 'ก่อน VAT' },
              { val: 'VAT_INCLUDED', label: 'รวม VAT' },
              { val: 'NON_VAT', label: 'ไม่มี VAT' }
            ].map(mode => (
              <button
                key={mode.val}
                type="button"
                onClick={() => setFormData({...formData, taxDisplayMode: mode.val as any})}
                className={cn(
                  "flex-1 h-full rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                  formData.taxDisplayMode === mode.val ? "text-nexus-teal border border-nexus-teal/30 bg-transparent shadow-[0_0_15px_rgba(45,212,191,0.2)]" : "border border-transparent text-white/40 hover:text-white"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
