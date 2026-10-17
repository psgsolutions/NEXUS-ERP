'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, Send, CheckCircle2, ShieldAlert, Loader2, X } from 'lucide-react';

/**
 * พอร์ทัลแจ้งซ่อมของลูกค้า (ไม่ต้องล็อกอิน) — ลิงก์ /portal/repair?company=<รหัสบริษัท>
 * ส่งผ่าน /api/portal/repair (ตรวจข้อมูล จำกัดจำนวนครั้ง) เข้ากล่องคำขอให้เจ้าหน้าที่รับเรื่องที่หน้างานบริการ
 */

/** ย่อรูปฝั่งเครื่องลูกค้าก่อนส่ง (ด้านยาวไม่เกิน 1280px, JPEG) */
async function shrinkImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const inputCls = "w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-base leading-[1.9] focus:outline-none focus:border-blue-500 focus:bg-white transition-all";

function RepairPortalContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('company') || '';

  const [company, setCompany] = useState<{ name: string; phone: string } | null>(null);
  const [linkError, setLinkError] = useState('');
  const [formData, setFormData] = useState({ customerName: '', phoneNumber: '', serialNumber: '', symptom: '', website: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) { setLinkError('ลิงก์แจ้งซ่อมไม่ครบ กรุณาติดต่อร้านค้าเพื่อขอลิงก์ใหม่'); return; }
    fetch(`/api/portal/repair?company=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => (d.success ? setCompany(d.company) : setLinkError(d.error || 'ลิงก์แจ้งซ่อมไม่ถูกต้อง')))
      .catch(() => setLinkError('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่'));
  }, [companyId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto(await shrinkImage(file)); setError(''); }
    catch { setError('อ่านรูปไม่ได้ กรุณาเลือกรูปอื่น'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = formData.phoneNumber.replace(/\D/g, '');
    if (phone.length < 9 || !formData.symptom.trim()) { setError('กรุณากรอกเบอร์โทรศัพท์และอาการที่พบ'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/portal/repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: companyId, ...formData, phoneNumber: phone, photo: photo || '' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่');
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFormData({ customerName: '', phoneNumber: '', serialNumber: '', symptom: '', website: '' }); setPhoto(null); setIsSuccess(false); };

  if (linkError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 text-center gap-3">
        <ShieldAlert size={48} className="text-amber-500" />
        <p className="text-lg font-bold">{linkError}</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
        <h1 className="text-2xl font-black mb-2">ส่งเรื่องแจ้งซ่อมสำเร็จ</h1>
        <p className="text-slate-500 text-center mb-8">
          เจ้าหน้าที่{company?.name ? `ของ ${company.name}` : ''}จะติดต่อกลับไปยังเบอร์ {formData.phoneNumber} โดยเร็วที่สุด
        </p>
        <button onClick={reset} className="h-12 px-8 bg-slate-900 text-white rounded-full font-bold shadow-lg active:scale-95 transition-all">
          แจ้งซ่อมรายการอื่น
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:items-center md:py-12">
      <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col min-h-screen md:min-h-0">

        <div className="h-24 bg-blue-600 flex flex-col items-center justify-center text-white px-6 shrink-0 relative">
          <ShieldAlert size={28} className="absolute right-6 opacity-20" />
          <h1 className="text-xl font-semibold text-center leading-snug">{company ? company.name || 'แจ้งซ่อมออนไลน์' : <Loader2 size={20} className="animate-spin" />}</h1>
          <p className="text-xs text-blue-100 mt-1">ระบบแจ้งซ่อมออนไลน์{company?.phone ? ` · โทร ${company.phone}` : ''}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col gap-5">
          {/* honeypot: ซ่อนจากคน ใช้กันบอท */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden"
            value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600">เบอร์โทรศัพท์ติดต่อกลับ <span className="text-red-500">*</span></label>
            <input type="tel" inputMode="tel" value={formData.phoneNumber} maxLength={12}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="08X-XXX-XXXX" className={`${inputCls} font-mono`} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600">ชื่อผู้แจ้ง / บริษัท (ถ้ามี)</label>
            <input type="text" value={formData.customerName} maxLength={120}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              placeholder="ชื่อที่ให้เจ้าหน้าที่เรียก" className={inputCls} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600">หมายเลขเครื่อง (S/N) ถ้ามี</label>
            <input type="text" value={formData.serialNumber} maxLength={80}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              placeholder="ดูได้จากสติกเกอร์บนตัวเครื่อง" className={`${inputCls} font-mono uppercase`} />
          </div>

          <div className="space-y-1 flex-1 flex flex-col">
            <label className="text-sm font-semibold text-slate-600">รายละเอียดอาการเสีย <span className="text-red-500">*</span></label>
            <textarea value={formData.symptom} maxLength={2000}
              onChange={(e) => setFormData({ ...formData, symptom: e.target.value })}
              placeholder="อธิบายอาการเบื้องต้นที่พบ..."
              className="w-full flex-1 min-h-[120px] p-4 rounded-xl border border-slate-200 bg-slate-50 text-base leading-[1.9] focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600">แนบรูปภาพ (ถ้ามี)</label>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
            {photo ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="รูปที่แนบ" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhoto(null)} aria-label="ลบรูป"
                  className="absolute top-2 right-2 bg-slate-900/60 text-white rounded-full p-2">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full h-14 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 flex flex-col items-center justify-center hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95">
                <Camera size={20} className="mb-1" />
                <span className="text-xs font-bold">ถ่ายรูปหรือเลือกรูป</span>
              </button>
            )}
          </div>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button type="submit" disabled={loading || !company}
            className="w-full h-14 bg-blue-600 text-white rounded-xl font-black text-lg shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-95 active:shadow-none transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {loading ? 'กำลังส่งข้อมูล...' : 'ส่งแจ้งซ่อม'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CustomerRepairPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 bg-slate-200 rounded-full mb-4"></div><div className="h-4 bg-slate-200 rounded w-24"></div></div></div>}>
      <RepairPortalContent />
    </Suspense>
  );
}
