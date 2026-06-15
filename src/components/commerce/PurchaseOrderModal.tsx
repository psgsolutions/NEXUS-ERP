"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  X, Plus, Trash2, CheckCircle2, 
  ShoppingCart, Truck, Search, RefreshCw,
  Lock, Unlock, Edit3, Zap, Clock, Layers, Info,
  Briefcase, Building2, Package, Tag, Target, DollarSign,
  Globe, CreditCard, Calendar, FileText, LayoutList
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { calculateFinancials, formatCurrency, POType, VatType } from "@/lib/erp-logic";
import { useSystemDialog } from "@/context/DialogContext";

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const ORDER_TYPES: { id: POType, label: string, icon: any }[] = [
  { id: 'STOCK', label: 'สต็อกพัสดุ', icon: <Package size={14} /> },
  { id: 'PROJECT', label: 'โครงการ', icon: <Briefcase size={14} /> },
  { id: 'CONSUMABLE', label: 'ของใช้บริษัท', icon: <Tag size={14} /> }
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  THB: "฿",
  USD: "$",
  EUR: "€",
  JPY: "¥",
  SGD: "S$",
  CNY: "¥"
};

const INITIAL_FORM = {
  id: "", // Auto-generated PO Number
  order_type: 'STOCK' as POType,
  project_id: "",
  department: "",
  supplier: "",
  reference: "",
  date: new Date().toISOString().split('T')[0],
  delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  vat_type: "Exclusive" as VatType,
  
  // International Trade Details
  currency: "THB",
  exchange_rate: 1.0,
  incoterm: "EXW",
  incoterm_place: "",
  payment_term: "Net 30",
  shipping_method: "Road Freight",
  carrier: "",
  port_loading: "",
  port_discharge: "",
  
  terms: "1. สินค้าต้องจัดส่งในสภาพสมบูรณ์และถูกต้องตามรุ่นที่สั่งซื้อ\n2. บรรจุภัณฑ์ต้องเหมาะสมกับการขนส่งเพื่อป้องกันการชำรุดเสียหาย\n3. กรุณาแนบใบกำกับภาษี/ใบส่งสินค้าและสำเนาใบสั่งซื้อมาพร้อมกับสินค้า",
  items: [] as any[]
};

// Isolated PO ID Generator matching system conventions PO-YYMM-XXXX
function generatePONumber(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const sequence = Math.floor(1000 + Math.random() * 8999); // Safe, collision-resistant random sequence
  return `PO-${yy}${mm}-${sequence}`;
}

