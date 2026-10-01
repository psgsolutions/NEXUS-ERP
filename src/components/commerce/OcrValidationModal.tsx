"use client";

import React, { useState } from "react";
import { 
  Check, 
  X, 
  FileText, 
  AlertTriangle,
  Cpu,
  Save,
  RefreshCw,
  Search
} from "lucide-react";
import { 
  Modal, 
  PillButton, 
  PillInput, 
  cn 
} from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";

interface OcrValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (validatedData: any) => void;
  pdfUrl?: string;
  ocrData?: any;
}

export function OcrValidationModal({ isOpen, onClose, onConfirm, pdfUrl, ocrData }: OcrValidationModalProps) {
  const [formData, setFormData] = useState({
    poNumber: ocrData?.poNumber || "",
    projectName: ocrData?.projectName || "",
    customerName: ocrData?.customerName || "",
    totalAmount: ocrData?.totalAmount || 0,
    items: ocrData?.items || []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confidence scores simulation from OCR
  const confidence = {
    poNumber: ocrData?.confidence?.poNumber || 95,
    totalAmount: ocrData?.confidence?.totalAmount || 82,
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    // Simulate API delay
    await new Promise(r => setTimeout(r, 800));
    onConfirm(formData);
    setIsSubmitting(false);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ตรวจสอบเอกสารสั่งจ้าง"
      maxWidth="max-w-[1800px]"
    >
      <div className="flex h-[80vh] divide-x divide-white/10 bg-surface-0">
        
        {/* LEFT PANE: PDF Viewer (60%) */}
        <div className="w-[60%] flex flex-col bg-black/40">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <FileText className="text-nexus-blue" size={18} />
              <h4 className="text-[13px] font-medium text-white/80 uppercase tracking-widest">เอกสารต้นฉบับ</h4>
            </div>
            <div className="flex items-center gap-2">
              <PillButton variant="glass" className="h-8 px-4 rounded-md text-[11px]">
                <Search size={14} className="mr-2 inline" /> ซูม
              </PillButton>
            </div>
          </div>
          <div className="flex-1 p-4">
            {pdfUrl ? (
              <iframe 
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                className="w-full h-full rounded-xl border border-white/10 bg-white"
                title="PDF Viewer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl text-white/30">
                <FileText size={48} className="mb-4 opacity-50" />
                <p className="font-semibold tracking-widest uppercase text-[14px]">ไม่พบไฟล์แนบ</p>
                <p className="text-[12px] opacity-60 mt-2">โปรดอัปโหลดไฟล์ PDF เพื่อให้ AI ทำการตรวจสอบ</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: OCR Validation Form (40%) */}
        <div className="w-[40%] flex flex-col bg-surface-1">
          <div className="p-4 border-b border-white/5 bg-nexus-teal/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="text-nexus-teal animate-pulse" size={18} />
              <div>
                <h4 className="text-[13px] font-medium text-nexus-teal uppercase tracking-widest">ข้อมูลที่สกัดโดย AI</h4>
                <p className="text-[10px] text-white/40">โปรดตรวจสอบความถูกต้องก่อนยืนยัน</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Header Data */}
            <div className="space-y-4">
              <h5 className="text-[12px] font-medium text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">ข้อมูลหลัก</h5>
              
              <div className="space-y-3">
                <Field label="เลขที่ใบสั่งจ้าง / PO Number" confidence={confidence.poNumber}>
                  <PillInput 
                    value={formData.poNumber}
                    onChange={(e) => setFormData({...formData, poNumber: e.target.value})}
                    className="w-full h-8 px-3 rounded-md font-mono tracking-tight bg-white/[0.03]"
                  />
                </Field>
                
                <Field label="ชื่อลูกค้า / Customer Name">
                  <PillInput 
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full h-8 px-3 rounded-md font-bold bg-white/[0.03]"
                  />
                </Field>

                <Field label="ชื่อโครงการ / Project Name">
                  <PillInput 
                    value={formData.projectName}
                    onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                    className="w-full h-8 px-3 rounded-md font-bold bg-white/[0.03]"
                  />
                </Field>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h5 className="text-[12px] font-medium text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">รายการสินค้า</h5>
              
              <div className="space-y-3">
                {formData.items.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ชื่อรายการ</label>
                        <PillInput 
                          value={item.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          className="w-full h-8 px-2 rounded-md text-[13px] bg-transparent border-white/10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-24">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest block text-center">จำนวน</label>
                        <NumberStepper 
                          value={item.qty} 
                          unit={item.unit}
                          onChange={(val) => updateItem(idx, "qty", val)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest block text-right">ราคาต่อหน่วย</label>
                        <NumberStepper 
                          value={item.price} 
                          unit="฿"
                          onChange={(val) => updateItem(idx, "price", val)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {formData.items.length === 0 && (
                  <div className="text-center p-4 text-white/30 text-[12px] font-medium tracking-widest uppercase">
                    ไม่พบรายการสินค้า
                  </div>
                )}
              </div>
            </div>

            {/* Total Amount */}
            <div className="pt-6 border-t border-white/5">
              <Field label="ยอดรวมทั้งสิ้น" confidence={confidence.totalAmount}>
                <div className="flex items-center gap-3">
                  <PillInput 
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({...formData, totalAmount: parseFloat(e.target.value) || 0})}
                    className="flex-1 h-10 px-4 rounded-md font-mono tracking-tight text-xl text-nexus-teal font-black bg-white/[0.02]"
                  />
                  <span className="text-white/40 font-semibold tracking-widest">THB</span>
                </div>
              </Field>
            </div>
            
          </div>

          {/* Action Footer */}
          <div className="p-6 border-t border-white/5 space-y-3 bg-surface-0">
            <PillButton 
              className="w-full h-10 rounded-full shadow-neon-teal bg-nexus-teal uppercase tracking-[0.2em] font-black flex items-center justify-center gap-2"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
              ยืนยันความถูกต้อง & สร้าง SO
            </PillButton>
            <PillButton 
              variant="glass" 
              className="w-full h-10 rounded-full hover:text-danger uppercase tracking-widest"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X size={16} className="mr-2 inline" /> ยกเลิกรายการ
            </PillButton>
          </div>
        </div>

      </div>
    </Modal>
  );
}

function Field({ label, confidence, children }: { label: string, confidence?: number, children: React.ReactNode }) {
  const showWarning = confidence !== undefined && confidence < 90;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between ml-1">
        <label className="text-[11px] font-medium text-white/60 uppercase tracking-widest flex items-center gap-1">
          {label}
        </label>
        {confidence !== undefined && (
          <span className={cn(
            "text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded-sm flex items-center gap-1",
            showWarning ? "bg-warning/20 text-warning" : "bg-nexus-teal/20 text-nexus-teal"
          )}>
            {showWarning && <AlertTriangle size={10} />}
            {confidence}% Match
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
