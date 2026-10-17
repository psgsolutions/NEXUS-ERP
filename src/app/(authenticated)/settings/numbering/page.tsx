"use client";

import React, { useState, useEffect } from "react";
import { 
  Hash, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ShieldCheck,
  Building2,
  Lock,
  Layers,
  ArrowRight
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  cn 
} from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { 
  renderTemplate, 
  ResetPolicy, 
  YearBasis, 
  ReserveOn, 
  OverflowPolicy,
  ProductSeqScope,
  NumberingScheme, 
  DEFAULT_NUMBERING_SCHEMES 
} from "@/types/numbering";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

const DOC_TYPES = [
  { id: "QO", title: "ใบเสนอราคา (Quotation)", color: "border-l-nexus-teal" },
  { id: "IV", title: "ใบแจ้งหนี้ (Invoice)", color: "border-l-nexus-blue" },
  { id: "RE", title: "ใบเสร็จรับเงิน (Receipt)", color: "border-l-emerald-500", isTaxDefault: true },
  { id: "TIV", title: "ใบกำกับภาษี (Tax Invoice / e-Tax)", color: "border-l-purple-500", isTaxDefault: true },
  { id: "DR", title: "ใบส่งของ/ใบกำกับสินค้า (Delivery Report)", color: "border-l-amber-500" },
  { id: "PRJ", title: "รหัสโครงการ (Project Code)", color: "border-l-rose-500" },
  { id: "PO", title: "ใบสั่งซื้อ (Purchase Order)", color: "border-l-cyan-500" },
  { id: "SO", title: "ใบสั่งขาย (Sales Order)", color: "border-l-indigo-500" },
  { id: "PRODUCT", title: "รหัสสินค้า (Product SKU)", color: "border-l-orange-500" },
];

