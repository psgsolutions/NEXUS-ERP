"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { PillButton, GlassCard, PillSelect, NexusDatePicker } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-0.5">Procurement / Purchase Order</p>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">สร้างใบสั่งซื้อ (Purchase Order)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Approved", "Received"]} currentStep={0} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PillButton variant="glass" className="h-9 px-6 rounded-full text-[12px] uppercase tracking-widest text-white/50 hover:text-white" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton onClick={handleSave} disabled={loading} className="h-9 px-6 rounded-full bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)] text-[12px] font-black uppercase tracking-widest">
          <Save size={14} className="mr-2" /> {loading ? "กำลังบันทึก..." : "บันทึกใบสั่งซื้อ"}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4 pr-2 pb-10">
      <div className="flex flex-col gap-4">
        {/* Supplier Column */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
            <Building2 size={16} /> ข้อมูลผู้จำหน่าย
          </h3>
          
          <div className="space-y-4">
            <Field label="ผู้จำหน่าย (Supplier) *">
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
            </Field>

            <Field label="วันที่คาดว่าจะได้รับของ (Expected Date) *">
              <NexusDatePicker 
                value={formData.expectedDate}
                onChange={(e) => setFormData({...formData, expectedDate: e.target.value})}
                className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold"
              />
            </Field>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/5 pb-4">
            <ShoppingCart size={16} /> รายการสินค้า / บริการ
          </h3>
          
          <DocumentItemsTable 
            items={items} 
            onChange={setItems} 
          />
        </div>
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      <GlassCard className="p-6 border-white/5 rounded-3xl bg-[#111111] shadow-2xl space-y-4 w-full">
        <h3 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
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
          <span className="text-[12px] font-black text-white/70 uppercase tracking-widest">ยอดรวมสุทธิ</span>
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
