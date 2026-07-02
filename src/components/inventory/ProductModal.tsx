"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, 
  Layers, 
  TrendingUp, 
  DollarSign, 
  Zap, 
  Trash2, 
  ShieldCheck, 
  Edit3, 
  RefreshCw,
  Box,
  Target,
  BarChart3,
  Info
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
import { formatCurrency } from "@/lib/erp-logic";
import { useSystemDialog } from "@/context/DialogContext";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const INITIAL_FORM = {
  sku: "",
  name: "",
  category: "ทั่วไป",
  unit: "ชิ้น",
  price_retail: 0,
  price_project: 0,
  cost_avg: 0,
  qty_on_hand: 0,
  qty_min: 0,
  description: "",
  supplier_id: ""
};

const CATEGORIES = ["ทั่วไป", "วัสดุสิ้นเปลือง", "เครื่องมือแพทย์", "อิเล็กทรอนิกส์", "อะไหล่"];

export function ProductModal({ isOpen, onClose, onSave, initialData }: ProductModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({ ...INITIAL_FORM, ...initialData });
        setIsLocked(true);
      } else {
        setForm(INITIAL_FORM);
        setIsLocked(false);
      }
      setActiveTab("info");
    }
  }, [isOpen, initialData]);

  const tabs = [
    { id: "info", label: "ข้อมูลพื้นฐาน", icon: <Info size={14} /> },
    { id: "pricing", label: "ต้นทุนและราคา", icon: <DollarSign size={14} /> },
    { id: "stock", label: "การควบคุมสต็อก", icon: <Box size={14} /> }
  ];

  const handleCommit = async () => {
    if (!form.sku || !form.name) return void showAlert("กรุณาระบุรหัส SKU และชื่อพัสดุ");
    setIsSubmitting(true);
    try {
      await onSave(form);
      setIsLocked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const margin = useMemo(() => {
    const profit = form.price_project - form.cost_avg;
    return form.price_project > 0 ? Math.round((profit / form.price_project) * 100) : 0;
  }, [form.price_project, form.cost_avg]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="สินค้า / พัสดุ"
      maxWidth="max-w-[1300px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        {/* INPUT CANVAS */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]" title="ระบบบริหารคลังพัสดุ V2.9">STOCK V2.9</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">สินค้า</h4>
              </div>
              <PillTabs 
                tabs={[
                  { id: "info", label: "ข้อมูลหลัก", icon: <Info size={14} /> },
                  { id: "pricing", label: "ต้นทุน/ราคา", icon: <DollarSign size={14} /> },
                  { id: "stock", label: "สต็อก", icon: <Box size={14} /> }
                ]} 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
              />
            </div>

            <div className={cn("space-y-10 transition-all duration-500", isLocked && "opacity-60 pointer-events-none grayscale-[0.5]")}>
              {activeTab === "info" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                  <section className="space-y-6">
                    <h3 className="text-[12px] font-black text-nexus-blue uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><Zap size={16} /> 1. อัตลักษณ์พัสดุ</h3>
                    <div className="flex gap-10">
                      {/* VISUAL ASSET PREVIEW */}
                      <div className="w-64 h-64 bg-white/[0.03] border border-white/5 rounded-[3rem] flex flex-col items-center justify-center gap-4 relative overflow-hidden group">
                        <Package size={64} className="text-white/10 group-hover:text-nexus-teal transition-all duration-700" />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Visual Asset</span>
                        <div className="absolute inset-0 bg-nexus-teal/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <div className="flex-1 space-y-8">
                        <Field label="รหัสสินค้า *">
                          <PillInput value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} placeholder="ระบุรหัส SKU..." className="w-full font-mono font-black" />
                        </Field>
                        <Field label="ชื่อพัสดุ / บริการ *">
                          <PillInput value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="ชื่อที่แสดงในเอกสาร..." className="w-full" />
                        </Field>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <Field label="หมวดหมู่สินค้า">
                        <PillSelect value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </PillSelect>
                      </Field>
                      <Field label="หน่วยนับ">
                        <PillInput value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} placeholder="เช่น ชิ้น, กล่อง, ชุด" className="w-full" />
                      </Field>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "pricing" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                  <section className="space-y-6">
                    <h3 className="text-[12px] font-black text-warning uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><DollarSign size={16} /> โครงสร้างราคาและต้นทุน</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/[0.02] p-8 rounded-[2rem] border border-white/5">
                      <Field label="ราคาเสนอโครงการ">
                        <NumberStepper value={form.price_project} onChange={(v) => setForm({...form, price_project: v})} unit="฿" step={100} />
                      </Field>
                      <Field label="ราคาขายปลีก">
                        <NumberStepper value={form.price_retail} onChange={(v) => setForm({...form, price_retail: v})} unit="฿" step={100} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Field label="ต้นทุนเฉลี่ย">
                        <NumberStepper value={form.cost_avg} onChange={(v) => setForm({...form, cost_avg: v})} unit="฿" step={100} />
                      </Field>
                      <div className="flex flex-col justify-end p-6 bg-nexus-teal/5 border border-nexus-teal/10 rounded-[2rem] items-center gap-2">
                        <span className="text-[10px] font-black text-nexus-teal uppercase tracking-widest">Project Margin</span>
                        <div className="text-2xl font-black text-nexus-teal font-mono">{margin}%</div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "stock" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                  <section className="space-y-6">
                    <h3 className="text-[12px] font-black text-nexus-teal uppercase flex items-center gap-2 border-b border-white/5 pb-2 italic"><Box size={16} /> การควบคุมระดับพัสดุ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Field label="ระดับสต็อกปัจจุบัน">
                        <NumberStepper value={form.qty_on_hand} onChange={(v) => setForm({...form, qty_on_hand: v})} unit={form.unit} />
                      </Field>
                      <Field label="ระดับแจ้งเตือนขั้นต่ำ">
                        <NumberStepper value={form.qty_min} onChange={(v) => setForm({...form, qty_min: v})} unit={form.unit} />
                      </Field>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-[350px] bg-[#0F0F12] p-8 flex flex-col shrink-0 border-l border-white/5 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            {isLocked && (
              <PillButton onClick={() => setIsLocked(false)} className="w-full shadow-neon-blue bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/30">
                <Edit3 size={18} /> เริ่มการแก้ไขข้อมูล
              </PillButton>
            )}

            <div className="p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 space-y-8 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h4 className="text-[11px] font-black text-white/40 uppercase tracking-widest">สถานะทรัพยากร</h4>
                <BarChart3 size={18} className="text-nexus-blue" />
              </div>
              <div className="space-y-6">
                <NexusDataField label="รหัส SKU" value={form.sku || "PENDING"} />
                <NexusDataField label="มูลค่าคงคลังรวม" value={formatCurrency(form.qty_on_hand * form.cost_avg)} />
                <div className="pt-6 border-t border-white/10 flex flex-col items-center">
                   <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2">Inventory Status</span>
                   <div className={cn(
                     "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest",
                     form.qty_on_hand > form.qty_min ? "bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20" : "bg-danger/10 text-danger border border-danger/20"
                   )}>
                     {form.qty_on_hand > form.qty_min ? "IN STOCK" : "LOW STOCK"}
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-white/5">
            <PillButton 
              className="w-full shadow-neon-teal uppercase tracking-[0.2em]" 
              onClick={handleCommit} 
              disabled={isSubmitting || isLocked}
              title="บันทึกข้อมูลสินค้าลงในฐานข้อมูล"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" /> : <ShieldCheck size={20} />}
              บันทึกข้อมูล
            </PillButton>
            <PillButton variant="ghost" className="w-full" onClick={onClose}>
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
      <label className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
