"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Search, 
  ArrowUpRight,
  Calculator,
  Box,
  TrendingUp,
  Percent,
  Zap,
  LayoutList,
  Layers,
  ClipboardList,
  Target,
  RefreshCw,
  Edit3
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs, 
  NexusDataField,
  PillCheckbox,
  cn 
} from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { calculateFinancials, formatCurrency, getProfitRainbowColor, VatType } from "@/lib/erp-logic";
import { useSystemDialog } from "@/context/DialogContext";

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onApprove?: (quoteId: string) => void;
  initialData?: any;
}

const INITIAL_FORM = {
  subject: "",
  customer: "",
  date: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  taxMode: "Inclusive" as VatType,
  salesPerson: "Kriangkrai M.",
  paymentTerms: "30 Days",
  isDraftProject: false,
  terms: "1. ราคานี้ยืนอยู่ได้ 30 วันนับจากวันที่ออกเอกสาร\n2. กำหนดส่งมอบภายใน 15-30 วันหลังจากได้รับใบสั่งซื้อ (PO)\n3. รับประกันคุณภาพสินค้า 1 ปีเต็ม",
  items: [] as any[]
};

export function QuotationModal({ isOpen, onClose, onSave, onApprove, initialData }: QuotationModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("header");
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [availableProducts, setAvailableProducts] = useState<any[]>([
    { id: "PROD-001", name: "ชุดอุปกรณ์สำนักงานอัจฉริยะ (Smart Office Kit)", unit: "ชุด", price: 15000, cost: 8000 },
    { id: "PROD-002", name: "บริการติดตั้งระบบเครือข่าย (Network Setup Service)", unit: "ครั้ง", price: 7500, cost: 3000 },
    { id: "PROD-003", name: "ซอฟต์แวร์บริหารจัดการ NEXUS PRO (NEXUS PRO Software License)", unit: "License", price: 25000, cost: 10000 },
    { id: "PROD-004", name: "กล้องวงจรปิด AI (AI CCTV Camera)", unit: "ตัว", price: 5000, cost: 2500 },
    { id: "PROD-005", name: "เครื่องสแกนลายนิ้วมือ (Fingerprint Scanner)", unit: "เครื่อง", price: 3000, cost: 1500 },
    { id: "SERV-001", name: "งานซ่อมบำรุงประจำปี (Annual Maintenance Service)", unit: "ปี", price: 12000, cost: 4000 },
    { id: "PART-001", name: "จอภาพ LED ขนาด 24 นิ้ว (24-inch LED Monitor)", unit: "จอ", price: 4500, cost: 2000 },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  useEffect(() => {
    if (initialData && isOpen) {
      setForm({
        ...INITIAL_FORM,
        subject: initialData.title || "",
        customer: initialData.customer || "",
        items: initialData.items || []
      });
      setIsLocked(false); // Unlocked by default for project pulls, allowing full editing!
    } else if (isOpen) {
      setForm(INITIAL_FORM);
      setIsLocked(false);
    }
  }, [initialData, isOpen]);

  const financials = useMemo(() => calculateFinancials(form.items, form.taxMode), [form.items, form.taxMode]);
  const rainbow = useMemo(() => getProfitRainbowColor(financials.gpPercent), [financials.gpPercent]);

  const tabs = [
    { id: "header", label: "ข้อมูลพื้นฐานเอกสาร (HEADER)", icon: <LayoutList /> },
    { id: "items", label: "รายการสินค้าและบริการ (ITEMS)", icon: <Layers /> },
    { id: "terms", label: "ข้อกำหนดและเงื่อนไข (TERMS)", icon: <ClipboardList /> }
  ];

  const addItem = () => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { 
        id: Date.now(), 
        name: "ใหม่: ระบุชื่อสินค้า...", 
        qty: 1, 
        unit: "Set", 
        price: 0, 
        cost: 0 
      }]
    }));
  };

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const addSelectedItem = (product: any) => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        id: Date.now(), // Unique ID for the quotation item
        name: product.name,
        qty: 1,
        unit: product.unit || "ชิ้น",
        price: product.price,
        cost: product.cost || 0,
      }]
    }));
  };

  const filteredAvailableProducts = useMemo(() => {
    return availableProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableProducts, searchTerm]);

  const removeItem = (id: number) => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const updateItem = (id: number, field: string, value: any) => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, [field]: value } : i)
    }));
  };

  const handleSave = async () => {
    if (!form.customer && !form.subject) return void showAlert("กรุณาระบุข้อมูลหัวข้อโครงการและลูกค้า");
    setIsSubmitting(true);
    try {
      await onSave({ ...form, financials });
      setIsLocked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (initialData && initialData.id && onApprove) {
      setIsSubmitting(true);
      try {
        await onApprove(initialData.id);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ใบเสนอราคา"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        {/* MAIN INPUT CANVAS (LEFT) */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]" title="ระบบบริหารการขายมาตรฐาน V2.9.5">COMMERCE V2.9</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">ใบเสนอราคา</h4>
              </div>
              <PillTabs 
                tabs={[
                  { id: "header", label: "ข้อมูลหลัก", icon: <LayoutList /> },
                  { id: "items", label: "รายการ", icon: <Layers /> },
                  { id: "terms", label: "เงื่อนไข", icon: <ClipboardList /> }
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            <div className={cn("space-y-10 transition-all duration-500", isLocked && "opacity-60 pointer-events-none grayscale-[0.5]")}>
              {activeTab === "header" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                  <div className="grid grid-cols-2 gap-8">
                    <Field label="ชื่อลูกค้า / นิติบุคคล (CUSTOMER) *">
                      <PillSelect 
                        value={form.customer}
                        onChange={(e) => setForm({...form, customer: e.target.value})}
                        className="w-full"
                      >
                        <option value="">เลือกจากฐานข้อมูล...</option>
                        <option value="CUS-001">โรงพยาบาลตากสิน</option>
                        <option value="CUS-002">PSG Solutions</option>
                        <option value="CUS-003">สถาบันเทคโนโลยีพระจอมเกล้าฯ</option>
                        <option value="CUS-004">ศูนย์ประชุมแห่งชาติ</option>
                      </PillSelect>
                    </Field>
                    <Field label="ชื่อโครงการ / หัวข้อโครงการ *">
                      <PillInput 
                        value={form.subject}
                        onChange={(e) => setForm({...form, subject: e.target.value})}
                        placeholder="ระบุชื่อโครงการ..." 
                        className="w-full text-white font-bold" 
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                    <Field label="วันที่ออกเอกสาร">
                      <PillInput 
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({...form, date: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                    <Field label="ยืนราคาถึงวันที่">
                      <PillInput 
                        type="date"
                        value={form.validUntil}
                        onChange={(e) => setForm({...form, validUntil: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                    <Field label="ระบบภาษี (VAT)">
                      <PillSelect 
                        value={form.taxMode}
                        onChange={(e) => setForm({...form, taxMode: e.target.value as VatType})}
                        className="w-full"
                      >
                        <option value="Inclusive">รวมภาษี (Inclusive 7%)</option>
                        <option value="Exclusive">แยกภาษี (Exclusive 7%)</option>
                        <option value="Non-VAT">ไม่มีภาษี (Non-VAT)</option>
                      </PillSelect>
                    </Field>
                  </div>
                </div>
              )}

              {/* ITEMS TAB */}
              {activeTab === "items" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                  {/* 1. INVENTORY SELECTION SECTION */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Box className="text-nexus-blue" size={18} />
                        <h4 className="text-[12px] font-black text-white/80 uppercase tracking-[0.2em]">คลังสินค้าและบริการ (AVAILABLE INVENTORY)</h4>
                      </div>
                      <PillButton 
                        variant="glass"
                        className="h-9 px-6 rounded-full"
                        onClick={() => setShowProductPicker(prev => !prev)}
                      >
                        <Search size={14} className="mr-2" /> {showProductPicker ? "ปิดการค้นหา" : "ค้นหาสินค้าในคลัง"}
                      </PillButton>
                    </div>

                    {showProductPicker && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 p-6 border border-white/5 rounded-[2rem] bg-white/[0.02]">
                        <PillInput
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="พิมพ์ชื่อสินค้าหรือรหัสพัสดุเพื่อค้นหา..."
                          className="w-full text-white font-bold h-9 px-6 rounded-full"
                        />
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                          {filteredAvailableProducts.length > 0 ? (
                            <div className="space-y-1 mt-4">
                              {/* Available Products Table Header */}
                              <div className="grid grid-cols-12 text-[10px] font-black text-white/40 uppercase tracking-widest px-6 py-3 border-b border-white/5">
                                <div className="col-span-6">ชื่อสินค้า / รายการบริการ</div>
                                <div className="col-span-2 text-center">หน่วย</div>
                                <div className="col-span-4 text-right">ราคาต่อหน่วย</div>
                              </div>
                              {filteredAvailableProducts.map(product => (
                                <div 
                                  key={product.id} 
                                  onClick={() => addSelectedItem(product)}
                                  className="grid grid-cols-12 gap-4 items-center px-6 py-3 hover:bg-nexus-blue/10 border border-transparent hover:border-nexus-blue/30 rounded-full transition-all cursor-pointer group"
                                >
                                  <div className="col-span-6">
                                    <p className="font-black text-[14px] text-white group-hover:text-nexus-blue transition-colors">{product.name}</p>
                                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-tight">{product.id}</p>
                                  </div>
                                  <div className="col-span-2 text-center">
                                    <p className="font-bold text-[13px] text-white/60">{product.unit}</p>
                                  </div>
                                  <div className="col-span-4 text-right flex items-center justify-end gap-3">
                                    <p className="font-mono text-[14px] text-white">{formatCurrency(product.price)}</p>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus size={14} className="text-nexus-blue" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-10 text-center text-white/30 uppercase font-black text-[12px] tracking-[0.2em]">
                              ไม่พบรายการพัสดุที่ตรงกับการค้นหา
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. SELECTED QUOTATION ITEMS SECTION */}
                  <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Layers className="text-nexus-teal" size={18} />
                        <h4 className="text-[12px] font-black text-white/80 uppercase tracking-[0.2em]">รายการในใบเสนอราคา (QUOTATION ITEMS)</h4>
                      </div>
                      <PillButton variant="glass" className="h-9 px-6 rounded-full" onClick={addItem}>
                        <Plus size={14} className="mr-2" /> เพิ่มรายการอิสระ
                      </PillButton>
                    </div>

                    <div className="space-y-4">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 text-[10px] font-black text-white/40 uppercase tracking-widest px-6 py-2">
                        <div className="col-span-5">รายละเอียดพัสดุ / งานบริการ</div>
                        <div className="col-span-2 text-center">จำนวน</div>
                        <div className="col-span-3 text-right">ราคาหน่วยละ</div>
                        <div className="col-span-2 text-right">รวมสุทธิ</div>
                      </div>

                      {form.items.map((item) => {
                        const isExpanded = expandedItems.includes(item.id);
                        return (
                          <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] group hover:border-nexus-teal/20 transition-all shadow-xl overflow-hidden">
                            <div 
                              className={cn(
                                "grid grid-cols-12 gap-4 items-center p-5 cursor-pointer transition-colors",
                                isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
                              )}
                              onClick={() => toggleExpand(item.id)}
                            >
                              <div className="col-span-5">
                                <p className="font-black text-[15px] text-white">{item.name}</p>
                              </div>
                              <div className="col-span-2 text-center">
                                <p className="font-mono text-[15px] text-white/80">{item.qty} {item.unit || "ชิ้น"}</p>
                              </div>
                              <div className="col-span-3 text-right">
                                <p className="font-mono text-[15px] text-white/80">{formatCurrency(item.price)}</p>
                              </div>
                              <div className="col-span-2 text-right">
                                <p className="font-black text-nexus-teal mono-numbers text-[16px]">{formatCurrency(item.qty * item.price)}</p>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-6 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-12 gap-6 items-start border-t border-white/5 pt-6">
                                  <div className="col-span-6 space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">รายละเอียดสินค้า/บริการ</label>
                                    <PillInput 
                                      value={item.name}
                                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                                      className="w-full bg-transparent border-white/10 font-black text-[15px] h-9 px-6 rounded-full" 
                                    />
                                  </div>
                                  <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center block">จำนวน</label>
                                    <NumberStepper 
                                      value={item.qty} 
                                      unit={item.unit || "ชิ้น"}
                                      onChange={(val) => updateItem(item.id, "qty", val)}
                                    />
                                  </div>
                                  <div className="col-span-3 space-y-2 text-right">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block">ราคาเสนอขาย (฿)</label>
                                    <NumberStepper 
                                      value={item.price} 
                                      unit="฿"
                                      step={100}
                                      onChange={(val) => updateItem(item.id, "price", val)}
                                    />
                                  </div>
                                  <div className="col-span-1 pt-8 flex justify-end">
                                    <button onClick={() => removeItem(item.id)} className="text-white/20 hover:text-danger transition-colors p-2">
                                      <Trash2 size={20} />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-6">
                                  <div className="flex gap-4">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                                      <TrendingUp size={12} />
                                      ต้นทุนหน่วยละ: <span className="text-white/60 font-mono">{formatCurrency(item.cost || 0)}</span> (รวมต้นทุนทั้งสิ้น {formatCurrency((item.cost || 0) * item.qty)})
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {form.items.length === 0 && (
                        <div className="p-20 text-center border-2 border-dashed border-white/5 rounded-[3rem] text-white/20 uppercase font-black text-[13px] tracking-[0.3em]">
                           Awaiting Strategic Items...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "terms" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <Field label="หมายเหตุและเงื่อนไขท้ายเอกสาร (TERMS & CONDITIONS)">
                    <textarea 
                      className="w-full h-64 rounded-[2rem] bg-white/[0.03] border border-white/10 text-white text-[15px] font-bold p-8 focus:outline-none focus:border-nexus-blue/40 transition-all leading-relaxed shadow-inner"
                      value={form.terms}
                      onChange={(e) => setForm({...form, terms: e.target.value})}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STRATEGIC SIDEBAR (RIGHT) */}
        <div className="w-[380px] flex flex-col bg-[#0F0F12] p-8 flex-shrink-0 shadow-2xl relative z-10 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            {isLocked && (
              <PillButton onClick={() => setIsLocked(false)} className="w-full h-9 px-6 rounded-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30">
                <Edit3 size={18} /> เริ่มการแก้ไขข้อมูล
              </PillButton>
            )}

            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/60 uppercase tracking-[0.2em]">สรุปรายการ</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Target size={16} className="text-nexus-teal" /> ข้อมูลการเงิน
              </h5>
            </div>

            <div className="p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 space-y-8 relative overflow-hidden group shadow-2xl">
              <div className="space-y-5 relative z-10">
                <NexusDataField label="ยอดรวม (Subtotal)" value={formatCurrency(financials.net)} />
                <NexusDataField label="ภาษี (VAT 7%)" value={formatCurrency(financials.vat)} />
                <div className="pt-6 mt-6 border-t border-white/10 flex flex-col items-center">
                  <span className="text-[11px] font-black text-primary uppercase tracking-[0.4em] mb-2 opacity-70">Grand Total</span>
                  <div className="text-3xl font-black text-white font-mono drop-shadow-neon">{formatCurrency(financials.total)}</div>
                </div>
                
                {/* PROFIT RAINBOW */}
                <div className={cn(
                  "p-6 mt-4 rounded-[2rem] border shadow-inner transition-all duration-700 flex flex-col items-center gap-2",
                  rainbow.bg, rainbow.border
                )}>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", rainbow.text)}>{rainbow.label}</span>
                  <div className={cn("text-3xl font-black font-mono", rainbow.text)}>{financials.gpPercent}%</div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-teal/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 text-white/40">
                  <TrendingUp size={14} />
                  <p className="text-[12px] uppercase font-black tracking-widest">ระบบพยากรณ์รายได้ (AI Active)</p>
               </div>
               <PillCheckbox 
                 label="จองพัสดุ (RESERVATION)"
                 checked={form.isDraftProject}
                 onChange={(e) => setForm({...form, isDraftProject: e.target.checked})}
               />
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            {initialData && initialData.status !== "Approved" && onApprove && (
              <PillButton 
                className="w-full h-9 px-6 rounded-full shadow-neon-teal bg-nexus-teal text-white uppercase tracking-[0.2em] flex items-center justify-center gap-2 mb-4" 
                onClick={handleApprove}
                disabled={isSubmitting}
                title="อนุมัติใบเสนอราคาและเปิดใบสั่งขายเพื่อล็อกสต็อกสินค้า"
              >
                <Zap size={18} /> อนุมัติ & ออก SO ⚡
              </PillButton>
            )}
            <PillButton 
              className="w-full h-9 px-6 rounded-full shadow-neon-teal uppercase tracking-[0.2em] flex items-center justify-center gap-2" 
              onClick={handleSave}
              disabled={isSubmitting || isLocked}
              title="ตรวจสอบความถูกต้องและบันทึกเอกสารลงระบบ"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" /> : <ShieldCheck size={20} />}
              บันทึกข้อมูล
            </PillButton>
            <PillButton variant="glass" className="w-full h-9 px-6 rounded-full text-white/60 hover:text-white uppercase tracking-widest" onClick={onClose}>
              ยกเลิก
            </PillButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-black text-white/60 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
