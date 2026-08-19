"use client";

import { useQuotationForm } from "@/context/QuotationFormContext";
import { PillInput, NexusDatePicker, cn } from "@/components/ui/Base";
import { NumberInput } from "@/components/ui/SmartComponents";
import { ShieldCheck } from "lucide-react";

export function QuotationHeaderMeta() {
  const { formData, setFormData, qtFormat, currentCompanyId, validUntil } = useQuotationForm();

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
      <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-4 not-italic">
        <ShieldCheck size={14} /> 1. ข้อมูลระบบและเอกสาร
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[13px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            เลขที่เอกสาร / Rev.
          </label>
          <PillInput 
            value={`${qtFormat} (สร้างอัตโนมัติ) | Rev.00`}
            disabled
            className="h-7 py-0 leading-relaxed opacity-50 cursor-not-allowed font-mono text-[11px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[13px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            รหัสบริษัท
          </label>
          <PillInput 
            value={currentCompanyId}
            disabled
            className="h-7 py-0 leading-relaxed opacity-50 cursor-not-allowed font-mono text-xs"
          />
        </div>
          
        {formData.isCompetitorQuote && (
          <div className="space-y-1 col-span-2">
            <label className="text-[13px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1 not-italic">
              เป็นคู่เทียบให้บริษัทใด
            </label>
            <PillInput 
              value={formData.competitorFor}
              onChange={(e) => setFormData({...formData, competitorFor: e.target.value})}
              className="h-7 w-full border-orange-500/30 text-orange-300"
              placeholder="ระบุชื่อบริษัทของเราที่ต้องการช่วยทำคู่เทียบ"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-[13px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            ประเภทงาน <span className="text-red-500 font-bold">*</span>
          </label>
          <select
            value={formData.quotationType}
            onChange={(e) => setFormData({...formData, quotationType: e.target.value})}
            className="h-7 py-0 leading-relaxed px-6 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 w-full appearance-none transition-all"
          >
            <option value="SALE" className="bg-slate-900 text-white">ขายสินค้า (SALE)</option>
            <option value="INSTALLATION" className="bg-slate-900 text-white">ขายพร้อมติดตั้ง (INSTALLATION)</option>
            <option value="MAINTENANCE" className="bg-slate-900 text-white">สัญญาบำรุงรักษา (MAINTENANCE)</option>
            <option value="PROJECT_GOV" className="bg-slate-900 text-white">ประมูลราชการ (PROJECT_GOV)</option>
            <option value="SERVICE" className="bg-slate-900 text-white">งานบริการ (SERVICE)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[13px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            วันที่ออก <span className="text-red-500 font-bold">*</span>
          </label>
          <NexusDatePicker 
            value={formData.issueDate}
            onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
            className="h-7 w-full"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[13px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            ยืนราคา
          </label>
          <NumberInput 
            value={formData.validDays}
            onChange={(v) => setFormData({...formData, validDays: v})}
            className="h-7 w-full bg-white/[0.03] border-white/10"
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-[13px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            วันหมดอายุ
          </label>
          <NexusDatePicker 
            value={validUntil}
            className="h-7 w-full opacity-50 cursor-not-allowed pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
