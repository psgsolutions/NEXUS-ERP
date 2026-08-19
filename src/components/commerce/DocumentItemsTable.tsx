"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Minus, Trash2, Search, X, ChevronUp, ChevronDown, CornerDownRight, AlignLeft } from "lucide-react";
import { where } from "firebase/firestore";
import { PillButton, cn } from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { formatCurrency } from "@/lib/erp-logic";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useAuth } from "@/context/AuthContext";

export interface DocumentItemsTableProps {
  items: any[];
  onChange: (newItems: any[], summary?: { subtotal: number, taxAmount: number, grandTotal: number }) => void;
  isLocked?: boolean;
}

const CompactVerticalStepperInput = ({ value, onChange, min = 0 }: { value: number, onChange: (val: number) => void, min?: number }) => {
  return (
    <div className="relative flex items-center bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 rounded-full h-9 w-full group/stepper transition-colors focus-within:border-nexus-teal/50 focus-within:bg-white/[0.02]">
      <input 
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        onFocus={(e) => e.target.select()}
        className="flex-1 w-full h-full bg-transparent text-right font-mono text-[13px] font-black text-white pr-7 pl-2 focus:outline-none placeholder:text-white/20 rounded-full not-italic [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={min}
      />
      <div className="absolute right-1 top-1 bottom-1 flex flex-col items-center justify-between w-5 opacity-0 group-hover/stepper:opacity-100 focus-within:opacity-100 transition-opacity bg-black/20 rounded-full overflow-hidden border border-white/5">
        <button 
          onClick={() => onChange(value + 1)}
          className="w-full h-1/2 flex items-center justify-center text-nexus-teal/70 hover:text-white hover:bg-nexus-teal/20 transition-all"
        >
          <ChevronUp size={10} strokeWidth={3} />
        </button>
        <button 
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-full h-1/2 flex items-center justify-center text-nexus-teal/70 hover:text-white hover:bg-nexus-teal/20 transition-all"
        >
          <ChevronDown size={10} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

const InlineRow = ({ 
  item, 
  index, 
  updateItem, 
  updateItemFields,
  onProductSelected,
  removeItem,
  addSubItem,
  isLocked, 
  availableProducts 
}: any) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [activeSearchField, setActiveSearchField] = useState<'sku' | 'name' | null>(!item.productId && !item.name ? 'name' : null);
  const [searchTerm, setSearchTerm] = useState(item.productId ? item.name : "");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return availableProducts;
    const lower = searchTerm.toLowerCase();
    return availableProducts.filter((p: any) => 
      p.name.toLowerCase().includes(lower) || 
      (p.sku && p.sku.toLowerCase().includes(lower))
    );
  }, [availableProducts, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        if (activeSearchField) {
          setActiveSearchField(null);
          if (!item.productId && (!searchTerm || searchTerm.trim() === "")) {
            removeItem(item.id);
          } else if (!item.productId && searchTerm.trim() !== "") {
            updateItem(item.id, "name", searchTerm);
          }
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside, { capture: true });
    return () => document.removeEventListener("mousedown", handleClickOutside, { capture: true });
  }, [activeSearchField, item.productId, searchTerm, item.id, removeItem, updateItem]);

  const renderDropdown = (widthClass: string) => (
    <div className={cn("absolute z-50 top-[calc(100%+8px)] bg-[#0A1118]/95 backdrop-blur-xl border border-nexus-teal/20 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.8),_0_0_20px_rgba(0,255,255,0.1)] overflow-hidden", widthClass)}>
      <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
        {filteredProducts.length > 0 ? (
          <div className="py-2">
            {filteredProducts.map((p: any) => (
              <div 
                key={p.id}
                onClick={() => handleSelectProduct(p)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-nexus-teal/10 cursor-pointer transition-colors"
              >
                <div className="w-[100px] shrink-0 text-left">
                  <span className="font-mono text-[11px] text-nexus-teal">{p.sku || p.id}</span>
                </div>
                <div className="flex-1 truncate">
                  <span className="font-bold text-[12px] text-white flex items-center gap-2">
                    {p.name}
                    {p.currentStock !== undefined && (
                      <span className="text-[9px] font-normal text-nexus-teal/50 bg-nexus-teal/10 px-1.5 py-0.5 rounded-sm">
                        คงเหลือ: {p.currentStock}
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-24 text-right shrink-0">
                  <span className="font-mono text-[12px] text-white/80">{formatCurrency(p.price)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-[11px] text-nexus-teal/50 font-mono">
            ไม่พบข้อมูลสินค้า
          </div>
        )}
      </div>
    </div>
  );

  const handleSelectProduct = (product: any) => {
    if (onProductSelected) {
      onProductSelected(item.id, product);
    } else {
      updateItemFields(item.id, {
        productId: product.id,
        sku: product.sku || product.id,
        name: product.name,
        unit: product.unit || "ชิ้น",
        price: product.price,
        cost: product.cost || 0,
        incomeAccountId: product.incomeAccountId || null,
        expenseAccountId: product.expenseAccountId || null,
        currentStock: product.currentStock
      });
    }
    setSearchTerm(product.name);
    setActiveSearchField(null);
  };

  return (
    <>
      <div ref={rowRef} className={cn("group relative flex gap-2 items-center px-2 py-1 min-h-[36px] hover:bg-white/[0.02] border-b border-white/5 transition-colors", item.isSubItem ? "pl-8 bg-white/[0.01]" : "", activeSearchField ? "z-50" : "z-10")}>
        <div className="w-10 text-center font-mono text-[13px] text-white/40 shrink-0 flex items-center justify-center gap-1">
        {item.isSubItem && <CornerDownRight size={12} className="text-nexus-teal/50" />}
        {!item.isSubItem && (index + 1)}
      </div>
      
      <div className="w-32 shrink-0 text-center relative z-20">
        {!isLocked ? (
          activeSearchField === 'sku' ? (
            <div className="relative w-full">
              <input
                type="text"
                autoFocus
                placeholder="ค้นหารหัส..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 px-2 bg-black/40 border border-nexus-teal/30 rounded-full text-center font-mono text-[12px] text-nexus-teal focus:outline-none focus:border-nexus-teal shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all"
              />
              {renderDropdown("left-0 w-[400px]")}
            </div>
          ) : (
            <div 
              onClick={() => {
                setSearchTerm(item.sku || "");
                setActiveSearchField('sku');
              }}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 text-center font-mono text-[12px] text-nexus-teal cursor-text flex items-center justify-center transition-colors"
            >
              {item.sku ? <span>{item.sku}</span> : <span className="text-white/20 not-italic font-sans text-[11px]">รหัสสินค้า</span>}
            </div>
          )
        ) : (
          <p className="font-mono text-[13px] text-nexus-teal truncate px-2 not-italic" title={item.sku}>{item.sku || "-"}</p>
        )}
      </div>

      <div className="flex-1 relative z-10">
        {!isLocked ? (
          activeSearchField === 'name' ? (
            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-teal/50" />
              <input
                type="text"
                autoFocus
                placeholder="ค้นหาชื่อสินค้า..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-black/40 border border-nexus-teal/30 rounded-full text-[12px] text-white font-bold focus:outline-none focus:border-nexus-teal shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all"
              />
              {renderDropdown("left-0 w-[500px] max-w-[80vw]")}
            </div>
          ) : (
            <div 
              className={cn("w-full h-9 flex items-center px-3 rounded-full border border-transparent bg-transparent transition-colors cursor-text hover:bg-white/[0.02] hover:border-white/10")}
              onClick={() => {
                setSearchTerm(item.name);
                setActiveSearchField('name');
              }}
            >
              <p className={cn("flex-1 font-bold text-[12px] truncate flex items-center gap-2", !item.name ? "text-white/40" : "text-white")}>
                <span>{item.name || "ระบุชื่อสินค้า..."}</span>
                {item.currentStock !== undefined && (
                  <span className="text-[9px] font-normal text-nexus-teal/50 whitespace-nowrap">
                    (เหลือ: {item.currentStock})
                  </span>
                )}
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
                className={cn("p-1.5 rounded-full transition-colors ml-2", isExpanded ? "bg-nexus-teal/20 text-nexus-teal" : "text-nexus-teal/50 hover:text-nexus-teal hover:bg-nexus-teal/10")}
                title="รายละเอียดสินค้าเพิ่มเติม"
              >
                <AlignLeft size={14} />
              </button>
            </div>
          )
        ) : (
          <p className="font-bold text-[12px] text-white px-3 truncate">{item.name}</p>
        )}
      </div>
      
      <div className="w-20 shrink-0">
        {!isLocked ? (
          <CompactVerticalStepperInput 
            value={item.qty} 
            onChange={(val) => updateItem(item.id, "qty", val)}
            min={1}
          />
        ) : (
          <div className="text-center"><span className="font-mono text-[13px] text-white/80 not-italic">{item.qty}</span></div>
        )}
      </div>
      
      <div className="w-20 shrink-0">
        {!isLocked ? (
          <input 
            type="text"
            value={item.unit || ""}
            onChange={(e) => updateItem(item.id, "unit", e.target.value)}
            className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 focus:bg-white/[0.02] text-center font-bold text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic"
          />
        ) : (
          <div className="text-center"><p className="font-bold text-[12px] text-white/60 not-italic">{item.unit || "ชิ้น"}</p></div>
        )}
      </div>
      
      <div className="w-24 shrink-0">
        {!isLocked ? (
          isEditingPrice ? (
            <input 
              type="number"
              autoFocus
              value={item.price === 0 ? "" : item.price}
              onChange={(e) => updateItem(item.id, "price", Number(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setIsEditingPrice(false)}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 focus:bg-white/[0.02] text-right font-mono text-[13px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <input 
              type="text"
              readOnly
              value={item.price ? item.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ""}
              onClick={() => setIsEditingPrice(true)}
              onFocus={() => setIsEditingPrice(true)}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 text-right font-mono text-[13px] text-white/80 focus:outline-none transition-colors not-italic cursor-text"
            />
          )
        ) : (
          <div className="text-right"><p className="font-mono text-[13px] text-white/80 not-italic">{item.price ? item.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "0.00"}</p></div>
        )}
      </div>
      
      <div className="w-24 text-right shrink-0">
        <p className="font-mono text-[14px] font-black text-nexus-teal not-italic">{(item.qty * item.price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
      </div>

      <div className="w-[52px] shrink-0 flex justify-end gap-1">
        {!isLocked && !item.isSubItem && (
          <button 
            onClick={() => addSubItem(item.id)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-nexus-teal/5 text-nexus-teal/60 hover:text-nexus-teal hover:bg-nexus-teal/20 transition-all opacity-0 group-hover:opacity-100"
            title="เพิ่มรายการย่อย"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        )}
        {!isLocked && (
          <button 
            onClick={() => removeItem(item.id)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-danger/5 text-danger/60 hover:text-danger hover:bg-danger/20 transition-all opacity-0 group-hover:opacity-100"
            title="ลบรายการ"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
    
    {/* Accordion Details */}
    {isExpanded && (
      <div className="px-14 py-4 bg-black/40 border-b border-white/5 flex gap-6 relative z-0 shadow-inner">
        <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-white/5" />
        <div className="flex-1 space-y-2">
          <label className="text-[10px] uppercase text-nexus-teal font-black tracking-widest flex items-center gap-1">
            <AlignLeft size={10} /> รายละเอียดสินค้าเพิ่มเติม (Specifications)
          </label>
          <textarea 
            value={item.details || ""} 
            onChange={(e) => updateItem(item.id, "details", e.target.value)}
            disabled={isLocked}
            className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal/50 transition-colors custom-scrollbar" 
            rows={3} 
            placeholder="ระบุสเปก, รุ่น, สี, ขนาด หรือรายละเอียดอื่นๆ..."
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-[10px] uppercase text-nexus-teal font-black tracking-widest flex items-center gap-1">
            ลิงก์เอกสารอ้างอิง (Datasheet URL)
          </label>
          <input 
            type="url"
            value={item.datasheetUrl || ""} 
            onChange={(e) => updateItem(item.id, "datasheetUrl", e.target.value)}
            disabled={isLocked}
            className="w-full bg-white/[0.02] border border-white/10 rounded-full px-4 h-9 text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal/50 transition-colors" 
            placeholder="https://..."
          />
          <p className="text-[10px] text-white/30 px-2 mt-2 leading-relaxed">
            *ข้อมูลรายละเอียดและลิงก์นี้จะถูกบันทึกกลับไปยังฐานข้อมูลสินค้านี้โดยอัตโนมัติ
          </p>
        </div>

        {/* Sales Insights Box */}
        <div className="w-[220px] shrink-0 bg-white/[0.01] border border-white/5 rounded-xl p-3 space-y-2 h-max">
           <label className="text-[10px] uppercase text-white/50 font-black tracking-widest flex items-center gap-1 border-b border-white/5 pb-2 mb-2">
             ข้อมูลเชิงลึก (Sales Insights)
           </label>
           
           <div className="flex justify-between items-center">
             <span className="text-[11px] text-white/60">คงเหลือในคลัง:</span>
             <span className={cn("text-[12px] font-mono font-bold", (item.currentStock || 0) > 0 ? "text-nexus-teal" : "text-danger")}>
               {item.currentStock || 0} {item.unit || "ชิ้น"}
             </span>
           </div>
           
           <div className="flex justify-between items-center">
             <span className="text-[11px] text-white/60">ต้นทุนเฉลี่ย:</span>
             <span className="text-[12px] font-mono font-bold text-white/80">
               ฿{(item.cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
             </span>
           </div>
           
           <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-1">
             <span className="text-[11px] text-white/60">กำไรคาดการณ์:</span>
             <span className={cn("text-[13px] font-mono font-black", 
                item.unitPrice > (item.cost || 0) ? "text-nexus-blue" : "text-danger"
             )}>
               {item.unitPrice > 0 ? (((item.unitPrice - (item.cost || 0)) / item.unitPrice) * 100).toFixed(1) : "0.0"}%
             </span>
           </div>
        </div>
      </div>
    )}
  </>
  );
};

export function DocumentItemsTable({ items = [], onChange, isLocked = false }: DocumentItemsTableProps) {
  const { companyId } = useAuth();
  const { data: realtimeProducts = [] } = useRealtimeCollection('products', [
    where('companyId', '==', companyId || ""),
    where('isDeleted', '==', false)
  ]);
  
  const availableProducts = realtimeProducts;

  const taxRate = 7;

  const notifyChange = (newItems: any[]) => {
    const sub = newItems.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
    const tax = sub * (taxRate / 100);
    onChange(newItems, { subtotal: sub, taxAmount: tax, grandTotal: sub + tax });
  };

  const addItem = () => {
    if (isLocked) return;
    notifyChange([...items, { 
      id: Date.now(), 
      productId: null,
      sku: "",
      name: "", 
      qty: 1, 
      unit: "Set", 
      price: 0, 
      cost: 0 
    }]);
  };

  const addSubItem = (parentId: number) => {
    if (isLocked) return;
    const parentIndex = items.findIndex(i => i.id === parentId);
    const newItems = [...items];
    newItems.splice(parentIndex + 1, 0, {
      id: Date.now(),
      parentId: parentId,
      isSubItem: true,
      productId: null,
      sku: "",
      name: "",
      qty: 1,
      unit: "ชิ้น",
      price: 0,
      cost: 0
    });
    notifyChange(newItems);
  };

  const removeItem = (id: number) => {
    if (isLocked) return;
    notifyChange(items.filter(i => i.id !== id && i.parentId !== id));
  };

  const onProductSelected = (id: number, product: any) => {
    if (isLocked) return;
    
    const existingItemIndex = items.findIndex(i => i.productId === product.id && i.id !== id);
    
    if (existingItemIndex !== -1) {
      // Duplicate found, increment qty
      const newItems = [...items];
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        qty: (Number(newItems[existingItemIndex].qty) || 0) + 1
      };
      
      const currentRowIndex = newItems.findIndex(i => i.id === id);
      if (currentRowIndex !== -1) {
        newItems.splice(currentRowIndex, 1);
      }
      
      notifyChange(newItems);
    } else {
      updateItemFields(id, {
        productId: product.id,
        sku: product.sku || product.id,
        name: product.name,
        unit: product.unit || "ชิ้น",
        price: product.price,
        cost: product.cost || 0,
        incomeAccountId: product.incomeAccountId || null,
        expenseAccountId: product.expenseAccountId || null,
        currentStock: product.currentStock
      });
    }
  };

  const updateItemFields = (id: number, fields: any) => {
    if (isLocked) return;
    notifyChange(items.map(i => i.id === id ? { ...i, ...fields } : i));
  };

  const updateItem = (id: number, field: string, value: any) => {
    if (isLocked) return;
    notifyChange(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  return (
    <div className="border border-white/10 rounded-xl bg-white/[0.01] shadow-2xl">
      {/* Header */}
      <div className="flex gap-2 items-center text-[11px] font-black text-white/60 uppercase tracking-widest px-2 py-2 border-b border-white/10 bg-white/[0.03] rounded-t-xl">
        <div className="w-10 text-center shrink-0">ลำดับ</div>
        <div className="w-32 text-center shrink-0">รหัสสินค้า</div>
        <div className="flex-1 text-left">รายการสินค้า</div>
        <div className="w-20 text-center shrink-0">จำนวน</div>
        <div className="w-20 text-center shrink-0">หน่วย</div>
        <div className="w-24 text-right shrink-0">ราคาต่อหน่วย</div>
        <div className="w-24 text-right shrink-0">จำนวนเงิน</div>
        <div className="w-[52px] shrink-0 flex justify-center">
          {!isLocked && items.length > 0 && (
            <button 
              onClick={() => onChange([])}
              className="text-[9px] text-danger/50 hover:text-danger hover:underline transition-colors whitespace-nowrap"
              title="ลบทั้งหมด"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      
      {/* Body */}
      <div className="flex flex-col">
        {items.map((item, index) => (
          <InlineRow 
            key={item.id} 
            item={item} 
            index={index}
            updateItem={updateItem}
            updateItemFields={updateItemFields}
            onProductSelected={onProductSelected}
            removeItem={removeItem}
            addSubItem={addSubItem}
            isLocked={isLocked}
            availableProducts={availableProducts}
          />
        ))}
        {items.length === 0 && (
          <div className="min-h-[36px] flex items-center justify-center text-center">
            <p className="text-white/30 uppercase font-black text-[11px] tracking-[0.2em]">ไม่มีรายการสินค้า</p>
          </div>
        )}
      </div>

      {/* Add Item Row & Summary */}
      {!isLocked && (
        <div className="px-2 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between rounded-b-xl">
          <div className="flex items-center">
            <button 
              onClick={addItem}
              className="text-nexus-teal hover:text-nexus-teal/80 text-[12px] font-bold tracking-wide flex items-center gap-1.5 transition-colors hover:underline"
            >
              <Plus size={12} strokeWidth={3} /> เพิ่มรายการ
            </button>
            <span className="text-xs text-slate-400 opacity-50 ml-4 font-black uppercase tracking-widest border-l border-white/10 pl-4">
              รวม {items.length} รายการ / {items.reduce((sum, item) => sum + Number(item.qty || 0), 0)} ชิ้น
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
