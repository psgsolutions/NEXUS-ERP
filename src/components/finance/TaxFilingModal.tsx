"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  ShieldCheck, 
  AlertCircle,
  Download,
  ArrowRight,
  Percent,
  CheckCircle2
} from "lucide-react";
import { 
  PillButton, 
  PillSelect, 
  Modal, 
  cn 
} from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { 
  calculatePP30Tax, 
  fetchWHTTaxRecords, 
  checkTaxFilingExportLock, 
  lockTaxFilingExport, 
  exportPP30ToCSV, 
  exportWHTToCSV, 
  PP30TaxData, 
  WHTTaxRecord 
} from "@/lib/tax-filing-service";

interface TaxFilingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void> | void;
}

export function TaxFilingModal({ isOpen, onClose, onConfirm }: TaxFilingModalProps) {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || "COMP-001";

  const [step, setStep] = useState(1);
  const [taxType, setTaxType] = useState<"VAT30" | "PND3" | "PND53">("VAT30");
  const [yearMonth, setYearMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [pp30Data, setPp30Data] = useState<PP30TaxData | null>(null);
  const [whtRecords, setWhtRecords] = useState<WHTTaxRecord[]>([]);
  const [existingLock, setExistingLock] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    const loadTaxData = async () => {
      try {
        const lock = await checkTaxFilingExportLock(currentCompanyId, taxType, yearMonth);
        if (isMounted) setExistingLock(lock);

        if (taxType === "VAT30") {
          const vat = await calculatePP30Tax(currentCompanyId, yearMonth);
          if (isMounted) setPp30Data(vat);
        } else {
          const whtType = taxType as "PND3" | "PND53";
          const wht = await fetchWHTTaxRecords(currentCompanyId, yearMonth, whtType);
          if (isMounted) setWhtRecords(wht);
        }
      } catch (err) {
        console.error("Failed loading tax filing data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTaxData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentCompanyId, taxType, yearMonth]);

  const handleClose = () => {
    if (isSaving) return;
    onClose();
    setStep(1);
  };

  const handleExportCSV = async () => {
    if (existingLock) {
      const confirmReExport = window.confirm(
        `เตือน: รายงานภาษีประเภท ${taxType} ประจำงวด ${yearMonth} ได้ถูกส่งออกไปแล้วเมื่อ ${existingLock.exportedAt}\n\nคุณต้องการส่งออกไฟล์ซ้ำใช่หรือไม่?`
      );
      if (!confirmReExport) return;
    }

    setIsSaving(true);
    try {
      let csvContent = "";
      let filename = "";

      if (taxType === "VAT30" && pp30Data) {
        csvContent = exportPP30ToCSV(pp30Data);
        filename = `ภพ30_${yearMonth}_${currentCompanyId}.csv`;
      } else {
        const whtType = (taxType === "VAT30" ? "PND3" : taxType) as "PND3" | "PND53";
        csvContent = exportWHTToCSV(whtRecords, whtType, yearMonth);
        filename = `${taxType}_${yearMonth}_${currentCompanyId}.csv`;
      }

      // Trigger Browser Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Lock export event
      await lockTaxFilingExport(currentCompanyId, taxType, yearMonth, user?.uid || "SYSTEM");
      
      // Refresh lock state
      const newLock = await checkTaxFilingExportLock(currentCompanyId, taxType, yearMonth);
      setExistingLock(newLock);

      if (onConfirm) {
        await onConfirm({ taxType, yearMonth, exportedAt: new Date().toISOString() });
      }

      alert(`ส่งออกรายงานภาษี ${taxType} สำเร็จแล้ว`);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งออกรายงานภาษี");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="การยื่นแบบและชำระภาษี"
      maxWidth="max-w-[1500px]"
    >
      <div className="flex h-full bg-surface-0">
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                  <Percent size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white uppercase tracking-tight">ยื่นแบบภาษีประจำงวด</h4>
                  <p className="text-[12px] font-bold text-nexus-teal tracking-wider">ระบบส่งออกรายงานภาษีสรรพากร (ภ.พ.30 / ภ.ง.ด.3 / ภ.ง.ด.53)</p>
                </div>
              </div>
            </div>

            {existingLock && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-400">
                <AlertCircle size={20} className="shrink-0" />
                <div className="text-[12px] font-bold">
                  <p>รายงานภาษีงวดนี้ถูกส่งออกและล็อกสถานะไปแล้วเมื่อ {new Date(existingLock.exportedAt).toLocaleString("th-TH")}</p>
                  <p className="text-[11px] text-amber-400/70 font-normal">หากส่งออกซ้ำ ระบบจะบันทึก Audit Log การส่งออกซ้ำตามมาตรการป้องกันเอกสารซ้ำซ้อน</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-white/70">ประเภทแบบภาษี</label>
                <PillSelect 
                  value={taxType} 
                  onChange={(e) => setTaxType(e.target.value as any)} 
                  className="w-full h-9 px-4 font-bold text-sm"
                >
                  <option value="VAT30">ภ.พ.30 (ภาษีมูลค่าเพิ่ม 7%)</option>
                  <option value="PND3">ภ.ง.ด.3 (หัก ณ ที่จ่าย - บุคคลธรรมดา)</option>
                  <option value="PND53">ภ.ง.ด.53 (หัก ณ ที่จ่าย - นิติบุคคล)</option>
                </PillSelect>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-white/70">งวดประจำเดือน/ปี</label>
                <input 
                  type="month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  className="w-full h-9 px-4 rounded-full bg-white/5 border border-white/10 font-bold text-sm text-white focus:outline-none focus:border-nexus-teal"
                />
              </div>
            </div>

            {taxType === "VAT30" && pp30Data && (
              <div className="space-y-6">
                <h5 className="text-[12px] font-bold text-white/60 uppercase tracking-widest">สรุปรายการภาษี ภ.พ.30</h5>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[12px] font-bold text-white/60">ยอดขายและภาษีขาย (Output VAT)</p>
                    <p className="text-sm font-mono text-white/50">ฐานภาษี: ฿{pp30Data.salesBase.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xl font-black text-nexus-blue font-mono">฿{pp30Data.outputVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[12px] font-bold text-white/60">ยอดซื้อและภาษีซื้อ (Input VAT)</p>
                    <p className="text-sm font-mono text-white/50">ฐานภาษี: ฿{pp30Data.purchaseBase.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xl font-black text-nexus-teal font-mono">฿{pp30Data.inputVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-nexus-blue/10 border border-nexus-blue/30 flex justify-between items-center">
                  <div>
                    <p className="text-[12px] font-bold text-nexus-blue uppercase tracking-widest">
                      {pp30Data.netVatPayable >= 0 ? "ภาษีมูลค่าเพิ่มที่ต้องชำระสุทธิ" : "ภาษีมูลค่าเพิ่มขอคืนสุทธิ"}
                    </p>
                    <p className="text-3xl font-black text-white font-mono mt-1">
                      ฿{Math.abs(pp30Data.netVatPayable).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <ShieldCheck size={44} className="text-nexus-blue/30" />
                </div>
              </div>
            )}

            {(taxType === "PND3" || taxType === "PND53") && (
              <div className="space-y-4">
                <h5 className="text-[12px] font-bold text-white/60 uppercase tracking-widest">
                  รายการภาษีหัก ณ ที่จ่าย {taxType === "PND3" ? "ภ.ง.ด.3 (บุคคลธรรมดา)" : "ภ.ง.ด.53 (นิติบุคคล)"} ({whtRecords.length} รายการ)
                </h5>

                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                  {whtRecords.map((r, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[12px]">
                      <div>
                        <p className="font-bold text-white">{r.vendorName}</p>
                        <p className="text-[10px] text-white/40 font-mono">เลขผู้เสียภาษี: {r.taxId} | เอกสาร: {r.docNo}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-nexus-teal">฿{r.whtAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-white/50">ฐาน ฿{r.baseAmount.toLocaleString("th-TH")} ({r.whtRate}%)</p>
                      </div>
                    </div>
                  ))}

                  {whtRecords.length === 0 && (
                    <div className="p-8 text-center text-white/40 border border-dashed border-white/10 rounded-xl text-xs font-bold">
                      ไม่พบรายการหัก ณ ที่จ่าย ในงวดเดือนที่เลือก
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
              <PillButton variant="glass" className="h-9 px-5 text-sm" onClick={handleClose}>
                ยกเลิก
              </PillButton>
              <PillButton 
                variant="save" 
                className="h-9 px-6 text-sm font-bold flex items-center gap-2"
                onClick={handleExportCSV}
                disabled={isSaving || loading}
              >
                <Download size={15} />
                <span>{isSaving ? "กำลังส่งออก..." : "ส่งออกไฟล์ CSV สรรพากร"}</span>
              </PillButton>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
