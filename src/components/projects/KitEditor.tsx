// @ts-nocheck
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  X, Plus, Trash2, CheckCircle2, Package, Zap, Search, RefreshCw, Info, 
  DollarSign, Layers, Wrench, Edit3, Lock,
  Box, Target, TrendingUp, LayoutList
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  GlassCard,
  cn 
} from "@/components/ui/Base";
import { formatCurrency, getProfitRainbowColor } from "@/lib/erp-logic";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { resizeImage, generateStockPilotId } from "@/lib/utils";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Users } from "lucide-react";

/**
 * @fileOverview Strategic Kit Profile Editor V8.5 - UI Master h-9 Hardening
 * ปฏิรูปการออกแบบชุดงานติดตั้ง โดยแยกส่วนพัสดุและค่าแรงเพื่อการคำนวณต้นทุนที่แม่นยำ 100%
 */

interface KitEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const KIT_UNIT_TYPES = [
  { id: "ชุด", label: "นับเป็นชุด" },
  { id: "งาน", label: "เหมารวมทั้งงาน" },
  { id: "จุด", label: "นับตามจุดติดตั้ง" },
  { id: "เครื่อง", label: "นับตามตัวเครื่อง" }
];

const INITIAL_FORM = {
  name: "",
  description: "",
  unit_type: "ชุด",
  imageUrl: "",
  items: [] as any[],
  labor_items: [] as any[],
  suggested_price: 0
};

