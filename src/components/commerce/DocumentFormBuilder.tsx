import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Box, Calendar, User, Search, MapPin, Phone, Mail, Signature, FileText } from "lucide-react";
import { PillInput, PillButton, CreatableCombobox, NexusDatePicker, cn } from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { convertNumberToThaiText, formatCurrency } from "@/lib/erp-logic";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { nexusSequenceEngine } from "@/lib/sequence-engine";

export interface DocItem {
  id: string;
  type: "main" | "sub";
  code: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number;
}

export interface DocumentFormBuilderProps {
  currentCompanyId: string;
}

export function DocumentFormBuilder({ currentCompanyId }: DocumentFormBuilderProps) {
  const { data: customers } = useRealtimeCollection("customers");
  const [customer, setCustomer] = useState({
    name: "บริษัท ตัวอย่าง จำกัด (มหาชน)",
    taxId: "01075xxxxxxxx",
    address: "123 ถนนสุขุมวิท แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพฯ 10110",
    contactName: "คุณสมชาย ใจดี",
    phone: "02-123-4567",
    email: "somchai@example.com",
  });

  const [docMeta, setDocMeta] = useState({
    docNo: "QT-[YYMM]-XXXX", // Will be populated dynamically
    date: new Date().toISOString().split('T')[0], // Use native date format for NexusDatePicker
    validity: "30 วัน",
    deliveryTime: "15-30 วัน",
    paymentTerms: "เครดิต 30 วัน",
  });

  useEffect(() => {
    if (currentCompanyId) {
      // ดึงค่า Document No อัตโนมัติจากชุดการตั้งค่าขององค์กร
      nexusSequenceEngine("QT", currentCompanyId)
        .then(seq => setDocMeta(prev => ({...prev, docNo: seq})))
        .catch(console.error);
    }
  }, [currentCompanyId]);

  const [items, setItems] = useState<DocItem[]>([
    { id: "1", type: "main", code: "SV-001", description: "งานติดตั้งระบบ ERP (Phase 1)", qty: 1, unit: "Job", unitPrice: 150000, discount: 0 },
    { id: "2", type: "sub", code: "", description: "1.1 ติดตั้งฐานข้อมูล", qty: 1, unit: "Day", unitPrice: 0, discount: 0 },
    { id: "3", type: "sub", code: "", description: "1.2 ตั้งค่าเซิร์ฟเวอร์", qty: 1, unit: "Day", unitPrice: 0, discount: 0 },
  ]);

  const [discount, setDiscount] = useState(5000);
  const [remarks, setRemarks] = useState("1. สินค้ารับประกัน 1 ปี\n2. กำหนดส่งมอบอาจมีการเปลี่ยนแปลงหากลูกค้าส่งข้อมูลล่าช้า");

  // Calculations
  const subTotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  const afterDiscount = subTotal - discount;
  const vat = afterDiscount * 0.07;
  const grandTotal = afterDiscount + vat;
  const thaiText = convertNumberToThaiText(grandTotal);

  return (
    <div className="w-full mx-auto bg-[#0a0a0c] border border-white/10 rounded-[2rem] shadow-[0_0_40px_rgba(20,163,204,0.05)] overflow-hidden text-white flex flex-col font-sans">
      
      {/* HEADER SECTION */}
      <div className="p-8 border-b border-white/5 flex flex-col lg:flex-row gap-8 bg-white/[0.01]">
        {/* Left: Customer Info */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3">
             <User className="text-nexus-teal" size={20} />
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">ข้อมูลลูกค้า</h3>
          </div>
          <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4 relative overflow-hidden group">
            {/* Simulated Data Binding note */}
            <div className="absolute top-0 right-0 px-3 py-1 bg-nexus-teal/10 text-nexus-teal text-[9px] uppercase font-bold tracking-widest rounded-bl-xl border-l border-b border-nexus-teal/20">
               .where('companyId', '==', '{currentCompanyId}')
            </div>
            
            <div className="grid grid-cols-1 gap-4 mt-2">
               <div>
                 <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                    <span>ชื่อลูกค้า <span className="text-red-500">*</span> (Customer Name)</span>
                 </label>
                 <CreatableCombobox 
                   value={customer.name} 
                   onChange={val => {
                     const selected = customers?.find((c: any) => c.id === val || c.name === val);
                     if (selected) {
                       setCustomer({
                         name: selected.name,
                         taxId: selected.tax_id || selected.taxId || "",
                         address: selected.addresses?.[0]?.line1 || selected.address || "",
                         contactName: selected.contacts?.[0]?.name || selected.contact_person || "",
                         phone: selected.phone || "",
                         email: selected.email || ""
                       });
                     } else {
                       setCustomer({...customer, name: val});
                     }
                   }} 
                   options={customers?.map((c: any) => ({ value: c.id, label: c.name })) || []}
                   placeholder="เลือกชื่อลูกค้า..."
                   className="w-full"
                   allowCustom={true}
                 />
               </div>
               <div>
                 <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                    <span>ที่อยู่ <span className="text-red-500">*</span> (Address)</span>
                 </label>
                 <PillInput value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} className="w-full" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                        <span>เบอร์โทรศัพท์ <span className="text-red-500">*</span> (Phone Number)</span>
                     </label>
                     <PillInput value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="w-full" />
                  </div>
                  <div>
                     <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                        <span>อีเมล <span className="text-red-500">*</span> (Email)</span>
                     </label>
                     <PillInput value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} className="w-full" />
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right: Doc Meta */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3">
             <FileText className="text-nexus-teal" size={20} />
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">ข้อมูลเอกสาร</h3>
          </div>
          <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4 relative">
             <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                     <span>เลขที่เอกสาร <span className="text-red-500">*</span> (Document No.)</span>
                  </label>
                  <PillInput value={docMeta.docNo} onChange={e => setDocMeta({...docMeta, docNo: e.target.value})} className="w-full" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                     <span>วันที่ <span className="text-red-500">*</span> (Date)</span>
                  </label>
                  <NexusDatePicker value={docMeta.date} onChange={e => setDocMeta({...docMeta, date: e.target.value})} className="w-full" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                     <span>ยืนราคา <span className="text-red-500">*</span></span>
                  </label>
                  <PillInput value={docMeta.validity} onChange={e => setDocMeta({...docMeta, validity: e.target.value})} className="w-full" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                     <span>กำหนดส่ง <span className="text-red-500">*</span></span>
                  </label>
                  <PillInput value={docMeta.deliveryTime} onChange={e => setDocMeta({...docMeta, deliveryTime: e.target.value})} className="w-full" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-white/50 mb-1.5 block">
                     <span>เงื่อนไขการชำระเงิน <span className="text-red-500">*</span> (Payment Terms)</span>
                  </label>
                  <PillInput value={docMeta.paymentTerms} onChange={e => setDocMeta({...docMeta, paymentTerms: e.target.value})} className="w-full" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* BODY SECTION: DYNAMIC TABLE */}
      <div className="p-8">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">รายการสินค้าและบริการ</h3>
            <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">
               <Plus size={16} className="mr-2"/> เพิ่มรายการ
            </PillButton>
         </div>

         <div className="border border-white/10 rounded-[2rem] overflow-hidden bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-white/50 w-[80px] text-center">ลำดับ</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-white/50">รายละเอียด</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-white/50 w-[100px] text-center">จำนวน</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-white/50 w-[100px] text-center">หน่วย</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-white/50 w-[140px] text-right">ราคาต่อหน่วย</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-white/50 w-[140px] text-right">จำนวนเงิน</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {items.map((item, index) => (
                     <tr key={item.id} className={cn("group transition-colors hover:bg-white/[0.02]", item.type === "sub" ? "text-white/70" : "text-white")}>
                        <td className="py-3 px-6 text-center text-[13px] font-mono text-white/30">{index + 1}</td>
                        <td className="py-3 px-6">
                           <div className={cn("flex flex-col gap-1", item.type === "sub" && "pl-6 border-l-2 border-white/10")}>
                              {item.code && <span className="text-[10px] text-nexus-teal font-mono uppercase">{item.code}</span>}
                              <span className="text-[13px] font-medium">{item.description}</span>
                           </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono tracking-tight">
                           <NumberStepper 
                             size="sm"
                             value={item.qty} 
                             onChange={(newVal) => {
                               const newItems = [...items];
                               newItems[index].qty = newVal;
                               setItems(newItems);
                             }} 
                           />
                        </td>
                        <td className="py-3 px-6 text-center text-[12px] uppercase text-white/50">{item.unit}</td>
                        <td className="py-3 px-6 text-right font-mono tracking-tight text-[13px]">
                           {item.unitPrice > 0 ? item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2}) : ""}
                        </td>
                        <td className="py-3 px-6 text-right font-mono tracking-tight text-[13px] font-bold text-nexus-teal">
                           {(item.qty * item.unitPrice) > 0 ? (item.qty * item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2}) : ""}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* SUMMARY AND FOOTER SECTION */}
      <div className="p-8 border-t border-white/5 flex flex-col lg:flex-row gap-12 bg-black/40">
         {/* Left: Remarks & Signatures */}
         <div className="flex-1 flex flex-col justify-between space-y-8">
            <div className="space-y-3">
               <label className="text-[11px] font-medium text-white/50 block">
                  <span>หมายเหตุ <span className="text-red-500">*</span></span>
               </label>
               <textarea 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full h-24 rounded-[1.5rem] bg-white/[0.02] border border-white/10 p-4 text-[13px] text-white/80 focus:outline-none focus:border-nexus-teal/50 transition-all resize-none"
               />
            </div>
            
            <div className="flex items-center gap-8 pt-4">
               {/* Proposer */}
               <div className="flex-1 flex flex-col items-center space-y-4 relative">
                  <div className="w-full max-w-[200px] h-20 border-b-2 border-dashed border-white/20 flex items-end justify-center pb-2 relative group cursor-pointer hover:border-nexus-teal/50 transition-colors">
                     <span className="text-white/20 text-[10px] uppercase tracking-widest group-hover:text-nexus-teal/50 transition-colors">(ลายเซ็นผู้เสนอราคา)</span>
                     <Signature className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/5 opacity-0 group-hover:opacity-100 transition-opacity" size={48} />
                  </div>
                  <div className="text-center space-y-1">
                     <p className="text-[12px] font-medium text-white/80">ผู้เสนอราคา</p>
                     <p className="text-[10px] text-white/40 font-mono">วันที่: __/__/____</p>
                  </div>
               </div>
               
               {/* Approver */}
               <div className="flex-1 flex flex-col items-center space-y-4 relative">
                  <div className="w-full max-w-[200px] h-20 border-b-2 border-dashed border-white/20 flex items-end justify-center pb-2 relative group cursor-pointer hover:border-nexus-teal/50 transition-colors">
                     <span className="text-white/20 text-[10px] uppercase tracking-widest group-hover:text-nexus-teal/50 transition-colors">(ลายเซ็นผู้อนุมัติ)</span>
                     <Signature className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/5 opacity-0 group-hover:opacity-100 transition-opacity" size={48} />
                  </div>
                  <div className="text-center space-y-1">
                     <p className="text-[12px] font-medium text-white/80">ผู้อนุมัติ</p>
                     <p className="text-[10px] text-white/40 font-mono">วันที่: __/__/____</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Right: Financial Summary */}
         <div className="w-full max-w-[400px] bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 space-y-4 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-teal/5 blur-3xl pointer-events-none rounded-full" />
            
            <div className="flex justify-between items-center py-2 relative z-10">
               <span className="text-[12px] font-medium text-white/60">ยอดรวม</span>
               <span className="font-mono tracking-tight text-right text-[15px]">{subTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center py-2 relative z-10">
               <span className="text-[12px] font-medium text-white/60">ส่วนลด</span>
               <span className="font-mono tracking-tight text-right text-[15px] text-warning">-{discount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center py-2 relative z-10">
               <span className="text-[12px] font-medium text-white/60">หลังหักส่วนลด</span>
               <span className="font-mono tracking-tight text-right text-[15px]">{afterDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center py-2 relative z-10">
               <span className="text-[12px] font-medium text-white/60">ภาษีมูลค่าเพิ่ม 7%</span>
               <span className="font-mono tracking-tight text-right text-[15px]">{vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="pt-6 mt-4 border-t border-white/10 flex flex-col items-end relative z-10">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-nexus-teal mb-2">จำนวนเงินรวมทั้งสิ้น</span>
               <span className="text-3xl font-mono tracking-tight text-right font-black text-white drop-shadow-[0_0_10px_rgba(20,163,204,0.5)]">
                  {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
               </span>
               <div className="mt-3 px-4 py-2 bg-nexus-teal/10 rounded-full border border-nexus-teal/20 shadow-inner">
                  <span className="text-[12px] font-medium text-nexus-teal">{thaiText}</span>
               </div>
            </div>
         </div>
      </div>
      
    </div>
  );
}
