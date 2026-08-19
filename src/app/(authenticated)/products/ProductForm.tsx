'use client';

import React, { useState, useEffect } from 'react';
import { PillInput, PillButton } from '@/components/ui/Base';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { nexusSequenceEngine } from '@/lib/sequence-engine';
import { X, Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { SmartSelect } from '@/components/ui/SmartComponents';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';

interface ProductFormProps {
  initialData?: any;
  onClose: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ initialData, onClose }) => {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';

  const [formData, setFormData] = useState({
    productName: '',
    categoryId: 'GENERAL',
    productType: 'Product', // Product | Labor
    subjectToWHT: false,
    costPrice: '0.00',
    projectPrice: '0.00',
    retailPrice: '0.00',
    glAccount: '',
  });

  const [salesBom, setSalesBom] = useState<string[]>([]);
  const [newBomItem, setNewBomItem] = useState('');

  const { data: dbProducts } = useRealtimeCollection('products');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        productName: initialData.productName || '',
        categoryId: initialData.categoryId || 'GENERAL',
        productType: initialData.productType || 'Product',
        subjectToWHT: initialData.subjectToWHT || false,
        costPrice: initialData.costPrice?.toFixed(2) || '0.00',
        projectPrice: initialData.projectPrice?.toFixed(2) || '0.00',
        retailPrice: initialData.retailPrice?.toFixed(2) || '0.00',
        glAccount: initialData.glAccount || '',
      });
      setSalesBom(initialData.salesBom || []);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'costPrice' || name === 'projectPrice' || name === 'retailPrice') {
      // Allow only numbers and dot
      const sanitized = value.replace(/[^0-9.]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitized }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleBlurPrice = (name: string) => {
    setFormData(prev => {
      const val = parseFloat(prev[name as keyof typeof prev] as string);
      return {
        ...prev,
        [name]: isNaN(val) ? '0.00' : val.toFixed(2),
      };
    });
  };

  const handleAddBomItem = () => {
    if (newBomItem.trim() && !salesBom.includes(newBomItem.trim())) {
      setSalesBom([...salesBom, newBomItem.trim()]);
      setNewBomItem('');
    }
  };

  const handleRemoveBomItem = (item: string) => {
    setSalesBom(salesBom.filter(i => i !== item));
  };

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!formData.productName) {
        throw new Error('กรุณากรอกชื่อสินค้า');
      }

      const payload = {
        productName: formData.productName,
        categoryId: formData.categoryId,
        productType: formData.productType,
        subjectToWHT: formData.productType === 'Labor' ? formData.subjectToWHT : false,
        costPrice: parseFloat(formData.costPrice),
        projectPrice: parseFloat(formData.projectPrice),
        retailPrice: parseFloat(formData.retailPrice),
        glAccount: formData.glAccount,
        salesBom,
        companyId: currentCompanyId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'SYSTEM',
      };

      if (initialData?.id) {
        // Update
        await updateDoc(doc(db, 'products', initialData.id), payload);
      } else {
        // Create
        const productCode = await nexusSequenceEngine('PRD', currentCompanyId);
        await addDoc(collection(db, 'products'), {
          ...payload,
          productCode,
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
          {initialData ? 'แก้ไขข้อมูลสินค้า/ค่าแรง' : 'สร้างรายการใหม่'}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* ── General Info ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            ข้อมูลทั่วไป (General)
          </h3>
          
          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              ชื่อสินค้า/บริการ <span className="text-red-500 font-bold">*</span> (Name)
            </label>
            <PillInput 
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder="เช่น กล้องวงจรปิด, ค่าติดตั้ง"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
                ประเภท (Type)
              </label>
              <select
                name="productType"
                value={formData.productType}
                onChange={handleChange}
                className="h-9 px-5 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all w-full appearance-none"
              >
                <option value="Product" className="bg-slate-900 text-white">สินค้า (Product)</option>
                <option value="Labor" className="bg-slate-900 text-white">ค่าแรง/ค่าติดตั้ง (Labor)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
                หมวดหมู่ (Category)
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="h-9 px-5 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all w-full appearance-none"
              >
                <option value="GENERAL" className="bg-slate-900 text-white">ทั่วไป</option>
                <option value="HARDWARE" className="bg-slate-900 text-white">อุปกรณ์ (Hardware)</option>
                <option value="SOFTWARE" className="bg-slate-900 text-white">ซอฟต์แวร์ (Software)</option>
                <option value="SERVICE" className="bg-slate-900 text-white">บริการ (Service)</option>
              </select>
            </div>
          </div>

          {/* Conditional WHT Flag */}
          {formData.productType === 'Labor' && (
            <div className="bg-transparent border border-warning/20 p-3 rounded-2xl flex items-center gap-3">
              <input 
                type="checkbox" 
                id="subjectToWHT"
                name="subjectToWHT"
                checked={formData.subjectToWHT}
                onChange={handleChange}
                className="w-4 h-4 accent-warning"
              />
              <label htmlFor="subjectToWHT" className="text-[11px] font-black text-warning uppercase tracking-widest cursor-pointer not-italic">
                คิดหัก ณ ที่จ่าย (WHT)
              </label>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              รหัสบัญชี GL (GL Account)
            </label>
            <PillInput 
              name="glAccount"
              value={formData.glAccount}
              onChange={handleChange}
              placeholder="พิมพ์รหัส หรือเลือกจากรายการ"
              list="glAccounts"
              className="font-mono"
            />
            <datalist id="glAccounts">
              <option value="41000">รายได้จากการขาย (41000)</option>
              <option value="42000">รายได้ค่าบริการ (42000)</option>
              <option value="51000">ต้นทุนขาย (51000)</option>
            </datalist>
          </div>
        </div>

        {/* ── Pricing Structure ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            โครงสร้างราคา 3 ระดับ (Pricing)
          </h3>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              ต้นทุน (Cost)
            </label>
            <PillInput 
              name="costPrice"
              value={formData.costPrice}
              onChange={handleChange}
              onBlur={() => handleBlurPrice('costPrice')}
              className="font-mono text-right text-red-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              ราคาโครงการ (Project Price)
            </label>
            <PillInput 
              name="projectPrice"
              value={formData.projectPrice}
              onChange={handleChange}
              onBlur={() => handleBlurPrice('projectPrice')}
              className="font-mono text-right text-blue-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-1 not-italic">
              ราคาหน้าร้าน (Retail Price)
            </label>
            <PillInput 
              name="retailPrice"
              value={formData.retailPrice}
              onChange={handleChange}
              onBlur={() => handleBlurPrice('retailPrice')}
              className="font-mono text-right text-nexus-teal text-lg"
            />
          </div>
        </div>

        {/* ── Sales BOM ── */}
        <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-black text-nexus-teal uppercase tracking-widest border-b border-white/5 pb-2">
            การจัดชุดสินค้า (Sales BOM)
          </h3>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <SmartSelect 
                value={newBomItem}
                onChange={(val) => {
                  const p = dbProducts?.find((p: any) => p.id === val);
                  if (p) {
                    const identifier = p.productCode || p.sku;
                    if (identifier && !salesBom.includes(identifier)) {
                      setSalesBom([...salesBom, identifier]);
                    }
                  }
                  setNewBomItem('');
                }}
                options={dbProducts?.map((p: any) => ({
                  value: p.id,
                  label: p.productName || p.name || 'Unnamed',
                  description: p.productCode || p.sku || 'N/A'
                })) || []}
                placeholder="ค้นหาและเลือกสินค้าที่ต้องการจัดชุด..."
              />
            </div>
            <PillButton onClick={handleAddBomItem}  type="button">
              <Plus size={16} /> เพิ่ม
            </PillButton>
          </div>

          {salesBom.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-wrap gap-2">
              {salesBom.map(item => (
                <div key={item} className="bg-white/15 px-3 py-1.5 rounded-full flex items-center gap-2">
                  <span className="font-mono text-xs text-white">{item}</span>
                  <button type="button" onClick={() => handleRemoveBomItem(item)} className="text-white/40 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
