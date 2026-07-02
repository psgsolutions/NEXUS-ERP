"use client";

import React, { useState, useEffect, useRef } from "react";
import { PillInput, cn } from "./Base";

export interface ThaiAddress {
  subDistrict: string;
  district: string;
  province: string;
  zipCode: string;
}

// Global cache for DB so we only fetch once
let cachedDb: any[] | null = null;

export function ThaiAddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (addr: ThaiAddress) => void;
  placeholder?: string;
  className?: string;
}) {
  const [db, setDb] = useState<any[]>(cachedDb || []);
  const [suggestions, setSuggestions] = useState<ThaiAddress[]>([]);
  const [show, setShow] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cachedDb) {
      fetch('/data/thailand_addresses.json')
        .then(res => res.json())
        .then(data => {
          cachedDb = data;
          setDb(data);
        })
        .catch(err => console.error("Failed to load Thai addresses", err));
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    const q = e.target.value.trim().toLowerCase();
    
    if (q.length < 2 || db.length === 0) {
      setSuggestions([]);
      setShow(false);
      return;
    }

    const filtered = db.filter(item => 
      item.district.includes(q) ||
      item.amphoe.includes(q) ||
      item.province.includes(q) ||
      String(item.zipcode).includes(q)
    ).slice(0, 50); // limit to 50 results

    // Remove duplicates
    const unique = Array.from(new Set(filtered.map(i => JSON.stringify({
      subDistrict: i.district,
      district: i.amphoe,
      province: i.province,
      zipCode: String(i.zipcode)
    })))).map(s => JSON.parse(s));

    setSuggestions(unique.slice(0, 10)); // show top 10
    setShow(unique.length > 0);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <PillInput 
        value={value} 
        onChange={handleInputChange} 
        onFocus={() => { if (suggestions.length > 0) setShow(true); }}
        placeholder={placeholder}
        className={className}
      />
      {show && (
        <div className="absolute top-full left-0 mt-2 min-w-[250px] bg-[#1A1A20] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100] max-h-60 overflow-y-auto custom-scrollbar flex flex-col">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              className="text-left px-4 py-3 hover:bg-nexus-teal/20 focus:bg-nexus-teal/20 outline-none transition-colors border-b border-white/5 last:border-0 flex flex-col gap-1"
              onClick={(e) => {
                e.preventDefault();
                onSelect(s);
                setShow(false);
              }}
            >
              <div className="text-[12px] font-bold text-white/90">
                ต.{s.subDistrict} อ.{s.district} จ.{s.province}
              </div>
              <div className="text-[10px] font-mono text-nexus-teal">
                รหัสไปรษณีย์: {s.zipCode}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
