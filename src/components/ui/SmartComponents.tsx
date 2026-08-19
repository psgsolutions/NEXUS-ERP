"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn, PillButton } from "@/components/ui/Base";
import { Search, Plus, ChevronDown, Minus, ChevronUp } from "lucide-react";

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
  onAddNew?: () => void;
  addNewLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function SmartSelect({
  options,
  value,
  onChange,
  placeholder = "เลือกข้อมูล...",
  searchable = true,
  onAddNew,
  addNewLabel = "เพิ่มข้อมูลใหม่",
  disabled = false,
  className
}: SmartSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = searchable 
    ? options.filter((opt) => 
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-9 px-4 flex items-center justify-between text-left",
          "bg-white/5 border border-white/10 rounded-full",
          "text-sm font-medium transition-all duration-200",
          !value && "text-white/40 font-normal",
          value && "text-white font-bold",
          isOpen && "border-nexus-teal ring-1 ring-nexus-teal/50 shadow-neon-teal",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          "hover:bg-white/10 hover:border-white/20"
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} className={cn("text-white/40 transition-transform duration-200", isOpen && "rotate-180 text-nexus-teal")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-white/10 flex-shrink-0 relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                autoFocus
                placeholder="ค้นหา..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-white/5 border-none rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-nexus-teal"
              />
            </div>
          )}
          
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-white/40">ไม่พบข้อมูล</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-sm transition-colors",
                    "hover:bg-white/10 flex flex-col gap-0.5",
                    value === opt.value ? "bg-nexus-teal/20 text-nexus-teal font-bold" : "text-white/80"
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.description && (
                    <span className="text-[10px] text-white/40 font-normal truncate">{opt.description}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {onAddNew && (
            <div className="p-2 border-t border-white/10 bg-[#0D0D0D]">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddNew();
                }}
                className="w-full h-8 flex items-center justify-center gap-2 text-xs font-bold text-nexus-teal bg-nexus-teal/10 rounded-xl hover:bg-nexus-teal/80 hover:text-black transition-colors"
              >
                <Plus size={14} /> {addNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
      "relative flex items-center h-8 bg-black/20 border border-white/20 rounded-full px-1 overflow-hidden group transition-colors",
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
        className="flex-1 w-full bg-transparent border-none text-right text-sm font-mono font-bold text-white focus:outline-none px-2 pr-6"
      />
      
      {!disabled && (
        <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center items-center w-5 opacity-0 group-hover:opacity-100 transition-opacity">
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
    <div className={cn("w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D0D] flex flex-col", className)}>
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
            className="w-full h-9 pl-10 pr-4 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder-white/40 focus:outline-none focus:border-nexus-blue"
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
                <td colSpan={columns.length} className="px-4 py-12 text-center text-white/40 text-sm">
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
                          "px-4 py-3 text-sm text-white/90",
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
