"use client";

import React, { useState, useEffect } from "react";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Wallet,
  Building,
  FileText,
  Search,
  CheckCircle2,
  X
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  Modal, 
  PillTabs, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function ReceiptModal({ isOpen, onClose, onSave }: ReceiptModalProps) {
  const [activeTab, setActiveTab] = useState("header");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [header, setHeader] = useState({
    customer: "",
    date: new Date().toISOString().split('T')[0],
    bankAccount: "SCB - XXX-XXXX-XXX",
    paymentMethod: "transfer",
    reference: ""
  });

  const [summary, setSummary] = useState({
    subtotal: 0,
    wht: 0,
    total: 0
  });

  useEffect(() => {
    const sub = invoices.reduce((acc, inv) => acc + (inv.amountToPay || 0), 0);
    const wht = invoices.reduce((acc, inv) => acc + (inv.whtAmount || 0), 0);
    setSummary({ subtotal: sub, wht, total: sub - wht });
  }, [invoices]);

  const loadCustomerInvoices = () => {
    if (!header.customer) return alert("กรุณาเลือกชื่อลูกค้า");
    setInvoices([
      { id: 1, invNo: "INV-2604-001", total: 107000, balance: 107000, amountToPay: 107000, whtRate: 0, whtAmount: 0 },
      { id: 2, invNo: "INV-2604-042", total: 5350, balance: 5350, amountToPay: 5350, whtRate: 3, whtAmount: 150 }
    ]);
  };

  const updateInvoice = (id: number, field: string, value: any) => {
    setInvoices(invoices.map(inv => {
      if (inv.id === id) {
        const newInv = { ...inv, [field]: value };
        if (field === "whtRate") {
          // Assume WHT is calculated on base (total/1.07) or simplified for demo
          newInv.whtAmount = (newInv.amountToPay / 1.07) * (parseFloat(value) / 100);
        }
        return newInv;
      }
      return inv;
    }));
  };

  const isDirty = invoices.length > 0 || header.customer !== "";

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (invoices.length === 0) return alert("กรุณาเลือกอินวอยซ์ที่ต้องการรับชำระ");
    onSave({ header, invoices, summary });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="บันทึกการรับชำระเงิน (NEW RECEIPT VOUCHER)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">โหมดลูกหนี้ (AR_COLLECT_V3.0)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">บันทึกรับเงิน (Receipt Voucher)</h4>
              </div>
              <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
                 <button onClick={() => setActiveTab("header")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "header" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Header Data</button>
                 <button onClick={() => setActiveTab("invoices")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "invoices" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Invoice Allocation</button>
              </div>
            </div>

            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
              {activeTab === "header" && (
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    <Field label="ลูกค้า (Customer) *">
                       <div className="flex gap-2">
                          <PillSelect 
                            value={header.customer}
                            onChange={(e) => setHeader({...header, customer: e.target.value})}
                            className="flex-1 px-6"
                          >
                             <option value="">ค้นหาลูกค้า...</option>
                             <option>Hospital A</option>
                             <option>Site X</option>
                             <option>Project Y</option>
                          </PillSelect>
                          <PillButton onClick={loadCustomerInvoices} className="px-6 shadow-neon-teal">ดึงยอดค้าง</PillButton>
                       </div>
                    </Field>
                    <Field label="วันที่รับชำระ">
                      <PillInput 
                        type="date"
                        value={header.date}
                        onChange={(e) => setHeader({...header, date: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <Field label="เข้าบัญชี (Bank Account)">
                      <PillSelect 
                        value={header.bankAccount}
                        onChange={(e) => setHeader({...header, bankAccount: e.target.value})}
                        className="w-full px-6"
                      >
                         <option>SCB - 123-4-XXXXX-X (Main)</option>
                         <option>KBank - 789-0-XXXXX-X (Service)</option>
                         <option>เงินสด (Petty Cash)</option>
                      </PillSelect>
                    </Field>
                    <Field label="ช่องทางชำระเงิน">
                      <PillSelect 
                        value={header.paymentMethod}
                        onChange={(e) => setHeader({...header, paymentMethod: e.target.value})}
                        className="w-full px-6"
                      >
                         <option value="transfer">โอนเงิน (Transfer)</option>
                         <option value="cash">เงินสด (Cash)</option>
                         <option value="cheque">เช็ค (Cheque)</option>
                         <option value="credit_card">บัตรเครดิต (Credit Card)</option>
                      </PillSelect>
                    </Field>
                  </div>

                  <Field label="อ้างอิง / บันทึกเพิ่มเติม">
                    <PillInput 
                      value={header.reference}
                      onChange={(e) => setHeader({...header, reference: e.target.value})}
                      placeholder="เช่น เลขที่เช็ค, สลิปโอนเงิน..." 
                      className="w-full" 
                    />
                  </Field>
                </div>
              )}

              {activeTab === "invoices" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[12px] font-black text-white/30 uppercase tracking-[0.2em]">รายการอินวอยซ์ที่รับชำระ (Invoices Paid)</h4>
                    <span className="text-[11px] font-black text-nexus-teal uppercase tracking-widest">ตรวจสอบยอดค้างชำระและหัก ณ ที่จ่าย</span>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-4 px-6 text-[10px] font-black text-white/20 uppercase tracking-widest">
                       <div className="col-span-3">เลขที่ INV</div>
                       <div className="col-span-3 text-right">ยอดค้างชำระ</div>
                       <div className="col-span-3 text-right">รับชำระครั้งนี้</div>
                       <div className="col-span-2 text-right">WHT (%)</div>
                       <div className="col-span-1"></div>
                    </div>
                    {invoices.length === 0 ? (
                       <div className="p-20 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                          <FileText size={48} className="text-white/5" />
                          <p className="text-sm text-white/20 font-black uppercase tracking-widest">ยังไม่มีรายการอินวอยซ์ (กรุณาดึงยอดค้าง)</p>
                       </div>
                    ) : (
                      invoices.map((inv) => (
                        <div key={inv.id} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl group hover:border-white/10 transition-all">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-3 font-mono text-[11px] text-white/80">{inv.invNo}</div>
                            <div className="col-span-3 text-right font-mono text-[12px] text-white/40">฿{inv.balance.toLocaleString()}</div>
                            <div className="col-span-3">
                               <PillInput 
                                 type="number"
                                 value={inv.amountToPay}
                                 onChange={(e) => updateInvoice(inv.id, "amountToPay", parseFloat(e.target.value) || 0)}
                                 className="w-full text-right font-mono text-nexus-teal" 
                               />
                            </div>
                            <div className="col-span-2">
                               <PillSelect 
                                 value={inv.whtRate}
                                 onChange={(e) => updateInvoice(inv.id, "whtRate", e.target.value)}
                                 className="w-full text-right px-4 h-10" 
                               >
                                  <option value="0">0%</option>
                                  <option value="1">1%</option>
                                  <option value="3">3%</option>
                                  <option value="5">5%</option>
                               </PillSelect>
                            </div>
                            <div className="col-span-1 flex justify-center">
                               <button onClick={() => setInvoices(invoices.filter(i => i.id !== inv.id))} className="text-white/10 hover:text-danger transition-colors">
                                  <Trash2 size={16} />
                               </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[420px] flex flex-col bg-[#0F0F12] p-12 flex-shrink-0">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.2em]">สรุปยอดรับชำระ</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Receipt Allocation</h5>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
              <NexusDataField label="ยอดรับรวม (Net)" value={`฿${summary.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} />
              <NexusDataField label="หัก ณ ที่จ่าย (WHT)" value={`฿${summary.wht.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color="text-warning" />
              <div className="pt-6 border-t border-white/5">
                 <NexusDataField label="ยอดโอนจริง (Actual)" value={`฿${summary.total.toLocaleString(undefined, {minimumFractionDigits: 2})}`} highlight color="text-nexus-teal" />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-nexus-teal/5 border border-nexus-teal/10 flex items-start gap-4">
               <CheckCircle2 className="text-nexus-teal flex-shrink-0" size={18} />
               <p className="text-[11px] text-nexus-teal/60 font-bold uppercase leading-relaxed tracking-widest">
                  การยืนยันจะตัดยอดค้างชำระลูกหนี้และบันทึกสมุดรายวันรับ (RV) อัตโนมัติ
               </p>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <PillButton className="w-full shadow-neon-teal uppercase tracking-[0.2em]" onClick={handleSave}>
              <ShieldCheck size={22} />
              ยืนยันรับชำระ (POST RV)
            </PillButton>
            <PillButton variant="glass" className="w-full text-white/20 hover:text-white uppercase tracking-widest" onClick={handleClose}>
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
