"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  FileText, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  AlertCircle,
  ArrowRight,
  Calculator,
  Search,
  X,
  ArrowLeft
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
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("header");
  const [entries, setEntries] = useState<any[]>([
    { id: 1, accountCode: "", accountName: "เลือกบัญชี...", debit: 0, credit: 0, desc: "" },
    { id: 2, accountCode: "", accountName: "เลือกบัญชี...", debit: 0, credit: 0, desc: "" }
  ]);
  const [header, setHeader] = useState({
    date: new Date().toISOString().split('T')[0],
    bookType: "JV",
    description: "",
    reference: ""
  });

  const [totals, setTotals] = useState({ dr: 0, cr: 0, diff: 0 });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dr = entries.reduce((acc, e) => acc + (e.debit || 0), 0);
    const cr = entries.reduce((acc, e) => acc + (e.credit || 0), 0);
    setTotals({ dr, cr, diff: Math.abs(dr - cr) });
  }, [entries]);

  const isDirty = entries.some(e => e.debit > 0 || e.credit > 0) || header.description !== "";

  const handleBack = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const addEntry = () => {
    setEntries([...entries, { id: Date.now(), accountCode: "", accountName: "เลือกบัญชี...", debit: 0, credit: 0, desc: "" }]);
  };

  const removeEntry = (id: number) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: number, field: string, value: any) => {
    setEntries(entries.map(e => {
      if (e.id === id) {
        const newEntry = { ...e, [field]: value };
        // If debit is entered, credit should be 0 and vice versa for the same line
        if (field === "debit" && parseFloat(value) > 0) newEntry.credit = 0;
        if (field === "credit" && parseFloat(value) > 0) newEntry.debit = 0;
        return newEntry;
      }
      return e;
    }));
  };

  const handleSave = () => {
    if (totals.diff !== 0) return void showAlert("ยอดเดบิตและเครดิตต้องสมดุลกัน", "System Notification", "warning");
    if (entries.length < 2) return void showAlert("กรุณาระบุรายการบัญชีอย่างน้อย 2 รายการ", "System Notification", "warning");
    
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showAlert("บันทึกสมุดรายวันเรียบร้อยแล้ว");
      router.push("/finance");
    }, 1000);
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-0.5">GL_PROT_V3.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">บันทึกสมุดรายวัน (Journal Entry)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Posted"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton className={cn("h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]", totals.diff !== 0 && "opacity-50 pointer-events-none grayscale")} onClick={handleSave} disabled={isSaving}>
          <ShieldCheck size={14} className="mr-2" /> {isSaving ? "กำลังบันทึก..." : "บันทึกรายการ"}
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 min-h-[60vh] border-white/5 bg-black/20">
        <div className="flex justify-between items-end border-b border-white/5 pb-8">
          <div className="space-y-1">
            <p className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.2em]">โหมดบัญชีแยกประเภท</p>
            <h4 className="text-xl font-black text-white uppercase tracking-tight">บันทึกรายวัน</h4>
          </div>
          <PillTabs 
             tabs={[
               { id: "header", label: "Header" },
               { id: "entries", label: "Accounting Lines" }
             ]}
             activeTab={activeTab}
             onTabChange={setActiveTab}
          />
        </div>

        <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
          {activeTab === "header" && (
            <div className="space-y-10 max-w-4xl mx-auto">
              <div className="grid grid-cols-2 gap-8">
                <Field label="วันที่ทำรายการ *">
                  <NexusDatePicker value={header.date}
                    onChange={(e) => setHeader({...header, date: e.target.value})}
                    className="w-full h-9" 
                  />
                </Field>
                <Field label="ประเภทสมุดรายวัน">
                  <PillSelect 
                    value={header.bookType}
                    onChange={(e) => setHeader({...header, bookType: e.target.value})}
                    className="w-full h-9 px-6 rounded-full font-bold"
                  >
                     <option value="JV">JV - สมุดรายวันทั่วไป</option>
                     <option value="RV">RV - สมุดรายวันรับ</option>
                     <option value="PV">PV - สมุดรายวันจ่าย</option>
                     <option value="SV">SV - สมุดรายวันขาย</option>
                  </PillSelect>
                </Field>
              </div>

              <Field label="คำอธิบายรายการ *">
                <textarea 
                  className="w-full h-40 rounded-3xl bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-8 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar"
                  placeholder="ระบุรายละเอียดธุรกรรม..."
                  value={header.description}
                  onChange={(e) => setHeader({...header, description: e.target.value})}
                />
              </Field>

              <Field label="เลขที่เอกสารอ้างอิง">
                <PillInput 
                  value={header.reference}
                  onChange={(e) => setHeader({...header, reference: e.target.value})}
                  placeholder="เช่น INV-XXXX, PO-XXXX..." 
                  className="w-full h-9 px-6 rounded-full font-bold" 
                />
              </Field>
            </div>
          )}

          {activeTab === "entries" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[12px] font-black text-white/30 uppercase tracking-[0.2em]">รายการบัญชี</h4>
                <PillButton variant="glass" onClick={addEntry} className="h-9 px-6 rounded-full text-xs">
                  <Plus size={14} className="mr-2" /> เพิ่มบรรทัด
                </PillButton>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-6 text-[10px] font-black text-white/20 uppercase tracking-widest">
                   <div className="col-span-5">บัญชี / รายการ</div>
                   <div className="col-span-3 text-right">เดบิต</div>
                   <div className="col-span-3 text-right">เครดิต</div>
                   <div className="col-span-1"></div>
                </div>
                {entries.map((item) => (
                  <div key={item.id} className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl group hover:border-white/10 transition-all min-h-[36px]">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-5 px-3">
                         <PillSelect 
                           value={item.accountName}
                           onChange={(e) => updateEntry(item.id, "accountName", e.target.value)}
                           className="w-full bg-transparent border-transparent px-0 font-bold text-white/80 h-7 text-sm py-0 leading-relaxed" 
                         >
                            <option>11000 - เงินสด</option>
                            <option>11010 - เงินฝากธนาคาร</option>
                            <option>41000 - รายได้จากการขาย</option>
                            <option>51000 - ต้นทุนขาย</option>
                         </PillSelect>
                      </div>
                      <div className="col-span-3">
                         <PillInput 
                           type="number"
                           value={item.debit}
                           onChange={(e) => updateEntry(item.id, "debit", parseFloat(e.target.value) || 0)}
                           className="w-full text-right font-mono text-cyan-400 font-black h-7 rounded-full py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                         />
                      </div>
                      <div className="col-span-3">
                         <PillInput 
                           type="number"
                           value={item.credit}
                           onChange={(e) => updateEntry(item.id, "credit", parseFloat(e.target.value) || 0)}
                           className="w-full text-right font-mono text-cyan-500 font-black h-7 rounded-full py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                         />
                      </div>
                      <div className="col-span-1 flex justify-center">
                         <button onClick={() => removeEntry(item.id)} className="text-white/10 hover:text-danger transition-colors p-2">
                            <Trash2 size={16} />
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 relative z-10 border-b border-white/5 pb-4">
        <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">ตรวจสอบความสมดุล</p>
        <h5 className="text-sm font-black text-white uppercase tracking-tight">Balance Validation</h5>
      </div>

      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-6 relative z-10">
        <NexusDataField label="รวมเดบิต" value={formatCurrency(totals.dr)} color="text-cyan-400" />
        <NexusDataField label="รวมเครดิต" value={formatCurrency(totals.cr)} color="text-cyan-500" />
        <div className="pt-6 border-t border-white/5">
           <NexusDataField 
             label="ผลต่าง" 
             value={formatCurrency(totals.diff)} 
             highlight 
             color={totals.diff === 0 ? "text-cyan-400" : "text-danger"} 
           />
        </div>
      </div>

      {totals.diff !== 0 && (
         <div className="p-6 rounded-3xl bg-danger/5 border border-danger/10 flex items-start gap-4 animate-pulse relative z-10">
            <AlertCircle className="text-danger flex-shrink-0" size={18} />
            <p className="text-[11px] text-danger/60 font-bold uppercase leading-relaxed tracking-widest">
               รายการบัญชีไม่สมดุล กรุณาตรวจสอบยอด DR/CR อีกครั้ง
            </p>
         </div>
      )}

      <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
        <PillButton 
          className={cn("w-full h-11 px-8 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)] uppercase tracking-[0.2em] font-black border border-cyan-500/30 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30", (totals.diff !== 0 || isSaving) && "opacity-50 pointer-events-none grayscale")} 
          onClick={handleSave}
          disabled={isSaving}
        >
          <ShieldCheck size={18} className={cn("mr-2", isSaving && "animate-pulse")} />
          {isSaving ? "กำลังบันทึก..." : "บันทึกรายการ"}
        </PillButton>
      </div>
      
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] translate-x-1/4 translate-y-1/4 rounded-full pointer-events-none" />
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

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
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
