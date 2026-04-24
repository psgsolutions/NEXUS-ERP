"use client";

import React, { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { PillButton, PillInput } from "@/components/ui/Base";
import { Package, Hash, Tag, DollarSign, Layers } from "lucide-react";

export const AddProductSheet = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    sku: "",
    initialQty: 0,
    unit: "Unit",
    avgCost: 0,
    pricePos: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with idService and Firebase
    console.log("Saving product:", formData);
    onClose();
  };

  return (
    <Sheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="เพิ่มรายการพัสดุใหม่" 
      description="ระบุข้อมูลพื้นฐานเพื่อสร้างรหัสพิกัดพัสดุ (SKU) ใหม่ในระบบ"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <SectionTitle icon={<Package size={14} />} title="ข้อมูลพื้นฐาน" />
          
          <div className="space-y-1">
            <Label>ชื่อพัสดุ / สินค้า</Label>
            <PillInput 
              placeholder="ระบุชื่อพัสดุ" 
              className="w-full h-10" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>หมวดหมู่</Label>
              <PillInput 
                placeholder="เช่น Network" 
                className="w-full h-10"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <Label>รหัส SKU (เว้นว่างเพื่อรันออโต้)</Label>
              <PillInput 
                placeholder="SKU-24-XXXX" 
                className="w-full h-10 font-mono text-nexus-blue"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle icon={<Layers size={14} />} title="สต็อกและหน่วยนับ" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>จำนวนเริ่มต้น</Label>
              <PillInput 
                type="number"
                placeholder="0" 
                className="w-full h-10 mono-numbers"
                value={formData.initialQty}
                onChange={(e) => setFormData({...formData, initialQty: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <Label>หน่วยนับ</Label>
              <PillInput 
                placeholder="Unit / Pcs" 
                className="w-full h-10"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle icon={<DollarSign size={14} />} title="การเงินและต้นทุน" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>ต้นทุนต่อหน่วย (WAC)</Label>
              <PillInput 
                type="number"
                placeholder="0.00" 
                className="w-full h-10 mono-numbers"
                value={formData.avgCost}
                onChange={(e) => setFormData({...formData, avgCost: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <Label>ราคาขายหน้าร้าน (POS)</Label>
              <PillInput 
                type="number"
                placeholder="0.00" 
                className="w-full h-10 mono-numbers text-nexus-teal"
                value={formData.pricePos}
                onChange={(e) => setFormData({...formData, pricePos: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 flex gap-3">
          <PillButton type="button" variant="ghost" className="flex-1" onClick={onClose}>ยกเลิก</PillButton>
          <PillButton type="submit" className="flex-1 shadow-nexus-glow">บันทึกข้อมูล</PillButton>
        </div>
      </form>
    </Sheet>
  );
};

const SectionTitle = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
  <div className="flex items-center gap-2 text-nexus-blue border-b border-white/5 pb-2 mb-4">
    {icon}
    <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-4">
    {children}
  </label>
);
