"use client";

import React, { useState, useEffect } from "react";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  ClipboardList,
  Calendar,
  Package,
  AlertTriangle,
  X
} from "lucide-react";
import { PillButton, PillInput, PillSelect, Modal, PillTabs, NexusDataField, cn, NexusDatePicker } from "@/components/ui/Base";

interface PurchaseRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function PurchaseRequestModal({ isOpen, onClose, onSave }: PurchaseRequestModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("header");
  const [items, setItems] = useState<any[]>([]);
  const [header, setHeader] = useState({
    requester: "Kriangkrai M.",
    department: "Engineering",
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: "",
    priority: "medium",
    projectRef: "",
    reason: ""
  });

  const tabs = [
    { id: "header", label: "ข้อมูลพื้นฐานการขอซื้อ" },
    { id: "items", label: "รายการพัสดุและบริการ" }
  ];

  const isDirty = items.length > 0 || header.requiredDate !== "" || header.reason !== "";

  const handleClose = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), name: "ระบุรายการ...", qty: 1, unit: "Unit", estPrice: 0 }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = () => {
    if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการที่ต้องการขอซื้อ");
    onSave({ header, items });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="ใบขอซื้อพัสดุ/บริการ"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">โหมดจัดซื้อจัดจ้าง (PROC_REQ_V3.1)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">บันทึกใบขอซื้อ</h4>
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
                    <Field label="ผู้ยื่นคำขอซื้อ">
                      <PillInput value={header.requester} disabled className="w-full bg-white/[0.02] text-white/40" />
                    </Field>
                    <Field label="หน่วยงาน / แผนก">
                      <PillSelect 
                        value={header.department}
                        onChange={(e) => setHeader({...header, department: e.target.value})}
                        className="w-full px-6"
                      >
                        <option>Engineering</option>
                        <option>Sales & Marketing</option>
                        <option>HR & Admin</option>
                        <option>Finance</option>
                      </PillSelect>
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                    <Field label="วันที่ยื่นคำขอ">
                      <NexusDatePicker value={header.requestDate} disabled className="w-full opacity-50" />
                    </Field>
                    <Field label="วันที่ต้องการใช้งาน *">
                      <NexusDatePicker value={header.requiredDate}
                        onChange={(e) => setHeader({...header, requiredDate: e.target.value})}
                        className="w-full text-nexus-teal" 
                      />
                    </Field>
                    <Field label="ลำดับความสำคัญ">
                      <PillSelect 
                        value={header.priority}
                        onChange={(e) => setHeader({...header, priority: e.target.value})}
                        className={cn(
                          "w-full px-6 font-black",
                          header.priority === "urgent" ? "text-danger" : "text-nexus-teal"
                        )}
                      >
                        <option value="low">LOW (ทั่วไป)</option>
                        <option value="medium">MEDIUM (ปกติ)</option>
                        <option value="high">HIGH (ด่วน)</option>
                        <option value="urgent">URGENT (ด่วนที่สุด)</option>
                      </PillSelect>
                    </Field>
                  </div>

                  <div className="space-y-6">
                    <Field label="โครงการที่อ้างอิง">
                      <PillInput 
                        value={header.projectRef}
                        onChange={(e) => setHeader({...header, projectRef: e.target.value})}
                        placeholder="เช่น PRJ-26-001 (ถ้ามี)..." 
                        className="w-full" 
                      />
                    </Field>
                    <Field label="วัตถุประสงค์ / ความจำเป็น *">
                      <textarea 
                        className="w-full h-32 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-6 focus:outline-none focus:border-nexus-teal/40 transition-all"
                        value={header.reason}
                        onChange={(e) => setHeader({...header, reason: e.target.value})}
                        placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..."
                      />
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === "items" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[12px] font-black text-white/30 uppercase tracking-[0.2em]">รายการที่เสนอขอซื้อ</h4>
                    <PillButton variant="glass" onClick={addItem}>
                      <Plus size={14} /> เพิ่มรายการ
                    </PillButton>
                  </div>

                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl group hover:border-white/10 transition-all space-y-4">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6 px-3 flex items-center gap-3">
                             <Package size={16} className="text-white/20" />
                             <PillInput 
                               value={item.name}
                               onChange={(e) => updateItem(item.id, "name", e.target.value)}
                               placeholder="ชื่อสินค้า / งานบริการ..."
                               className="w-full bg-transparent border-transparent px-0 font-black" 
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
                          <div className="col-span-2">
                             <PillInput 
                               value={item.unit}
                               onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                               className="w-full text-center text-[10px] font-black uppercase" 
                             />
                          </div>
                          <div className="col-span-2">
                             <PillInput 
                               type="number"
                               value={item.estPrice}
                               onChange={(e) => updateItem(item.id, "estPrice", parseFloat(e.target.value) || 0)}
                               className="w-full text-right font-mono" 
                               placeholder="ประมาณราคา"
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
            </div>
          </div>
        </div>

        <div className="w-[420px] flex flex-col bg-[#0F0F12] p-12 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปรายการคำขอซื้อ</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Request Briefing</h5>
            </div>

            <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 space-y-8 relative overflow-hidden group">
              <div className="space-y-4 relative z-10">
                <NexusDataField label="เลขที่ PR" value="PR-WAIT-GEN" />
                <NexusDataField label="ผู้อนุมัติลำดับที่ 1" value="Department Manager" />
                <NexusDataField label="วงเงินโดยประมาณ" value={`฿${items.reduce((acc, i) => acc + (i.qty * (i.estPrice || 0)), 0).toLocaleString()}`} highlight />
              </div>

              <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-teal/5 blur-[50px] -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="p-6 rounded-xl bg-warning/5 border border-warning/10 flex items-start gap-4">
               <AlertTriangle className="text-warning flex-shrink-0" size={18} />
               <p className="text-[11px] text-warning/60 font-bold uppercase leading-relaxed tracking-widest">
                  ใบขอซื้อนี้ต้องได้รับการอนุมัติจากหัวหน้าแผนกก่อนเข้าสู่กระบวนการจัดซื้อ
               </p>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <PillButton className="w-full font-black uppercase tracking-[0.2em] shadow-neon-teal" onClick={handleSave}>
              <ShieldCheck size={22} />
              ส่งขออนุมัติซื้อ
            </PillButton>
            <PillButton variant="ghost" className="w-full hover: uppercase tracking-widest" onClick={handleClose}>
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
