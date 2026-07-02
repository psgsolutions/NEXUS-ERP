"use client";

import React, { useState, useMemo } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { formatCurrency } from "@/lib/erp-logic";

export interface DocumentItemsTableProps {
  items: any[];
  onChange: (newItems: any[]) => void;
  isLocked?: boolean;
  availableProducts?: any[];
}

const DEFAULT_PRODUCTS = [
  { id: "PROD-001", name: "ชุดอุปกรณ์สำนักงานอัจฉริยะ", unit: "ชุด", price: 15000, cost: 8000 },
  { id: "PROD-002", name: "บริการติดตั้งระบบเครือข่าย", unit: "ครั้ง", price: 7500, cost: 3000 },
  { id: "PROD-003", name: "ซอฟต์แวร์บริหารจัดการ NEXUS PRO (NEXUS PRO Software License)", unit: "License", price: 25000, cost: 10000 },
  { id: "PROD-004", name: "กล้องวงจรปิด AI (AI CCTV Camera)", unit: "ตัว", price: 5000, cost: 2500 },
  { id: "PROD-005", name: "เครื่องสแกนลายนิ้วมือ", unit: "เครื่อง", price: 3000, cost: 1500 },
  { id: "SERV-001", name: "งานซ่อมบำรุงประจำปี", unit: "ปี", price: 12000, cost: 4000 },
  { id: "PART-001", name: "จอภาพ LED ขนาด 24 นิ้ว (24-inch LED Monitor)", unit: "จอ", price: 4500, cost: 2000 },
];

