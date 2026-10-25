"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FloatingLayer } from "./FloatingLayer";
import { cn, PillButton, PillInput, PillSelect, SignatureGlow } from "@/components/ui/Base";
import { Search, Plus, ChevronDown, Minus, ChevronUp } from "lucide-react";

export { PillSelect, SignatureGlow };

/** =========================================================================
 * 1. SmartSelect: Searchable Dropdown with Add New button
 * ========================================================================== */
interface SmartSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SmartSelectProps {
  options: SmartSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  allowCustom?: boolean;
  onCreateOption?: (newOption: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function SmartSelect({
  options,
  value,
  onChange,
  placeholder = "พิมพ์หรือเลือกข้อมูล...",
  searchable = true,
  allowCustom = true,
  onCreateOption,
  onAddNew,
  addNewLabel = "เพิ่มข้อมูลใหม่",
  disabled = false,
  className
}: SmartSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const initialValueRef = useRef<string>(value);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fail-safe deduplication of options by value or label
  const uniqueOptions = useMemo(() => {
    const seenValues = new Set<string>();
    const seenLabels = new Set<string>();
    return options.filter((opt: SmartSelectOption) => {
      const v = opt.value || "";
      const l = opt.label?.trim().toLowerCase() || "";
      if (v && seenValues.has(v)) return false;
      if (l && seenLabels.has(l)) return false;
      if (v) seenValues.add(v);
      if (l) seenLabels.add(l);
      return true;
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return uniqueOptions.find((opt: SmartSelectOption) => opt.value === value || (value && opt.label.trim().toLowerCase() === value.trim().toLowerCase()));
  }, [uniqueOptions, value]);

  useEffect(() => {
    if (!isFocused) {
      setSearchQuery(selectedOption ? selectedOption.label : (value || ""));
    }
  }, [value, selectedOption, isFocused]);

  useEffect(() => {
    if (isOpen) {
      initialValueRef.current = value;
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, isOpen]);

  const commitValue = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      onChange("");
      setSearchQuery("");
      return;
    }

    const matchingOpt = uniqueOptions.find(
      (opt: SmartSelectOption) => opt.label.toLowerCase() === trimmed.toLowerCase() || opt.value.toLowerCase() === trimmed.toLowerCase()
    );

    if (matchingOpt) {
      onChange(matchingOpt.value);
      setSearchQuery(matchingOpt.label);
    } else if (allowCustom) {
      if (onCreateOption) {
        onCreateOption(trimmed);
      } else {
        onChange(trimmed);
      }
      setSearchQuery(trimmed);
    } else {
      setSearchQuery(selectedOption ? selectedOption.label : "");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      // เมนูอยู่ในชั้นลอย (นอก container) จึงนับคลิกในชั้นลอยเป็นข้างในด้วย
      if (dropdownRef.current && !dropdownRef.current.contains(t) && !floatingRef.current?.contains(t)) {
        if (isOpen || isFocused) {
          commitValue(searchQuery);
          setIsOpen(false);
          setIsFocused(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption, searchQuery, isOpen, isFocused, uniqueOptions, allowCustom, onCreateOption, onChange]);

  const isExistingOptionSelected = !!uniqueOptions.find((opt: SmartSelectOption) => opt.value === value);

  const isQueryMatchingSelectedLabel = !!(
    isExistingOptionSelected &&
    selectedOption &&
    searchQuery.trim().toLowerCase() === selectedOption.label.trim().toLowerCase()
  );

  const filteredOptions = useMemo(() => {
    if (!searchable) return uniqueOptions;
    if (isQueryMatchingSelectedLabel || !searchQuery.trim()) return uniqueOptions;
    const query = searchQuery.trim().toLowerCase();
    return uniqueOptions.filter((opt: SmartSelectOption) =>
      opt.label.toLowerCase().includes(query) ||
      (opt.description && opt.description.toLowerCase().includes(query))
    );
  }, [searchable, isQueryMatchingSelectedLabel, searchQuery, uniqueOptions]);

  const isCustomTyped = useMemo(() => {
    if (!allowCustom) return false;
    const currentVal = (isFocused ? searchQuery : (selectedOption ? selectedOption.label : (value || searchQuery || ""))).trim();
    if (!currentVal) return false;
    const query = currentVal.toLowerCase();
    return !uniqueOptions.some(opt => opt.label.toLowerCase() === query || opt.value.toLowerCase() === query);
  }, [allowCustom, isFocused, searchQuery, selectedOption, value, uniqueOptions]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    const chosen = uniqueOptions.find((o: SmartSelectOption) => o.value === optValue) || { value: optValue, label: optValue };
    setSearchQuery(chosen.label);
    setIsOpen(false);
    setIsFocused(false);
    setHighlightedIndex(-1);
  };

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <div className="relative w-full flex items-center">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-teal/60 pointer-events-none z-10" />
        <PillInput
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={isFocused ? searchQuery : (selectedOption ? selectedOption.label : (value || searchQuery || ""))}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
            const initText = selectedOption ? selectedOption.label : (value || "");
            setSearchQuery(initText);
            setTimeout(() => inputRef.current?.select(), 30);
          }}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            onChange(val);
            if (!isOpen) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (
                document.activeElement !== inputRef.current &&
                (!dropdownRef.current || !dropdownRef.current.contains(document.activeElement)) &&
                !floatingRef.current?.contains(document.activeElement)
              ) {
                commitValue(searchQuery);
                setIsFocused(false);
                setIsOpen(false);
              }
            }, 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(0);
              } else {
                setHighlightedIndex((prev) => {
                  if (filteredOptions.length <= 0) return -1;
                  if (prev < 0 || prev >= filteredOptions.length - 1) return 0;
                  return prev + 1;
                });
              }
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(filteredOptions.length - 1);
              } else {
                setHighlightedIndex((prev) => {
                  if (filteredOptions.length <= 0) return -1;
                  if (prev <= 0) return filteredOptions.length - 1;
                  return prev - 1;
                });
              }
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[highlightedIndex].value);
              } else {
                commitValue(searchQuery);
                setIsOpen(false);
                setIsFocused(false);
                setHighlightedIndex(-1);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              const prevVal = initialValueRef.current;
              const restoredOpt = uniqueOptions.find((o) => o.value === prevVal || (prevVal && o.label.trim().toLowerCase() === prevVal.trim().toLowerCase()));
              const restoredText = restoredOpt ? restoredOpt.label : prevVal;
              setSearchQuery(restoredText);
              onChange(prevVal);
              setIsOpen(false);
              setIsFocused(false);
              setHighlightedIndex(-1);
              inputRef.current?.blur();
            }
          }}
          className={cn(
            "w-full h-8 pl-9 pr-14 rounded-full bg-white/5 border border-white/10",
            "text-[14px] font-medium transition-all duration-200",
            !value && !isFocused && "text-white/30 font-normal",
            (value || isFocused) && "text-white font-semibold",
            isOpen && "border-nexus-teal ring-1 ring-nexus-teal/50 shadow-neon-teal bg-black/40",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
          {isCustomTyped && (
            <span 
              title={`จะสร้าง "${(isFocused ? searchQuery : (selectedOption ? selectedOption.label : (value || searchQuery || ""))).trim()}" เป็นรายการใหม่เมื่อกดบันทึก`}
              className="text-[10px] px-2.5 py-0.5 rounded-full bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md font-semibold flex items-center gap-1 shrink-0"
            >
              🆕 รายการใหม่
            </span>
          )}
          {(value || searchQuery) && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
                setSearchQuery("");
                setIsOpen(false);
                setIsFocused(false);
              }}
              className="text-white/40 hover:text-white transition-colors p-0.5"
              title="ล้างข้อมูล"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                commitValue(searchQuery);
                setIsOpen(false);
                setIsFocused(false);
              } else {
                inputRef.current?.focus();
              }
            }}
            className="text-white/40 hover:text-white transition-colors p-0.5"
          >
            <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen && "rotate-180 text-nexus-teal")} />
          </button>
        </div>
      </div>

      <FloatingLayer
        ref={floatingRef}
        anchorRef={dropdownRef}
        open={isOpen}
        gap={4}
        maxHeight={360}
        className="bg-surface-2/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col p-1.5"
      >
          {isCustomTyped && (
            <div className="px-3 py-2 text-[12px] font-semibold text-nexus-teal bg-nexus-teal/20 border border-nexus-teal/40 backdrop-blur-md rounded-xl flex items-center justify-between mb-1">
              <span>🆕 จะสร้าง &quot;{(isFocused ? searchQuery : (selectedOption ? selectedOption.label : (value || searchQuery || ""))).trim()}&quot; เป็นรายการใหม่เมื่อกดบันทึก</span>
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1 p-0.5">
            {filteredOptions.length === 0 ? (
              // พิมพ์ชื่อใหม่: แสดงแค่แถบ "จะสร้าง..." ด้านบนแถบเดียว (ไม่ซ้ำ)
              isCustomTyped ? null : <div className="p-3 text-center text-xs text-white/40 font-semibold">ไม่พบข้อมูลที่ค้นหา</div>
            ) : (
              filteredOptions.map((opt: SmartSelectOption, index: number) => (
                <button
                  key={opt.value}
                  type="button"
                  ref={(el) => { optionRefs.current[index] = el; }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt.value);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-[13px] transition-colors flex flex-col gap-0.5 border",
                    highlightedIndex === index
                      ? "bg-white/15 border-nexus-teal/60 text-white font-bold ring-1 ring-nexus-teal/40 shadow-neon-teal"
                      : value === opt.value
                        ? "bg-nexus-teal/20 border-nexus-teal/30 text-nexus-teal font-bold"
                        : "border-transparent text-white/80 hover:bg-white/10"
                  )}
                >
                  <span className="font-bold flex items-center justify-between">
                    <span>{opt.label}</span>
                    {value === opt.value && <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-nexus-teal/20 text-nexus-teal">เลือกอยู่</span>}
                  </span>
                  {opt.description && (
                    <span className="text-[11px] text-white/50 font-normal truncate font-mono">{opt.description}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {onAddNew && (
            <div className="p-2 border-t border-white/10 bg-surface-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  setIsFocused(false);
                  onAddNew();
                }}
                className="w-full h-8 flex items-center justify-center gap-2 text-xs font-bold text-nexus-teal bg-nexus-teal/10 rounded-xl hover:bg-nexus-teal/80 hover:text-black transition-colors"
              >
                <Plus size={14} /> {addNewLabel}
              </button>
            </div>
          )}
      </FloatingLayer>
    </div>
  );
}

/** =========================================================================
 * SciFiDropdownPortal: A reusable component to render dropdowns outside their containers
 * ========================================================================== */
interface SciFiDropdownPortalProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  align?: "left" | "right";
  className?: string;
}

export function SciFiDropdownPortal({
  trigger,
  children,
  isOpen,
  onClose,
  align = "left",
  className,
}: SciFiDropdownPortalProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (isOpen && !dropdownRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside, { capture: true });
    return () => document.removeEventListener("mousedown", handleClickOutside, { capture: true });
  }, [isOpen, onClose]);

  return (
    <>
      <div ref={triggerRef} className="w-full">
        {trigger}
      </div>
      <FloatingLayer
        ref={dropdownRef}
        anchorRef={triggerRef}
        open={isOpen}
        align={align}
        matchWidth={false}
        maxHeight={420}
        className={cn(
          "rounded-xl flex flex-col bg-surface-1 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]",
          className
        )}
      >
        {children}
      </FloatingLayer>
    </>
  );
}

