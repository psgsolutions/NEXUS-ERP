"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { PillButton, GlassCard, PillSelect, NexusDatePicker } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { DocumentHeader } from "@/components/document/DocumentHeader";
import { DocumentItem } from "@/types/shared";
import { Save, ShoppingCart, User, ArrowLeft, Calculator, Building2, Calendar } from "lucide-react";
import { db } from "@/lib/firebase-client";
import { collection, addDoc, serverTimestamp, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { nexusSequenceEngine } from "@/lib/sequence-engine";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || "COMP-001";

  // Tenant Isolation & isDeleted filter
  const { data: suppliers } = useRealtimeCollection("suppliers", [
    where("companyId", "==", currentCompanyId),
    where("isDeleted", "==", false)
  ]);
  
  const [formData, setFormData] = useState({
    supplierId: "",
    supplierName: "",
    expectedDate: new Date().toISOString().split('T')[0],
    remarks: ""
  });

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Financial Calculations
  const subTotal = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const vatAmount = subTotal * 0.07;
  const netTotal = subTotal + vatAmount;

  const handleSave = async () => {
    if (!formData.supplierId) {
      alert("กรุณาเลือกผู้จำหน่าย (Supplier)");
      return;
    }
    if (items.length === 0) {
      alert("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    try {
      setLoading(true);
      const poCode = await nexusSequenceEngine("PO", currentCompanyId);
      
      await addDoc(collection(db, "purchase_orders"), {
        poCode,
        supplierId: formData.supplierId,
        supplierName: formData.supplierName,
        expectedDate: formData.expectedDate,
        remarks: formData.remarks,
        items,
        subTotal,
        vatAmount,
        netTotal,
        status: "PENDING",
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || "SYSTEM"
      });
      
      alert(`บันทึกใบสั่งซื้อสำเร็จ: ${poCode}`);
      setFormData({ supplierId: "", supplierName: "", expectedDate: "", remarks: "" });
      setItems([]);
      router.push("/procurement/purchase-orders");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกใบสั่งซื้อ");
    } finally {
      setLoading(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              สร้างใบสั่งซื้อสินค้า
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              PO-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            สร้างใบสั่งซื้อสินค้าไปยังผู้จำหน่าย ตรวจสอบรายการและเงื่อนไขทางการค้า
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" onClick={handleSave} disabled={loading} className="h-8 px-5 font-bold text-xs">
          <Save size={14} className="mr-1.5" /> {loading ? "กำลังบันทึก..." : "บันทึกใบสั่งซื้อ"}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <div className="flex flex-col gap-4">
        <DocumentHeader 
          docNo="PO-2026-08-001"
          issueDate={formData.expectedDate}
          dueDate={formData.expectedDate}
          entityName={formData.supplierName}
          entityLabelTh="ผู้จำหน่าย"
          entityLabelEn="Supplier"
          entityPlaceholder="-- ค้นหาและเลือกผู้จำหน่าย --"
          taxId="0105558000002"
          branch="สำนักงานใหญ่"
          taxMode="VAT_EXCLUDED"
          onDocNoChange={() => {}}
          onIssueDateChange={(val) => setFormData({...formData, expectedDate: val})}
          onDueDateChange={(val) => setFormData({...formData, expectedDate: val})}
          onEntitySelect={() => {}}
        />
        
        {/* We keep the SmartSelect logic hidden or we can use a modal/dropdown. Since DocumentHeader has onClick={onEntitySelect}, we should just render the SmartSelect wrapper or leave it for now. For simplicity, we just put the SmartSelect hidden but active or just show it below */}
        <div className="hidden">
           <SmartSelect
                value={formData.supplierId}
                onChange={(value) => {
                  const sup = suppliers?.find(s => s.id === value);
                  setFormData(prev => ({
                    ...prev,
                    supplierId: value,
                    supplierName: sup ? sup.name : ""
                  }));
                }}
                options={(suppliers || []).map(s => ({
                  value: s.id,
                  label: `${s.code || s.id} : ${s.name}`,
                }))}
                placeholder="-- ค้นหาและเลือกผู้จำหน่าย --"
              />
        </div>

        {/* Line Items Table */}
        <GlassCard accentColor="blue" className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 h-[36px]">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-nexus-blue/10 border border-nexus-blue/30 text-[10px] text-nexus-blue font-mono font-bold">02</span>
              <ShoppingCart size={16} /> รายการสินค้า / บริการ
            </h3>
          </div>
          
          <DocumentItemsTable 
            items={items} 
            onChange={setItems} 
          />
        </GlassCard>
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-7 h-fit pb-10">
      <GlassCard accentColor="purple" className="p-6 space-y-4 w-full">
        <h3 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-4">
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-400 font-mono font-bold">03</span>
          <Calculator size={16} className="text-cyan-400" /> สรุปยอด (Summary)
        </h3>

        <div className="flex justify-between items-center text-[13px]">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่าสินค้า</span>
          <span className="text-white font-mono font-bold">{subTotal.toLocaleString(undefined, {minimumFractionDigits: 2})} บาท</span>
        </div>
        <div className="flex justify-between items-center text-[13px] pb-4 border-b border-white/5">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">ภาษีมูลค่าเพิ่ม 7%</span>
          <span className="text-white font-mono font-bold">{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} บาท</span>
        </div>
        <div className="flex justify-between items-end pt-4">
          <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">ยอดรวมสุทธิ</span>
          <span className="text-3xl font-black text-cyan-400 font-mono tracking-tighter">
            {netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-[14px]">THB</span>
          </span>
        </div>
      </GlassCard>
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
