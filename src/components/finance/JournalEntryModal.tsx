"use client";

import React, { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import { PillButton, PillInput, PillSelect, Modal, PillTabs, NexusDataField, cn, NexusDatePicker } from "@/components/ui/Base";

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
}

export function JournalEntryModal({ isOpen, onClose, onSave }: JournalEntryModalProps) {
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

  const handleClose = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
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

  const handleSave = async () => {
    if (totals.diff !== 0) return void showAlert("ยอดเดบิตและเครดิตต้องสมดุลกัน", "System Notification", "warning");
    if (entries.length < 2) return void showAlert("กรุณาระบุรายการบัญชีอย่างน้อย 2 รายการ", "System Notification", "warning");
    
    setIsSaving(true);
    try {
      await onSave({ header, entries, totals });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="บันทึกสมุดรายวัน"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-blue uppercase tracking-[0.2em]">โหมดบัญชีแยกประเภท (GL_PROT_V3.0)</p>
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
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    <Field label="วันที่ทำรายการ *">
                      <NexusDatePicker value={header.date}
                        onChange={(e) => setHeader({...header, date: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                    <Field label="ประเภทสมุดรายวัน">
                      <PillSelect 
                        value={header.bookType}
                        onChange={(e) => setHeader({...header, bookType: e.target.value})}
                        className="w-full px-6"
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
                      className="w-full h-32 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold p-8 focus:outline-none focus:border-nexus-blue/40 transition-all"
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
                      className="w-full" 
                    />
                  </Field>
                </div>
              )}

              {activeTab === "entries" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[12px] font-black text-white/30 uppercase tracking-[0.2em]">รายการบัญชี</h4>
                    <PillButton variant="glass" onClick={addEntry}>
                      <Plus size={14} /> เพิ่มบรรทัด
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
                      <div key={item.id} className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl group hover:border-white/10 transition-all">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-5 px-3">
                             <PillSelect 
                               value={item.accountName}
                               onChange={(e) => updateEntry(item.id, "accountName", e.target.value)}
                               className="w-full bg-transparent border-transparent px-0 font-bold text-white/80" 
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
                               className="w-full text-right font-mono text-nexus-blue" 
                             />
                          </div>
                          <div className="col-span-3">
                             <PillInput 
                               type="number"
                               value={item.credit}
                               onChange={(e) => updateEntry(item.id, "credit", parseFloat(e.target.value) || 0)}
                               className="w-full text-right font-mono text-nexus-teal" 
                             />
                          </div>
                          <div className="col-span-1 flex justify-center">
                             <button onClick={() => removeEntry(item.id)} className="text-white/10 hover:text-danger transition-colors">
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
          </div>
        </div>

        <div className="w-[420px] flex flex-col bg-[#0F0F12] p-12 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">ตรวจสอบความสมดุล</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Balance Validation</h5>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
              <NexusDataField label="รวมเดบิต" value={`฿${totals.dr.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color="text-nexus-blue" />
              <NexusDataField label="รวมเครดิต" value={`฿${totals.cr.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color="text-nexus-teal" />
              <div className="pt-6 border-t border-white/5">
                 <NexusDataField 
                   label="ผลต่าง" 
                   value={`฿${totals.diff.toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
                   highlight 
                   color={totals.diff === 0 ? "text-nexus-teal" : "text-danger"} 
                 />
              </div>
            </div>

            {totals.diff !== 0 && (
               <div className="p-6 rounded-2xl bg-danger/5 border border-danger/10 flex items-start gap-4 animate-pulse">
                  <AlertCircle className="text-danger flex-shrink-0" size={18} />
                  <p className="text-[11px] text-danger/60 font-bold uppercase leading-relaxed tracking-widest">
                     รายการบัญชีไม่สมดุล กรุณาตรวจสอบยอด DR/CR อีกครั้ง
                  </p>
               </div>
            )}
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <PillButton 
              className={cn("w-full px-8 shadow-neon-blue uppercase tracking-[0.2em]", (totals.diff !== 0 || isSaving) && "opacity-50 pointer-events-none grayscale")} 
              onClick={handleSave}
              disabled={isSaving}
            >
              <ShieldCheck size={22} className={isSaving ? "animate-pulse" : ""} />
              {isSaving ? "กำลังบันทึก..." : "บันทึกรายการ"}
            </PillButton>
            <PillButton 
              variant="ghost" 
              className={cn("w-full text-white/20 hover:text-white uppercase tracking-widest", isSaving && "opacity-50 pointer-events-none")} 
              onClick={handleClose}
              disabled={isSaving}
            >
              ยกเลิก
            </PillButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
