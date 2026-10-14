'use client';

import React, { useMemo, useState } from 'react';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PillInput, PillButton, PillSelect } from '@/components/ui/Base';
import { DocumentItemsTable } from '@/components/commerce/DocumentItemsTable';
import { DocumentItem } from '@/types/shared';
import { Save, Wrench, Search, FileText, UserCircle, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from "@/lib/api-client";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { useRouter } from "next/navigation";

export default function CreateWorkOrderPage() {
  const router = useRouter();
  const { user, companyId } = useAuth();

  // ใบสั่งขายของบริษัท (ไม่รวมใบตัวอย่าง/ยกเลิก)
  const { data: allSalesOrders } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/sales_orders` : '');
  const salesOrders = useMemo(
    () => allSalesOrders
      .filter((so: any) => !so.isSample && String(so.status || '').toUpperCase() !== 'CANCELLED')
      .map((so: any) => ({ ...so, soCode: so.soCode || so.documentNo || so.soId || so.id })),
    [allSalesOrders]
  );

  // ผู้ใช้ของบริษัทที่มอบหมายงานได้ (ช่างเทคนิคขึ้นก่อน)
  const { data: companyUsers } = useRealtimeCollection<any>('users');
  const assignees = useMemo(
    () => companyUsers
      .filter((u: any) => !u.status || String(u.status).toUpperCase() === 'ACTIVE')
      .map((u: any) => ({ uid: u.id, name: u.name || u.displayName || u.email, role: String(u.role || '').toUpperCase() }))
      .sort((a, b) => Number(b.role === 'TECHNICIAN') - Number(a.role === 'TECHNICIAN') || a.name.localeCompare(b.name, 'th')),
    [companyUsers]
  );

  const [formData, setFormData] = useState({
    soId: '',
    soCode: '',
    customerId: '',
    customerName: '',
    projectId: '',
    technicianUid: '',
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
        customerId: so.customerId || '',
        customerName: so.customerName || '',
        projectId: so.projectId || ''
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
        customerName: '',
        projectId: ''
      }));
      setItems([]);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!formData.soId || !formData.technicianUid || items.length === 0) {
      alert("กรุณาเลือกอ้างอิง SO, เลือกช่างผู้รับผิดชอบ และต้องมีรายการอย่างน้อย 1 รายการ");
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch("/api/service/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, soId: formData.soId, technicianUid: formData.technicianUid, scheduleDate: formData.scheduleDate, remarks: formData.remarks, items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      const woCode = data.woCode;
      alert(`สร้างใบสั่งงานสำเร็จ: ${woCode}`);
      setItems([]);
      setFormData({ soId: '', soCode: '', customerId: '', customerName: '', projectId: '', technicianUid: '', technicianName: '', scheduleDate: '', remarks: '' });
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกใบสั่งงาน");
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
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight flex items-center gap-2">
              <Wrench className="text-nexus-teal" size={24} /> สร้างใบสั่งงานช่าง
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              WORK-ORDER
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">เปิดใบสั่งงานบริการ มอบหมายงานช่าง และติดตามการปฏิบัติงานหน้างาน</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" onClick={handleSave} disabled={loading} className="h-8 px-5 font-bold text-xs">
          <Save size={14} className="mr-1.5" /> {loading ? 'กำลังบันทึก...' : 'สร้าง Work Order'}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="flex flex-col gap-6 pr-2 pb-10">
      
      {/* Header Form */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            อ้างอิงเอกสาร (Reference)
          </h3>
          
          <Field label="อ้างอิงใบสั่งขาย * (Select SO)">
            <PillSelect
              value={formData.soId}
              onChange={handleSoChange}
              className="h-9 px-5 bg-white/[0.03] border-white/10 text-[13px] w-full"
            >
              <option value="">-- เลือกใบสั่งขาย --</option>
              {salesOrders.map((so: any) => (
                <option key={so.id} value={so.id}>
                  {so.soCode} : {so.customerName}
                </option>
              ))}
            </PillSelect>
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
          <h3 className="text-[13px] font-semibold text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            มอบหมายงาน (Assignment)
          </h3>
          
          <Field label="ทีมช่างรับผิดชอบ * (Assign To)">
            <PillSelect
              value={formData.technicianUid}
              onChange={e => {
                const a = assignees.find(x => x.uid === e.target.value);
                setFormData({ ...formData, technicianUid: a?.uid || '', technicianName: a?.name || '' });
              }}
              className="h-9 px-5 bg-white/[0.03] border-white/10 text-[13px] w-full"
            >
              <option value="">-- เลือกผู้รับผิดชอบ --</option>
              {assignees.map(a => (
                <option key={a.uid} value={a.uid}>
                  {a.name}{a.role === 'TECHNICIAN' ? ' (ช่างเทคนิค)' : ''}
                </option>
              ))}
            </PillSelect>
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
        <h3 className="text-[13px] font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-2">
          รายการสินค้าและค่าแรง (Items from SO)
        </h3>
        <p className="text-[11px] text-white/40 not-italic mb-2 -mt-2 font-bold">ดึงรายการจากใบสั่งขายโดยอัตโนมัติ สามารถลบรายการที่ไม่เกี่ยวข้องกับงานช่างออกได้</p>
        <DocumentItemsTable items={items} onChange={setItems} />
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4 w-full">
        <h3 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
          <UserCircle size={16} className="text-nexus-teal" /> สถานะการจ่ายงาน
        </h3>
        
        <div className="space-y-3">
          <div className="flex flex-col gap-1 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">สถานะปัจจุบัน</span>
            <span className="text-[13px] font-bold text-warning">รอสั่งงาน (DRAFT)</span>
          </div>
          
          <div className="flex flex-col gap-1 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">จำนวนรายการที่ต้องทำ</span>
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
            className="w-full h-24 p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[13px] text-white font-bold resize-none outline-none focus:border-nexus-teal/40 transition-all"
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
