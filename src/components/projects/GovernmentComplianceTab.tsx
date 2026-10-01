"use client";

import React, { useState } from "react";
import { 
  Building2, 
  FileCheck, 
  ShieldCheck, 
  PackageCheck, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Award,
  Users,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { PillButton, PillInput, PillSelect, GlassCard, cn } from "@/components/ui/Base";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { GovernmentProjectDetails } from "@/types/database";

interface GovernmentComplianceTabProps {
  details?: GovernmentProjectDetails;
  onSave?: (updatedDetails: GovernmentProjectDetails) => void;
  isReadOnly?: boolean;
}

export function GovernmentComplianceTab({
  details,
  onSave,
  isReadOnly = false
}: GovernmentComplianceTabProps) {
  const [govData, setGovData] = useState<GovernmentProjectDetails>(() => ({
    referencePrice: details?.referencePrice || 0,
    torDocNo: details?.torDocNo || "",
    torDetails: details?.torDetails || "",
    govContractNo: details?.govContractNo || "",
    bankGuarantee: {
      bankName: details?.bankGuarantee?.bankName || "",
      guaranteeNo: details?.bankGuarantee?.guaranteeNo || "",
      amount: details?.bankGuarantee?.amount || 0,
      expiryDate: details?.bankGuarantee?.expiryDate || "",
      status: details?.bankGuarantee?.status || "Active"
    },
    inspectionCommittee: details?.inspectionCommittee || [
      { id: "COMM-01", name: "ดร. สมชาย ใจดี", position: "ผู้อำนวยการกองเทคโนโลยี", role: "ประธานกรรมการ" },
      { id: "COMM-02", name: "นายวิศวกร มั่นคง", position: "หัวหน้าฝ่ายวิศวกรรม", role: "กรรมการ" }
    ],
    assetRegistry: details?.assetRegistry || [
      { id: "AST-01", assetNo: "คร.69-4021/001", serialNo: "SN-LED-99120", itemName: "LED Panel P2.5 Indoor Cabinet", location: "ห้องประชุมใหญ่ ชั้น 4", warrantyExpiry: "2028-09-30" }
    ],
    contractExtensions: details?.contractExtensions || [],
    variationOrders: details?.variationOrders || [],
    closeout: {
      workAcceptanceCertNo: details?.closeout?.workAcceptanceCertNo || "",
      trainingRecordUrl: details?.closeout?.trainingRecordUrl || "",
      guaranteeReleaseDate: details?.closeout?.guaranteeReleaseDate || ""
    }
  }));

  const [activeSubTab, setActiveSubTab] = useState<"procurement" | "committee" | "assets" | "variations" | "closeout">("procurement");
  const [toastMsg, setToastMsg] = useState("");

  const handleSave = () => {
    if (onSave) {
      onSave(govData);
    }
    setToastMsg("บันทึกข้อมูลระเบียบพัสดุโครงการภาครัฐเรียบร้อยแล้ว");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleAddCommittee = () => {
    setGovData(prev => ({
      ...prev,
      inspectionCommittee: [
        ...(prev.inspectionCommittee || []),
        { id: `COMM-${Date.now()}`, name: "กรรมการใหม่", position: "ตำแหน่งในหน่วยงาน", role: "กรรมการ" }
      ]
    }));
  };

  const handleAddAsset = () => {
    setGovData(prev => ({
      ...prev,
      assetRegistry: [
        ...(prev.assetRegistry || []),
        { id: `AST-${Date.now()}`, assetNo: "คร.69-0000/000", serialNo: "SN-XXXXXX", itemName: "รายการพัสดุครุภัณฑ์ใหม่", location: "ระบุสถานที่ติดตั้ง", warrantyExpiry: "" }
      ]
    }));
  };

  const handleAddExtension = () => {
    setGovData(prev => ({
      ...prev,
      contractExtensions: [
        ...(prev.contractExtensions || []),
        { id: `EXT-${Date.now()}`, docNo: "หนังสือขอขยายเวลาที่...", reason: "เหตุสุดวิสัยจากสภาพอากาศ", approvedDays: 15, effectiveDate: new Date().toISOString().split("T")[0] }
      ]
    }));
  };

  const handleAddVO = () => {
    setGovData(prev => ({
      ...prev,
      variationOrders: [
        ...(prev.variationOrders || []),
        { id: `VO-${Date.now()}`, voNo: "บันทึกแก้ไขสัญญาที่ 1", description: "เพิ่มปริมาณสายสัญญาณ CAT6", amountChange: 45000, status: "Pending" }
      ]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Sub Navigation Bar & Top Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.02] border border-white/10 p-2.5 rounded-full backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "procurement", label: "1. สัญญา & ราคากลาง", icon: FileCheck },
            { id: "committee", label: "2. คณะกรรมการตรวจรับ", icon: Users },
            { id: "assets", label: "3. ทะเบียนครุภัณฑ์ราชการ", icon: PackageCheck },
            { id: "variations", label: "4. ขอขยายเวลา & VO", icon: Clock },
            { id: "closeout", label: "5. ปิดโครงการ & คืนหลักประกัน", icon: Award }
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
                    ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 shadow-neon-teal" 
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
          <PillButton variant="primary" onClick={handleSave} className="h-8 px-5 flex items-center gap-1.5">
            <Save size={14} /> บันทึกระเบียบพัสดุ
          </PillButton>
        )}
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} /> {toastMsg}
        </div>
      )}

      {/* TAB 1: สัญญาภาครัฐ & ราคากลาง & Bank Guarantee */}
      {activeSubTab === "procurement" && (
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-nexus-teal border-b border-white/5 pb-3">
            <ShieldCheck size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">หมวดเอกสารจัดซื้อจัดจ้าง สัญญาภาครัฐ และหนังสือค้ำประกัน</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">เลขที่ TOR / ขอบเขตงาน</label>
              <PillInput 
                value={govData.torDocNo} 
                onChange={e => setGovData(prev => ({ ...prev, torDocNo: e.target.value }))}
                placeholder="เช่น TOR-GOV-2026-0912" 
                className="w-full h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">ราคากลางทางราชการ (บาท)</label>
              <NumberStepper 
                value={govData.referencePrice || 0} 
                onChange={val => setGovData(prev => ({ ...prev, referencePrice: val }))}
                step={10000}
                unit="บาท"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">เลขที่สัญญาจ้างภาครัฐ</label>
              <PillInput 
                value={govData.govContractNo} 
                onChange={e => setGovData(prev => ({ ...prev, govContractNo: e.target.value }))}
                placeholder="เช่น สัญญาเลขที่ 45/2569" 
                className="w-full h-9 font-bold text-warning"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">รายละเอียด TOR เพิ่มเติม</label>
              <PillInput 
                value={govData.torDetails} 
                onChange={e => setGovData(prev => ({ ...prev, torDetails: e.target.value }))}
                placeholder="สรุปสาระสำคัญของ TOR..." 
                className="w-full h-9"
              />
            </div>
          </div>

          {/* Bank Guarantee Box */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <h4 className="text-xs font-bold text-nexus-blue uppercase tracking-wider flex items-center gap-2">
              <Award size={16} /> หนังสือค้ำประกันสัญญา (Bank Guarantee)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase">ธนาคารผู้ออกค้ำประกัน</label>
                <PillInput 
                  value={govData.bankGuarantee?.bankName} 
                  onChange={e => setGovData(prev => ({ ...prev, bankGuarantee: { ...prev.bankGuarantee, bankName: e.target.value } }))}
                  placeholder="เช่น ธนาคารกรุงไทย จำกัด" 
                  className="w-full h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase">เลขที่หนังสือค้ำประกัน</label>
                <PillInput 
                  value={govData.bankGuarantee?.guaranteeNo} 
                  onChange={e => setGovData(prev => ({ ...prev, bankGuarantee: { ...prev.bankGuarantee, guaranteeNo: e.target.value } }))}
                  placeholder="เช่น BG-KTB-991204" 
                  className="w-full h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase">วงเงินค้ำประกัน (บาท)</label>
                <NumberStepper 
                  value={govData.bankGuarantee?.amount || 0} 
                  onChange={val => setGovData(prev => ({ ...prev, bankGuarantee: { ...prev.bankGuarantee, amount: val } }))}
                  step={5000}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase">วันหมดอายุค้ำประกัน</label>
                <PillInput 
                  type="date"
                  value={govData.bankGuarantee?.expiryDate} 
                  onChange={e => setGovData(prev => ({ ...prev, bankGuarantee: { ...prev.bankGuarantee, expiryDate: e.target.value } }))}
                  className="w-full h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* TAB 2: คณะกรรมการตรวจรับพัสดุ */}
      {activeSubTab === "committee" && (
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2 text-nexus-teal">
              <Users size={18} />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">คณะกรรมการตรวจรับพัสดุตามระเบียบราชการ</h3>
            </div>
            {!isReadOnly && (
              <PillButton variant="glass" onClick={handleAddCommittee} className="h-8 text-xs text-nexus-teal border-nexus-teal/30">
                <Plus size={14} className="mr-1" /> เพิ่มรายชื่อกรรมการ
              </PillButton>
            )}
          </div>

          <div className="space-y-3">
            {govData.inspectionCommittee?.map((member, index) => (
              <div key={member.id || index} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase">ชื่อ-นามสกุล กรรมการ</label>
                  <PillInput 
                    value={member.name}
                    onChange={e => {
                      const val = e.target.value;
                      setGovData(prev => ({
                        ...prev,
                        inspectionCommittee: prev.inspectionCommittee?.map((m, i) => i === index ? { ...m, name: val } : m)
                      }));
                    }}
                    className="w-full h-8 text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase">ตำแหน่งในหน่วยงาน</label>
                  <PillInput 
                    value={member.position}
                    onChange={e => {
                      const val = e.target.value;
                      setGovData(prev => ({
                        ...prev,
                        inspectionCommittee: prev.inspectionCommittee?.map((m, i) => i === index ? { ...m, position: val } : m)
                      }));
                    }}
                    className="w-full h-8 text-xs"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase">บทบาทในคณะกรรมการ</label>
                  <PillSelect 
                    value={member.role}
                    onChange={e => {
                      const val = e.target.value;
                      setGovData(prev => ({
                        ...prev,
                        inspectionCommittee: prev.inspectionCommittee?.map((m, i) => i === index ? { ...m, role: val } : m)
                      }));
                    }}
                    className="w-full h-8 text-xs font-bold"
                  >
                    <option value="ประธานกรรมการ">ประธานกรรมการ</option>
                    <option value="กรรมการ">กรรมการ</option>
                    <option value="กรรมการและเลขานุการ">กรรมการและเลขานุการ</option>
                  </PillSelect>
                </div>

                <div className="sm:col-span-1 text-right pt-4 sm:pt-0">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setGovData(prev => ({
                        ...prev,
                        inspectionCommittee: prev.inspectionCommittee?.filter((_, i) => i !== index)
                      }))}
                      className="p-1.5 text-white/30 hover:text-danger transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* TAB 3: ทะเบียนครุภัณฑ์ราชการ */}
      {activeSubTab === "assets" && (
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2 text-nexus-blue">
              <PackageCheck size={18} />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">ทะเบียนครุภัณฑ์ราชการและ Serial Number</h3>
            </div>
            {!isReadOnly && (
              <PillButton variant="glass" onClick={handleAddAsset} className="h-8 text-xs text-nexus-teal border-nexus-teal/30">
                <Plus size={14} className="mr-1" /> เพิ่มทะเบียนครุภัณฑ์
              </PillButton>
            )}
          </div>

          <div className="space-y-3">
            {govData.assetRegistry?.map((ast, idx) => (
              <div key={ast.id || idx} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">เลขทะเบียนครุภัณฑ์</label>
                    <PillInput 
                      value={ast.assetNo}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          assetRegistry: prev.assetRegistry?.map((a, i) => i === idx ? { ...a, assetNo: val } : a)
                        }));
                      }}
                      className="w-full h-8 text-xs font-mono font-bold text-nexus-teal"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">Serial Number สินค้า</label>
                    <PillInput 
                      value={ast.serialNo}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          assetRegistry: prev.assetRegistry?.map((a, i) => i === idx ? { ...a, serialNo: val } : a)
                        }));
                      }}
                      className="w-full h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">ชื่อพัสดุครุภัณฑ์</label>
                    <PillInput 
                      value={ast.itemName}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          assetRegistry: prev.assetRegistry?.map((a, i) => i === idx ? { ...a, itemName: val } : a)
                        }));
                      }}
                      className="w-full h-8 text-xs font-bold"
                    />
                  </div>

                  <div className="sm:col-span-1 text-right">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setGovData(prev => ({
                          ...prev,
                          assetRegistry: prev.assetRegistry?.filter((_, i) => i !== idx)
                        }))}
                        className="p-1 text-white/30 hover:text-danger transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">สถานที่ติดตั้งครุภัณฑ์</label>
                    <PillInput 
                      value={ast.location}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          assetRegistry: prev.assetRegistry?.map((a, i) => i === idx ? { ...a, location: val } : a)
                        }));
                      }}
                      placeholder="เช่น อาคาร A ชั้น 2 ห้องควบคุม"
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">วันหมดอายุการรับประกัน</label>
                    <PillInput 
                      type="date"
                      value={ast.warrantyExpiry}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          assetRegistry: prev.assetRegistry?.map((a, i) => i === idx ? { ...a, warrantyExpiry: val } : a)
                        }));
                      }}
                      className="w-full h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* TAB 4: ขอขยายเวลา & บันทึกเพิ่ม/ลดงาน (VO) */}
      {activeSubTab === "variations" && (
        <GlassCard className="p-6 space-y-6">
          {/* Section: ขอขยายเวลา */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-warning flex items-center gap-2">
                <Clock size={16} /> หนังสือขอขยายระยะเวลาทำการ (Contract Extensions)
              </h4>
              {!isReadOnly && (
                <PillButton variant="glass" onClick={handleAddExtension} className="h-7 text-xs text-warning border-warning/30">
                  <Plus size={12} className="mr-1" /> เพิ่มคำขอขยายเวลา
                </PillButton>
              )}
            </div>

            <div className="space-y-3">
              {govData.contractExtensions?.map((ext, idx) => (
                <div key={ext.id || idx} className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">เลขที่หนังสืออ้างอิง</label>
                    <PillInput 
                      value={ext.docNo}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          contractExtensions: prev.contractExtensions?.map((ex, i) => i === idx ? { ...ex, docNo: val } : ex)
                        }));
                      }}
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">เหตุผลความจำเป็น</label>
                    <PillInput 
                      value={ext.reason}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          contractExtensions: prev.contractExtensions?.map((ex, i) => i === idx ? { ...ex, reason: val } : ex)
                        }));
                      }}
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">จำนวนวันที่ได้รับอนุมัติ (วัน)</label>
                    <NumberStepper 
                      value={ext.approvedDays}
                      onChange={val => {
                        setGovData(prev => ({
                          ...prev,
                          contractExtensions: prev.contractExtensions?.map((ex, i) => i === idx ? { ...ex, approvedDays: val } : ex)
                        }));
                      }}
                      step={1}
                      unit="วัน"
                    />
                  </div>

                  <div className="sm:col-span-1 text-right">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setGovData(prev => ({
                          ...prev,
                          contractExtensions: prev.contractExtensions?.filter((_, i) => i !== idx)
                        }))}
                        className="p-1 text-white/30 hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Variation Orders */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-nexus-teal flex items-center gap-2">
                <Layers size={16} /> บันทึกการเพิ่ม/ลดงาน (Variation Orders - VO)
              </h4>
              {!isReadOnly && (
                <PillButton variant="glass" onClick={handleAddVO} className="h-7 text-xs text-nexus-teal border-nexus-teal/30">
                  <Plus size={12} className="mr-1" /> เพิ่มรายการ VO
                </PillButton>
              )}
            </div>

            <div className="space-y-3">
              {govData.variationOrders?.map((vo, idx) => (
                <div key={vo.id || idx} className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">เลขที่บันทึกข้อตกลง VO</label>
                    <PillInput 
                      value={vo.voNo}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          variationOrders: prev.variationOrders?.map((v, i) => i === idx ? { ...v, voNo: val } : v)
                        }));
                      }}
                      className="w-full h-8 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">รายละเอียดการปรับเปลี่ยนงาน</label>
                    <PillInput 
                      value={vo.description}
                      onChange={e => {
                        const val = e.target.value;
                        setGovData(prev => ({
                          ...prev,
                          variationOrders: prev.variationOrders?.map((v, i) => i === idx ? { ...v, description: val } : v)
                        }));
                      }}
                      className="w-full h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase">จำนวนเงินปรับเปลี่ยน (+ / - บาท)</label>
                    <NumberStepper 
                      value={vo.amountChange}
                      onChange={val => {
                        setGovData(prev => ({
                          ...prev,
                          variationOrders: prev.variationOrders?.map((v, i) => i === idx ? { ...v, amountChange: val } : v)
                        }));
                      }}
                      step={5000}
                    />
                  </div>

                  <div className="sm:col-span-1 text-right">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setGovData(prev => ({
                          ...prev,
                          variationOrders: prev.variationOrders?.filter((_, i) => i !== idx)
                        }))}
                        className="p-1 text-white/30 hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* TAB 5: ปิดโครงการ & คืนหลักประกัน */}
      {activeSubTab === "closeout" && (
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-emerald-400 border-b border-white/5 pb-3">
            <Award size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">การส่งมอบงานงวดสุดท้ายและคืนหลักประกันสัญญา</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">เลขที่ใบรับรองการตรวจรับงานแล้วเสร็จ</label>
              <PillInput 
                value={govData.closeout?.workAcceptanceCertNo} 
                onChange={e => setGovData(prev => ({ ...prev, closeout: { ...prev.closeout, workAcceptanceCertNo: e.target.value } }))}
                placeholder="เช่น WAC-GOV-99012" 
                className="w-full h-9 font-bold text-emerald-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">ลิงก์เอกสารบันทึกการอบรมผู้ใช้งาน</label>
              <PillInput 
                value={govData.closeout?.trainingRecordUrl} 
                onChange={e => setGovData(prev => ({ ...prev, closeout: { ...prev.closeout, trainingRecordUrl: e.target.value } }))}
                placeholder="https://drive.google.com/..." 
                className="w-full h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">วันครบกำหนดคืนหลักประกันสัญญา</label>
              <PillInput 
                type="date"
                value={govData.closeout?.guaranteeReleaseDate} 
                onChange={e => setGovData(prev => ({ ...prev, closeout: { ...prev.closeout, guaranteeReleaseDate: e.target.value } }))}
                className="w-full h-9"
              />
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