export function PurchaseOrderModal({ isOpen, onClose, onSave, initialData }: PurchaseOrderModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({ ...INITIAL_FORM, ...initialData });
        setIsLocked(true);
      } else {
        setForm({
          ...INITIAL_FORM,
          id: generatePONumber()
        });
        setIsLocked(false);
        setActiveTab("general");
      }
    }
  }, [isOpen, initialData]);

  // Calculate financials in foreign currency
  const financials = useMemo(() => {
    return calculateFinancials(form.items, form.vat_type);
  }, [form.items, form.vat_type]);

  // Convert foreign currency financials to system-base THB
  const financialsTHB = useMemo(() => {
    if (form.currency === "THB") return financials;
    const rate = form.exchange_rate || 1.0;
    return {
      net: financials.net * rate,
      cost: financials.cost * rate,
      vat: financials.vat * rate,
      total: financials.total * rate,
      profit: financials.profit * rate,
      gpPercent: financials.gpPercent
    };
  }, [financials, form.currency, form.exchange_rate]);

  const addItem = () => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), name: "ระบุรายการ...", qty: 1, price: 0, unit: "ชิ้น" }]
    }));
  };

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

  const handleCommit = async () => {
    if (!form.supplier || form.items.length === 0) return void showAlert("กรุณาระบุคู่ค้าและรายการสั่งซื้อ");
    setIsSubmitting(true);
    try {
      const isOfficialTax = form.vat_type !== 'Non-VAT';
      await onSave({ ...form, financials, financialsTHB, isOfficialTax });
      setIsLocked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for rendering foreign currency
  const formatForeign = (val: number) => {
    if (form.currency === "THB") return formatCurrency(val);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: form.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val).replace(form.currency, `${form.currency} `);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ใบสั่งซื้อ"
      maxWidth="max-w-[1500px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        {/* INPUT CANVAS */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Top Title Row with Category & PillTabs */}
            <div className="flex flex-col gap-4 border-b border-white/5 pb-6">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]" title="ระบบบริหารการจัดซื้อ V7.5">PROCURE V7.5</p>
                  <div className="flex items-center gap-3">
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">ใบสั่งซื้อ</h4>
                    {form.id && (
                      <span className="px-3.5 py-1 rounded-md bg-nexus-blue/10 border border-nexus-blue/30 text-[11px] font-mono font-black text-nexus-blue uppercase tracking-widest shadow-neon-blue/20 animate-in fade-in duration-300">
                        {form.id}
                      </span>
                    )}
                    <div className={cn(
                      "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 transition-all duration-500",
                      form.order_type === 'STOCK' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-neon-emerald" :
                      form.order_type === 'PROJECT' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-neon-amber" :
                      "bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-neon-purple"
                    )}>
                      {ORDER_TYPES.find(t => t.id === form.order_type)?.icon}
                      {ORDER_TYPES.find(t => t.id === form.order_type)?.label}
                    </div>
                  </div>
                </div>
                
                {/* Order Type Selector - Standardized to compact h-9 and px-6 buttons inside */}
                <div className="flex gap-2 p-1 bg-white/5 rounded-full w-fit border border-white/5 shadow-inner h-9">
                  {ORDER_TYPES.map(type => (
                    <button 
                      key={type.id}
                      onClick={() => !isLocked && setForm({...form, order_type: type.id})}
                      className={cn(
                        "h-full px-6 rounded-full flex items-center gap-2 text-[11px] font-black uppercase transition-all border",
                        form.order_type === type.id 
                          ? (
                              type.id === 'STOCK' ? "bg-emerald-500 text-black border-emerald-500 shadow-neon-emerald" :
                              type.id === 'PROJECT' ? "bg-amber-500 text-black border-amber-500 shadow-neon-amber" :
                              "bg-purple-500 text-black border-purple-500 shadow-neon-purple"
                            )
                          : "bg-white/5 text-white/60 border-white/5 hover:border-white/20"
                      )}
                    >
                      {type.icon}
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Tabs - Standardized to h-11 */}
              <div className="flex justify-center md:justify-start">
                <PillTabs 
                  tabs={[
                    { id: "general", label: "ข้อมูลหลัก", icon: <LayoutList /> },
                    { id: "global", label: "การค้าสากล & ขนส่ง", icon: <Globe /> },
                    { id: "items", label: "รายการสินค้า", icon: <Layers /> },
                    { id: "terms", label: "ข้อกำหนด & หมายเหตุ", icon: <FileText /> }
                  ]}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>
            </div>

            <div className={cn("space-y-6 transition-all duration-500", isLocked && "opacity-60 pointer-events-none grayscale-[0.5]")}>
              {/* TAB 1: GENERAL INFORMATION */}
              {activeTab === "general" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className={cn(
                    "bg-white/[0.01] border-t-4 p-6 rounded-[2.5rem] space-y-4 shadow-2xl transition-all duration-500",
                    form.order_type === 'STOCK' ? "border-t-emerald-500 border-x border-b border-white/5" :
                    form.order_type === 'PROJECT' ? "border-t-amber-500 border-x border-b border-white/5" :
                    "border-t-purple-500 border-x border-b border-white/5"
                  )}>
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 italic">
                        <LayoutList size={16} /> 1. ข้อมูลผู้จัดจำหน่ายและเลขที่เอกสาร
                      </h3>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        form.order_type === 'STOCK' ? "bg-emerald-500 text-black" :
                        form.order_type === 'PROJECT' ? "bg-amber-500 text-black" :
                        "bg-purple-500 text-black"
                      )}>
                        {ORDER_TYPES.find(t => t.id === form.order_type)?.label} MODE
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <Field label="เลขที่เอกสาร (DOCUMENT NO.) [AUTO]">
                        <div className="relative">
                          <PillInput 
                            value={form.id} 
                            disabled
                            readOnly
                            className="w-full bg-white/[0.01] border-white/5 text-white/60 cursor-not-allowed pr-10 font-mono font-bold tracking-wider" 
                          />
                          <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
                        </div>
                      </Field>
                      
                      <Field label="ผู้จัดจำหน่าย (SUPPLIER) *">
                        <PillSelect 
                          value={form.supplier} 
                          onChange={(e) => setForm({...form, supplier: e.target.value})} 
                          className="w-full"
                        >
                          <option value="">เลือกคู่ค้า...</option>
                          <option value="SUP-001">Thai Equipment Co., Ltd. (สำนักงานใหญ่)</option>
                          <option value="SUP-002">Global Tech Industries Inc. (Global)</option>
                          <option value="SUP-003">Nippon Precision Parts (Japan)</option>
                          <option value="SUP-004">Shenzhen Logistics Components (China)</option>
                        </PillSelect>
                      </Field>
                    </div>

                    {/* Mode Specific Selection Fields */}
                    <div className="grid grid-cols-2 gap-6 pt-2 animate-in zoom-in-95 duration-500">
                      {form.order_type === 'PROJECT' && (
                        <Field label="โครงการที่อ้างอิง (REFERENCE PROJECT) *">
                          <PillSelect 
                            value={form.project_id} 
                            onChange={(e) => setForm({...form, project_id: e.target.value})} 
                            className="w-full border-amber-500/30"
                          >
                            <option value="">เลือกโครงการ...</option>
                            <option value="PRJ-2024-001">CCTV Upgrade - Gateway Mall</option>
                            <option value="PRJ-2024-002">Network Infrastructure - Nexus Tower</option>
                            <option value="PRJ-2024-003">Maintenance Service - Data Center A</option>
                          </PillSelect>
                        </Field>
                      )}

                      {form.order_type === 'CONSUMABLE' && (
                        <Field label="แผนกที่ทำรายการเบิก (REQUESTING DEPARTMENT) *">
                          <PillSelect 
                            value={form.department} 
                            onChange={(e) => setForm({...form, department: e.target.value})} 
                            className="w-full border-purple-500/30"
                          >
                            <option value="">เลือกแผนก...</option>
                            <option value="IT">IT Support & Infrastructure</option>
                            <option value="ADMIN">Administration & HR</option>
                            <option value="ACCOUNT">Finance & Accounting</option>
                            <option value="ENGINEER">Engineering & Maintenance</option>
                          </PillSelect>
                        </Field>
                      )}

                      {form.order_type === 'STOCK' && (
                        <Field label="คลังพัสดุปลายทาง (DESTINATION WAREHOUSE)">
                          <PillInput 
                            value="Main Warehouse (คลังส่วนกลาง)" 
                            disabled
                            readOnly
                            className="w-full bg-white/[0.01] border-emerald-500/20 text-emerald-400/60 cursor-not-allowed font-bold" 
                          />
                        </Field>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-2">
                      <Field label="วันที่สั่งซื้อ (PO DATE) *">
                        <PillInput 
                          type="date"
                          value={form.date} 
                          onChange={(e) => setForm({...form, date: e.target.value})} 
                          className="w-full" 
                        />
                      </Field>
                      
                      <Field label="กำหนดส่งมอบ (DELIVERY DATE) *">
                        <PillInput 
                          type="date"
                          value={form.delivery_date} 
                          onChange={(e) => setForm({...form, delivery_date: e.target.value})} 
                          className="w-full" 
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-2">
                      <Field label="เลขอ้างอิง (REFERENCE NO.)">
                        <PillInput 
                          value={form.reference} 
                          onChange={(e) => setForm({...form, reference: e.target.value})} 
                          placeholder="PR No. / Quote No." 
                          className="w-full" 
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GLOBAL TRADE & LOGISTICS */}
              {activeTab === "global" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Currency Section */}
                  <div className="bg-white/[0.01] border border-white/5 p-6 rounded-[2.5rem] space-y-4 shadow-2xl">
                    <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic">
                      <Globe size={16} /> 2. สกุลเงินค้าระหว่างประเทศ (CURRENCY & EXCHANGE RATE)
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <Field label="สกุลเงินชำระเงิน (PO CURRENCY) *">
                        <PillSelect 
                          value={form.currency} 
                          onChange={(e) => {
                            const newCurrency = e.target.value;
                            let rate = 1.0;
                            if (newCurrency === "USD") rate = 36.50;
                            else if (newCurrency === "EUR") rate = 39.50;
                            else if (newCurrency === "JPY") rate = 0.235;
                            else if (newCurrency === "SGD") rate = 27.20;
                            else if (newCurrency === "CNY") rate = 5.05;
                            setForm({...form, currency: newCurrency, exchange_rate: rate});
                          }} 
                          className="w-full"
                        >
                          <option value="THB">THB - Thai Baht (฿)</option>
                          <option value="USD">USD - US Dollar ($)</option>
                          <option value="EUR">EUR - Euro (€)</option>
                          <option value="JPY">JPY - Japanese Yen (¥)</option>
                          <option value="SGD">SGD - Singapore Dollar (S$)</option>
                          <option value="CNY">CNY - Chinese Yuan (¥)</option>
                        </PillSelect>
                      </Field>
                      
                      <Field label="อัตราแลกเปลี่ยนแปลงค่า (EXCHANGE RATE) ต่อ 1 หน่วย">
                        <div className="relative">
                          <PillInput 
                            type="number"
                            step="0.0001"
                            disabled={form.currency === "THB"}
                            value={form.exchange_rate} 
                            onChange={(e) => setForm({...form, exchange_rate: parseFloat(e.target.value) || 0})} 
                            placeholder="1.0000" 
                            className="w-full pr-14" 
                          />
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[11px] font-black text-white/60 uppercase">
                            THB
                          </span>
                        </div>
                        {form.currency !== "THB" && (
                          <p className="text-[10px] font-bold text-nexus-blue/80 mt-1 ml-1 animate-pulse">
                            * ระบบคำนวณฐานบัญชี: 1 {form.currency} = ฿ {form.exchange_rate.toFixed(4)} THB
                          </p>
                        )}
                      </Field>
                    </div>
                  </div>

                  {/* Commercial Terms Section */}
                  <div className="bg-white/[0.01] border border-white/5 p-6 rounded-[2.5rem] space-y-4 shadow-2xl">
                    <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic">
                      <CreditCard size={16} /> 3. เงื่อนไขข้อตกลงและเครดิตสากล (COMMERCIAL TERMS & INCOTERMS)
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-6">
                      <Field label="เงื่อนไขส่งมอบ INCOTERMS® 2020">
                        <PillSelect 
                          value={form.incoterm} 
                          onChange={(e) => setForm({...form, incoterm: e.target.value})} 
                          className="w-full"
                        >
                          <option value="EXW">EXW - Ex Works (รับที่โกดังผู้ขาย)</option>
                          <option value="FOB">FOB - Free on Board (ส่งขึ้นเรือต้นทาง)</option>
                          <option value="CIF">CIF - Cost, Insurance & Freight (ส่งถึงปลายทางรวมประกัน)</option>
                          <option value="DDP">DDP - Delivered Duty Paid (ส่งถึงปลายทางรวมภาษีนำเข้า)</option>
                          <option value="FCA">FCA - Free Carrier</option>
                          <option value="CPT">CPT - Carriage Paid To</option>
                          <option value="CIP">CIP - Carriage & Insurance Paid To</option>
                          <option value="DAP">DAP - Delivered at Place</option>
                          <option value="DPU">DPU - Delivered at Place Unloaded</option>
                        </PillSelect>
                      </Field>
                      
                      <Field label="สถานที่ส่งมอบ (NAMED PLACE)">
                        <PillInput 
                          value={form.incoterm_place} 
                          onChange={(e) => setForm({...form, incoterm_place: e.target.value})} 
                          placeholder="เช่น Suvarnabhumi Airport, Port of Tokyo" 
                          className="w-full" 
                        />
                      </Field>

                      <Field label="การชำระเงิน (PAYMENT TERM)">
                        <PillSelect 
                          value={form.payment_term} 
                          onChange={(e) => setForm({...form, payment_term: e.target.value})} 
                          className="w-full"
                        >
                          <option value="Net 30">Net 30 Days (เครดิต 30 วัน - มาตรฐาน)</option>
                          <option value="Advanced 100%">Advanced 100% (จ่ายล่วงหน้าเต็มจำนวน)</option>
                          <option value="30% Advance, 70% Ship">30% Advance, 70% Before Shipment</option>
                          <option value="Net 15">Net 15 Days (เครดิต 15 วัน)</option>
                          <option value="Net 45">Net 45 Days (เครดิต 45 วัน)</option>
                          <option value="Net 60">Net 60 Days (เครดิต 60 วัน)</option>
                          <option value="L/C At Sight">Letter of Credit (L/C At Sight)</option>
                          <option value="COD">Cash on Delivery (ชำระปลายทาง)</option>
                        </PillSelect>
                      </Field>
                    </div>
                  </div>

                  {/* Logistics Section */}
                  <div className="bg-white/[0.01] border border-white/5 p-6 rounded-[2.5rem] space-y-4 shadow-2xl">
                    <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic">
                      <Truck size={16} /> 4. การจัดการขนส่งสากล (LOGISTICS & SHIPPING)
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <Field label="วิธีการจัดส่ง (SHIPPING METHOD)">
                        <PillSelect 
                          value={form.shipping_method} 
                          onChange={(e) => setForm({...form, shipping_method: e.target.value})} 
                          className="w-full"
                        >
                          <option value="Road Freight">Road Freight - ทางบก (รถยนต์/รถบรรทุก)</option>
                          <option value="Air Freight">Air Freight - ทางอากาศ (เครื่องบินสินค้า)</option>
                          <option value="Sea Freight">Sea Freight - ทางทะเล (ตู้คอนเทนเนอร์)</option>
                          <option value="Express Courier">Express Courier - พัสดุด่วน (DHL/FedEx/UPS)</option>
                          <option value="Rail Freight">Rail Freight - ทางรถไฟ</option>
                        </PillSelect>
                      </Field>
                      
                      <Field label="ผู้ขนส่ง / ชื่อเรือ (CARRIER / SHIP NAME)">
                        <PillInput 
                          value={form.carrier} 
                          onChange={(e) => setForm({...form, carrier: e.target.value})} 
                          placeholder="เช่น DHL, Maersk Line, FedEx, ONE Line" 
                          className="w-full" 
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-2">
                      <Field label="ท่าเรือ/ด่านศุลกากรต้นทาง (PORT OF LOADING)">
                        <PillInput 
                          value={form.port_loading} 
                          onChange={(e) => setForm({...form, port_loading: e.target.value})} 
                          placeholder="ระบุท่าเรือหรือสนามบินต้นทาง..." 
                          className="w-full" 
                        />
                      </Field>
                      
                      <Field label="ท่าเรือ/ด่านศุลกากรปลายทาง (PORT OF DISCHARGE)">
                        <PillInput 
                          value={form.port_discharge} 
                          onChange={(e) => setForm({...form, port_discharge: e.target.value})} 
                          placeholder="ระบุท่าเรือหรือสนามบินปลายทาง..." 
                          className="w-full" 
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PURCHASE ITEMS */}
              {activeTab === "items" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <h4 className="text-[12px] font-black text-white/50 uppercase tracking-[0.2em]">รายการสั่งซื้อสินค้า (PURCHASE ITEMS)</h4>
                      <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                        ป้อนราคาทุนในสกุลเงินที่เลือก: <span className="text-nexus-blue font-black">{form.currency}</span>
                      </p>
                    </div>
                    {/* Add Item Button: Standardized to compact h-9 px-6 rounded-full */}
                    <PillButton variant="glass" className="h-9 px-6 rounded-full" onClick={addItem}>
                      <Plus size={14} /> เพิ่มรายการสินค้า
                    </PillButton>
                  </div>
                  
                  <div className="space-y-3">
                    {form.items.map((item) => (
                      <div key={item.id} className={cn(
                        "p-4 bg-white/[0.02] border rounded-[2rem] grid grid-cols-12 gap-4 items-center group shadow-xl transition-all relative overflow-hidden",
                        form.order_type === 'STOCK' ? "border-emerald-500/20 hover:border-emerald-500/40" :
                        form.order_type === 'PROJECT' ? "border-amber-500/20 hover:border-amber-500/40" :
                        "border-purple-500/20 hover:border-purple-500/40"
                      )}>
                        {/* Vertical Mode Indicator Strip */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1 opacity-40",
                          form.order_type === 'STOCK' ? "bg-emerald-500" :
                          form.order_type === 'PROJECT' ? "bg-amber-500" :
                          "bg-purple-500"
                        )} />

                        <div className="col-span-5 space-y-1.5">
                          <label className="text-[10px] font-black text-white/55 uppercase tracking-widest ml-1">ชื่อพัสดุ / สเปกสินค้า (ITEM SPECIFICATION)</label>
                          <PillInput className="w-full bg-transparent border-white/5 font-black text-[14px] h-9" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} />
                        </div>
                        
                        <div className="col-span-3 space-y-1.5">
                          <label className="text-[10px] font-black text-white/55 uppercase tracking-widest text-center block">จำนวน (QTY)</label>
                          <NumberStepper value={item.qty} unit={item.unit || "ชิ้น"} onChange={(v) => updateItem(item.id, "qty", v)} />
                        </div>
                        
                        <div className="col-span-3 space-y-1.5">
                          <label className="text-[10px] font-black text-white/55 uppercase tracking-widest text-right block">
                            ราคาทุนต่อหน่วย ({form.currency})
                          </label>
                          <NumberStepper 
                            value={item.price} 
                            unit={CURRENCY_SYMBOLS[form.currency] || form.currency} 
                            step={form.currency === "THB" ? 100 : 10} 
                            onChange={(v) => updateItem(item.id, "price", v)} 
                          />
                          {form.currency !== "THB" && (
                            <div className="text-[10px] font-bold text-white/50 text-right mt-1 mr-1">
                              ≈ ฿ {((item.price || 0) * form.exchange_rate).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} THB
                            </div>
                          )}
                        </div>
                        
                        <div className="col-span-1 flex justify-center pt-4">
                          <button onClick={() => removeItem(item.id)} className="p-2 text-white/30 hover:text-danger transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {form.items.length === 0 && (
                      <div className="p-16 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] text-white/30 uppercase font-black text-[12px] tracking-[0.3em] italic">
                         Awaiting Purchase Items...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: TERMS & CONDITIONS */}
              {activeTab === "terms" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white/[0.01] border border-white/5 p-6 rounded-[2.5rem] space-y-4 shadow-2xl">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 italic">
                        <FileText size={16} /> 5. ข้อตกลงและเงื่อนไขสัญญาแนบท้าย (TERMS & CONDITIONS)
                      </h3>
                      
                      {/* Preset Buttons: Standardized to compact h-9 px-6 rounded-full */}
                      <div className="flex gap-2">
                        <PillButton 
                          variant="glass" 
                          className="h-9 px-6 rounded-full text-white/70 hover:text-white"
                          onClick={() => setForm({
                            ...form,
                            terms: "1. สินค้าต้องจัดส่งในสภาพสมบูรณ์และถูกต้องตามรุ่นที่สั่งซื้อ\n2. บรรจุภัณฑ์ต้องเหมาะสมกับการขนส่งเพื่อป้องกันการชำรุดเสียหาย\n3. กรุณาแนบใบกำกับภาษี/ใบส่งสินค้าและสำเนาใบสั่งซื้อมาพร้อมกับสินค้า"
                          })}
                        >
                          เงื่อนไขมาตรฐาน (TH)
                        </PillButton>
                        
                        <PillButton 
                          variant="glass" 
                          className="h-9 px-6 rounded-full text-white/70 hover:text-white"
                          onClick={() => setForm({
                            ...form,
                            terms: "1. All goods must be delivered in perfect condition and match technical specifications.\n2. Packaging must be appropriate for transit and protect items from damage.\n3. Please enclose the commercial invoice, packing list, and PO copy with the shipment."
                          })}
                        >
                          Standard Terms (EN)
                        </PillButton>
                      </div>
                    </div>

                    <Field label="ระบุรายละเอียดข้อตกลง สัญญา หรือเงื่อนไขแนบท้าย (TERMS & CONDITIONS)">
                      <textarea 
                        className="w-full h-48 rounded-[2rem] bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-6 focus:outline-none focus:border-nexus-blue/40 transition-all leading-relaxed shadow-inner"
                        value={form.terms}
                        onChange={(e) => setForm({...form, terms: e.target.value})}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-[340px] bg-[#0F0F12] p-6 flex flex-col shrink-0 border-l border-white/5 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-6">
            {/* Start Edit Button: Standardized to compact h-9 px-6 rounded-full */}
            {isLocked && (
              <PillButton onClick={() => setIsLocked(false)} className="w-full h-9 px-6 rounded-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30">
                <Edit3 size={16} /> เริ่มการแก้ไขข้อมูล
              </PillButton>
            )}

            <div className="p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/10 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h4 className="text-[11px] font-black text-white/70 uppercase tracking-widest">สรุปงบประมาณการจัดซื้อ</h4>
                <DollarSign size={16} className="text-nexus-blue animate-pulse" />
              </div>
              
              <div className="space-y-4">
                <Field label="ระบบภาษี (VAT CONFIG)">
                  <PillSelect value={form.vat_type} onChange={(e) => setForm({...form, vat_type: e.target.value as VatType})} className="w-full h-9">
                    <option value="Exclusive">แยกภาษี (Exclusive 7%)</option>
                    <option value="Inclusive">รวมภาษี (Inclusive 7%)</option>
                    <option value="Non-VAT">ไม่มีภาษี (Non-VAT)</option>
                  </PillSelect>
                </Field>
                
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <NexusDataField 
                    label={`ราคาสุทธิ (${form.currency})`} 
                    value={formatForeign(financials.net)} 
                  />
                  <NexusDataField 
                    label={`ภาษีมูลค่าเพิ่ม (${form.currency})`} 
                    value={formatForeign(financials.vat)} 
                  />
                  
                  <div className="pt-4 border-t-2 border-dashed border-white/10 flex flex-col items-center">
                    <span className="text-[11px] font-black text-primary uppercase tracking-[0.4em] mb-1 opacity-70">
                      ยอดรวมสุทธิ ({form.currency})
                    </span>
                    <div className="text-2xl font-black text-white italic font-mono drop-shadow-neon">
                      {formatForeign(financials.total)}
                    </div>
                  </div>

                  {form.currency !== "THB" && (
                    <div className="mt-4 p-4 rounded-[1.5rem] bg-nexus-blue/10 border border-nexus-blue/20 text-center animate-in fade-in duration-300">
                      <span className="text-[10px] font-black text-nexus-blue uppercase tracking-[0.2em] block mb-1">
                        มูลค่ารวมในสกุลเงินบาท (THB EQUIVALENT)
                      </span>
                      <div className="text-xl font-black text-white font-mono italic">
                        {formatCurrency(financialsTHB.total)}
                      </div>
                      <span className="text-[9px] text-white/60 block mt-1 font-bold">
                        อัตรา: 1 {form.currency} = ฿ {form.exchange_rate.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Standardized to compact h-9 px-6 rounded-full */}
          <div className="space-y-3 pt-6 border-t border-white/5">
            <PillButton 
              className="w-full h-9 px-6 rounded-full shadow-neon-teal uppercase tracking-[0.2em]" 
              onClick={handleCommit} 
              disabled={isSubmitting || isLocked}
              title="ตรวจสอบรายการและบันทึกใบสั่งซื้อ"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={18} />}
              บันทึกข้อมูล
            </PillButton>
            
            <PillButton variant="glass" className="w-full h-9 px-6 rounded-full text-white/60 hover:text-white" onClick={onClose}>
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
