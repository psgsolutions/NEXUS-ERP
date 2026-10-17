"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/components/ui/Base";
import { ChevronDown, Check } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";

interface CustomerOption {
  id: string;
  customerName: string;
  name?: string;
  taxId: string;
  branchCode: string;
  [key: string]: any;
}

interface AsyncCustomerSelectProps {
  value: string;
  onChange: (customerId: string, customerData: CustomerOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchBy?: "name" | "taxId"; 
  displayValue?: string;
  isActive?: boolean;
}

export function AsyncCustomerSelect({
  value,
  onChange,
  placeholder = "ค้นหา...",
  disabled = false,
  className,
  searchBy = "name",
  displayValue,
  isActive = false
}: AsyncCustomerSelectProps) {
  const { data: customers } = useCustomers();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [internalValue, setInternalValue] = useState(displayValue || "");
  const [options, setOptions] = useState<CustomerOption[]>([]);
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
      
      let filtered = customers || [];
      if (query) {
        filtered = filtered.filter((c: any) => 
          (c.customerName || c.name || '').toLowerCase().includes(query) ||
          (c.taxId || '').toLowerCase().includes(query)
        );
      }
      
      // Limit to 50 items to prevent DOM freezing
      const sliced = filtered.slice(0, 50).map((c: any) => ({
        id: c.id,
        customerName: c.customerName || c.name || "Unnamed",
        taxId: c.taxId || "N/A",
        branchCode: c.branchCode || "00000",
        ...c
      }));
      
      setOptions(sliced);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isOpen, customers]);

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
    <div className={cn("relative w-full", isOpen && "z-[99999]", className)} ref={dropdownRef}>
      <div className={cn(
        "relative flex items-center w-full h-7 px-2 rounded-full",
        "transition-all duration-200",
        "bg-white/[0.03] border border-white/10",
        isOpen && "border-nexus-teal ring-1 ring-nexus-teal/50 shadow-neon-teal bg-white/[0.06]",
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
            searchBy === 'taxId' ? "font-mono text-nexus-teal" : ""
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
        <div className="absolute left-0 top-[100%] z-[99999] w-[350px] mt-1 bg-black border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
                      searchBy === 'taxId' ? "font-mono text-nexus-teal" : "text-white"
                    )}>
                      {searchBy === 'taxId' ? opt.taxId : opt.customerName}
                    </span>
                    {value === opt.id && <Check size={14} className="text-nexus-teal flex-shrink-0" />}
                  </div>
                  <span className={cn(
                    "text-xs truncate",
                    searchBy === 'taxId' ? "text-white/60" : "font-mono text-nexus-teal/60"
                  )}>
                    {searchBy === 'taxId' ? opt.customerName : opt.taxId}
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
