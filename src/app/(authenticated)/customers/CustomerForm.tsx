'use client';

import React, { useState, useEffect } from 'react';
import { PillInput, PillButton } from '@/components/ui/Base';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { nexusSequenceEngine } from '@/lib/sequence-engine';
import { validateThaiTaxId } from '@/lib/taxUtils';
import { X, Save, AlertCircle } from 'lucide-react';

interface CustomerFormProps {
  initialData?: any;
  onClose: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ initialData, onClose }) => {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';

  const [formData, setFormData] = useState({
    customerName: '',
    grade: 'Private',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    creditTerm: '0',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        customerName: initialData.customerName || '',
        grade: initialData.grade || 'Private',
        taxId: initialData.taxId || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        address: initialData.address || '',
        creditTerm: initialData.creditTerm?.toString() || '0',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Real-time masking for Tax ID (digits only, max 13)
    if (name === 'taxId') {
      const sanitized = value.replace(/\D/g, '').slice(0, 13);
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      return;
    }

    // Real-time masking for Phone (digits only)
    if (name === 'phone') {
      const sanitized = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);

      // Validation
      if (!formData.customerName) {
        throw new Error('กรุณากรอกชื่อลูกค้า');
      }

      if (formData.taxId) {
        if (formData.taxId.length !== 13) {
          throw new Error('เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก');
        }
        if (!validateThaiTaxId(formData.taxId)) {
          throw new Error('เลขประจำตัวผู้เสียภาษีไม่ถูกต้องตามรูปแบบของกรมสรรพากร');
        }

        // Duplicate Check
        const q = query(
          collection(db, 'customers'),
          where('companyId', '==', currentCompanyId),
          where('taxId', '==', formData.taxId),
          where('isDeleted', '==', false)
        );
        const snapshot = await getDocs(q);
        
        // If updating, ignore self
        const duplicateDocs = snapshot.docs.filter(d => d.id !== initialData?.id);
        if (duplicateDocs.length > 0) {
          throw new Error('เลขประจำตัวผู้เสียภาษีนี้มีในระบบแล้ว (ลูกค้าซ้ำ)');
        }
      }

      const payload = {
        customerName: formData.customerName,
        grade: formData.grade,
        taxId: formData.taxId,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        creditTerm: Number(formData.creditTerm),
        companyId: currentCompanyId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'SYSTEM',
      };

      if (initialData?.id) {
        // Update existing
        await updateDoc(doc(db, 'customers', initialData.id), payload);
      } else {
        // Generate new sequence code
        const customerCode = await nexusSequenceEngine('CUS', currentCompanyId);
        
        // Create new
        await addDoc(collection(db, 'customers'), {
          ...payload,
          customerCode,
          isDeleted: false,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || 'SYSTEM',
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-widest">
          {initialData ? 'แก้ไขข้อมูลลูกค้า' : 'สร้างลูกค้าใหม่'}
        </h2>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
          <p className="text-sm font-bold text-red-400 not-italic">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identity */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            ข้อมูลตัวตน (Identity)
          </h3>
          
          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              ชื่อลูกค้า <span className="text-red-500 font-bold">*</span> (Customer Name)
            </label>
            <PillInput 
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              placeholder="บริษัท ตัวอย่าง จำกัด"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              เกรดลูกค้า (Grade)
            </label>
            <select
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              className="h-9 px-5 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all w-full appearance-none"
            >
              <option value="Private" className="bg-slate-900 text-white">เอกชน (Private)</option>
              <option value="Government" className="bg-slate-900 text-white">ราชการ (Government)</option>
              <option value="VIP" className="bg-slate-900 text-white">วีไอพี (VIP)</option>
            </select>
          </div>
        </div>

        {/* Tax/Finance */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            ภาษี/การเงิน (Tax & Finance)
          </h3>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              เลขประจำตัวผู้เสียภาษี 13 หลัก (Tax ID)
            </label>
            <PillInput 
              name="taxId"
              value={formData.taxId}
              onChange={handleChange}
              maxLength={13}
              className="font-mono tracking-widest"
              placeholder="1234567890123"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              เครดิตเทอม (วัน) (Credit Term)
            </label>
            <PillInput 
              name="creditTerm"
              type="number"
              value={formData.creditTerm}
              onChange={handleChange}
              className="font-mono text-right"
              placeholder="30"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="col-span-1 md:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            ข้อมูลติดต่อ (Contact Info)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
                เบอร์โทรศัพท์ (Phone)
              </label>
              <PillInput 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                maxLength={10}
                className="font-mono tracking-wider"
                placeholder="02xxxxxxx"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
                อีเมล (Email)
              </label>
              <PillInput 
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              ที่อยู่ (Address)
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full h-24 p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all placeholder:text-white/10 resize-none"
              placeholder="123 ถนน... แขวง... เขต... จังหวัด... รหัสไปรษณีย์"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
        <PillButton onClick={onClose} variant="ghost">
          ยกเลิก
        </PillButton>
        <PillButton onClick={handleSave} variant="save" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : (
            <>
              <Save size={16} /> บันทึกข้อมูล
            </>
          )}
        </PillButton>
      </div>
    </div>
  );
}