export function KitEditor({ isOpen, onClose, onSave, initialData, showToast }: KitEditorProps) {
  const { products, loading: productsLoading } = useInventory();
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "bom" | "labor">("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [productSearch, setProductSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [contractors, setContractors] = useState<any[]>([]);
  const [showContractorSelector, setShowContractorSelector] = useState(false);

  const categories = useMemo(() => {
    if (!products) return ["ทั้งหมด"];
    const cats = new Set<string>();
    products.forEach(p => { if (p.category_id || p.category) cats.add(p.category_id || p.category); });
    return ["ทั้งหมด", ...Array.from(cats)].slice(0, 8);
  }, [products]);

  const loadContractors = async () => {
    if (!companyId) return;
    const q = query(collection(db, "contractors"), where("companyId", "==", companyId), where("isActive", "==", true));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setContractors(list);
    setShowContractorSelector(true);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          name: initialData.name || "",
          description: initialData.description || "",
          unit_type: initialData.unit_type || "ชุด",
          imageUrl: initialData.imageUrl || "",
          items: initialData.items || [],
          labor_items: initialData.labor_items || [],
          suggested_price: initialData.pricing?.priceProject || initialData.suggested_price || 0
        });
        setIsLocked(true);
      } else {
        setForm(INITIAL_FORM);
        setIsLocked(false);
      }
      setActiveTab("general");
      setTouched(false);
    }
  }, [isOpen, initialData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        try {
          const optimizedImage = await resizeImage(rawBase64);
          setForm(prev => ({ ...prev, imageUrl: optimizedImage }));
          showToast("อัปโหลดและปรับขนาดภาพสำเร็จ", "success");
        } catch (err) {
          showToast("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ", "error");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const financials = useMemo(() => {
    const material_cost = form.items.reduce((acc, item) => acc + (Number(item.qty) * Number(item.cost_unit)), 0);
    const labor_cost = form.labor_items.reduce((acc, item) => acc + (Number(item.qty) * Number(item.rate)), 0);
    const total_cost = material_cost + labor_cost;
    const gp_amount = form.suggested_price - total_cost;
    const gp_percent = form.suggested_price > 0 ? (gp_amount / form.suggested_price) * 100 : 0;
    return { 
      material_cost, 
      labor_cost, 
      total_cost, 
      suggested_price: form.suggested_price, 
      gp_percent: Math.round(gp_percent * 10) / 10 
    };
  }, [form]);

  const rainbow = useMemo(() => getProfitRainbowColor(financials.gp_percent), [financials.gp_percent]);

  const validation = useMemo(() => ({ 
    name: (form.name || "").trim() !== "", 
    items: form.items.length > 0 || form.labor_items.length > 0, 
    isValid: (form.name || "").trim() !== "" && (form.items.length > 0 || form.labor_items.length > 0) 
  }), [form]);

  const addItem = (product: any) => {
    if (isLocked) return;
    const prodId = product.id || product.productId;
    if (form.items.find(i => i.product_id === prodId)) {
      setForm(prev => ({
        ...prev,
        items: prev.items.map(i => i.product_id === prodId ? { ...i, qty: i.qty + 1 } : i)
      }));
      showToast(`เพิ่มจำนวน ${product.name} เป็นชุดงานสำเร็จ`, "success");
      return;
    }
    setForm(prev => ({ 
      ...prev, 
      items: [...prev.items, { 
        product_id: prodId, 
        sku: product.sku, 
        name: product.name, 
        qty: 1, 
        unit: product.unit || "ชิ้น", 
        cost_unit: product.pricing?.costWAC || product.pricing?.avg_cost || 0, 
        priceProject: product.pricing?.priceProject || 0,
        pricePOS: product.pricing?.pricePOS || 0,
        note: "" 
      }] 
    }));
    showToast(`เพิ่ม ${product.name} เข้ารายการพัสดุสำเร็จ`, "success");
  };

  const handleCommit = async () => {
    setTouched(true);
    if (!validation.isValid) {
      if (!validation.name) showToast("กรุณาระบุชื่อชุดงานติดตั้ง", "error");
      else if (!validation.items) showToast("กรุณาเพิ่มรายการพัสดุ หรือค่าแรงอย่างน้อย 1 รายการ", "error");
      return;
    }
    if (isLocked || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSave({ ...form, financials });
      setIsLocked(true); 
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการบันทึกชุดงาน", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredProducts = products?.filter(p => {
    const matchSearch = (p.name || "").toLowerCase().includes(productSearch.toLowerCase()) || 
                        (p.sku || "").toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = activeCategory === "ทั้งหมด" || (p.category_id === activeCategory || p.category === activeCategory);
    return matchSearch && matchCat;
  }) || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
      <div className="w-full max-w-[1400px] h-full md:h-[92vh] flex flex-col border border-white/10 bg-zinc-950 shadow-2xl rounded-none md:rounded-[2rem] overflow-hidden">
        
        {/* Header Section */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-900/95 backdrop-blur-xl shrink-0 z-50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-nexus-teal/10 rounded-full text-nexus-teal border border-nexus-teal/20 shadow-[0_0_15px_rgba(0,255,209,0.2)] shrink-0">
              <Zap size={18} className="animate-pulse" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <h2 className="text-[15px] font-black text-white uppercase tracking-tight leading-none truncate">ออกแบบชุดงานติดตั้ง</h2>
              <p className="text-[10px] font-bold text-nexus-teal uppercase tracking-[0.2em] mt-1.5 opacity-80">Hybrid BOM & Labor Framework</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/20 min-w-0">
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 min-w-0 space-y-6">
              
              {/* Tactical Navigation Tabs */}
              <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-full backdrop-blur-md w-fit shadow-inner shrink-0">
                {(["general", "bom", "labor"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "h-9 px-6 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                      activeTab === tab 
                        ? "bg-nexus-teal text-black shadow-neon-teal" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {tab === "general" && <LayoutList size={14} />}
                    {tab === "bom" && <Layers size={14} />}
                    {tab === "labor" && <Wrench size={14} />}
                    {tab === "general" ? "ข้อมูลทั่วไป" : tab === "bom" ? "รายการพัสดุ" : "โครงสร้างค่าแรง"}
                  </button>
                ))}
              </div>

              {/* Form Content */}
              <div className={cn("flex-1 min-h-0 transition-all duration-300", isLocked && "opacity-60 grayscale-[0.5] pointer-events-none")}>
                
                {/* 1. GENERAL TAB */}
                {activeTab === "general" && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Image uploader */}
                      <div className="w-full lg:w-64 shrink-0 space-y-2">
                        <label className="text-[11px] font-black text-white/50 uppercase tracking-widest">รูปภาพจำลองผลงานติดตั้ง</label>
                        <div className="relative group aspect-square rounded-[2rem] bg-white/[0.02] border border-white/5 overflow-hidden shadow-2xl flex items-center justify-center">
                          {form.imageUrl ? (
                            <img src={form.imageUrl} alt="Installation Kit preview" className="w-full h-full object-cover p-2 rounded-[2rem]" />
                          ) : (
                            <Box className="w-12 h-12 text-white/10" />
                          )}
                          {!isLocked && (
                            <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label htmlFor="kit-img-up" className="cursor-pointer bg-nexus-teal text-black px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all">
                                อัปโหลดรูปภาพ
                              </label>
                              <input id="kit-img-up" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Basic details */}
                      <div className="flex-1 space-y-4 min-w-0">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-white/50 uppercase tracking-widest">ชื่อชุดงานติดตั้ง *</label>
                          <PillInput 
                            disabled={isLocked} 
                            placeholder="เช่น ชุดติดตั้ง Access Point + ท่อสายสัญญาณสำเร็จรูป..." 
                            className={cn("w-full bg-white/[0.02] font-black text-sm", touched && !validation.name && "border-danger/50 shadow-inner shadow-danger/10")} 
                            value={form.name} 
                            onChange={(e) => setForm({...form, name: e.target.value})} 
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black text-white/50 uppercase tracking-widest">หน่วยนับชุดงาน</label>
                            <PillSelect 
                              disabled={isLocked} 
                              value={form.unit_type} 
                              onChange={(e) => setForm({...form, unit_type: e.target.value})} 
                              className="w-full"
                            >
                              {KIT_UNIT_TYPES.map(t => (
                                <option key={t.id} value={t.id} className="bg-zinc-950">{t.label}</option>
                              ))}
                            </PillSelect>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[11px] font-black text-white/50 uppercase tracking-widest">ราคาเสนอขายแนะนำ</label>
                            <NumberStepper 
                              disabled={isLocked} 
                              value={form.suggested_price} 
                              onChange={(v) => setForm({...form, suggested_price: v})} 
                              unit="฿" 
                              step={100}
                              className="w-full" 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-white/50 uppercase tracking-widest">ขอบเขตงานและรายละเอียดทางเทคนิค</label>
                          <textarea 
                            disabled={isLocked} 
                            rows={4}
                            className="w-full p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 transition-all placeholder:text-white/10 backdrop-blur-sm resize-none" 
                            placeholder="ระบุรายละเอียดอุปกรณ์และงานระบบที่จะได้รับ..." 
                            value={form.description} 
                            onChange={(e) => setForm({...form, description: e.target.value})} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "bom" && (
                  <div className="flex flex-col lg:flex-row gap-4 animate-in fade-in duration-300 min-h-0 min-w-0 h-full max-h-[500px]">
                    
                    {/* Left Catalog Table (65%) */}
                    {!isLocked && (
                      <div className="w-full lg:w-[65%] flex flex-col bg-black/40 border border-white/5 rounded-[2.5rem] p-5 space-y-4 shadow-inner min-h-0 relative">
                        {/* Top Nav: Categories & Search */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
                          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0 w-full md:w-auto">
                            {categories.map(cat => (
                              <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                  "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                                  activeCategory === cat 
                                    ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal/50 shadow-[0_0_15px_rgba(0,255,209,0.15)]" 
                                    : "bg-white/[0.02] text-white/40 border-white/5 hover:text-white hover:bg-white/5"
                                )}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                          <div className="relative w-full md:w-64 shrink-0">
                            <PillInput 
                              placeholder="พิมพ์เพื่อค้นหา..." 
                              className="w-full pl-10 bg-[#0a0a0c] text-xs border-white/5 focus:border-nexus-teal/30" 
                              value={productSearch} 
                              onChange={(e) => setProductSearch(e.target.value)} 
                            />
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                          </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-white/5 bg-[#09090b]/80 relative">
                          <NexusTable headers={["รูปภาพ", "รหัสสินค้า", "ชื่อสินค้า", "ราคา", "สต็อก", "จัดการ"]}>
                            {productsLoading ? (
                              <NexusTableRow>
                                <NexusTableCell colSpan={6} className="text-center py-16 text-white/20 text-xs">กำลังโหลดสินค้า...</NexusTableCell>
                              </NexusTableRow>
                            ) : filteredProducts.length === 0 ? (
                              <NexusTableRow>
                                <NexusTableCell colSpan={6} className="text-center py-16 text-white/20 text-xs">ไม่พบพัสดุ</NexusTableCell>
                              </NexusTableRow>
                            ) : (
                              filteredProducts.filter(p => !p.isKit).map(p => (
                                <NexusTableRow key={p.id} className="hover:bg-white/[0.02] transition-colors">
                                  <NexusTableCell className="w-[10%]">
                                    <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/5 overflow-hidden flex items-center justify-center">
                                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover p-0.5" /> : <Package size={14} className="text-nexus-blue" />}
                                    </div>
                                  </NexusTableCell>
                                  <NexusTableCell className="w-[20%] text-[10px] text-nexus-teal font-mono font-bold tracking-tighter">
                                    {p.sku}
                                  </NexusTableCell>
                                  <NexusTableCell className="w-[35%] font-black text-white/85 text-[11px] truncate max-w-[150px]">
                                    {p.name}
                                  </NexusTableCell>
                                  <NexusTableCell className="w-[15%] font-mono font-black text-nexus-teal/80 text-[11px] text-right">
                                    {formatCurrency(p.pricing?.priceProject || p.pricing?.avg_cost || 0)}
                                  </NexusTableCell>
                                  <NexusTableCell className="w-[10%]">
                                    <div className="bg-nexus-teal/10 text-nexus-teal text-[10px] font-mono font-black py-1 px-2 rounded text-center">
                                      {p.stockStatus?.available || 0}
                                    </div>
                                  </NexusTableCell>
                                  <NexusTableCell className="w-[10%] text-center">
                                    <button onClick={() => addItem(p)} className="p-1.5 bg-white/5 hover:bg-nexus-teal hover:text-black text-white/50 rounded-lg transition-all">
                                      <Plus size={14} />
                                    </button>
                                  </NexusTableCell>
                                </NexusTableRow>
                              ))
                            )}
                          </NexusTable>
                        </div>
                      </div>
                    )}

                    {/* Right Cart (35%) */}
                    <div className={cn("flex flex-col bg-[#09090b]/40 border border-white/5 rounded-[2.5rem] shadow-inner min-h-0 relative", isLocked ? "w-full" : "w-full lg:w-[35%]")}>
                      <div className="p-5 border-b border-white/5 shrink-0 flex items-center justify-between">
                        <h3 className="text-[13px] font-black text-white uppercase tracking-wider flex items-center gap-2">
                          ตะกร้าชุดงาน <span className="bg-nexus-teal text-black px-2 py-0.5 rounded-full text-[10px]">{form.items.length}</span>
                        </h3>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 relative">
                        {form.items.length === 0 ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                            <Box size={48} className="mb-4 opacity-50" />
                            <p className="text-xs font-bold uppercase tracking-wider">ยังไม่มีรายการสินค้า</p>
                          </div>
                        ) : (
                          form.items.map((item, idx) => (
                            <div key={item.product_id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative group hover:border-white/10 transition-colors">
                              <button onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))} className="absolute top-3 right-3 text-white/20 hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                              </button>
                              
                              <div className="pr-6">
                                <div className="font-bold text-white/90 text-xs mb-1 line-clamp-2 leading-tight">{item.name}</div>
                                <div className="text-[10px] text-nexus-blue font-mono">SKU: {item.sku}</div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 p-2 bg-black/40 rounded-xl">
                                <div className="flex flex-col items-center justify-center text-center">
                                  <span className="text-[8px] text-white/40 uppercase">Cost</span>
                                  <span className="text-[10px] font-mono font-black text-white/50 not-italic">{formatCurrency(item.cost_unit)}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center border-x border-white/5 text-center">
                                  <span className="text-[8px] text-nexus-teal/60 uppercase">Project</span>
                                  <span className="text-[10px] font-mono font-black text-nexus-teal/80 not-italic">{formatCurrency(item.priceProject || 0)}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center text-center">
                                  <span className="text-[8px] text-nexus-blue/60 uppercase">POS</span>
                                  <span className="text-[10px] font-mono font-black text-nexus-blue/80 not-italic">{formatCurrency(item.pricePOS || 0)}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <div className="w-24">
                                  <NumberStepper disabled={isLocked} size="sm" value={item.qty} unit={item.unit} onChange={(val) => { const ni = [...form.items]; ni[idx].qty = val; setForm({...form, items: ni}); }} />
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] text-white/40 uppercase mb-0.5">รวมต้นทุน</div>
                                  <div className="font-mono font-black text-white text-xs not-italic">{formatCurrency(Number(item.qty) * Number(item.cost_unit))}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-5 bg-black/40 border-t border-white/5 shrink-0 rounded-b-[2.5rem] space-y-2">
                        <div className="flex justify-between text-[11px] font-bold text-white/50">
                          <span>ราคาพัสดุรวม</span>
                          <span className="font-mono text-white/80 not-italic">{formatCurrency(financials.material_cost)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-white/50">
                          <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                          <span className="font-mono text-white/80 not-italic">{formatCurrency(financials.material_cost * 0.07)}</span>
                        </div>
                        <div className="flex justify-between text-[13px] font-black text-nexus-teal pt-2 border-t border-white/5">
                          <span>ยอดรวมสุทธิ</span>
                          <span className="font-mono not-italic">{formatCurrency(financials.material_cost * 1.07)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. LABOR TAB */}
                {activeTab === "labor" && (
                  <div className="space-y-4 animate-in fade-in duration-300 flex flex-col min-h-0">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                      <h3 className="text-[12px] font-black text-nexus-teal uppercase flex items-center gap-2 tracking-wider italic">
                        <Wrench size={14} /> โครงสร้างบริการและงานปฏิบัติการ
                      </h3>
                      <div className="flex gap-2">
                        {!isLocked && (
                          <PillButton 
                            variant="glass" 
                            className="h-8 border-nexus-blue/30 text-nexus-blue hover:bg-nexus-blue/10 transition-all font-bold"
                            onClick={loadContractors}
                          >
                            <Users size={12} /> นำเข้าค่าแรงจากผู้รับเหมา
                          </PillButton>
                        )}
                        {!isLocked && (
                          <PillButton 
                            variant="glass" 
                            className="h-8"
                            onClick={() => setForm(prev => ({
                              ...prev, 
                              labor_items: [...prev.labor_items, { label: "", rate: 0, qty: 1, unit: form.unit_type.split(" ")[0] }]
                            }))}
                          >
                            <Plus size={12} /> เพิ่มประเภทค่าแรง
                          </PillButton>
                        )}
                      </div>
                    </div>

                    {showContractorSelector && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-[2rem] animate-in fade-in">
                        <div className="bg-[#0a0a0c] border border-white/10 p-6 rounded-3xl w-full max-w-[400px] shadow-[0_0_50px_rgba(37,99,235,0.15)] flex flex-col max-h-[80%]">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[13px] font-black text-white uppercase tracking-wider flex items-center gap-2"><Wrench size={16} className="text-nexus-blue" /> เลือกชุดค่าแรงผู้รับเหมา</h4>
                            <button onClick={() => setShowContractorSelector(false)} className="text-white/40 hover:text-white"><X size={16}/></button>
                          </div>
                          
                          <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                            {contractors.length === 0 ? (
                              <p className="text-xs text-white/40 text-center py-8 border border-white/5 border-dashed rounded-xl">ไม่พบข้อมูลผู้รับเหมาในระบบ</p>
                            ) : (
                              contractors.map(c => (
                                <div 
                                  key={c.id} 
                                  onClick={() => {
                                    const newLabors = c.laborRates?.map((lr: any) => ({
                                      label: `${lr.label} (อ้างอิง: ${c.name})`,
                                      qty: 1,
                                      rate: lr.rate,
                                      unit: lr.unit
                                    })) || [];
                                    setForm(prev => ({ ...prev, labor_items: [...prev.labor_items, ...newLabors] }));
                                    setShowContractorSelector(false);
                                    showToast(`นำเข้า ${newLabors.length} รายการค่าแรงจาก ${c.name} สำเร็จ`, "success");
                                  }}
                                  className="p-4 bg-white/[0.02] hover:bg-nexus-blue/10 border border-white/5 hover:border-nexus-blue/30 cursor-pointer rounded-2xl transition-all group"
                                >
                                  <div className="font-black text-[13px] text-white group-hover:text-nexus-blue transition-colors">{c.name}</div>
                                  <div className="text-[11px] text-white/50 mt-1 flex items-center gap-2">
                                    <Layers size={10}/> {c.laborRates?.length || 0} รายการค่าแรงมาตรฐาน
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex-1 border border-white/5 rounded-[2.5rem] bg-[#09090b]/40 shadow-inner overflow-hidden max-h-[380px]">
                      <div className="overflow-y-auto custom-scrollbar h-full relative">
                        <NexusTable headers={["ประเภทบริการ / บริการทางวิศวกรรม", "จำนวนหน่วย", "อัตรามาตรฐาน (฿ / หน่วย)", "การทำงาน"]}>
                          {form.labor_items.length === 0 ? (
                            <NexusTableRow>
                              <NexusTableCell colSpan={4} className="text-center py-32 text-white/25 italic text-xs">
                                ยังไม่มีโครงสร้างค่าแรงบริการ (กดปุ่ม "เพิ่มประเภทค่าแรง" ขวาบนเพื่อเริ่มคำนวณ)
                              </NexusTableCell>
                            </NexusTableRow>
                          ) : (
                            form.labor_items.map((item, idx) => (
                              <NexusTableRow key={idx} className="hover:bg-white/[0.02] transition-colors">
                                <NexusTableCell className="w-[50%]">
                                  <PillInput 
                                    disabled={isLocked} 
                                    placeholder="ระบุ เช่น เดินสายสัญญาณและติดเต้ารับ LAN RJ45, ค่าบริการเซ็ตอัพ..." 
                                    className="w-full bg-transparent border-none text-white text-xs px-0 focus:bg-transparent" 
                                    value={item.label} 
                                    onChange={(e) => { 
                                      const nl = [...form.labor_items]; 
                                      nl[idx].label = e.target.value; 
                                      setForm({...form, labor_items: nl}); 
                                    }} 
                                  />
                                </NexusTableCell>
                                <NexusTableCell className="w-[20%] text-right">
                                  <div className="flex justify-end">
                                    <NumberStepper 
                                      disabled={isLocked} 
                                      size="sm" 
                                      value={item.qty} 
                                      unit={item.unit} 
                                      onChange={(val) => { 
                                        const nl = [...form.labor_items]; 
                                        nl[idx].qty = val; 
                                        setForm({...form, labor_items: nl}); 
                                      }} 
                                    />
                                  </div>
                                </NexusTableCell>
                                <NexusTableCell className="w-[20%] text-right">
                                  <div className="flex justify-end">
                                    <NumberStepper 
                                      disabled={isLocked} 
                                      size="sm" 
                                      value={item.rate} 
                                      unit="฿" 
                                      step={100}
                                      onChange={(val) => { 
                                        const nl = [...form.labor_items]; 
                                        nl[idx].rate = val; 
                                        setForm({...form, labor_items: nl}); 
                                      }} 
                                    />
                                  </div>
                                </NexusTableCell>
                                <NexusTableCell className="w-[10%] text-center">
                                  <button 
                                    type="button"
                                    disabled={isLocked} 
                                    onClick={() => setForm(prev => ({ ...prev, labor_items: prev.labor_items.filter((_, i) => i !== idx) }))} 
                                    className="text-white/30 hover:text-danger p-2 transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </NexusTableCell>
                              </NexusTableRow>
                            ))
                          )}
                        </NexusTable>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Right Sidebar: Strategic Profit Intelligence */}
          <div className="w-full md:w-[320px] bg-zinc-900/60 border-t md:border-t-0 md:border-l border-white/5 p-6 flex flex-col justify-between shrink-0 shadow-[inset_15px_0_40px_-15px_rgba(0,0,0,0.6)] z-40 overflow-y-auto custom-scrollbar">
            <div className="space-y-6 flex-1">
              
              {isLocked && initialData && (
                <PillButton 
                  type="button"
                  onClick={() => setIsLocked(false)} 
                  className="w-full h-9 bg-nexus-teal text-black shadow-neon-teal font-black text-xs uppercase"
                >
                  <Edit3 size={14} /> แก้ไขการประกอบชุดงาน
                </PillButton>
              )}

              {/* Profit Rainbow Analysis Panel */}
              <GlassCard className="p-5 bg-zinc-950 border-white/10 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Target size={14} className="text-nexus-teal fill-current animate-pulse" /> วิเคราะห์กำไรขั้นต้น
                  </h4>
                  <div className="w-2 h-2 rounded-full bg-nexus-teal animate-ping" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase">
                    <span>พัสดุ</span>
                    <span className="text-white/80 font-mono text-[11px]">{formatCurrency(financials.material_cost)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase">
                    <span>งานช่าง</span>
                    <span className="text-white/80 font-mono text-[11px]">{formatCurrency(financials.labor_cost)}</span>
                  </div>
                  <div className="pt-2 mt-1 border-t border-white/5 flex justify-between items-center text-[11px] font-black text-white/70 uppercase">
                    <span>ต้นทุนรวมของชุดงาน</span>
                    <span className="text-nexus-teal font-mono text-xs font-black">{formatCurrency(financials.total_cost)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase">
                    <span>ราคาจำหน่ายเสนอแนะ</span>
                    <span className="text-white font-mono text-xs font-black">{formatCurrency(financials.suggested_price)}</span>
                  </div>
                  
                  {/* Profit Rainbow Glowing Panel */}
                  <div className={cn("mt-4 p-4 rounded-2xl border shadow-inner transition-all flex flex-col items-center gap-1 text-center", rainbow.bg, rainbow.border)}>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={12} className={cn(rainbow.text)} />
                      <span className={cn("text-[9px] font-black uppercase tracking-widest", rainbow.text)}>
                        {rainbow.label}
                      </span>
                    </div>
                    <div className={cn("text-2xl font-black font-mono tracking-tight", rainbow.text)}>
                      {financials.gp_percent}%
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* ID Protocol Notice */}
              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-white/60">
                  <Info size={14} className="text-nexus-blue" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Strategic ID Protocol V8.5</span>
                </div>
                <p className="text-[9px] text-white/35 font-bold leading-normal">
                  รหัสจะรันอัตโนมัติเป็น <strong className="text-white/60">`KIT-26-[MNEMONIC]-XXXX`</strong> โดยอ้างอิงจากตัวอักษรช่วยจำหมวดหมู่และลำดับคิวในระบบ เพื่อรักษาระเบียบและสืบค้นเชิงยุทธศาสตร์ที่แม่นยำ
                </p>
              </div>

            </div>
            
            {/* Action Bar */}
            <div className="space-y-2 pt-6">
              <PillButton 
                type="button"
                disabled={isSubmitting || isLocked || (touched && !validation.isValid)} 
                onClick={handleCommit} 
                className="w-full h-9 bg-nexus-teal text-black shadow-neon-teal font-black text-xs uppercase"
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <><CheckCircle2 size={14} /> ยืนยันบันทึกชุดงานติดตั้ง</>
                )}
              </PillButton>
              <PillButton 
                type="button"
                variant="ghost"
                onClick={onClose} 
                className="w-full h-9 hover: text-xs font-black uppercase"
              >
                ยกเลิกการออกแบบ
              </PillButton>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

