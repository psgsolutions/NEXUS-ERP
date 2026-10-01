"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  DollarSign, 
  Trash2, 
  ShieldCheck, 
  ArrowLeft,
  Search,
  FileText
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  GlassCard,
  NexusDatePicker
} from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";

export default function NewReceiptPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [header, setHeader] = useState({
    customer: "",
    date: new Date().toISOString().split('T')[0],
    bankAccount: "SCB - XXX-XXXX-XXX",
    paymentMethod: "transfer",
    reference: "",
    note: ""
  });
  
  const [invoices, setInvoices] = useState<any[]>([]);

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
    if (!header.customer) return void showAlert("กรุณาเลือกลูกค้า");
    setInvoices([
      { id: 1, invNo: "INV-2604-001", total: 107000, balance: 107000, amountToPay: 107000, whtRate: "0", whtAmount: 0 },
      { id: 2, invNo: "INV-2604-042", total: 5350, balance: 5350, amountToPay: 5350, whtRate: "3", whtAmount: 150 }
    ]);
  };

  const updateInvoice = (id: number, field: string, value: any) => {
    setInvoices(invoices.map(inv => {
      if (inv.id === id) {
        const newInv = { ...inv, [field]: value };
        if (field === "whtRate" || field === "amountToPay") {
          // Recalculate WHT
          const rate = parseFloat(newInv.whtRate) || 0;
          // Assume base amount is amountToPay / 1.07 for demo purposes
          newInv.whtAmount = (newInv.amountToPay / 1.07) * (rate / 100);
        }
        return newInv;
      }
      return inv;
    }));
  };

  const handleBack = async () => {
    const isDirty = invoices.length > 0 || header.customer !== "";
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการย้อนกลับโดยไม่บันทึกใช่หรือไม่?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (invoices.length === 0) return void showAlert("กรุณาเลือกอินวอยซ์ที่ต้องการรับชำระ", "System Notification", "warning");
    showAlert("บันทึกรับชำระเงินเรียบร้อยแล้ว");
    router.push("/finance");
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={handleBack} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
              บันทึกการรับชำระเงิน
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              RECEIPT
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            บันทึกการรับชำระเงินจากลูกหนี้การค้า อ้างอิงใบแจ้งหนี้และตัดยอดค้างรับ
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-1.5" /> บันทึกรับเงิน
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-6 min-h-[60vh]">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 min-h-[60vh]">
        
        <div className="grid grid-cols-2 gap-6">
          <Field label="ลูกค้า (Customer) *">
             <div className="flex gap-2">
                <PillSelect 
                  value={header.customer}
                  onChange={(e) => setHeader({...header, customer: e.target.value})}
                  className="flex-1 px-6 font-bold h-9 rounded-full"
                >
                   <option value="">ค้นหาลูกค้า...</option>
                   <option value="CUST-01">Hospital A</option>
                   <option value="CUST-02">Site X</option>
                   <option value="CUST-03">Project Y</option>
                </PillSelect>
                <PillButton onClick={loadCustomerInvoices} className="px-6 shrink-0 shadow-neon-teal h-9 rounded-full">
                  <Search size={16} className="mr-2" /> ดึงยอดค้าง
                </PillButton>
             </div>
          </Field>
          <Field label="วันที่รับชำระ (Date) *">
            <NexusDatePicker 
              value={header.date}
              onChange={(e) => setHeader({...header, date: e.target.value})}
              className="w-full h-9 rounded-full px-6" 
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="เข้าบัญชี (Bank Account) *">
            <PillSelect 
              value={header.bankAccount}
              onChange={(e) => setHeader({...header, bankAccount: e.target.value})}
              className="w-full px-6 h-9 rounded-full"
            >
               <option>SCB - 123-4-XXXXX-X (Main)</option>
               <option>KBank - 789-0-XXXXX-X (Service)</option>
               <option>เงินสด</option>
            </PillSelect>
          </Field>
          <Field label="ช่องทางชำระเงิน (Payment Method)">
            <PillSelect 
              value={header.paymentMethod}
              onChange={(e) => setHeader({...header, paymentMethod: e.target.value})}
              className="w-full px-6 h-9 rounded-full"
            >
               <option value="transfer">โอนเงิน (Transfer)</option>
               <option value="cash">เงินสด (Cash)</option>
               <option value="cheque">เช็ค (Cheque)</option>
               <option value="credit_card">บัตรเครดิต (Credit Card)</option>
            </PillSelect>
          </Field>
        </div>

        <Field label="อ้างอิง / บันทึกเพิ่มเติม (Reference)">
          <PillInput 
            value={header.reference}
            onChange={(e) => setHeader({...header, reference: e.target.value})}
            placeholder="เช่น เลขที่เช็ค, สลิปโอนเงิน..." 
            className="w-full h-9 rounded-full" 
          />
        </Field>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-white/40" />
              <h4 className="text-[13px] font-semibold text-white/60 uppercase tracking-widest">รายการอินวอยซ์ที่รับชำระ (Invoices)</h4>
            </div>
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest">ตรวจสอบยอดค้างชำระและหัก ณ ที่จ่าย</span>
          </div>

          {/* Advanced Invoice Grid - Similar to DocumentItemsTable */}
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40">
             {/* Table Header */}
             <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                <div className="col-span-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest">เลขที่ INV</div>
                <div className="col-span-2 text-right text-[11px] font-semibold text-white/40 uppercase tracking-widest">ยอดค้างชำระ</div>
                <div className="col-span-3 text-right text-[11px] font-semibold text-white/40 uppercase tracking-widest">รับชำระครั้งนี้</div>
                <div className="col-span-2 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">WHT (%)</div>
                <div className="col-span-1 text-right text-[11px] font-semibold text-white/40 uppercase tracking-widest">ยอดหัก</div>
                <div className="col-span-1 text-center text-[11px] font-semibold text-white/40 uppercase tracking-widest">ลบ</div>
             </div>

             {/* Table Body */}
             <div className="divide-y divide-white/5">
                {invoices.length === 0 ? (
                   <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <FileText size={32} className="text-white/10" />
                      <p className="text-[12px] text-white/30 font-semibold uppercase tracking-widest">ยังไม่มีรายการอินวอยซ์<br/><span className="text-[10px]">กรุณาเลือกลูกค้าและดึงยอดค้าง</span></p>
                   </div>
                ) : (
                  invoices.map((inv) => (
                    <div key={inv.id} className="grid grid-cols-12 gap-2 px-4 py-1 items-center min-h-[36px] hover:bg-white/[0.02] transition-colors">
                      <div className="col-span-3 font-mono text-[13px] text-white/80">{inv.invNo}</div>
                      <div className="col-span-2 text-right font-mono text-[13px] text-white/40">{formatCurrency(inv.balance)}</div>
                      <div className="col-span-3">
                         <input 
                           type="text"
                           value={inv.amountToPay}
                           onChange={(e) => updateInvoice(inv.id, "amountToPay", e.target.value)}
                           onFocus={(e) => e.target.select()}
                           className="w-full bg-black/50 border border-white/10 rounded-full px-2 h-7 text-right font-mono text-[13px] text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 py-0 leading-relaxed transition-all" 
                         />
                      </div>
                      <div className="col-span-2">
                         <select 
                           value={inv.whtRate}
                           onChange={(e) => updateInvoice(inv.id, "whtRate", e.target.value)}
                           className="w-full bg-black/50 border border-white/10 rounded-full px-2 h-7 text-right text-[13px] text-white appearance-none focus:border-cyan-400 focus:outline-none py-0 transition-all" 
                         >
                            <option value="0">0%</option>
                            <option value="1">1%</option>
                            <option value="3">3%</option>
                            <option value="5">5%</option>
                         </select>
                      </div>
                      <div className="col-span-1 text-right font-mono text-[12px] text-danger/80 pt-1">
                         {inv.whtAmount > 0 ? formatCurrency(inv.whtAmount) : "-"}
                      </div>
                      <div className="col-span-1 flex justify-center">
                         <button onClick={() => setInvoices(invoices.filter(i => i.id !== inv.id))} className="w-5 h-7 flex items-center justify-center text-white/20 hover:text-danger transition-colors">
                            <Trash2 size={14} />
                         </button>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>

        </div>

        <div className="space-y-6 pt-6 border-t border-white/5">
          <Field label="หมายเหตุภายใน (Internal Note)">
            <textarea 
              className="w-full h-20 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[14px] p-4 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar"
              value={header.note}
              onChange={(e) => setHeader({...header, note: e.target.value})}
              placeholder="บันทึกย่อ..."
            />
          </Field>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2">Receipt Allocation</h5>
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-semibold uppercase tracking-widest">ยอดรับชำระรวม</span>
          <span className="text-[14px] font-mono font-bold text-white">{formatCurrency(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-danger/60 font-black uppercase tracking-widest">หัก ณ ที่จ่ายรวม (WHT)</span>
          <span className="text-[14px] font-mono font-bold text-danger">-{formatCurrency(summary.wht)}</span>
        </div>
        <div className="flex justify-between items-end pt-2">
          <span className="text-[12px] text-white/80 font-semibold uppercase tracking-widest">ยอดรับสุทธิ</span>
          <span className="text-xl font-mono font-black text-cyan-400 drop-shadow-neon tracking-tight text-right">{formatCurrency(summary.total)}</span>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5">
        <PillButton className="w-full h-11 rounded-full font-black uppercase tracking-[0.2em] shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-[12px]" onClick={handleSave}>
          <ShieldCheck size={18} className="mr-2" />
          บันทึกรับเงิน
        </PillButton>
      </div>
      {/* Background glow */}
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

