"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/components/ui/Base";
import { ChevronDown, Check } from "lucide-react";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
  unitPrice: number;
  cost: number;
  [key: string]: any; // Allow other fields
}

interface AsyncProductSelectProps {
  value: string;
  onChange: (productId: string, productData: ProductOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchBy?: "name" | "sku"; 
  displayValue?: string;
  products: any[];
  isActive?: boolean;
}

export function AsyncProductSelect({
  value,
  onChange,
  placeholder = "ค้นหา...",
  disabled = false,
  className,
  searchBy,
  displayValue,
  products,
  isActive = false
}: AsyncProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [internalValue, setInternalValue] = useState(displayValue || "");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internalValue with displayValue when closed
  useEffect(() => {
    if (!isOpen) {
      setInternalValue(displayValue || "");
      setSearchQuery(""); // Reset search query when closed
    }
  }, [displayValue, isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, { capture: true });
    return () => document.removeEventListener("mousedown", handleClickOutside, { capture: true });
  }, []);

  // Debounced Local Search
  useEffect(() => {
    if (!isOpen) return;
    
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      
      const query = searchQuery.trim().toLowerCase();
      
      let filtered = products || [];
      if (query) {
        filtered = filtered.filter((p: any) => 
          (p.name || p.productName || '').toLowerCase().includes(query) ||
          (p.sku || p.productCode || '').toLowerCase().includes(query)
        );
      }
      
      // Limit to 50 items to prevent DOM freezing
      const sliced = filtered.slice(0, 50).map((p: any) => ({
        id: p.id,
        name: p.name || p.productName || "Unnamed",
        sku: p.sku || p.productCode || "N/A",
        unit: p.unit || p.productUnit || "N/A",
        unitPrice: p.unitPrice || p.price || 0,
        cost: p.cost || p.totalCost || 0,
        ...p
      }));
      
      setOptions(sliced);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isOpen, products]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    setSearchQuery(val);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <div className={cn(
        "relative flex items-center w-full h-7 px-2 rounded-full",
        "transition-all duration-200",
        isActive ? "bg-black/20 border border-white/20" : "bg-transparent border border-transparent",
        isOpen && "border-nexus-teal ring-1 ring-nexus-teal/50 shadow-neon-teal bg-black/20",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={internalValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          className={cn(
            "w-full h-full bg-transparent border-none focus:outline-none text-sm",
            (!internalValue && !isOpen) ? "text-white/40 font-normal" : "text-white font-bold",
            searchBy === 'sku' ? "font-mono text-nexus-teal" : ""
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen) {
              setIsOpen(true);
              inputRef.current?.focus();
            } else {
              setIsOpen(false);
            }
          }}
          className="flex-shrink-0 ml-1 outline-none"
        >
          <ChevronDown size={14} className={cn("text-white/40 transition-transform duration-200", isOpen && "rotate-180 text-nexus-teal")} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-[100%] z-[9999] w-[350px] mt-1 bg-black border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
            {loading ? (
              <div className="p-4 text-center text-xs text-white/40">กำลังค้นหา...</div>
            ) : options.length === 0 ? (
              <div className="p-4 text-center text-xs text-white/40">ไม่พบข้อมูล</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.id, opt);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-sm transition-colors",
                    "hover:bg-white/10 flex flex-col gap-0.5",
                    value === opt.id ? "bg-nexus-teal/20 text-nexus-teal font-bold" : "text-white/80"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "font-bold truncate pr-2",
                      searchBy === 'sku' ? "font-mono text-nexus-teal" : "text-white"
                    )}>
                      {searchBy === 'sku' ? opt.sku : opt.name}
                    </span>
                    {value === opt.id && <Check size={14} className="text-nexus-teal flex-shrink-0" />}
                  </div>
                  <span className={cn(
                    "text-xs truncate",
                    searchBy === 'sku' ? "text-white/60" : "font-mono text-nexus-teal/60"
                  )}>
                    {searchBy === 'sku' ? opt.name : opt.sku}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
