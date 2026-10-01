"use client";

import React, { useState } from "react";
import { 
  Building2, 
  FileCheck, 
  ShieldCheck, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  CheckSquare,
  Wrench,
  Headphones
} from "lucide-react";
import { PillButton, PillInput, PillSelect, GlassCard, cn } from "@/components/ui/Base";
import { PrivateProjectDetails } from "@/types/database";

interface PrivateCommercialTabProps {
  details?: PrivateProjectDetails;
  onSave?: (updatedDetails: PrivateProjectDetails) => void;
  isReadOnly?: boolean;
}

export function PrivateCommercialTab({
  details,
  onSave,
  isReadOnly = false
}: PrivateCommercialTabProps) {
  const [pvtData, setPvtData] = useState<PrivateProjectDetails>(() => ({
    quotationNumber: details?.quotationNumber || "",
    customerPO: details?.customerPO || "",
    paymentTerms: details?.paymentTerms || "มัดจำ 30%, ชำระงวดสุดท้าย 70% หลังส่งมอบ",
    slaDetails: details?.slaDetails || "Response Time ภายใน 4 ชม. Resolution ภายใน 24 ชม.",
    uatSignOff: {
      signOffDate: details?.uatSignOff?.signOffDate || "",
      clientSignerName: details?.uatSignOff?.clientSignerName || "",
      isCompleted: details?.uatSignOff?.isCompleted || false,
      docUrl: details?.uatSignOff?.docUrl || ""
    },
    afterSalesLogs: details?.afterSalesLogs || [
      { id: "LOG-01", logId: "SRV-2026-001", serviceDate: "2026-09-10", issueDescription: "ตรวจสอบสัญญาณภาพตกหล่น บนจอ LED Wall", resolution: "ปรับแต่งสายสัญญาณ HDMI Direct Pass-through", status: "Resolved" }
    ]
  }));

  const [activeSubTab, setActiveSubTab] = useState<"commercial" | "uat" | "service">("commercial");
  const [toastMsg, setToastMsg] = useState("");

  const handleSave = () => {
    if (onSave) {
      onSave(pvtData);
    }
    setToastMsg("บันทึกข้อมูลสัญญาพาณิชย์และ UAT ภาคเอกชนเรียบร้อยแล้ว");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleAddServiceLog = () => {
    setPvtData(prev => ({
      ...prev,
      afterSalesLogs: [
        ...(prev.afterSalesLogs || []),
        { id: `LOG-${Date.now()}`, logId: `SRV-${Date.now()}`, serviceDate: new Date().toISOString().split("T")[0], issueDescription: "ระบุรายการแจ้งซ่อมหรือบำรุงรักษา...", resolution: "การแก้ไขปัญหา...", status: "In Progress" }
      ]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Sub Navigation Bar & Top Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.02] border border-white/10 p-2.5 rounded-full backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "commercial", label: "1. ข้อตกลงการค้า & PO", icon: FileSpreadsheet },
            { id: "uat", label: "2. การตรวจรับงาน (UAT Sign-off)", icon: CheckSquare },
            { id: "service", label: "3. บริการหลังการขาย & Maintenance Log", icon: Headphones }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "h-8 px-4 rounded-full text-[12px] font-bold transition-all flex items-center gap-2 uppercase tracking-wider",
                  isActive 
                    ? "bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 shadow-neon-blue font-bold" 
                    : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                )}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {!isReadOnly && (
          <PillButton variant="confirm" onClick={handleSave} className="h-8 px-5 flex items-center gap-1.5">
            <Save size={14} /> บันทึกข้อมูลเอกชน
          </PillButton>
        )}
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-nexus-blue/10 border border-nexus-blue/30 text-nexus-blue text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} /> {toastMsg}
        </div>
      )}

      {/* TAB 1: ข้อตกลงการค้า & PO */}
      {activeSubTab === "commercial" && (
        <GlassCard accentColor="blue" className="p-6 space-y-6">
          <div className="flex items-center gap-3 bg-white/[0.04] border-b border-white/10 px-6 py-4 -mx-6 -mt-6 rounded-t-3xl text-nexus-blue mb-6">
            <div className="w-8 h-8 rounded-xl bg-nexus-blue/20 border border-nexus-blue/40 flex items-center justify-center text-nexus-blue font-mono font-bold text-sm shadow-[0_0_10px_rgba(0,102,255,0.2)]">
              01
            </div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">หมวดสัญญาการค้า ใบเสนอราคา และ Purchase Order</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">เลขที่ใบเสนอราคาอ้างอิง (Quotation Ref)</label>
              <PillInput 
                value={pvtData.quotationNumber} 
                onChange={e => setPvtData(prev => ({ ...prev, quotationNumber: e.target.value }))}
                placeholder="เช่น QU-2026-9912" 
                className="w-full h-9 font-bold text-nexus-teal"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">เลขที่ PO ลูกค้า (Purchase Order)</label>
              <PillInput 
                value={pvtData.customerPO} 
                onChange={e => setPvtData(prev => ({ ...prev, customerPO: e.target.value }))}
                placeholder="เช่น PO-CUS-88129" 
                className="w-full h-9 font-bold text-warning"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">เงื่อนไขการชำระเงินและเงินมัดจำ (Payment Terms)</label>
              <PillInput 
                value={pvtData.paymentTerms} 
                onChange={e => setPvtData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                placeholder="ระบุเงื่อนไขการแบ่งงวดชำระเงิน..." 
                className="w-full h-9"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">ข้อตกลงระดับการให้บริการ (SLA Conditions)</label>
              <PillInput 
                value={pvtData.slaDetails} 
                onChange={e => setPvtData(prev => ({ ...prev, slaDetails: e.target.value }))}
                placeholder="ระบุ Response Time / Resolution Time ที่ตกลงกับลูกค้า..." 
                className="w-full h-9 text-xs"
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* TAB 2: การตรวจรับงาน (UAT Sign-off) */}
      {activeSubTab === "uat" && (
        <GlassCard accentColor="teal" className="p-6 space-y-6">
          <div className="flex items-center gap-3 bg-white/[0.04] border-b border-white/10 px-6 py-4 -mx-6 -mt-6 rounded-t-3xl text-nexus-teal mb-6">
            <div className="w-8 h-8 rounded-xl bg-nexus-teal/20 border border-nexus-teal/40 flex items-center justify-center text-nexus-teal font-mono font-bold text-sm shadow-[0_0_10px_rgba(0,255,209,0.2)]">
              02
            </div>
            <div className="flex items-center gap-2">
              <CheckSquare size={18} />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">การตรวจรับงานระบบ (User Acceptance Testing - UAT)</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">สถานะการตรวจรับ UAT</label>
              <div className="flex items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => setPvtData(prev => ({ ...prev, uatSignOff: { ...prev.uatSignOff, isCompleted: true } }))}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                    pvtData.uatSignOff?.isCompleted 
                      ? "bg-nexus-teal/20 text-nexus-teal border-nexus-teal" 
                      : "bg-white/5 text-white/40 border-white/10"
                  )}
                >
                  ✓ ลูกค้าลงนามตรวจรับเรียบร้อย (UAT Completed)
                </button>
                <button
                  type="button"
                  onClick={() => setPvtData(prev => ({ ...prev, uatSignOff: { ...prev.uatSignOff, isCompleted: false } }))}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                    !pvtData.uatSignOff?.isCompleted 
                      ? "bg-warning/20 text-warning border-warning" 
                      : "bg-white/5 text-white/40 border-white/10"
                  )}
                >
                  ⏳ อยู่ระหว่างการทดสอบระบบ (Pending UAT)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">ชื่อผู้ลงนามตรวจรับฝั่งลูกค้า</label>
              <PillInput 
                value={pvtData.uatSignOff?.clientSignerName} 
                onChange={e => setPvtData(prev => ({ ...prev, uatSignOff: { ...prev.uatSignOff, clientSignerName: e.target.value } }))}
                placeholder="เช่น คุณอนันต์ (IT Manager)" 
                className="w-full h-9 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">วันที่ลูกค้าลงนามตรวจรับ</label>
              <PillInput 
                type="date"
                value={pvtData.uatSignOff?.signOffDate} 
                onChange={e => setPvtData(prev => ({ ...prev, uatSignOff: { ...prev.uatSignOff, signOffDate: e.target.value } }))}
                className="w-full h-9 text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">ลิงก์แนบเอกสาร UAT Sign-off (PDF)</label>
              <PillInput 
                value={pvtData.uatSignOff?.docUrl} 
                onChange={e => setPvtData(prev => ({ ...prev, uatSignOff: { ...prev.uatSignOff, docUrl: e.target.value } }))}
                placeholder="https://drive.google.com/..." 
                className="w-full h-9"
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* TAB 3: บริการหลังการขาย & Maintenance Log */}
      {activeSubTab === "service" && (
        <GlassCard accentColor="amber" className="p-6 space-y-6">
          <div className="flex items-center justify-between bg-white/[0.04] border-b border-white/10 px-6 py-4 -mx-6 -mt-6 rounded-t-3xl mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono font-bold text-sm shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                03
              </div>
              <div className="flex items-center gap-2 text-warning">
                <Headphones size={18} />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">ประวัติการดูแลหลังการขาย (After-sales Service & Maintenance Logs)</h3>
              </div>
            </div>
            {!isReadOnly && (
              <PillButton variant="glass" onClick={handleAddServiceLog} className="h-8 text-xs text-warning border-warning/30">
                <Plus size={14} className="mr-1" /> บันทึกประวัติบริการ
              </PillButton>
            )}
          </div>

          <div className="space-y-3">
            {pvtData.afterSalesLogs?.map((log, idx) => (
              <div key={log.id || idx} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">รหัสใบบริการ / Ticket ID</label>
                    <PillInput 
                      value={log.logId}
                      onChange={e => {
                        const val = e.target.value;
                        setPvtData(prev => ({
                          ...prev,
                          afterSalesLogs: prev.afterSalesLogs?.map((l, i) => i === idx ? { ...l, logId: val } : l)
                        }));
                      }}
                      className="w-full h-8 text-xs font-mono font-bold text-warning"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">วันที่ให้บริการ</label>
                    <PillInput 
                      type="date"
                      value={log.serviceDate}
                      onChange={e => {
                        const val = e.target.value;
                        setPvtData(prev => ({
                          ...prev,
                          afterSalesLogs: prev.afterSalesLogs?.map((l, i) => i === idx ? { ...l, serviceDate: val } : l)
                        }));
                      }}
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">สถานะการแก้ไข</label>
                    <PillSelect 
                      value={log.status}
                      onChange={e => {
                        const val = e.target.value;
                        setPvtData(prev => ({
                          ...prev,
                          afterSalesLogs: prev.afterSalesLogs?.map((l, i) => i === idx ? { ...l, status: val } : l)
                        }));
                      }}
                      className="w-full h-8 text-xs font-bold"
                    >
                      <option value="Pending">Pending (รอดำเนินการ)</option>
                      <option value="In Progress">In Progress (กำลังเข้าซ่อม)</option>
                      <option value="Resolved">Resolved (แก้ไขเสร็จสิ้น)</option>
                    </PillSelect>
                  </div>

                  <div className="sm:col-span-2 text-right">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setPvtData(prev => ({
                          ...prev,
                          afterSalesLogs: prev.afterSalesLogs?.filter((_, i) => i !== idx)
                        }))}
                        className="p-1 text-white/30 hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">อาการเสีย / ข้อร้องเรียน</label>
                    <PillInput 
                      value={log.issueDescription}
                      onChange={e => {
                        const val = e.target.value;
                        setPvtData(prev => ({
                          ...prev,
                          afterSalesLogs: prev.afterSalesLogs?.map((l, i) => i === idx ? { ...l, issueDescription: val } : l)
                        }));
                      }}
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">สรุปวิธีแก้ไขปัญหา</label>
                    <PillInput 
                      value={log.resolution}
                      onChange={e => {
                        const val = e.target.value;
                        setPvtData(prev => ({
                          ...prev,
                          afterSalesLogs: prev.afterSalesLogs?.map((l, i) => i === idx ? { ...l, resolution: val } : l)
                        }));
                      }}
                      placeholder="ระบุการเปลี่ยนอะไหล่ หรือปรับตั้งค่า..."
                      className="w-full h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
