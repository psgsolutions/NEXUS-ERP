"use client";

import React, { useState, useEffect } from "react";
import { 
  Truck, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Package, 
  Search,
  FileText,
  Warehouse,
  Barcode,
  CheckCircle2,
  X
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function GoodsReceiptModal({ isOpen, onClose, onSave }: GoodsReceiptModalProps) {
  const [activeTab, setActiveTab] = useState("header");
  const [items, setItems] = useState<any[]>([]);
  const [header, setHeader] = useState({
    poRef: "",
    supplier: "",
    receiptDate: new Date().toISOString().split('T')[0],
    deliveryNote: "",
    receivedBy: "Kriangkrai M.",
    warehouse: "Main Warehouse (Bangkok)"
  });

  const tabs = [
    { id: "header", label: "ข้อมูลการรับสินค้า" },
    { id: "items", label: "รายการพัสดุและ Serial" }
  ];

  const isDirty = items.length > 0 || header.poRef !== "" || header.deliveryNote !== "";

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Mock loading items from PO
  const loadPOItems = () => {
    if (!header.poRef) return alert("กรุณาระบุเลขที่ใบสั่งซื้อ");
    setItems([
      { id: 1, name: "Aruba AP-505", qtyOrdered: 10, qtyReceived: 10, unit: "Unit", warehouse: "Main", serials: "" },
      { id: 2, name: "CAT6 Cable 305m", qtyOrdered: 5, qtyReceived: 5, unit: "Roll", warehouse: "Main", serials: "" }
    ]);
    setHeader({...header, supplier: "Aruba Global (Thailand)"});
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = () => {
    if (items.length === 0) return alert("กรุณาระบุเลขที่ใบสั่งซื้อและตรวจสอบรายการ");
    onSave({ header, items });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="บันทึกการรับสินค้า (GOODS RECEIPT ENTRY)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">คลังพัสดุและจัดซื้อ (GR_PROT_V3.0)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">บันทึกรับสินค้า (GR)</h4>
              </div>
              <PillTabs 
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
              {activeTab === "header" && (
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    <Field label="เลขที่ใบสั่งซื้ออ้างอิง (PO Reference) *">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                           <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={18} />
                           <PillInput 
                             value={header.poRef}
                             onChange={(e) => setHeader({...header, poRef: e.target.value})}
                             placeholder="เช่น PO-2604-001" 
                             className="w-full pl-12" 
                           />
                        </div>
                        <PillButton onClick={loadPOItems} className="px-6 shadow-neon-teal">
                           <Search size={18} />
                           ดึงข้อมูล
                        </PillButton>
                      </div>
                    </Field>
                    <Field label="ชื่อผู้จำหน่าย (Auto-filled)">
                       <PillInput value={header.supplier} disabled className="w-full bg-white/[0.02] text-white/40" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <Field label="วันที่รับสินค้า">
                       <PillInput 
                        type="date"
                        value={header.receiptDate}
                        onChange={(e) => setHeader({...header, receiptDate: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                    <Field label="เลขที่ใบส่งของ (Delivery Note / Invoice)">
                       <PillInput 
                        value={header.deliveryNote}
                        onChange={(e) => setHeader({...header, deliveryNote: e.target.value})}
                        placeholder="ระบุเลขที่จากเอกสารคู่ค้า..." 
                        className="w-full text-nexus-teal" 
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <Field label="คลังสินค้าปลายทาง">
                       <PillSelect 
                        value={header.warehouse}
                        onChange={(e) => setHeader({...header, warehouse: e.target.value})}
                        className="w-full px-6"
                      >
                         <option>Main Warehouse (Bangkok)</option>
                         <option>Branch A (Rayong)</option>
                         <option>Service Center (Nonthaburi)</option>
                      </PillSelect>
                    </Field>
                    <Field label="พนักงานผู้รับสินค้า">
                       <PillInput value={header.receivedBy} disabled className="w-full bg-white/[0.02] text-white/40" />
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === "items" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[12px] font-black text-white/30 uppercase tracking-[0.2em]">รายการพัสดุที่รับเข้า (Received Items)</h4>
                    <span className="text-[11px] font-black text-nexus-teal uppercase tracking-widest">ตรวจนับและระบุ Serial Number</span>
                  </div>

                  <div className="space-y-4">
                    {items.length === 0 ? (
                        <div className="p-20 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                          <Package size={48} className="text-white/5" />
                          <p className="text-sm text-white/20 font-black uppercase tracking-widest">ยังไม่มีรายการพัสดุ (กรุณาดึงข้อมูลจาก PO)</p>
                       </div>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-xl space-y-6">
                          <div className="flex justify-between items-start">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/20">
                                   <Package size={20} />
                                </div>
                                <div>
                                   <p className="text-sm font-black text-white uppercase">{item.name}</p>
                                   <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">สั่งซื้อ: {item.qtyOrdered} {item.unit}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-6">
                                <div className="text-right">
                                   <label className="block text-[10px] font-black text-white/20 uppercase mb-1">จำนวนที่รับจริง</label>
                                   <PillInput 
                                      type="number" 
                                      value={item.qtyReceived}
                                      onChange={(e) => updateItem(item.id, "qtyReceived", parseFloat(e.target.value) || 0)}
                                      className="w-24 text-center font-black text-nexus-teal" 
                                   />
                                </div>
                             </div>
                          </div>
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 text-white/40 ml-1">
                                <Barcode size={14} />
                                <label className="text-[11px] font-black uppercase tracking-widest">Serial Numbers (ระบุแยกด้วย Enter)</label>
                             </div>
                              <textarea 
                                className="w-full h-32 rounded-xl bg-black/40 border border-white/5 text-white text-[12px] font-mono p-6 focus:outline-none focus:border-nexus-teal/40 transition-all placeholder:text-white/5"
                                placeholder="SN-XXXXXXX-001&#10;SN-XXXXXXX-002"
                                value={item.serials}
                                onChange={(e) => updateItem(item.id, "serials", e.target.value)}
                              />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[420px] flex flex-col bg-[#0F0F12] p-12 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปการรับพัสดุ</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Receipt Intelligence</h5>
            </div>

             <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 space-y-8 relative overflow-hidden group">
              <div className="space-y-4 relative z-10">
                <NexusDataField label="สถานะการรับ" value={items.some(i => i.qtyReceived < i.qtyOrdered) ? "PARTIAL" : "COMPLETE"} highlight />
                <NexusDataField label="จำนวนรายการ" value={`${items.length} รายการ`} />
                <NexusDataField label="คลังปลายทาง" value={header.warehouse.split(' ')[0]} />
              </div>

              <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-teal/5 blur-[50px] -translate-y-1/2 translate-x-1/2" />
            </div>

             <div className="p-6 rounded-xl bg-nexus-teal/5 border border-nexus-teal/10 flex items-start gap-4">
               <CheckCircle2 className="text-nexus-teal flex-shrink-0" size={18} />
               <p className="text-[11px] text-nexus-teal/60 font-bold uppercase leading-relaxed tracking-widest">
                  การรับสินค้าจะทำการเพิ่มสต็อกในคลัง {header.warehouse.split(' ')[0]} อัตโนมัติและอัปเดตสถานะ PO
               </p>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <PillButton className="w-full font-black uppercase tracking-[0.2em] shadow-neon-teal" onClick={handleSave}>
              <ShieldCheck size={22} />
              ยืนยันการรับสินค้า (CONFIRM GR)
            </PillButton>
            <PillButton variant="glass" className="w-full text-white/20 hover:text-white uppercase tracking-widest" onClick={handleClose}>
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
      <label className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
