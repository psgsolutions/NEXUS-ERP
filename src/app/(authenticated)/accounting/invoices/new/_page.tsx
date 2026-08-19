'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { nexusSequenceEngine } from '@/lib/sequence-engine';
import { PillButton } from '@/components/ui/Base';
import { SmartSelect, NumberInput } from '@/components/ui/SmartComponents';
import { DocumentItemsTable } from '@/components/commerce/DocumentItemsTable';
import { DocumentItem } from '@/types/shared';
import { FileText, Save, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceDocument } from '@/types/invoice';

export default function NewInvoicePage() {
  const { user, currentCompanyId } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    referenceSoId: '',
    referencePoNo: '',
    paymentTerms: 'เครดิต 30 วัน',
    vatType: 'INCLUDE' as 'EXCLUDE' | 'INCLUDE' | 'NO_VAT',
    whtRate: 0,
  });

  const [items, setItems] = useState<DocumentItem[]>([]);

  // Fetch SOs and Customers
  useEffect(() => {
    if (!currentCompanyId) return;

    const fetchSOs = async () => {
      const q = query(
        collection(db, 'sales_orders'),
        where('companyId', '==', currentCompanyId),
        where('isDeleted', '==', false)
      );
      const snapshot = await getDocs(q);
      const sos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSalesOrders(sos);
    };

    const fetchCustomers = async () => {
      const q = query(
        collection(db, 'customers'),
        where('companyId', '==', currentCompanyId),
        where('isDeleted', '==', false)
      );
      const snapshot = await getDocs(q);
      const custs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(custs);
    };

    fetchSOs();
    fetchCustomers();
  }, [currentCompanyId]);

  // Handle SO Selection
  const handleSoSelect = (soId: string) => {
    const so = salesOrders.find(s => s.id === soId);
    if (so) {
      setFormData(prev => ({
        ...prev,
        referenceSoId: soId,
        referencePoNo: so.poNumber || '',
        customerId: so.customerId,
        customerName: so.customerName
      }));
      setItems(so.items || []);
    } else {
      setFormData(prev => ({
        ...prev,
        referenceSoId: '',
        referencePoNo: '',
      }));
      setItems([]);
    }
  };

  // Calculations
  const subTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  
  let vatAmount = 0;
  let netSubTotal = subTotal;
  
  if (formData.vatType === 'INCLUDE') {
    // subTotal includes VAT
    vatAmount = subTotal - (subTotal / 1.07);
    netSubTotal = subTotal - vatAmount;
  } else if (formData.vatType === 'EXCLUDE') {
    vatAmount = subTotal * 0.07;
  }

  // WHT base logic (often based on net before VAT)
  const whtBase = items.filter(i => i.subjectToWHT).reduce((sum, item) => {
    if (formData.vatType === 'INCLUDE') {
       return sum + (item.totalAmount / 1.07);
    }
    return sum + item.totalAmount;
  }, 0);
  
  const whtAmount = whtBase * (formData.whtRate / 100);
  
  const grandTotal = formData.vatType === 'INCLUDE' ? subTotal - whtAmount : subTotal + vatAmount - whtAmount;

  const handleSave = async () => {
    if (!formData.customerId || items.length === 0) {
      alert("กรุณาเลือกลูกค้าและเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    try {
      setLoading(true);
      const invoiceNo = await nexusSequenceEngine('INV', currentCompanyId);
      
      const docData: InvoiceDocument = {
        companyId: currentCompanyId,
        invoiceNo,
        referenceSoId: formData.referenceSoId,
        referencePoNo: formData.referencePoNo,
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerTaxId: '', // To be filled from customer doc if needed
        billingAddress: '',
        issueDate: serverTimestamp(),
        dueDate: null,
        paymentTerms: formData.paymentTerms,
        items: items as any,
        vatType: formData.vatType,
        whtRate: formData.whtRate,
        subTotal: netSubTotal,
        discountTotal: 0,
        vatAmount,
        whtAmount,
        grandTotal,
        status: 'DRAFT',
        createdBy: user?.uid || 'SYSTEM',
        createdAt: serverTimestamp(),
        isDeleted: false
      };

      await addDoc(collection(db, 'invoices'), docData);
      
      alert(`บันทึกใบแจ้งหนี้สำเร็จ: ${invoiceNo}`);
      // Reset
      setItems([]);
      setFormData({
        customerId: '',
        customerName: '',
        referenceSoId: '',
        referencePoNo: '',
        paymentTerms: 'เครดิต 30 วัน',
        vatType: 'INCLUDE',
        whtRate: 0,
      });
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-nexus-cyan/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-transparent blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6 relative z-10">
        {/* ── Main Form Column (Left) ── */}
        <div className="flex-1 flex flex-col gap-6">
          
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                <FileText className="text-nexus-cyan" /> สร้างใบแจ้งหนี้ (Invoice)
              </h1>
            </div>
            
            <PillButton onClick={handleSave} variant="primary" disabled={loading} className="shadow-[0_0_15px_rgba(45,212,191,0.3)] bg-nexus-cyan text-gray-900 font-bold hover:bg-teal-400">
              <Save size={16} /> {loading ? 'กำลังบันทึก...' : 'บันทึกใบแจ้งหนี้'}
            </PillButton>
          </div>

          {/* Header Form */}
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Auto-fill from SO */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 size={12} className="text-nexus-cyan" /> อ้างอิงใบสั่งขาย (Ref SO) - ดึงข้อมูลอัตโนมัติ
              </label>
              <SmartSelect
                value={formData.referenceSoId}
                onChange={handleSoSelect}
                options={salesOrders.map(s => ({
                  value: s.id,
                  label: `${s.soCode} : ${s.customerName}`,
                  description: `PO: ${s.poNumber || '-'} | ยอด: ฿${s.netTotal?.toLocaleString()}`
                }))}
                placeholder="ค้นหาเลขที่ SO เพื่อดึงข้อมูล..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 not-italic">
                ชื่อลูกค้า <span className="text-red-500 font-bold">*</span> (Customer Name)
              </label>
              <SmartSelect
                value={formData.customerId}
                onChange={(value) => {
                  const cust = customers.find(c => c.id === value);
                  setFormData(prev => ({
                    ...prev,
                    customerId: value,
                    customerName: cust ? cust.customerName : ''
                  }));
                }}
                options={customers.map(c => ({
                  value: c.id,
                  label: `${c.customerCode} : ${c.customerName}`,
                }))}
                placeholder="-- เลือกลูกค้า --"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-white/40 uppercase tracking-widest not-italic">
                เงื่อนไขการชำระเงิน (Payment Terms)
              </label>
              <SmartSelect
                value={formData.paymentTerms}
                onChange={(v) => setFormData({...formData, paymentTerms: v})}
                options={[
                  { value: 'เงินสด', label: 'เงินสด (Cash)' },
                  { value: 'เครดิต 15 วัน', label: 'เครดิต 15 วัน' },
                  { value: 'เครดิต 30 วัน', label: 'เครดิต 30 วัน' },
                  { value: 'เครดิต 45 วัน', label: 'เครดิต 45 วัน' },
                  { value: 'เครดิต 60 วัน', label: 'เครดิต 60 วัน' }
                ]}
                placeholder="-- เลือกเงื่อนไข --"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="flex-1 flex flex-col gap-2">
            <h3 className="text-xs font-black text-nexus-cyan uppercase tracking-widest">รายการสินค้า (Items)</h3>
            <DocumentItemsTable items={items} onChange={setItems} />
          </div>
        </div>

        {/* ── Summary Column (Right) ── */}
        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">
          
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
              สรุปข้อมูล (Summary)
            </h3>
            
            <div className="space-y-3">
              {/* VAT Toggle */}
              <div className="flex justify-between items-center text-xs text-white/60">
                <span>รูปแบบภาษี (VAT Type)</span>
                <SmartSelect 
                  value={formData.vatType}
                  onChange={(v) => setFormData({...formData, vatType: v as any})}
                  options={[
                    { value: 'INCLUDE', label: 'รวมภาษี (Include)' },
                    { value: 'EXCLUDE', label: 'แยกภาษี (Exclude)' },
                    { value: 'NO_VAT', label: 'ไม่มีภาษี (No VAT)' },
                  ]}
                  className="w-32"
                />
              </div>

              {/* WHT Toggle */}
              <div className="flex justify-between items-center text-xs text-red-400">
                <span>หัก ณ ที่จ่าย (WHT)</span>
                <SmartSelect 
                  value={formData.whtRate.toString()}
                  onChange={(v) => setFormData({...formData, whtRate: Number(v)})}
                  options={[
                    { value: '0', label: 'ไม่มี (0%)' },
                    { value: '1', label: 'ค่าขนส่ง (1%)' },
                    { value: '3', label: 'ค่าบริการ (3%)' },
                    { value: '5', label: 'ค่าเช่า (5%)' },
                  ]}
                  className="w-32"
                />
              </div>

              <div className="h-px bg-white/15 my-2" />

              <div className="flex justify-between items-center text-sm text-white/80">
                <span>ยอดรวม (Sub Total)</span>
                <span className="font-mono">{netSubTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              
              {formData.vatType !== 'NO_VAT' && (
                <div className="flex justify-between items-center text-sm text-white/80">
                  <span>ภาษีมูลค่าเพิ่ม 7% (VAT)</span>
                  <span className="font-mono">{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              )}

              {formData.whtRate > 0 && (
                <div className="flex justify-between items-center text-sm text-red-400">
                  <span>หัก ณ ที่จ่าย {formData.whtRate}%</span>
                  <span className="font-mono">-{whtAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-nexus-cyan/20">
              <div className="flex justify-between items-center text-nexus-cyan">
                <span className="text-sm font-black tracking-widest uppercase">ยอดชำระสุทธิ</span>
                <span className="text-2xl font-black font-mono">{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
