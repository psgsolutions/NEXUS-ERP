"use client";

import React, { useState } from 'react';
import { PillInput, PillButton, cn } from '@/components/ui/Base';
import { Save, Scan, Building2, MapPin, Phone, Cpu, UploadCloud, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useSystemDialog } from '@/context/DialogContext';
import NexusPageLayout from '@/components/layout/NexusPageLayout';
import { DocumentStepper } from '@/components/ui/DocumentStepper';

function convertThaiNumeralsToArabic(text: string): string {
  if (!text) return '';
  const thaiNumerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return text.split('').map(char => {
    const index = thaiNumerals.indexOf(char);
    return index !== -1 ? index.toString() : char;
  }).join('');
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1">
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

export default function CustomerDataEntryPage() {
  const { user, companyId } = useAuth();
  const router = useRouter();
  const { showAlert } = useSystemDialog();
  const currentCompanyId = companyId || 'COMP-001';

  const [formData, setFormData] = useState({
    customerName: '',
    taxId: '',
    branchCode: '00000',
    addressNo: '',
    building: '',
    soi: '',
    road: '',
    subDistrict: '',
    district: '',
    province: '',
    zipCode: '',
    phoneNumber: '',
    email: ''
  });

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mock AI OCR Function
  const extractDataFromImage = async () => {
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        resolve({
          customerName: "บริษัท เน็กซัส เอนเตอร์ไพรส์ จำกัด",
          taxId: "๐๑๒๓๔๕๖๗๘๙๐๑๒", // Contains Thai Numerals
          branchCode: "๐๐๐๐๐", // Contains Thai Numerals
          addressNo: "๙๙/๙", // Contains Thai Numerals
          building: "อาคาร ไซเบอร์เทค",
          soi: "พัฒนาการ ๒", // Contains Thai Numerals
          road: "เพชรบุรีตัดใหม่",
          subDistrict: "บางกะปิ",
          district: "ห้วยขวาง",
          province: "กรุงเทพมหานคร",
          zipCode: "๑๐๓๑๐", // Contains Thai Numerals
          phoneNumber: "๐๒-๑๒๓-๔๕๖๗", // Contains Thai Numerals
          email: "contact@nexus.co.th"
        });
      }, 2000);
    });
  };

  const handleScanAI = async () => {
    setIsScanning(true);
    try {
      const rawAiData = await extractDataFromImage();
      
      // Sanitization Middleware: Convert Thai Numerals
      const sanitizedData = {
        customerName: convertThaiNumeralsToArabic(rawAiData.customerName),
        taxId: convertThaiNumeralsToArabic(rawAiData.taxId),
        branchCode: convertThaiNumeralsToArabic(rawAiData.branchCode),
        addressNo: convertThaiNumeralsToArabic(rawAiData.addressNo),
        building: convertThaiNumeralsToArabic(rawAiData.building),
        soi: convertThaiNumeralsToArabic(rawAiData.soi),
        road: convertThaiNumeralsToArabic(rawAiData.road),
        subDistrict: convertThaiNumeralsToArabic(rawAiData.subDistrict),
        district: convertThaiNumeralsToArabic(rawAiData.district),
        province: convertThaiNumeralsToArabic(rawAiData.province),
        zipCode: convertThaiNumeralsToArabic(rawAiData.zipCode),
        phoneNumber: convertThaiNumeralsToArabic(rawAiData.phoneNumber),
        email: convertThaiNumeralsToArabic(rawAiData.email)
      };

      setFormData(sanitizedData);
      showAlert('AI ดึงข้อมูลและแปลงเลขไทยเป็นอารบิกเรียบร้อยแล้ว', 'OCR สำเร็จ', 'info');
    } catch (error) {
      showAlert('ไม่สามารถอ่านภาพได้', 'ข้อผิดพลาด', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!formData.customerName || !formData.taxId) {
      showAlert('กรุณาระบุชื่อลูกค้า และเลขประจำตัวผู้เสียภาษี', 'ข้อมูลไม่ครบ', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await addDoc(collection(db, `companies/${currentCompanyId}/customers`), {
        ...formData,
        name: formData.customerName, // alias for standard listing
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'SYSTEM',
        status: 'ACTIVE'
      });
      
      showAlert('เพิ่มลูกค้าเข้าสู่ระบบเรียบร้อย', 'บันทึกข้อมูลสำเร็จ', 'info');
      router.push('/customers');
    } catch (error) {
      console.error(error);
      showAlert('ไม่สามารถบันทึกข้อมูลได้', 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">CRM_PROT_V3.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">ทะเบียนลูกค้าใหม่ (New Customer)</h1>
            <DocumentStepper steps={["Draft", "Active"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={() => router.back()}>
          ยกเลิก
        </PillButton>
        <PillButton 
          className="h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" 
          onClick={handleSave} 
          disabled={isSaving}
        >
          <Save size={14} className="mr-2" /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-6">
      {/* AI Scanner Hero Area */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          <Cpu className="text-cyan-400 w-12 h-12 mb-2 animate-pulse" />
          <div className="text-center">
            <h2 className="text-xl font-black text-white tracking-widest mb-1">Enterprise AI OCR</h2>
            <p className="text-sm text-white/60 mb-4">อัปโหลดหนังสือรับรองบริษัท, ภ.พ.20 หรือนามบัตร เพื่อสกัดข้อมูลและแปลงเลขไทยอัตโนมัติ</p>
          </div>
          <button 
            onClick={handleScanAI}
            disabled={isScanning}
            className="h-12 px-8 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:bg-cyan-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? (
              <><UploadCloud size={20} className="animate-bounce" /> กำลังประมวลผล AI...</>
            ) : (
              <><Scan size={20} /> สแกนเอกสารด้วย AI (Auto-Fill)</>
            )}
          </button>
        </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-10">
        <div>
          <h3 className="text-[14px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
            <Building2 size={18} className="text-cyan-400" /> ข้อมูลนิติบุคคล
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="ชื่อลูกค้า/บริษัท * (Customer Name)" required>
              <PillInput 
                value={formData.customerName}
                onChange={e => setFormData({...formData, customerName: e.target.value})}
                className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                placeholder="ระบุชื่อบริษัท"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="เลขประจำตัวผู้เสียภาษี * (Tax ID)" required>
                <PillInput 
                  value={formData.taxId}
                  onChange={e => setFormData({...formData, taxId: e.target.value})}
                  maxLength={13}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-mono font-bold"
                  placeholder="13 หลัก"
                />
              </Field>
              <Field label="รหัสสาขา (Branch Code)">
                <PillInput 
                  value={formData.branchCode}
                  onChange={e => setFormData({...formData, branchCode: e.target.value})}
                  maxLength={5}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-mono font-bold"
                  placeholder="00000"
                />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[14px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
            <Phone size={18} className="text-cyan-400" /> ข้อมูลการติดต่อ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="เบอร์โทรศัพท์ (Phone Number)">
              <PillInput 
                value={formData.phoneNumber}
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-mono font-bold"
                placeholder="02-XXX-XXXX"
              />
            </Field>
            <Field label="อีเมล (Email)">
              <PillInput 
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                placeholder="example@domain.com"
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-[14px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
            <MapPin size={18} className="text-cyan-400" /> ข้อมูลที่อยู่
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Field label="บ้านเลขที่ (No.)">
                <PillInput 
                  value={formData.addressNo}
                  onChange={e => setFormData({...formData, addressNo: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-mono font-bold"
                  placeholder="99/9"
                />
              </Field>
              <Field label="อาคาร/หมู่บ้าน (Building)">
                <PillInput 
                  value={formData.building}
                  onChange={e => setFormData({...formData, building: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                />
              </Field>
              <Field label="ซอย (Soi)">
                <PillInput 
                  value={formData.soi}
                  onChange={e => setFormData({...formData, soi: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                />
              </Field>
              <Field label="ถนน (Road)">
                <PillInput 
                  value={formData.road}
                  onChange={e => setFormData({...formData, road: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                />
              </Field>

              <Field label="ตำบล/แขวง (Sub-district)">
                <PillInput 
                  value={formData.subDistrict}
                  onChange={e => setFormData({...formData, subDistrict: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                />
              </Field>
              <Field label="อำเภอ/เขต (District)">
                <PillInput 
                  value={formData.district}
                  onChange={e => setFormData({...formData, district: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                />
              </Field>
              <Field label="จังหวัด (Province)">
                <PillInput 
                  value={formData.province}
                  onChange={e => setFormData({...formData, province: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-bold"
                />
              </Field>
              <Field label="รหัสไปรษณีย์ (Zipcode)">
                <PillInput 
                  value={formData.zipCode}
                  onChange={e => setFormData({...formData, zipCode: e.target.value})}
                  className="w-full h-11 px-6 rounded-full bg-white/[0.02] font-mono font-bold"
                  placeholder="10000"
                />
              </Field>
          </div>
        </div>
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
          สรุปข้อมูลลูกค้า (Customer Info)
        </h5>
      </div>
      <div className="space-y-4">
         <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-[11px] text-white/60">ชื่อลูกค้า:</span>
            <span className="text-[12px] font-bold text-white/80 truncate max-w-[120px]">{formData.customerName || "-"}</span>
         </div>
         <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-[11px] text-white/60">Tax ID:</span>
            <span className="text-[12px] font-mono font-bold text-white/80">{formData.taxId || "-"}</span>
         </div>
      </div>
      <div className="space-y-4 pt-2">
        <PillButton 
          className="w-full h-11 rounded-full font-black uppercase tracking-widest shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[12px]" 
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save size={16} className="mr-2" />
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลลูกค้า'}
        </PillButton>
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