/** =========================================================================
 * 2. NumberInput: Stepper with formatting and font-mono
 * ========================================================================== */
interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  formatCurrency?: boolean;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 999999999,
  step = 1,
  disabled = false,
  className,
  formatCurrency = false
}: NumberInputProps) {
  
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());

  // Sync prop value to local value when not typing
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value.toString());
    }
  }, [value, isFocused]);

  const handleIncrement = () => {
    if (disabled) return;
    const nextVal = Math.min(value + step, max);
    onChange(nextVal);
  };

  const handleDecrement = () => {
    if (disabled) return;
    const nextVal = Math.max(value - step, min);
    onChange(nextVal);
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(localValue);
    if (isNaN(parsed)) parsed = min;
    parsed = Math.max(min, Math.min(parsed, max));
    onChange(parsed);
    setLocalValue(parsed.toString());
  };

  const displayValue = isFocused 
    ? localValue 
    : (formatCurrency ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value.toLocaleString('en-US'));

  return (
    <div className={cn(
      "relative flex items-center h-8 bg-black/20 border border-white/20 rounded-full px-1 overflow-hidden group/stepper transition-colors",
      isFocused && "border-nexus-teal ring-1 ring-nexus-teal/50 shadow-neon-teal",
      disabled && "opacity-50 pointer-events-none",
      className
    )}>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setLocalValue(e.target.value.replace(/[^\d.-]/g, ''))}
        onFocus={(e) => {
          setIsFocused(true);
          const el = e.target;
          setTimeout(() => el.select(), 0);
        }}
        onBlur={handleBlur}
        disabled={disabled}
        className="flex-1 w-full bg-transparent border-none text-center text-[13px] font-mono font-bold text-white focus:outline-none px-2"
      />
      
      {!disabled && (
        <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center items-center w-5 opacity-0 group-hover/stepper:opacity-100 transition-opacity">
          <button 
            type="button" 
            onClick={handleIncrement}
            className="h-1/2 w-full flex items-end justify-center text-white/40 hover:text-nexus-teal transition-colors pb-0.5"
          >
            <ChevronUp size={12} strokeWidth={3} />
          </button>
          <button 
            type="button" 
            onClick={handleDecrement}
            className="h-1/2 w-full flex items-start justify-center text-white/40 hover:text-nexus-teal transition-colors pt-0.5"
          >
            <ChevronDown size={12} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}

/** =========================================================================
 * 2.5 StepperInput: Reusable Capsule Stepper from Product Form
 * ========================================================================== */
export function StepperInput({ 
  value, 
  onChange, 
  className = "", 
  min, 
  max, 
  step,
  onKeyDown,
  autoFocus,
  suffix,
  placeholder
}: { 
  value?: number | null, 
  onChange: (v: any) => void, 
  className?: string, 
  min?: number, 
  max?: number, 
  step?: number,
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void,
  autoFocus?: boolean,
  suffix?: string,
  placeholder?: string
}) {
  return (
    <div className="relative flex items-center group/stepper w-full">
      <PillInput 
        type="number" 
        value={value === null || value === undefined ? "" : value} 
        placeholder={placeholder}
        step={step}
        onChange={(e) => {
          if (e.target.value === "") {
            onChange(null);
            return;
          }
          let val = Number(e.target.value);
          if (isNaN(val)) {
            onChange(null);
            return;
          }
          if (min !== undefined && val < min) val = min;
          if (max !== undefined && val > max) val = max;
          onChange(val);
        }} 
        onFocus={(e) => e.target.select()}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className={cn("w-full h-8 px-4 rounded-full font-mono text-center text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", suffix ? "pr-14" : "pr-8", className)} 
      />
      {suffix && (
        <span className="absolute right-7 text-[12px] font-bold text-white/40 pointer-events-none font-sans">
          {suffix}
        </span>
      )}
      <div className="absolute right-1 top-1 bottom-1 flex flex-col justify-between w-5 rounded-md overflow-hidden bg-white/[0.05] border border-white/10 opacity-70 group-hover/stepper:opacity-100 transition-opacity focus-within:opacity-100">
        <button 
          type="button"
          onClick={() => {
            const current = value ?? 0;
            const inc = step ?? 1;
            const next = Math.min(Number((current + inc).toFixed(4)), max ?? Infinity);
            onChange(next);
          }} 
          className="flex-1 flex items-center justify-center hover:bg-nexus-teal hover:text-black text-white/60 transition-colors"
          tabIndex={-1}
        >
          <ChevronUp size={12} />
        </button>
        <div className="h-[1px] w-full bg-white/10" />
        <button 
          type="button"
          onClick={() => {
            const current = value ?? 0;
            const dec = step ?? 1;
            const next = Math.max(min ?? 0, Number((current - dec).toFixed(4)));
            onChange(next);
          }} 
          className="flex-1 flex items-center justify-center hover:bg-danger hover:text-white text-white/60 transition-colors"
          tabIndex={-1}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}

/** =========================================================================
 * 3. SmartTable: Enterprise Responsive Table with right-aligned numbers
 * ========================================================================== */
export interface SmartTableColumn<T> {
  id: string;
  header: string | React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  isNumeric?: boolean; // Auto-aligns right and uses font-mono
}

interface SmartTableProps<T> {
  data: T[];
  columns: SmartTableColumn<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  itemsPerPage?: number;
}

export function SmartTable<T extends Record<string, any>>({ 
  data, 
  columns, 
  onRowClick,
  emptyMessage = "ไม่มีข้อมูล",
  className,
  itemsPerPage = 10
}: SmartTableProps<T>) {
  
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search term
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(lowerSearch)
      )
    );
  }, [data, searchTerm]);

  // Calculate pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  // Ensure current page is valid
  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  return (
    <div className={cn("w-full overflow-hidden rounded-2xl border border-white/10 bg-surface-0 flex flex-col", className)}>
      {/* Search Header */}
      <div className="p-4 border-b border-white/10 flex items-center bg-black/20">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="ค้นหาข้อมูล (Global Search)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to page 1 on search
            }}
            className="w-full h-8 pl-10 pr-4 bg-white/5 border border-white/10 rounded-full text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-nexus-blue"
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              {columns.map((col) => (
                <th 
                  key={col.id} 
                  className={cn(
                    "px-4 py-3 text-xs font-black text-white/60 uppercase tracking-widest",
                    (col.align === "right" || col.isNumeric) && "text-right",
                    col.align === "center" && "text-center",
                    col.isNumeric && "font-mono",
                    col.width === "full" ? "w-full" : (!col.width && "w-px whitespace-nowrap")
                  )}
                  style={col.width && col.width !== "full" ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {currentData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-white/40 text-[13px]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              currentData.map((row, rowIndex) => (
                <tr 
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "group transition-colors",
                    rowIndex % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]",
                    onRowClick && "cursor-pointer hover:bg-nexus-teal/10"
                  )}
                >
                  {columns.map((col) => {
                    const alignmentClass = 
                      (col.align === "right" || col.isNumeric) ? "text-right" : 
                      col.align === "center" ? "text-center" : "text-left";
                    
                    const cellValue = col.cell 
                      ? col.cell(row, rowIndex)
                      : col.accessorKey ? String(row[col.accessorKey] || "") : "";

                    return (
                      <td 
                        key={col.id} 
                        className={cn(
                          "px-4 py-3 text-[13px] text-white/90",
                          alignmentClass,
                          col.isNumeric && "font-mono",
                          onRowClick && "group-hover:text-white",
                          col.width === "full" ? "w-full break-words" : (!col.width && "w-px whitespace-nowrap")
                        )}
                      >
                        {cellValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary */}
      <div className="px-6 py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/40">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          แสดง {totalItems === 0 ? 0 : startIndex + 1}-{endIndex} จาก {totalItems} รายการ
        </p>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
            >
              ก่อนหน้า
            </button>
            <span className="text-xs text-white/60 font-mono font-black px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