export default function NumberingSettingsPage() {
  const { companyId: authCompanyId } = useAuth();
  const companyId = authCompanyId || "";
  const [schemes, setSchemes] = useState<Record<string, NumberingScheme>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [saveSuccessMap, setSaveSuccessMap] = useState<Record<string, boolean>>({});
  const [errorMessageMap, setErrorMessageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (companyId) fetchSchemes();
  }, [companyId]);

  const fetchSchemes = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/settings/numbering-schemes?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setSchemes(data.schemes || {});
      } else {
        const defaults: Record<string, NumberingScheme> = {};
        Object.keys(DEFAULT_NUMBERING_SCHEMES).forEach((k) => {
          defaults[k] = DEFAULT_NUMBERING_SCHEMES[k] as NumberingScheme;
        });
        setSchemes(defaults);
      }
    } catch (err) {
      console.error("Failed to load numbering schemes", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateField = (docType: string, field: keyof NumberingScheme, value: any) => {
    setSchemes((prev) => {
      const current = prev[docType] || DEFAULT_NUMBERING_SCHEMES[docType] || {};
      const updated = { ...current, [field]: value };

      // Tax Compliant Mode Enforcement Rules
      if (field === "taxCompliantMode") {
        if (value === true) {
          updated.reserveOn = "approve";
          updated.allowManualOverride = false;
        }
      }

      return {
        ...prev,
        [docType]: updated,
      };
    });
    setErrorMessageMap((prev) => ({ ...prev, [docType]: "" }));
  };

  const handleSaveScheme = async (docType: string) => {
    const scheme = schemes[docType] || DEFAULT_NUMBERING_SCHEMES[docType];
    
    if (!scheme.template || !/\{SEQ(?::\d+)?\}/.test(scheme.template)) {
      setErrorMessageMap((prev) => ({
        ...prev,
        [docType]: "ต้องมีตัวแปร {SEQ} หรือ {SEQ:n} ในรูปแบบตัวเลขเพื่อป้องกันเลขซ้ำ",
      }));
      return;
    }

    setSavingMap((prev) => ({ ...prev, [docType]: true }));
    setErrorMessageMap((prev) => ({ ...prev, [docType]: "" }));

    try {
      const res = await apiFetch(`/api/settings/numbering-schemes/${docType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          ...scheme,
        }),
      });

      if (res.ok) {
        setSaveSuccessMap((prev) => ({ ...prev, [docType]: true }));
        setTimeout(() => {
          setSaveSuccessMap((prev) => ({ ...prev, [docType]: false }));
        }, 3000);
      } else {
        const errorData = await res.json();
        setErrorMessageMap((prev) => ({
          ...prev,
          [docType]: errorData.error || "บันทึกข้อมูลไม่สำเร็จ",
        }));
      }
    } catch (err: any) {
      setErrorMessageMap((prev) => ({
        ...prev,
        [docType]: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ",
      }));
    } finally {
      setSavingMap((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const getLivePreviewSamples = (scheme?: NumberingScheme) => {
    if (!scheme || !scheme.template) return ["-", "-", "-"];
    try {
      const startSeq = Number(scheme.startingValue) || 1;
      return [0, 1, 2].map((offset) =>
        renderTemplate(scheme.template, {
          prefix: scheme.prefix || "",
          seq: startSeq + offset,
          seqPadding: Number(scheme.seqPadding) || 4,
          serverDate: new Date(),
          yearBasis: scheme.yearBasis || "AD",
          brandCode: "ARUBA",
          categoryCode: "NET",
          mnemonic: "BKK",
          branchCode: scheme.branchCode || "HQ",
          overflowPolicy: scheme.overflowPolicy || "expand",
        })
      );
    } catch (e) {
      return ["รูปแบบไม่ถูกต้อง", "รูปแบบไม่ถูกต้อง", "รูปแบบไม่ถูกต้อง"];
    }
  };

  return (
    <div className="px-6 py-6 space-y-8 max-w-[1700px] mx-auto animate-in fade-in duration-500">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
            <Hash size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ระบบกำหนดรูปแบบเลขที่เอกสารและสินค้า</h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                NUMBERING
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">
              รองรับมาตรฐานสรรพากรสำหรับใบกำกับภาษี และ e-Tax Invoice พร้อมพรีวิวตัวอย่างลำดับเลขเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton variant="glass" onClick={fetchSchemes} className="h-8 px-4 text-xs font-bold">
            <RefreshCw size={14} className={cn("mr-1.5", loading && "animate-spin")} />
            รีเฟรชข้อมูล
          </PillButton>
        </div>
      </div>

      {/* TEMPLATE HELP TOKEN BAR */}
      <div className="bg-neutral-900/90 border border-white/15 rounded-2xl p-5 shadow-xl border-l-4 border-l-nexus-teal">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-nexus-teal" size={18} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">ตัวแปรสำหรับกำหนดรูปแบบ (Template Tokens)</h3>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
            <ShieldCheck size={14} /> รองรับกฎหมายสรรพากร e-Tax Invoice
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{PREFIX}`} <span className="text-white/40 font-sans font-normal ml-1">คำนำหน้า</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{YY}`} <span className="text-white/40 font-sans font-normal ml-1">ปี 2 หลัก</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{YYYY}`} <span className="text-white/40 font-sans font-normal ml-1">ปี 4 หลัก</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{MM}`} <span className="text-white/40 font-sans font-normal ml-1">เดือน 2 หลัก</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{DD}`} <span className="text-white/40 font-sans font-normal ml-1">วัน 2 หลัก</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{BRANCH}`} <span className="text-white/40 font-sans font-normal ml-1">รหัสสาขา</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{SEQ:4}`} <span className="text-white/40 font-sans font-normal ml-1">ลำดับเลข 4 หลัก</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{BRAND_CODE}`} <span className="text-white/40 font-sans font-normal ml-1">รหัสแบรนด์</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-nexus-teal">{`{CATEGORY_CODE}`} <span className="text-white/40 font-sans font-normal ml-1">รหัสหมวดหมู่</span></span>
        </div>
      </div>

      {/* SCHEMES CARDS LIST */}
      <div className="space-y-7">
        {DOC_TYPES.map((dt, idx) => {
          const scheme = schemes[dt.id] || DEFAULT_NUMBERING_SCHEMES[dt.id] || {
            docType: dt.id,
            template: "{PREFIX}-{YY}{MM}-{SEQ:4}",
            prefix: dt.id,
            resetPolicy: "yearly",
            seqPadding: 4,
            yearBasis: "AD",
            reserveOn: dt.isTaxDefault ? "approve" : "draft",
            allowManualOverride: !dt.isTaxDefault,
            taxCompliantMode: dt.isTaxDefault || false,
            startingValue: 1,
            overflowPolicy: "expand",
            fiscalYearStartMonth: 1,
            branchCode: "HQ",
            productSeqScope: "company_wide",
          };

          const isSaving = savingMap[dt.id];
          const isSuccess = saveSuccessMap[dt.id];
          const errorMsg = errorMessageMap[dt.id];
          const isTaxCompliant = Boolean(scheme.taxCompliantMode);
          const previewSamples = getLivePreviewSamples(scheme);

          return (
            <div 
              key={dt.id} 
              className={cn(
                "bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-white/25 border-l-4",
                dt.color
              )}
            >
              {/* CARD HEADER */}
              <div className="px-6 py-4 bg-white/[0.04] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[12px] font-bold text-white shadow-inner">
                    0{idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">{dt.title}</h2>
                      {isTaxCompliant && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                          <ShieldCheck size={12} /> สรรพากร Strict Mode
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-white/50">รหัสประเภท: {dt.id}</span>
                  </div>
                </div>

                {/* LIVE PREVIEW MULTI-SAMPLE BOX */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-black/50 border border-white/10 px-4 py-2 rounded-2xl">
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">ลำดับตัวอย่าง 3 เลขถัดไป:</span>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-nexus-teal">
                    <span className="bg-nexus-teal/10 border border-nexus-teal/30 px-2 py-1 rounded text-nexus-teal">{previewSamples[0]}</span>
                    <ArrowRight size={12} className="text-white/30" />
                    <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white/70">{previewSamples[1]}</span>
                    <ArrowRight size={12} className="text-white/30" />
                    <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white/40">{previewSamples[2]}</span>
                  </div>
                </div>
              </div>

              {/* CARD BODY FORM */}
              <div className="p-6 space-y-6">
                
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  
                  {/* PREFIX */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">คำนำหน้า (Prefix)</label>
                    <PillInput 
                      value={scheme.prefix || ""} 
                      onChange={(e) => handleUpdateField(dt.id, "prefix", e.target.value)}
                      placeholder="เช่น QO, IV, PRJ"
                      className="h-8 font-medium text-[14px]"
                    />
                  </div>

                  {/* TEMPLATE */}
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-[12px] font-bold text-white/60">รูปแบบรหัส (Template Pattern)</label>
                    <PillInput 
                      value={scheme.template || ""} 
                      onChange={(e) => handleUpdateField(dt.id, "template", e.target.value)}
                      placeholder="{PREFIX}-{YY}{MM}-{SEQ:4}"
                      className="h-8 font-mono text-[14px] text-nexus-teal"
                    />
                  </div>

                  {/* STARTING VALUE (SEED) */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">เลขเริ่มต้น (Starting Value / Seed)</label>
                    <PillInput 
                      type="number"
                      min={1}
                      value={scheme.startingValue || 1}
                      onChange={(e) => handleUpdateField(dt.id, "startingValue", Number(e.target.value))}
                      placeholder="เช่น 1 หรือ 458"
                      className="h-8 text-[14px] font-bold"
                    />
                  </div>

                  {/* SEQ PADDING */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">จำนวนหลักตัวเลข (Sequence Digits)</label>
                    <SmartSelect 
                      value={scheme.seqPadding?.toString() || "4"}
                      onChange={(val) => handleUpdateField(dt.id, "seqPadding", Number(val))}
                      options={[
                        { value: "3", label: "3 หลัก (001)" },
                        { value: "4", label: "4 หลัก (0001)" },
                        { value: "5", label: "5 หลัก (00001)" },
                        { value: "6", label: "6 หลัก (000001)" },
                      ]}
                      className="h-8 text-[14px]"
                    />
                  </div>

                  {/* RESET POLICY */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">รอบการรีเซ็ตเลข (Reset Policy)</label>
                    <SmartSelect 
                      value={scheme.resetPolicy || "yearly"}
                      onChange={(val) => handleUpdateField(dt.id, "resetPolicy", val as ResetPolicy)}
                      options={[
                        { value: "never", label: "รันต่อเนื่องไม่รีเซ็ต" },
                        { value: "yearly", label: "รีเซ็ตทุกขึ้นปีใหม่" },
                        { value: "monthly", label: "รีเซ็ตทุกขึ้นเดือนใหม่" },
                        { value: "daily", label: "รีเซ็ตทุกขึ้นวันใหม่" },
                      ]}
                      className="h-8 text-[14px]"
                    />
                  </div>

                  {/* YEAR BASIS */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">ฐานปี (Year Basis)</label>
                    <SmartSelect 
                      value={scheme.yearBasis || "AD"}
                      onChange={(val) => handleUpdateField(dt.id, "yearBasis", val as YearBasis)}
                      options={[
                        { value: "AD", label: "คริสต์ศักราช (ค.ศ. / AD)" },
                        { value: "BE", label: "พุทธศักราช (พ.ศ. / BE)" },
                      ]}
                      className="h-8 text-[14px]"
                    />
                  </div>

                  {/* OVERFLOW POLICY */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">นโยบายตัวเลขเกินหลัก (Overflow Policy)</label>
                    <SmartSelect 
                      value={scheme.overflowPolicy || "expand"}
                      onChange={(val) => handleUpdateField(dt.id, "overflowPolicy", val as OverflowPolicy)}
                      options={[
                        { value: "expand", label: "ขยายจำนวนหลักอัตโนมัติ" },
                        { value: "warn", label: "แจ้งเตือนแอดมินเมื่อเกิน" },
                        { value: "block", label: "บล็อกการออกเลขชั่วคราว" },
                      ]}
                      className="h-8 text-[14px]"
                    />
                  </div>

                  {/* RESERVE ON */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60 flex items-center justify-between">
                      <span>จังหวะการออกเลข (Reserve Trigger)</span>
                      {isTaxCompliant && <span title="ล็อกโดยมาตรฐานสรรพากร"><Lock size={12} className="text-emerald-400" /></span>}
                    </label>
                    <SmartSelect 
                      value={scheme.reserveOn || (isTaxCompliant ? "approve" : "draft")}
                      disabled={isTaxCompliant}
                      onChange={(val) => handleUpdateField(dt.id, "reserveOn", val as ReserveOn)}
                      options={[
                        { value: "draft", label: "ออกเลขทันทีเมื่อสร้างร่าง" },
                        { value: "approve", label: "ออกเลขเมื่ออนุมัติเอกสารเท่านั้น" },
                      ]}
                      className="h-8 text-[14px]"
                    />
                  </div>

                  {/* BRANCH CODE */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-white/60">รหัสสาขา (Branch Code)</label>
                    <PillInput 
                      value={scheme.branchCode || "HQ"} 
                      onChange={(e) => handleUpdateField(dt.id, "branchCode", e.target.value)}
                      placeholder="เช่น HQ, BKK, CKM"
                      className="h-8 text-[14px]"
                    />
                  </div>

                  {/* PRODUCT SEQ SCOPE (FOR PRODUCT ONLY) */}
                  {dt.id === "PRODUCT" && (
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className="text-[12px] font-bold text-white/60">ขอบเขตตัวนับสินค้า (Product Sequence Scope)</label>
                      <SmartSelect 
                        value={scheme.productSeqScope || "company_wide"}
                        onChange={(val) => handleUpdateField(dt.id, "productSeqScope", val as ProductSeqScope)}
                        options={[
                          { value: "company_wide", label: "นับลำดับรวมทั้งบริษัท (Company-wide)" },
                          { value: "per_brand_category", label: "นับลำดับแยกตามแบรนด์และหมวดหมู่ (Per Brand & Category)" },
                        ]}
                        className="h-8 text-[14px]"
                      />
                    </div>
                  )}

                  {/* TAX COMPLIANT MODE & MANUAL OVERRIDE TOGGLES */}
                  <div className="space-y-2 lg:col-span-2 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer h-8 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
                      <input 
                        type="checkbox"
                        checked={isTaxCompliant}
                        onChange={(e) => handleUpdateField(dt.id, "taxCompliantMode", e.target.checked)}
                        className="rounded bg-black/40 border-emerald-500/40 text-emerald-400 focus:ring-emerald-400"
                      />
                      <span className="text-[12px] font-bold text-emerald-300">เปิดใช้งานมาตรฐานสรรพากร (Tax Compliant Mode - บังคับออกเลขตอนอนุมัติ)</span>
                    </label>

                    <label className={cn(
                      "flex items-center gap-2 h-8 px-3 rounded-full border transition-colors",
                      isTaxCompliant ? "bg-white/5 border-white/5 opacity-50 cursor-not-allowed" : "bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer"
                    )}>
                      <input 
                        type="checkbox"
                        disabled={isTaxCompliant}
                        checked={Boolean(scheme.allowManualOverride) && !isTaxCompliant}
                        onChange={(e) => handleUpdateField(dt.id, "allowManualOverride", e.target.checked)}
                        className="rounded bg-black/40 border-white/20 text-nexus-teal focus:ring-nexus-teal"
                      />
                      <span className="text-[12px] font-bold text-white">
                        {isTaxCompliant ? "อนุญาตให้ป้อนเลขเอง (ถูกปิดกั้นโดยมาตรฐานสรรพากร)" : "อนุญาตให้ผู้ใช้ป้อนเลขเองได้"}
                      </span>
                    </label>
                  </div>

                </div>

                {/* FOOTER ACTION */}
                <div className="flex justify-end border-t border-white/10 pt-4">
                  <PillButton 
                    variant={isSuccess ? "save" : "confirm"}
                    onClick={() => handleSaveScheme(dt.id)}
                    disabled={isSaving}
                    className="h-9 px-6 text-sm font-bold shadow-neon-blue"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={14} className="mr-2 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : isSuccess ? (
                      <>
                        <CheckCircle2 size={14} className="mr-2 text-emerald-400" />
                        บันทึกสำเร็จแล้ว
                      </>
                    ) : (
                      <>
                        <Save size={14} className="mr-2" />
                        บันทึกการตั้งค่า
                      </>
                    )}
                  </PillButton>
                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
