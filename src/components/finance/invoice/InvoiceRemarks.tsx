"use client";

import { useInvoiceForm } from "@/context/InvoiceFormContext";
import { FileSignature } from "lucide-react";

export function InvoiceRemarks() {
  const { formData, setFormData } = useInvoiceForm();

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-2">
      <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
        <FileSignature size={12} /> หมายเหตุ / เงื่อนไข
      </label>
      <textarea
        value={formData.remarks}
        onChange={(e) => setFormData({...formData, remarks: e.target.value})}
        className="w-full bg-black/15 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-nexus-teal/40 transition-all min-h-[80px]"
        placeholder="เงื่อนไขการรับประกัน, การชำระเงิน..."
      />
    </div>
  );
}
