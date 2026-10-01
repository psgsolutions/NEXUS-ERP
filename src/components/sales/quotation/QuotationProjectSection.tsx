"use client";

import { useQuotationForm } from "@/context/QuotationFormContext";
import { PillInput, cn } from "@/components/ui/Base";
import { NumberInput } from "@/components/ui/SmartComponents";
import { Briefcase } from "lucide-react";

export function QuotationProjectSection() {
  const { formData, setFormData } = useQuotationForm();

  if (!['PROJECT_GOV', 'INSTALLATION'].includes(formData.quotationType) && !formData.projectId) {
    return null;
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <h3 className="text-xs font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-4 not-italic">
        <Briefcase size={14} /> 3. ข้อมูลโครงการและการปฏิบัติการ
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {((formData.quotationType === 'PROJECT_GOV') || formData.projectId) && (
          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              โครงการอ้างอิง {formData.quotationType === 'PROJECT_GOV' && <span className="text-red-500 font-bold">*</span>}
            </label>
            <PillInput 
              value={formData.projectName}
              onChange={(e) => setFormData({...formData, projectName: e.target.value})}
              placeholder="กรอกชื่อโครงการประมูล"
              disabled={!!formData.projectId}
              className={cn("h-9 py-0 leading-relaxed", formData.projectId && "opacity-50 cursor-not-allowed")}
            />
          </div>
        )}
        
        {formData.quotationType === 'INSTALLATION' && (
          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              ค่าแรงเหมาติดตั้ง
            </label>
            <NumberInput 
              value={formData.totalLaborCost || 0}
              onChange={(v) => setFormData({...formData, totalLaborCost: v})}
              formatCurrency
              step={100}
              className="h-9 w-full bg-white/[0.03] border-white/10"
            />
          </div>
        )}
      </div>
    </div>
  );
}
