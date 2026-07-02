// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Truck, 
  MapPin, 
  CreditCard,
  FileText,
  Calendar,
  Package,
  X
} from "lucide-react";
import { PillButton, PillInput, PillSelect, Modal, PillTabs, NexusDataField, CreatableCombobox, cn, NexusDatePicker } from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

interface SalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function SalesOrderModal({ isOpen, onClose, onSave }: SalesOrderModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();
  const { data: customers } = useRealtimeCollection("customers");

  const [activeTab, setActiveTab] = useState("header");
  const [items, setItems] = useState<any[]>([]);
  const [header, setHeader] = useState({
    customer: "",
    quotationRef: "",
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: "",
    shippingMethod: "ขนส่งบริษัท",
    shippingAddress: "",
    billingAddress: "",
    depositAmount: 0,
    paymentStatus: "pending"
  });

  const [summary, setSummary] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    balance: 0
  });

  const [autoGenerate, setAutoGenerate] = useState(true);

  const tabs = [
    { id: "header", label: "ข้อมูลพื้นฐานใบสั่งขาย" },
    { id: "items", label: "รายการสินค้าและบริการ" },
    { id: "logistics", label: "การขนส่งและสถานที่จัดส่ง" }
  ];

  useEffect(() => {
    const sub = items.reduce((acc, item) => acc + (item.qty * item.price), 0);
    const disc = items.reduce((acc, item) => acc + (item.discount || 0), 0);
    const afterDisc = sub - disc;
    const tax = afterDisc * 0.07;
    const total = afterDisc + tax;
    const balance = total - header.depositAmount;

    setSummary({ subtotal: sub, discount: disc, tax, total, balance });
  }, [items, header.depositAmount]);

  const addItem = () => {
    setItems([...items, { id: Date.now(), name: "ระบุพัสดุ...", qty: 1, unit: "Pcs", price: 0, discount: 0 }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const isDirty = items.length > 0 || header.customer !== "" || header.quotationRef !== "" || header.shippingAddress !== "";

  const handleClose = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (!header.customer || items.length === 0) return void showAlert("กรุณาระบุลูกค้าและรายการสินค้า");
    
    if (autoGenerate) {
      showAlert("✅ ยืนยันใบสั่งขายสำเร็จ!\n\nระบบ Master Blueprint ได้ทำการสร้าง:\n1. ใบสั่งจ้าง\n2. ใบสั่งซื้อ\n3. ใบส่งของ\n\nให้อัตโนมัติเรียบร้อยแล้ว!");
    }
    onSave({ header, items, summary, autoGenerate });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="เปิดใบสั่งขาย"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]">โหมดพาณิชย์ (COMMERCE_PROT_V3.1)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">บันทึกใบสั่งขาย</h4>
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
                    <Field label="ชื่อลูกค้า / นิติบุคคล *">
                      <CreatableCombobox 
                        value={header.customer}
                        onChange={(val) => setHeader({...header, customer: val})}
                        options={customers?.map((c: any) => ({ value: c.id, label: c.name })) || []}
                        placeholder="เลือกจากฐานข้อมูล..."
                        className="w-full"
                      />
                    </Field>
                    <Field label="อ้างอิงใบเสนอราคา">
                      <div className="relative">
                         <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={18} />
                         <PillInput 
                           value={header.quotationRef}
                           onChange={(e) => setHeader({...header, quotationRef: e.target.value})}
                           placeholder="เช่น QT-2604-001" 
                           className="w-full pl-12" 
                         />
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <Field label="วันที่สั่งซื้อ">
                      <NexusDatePicker value={header.orderDate}
                        onChange={(e) => setHeader({...header, orderDate: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                    <Field label="วันที่กำหนดส่งมอบ">
                      <NexusDatePicker value={header.deliveryDate}
                        onChange={(e) => setHeader({...header, deliveryDate: e.target.value})}
                        className="w-full text-nexus-blue" 
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-8 p-8 rounded-xl bg-white/[0.02] border border-white/5">
                    <Field label="จำนวนเงินมัดจำ">
                      <PillInput 
                        type="number"
                        value={header.depositAmount}
                        onChange={(e) => setHeader({...header, depositAmount: parseFloat(e.target.value) || 0})}
                        className="w-full text-nexus-teal font-black" 
                      />
                    </Field>
                    <Field label="สถานะการชำระเงิน">
                      <PillSelect 
                        value={header.paymentStatus}
                        onChange={(e) => setHeader({...header, paymentStatus: e.target.value})}
                        className="w-full px-6"
                      >
                        <option value="pending">Pending (รอชำระ)</option>
                        <option value="partial">Partial (ชำระบางส่วน)</option>
                        <option value="paid">Paid (ชำระเต็ม)</option>
                      </PillSelect>
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === "items" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[12px] font-black text-white/30 uppercase tracking-[0.2em]">รายการสินค้าที่สั่งซื้อ</h4>
                    <PillButton variant="glass" onClick={addItem}>
                      <Plus size={14} /> เพิ่มรายการ
                    </PillButton>
                  </div>

                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="bg-white/[0.02] border border-white/5 p-4 rounded-full group hover:border-white/10 transition-all space-y-4">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-5 px-3 flex items-center gap-3">
                             <Package size={16} className="text-white/20" />
                             <PillInput 
                               value={item.name}
                               onChange={(e) => updateItem(item.id, "name", e.target.value)}
                               className="w-full bg-transparent border-transparent px-0 font-bold" 
                             />
                          </div>
                          <div className="col-span-1">
                             <PillInput 
                               type="number"
                               value={item.qty}
                               onChange={(e) => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                               className="w-full text-center" 
                             />
                          </div>
                          <div className="col-span-1">
                             <PillInput 
                               value={item.unit}
                               onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                               className="w-full text-center text-[10px] font-black uppercase" 
                             />
                          </div>
                          <div className="col-span-2">
                             <PillInput 
                               type="number"
                               value={item.price}
                               onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                               className="w-full text-right font-mono" 
                             />
                          </div>
                          <div className="col-span-2">
                             <PillInput 
                               type="number"
                               value={item.discount}
                               onChange={(e) => updateItem(item.id, "discount", parseFloat(e.target.value) || 0)}
                               className="w-full text-right font-mono text-warning" 
                               placeholder="ลด"
                             />
                          </div>
                          <div className="col-span-1 flex justify-center">
                             <button onClick={() => removeItem(item.id)} className="text-white/10 hover:text-danger transition-colors">
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "logistics" && (
                <div className="space-y-10">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 text-nexus-blue"><Truck size={18} /><h4 className="text-[13px] font-black uppercase tracking-widest">ข้อมูลการจัดส่งสินค้า</h4></div>
                    <div className="space-y-6">
                       <Field label="วิธีการจัดส่ง">
                          <PillSelect 
                            value={header.shippingMethod}
                            onChange={(e) => setHeader({...header, shippingMethod: e.target.value})}
                            className="w-full px-6"
                          >
                             <option>ขนส่งบริษัท</option>
                             <option>Messenger / Lalamove</option>
                             <option>EMS / Kerry / Flash</option>
                             <option>ลูกค้ามารับเอง</option>
                          </PillSelect>
                       </Field>
                       <div className="grid grid-cols-2 gap-8">
                          <Field label="ที่อยู่ในการจัดส่ง">
                             <textarea 
                               className="w-full h-32 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold p-6 focus:outline-none focus:border-nexus-blue/40"
                               value={header.shippingAddress}
                               onChange={(e) => setHeader({...header, shippingAddress: e.target.value})}
                               placeholder="ระบุสถานที่ส่งสินค้า..."
                             />
                          </Field>
                          <Field label="ที่อยู่ในการออกใบเสร็จ">
                             <textarea 
                               className="w-full h-32 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold p-6 focus:outline-none focus:border-nexus-blue/40"
                               value={header.billingAddress}
                               onChange={(e) => setHeader({...header, billingAddress: e.target.value})}
                               placeholder="ระบุที่อยู่ตามใบกำกับภาษี..."
                             />
                          </Field>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[380px] flex flex-col bg-[#0F0F12] p-8 flex-shrink-0">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปมูลค่าใบสั่งขาย</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Order Summary</h5>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 space-y-6">
              <NexusDataField label="ยอดรวมสินค้า" value={`฿${summary.subtotal.toLocaleString()}`} />
              <NexusDataField label="ส่วนลดรวม" value={`- ฿${summary.discount.toLocaleString()}`} />
              <NexusDataField label="ภาษีมูลค่าเพิ่ม (7%)" value={`฿${summary.tax.toLocaleString()}`} />
              <NexusDataField label="ยอดสุทธิ" value={`฿${summary.total.toLocaleString()}`} highlight />
              <div className="pt-6 border-t border-white/5">
                 <NexusDataField label="ยอดมัดจำแล้ว" value={`฿${header.depositAmount.toLocaleString()}`} />
                 <NexusDataField label="ยอดค้างชำระ" value={`฿${summary.balance.toLocaleString()}`} highlight color="text-warning" />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-nexus-teal/5 border border-nexus-teal/20">
               <input 
                 type="checkbox" 
                 checked={autoGenerate} 
                 onChange={(e) => setAutoGenerate(e.target.checked)}
                 className="mt-1 w-4 h-4 rounded border-nexus-teal/30 bg-black/50 text-nexus-teal accent-nexus-teal focus:ring-nexus-teal"
               />
               <div className="space-y-1">
                 <label className="text-xs font-black text-white uppercase tracking-tight cursor-pointer" onClick={() => setAutoGenerate(!autoGenerate)}>
                   เปิดระบบอัตโนมัติ
                 </label>
                 <p className="text-[9px] text-white/50 leading-relaxed">
                   เมื่อยืนยัน SO ระบบจะสร้างใบสั่งซื้อ แบบ Exclude VAT, ใบสั่งจ้าง และใบส่งของ ให้อัตโนมัติทันที
                 </p>
               </div>
            </div>

            <PillButton className="w-full shadow-neon-teal uppercase tracking-[0.2em]" onClick={handleSave}>
              <ShieldCheck size={22} />
              ยืนยันการสั่งขาย
            </PillButton>
            <PillButton variant="ghost" className="w-full hover: uppercase tracking-widest" onClick={onClose}>
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

