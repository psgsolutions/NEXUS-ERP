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
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";

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
  const { user, companyId } = useAuth();

  // ข้อมูลจริงของบริษัท
  const { data: suppliers } = useRealtimeCollection<any>("suppliers");
  const { data: projects } = useRealtimeCollection<any>(`companies/${companyId}/projects`);
  const vendorOptions = suppliers.map((sp: any) => ({
    value: sp.id,
    label: sp.name || sp.supplierName || sp.id,
    description: sp.taxId ? `Tax: ${sp.taxId}` : "",
  }));
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState("header");
  const [docState, setDocState] = useState("draft");
  const [items, setItems] = useState<any[]>([]);
  
  const [header, setHeader] = useState({
    requester: "",
    department: "",
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

  // ผู้ยื่นคำขอ = ผู้ใช้ที่ล็อกอิน
  useEffect(() => {
    if (user) setHeader((prev) => ({ ...prev, requester: prev.requester || user.displayName || user.email || "" }));
  }, [user]);

  // ข้อมูลผู้จำหน่ายจากฐานข้อมูลจริง
  useEffect(() => {
    const sp = suppliers.find((x: any) => x.id === vendorId);
    setVendorData(sp ? {
      address: typeof sp.address === "string" ? sp.address : [sp.address?.line1, sp.address?.province].filter(Boolean).join(" "),
      taxId: sp.taxId || "-",
      creditTerms: sp.creditTerms || sp.paymentTerms || "-",
      contact: sp.contactName || sp.contactPerson || "-",
    } : null);
  }, [vendorId, suppliers]);

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

  const handleSave = async () => {
    const lines = items.filter((it: any) => it.itemType !== "GROUP_HEADER" && (Number(it.qty) || 0) > 0);
    if (lines.length === 0) return void showAlert("กรุณาเพิ่มรายการที่ต้องการขอซื้อ");
    if (!header.requiredDate) return void showAlert("กรุณาระบุวันที่ต้องการใช้งาน");
    if (!header.reason.trim()) return void showAlert("กรุณาระบุวัตถุประสงค์ / ความจำเป็น");
    if (!companyId || !user) return void showAlert("ไม่พบข้อมูลผู้ใช้หรือรหัสบริษัท กรุณาเข้าสู่ระบบใหม่");

    setSaving(true);
    try {
      const vendor = suppliers.find((x: any) => x.id === vendorId);
      const project = projects.find((x: any) => x.id === header.projectRef);
      // บันทึกที่ server: เลข PR ไม่ข้าม และคำนวณยอดซ้ำจากรายการ
      const res = await apiFetch("/api/procurement/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, action: "create", items: lines,
          header: {
            requester: header.requester, department: header.department, requestDate: header.requestDate, requiredDate: header.requiredDate,
            priority: header.priority, projectId: header.projectRef || "",
            projectName: project ? (project.title || project.name || project.projectId || "") : "",
            reason: header.reason, suggestedSupplierId: vendorId || "",
            suggestedSupplierName: vendor ? (vendor.name || vendor.supplierName || "") : "", vatMode, whtRate,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      const prCode = data.prCode;
      showAlert(`ส่งขออนุมัติซื้อเรียบร้อยแล้ว (${prCode})`);
      router.push("/procurement");
    } catch (err: any) {
      console.error("[PR_SAVE_ERROR]", err);
      showAlert(`บันทึกใบขอซื้อไม่สำเร็จ: ${err.message}`);
    } finally {
      setSaving(false);
    }
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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              บันทึกใบขอซื้อสินค้า
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              PR-NEW
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            สร้างคำขอซื้อพัสดุ อุปกรณ์ และบริการเพื่อเสนอขออนุมัติจัดซื้อ
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillTabs 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={handleSave} disabled={saving}>
          <ShieldCheck size={14} className="mr-1.5" /> ส่งขออนุมัติซื้อ
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-7">
      {activeTab === "header" && (
        <GlassCard accentColor="teal" className="p-6 space-y-10">
          {/* User & Request Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="ผู้ยื่นคำขอซื้อ">
              <PillInput value={header.requester} disabled className="w-full bg-white/[0.01] text-white/40 h-11 rounded-full px-6 text-[13px] font-bold border-white/5 cursor-not-allowed" />
            </Field>
            <Field label="หน่วยงาน / แผนก">
              <PillInput
                value={header.department}
                onChange={(e) => setHeader({...header, department: e.target.value})}
                placeholder="ระบุแผนก เช่น ฝ่ายวิศวกรรม"
                className="w-full px-6 h-11 rounded-full text-[13px] font-bold"
              />
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
              <PillSelect
                value={header.projectRef}
                onChange={(e) => setHeader({...header, projectRef: e.target.value})}
                className="w-full h-11 rounded-full px-6 text-[13px] font-bold bg-white/[0.02]"
              >
                <option value="">{projects.length === 0 ? "ยังไม่มีโครงการ" : "ไม่ระบุโครงการ"}</option>
                {projects.map((pj: any) => (
                  <option key={pj.id} value={pj.id}>{pj.projectId || pj.id} - {pj.title || pj.name || pj.projectName || "-"}</option>
                ))}
              </PillSelect>
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

          {/* 3. Attachments: ยังไม่มี Firebase Storage จึงยังแนบไฟล์จริงไม่ได้ */}
          <div className="space-y-2 pt-6">
            <h4 className="text-[12px] font-semibold text-white/60 uppercase tracking-widest flex items-center gap-2">
              <FileUp size={16} /> คลังเอกสารแนบอ้างอิง (Attachments)
            </h4>
            <div className="border border-dashed border-white/10 bg-white/[0.01] rounded-3xl h-20 flex items-center justify-center text-[12px] text-white/40 font-bold">
              ยังไม่รองรับการแนบไฟล์ (รอตั้งค่าพื้นที่เก็บไฟล์ Firebase Storage)
            </div>
          </div>
        </GlassCard>
      )}

      {activeTab === "items" && (
        <GlassCard accentColor="blue" className="p-6 space-y-6">
          <DocumentItemsTable 
            items={items}
            onChange={setItems}
          />
        </GlassCard>
      )}
    </div>
  );

  const rightSidebar = (
    <GlassCard accentColor="purple" className="p-5 space-y-8 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2">
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
    </GlassCard>
  );

  return (
    <NexusPageLayout 
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}
