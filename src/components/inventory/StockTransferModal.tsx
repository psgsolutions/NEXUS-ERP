"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeftRight, 
  Package, 
  ShieldCheck, 
  MapPin,
  X,
  Search
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  NexusDataField,
} from "@/components/ui/Base";
import { useInventory } from "@/hooks/useInventory";
import { useSystemDialog } from "@/context/DialogContext";
import { cn } from "@/lib/utils";

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void> | void;
}

export function StockTransferModal({ isOpen, onClose, onConfirm }: StockTransferModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const { products } = useInventory();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    fromWarehouse: "MAIN",
    toWarehouse: "RAYONG",
    requester: "Kriangkrai M.",
    reason: "Stock Replenishment",
    productId: "",
    qty: 1
  });

  const selectedProduct = products.find(p => p.id === formData.productId);

  useEffect(() => {
    if (isOpen && products.length > 0) {
      setFormData(prev => ({
        ...prev,
        productId: products[0]?.id || ""
      }));
    }
  }, [isOpen, products]);

  const handleConfirm = async () => {
    if (!formData.productId) return void showAlert("กรุณาเลือกพัสดุ");
    if (formData.qty <= 0) return void showAlert("จำนวนต้องมากกว่า 0");
    if (formData.fromWarehouse === formData.toWarehouse) return void showAlert("คลังต้นทางและปลายทางต้องไม่เหมือนกัน");
    
    if (selectedProduct && (selectedProduct.stockStatus?.onHand || 0) < formData.qty) {
      return void showAlert(`สต็อกไม่เพียงพอในคลังต้นทาง (คงเหลือ: ${selectedProduct.stockStatus?.onHand || 0})`);
    }

    setIsSaving(true);
    try {
      await onConfirm(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ระบบโอนย้ายพัสดุระหว่างคลัง (STOCKS TRANSFER)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
               <div className="space-y-1">
                  <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]">Inter-Warehouse Logistics</p>
                  <h4 className="text-xl font-black text-white uppercase tracking-tight">บันทึกโอนย้ายพัสดุ</h4>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-10">
               <div className="space-y-8">
                  <div className="flex items-center gap-3 text-nexus-blue">
                     <MapPin size={18} />
                     <h5 className="text-[13px] font-black uppercase tracking-widest">1. เส้นทางการโอนย้าย (Transfer Route)</h5>
                  </div>
                  <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <Field label="คลังต้นทาง (From)">
                           <PillSelect 
                             value={formData.fromWarehouse}
                             onChange={(e) => setFormData({...formData, fromWarehouse: e.target.value})}
                             className="w-full text-danger border-danger/20 bg-danger/5"
                           >
                              <option value="MAIN">Main Warehouse</option>
                              <option value="RAYONG">Site Warehouse (Rayong)</option>
                           </PillSelect>
                        </Field>
                        <Field label="คลังปลายทาง (To)">
                           <PillSelect 
                             value={formData.toWarehouse}
                             onChange={(e) => setFormData({...formData, toWarehouse: e.target.value})}
                             className="w-full text-nexus-teal border-nexus-teal/20 bg-nexus-teal/5"
                           >
                              <option value="RAYONG">Site Warehouse (Rayong)</option>
                              <option value="MAIN">Main Warehouse</option>
                           </PillSelect>
                        </Field>
                     </div>
                     <Field label="ผู้ทำรายการ (Requested By)">
                        <PillSelect 
                          value={formData.requester}
                          onChange={(e) => setFormData({...formData, requester: e.target.value})}
                          className="w-full"
                        >
                           <option value="Kriangkrai M.">Kriangkrai M.</option>
                           <option value="Somchai J.">Somchai J.</option>
                        </PillSelect>
                     </Field>
                     <Field label="วัตถุประสงค์ (Purpose / Reason)">
                        <PillSelect 
                          value={formData.reason}
                          onChange={(e) => setFormData({...formData, reason: e.target.value})}
                          className="w-full"
                        >
                           <option value="Stock Replenishment">เติมสต็อกสินค้า (Replenishment)</option>
                           <option value="Site Installation">เบิกใช้หน้างาน (Installation)</option>
                           <option value="RMA / Return">ส่งคืน / เคลมสินค้า (RMA)</option>
                        </PillSelect>
                     </Field>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="flex items-center gap-3 text-white">
                     <Package size={18} />
                     <h5 className="text-[13px] font-black uppercase tracking-widest">2. รายการพัสดุ (Items Selection)</h5>
                  </div>
                  <div className="space-y-6">
                     <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
                        <Field label="เลือกพัสดุ">
                           <PillSelect 
                             value={formData.productId}
                             onChange={(e) => setFormData({...formData, productId: e.target.value})}
                             className="w-full"
                           >
                              <option value="">เลือกพัสดุ...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                              ))}
                           </PillSelect>
                        </Field>
                        
                        <div className="space-y-3">
                           <p className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">รายละเอียดการโอน</p>
                           {selectedProduct && (
                             <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 group hover:border-nexus-blue/30 transition-all">
                                <div className="space-y-1">
                                   <p className="text-sm font-black text-white">{selectedProduct.name}</p>
                                   <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">คงเหลือในคลัง: {selectedProduct.stockStatus?.onHand || 0} หน่วย</p>
                                </div>
                                <div className="flex items-center gap-4">
                                   <PillInput 
                                     type="number" 
                                     value={formData.qty}
                                     onChange={(e) => setFormData({...formData, qty: Number(e.target.value)})}
                                     placeholder="Qty" 
                                     className="w-24 h-10 text-center font-black" 
                                   />
                                </div>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="w-[380px] bg-[#0F0F12] p-12 flex flex-col border-l border-white/5 overflow-y-auto custom-scrollbar">
           <div className="flex-1 space-y-10">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">Logistics Intelligence</p>
                <h5 className="text-sm font-black text-white uppercase tracking-tight">Security & Audit</h5>
              </div>

              <div className="p-8 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/20 space-y-6">
                 <NexusDataField label="สถานะการโอน" value="READY" className="text-nexus-teal" />
                 <NexusDataField label="ลำดับความสำคัญ" value="NORMAL" />
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                 <p className="text-[11px] text-white/40 font-bold leading-relaxed uppercase tracking-widest">
                    * รายการจะถูก 'Soft Reserve' ในคลังต้นทางทันทีที่กดยืนยัน และจะตัดสต็อกจริงเมื่อคลังปลายทางกดยืนยันการรับ
                 </p>
              </div>
           </div>

           <div className="space-y-4">
              <PillButton 
                className={cn("w-full px-8 shadow-neon-blue uppercase tracking-[0.2em]", isSaving && "opacity-50 pointer-events-none")} 
                onClick={handleConfirm}
                disabled={isSaving}
              >
                 <ShieldCheck size={22} className={isSaving ? "animate-pulse" : ""} />
                 {isSaving ? "กำลังบันทึก..." : "ยืนยันการโอน (INITIATE)"}
              </PillButton>
              <PillButton 
                variant="glass" 
                className={cn("w-full text-white/20 hover:text-white uppercase tracking-widest", isSaving && "opacity-50 pointer-events-none")} 
                onClick={onClose}
                disabled={isSaving}
              >
                 ยกเลิก
              </PillButton>
           </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
