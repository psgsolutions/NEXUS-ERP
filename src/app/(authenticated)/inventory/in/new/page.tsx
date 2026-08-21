"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Package, 
  ShieldCheck, 
  Truck,
  ArrowLeft,
  MapPin,
  FileText,
  Search
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  PillTabs, 
  NexusDataField,
  GlassCard,
  cn,
  NexusDatePicker
} from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewInventoryInPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("manual");
  const [items, setItems] = useState<any[]>([]);
  const [header, setHeader] = useState({
    supplierId: "",
    poRef: "",
    warehouseId: "WH-01",
    date: new Date().toISOString().split('T')[0],
    reference: "",
    note: ""
  });

  const handleBack = async () => {
    const isDirty = items.length > 0 || header.supplierId !== "" || header.poRef !== "";
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการสินค้าที่ต้องการรับเข้า");
    // Simulate API Call
    showAlert("บันทึกรับสินค้าเข้าคลังเรียบร้อยแล้ว");
    router.push("/inventory");
  };

  const fetchPOItems = () => {
    if (!header.poRef) return void showAlert("กรุณาระบุเลขที่ใบสั่งซื้อ");
    // Mock PO Data
    setItems([
      { id: "ITEM-001", productId: "PROD-004", name: "กล้องวงจรปิด AI", qty: 10, unit: "ตัว", price: 5000, cost: 2500 },
      { id: "ITEM-002", productId: "PROD-005", name: "เครื่องสแกนลายนิ้วมือ", qty: 5, unit: "เครื่อง", price: 3000, cost: 1500 }
    ]);
    setHeader(prev => ({ ...prev, supplierId: "SUP-001" }));
  };

  const totalCost = items.reduce((acc, i) => acc + ((i.qty || 0) * (i.cost || 0)), 0);

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">INVENTORY OPS V7.5</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">รับสินค้าเข้าคลัง (Goods Receipt)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Received"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillTabs 
          tabs={[
            { id: "manual", label: "รับเข้าด้วยตนเอง", icon: <Package size={14} /> },
            { id: "po", label: "รับจากใบสั่งซื้อ (PO)", icon: <FileText size={14} /> }
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === "po") {
              setItems([]);
              setHeader(prev => ({ ...prev, poRef: "" }));
            }
          }}
        />
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton className="h-9 px-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-2" /> บันทึกรับเข้าคลัง
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 min-h-[60vh] border-white/5 bg-black/20">
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Field label="วันที่ทำรายการ (Date) *">
              <NexusDatePicker value={header.date} 
                onChange={(e) => setHeader({...header, date: e.target.value})} 
                className="w-full h-9 rounded-full px-6" 
              />
            </Field>
            <Field label="คลังสินค้า (Warehouse)">
              <PillSelect 
                value={header.warehouseId} 
                onChange={(e) => setHeader({...header, warehouseId: e.target.value})} 
                className="w-full text-cyan-400 border-cyan-500/30 font-bold h-9 rounded-full px-6"
              >
                <option value="WH-01">WH-01 : Main Warehouse (สำนักงานใหญ่)</option>
                <option value="WH-02">WH-02 : Branch 1 (สาขา 1)</option>
                <option value="WH-03">WH-03 : Project Store (หน่วยงานโครงการ)</option>
              </PillSelect>
            </Field>
          </div>

          {activeTab === "po" ? (
            <div className="grid grid-cols-2 gap-6">
              <Field label="อ้างอิงใบสั่งซื้อ (PO Reference) *">
                <div className="flex gap-2">
                  <PillInput 
                    value={header.poRef} 
                    onChange={(e) => setHeader({...header, poRef: e.target.value})} 
                    placeholder="เช่น PO-2604-0012" 
                    className="w-full text-amber-400 border-amber-500/30 h-9 rounded-full px-6 font-mono text-[13px]" 
                  />
                  <PillButton onClick={fetchPOItems} className="shrink-0 bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black h-9 rounded-full px-6">
                    <Search size={16} className="mr-2" /> ดึงข้อมูล
                  </PillButton>
                </div>
              </Field>
              <Field label="ผู้จัดจำหน่าย (Supplier)">
                <PillSelect 
                  value={header.supplierId} 
                  onChange={(e) => setHeader({...header, supplierId: e.target.value})} 
                  className="w-full h-9 rounded-full px-6 opacity-60"
                  disabled={true}
                >
                  <option value="">-- อ้างอิงจาก PO --</option>
                  <option value="SUP-001">Thai Equipment Co., Ltd.</option>
                </PillSelect>
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <Field label="ผู้จัดจำหน่าย (Supplier) *">
                <PillSelect 
                  value={header.supplierId} 
                  onChange={(e) => setHeader({...header, supplierId: e.target.value})} 
                  className="w-full h-9 rounded-full px-6"
                >
                  <option value="">เลือกคู่ค้า...</option>
                  <option value="SUP-001">Thai Equipment Co., Ltd.</option>
                  <option value="SUP-002">Global Tech Industries Inc.</option>
                </PillSelect>
              </Field>
              <Field label="เอกสารอ้างอิง (Ref. No.)">
                <PillInput 
                  value={header.reference} 
                  onChange={(e) => setHeader({...header, reference: e.target.value})} 
                  placeholder="เช่น INV-0012" 
                  className="w-full h-9 rounded-full px-6 font-mono text-[13px]" 
                />
              </Field>
            </div>
          )}
        </div>

        <div className="space-y-6 pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Truck size={16} className="text-white/40" />
            <h4 className="text-[13px] font-black text-white/60 uppercase tracking-widest">รายการสินค้า (Items)</h4>
          </div>
          <DocumentItemsTable 
            items={items}
            onChange={setItems}
          />
        </div>

        <div className="space-y-6 pt-6 border-t border-white/5">
          <Field label="หมายเหตุ (Remarks)">
            <textarea 
              className="w-full h-24 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-[14px] p-4 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar"
              value={header.note}
              onChange={(e) => setHeader({...header, note: e.target.value})}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)..."
            />
          </Field>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปการรับเข้า</p>
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">Receipt Summary</h5>
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-black uppercase tracking-widest">จำนวนรายการ</span>
          <span className="text-[14px] font-mono font-bold text-white">{items.length} รายการ</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-black uppercase tracking-widest">จำนวนชิ้นรวม</span>
          <span className="text-[14px] font-mono font-bold text-white">{items.reduce((acc, i) => acc + (i.qty || 0), 0)} ชิ้น</span>
        </div>
        <div className="flex justify-between items-end pt-2">
          <span className="text-[12px] text-white/80 font-black uppercase tracking-widest">มูลค่าต้นทุนรวม</span>
          <span className="text-xl font-mono font-black text-emerald-400 drop-shadow-neon text-right">{formatCurrency(totalCost)}</span>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
        <PillButton className="w-full h-11 rounded-full font-black uppercase tracking-[0.2em] shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-[12px]" onClick={handleSave}>
          <ShieldCheck size={18} className="mr-2" />
          บันทึกรับเข้าคลัง
        </PillButton>
      </div>
      
      {/* Background glow */}
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
    </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
        <span className="flex items-center">
          {thaiText}
          {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        </span>
        {engText && <span className="text-white/40 font-normal uppercase tracking-widest text-[10px]">{engText}</span>}
      </label>
      {children}
    </div>
  );
}

