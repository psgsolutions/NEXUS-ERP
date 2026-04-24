"use client";

import React, { useState } from "react";
import { MapPin, Search, Sparkles } from "lucide-react";
import { PillInput, cn } from "./Base";

export interface ThaiAddress {
  subDistrict: string;
  district: string;
  province: string;
  zipCode: string;
}

interface SmartAddressPickerProps {
  onSelect: (addr: ThaiAddress) => void;
  className?: string;
}

export function SmartAddressPicker({ onSelect, className }: SmartAddressPickerProps) {
  const [query, setQuery] = useState("");

  // Simplified mock for the demo
  const handleSearch = () => {
    // In a real app, this would query a Thai address database
    if (query.includes("ตากสิน")) {
      onSelect({
        subDistrict: "สมเด็จเจ้าพระยา",
        district: "คลองสาน",
        province: "กรุงเทพมหานคร",
        zipCode: "10600"
      });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-nexus-teal">
          <Sparkles size={16} className="animate-pulse" />
        </div>
        <PillInput 
          placeholder="พิมพ์ แขวง/ตำบล หรือ รหัสไปรษณีย์ เพื่อค้นหาที่อยู่อัจฉริยะ..."
          className="w-full pl-12 pr-12"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          onClick={handleSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal hover:bg-nexus-teal hover:text-black transition-all"
        >
          <Search size={14} />
        </button>
      </div>
    </div>
  );
}
