"use client";

import { useQuotationForm } from "@/context/QuotationFormContext";
import { Calculator } from "lucide-react";

export function QuotationSummaryPanel() {
  const { formData, setFormData, summary } = useQuotationForm();

  return (
    <div className="lg:w-[25%] shrink-0 sticky top-[96px] space-y-4">
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
        <h3 className="text-sm font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 not-italic">
          <Calculator size={16} className="text-nexus-teal" /> สรุปยอดและภาษี
        </h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm text-white/80">
            <span className="text-[13px] font-bold uppercase tracking-widest not-italic">มูลค่ารวม</span>
            <span className="font-mono tracking-tight text-base">฿ {summary.rawSubTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm text-white/80">
              <span className="text-[13px] font-bold uppercase tracking-widest not-italic">ส่วนลดท้ายบิล</span>
              <input 
                type="number"
                value={formData.globalDiscount || ''}
                onChange={(e) => setFormData({...formData, globalDiscount: Number(e.target.value)})}
                className="w-28 bg-black/15 border border-white/10 rounded-full px-3 h-8 text-white text-right text-sm focus:outline-none focus:border-nexus-teal/50 font-mono tracking-tight transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm text-white/80 border-t border-white/5 pt-4">
            <span className="text-[13px] font-bold uppercase tracking-widest not-italic">หลังหักส่วนลด</span>
            <span className="font-mono tracking-tight text-base">฿ {summary.subTotalAfterDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm text-white/80">
            <span className="text-[13px] font-bold uppercase tracking-widest not-italic">
              ภาษีมูลค่าเพิ่ม ({formData.taxDisplayMode === 'NON_VAT' ? '0%' : '7%'})
            </span>
            <span className="font-mono tracking-tight text-base">฿ {summary.vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="space-y-2 pb-4">
            <div className="flex justify-between items-center text-sm text-white/80">
              <span className="text-[13px] font-bold uppercase tracking-widest not-italic">หัก ณ ที่จ่าย</span>
              <select
                value={formData.whtRate}
                onChange={(e) => setFormData({...formData, whtRate: Number(e.target.value)})}
                className="w-20 bg-black/15 border border-white/10 rounded-full px-3 h-8 text-white text-right text-sm focus:outline-none focus:border-nexus-teal/50 font-mono tracking-tight transition-all appearance-none"
              >
                <option value={0}>0%</option>
                <option value={1}>1%</option>
                <option value={2}>2%</option>
                <option value={3}>3%</option>
                <option value={5}>5%</option>
              </select>
            </div>
            {formData.whtRate > 0 && (
              <div className="text-right font-mono tracking-tight text-red-400 text-sm">
                - ฿ {summary.whtAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-nexus-teal/20 space-y-2">
          <div className="flex justify-between items-center text-nexus-teal">
            <span className="text-sm font-black tracking-widest uppercase not-italic">ยอดสุทธิ</span>
            <span className="text-2xl font-black font-mono tracking-tight">฿ {summary.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="text-xs text-right font-black text-nexus-teal/60 bg-transparent px-3 py-1.5 rounded-full not-italic">
            ({summary.thaiBahtText})
          </div>
        </div>
      </div>
      
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 shadow-2xl">
        <div className="text-xs text-blue-400/80 leading-relaxed font-bold not-italic">
          * การคำนวณภาษีและยอดสุทธิอิงตามรูปแบบ {formData.taxDisplayMode} และมีการหัก ณ ที่จ่ายรวมอยู่ในยอดรับสุทธิแล้ว (กรณีมียอด WHT)
        </div>
      </div>
    </div>
  );
}
