"use client";

import React from "react";
import { PillInput } from "./Base";
import { ThaiAddressAutocomplete } from "./ThaiAddressAutocomplete";

export interface AddressData {
  addressNo?: string;
  moo?: string;
  soi?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  zipCode?: string;
  line1?: string; // fallback
}

interface AddressFormGroupProps {
  value: AddressData;
  onChange: (value: AddressData) => void;
  // If provided, renders an additional "Address Type" or "Label" field at the top
  showType?: boolean;
  typeValue?: string;
  onTypeChange?: (val: string) => void;
  typeOptions?: { value: string; label: string }[];
}

export function formatAddress(addr: AddressData): string {
  if (!addr) return "";
  let parts = [];
  if (addr.addressNo) parts.push(addr.addressNo);
  else if (addr.line1) parts.push(addr.line1); // fallback
  
  if (addr.moo) parts.push(`หมู่ ${addr.moo}`);
  if (addr.soi) parts.push(`ซอย${addr.soi}`);
  if (addr.road) parts.push(`ถนน${addr.road}`);
  
  // For BKK: แขวง/เขต, For other: ตำบล/อำเภอ
  const isBKK = addr.province?.includes("กรุงเทพ");
  if (addr.subDistrict) parts.push(isBKK ? `แขวง${addr.subDistrict}` : `ต.${addr.subDistrict}`);
  if (addr.district) parts.push(isBKK ? `เขต${addr.district}` : `อ.${addr.district}`);
  if (addr.province) parts.push(isBKK ? addr.province : `จ.${addr.province}`);
  if (addr.zipCode) parts.push(addr.zipCode);
  
  return parts.join(' ').trim();
}

export function parseAddress(str: string): AddressData {
  if (!str) return {};
  // Attempt simple parsing or just fallback to addressNo
  return { addressNo: str };
}

export function AddressFormGroup({ 
  value, 
  onChange,
  showType,
  typeValue,
  onTypeChange,
  typeOptions
}: AddressFormGroupProps) {
  
  const handleChange = (newAddr: AddressData) => {
    // Automatically compute the formatted line1 fallback
    const formatted = formatAddress(newAddr);
    onChange({ ...newAddr, line1: formatted });
  };

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {showType && onTypeChange && typeOptions && (
        <div className="mb-4">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">ประเภทที่อยู่</label>
          <select 
            className="w-full h-8 px-4 rounded-full bg-white/5 border border-white/10 text-white text-[11px] font-bold outline-none"
            value={typeValue || ""}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-[#1A1A20] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-6 md:col-span-8 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">บ้านเลขที่ / อาคาร / ชั้น</label>
          <PillInput 
            className="w-full h-8" 
            value={value.addressNo || ""} 
            onChange={(e) => handleChange({...value, addressNo: e.target.value})} 
            placeholder="เช่น 99/9 อาคาร A ชั้น 5"
          />
        </div>
        <div className="col-span-6 md:col-span-4 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">หมู่ที่</label>
          <PillInput className="w-full h-8" value={value.moo || ""} onChange={(e) => handleChange({...value, moo: e.target.value})} placeholder="ถ้ามี..." />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-6 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">ตรอก / ซอย</label>
          <PillInput className="w-full h-8" value={value.soi || ""} onChange={(e) => handleChange({...value, soi: e.target.value})} placeholder="ถ้ามี..." />
        </div>
        <div className="col-span-6 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">ถนน</label>
          <PillInput className="w-full h-8" value={value.road || ""} onChange={(e) => handleChange({...value, road: e.target.value})} placeholder="ถ้ามี..." />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-6 md:col-span-3 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">แขวง / ตำบล</label>
          <ThaiAddressAutocomplete 
            className="w-full h-8" 
            value={value.subDistrict || ""} 
            onChange={(e) => handleChange({...value, subDistrict: e.target.value})}
            onSelect={(s) => handleChange({...value, subDistrict: s.subDistrict, district: s.district, province: s.province, zipCode: s.zipCode})}
            placeholder="พิมพ์ตำบล..."
          />
        </div>
        <div className="col-span-6 md:col-span-3 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">เขต / อำเภอ</label>
          <ThaiAddressAutocomplete 
            className="w-full h-8" 
            value={value.district || ""} 
            onChange={(e) => handleChange({...value, district: e.target.value})}
            onSelect={(s) => handleChange({...value, subDistrict: s.subDistrict, district: s.district, province: s.province, zipCode: s.zipCode})}
            placeholder="พิมพ์อำเภอ..."
          />
        </div>
        <div className="col-span-6 md:col-span-3 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">จังหวัด</label>
          <ThaiAddressAutocomplete 
            className="w-full h-8" 
            value={value.province || ""} 
            onChange={(e) => handleChange({...value, province: e.target.value})}
            onSelect={(s) => handleChange({...value, subDistrict: s.subDistrict, district: s.district, province: s.province, zipCode: s.zipCode})}
            placeholder="พิมพ์จังหวัด..."
          />
        </div>
        <div className="col-span-6 md:col-span-3 space-y-1">
          <label className="text-[11px] font-medium text-white/20 uppercase tracking-widest ml-1">รหัสไปรษณีย์</label>
          <ThaiAddressAutocomplete 
            className="w-full h-8" 
            value={value.zipCode || ""} 
            onChange={(e) => handleChange({...value, zipCode: e.target.value})}
            onSelect={(s) => handleChange({...value, subDistrict: s.subDistrict, district: s.district, province: s.province, zipCode: s.zipCode})}
            placeholder="รหัสไปรษณีย์..."
          />
        </div>
      </div>
    </div>
  );
}