export function DocumentItemsTable({ items = [], onChange, isLocked = false, availableProducts = DEFAULT_PRODUCTS }: DocumentItemsTableProps) {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  const addItem = () => {
    if (isLocked) return;
    onChange([...items, { 
      id: Date.now(), 
      productId: null,
      name: "ใหม่: ระบุชื่อสินค้า...", 
      qty: 1, 
      unit: "Set", 
      price: 0, 
      cost: 0 
    }]);
  };

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const addSelectedItem = (product: any) => {
    if (isLocked) return;
    
    const existingItemIndex = items.findIndex(i => i.productId === product.id);
    
    if (existingItemIndex >= 0) {
      const newItems = [...items];
      newItems[existingItemIndex] = { 
        ...newItems[existingItemIndex], 
        qty: newItems[existingItemIndex].qty + 1 
      };
      onChange(newItems);
      return;
    }

    onChange([...items, {
      id: Date.now(),
      productId: product.id,
      name: product.name,
      qty: 1,
      unit: product.unit || "ชิ้น",
      price: product.price,
      cost: product.cost || 0,
    }]);
  };

  const filteredAvailableProducts = useMemo(() => {
    return availableProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableProducts, searchTerm]);

  const removeItem = (id: number) => {
    if (isLocked) return;
    onChange(items.filter(i => i.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    if (isLocked) return;
    onChange(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  return (
    <div className="border border-white/10 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
        {/* Header */}
        <div className="grid grid-cols-12 text-[11px] font-black text-white/60 uppercase tracking-widest px-6 py-4 border-b border-white/10 bg-white/[0.03]">
            <div className="col-span-1 text-center">ลำดับ</div>
            <div className="col-span-5">รายการ (Description)</div>
            <div className="col-span-1 text-center">จำนวน</div>
            <div className="col-span-1 text-center">หน่วย</div>
            <div className="col-span-2 text-right">ราคา/หน่วย</div>
            <div className="col-span-2 text-right">จำนวนเงิน</div>
        </div>
        
        {/* Body */}
        <div className="divide-y divide-white/5">
            {items.map((item, index) => {
                const isExpanded = expandedItems.includes(item.id);
                return (
                    <div key={item.id} className="group transition-all">
                        {/* Main Row */}
                        <div 
                            className={cn(
                                "grid grid-cols-12 gap-4 items-start px-6 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors",
                                isExpanded && "bg-white/[0.03]"
                            )}
                            onClick={() => toggleExpand(item.id)}
                        >
                            <div className="col-span-1 text-center font-mono text-[15px] text-white/40 pt-1">{index + 1}</div>
                            <div className="col-span-5 space-y-1">
                                <p className="font-bold text-[15px] text-white whitespace-pre-wrap">{item.name}</p>
                            </div>
                            <div className="col-span-1 text-center">
                                <p className="font-mono text-[15px] text-white/80 pt-1">{item.qty}</p>
                            </div>
                            <div className="col-span-1 text-center">
                                <p className="font-bold text-[14px] text-white/60 pt-1">{item.unit || "จุด"}</p>
                            </div>
                            <div className="col-span-2 text-right">
                                <p className="font-mono text-[15px] text-white/80 pt-1">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="col-span-2 text-right">
                                <p className="font-mono text-[16px] font-black text-nexus-teal pt-1">{formatCurrency(item.qty * item.price)}</p>
                            </div>
                        </div>

                        {/* Editor (Expanded) */}
                        {isExpanded && (
                            <div className="px-6 py-4 bg-black/40 border-t border-white/5 animate-in fade-in">
                                <div className="grid grid-cols-12 gap-6 items-start">
                                    <div className="col-span-1"></div>
                                    <div className="col-span-5 space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">รายละเอียด</label>
                                        <textarea 
                                            value={item.name}
                                            onChange={(e) => updateItem(item.id, "name", e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-[14px] text-white focus:border-nexus-blue outline-none min-h-[80px]" 
                                        />
                                    </div>
                                    <div className="col-span-6 grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center block">จำนวน (Qty)</label>
                                            <NumberStepper 
                                                value={item.qty} 
                                                unit={item.unit || "ชิ้น"}
                                                onChange={(val) => updateItem(item.id, "qty", val)}
                                            />
                                        </div>
                                        <div className="space-y-2 text-right">
                                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block">ราคา/หน่วย (Price)</label>
                                            <NumberStepper 
                                                value={item.price} 
                                                unit="฿"
                                                step={100}
                                                onChange={(val) => updateItem(item.id, "price", val)}
                                            />
                                        </div>
                                        <div className="col-span-2 flex justify-end mt-4">
                                            <PillButton variant="ghost" className="text-danger hover:bg-danger/10 px-4 h-9" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>
                                                <Trash2 size={16} className="mr-2" /> ลบรายการ
                                            </PillButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            {items.length === 0 && (
                <div className="py-3 px-4 text-center text-white/20 uppercase font-black text-[11px] tracking-[0.2em] border border-dashed border-white/5 mx-4 my-2 rounded-xl">
                    ไม่มีรายการสินค้า
                </div>
            )}
        </div>

        {/* TABLE ACTIONS (Same line as search) */}
        <div className="flex items-center gap-2 p-2 bg-white/[0.02] border-t border-white/10">
            <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <PillInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowProductPicker(true)}
                    placeholder="ค้นหาสินค้าคลัง..."
                    className="w-full text-white font-bold h-9 pl-9 pr-4 rounded-full text-[13px]"
                />
            </div>
            <PillButton 
                variant="glass"
                className="h-9 w-9 p-0 rounded-full flex items-center justify-center flex-shrink-0"
                onClick={() => setShowProductPicker(prev => !prev)}
                title="สลับการค้นหาคลังสินค้า"
            >
                <Search size={14} />
            </PillButton>
            <PillButton 
                variant="glass" 
                className="h-9 w-9 p-0 rounded-full flex items-center justify-center flex-shrink-0 text-nexus-blue" 
                onClick={addItem}
                title="เพิ่มรายการอิสระ"
            >
                <Plus size={16} />
            </PillButton>
        </div>

        {/* PRODUCT PICKER RESULTS */}
        {showProductPicker && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 p-4 border-t border-white/10 bg-black/40">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredAvailableProducts.length > 0 ? (
                    <div className="space-y-1">
                        <div className="grid grid-cols-12 text-[10px] font-black text-white/40 uppercase tracking-widest px-4 py-2 border-b border-white/5">
                            <div className="col-span-7">ชื่อสินค้า / รายการบริการ</div>
                            <div className="col-span-2 text-center">หน่วย</div>
                            <div className="col-span-3 text-right">ราคาต่อหน่วย</div>
                        </div>
                        {filteredAvailableProducts.map(product => (
                        <div 
                            key={product.id} 
                            onClick={() => addSelectedItem(product)}
                            className="grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-nexus-blue/10 border border-transparent hover:border-nexus-blue/30 rounded-xl transition-all cursor-pointer group"
                        >
                            <div className="col-span-7">
                                <p className="font-black text-[13px] text-white group-hover:text-nexus-blue transition-colors truncate">{product.name}</p>
                            </div>
                            <div className="col-span-2 text-center">
                                <p className="font-bold text-[12px] text-white/60">{product.unit}</p>
                            </div>
                            <div className="col-span-3 text-right flex items-center justify-end gap-3">
                                <p className="font-mono text-[13px] font-bold text-white">{formatCurrency(product.price)}</p>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus size={14} className="text-nexus-blue" />
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    ) : (
                    <div className="p-6 text-center text-white/30 uppercase font-black text-[11px] tracking-[0.2em]">
                        ไม่พบรายการพัสดุ
                    </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
