"use client";

import React from "react";
import { Plus, Trash2, Layers, Barcode as BarcodeIcon } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { SmartSelect, StepperInput } from "@/components/ui/SmartComponents";
import { ProductConversion } from "@/types/inventory";

interface UomHierarchyBuilderProps {
  baseUnit: string;
  conversions: ProductConversion[];
  onChange: (conversions: ProductConversion[]) => void;
}

const uomOptions = [
  { value: "กล่อง", label: "กล่อง" },
  { value: "ลัง", label: "ลัง" },
  { value: "แพ็ค", label: "แพ็ค" },
  { value: "ม้วน", label: "ม้วน" },
  { value: "ขด", label: "ขด" },
  { value: "ถุง", label: "ถุง" },
  { value: "พาเลท", label: "พาเลท" },
];

export function UomHierarchyBuilder({
  baseUnit,
  conversions,
  onChange
}: UomHierarchyBuilderProps) {
  const handleAddTier = () => {
    const newTier: ProductConversion = {
      toUnit: "กล่อง",
      relativeRate: 10,
      relativeToUnit: baseUnit || "ชิ้น",
      rateToBase: 10,
      barcode: "",
      weightKg: 0,
      dimensions: { w: 0, l: 0, h: 0 }
    };
    onChange([...conversions, newTier]);
  };

  const handleRemoveTier = (index: number) => {
    const updated = conversions.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleUpdateTier = (index: number, field: keyof ProductConversion, value: any) => {
    const updated = conversions.map((tier, i) => {
      if (i !== index) return tier;
      const nextTier = { ...tier, [field]: value };
      
      // Calculate rateToBase automatically based on preceding tiers if needed
      if (field === "relativeRate") {
        nextTier.rateToBase = Number(value) || 1;
      }
      return nextTier;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4 bg-black/40 p-5 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-nexus-teal">
          <Layers size={16} />
          <h6 className="text-xs font-semibold uppercase tracking-widest text-white">โครงสร้างบรรจุภัณฑ์และบาร์โค้ดหลายระดับ</h6>
        </div>
        <PillButton
          variant="glass"
          type="button"
          onClick={handleAddTier}
          className="px-4 h-8 text-xs font-bold text-nexus-teal hover:bg-nexus-teal/20 rounded-full flex items-center gap-1.5"
        >
          <Plus size={13} />
          <span>เพิ่มระดับบรรจุภัณฑ์</span>
        </PillButton>
      </div>

      {conversions.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-white/10 rounded-xl space-y-1">
          <p className="text-xs text-white/40 font-bold">ยังไม่มีบรรจุภัณฑ์ขั้นสูง (ใช้หน่วยนับหลัก {baseUnit || "ชิ้น"})</p>
          <p className="text-[10px] text-white/30">กดปุ่ม "เพิ่มระดับบรรจุภัณฑ์" เพื่อกำหนดขนาดกล่อง ลัง หรือพาเลท พร้อมบาร์โค้ดแยกตามระดับ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversions.map((tier, idx) => (
            <div 
              key={idx} 
              className="bg-white/[0.02] border border-white/10 p-4 rounded-xl space-y-3 relative group hover:border-white/20 transition-all"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">หน่วยบรรจุภัณฑ์</label>
                  <SmartSelect
                    options={uomOptions}
                    value={tier.toUnit}
                    onChange={(val) => handleUpdateTier(idx, "toUnit", val)}
                    placeholder="เลือกหน่วย..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">1 {tier.toUnit} บรรจุเท่ากับ</label>
                  <StepperInput
                    value={tier.relativeRate}
                    onChange={(val) => handleUpdateTier(idx, "relativeRate", val)}
                    className="text-center font-bold text-nexus-teal"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">เทียบกับหน่วย</label>
                  <PillInput
                    value={tier.relativeToUnit || baseUnit || "ชิ้น"}
                    onChange={(e) => handleUpdateTier(idx, "relativeToUnit", e.target.value)}
                    className="w-full h-9 px-4 rounded-full text-center font-bold text-white/70 bg-white/5"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 flex items-center gap-1">
                    <BarcodeIcon size={12} className="text-nexus-teal" />
                    <span>บาร์โค้ดบรรจุภัณฑ์</span>
                  </label>
                  <PillInput
                    value={tier.barcode}
                    onChange={(e) => handleUpdateTier(idx, "barcode", e.target.value)}
                    placeholder="สแกนบาร์โค้ดระดับนี้..."
                    className="w-full h-9 px-4 rounded-full font-mono text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-white/40">
                  อัตราส่วนสุทธิ: <span className="text-nexus-teal font-mono">1 {tier.toUnit} = {tier.relativeRate} {baseUnit}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTier(idx)}
                  className="text-white/30 hover:text-danger p-1 rounded-md transition-colors"
                  title="ลบระดับนี้"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
