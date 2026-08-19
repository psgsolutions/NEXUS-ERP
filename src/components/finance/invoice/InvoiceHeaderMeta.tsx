"use client";

import { useInvoiceForm } from "@/context/InvoiceFormContext";
import { PillInput } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { ShieldCheck, ShoppingCart, Calendar } from "lucide-react";

export function InvoiceHeaderMeta() {
  const { formData, setFormData, salesOrders, handleSOChange } = useInvoiceForm();

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
      <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2 mb-4 not-italic">
        <ShieldCheck size={14} /> ข้อมูลเอกสาร
      </h3>
      
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
            <ShoppingCart size={12} className="text-nexus-teal" /> อ้างอิงใบสั่งขาย <span className="text-red-500 font-bold">*</span> (Select SO)
          </label>
          <SmartSelect
            value={formData.soId}
            onChange={handleSOChange}
            options={salesOrders?.map(so => ({
              value: so.id,
              label: `${so.soCode || so.documentNo || so.id} : ${so.customerName || so.customer?.name || so.customer || 'ไม่ระบุลูกค้า'}`,
            })) || []}
            placeholder="-- ค้นหาและเลือกใบสั่งขาย --"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              วันที่ออก (Issue Date)
            </label>
            <PillInput 
              type="date"
              value={formData.issueDate}
              onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
              <Calendar size={12} className="text-nexus-teal" /> วันครบกำหนด <span className="text-red-500 font-bold">*</span> (Due Date)
            </label>
            <PillInput 
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
