'use client';

import { useSystemDialog } from "@/context/DialogContext";
import React, { useState, useEffect } from 'react';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PillInput, PillButton, GlassCard } from '@/components/ui/Base';
import { Save, HardHat, FileText, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from "@/lib/api-client";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function CreatePayoutPage() {
  const { showAlert } = useSystemDialog();
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || "";

  const { data: salesOrders } = useRealtimeCollection(currentCompanyId ? `companies/${currentCompanyId}/sales_orders` : '');
  
  const [formData, setFormData] = useState({
    soId: '',
    soCode: '',
    subcontractorName: '',
    subcontractorTaxId: '',
    remarks: ''
  });

  const [laborItems, setLaborItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSoId = e.target.value;
    const so = salesOrders.find(s => s.id === selectedSoId);
    
    if (so) {
      setFormData(prev => ({
        ...prev,
        soId: so.id,
        soCode: so.soCode
      }));

      // Pull only labor items
      if (so.items && Array.isArray(so.items)) {
        const labor = so.items.filter((i: any) => i.isLabor === true || i.subjectToWHT === true);
        setLaborItems(labor.map((i: any) => ({
          ...i,
          payoutAmount: i.total // default payout is the total billed, can be adjusted in real system
        })));
      }
    } else {
      setFormData(prev => ({ ...prev, soId: '', soCode: '' }));
      setLaborItems([]);
    }
  };

  const subTotal = laborItems.reduce((sum, item) => sum + (item.payoutAmount || 0), 0);
  const whtAmount = subTotal * 0.03;
  const netTotal = subTotal - whtAmount;

  const handleSave = async () => {
    if (!formData.soId || !formData.subcontractorName || laborItems.length === 0) {
      showAlert("กรุณาเลือกอ้างอิง SO, ระบุชื่อซับคอนแทรคเตอร์ และต้องมีรายการค่าแรงอย่างน้อย 1 รายการ", "ข้อมูลไม่ครบ", "warning");
      return;
    }
    
    try {
      setLoading(true);
      // ตั้งเบิกค่าแรงช่างเป็นรายการค่าใช้จ่ายของบริษัท (เลข EXP ไม่ข้าม) แล้วจ่ายจริงที่ การเงิน › จ่ายชำระ (หัก ณ ที่จ่าย 3% และบันทึกบัญชีตอนจ่าย)
      const res = await apiFetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: currentCompanyId, action: "subcontract", soId: formData.soId, soCode: formData.soCode, subcontractorName: formData.subcontractorName, subcontractorTaxId: formData.subcontractorTaxId, remarks: formData.remarks, items: laborItems.map((it: any) => ({ description: it.description || it.name || it.taskName || "ค่าแรง", payoutAmount: it.payoutAmount })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      showAlert(`ตั้งเบิกค่าแรงช่างสำเร็จ: ${data.expenseId} — จ่ายเงินได้ที่ การเงิน › จ่ายชำระ`);
      // Reset form
      setLaborItems([]);
      setFormData({ soId: '', soCode: '', subcontractorName: '', subcontractorTaxId: '', remarks: '' });
    } catch (err) {
      console.error(err);
      showAlert("เกิดข้อผิดพลาดในการบันทึก", "เกิดข้อผิดพลาด", "error");
    } finally {
      setLoading(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => window.history.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight flex items-center gap-2">
              <HardHat className="text-nexus-teal" size={24} /> ตัดจ่ายค่าแรงช่าง
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              PAYOUT
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            บันทึกใบเบิกจ่ายและตัดจ่ายค่าแรงผู้รับเหมาตามงวดงานโครงการ
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => window.history.back()}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={handleSave} disabled={loading}>
          <Save size={14} className="mr-1.5" /> {loading ? 'กำลังบันทึก...' : 'บันทึกใบเบิกจ่าย'}
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-6">
      
      {/* Header Form */}
      <GlassCard className="p-8 border-white/5 bg-black/20 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-[12px] font-semibold text-cyan-400 uppercase tracking-widest border-b border-white/5 pb-2">
            อ้างอิงเอกสาร (Reference)
          </h3>
          
          <Field label="อ้างอิงใบสั่งขาย * (Select SO)" required>
            <select
              value={formData.soId}
              onChange={handleSoChange}
              className="h-10 px-5 rounded-full bg-black/50 border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-cyan-400/40 w-full appearance-none transition-all"
            >
              <option value="" className="bg-slate-900 text-white/40">-- เลือกใบสั่งขาย (Sales Order) --</option>
              {salesOrders.map(so => (
                <option key={so.id} value={so.id} className="bg-slate-900 text-white">
                  {so.soCode} : {so.customerName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="text-[12px] font-semibold text-cyan-400 uppercase tracking-widest border-b border-white/5 pb-2">
            ผู้รับเงิน (Payee)
          </h3>
          
          <Field label="ชื่อช่างซับคอนแทรค * (Subcontractor Name)" required>
            <PillInput 
              type="text"
              value={formData.subcontractorName}
              onChange={e => setFormData({...formData, subcontractorName: e.target.value})}
              placeholder="ระบุชื่อผู้รับเงิน"
              className="w-full h-10 px-5 rounded-full"
            />
          </Field>

          <Field label="เลขประจำตัวผู้เสียภาษี (Tax ID)">
            <PillInput 
              type="text"
              value={formData.subcontractorTaxId}
              onChange={e => setFormData({...formData, subcontractorTaxId: e.target.value})}
              className="w-full h-10 px-5 rounded-full font-mono text-right tracking-widest"
              maxLength={13}
              placeholder="เลขบัตร ปชช. 13 หลัก"
            />
          </Field>
        </div>
      </GlassCard>

      {/* Line Items */}
      <div className="flex flex-col gap-3 pt-2">
        <h3 className="text-[12px] font-semibold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
          รายการค่าแรงที่ดึงมา (Extracted Labor Items)
        </h3>
        <p className="text-[11px] font-bold text-white/40 not-italic">ระบบจะดึงเฉพาะรายการสินค้าที่ตั้งค่าเป็น &ldquo;ค่าแรง&rdquo; จากใบสั่งขายเท่านั้น</p>
        
        <div className="border border-white/10 rounded-3xl overflow-hidden bg-white/[0.02] flex flex-col">
          <div className="flex gap-2 px-4 py-3 bg-white/[0.05] border-b border-white/10 text-[11px] font-semibold text-white/60 uppercase tracking-widest">
            <div className="w-8 text-center">No.</div>
            <div className="flex-1">รายการ (Description)</div>
            <div className="w-24 text-right">จำนวน</div>
            <div className="w-32 text-right">ยอดเงิน (Amount)</div>
          </div>
          
          <div className="flex flex-col divide-y divide-white/5">
            {laborItems.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                 <HardHat size={32} className="text-white/10" />
                 <span className="text-white/40 text-sm font-bold tracking-widest uppercase">ไม่พบข้อมูลค่าแรงในระบบ (No Labor Data Found)</span>
              </div>
            ) : (
              laborItems.map((item, index) => (
                <div key={item.id} className="flex gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors min-h-[40px]">
                  <div className="w-8 text-center text-xs font-mono text-white/40">{index + 1}</div>
                  <div className="flex-1 text-[13px] font-bold text-white">{item.name}</div>
                  <div className="w-24 text-right text-[13px] text-white/60 font-mono">{item.qty} <span className="font-sans">{item.unit}</span></div>
                  <div className="w-32 text-right font-mono text-[13px] text-cyan-400 font-bold">{item.payoutAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <h3 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 relative z-10">
        <FileText size={16} className="text-cyan-400" /> สรุปยอดจ่าย (Summary)
      </h3>
      
      <div className="space-y-4 relative z-10 bg-white/[0.03] p-5 rounded-2xl border border-white/5">
        <div className="flex justify-between items-center text-white/60 pb-3 border-b border-white/5">
          <span className="text-[11px] font-semibold uppercase tracking-widest">รวมยอดค่าแรง</span>
          <span className="font-mono text-[13px] font-bold text-white">{subTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        </div>
        
        <div className="flex justify-between items-center text-red-400">
          <span className="text-[11px] font-semibold uppercase tracking-widest flex flex-col gap-1">
            หัก ณ ที่จ่าย (WHT)
            <span className="text-[9px] font-mono text-red-400/60 leading-none">3.00%</span>
          </span>
          <span className="font-mono text-[13px] font-bold">-{whtAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      
      <div className="pt-4 border-t border-white/5 text-right relative z-10">
        <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1">ยอดจ่ายสุทธิ (Net Payout)</div>
        <div className="text-2xl font-mono text-cyan-400 font-black tracking-tight">{netTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
      </div>

      <div className="pt-4 border-t border-white/5 relative z-10 space-y-2">
        <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest not-italic">
          หมายเหตุ (Remarks)
        </label>
        <textarea
          value={formData.remarks}
          onChange={e => setFormData({...formData, remarks: e.target.value})}
          className="w-full h-24 p-4 bg-black/40 border border-white/10 rounded-2xl text-[13px] font-bold text-white resize-none outline-none focus:border-cyan-400/50 custom-scrollbar"
          placeholder="หมายเหตุการจ่ายเงิน..."
        />
      </div>

      <div className="space-y-4 pt-4 relative z-10">
        <PillButton 
          className="w-full h-11 px-8 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] uppercase tracking-[0.2em] font-black border border-cyan-500/30 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-[12px]"
          onClick={handleSave} disabled={loading}
        >
          <Save size={18} className="mr-2" /> {loading ? 'กำลังบันทึก...' : 'บันทึกใบเบิกจ่าย'}
        </PillButton>
      </div>
      
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
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
