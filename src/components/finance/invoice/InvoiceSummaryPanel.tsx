"use client";

import { useInvoiceForm } from "@/context/InvoiceFormContext";
import { Calculator } from "lucide-react";

export function InvoiceSummaryPanel() {
  const { formData, setFormData, summary } = useInvoiceForm();

  return (
    <div className="space-y-4 relative">
      <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6 sticky top-0 relative overflow-hidden">
        <h3 className="text-sm font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 not-italic relative z-10">
          <Calculator size={16} className="text-nexus-teal" /> สรุปยอด
        </h3>
        
        <div className="space-y-4 relative z-10">
          <div className="flex justify-between items-center text-sm text-white/80">
            <span className="text-[11px] font-bold uppercase tracking-widest not-italic">มูลค่ารวม (Sub Total)</span>
            <span className="font-mono text-base">฿ {summary.rawSubTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm text-white/80">
              <span className="text-[11px] font-bold uppercase tracking-widest not-italic">ส่วนลดท้ายบิล (Discount)</span>
              <input 
                type="number"
                value={formData.globalDiscount || ''}
                onChange={(e) => setFormData({...formData, globalDiscount: Number(e.target.value)})}
                className="w-24 bg-black/50 border border-white/10 rounded-full px-3 h-9 text-white text-right text-sm focus:outline-none focus:border-nexus-teal/50 font-mono transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm text-white/80 border-t border-white/5 pt-4">
            <span className="text-[11px] font-bold uppercase tracking-widest not-italic">หลังหักส่วนลด (After Disc.)</span>
            <span className="font-mono text-base">฿ {summary.subTotalAfterDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm text-white/80">
            <span className="text-[11px] font-bold uppercase tracking-widest not-italic">
              ภาษีมูลค่าเพิ่ม ({formData.taxDisplayMode === 'NON_VAT' ? '0%' : '7%'})
            </span>
            <span className="font-mono text-base">฿ {summary.vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="space-y-2 pb-4">
            <div className="flex justify-between items-center text-sm text-white/80">
              <span className="text-[11px] font-bold uppercase tracking-widest not-italic">หัก ณ ที่จ่าย (WHT)</span>
              <select
                value={formData.whtRate}
                onChange={(e) => setFormData({...formData, whtRate: Number(e.target.value)})}
                className="w-24 bg-black/50 border border-white/10 rounded-full px-3 h-9 text-white text-right text-sm focus:outline-none focus:border-nexus-teal/50 font-mono transition-all appearance-none"
              >
                <option value={0}>0%</option>
                <option value={1}>1%</option>
                <option value={2}>2%</option>
                <option value={3}>3%</option>
                <option value={5}>5%</option>
              </select>
            </div>
            {formData.whtRate > 0 && (
              <div className="text-right font-mono text-red-400 text-sm">
                - ฿ {summary.whtAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 space-y-2 relative z-10">
          <div className="flex justify-between items-center text-nexus-teal">
            <span className="text-sm font-black tracking-widest uppercase not-italic">ยอดสุทธิ (Grand Total)</span>
            <span className="text-2xl font-black font-mono">฿ {summary.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="text-[10px] text-right font-black text-nexus-teal/60 bg-transparent py-1.5 rounded-full not-italic">
            ({summary.thaiBahtText})
          </div>
        </div>
        
        {/* Background glow */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-nexus-teal/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
      </div>
      
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 shadow-2xl">
        <div className="text-[10px] text-blue-400/80 leading-relaxed font-bold not-italic">
          * สามารถใช้การออกใบแจ้งหนี้แบบแบ่งส่วน (Partial Billing) ได้ โดยการแก้ไขจำนวนหรือลบรายการสินค้าในตาราง
        </div>
      </div>
    </div>
  );
}
