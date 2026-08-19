'use client';

import React, { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { Suspense } from 'react';

function RepairPortalContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('company') || 'UNKNOWN';

  const [formData, setFormData] = useState({
    phoneNumber: '',
    serialNumber: '',
    symptom: ''
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Mocking image to data URL for preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhoto(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber || !formData.symptom) {
      alert("กรุณากรอกเบอร์โทรศัพท์และอาการที่พบ");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, 'service_tickets'), {
        companyId,
        phoneNumber: formData.phoneNumber,
        serialNumber: formData.serialNumber,
        symptom: formData.symptom,
        photoUrl: photo, // in a real app, upload to storage first
        status: 'NEW',
        createdAt: serverTimestamp(),
        source: 'CUSTOMER_PORTAL'
      });
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
    <div className=" bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
        <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
        <h1 className="text-2xl font-black mb-2">ส่งเรื่องแจ้งซ่อมสำเร็จ</h1>
        <p className="text-slate-500 text-center mb-8">
          เจ้าหน้าที่จะติดต่อกลับไปยังเบอร์ {formData.phoneNumber} โดยเร็วที่สุด
        </p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="h-12 px-8 bg-slate-900 text-white rounded-full font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          แจ้งซ่อมรายการอื่น
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:items-center md:py-12">
      <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col min-h-screen md:min-h-0">
        
        {/* Header (Clean, Light Theme) */}
        <div className="h-24 bg-blue-600 flex flex-col items-center justify-center text-white px-6 shrink-0 relative">
          <ShieldAlert size={28} className="absolute right-6 opacity-20" />
          <h1 className="text-xl font-black uppercase tracking-widest">NEXUS SERVICE</h1>
          <p className="text-xs text-blue-100 mt-1">ระบบแจ้งซ่อมออนไลน์ (Customer Portal)</p>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col gap-5">
          
          <div className="space-y-1">
            <label className="text-sm font-black text-slate-600">เบอร์โทรศัพท์ติดต่อกลับ <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
              placeholder="08X-XXX-XXXX"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-base font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              maxLength={10}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-black text-slate-600">รหัสสินค้า / Serial Number (ถ้ามี)</label>
            <input
              type="text"
              value={formData.serialNumber}
              onChange={e => setFormData({...formData, serialNumber: e.target.value})}
              placeholder="S/N บนตัวเครื่อง"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-base font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-all uppercase"
            />
          </div>

          <div className="space-y-1 flex-1 flex flex-col">
            <label className="text-sm font-black text-slate-600">รายละเอียดอาการเสีย <span className="text-red-500">*</span></label>
            <textarea
              value={formData.symptom}
              onChange={e => setFormData({...formData, symptom: e.target.value})}
              placeholder="อธิบายอาการเบื้องต้นที่พบ..."
              className="w-full flex-1 min-h-[120px] p-4 rounded-xl border border-slate-200 bg-slate-50 text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-1">
            <label className="text-sm font-black text-slate-600">แนบรูปภาพ (ถ้ามี)</label>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handlePhotoUpload}
            />
            {photo ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 bg-slate-900/50 text-white rounded-full p-2 backdrop-blur-md"
                >
                  <Camera size={16} /> เปลี่ยนรูป
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-14 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 flex flex-col items-center justify-center hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95"
              >
                <Camera size={20} className="mb-1" />
                <span className="text-xs font-bold">กดเพื่อถ่ายรูป</span>
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-blue-600 text-white rounded-xl font-black text-lg shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-95 active:shadow-none transition-all flex items-center justify-center gap-2 mt-4"
          >
            <Send size={20} />
            {loading ? 'กำลังส่งข้อมูล...' : 'ส่งแจ้งซ่อม'}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function CustomerRepairPortal() {

  // [Master Blueprint V3.1] Global Layout Lock
  React.useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.style.overflowY = "hidden";
    return () => {
      if (mainEl) mainEl.style.overflowY = "auto";
    };
  }, []);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 bg-slate-200 rounded-full mb-4"></div><div className="h-4 bg-slate-200 rounded w-24"></div></div></div>}>
      <RepairPortalContent />
    </Suspense>
  );
}