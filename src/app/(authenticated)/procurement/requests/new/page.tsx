"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  ShieldCheck, 
  AlertTriangle,
  ArrowLeft,
  FileText,
  CheckCircle2,
  UploadCloud,
  FileUp,
  Trash2
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  PillTabs, 
  NexusDataField, 
  GlassCard, 
  cn, 
  NexusDatePicker 
} from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { SmartSelect } from "@/components/ui/SmartComponents";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

const vendorOptions = [
  { value: "VD-001", label: "บริษัท อุปกรณ์ไอที จำกัด (มหาชน)", description: "Tax: 0105559012345" },
  { value: "VD-002", label: "หจก. รับเหมาเครือข่ายไทย", description: "Tax: 0103550012346" }
];

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-bold text-white/60 flex items-center gap-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("header");
  const [docState, setDocState] = useState("draft");
  const [items, setItems] = useState<any[]>([]);
  
  const [header, setHeader] = useState({
    requester: "Kriangkrai M.",
    department: "Engineering",
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: "",
    priority: "medium",
    projectRef: "",
    reason: ""
  });

  // Tax & WHT Settings
  const [vatMode, setVatMode] = useState<"exclude" | "include" | "none">("exclude");
  const [whtRate, setWhtRate] = useState<number>(0);

  // Vendor Auto-Inference
  const [vendorId, setVendorId] = useState("");
  const [vendorData, setVendorData] = useState<any>(null);

  // File Attachments Vault
  const [attachments, setAttachments] = useState<{name: string, size: string}[]>([]);

  useEffect(() => {
    // 0-Click Auto-Inference Pipeline Mockup
    if (vendorId === "VD-001") {
      setVendorData({ address: "123 ถ.สุขุมวิท กรุงเทพฯ", taxId: "0105559012345", creditTerms: "30 Days", contact: "คุณสมชาย" });
    } else if (vendorId === "VD-002") {
      setVendorData({ address: "456 ถ.รัชดาฯ กรุงเทพฯ", taxId: "0103550012346", creditTerms: "15 Days", contact: "คุณวิเชียร" });
    } else {
      setVendorData(null);
    }
  }, [vendorId]);

  const tabs = [
    { id: "header", label: "ข้อมูลพื้นฐานการขอซื้อ" },
    { id: "items", label: "รายการพัสดุและบริการ" }
  ];

  const handleBack = async () => {
    const isDirty = items.length > 0 || header.requiredDate !== "" || header.reason !== "";
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (items.length === 0) return void showAlert("กรุณาเพิ่มรายการที่ต้องการขอซื้อ");
    showAlert("ส่งขออนุมัติซื้อเรียบร้อยแล้ว");
    router.push("/procurement");
  };

  // Calculation Engine
  const totalAmount = items.reduce((acc, i) => acc + ((i.qty || 0) * (i.price || 0)), 0);
  const discountTotal = items.reduce((acc, i) => {
    const rawDisc = typeof i.discount === "string" ? i.discount : (i.discount || 0).toString();
    let d = 0;
    if (rawDisc.endsWith("%")) {
      d = ((i.qty || 0) * (i.price || 0)) * (parseFloat(rawDisc) / 100);
    } else {
      d = parseFloat(rawDisc);
    }
    return acc + (isNaN(d) ? 0 : d);
  }, 0);
  
  const subtotal = totalAmount - discountTotal;
  let vatAmount = 0;
  let preVat = subtotal;

  if (vatMode === "exclude") {
    vatAmount = subtotal * 0.07;
  } else if (vatMode === "include") {
    preVat = subtotal / 1.07;
    vatAmount = subtotal - preVat;
  }
  
  const whtAmount = preVat * (whtRate / 100);
  const grandTotal = (vatMode === "include" ? subtotal : subtotal + vatAmount) - whtAmount;

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">PROCURE V7.5</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">บันทึกใบขอซื้อ (New Purchase Request)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Approved", "Executing", "Completed"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillTabs 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton className="h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-2" /> ส่งขออนุมัติซื้อ
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-6">
      {activeTab === "header" && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-10">
          {/* User & Request Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="ผู้ยื่นคำขอซื้อ">
              <PillInput value={header.requester} disabled className="w-full bg-white/[0.01] text-white/40 h-11 rounded-full px-6 text-[13px] font-bold border-white/5 cursor-not-allowed" />
            </Field>
            <Field label="หน่วยงาน / แผนก">
              <PillSelect 
                value={header.department}
                onChange={(e) => setHeader({...header, department: e.target.value})}
                className="w-full px-6 h-11 rounded-full text-[13px] font-bold"
              >
                <option>Engineering</option>
                <option>Sales & Marketing</option>
                <option>HR & Admin</option>
                <option>Finance</option>
              </PillSelect>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Field label="วันที่ยื่นคำขอ">
              <NexusDatePicker value={header.requestDate} disabled className="w-full opacity-50 h-11 rounded-full px-6 text-[13px] font-bold border-white/5" />
            </Field>
            <Field label="วันที่ต้องการใช้งาน *" required>
              <NexusDatePicker value={header.requiredDate}
                onChange={(e) => setHeader({...header, requiredDate: e.target.value})}
                className="w-full text-cyan-400 h-11 rounded-full px-6 text-[13px] font-bold bg-white/[0.02]" 
              />
            </Field>
            <Field label="ลำดับความสำคัญ">
              <PillSelect 
                value={header.priority}
                onChange={(e) => setHeader({...header, priority: e.target.value})}
                className={cn(
                  "w-full px-6 h-11 rounded-full text-[13px] font-black",
                  header.priority === "urgent" ? "text-danger" : "text-cyan-400"
                )}
              >
                    <option value="low">LOW (ทั่วไป)</option>
                    <option value="medium">MEDIUM (ปกติ)</option>
                    <option value="high">HIGH (ด่วน)</option>
                    <option value="urgent">URGENT (ด่วนที่สุด)</option>
              </PillSelect>
            </Field>
          </div>

          {/* 2. Auto-Inference Pipeline (0-Click Data) */}
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-4"><UploadCloud size={16} /> แนะนำผู้จำหน่าย (Suggested Vendor)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="ชื่อผู้จำหน่าย / คู่ค้า">
                <SmartSelect 
                  options={vendorOptions} 
                  value={vendorId} 
                  onChange={setVendorId} 
                  placeholder="ค้นหาผู้จำหน่าย..."
                  className="h-11 rounded-full text-[13px] font-bold px-4"
                />
              </Field>
              
              {/* Auto-filled fields */}
              {vendorData && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                  <Field label="เลขประจำตัวผู้เสียภาษี">
                    <PillInput value={vendorData.taxId} disabled className="w-full bg-white/[0.02] h-11 rounded-full px-6 text-[13px] font-mono font-bold text-white/60" />
                  </Field>
                  <Field label="เครดิตเทอม">
                    <PillInput value={vendorData.creditTerms} disabled className="w-full bg-white/[0.02] h-11 rounded-full px-6 text-[13px] font-bold text-cyan-400" />
                  </Field>
                </div>
              )}
            </div>
            {vendorData && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <Field label="ที่อยู่ / ข้อมูลติดต่อ">
                    <PillInput value={`${vendorData.address} (ติดต่อ: ${vendorData.contact})`} disabled className="w-full bg-white/[0.02] h-11 rounded-full px-6 text-[13px] font-bold text-white/60" />
                </Field>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Field label="โครงการที่อ้างอิง">
              <PillInput 
                value={header.projectRef}
                onChange={(e) => setHeader({...header, projectRef: e.target.value})}
                placeholder="เช่น PRJ-26-001 (ถ้ามี)..." 
                className="w-full h-11 rounded-full px-6 text-[13px] font-bold bg-white/[0.02]" 
              />
            </Field>
            <Field label="วัตถุประสงค์ / ความจำเป็น *" required>
              <textarea 
                className="w-full h-32 rounded-3xl bg-white/[0.02] border border-white/5 text-white text-[13px] font-bold p-6 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar placeholder:text-white/20"
                value={header.reason}
                onChange={(e) => setHeader({...header, reason: e.target.value})}
                placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..."
              />
            </Field>
          </div>

          {/* 3. Multi-Attachment Vault */}
          <div className="space-y-4 pt-6">
            <h4 className="text-[12px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <FileUp size={16} /> คลังเอกสารแนบอ้างอิง (Attachments)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                className="border border-dashed border-white/10 hover:border-cyan-400/50 bg-white/[0.01] hover:bg-cyan-400/5 rounded-3xl h-28 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                onClick={() => setAttachments([...attachments, { name: `Quotation_Vendor_${attachments.length + 1}.pdf`, size: "1.2 MB" }])}
              >
                <UploadCloud size={24} className="text-white/30" />
                <span className="text-[11px] text-white/40 font-bold uppercase tracking-widest">ลากไฟล์วางที่นี่ หรือคลิกเพื่ออัปโหลด</span>
              </div>
              <div className="space-y-2 max-h-28 overflow-y-auto custom-scrollbar pr-2">
                {attachments.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px] text-white/20 font-bold uppercase tracking-widest">ยังไม่มีไฟล์แนบ</div>
                ) : (
                  attachments.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 px-4 rounded-2xl group hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={16} className="text-cyan-400 shrink-0" />
                        <span className="text-[12px] text-white/80 font-bold truncate">{file.name}</span>
                        <span className="text-[10px] text-white/40 font-mono shrink-0">{file.size}</span>
                      </div>
                      <button 
                        className="text-white/20 hover:text-danger shrink-0 transition-colors"
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "items" && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
          <DocumentItemsTable 
            items={items}
            onChange={setItems}
          />
        </div>
      )}
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-8 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
          สรุปรายการคำขอซื้อ
        </h5>
      </div>

      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
        <div className="space-y-5">
          <NexusDataField label="เลขที่ PR" value="PR-WAIT-GEN" />
          <NexusDataField label="ผู้อนุมัติลำดับที่ 1" value="Department Manager" />
        </div>
      </div>

      {/* 4. Tax & WHT Engine Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-bold text-white/60">รูปแบบภาษีมูลค่าเพิ่ม</label>
          <PillSelect 
            value={vatMode} 
            onChange={(e) => setVatMode(e.target.value as any)}
            className="w-32 h-8 text-[12px] bg-white/[0.02] border-white/10"
          >
            <option value="exclude">แยก VAT</option>
            <option value="include">รวม VAT</option>
            <option value="none">ไม่มี VAT</option>
          </PillSelect>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-bold text-white/60">หัก ณ ที่จ่าย (WHT)</label>
          <PillSelect 
            value={whtRate.toString()} 
            onChange={(e) => setWhtRate(Number(e.target.value))}
            className="w-32 h-8 text-[12px] bg-white/[0.02] border-white/10"
          >
            <option value="0">ไม่หัก WHT</option>
            <option value="1">หัก 1%</option>
            <option value="3">หัก 3%</option>
            <option value="5">หัก 5%</option>
          </PillSelect>
        </div>
      </div>

      <div className="bg-black/40 p-6 rounded-2xl border border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-[13px]">รวมเป็นเงิน (Subtotal)</span>
          <span className="text-white font-mono text-[14px]">฿{subtotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        
        {discountTotal > 0 && (
          <div className="flex justify-between items-center text-cyan-400">
            <span className="text-cyan-400/80 text-[13px]">หักส่วนลด (Discount)</span>
            <span className="font-mono text-[14px]">-฿{discountTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
          </div>
        )}

        {vatMode !== "none" && (
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-[13px]">ภาษีมูลค่าเพิ่ม 7%</span>
            <span className="text-white font-mono text-[14px]">฿{vatAmount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
          </div>
        )}

        {whtRate > 0 && (
          <div className="flex justify-between items-center text-orange-400">
            <span className="text-orange-400/80 text-[13px]">ยอดหัก ณ ที่จ่าย</span>
            <span className="font-mono text-[14px]">-฿{whtAmount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-end">
          <span className="text-white/80 text-[14px]">ยอดรวมสุทธิ (Grand Total)</span>
          <span className="text-cyan-400 font-mono text-2xl font-black">฿{grandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
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
