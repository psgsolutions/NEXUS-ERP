'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PillInput, PillButton } from '@/components/ui/Base';
import { DocumentItemsTable } from '@/components/commerce/DocumentItemsTable';
import { DocumentItem } from '@/types/shared';
import { Save, Wrench, Search, FileText, UserCircle } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { nexusSequenceEngine } from '@/lib/sequence-engine';
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { useRouter } from "next/navigation";

export default function CreateWorkOrderPage() {
  const router = useRouter();
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';

  // Fetch Sales Orders
  const { data: salesOrders } = useRealtimeCollection('sales_orders');
  
  const [formData, setFormData] = useState({
    soId: '',
    soCode: '',
    customerId: '',
    customerName: '',
    technicianName: '',
    scheduleDate: '',
    remarks: ''
  });

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // When SO changes, auto-pull its items
  const handleSoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSoId = e.target.value;
    const so = salesOrders.find(s => s.id === selectedSoId);
    
    if (so) {
      setFormData(prev => ({
        ...prev,
        soId: so.id,
        soCode: so.soCode,
        customerId: so.customerId,
        customerName: so.customerName
      }));

      // Pull items from SO
      if (so.items && Array.isArray(so.items)) {
        const newItems: DocumentItem[] = so.items.map((i: any) => ({
          ...i,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5) // ensure unique fresh ids
        }));
        setItems(newItems);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        soId: '',
        soCode: '',
        customerId: '',
        customerName: ''
      }));
      setItems([]);
    }
  };

  const handleSave = async () => {
    if (!formData.soId || !formData.technicianName || items.length === 0) {
      alert("กรุณาเลือกอ้างอิง SO, ระบุชื่อช่างผู้รับผิดชอบ และต้องมีรายการอย่างน้อย 1 รายการ");
      return;
    }
    
    try {
      setLoading(true);
      const woCode = await nexusSequenceEngine('WO', currentCompanyId);
      
      await addDoc(collection(db, 'work_orders'), {
        woCode,
        soId: formData.soId,
        soCode: formData.soCode,
        customerId: formData.customerId,
        customerName: formData.customerName,
        technicianName: formData.technicianName,
        scheduleDate: formData.scheduleDate,
        remarks: formData.remarks,
        items,
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'SYSTEM',
        isDeleted: false,
        status: 'ASSIGNED'
      });
      
      alert(`สร้างใบสั่งงานสำเร็จ: ${woCode}`);
      // Reset form
      setItems([]);
      setFormData({ soId: '', soCode: '', customerId: '', customerName: '', technicianName: '', scheduleDate: '', remarks: '' });
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกใบสั่งงาน");
    } finally {
      setLoading(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <Search size={18} />
        </button>
        <div>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-0.5">SERVICE & MAINTENANCE</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Wrench className="text-cyan-400" size={24} /> สร้างใบสั่งงานช่าง (Work Order)
            </h1>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PillButton variant="glass" className="h-9 px-6 rounded-full text-[12px] uppercase tracking-widest text-white/50 hover:text-white" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton onClick={handleSave} disabled={loading} className="h-9 px-6 rounded-full bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)] text-[12px] font-black uppercase tracking-widest">
          <Save size={14} className="mr-2" /> {loading ? 'กำลังบันทึก...' : 'สร้าง Work Order'}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="flex flex-col gap-6 pr-2 pb-10">
      
      {/* Header Form */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-[13px] font-black text-cyan-400 uppercase tracking-widest border-b border-white/5 pb-2">
            อ้างอิงเอกสาร (Reference)
          </h3>
          
          <Field label="อ้างอิงใบสั่งขาย * (Select SO)">
            <select
              value={formData.soId}
              onChange={handleSoChange}
              className="h-9 px-5 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-cyan-400/40 w-full appearance-none transition-all"
            >
              <option value="" className="bg-slate-900 text-white/40">-- เลือกใบสั่งขาย (Sales Order) --</option>
              {salesOrders.map(so => (
                <option key={so.id} value={so.id} className="bg-slate-900 text-white">
                  {so.soCode} : {so.customerName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="ลูกค้า (Customer)">
            <PillInput 
              type="text"
              value={formData.customerName}
              disabled
              className="opacity-50 h-9 px-6 rounded-full w-full"
              placeholder="ดึงจากใบสั่งขายอัตโนมัติ"
            />
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="text-[13px] font-black text-cyan-400 uppercase tracking-widest border-b border-white/5 pb-2">
            มอบหมายงาน (Assignment)
          </h3>
          
          <Field label="ทีมช่างรับผิดชอบ * (Assign To)">
            <PillInput 
              type="text"
              value={formData.technicianName}
              onChange={e => setFormData({...formData, technicianName: e.target.value})}
              placeholder="ชื่อช่าง หรือ หัวหน้าทีม"
              className="h-9 px-6 rounded-full w-full"
            />
          </Field>

          <Field label="กำหนดการเข้างาน (Schedule Date)">
            <PillInput 
              type="date"
              value={formData.scheduleDate}
              onChange={e => setFormData({...formData, scheduleDate: e.target.value})}
              className="h-9 px-6 rounded-full w-full"
            />
          </Field>
        </div>
      </div>

      {/* Line Items */}
      <div className="flex-1 flex flex-col gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-[13px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
          รายการสินค้าและค่าแรง (Items from SO)
        </h3>
        <p className="text-[11px] text-white/40 not-italic mb-2 -mt-2 font-bold">ดึงรายการจากใบสั่งขายโดยอัตโนมัติ สามารถลบรายการที่ไม่เกี่ยวข้องกับงานช่างออกได้</p>
        <DocumentItemsTable items={items} onChange={setItems} />
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4 w-full">
        <h3 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
          <UserCircle size={16} className="text-cyan-400" /> สถานะการจ่ายงาน
        </h3>
        
        <div className="space-y-3">
          <div className="flex flex-col gap-1 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">สถานะปัจจุบัน</span>
            <span className="text-[13px] font-bold text-yellow-400">รอสั่งงาน (DRAFT)</span>
          </div>
          
          <div className="flex flex-col gap-1 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">จำนวนรายการที่ต้องทำ</span>
            <span className="text-xl font-mono text-white font-bold">{items.length} <span className="text-[10px] font-normal font-sans">รายการ</span></span>
          </div>
        </div>
        
        <div className="pt-4 border-t border-white/5">
          <label className="block text-[12px] font-bold text-white/70 mb-2 not-italic">
            หมายเหตุถึงทีมช่าง <span className="text-white/40 ml-1 font-normal uppercase tracking-widest text-[10px]">(Remarks)</span>
          </label>
          <textarea
            value={formData.remarks}
            onChange={e => setFormData({...formData, remarks: e.target.value})}
            className="w-full h-24 p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[13px] text-white font-bold resize-none outline-none focus:border-cyan-500/50 transition-all"
            placeholder="ข้อควรระวัง หรือ รายละเอียดเพิ่มเติมสำหรับหน้างาน..."
          />
        </div>
      </div>
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
