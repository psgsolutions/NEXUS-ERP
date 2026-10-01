"use client";

import React from "react";
import { Plus, Trash2, Truck, Star, ShieldCheck } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { SmartSelect, StepperInput } from "@/components/ui/SmartComponents";
import { ProductSupplierInfo } from "@/types/inventory";

interface SupplierMatrixProps {
  supplierConfig: ProductSupplierInfo[];
  suppliersList: { value: string; label: string }[];
  onChange: (config: ProductSupplierInfo[]) => void;
}

export function SupplierMatrix({
  supplierConfig,
  suppliersList,
  onChange
}: SupplierMatrixProps) {
  const handleAddSupplier = () => {
    const newSupplier: ProductSupplierInfo = {
      supplierId: suppliersList[0]?.value || "SUPP-001",
      supplierSku: "",
      mpn: "",
      latestCost: 0,
      leadTimeDays: 7,
      moq: 1,
      isPrimary: supplierConfig.length === 0,
      supplierWarrantyPeriod: 12
    };
    onChange([...supplierConfig, newSupplier]);
  };

  const handleRemoveSupplier = (index: number) => {
    const updated = supplierConfig.filter((_, i) => i !== index);
    // Ensure at least one remaining is primary if any exist
    if (updated.length > 0 && !updated.some(s => s.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  const handleSetPrimary = (index: number) => {
    const updated = supplierConfig.map((s, i) => ({
      ...s,
      isPrimary: i === index
    }));
    onChange(updated);
  };

  const handleUpdateSupplier = (index: number, field: keyof ProductSupplierInfo, value: any) => {
    const updated = supplierConfig.map((s, i) => {
      if (i !== index) return s;
      return { ...s, [field]: value };
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4 bg-black/40 p-5 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-nexus-teal">
          <Truck size={16} />
          <h6 className="text-xs font-semibold uppercase tracking-widest text-white">ตารางบริหารซัพพลายเออร์หลายรายและเปรียบเทียบราคา</h6>
        </div>
        <PillButton
          variant="glass"
          type="button"
          onClick={handleAddSupplier}
          className="px-4 h-8 text-xs font-bold text-nexus-teal hover:bg-nexus-teal/20 rounded-full flex items-center gap-1.5"
        >
          <Plus size={13} />
          <span>เพิ่มผู้จำหน่ายสำรอง</span>
        </PillButton>
      </div>

      {supplierConfig.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-white/10 rounded-xl space-y-1">
          <p className="text-xs text-white/40 font-bold">ยังไม่มีข้อมูลผู้จำหน่าย</p>
          <p className="text-[10px] text-white/30">กดปุ่ม "เพิ่มผู้จำหน่ายสำรอง" เพื่อเปรียบเทียบราคาและระยะเวลารอคอยสินค้าจากซัพพลายเออร์หลายราย</p>
        </div>
      ) : (
        <div className="space-y-3">
          {supplierConfig.map((supplier, idx) => (
            <div 
              key={idx} 
              className={cn(
                "p-4 rounded-xl border space-y-3 relative group transition-all",
                supplier.isPrimary ? "bg-nexus-teal/5 border-nexus-teal/30" : "bg-white/[0.02] border-white/10 hover:border-white/20"
              )}
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 flex items-center justify-between">
                    <span>ผู้จำหน่าย</span>
                    {supplier.isPrimary && (
                      <span className="text-[9px] font-black text-nexus-teal flex items-center gap-0.5">
                        <Star size={10} className="fill-nexus-teal" /> หลัก
                      </span>
                    )}
                  </label>
                  <SmartSelect
                    options={suppliersList}
                    value={supplier.supplierId}
                    onChange={(val) => handleUpdateSupplier(idx, "supplierId", val)}
                    placeholder="เลือกผู้จำหน่าย..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">รหัสสินค้าซัพพลายเออร์</label>
                  <PillInput
                    value={supplier.supplierSku || ""}
                    onChange={(e) => handleUpdateSupplier(idx, "supplierSku", e.target.value)}
                    placeholder="Supplier SKU..."
                    className="w-full h-9 px-4 rounded-full font-mono text-right"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">ราคาทุนล่าสุด (฿)</label>
                  <StepperInput
                    value={supplier.latestCost || 0}
                    onChange={(val) => handleUpdateSupplier(idx, "latestCost", val)}
                    className="text-right font-bold text-danger font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">ระยะเวลารอคอย (วัน)</label>
                  <StepperInput
                    value={supplier.leadTimeDays || 7}
                    onChange={(val) => handleUpdateSupplier(idx, "leadTimeDays", val)}
                    className="text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">จำนวนสั่งซื้อขั้นต่ำ (MOQ)</label>
                  <StepperInput
                    value={supplier.moq || 1}
                    onChange={(val) => handleUpdateSupplier(idx, "moq", val)}
                    className="text-center font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">ระยะเวลารับประกัน (เดือน)</label>
                  <StepperInput
                    value={supplier.supplierWarrantyPeriod || 12}
                    onChange={(val) => handleUpdateSupplier(idx, "supplierWarrantyPeriod", val)}
                    className="text-center font-bold text-nexus-teal"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handleSetPrimary(idx)}
                  className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5",
                    supplier.isPrimary 
                      ? "bg-nexus-teal/20 border-nexus-teal text-nexus-teal" 
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                  )}
                >
                  <ShieldCheck size={12} />
                  <span>{supplier.isPrimary ? "ผู้จำหน่ายหลัก" : "ตั้งเป็นผู้จำหน่ายหลัก"}</span>
                </button>

                {supplierConfig.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSupplier(idx)}
                    className="text-white/30 hover:text-danger p-1 rounded-md transition-colors"
                    title="ลบซัพพลายเออร์นี้"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
