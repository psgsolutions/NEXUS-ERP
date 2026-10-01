"use client";

import { useQuotationForm } from "@/context/QuotationFormContext";
import { FileSignature, UploadCloud } from "lucide-react";

export function QuotationRemarksVault() {
  const { formData, setFormData } = useQuotationForm();

  return (
    <>
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-2">
        <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
          <FileSignature size={12} /> 5. หมายเหตุ / เงื่อนไข
        </label>
        <textarea
          value={formData.remarks}
          onChange={(e) => setFormData({...formData, remarks: e.target.value})}
          className="w-full bg-black/15 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-nexus-teal/40 transition-all min-h-[100px]"
          placeholder="เงื่อนไขการรับประกัน, การชำระเงิน..."
        />
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xs font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-4 not-italic">
          <UploadCloud size={14} /> 6. เอกสารอ้างอิง
        </h3>
        <div className="w-full border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-white/40 hover:text-nexus-teal hover:border-nexus-teal/40 hover:bg-nexus-teal/5 transition-all cursor-pointer">
          <UploadCloud size={32} className="mb-2" />
          <div className="text-sm font-bold uppercase tracking-widest">ลากไฟล์มาวาง หรือ คลิกเพื่ออัปโหลด</div>
          <div className="text-xs mt-1">รองรับ PDF, JPG, PNG (สูงสุด 10MB)</div>
        </div>
      </div>
    </>
  );
}
