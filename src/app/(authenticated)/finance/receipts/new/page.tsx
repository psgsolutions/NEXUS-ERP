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
    if (!header.customer) return void showAlert("เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธทเนเธญเธฅเธนเธเธเนเธฒ");
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
      if (await showConfirm("เธเธธเธ“เธกเธตเธเธฒเธฃเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธเนเธฒเธเนเธงเน เธ•เนเธญเธเธเธฒเธฃเธขเนเธญเธเธเธฅเธฑเธเนเธ”เธขเนเธกเนเธเธฑเธเธ—เธถเธเนเธเนเธซเธฃเธทเธญเนเธกเน?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (invoices.length === 0) return void showAlert("เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธญเธดเธเธงเธญเธขเธเนเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเธฃเธฑเธเธเธณเธฃเธฐ", "System Notification", "warning");
    showAlert("เธเธฑเธเธ—เธถเธเธฃเธฑเธเธเธณเธฃเธฐเน€เธเธดเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง");
    router.push("/finance");
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/50 hover:text-white transition-all backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">AR_COLLECT_V3.0</p>
          <div className="flex items-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">เธเธฑเธเธ—เธถเธเธฃเธฑเธเน€เธเธดเธ (Receipt)</h1>
            <DocumentStepper steps={["Draft", "Pending", "Paid"]} currentStep={0} />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PillButton variant="ghost" className="h-9 px-6 rounded-full text-white/50 hover:text-white" onClick={handleBack}>
          เธขเธเน€เธฅเธดเธ
        </PillButton>
        <PillButton className="h-9 px-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-2" /> เธเธฑเธเธ—เธถเธเธฃเธฑเธเน€เธเธดเธ
        </PillButton>
      </div>
    </>
  );

  const leftContent = (
    <div className="space-y-6 min-h-[60vh]">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 min-h-[60vh]">
        
        <div className="grid grid-cols-2 gap-6">
          <Field label="เธฅเธนเธเธเนเธฒ (Customer) *">
             <div className="flex gap-2">
                <PillSelect 
                  value={header.customer}
                  onChange={(e) => setHeader({...header, customer: e.target.value})}
                  className="flex-1 px-6 font-bold h-9 rounded-full"
                >
                   <option value="">เธเนเธเธซเธฒเธฅเธนเธเธเนเธฒ...</option>
                   <option value="CUST-01">Hospital A</option>
                   <option value="CUST-02">Site X</option>
                   <option value="CUST-03">Project Y</option>
                </PillSelect>
                <PillButton onClick={loadCustomerInvoices} className="px-6 shrink-0 shadow-neon-teal h-9 rounded-full">
                  <Search size={16} className="mr-2" /> เธ”เธถเธเธขเธญเธ”เธเนเธฒเธ
                </PillButton>
             </div>
          </Field>
          <Field label="เธงเธฑเธเธ—เธตเนเธฃเธฑเธเธเธณเธฃเธฐ (Date) *">
            <NexusDatePicker 
              value={header.date}
              onChange={(e) => setHeader({...header, date: e.target.value})}
              className="w-full h-9 rounded-full px-6" 
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="เน€เธเนเธฒเธเธฑเธเธเธต (Bank Account) *">
            <PillSelect 
              value={header.bankAccount}
              onChange={(e) => setHeader({...header, bankAccount: e.target.value})}
              className="w-full px-6 h-9 rounded-full"
            >
               <option>SCB - 123-4-XXXXX-X (Main)</option>
               <option>KBank - 789-0-XXXXX-X (Service)</option>
               <option>เน€เธเธดเธเธชเธ”</option>
            </PillSelect>
          </Field>
          <Field label="เธเนเธญเธเธ—เธฒเธเธเธณเธฃเธฐเน€เธเธดเธ (Payment Method)">
            <PillSelect 
              value={header.paymentMethod}
              onChange={(e) => setHeader({...header, paymentMethod: e.target.value})}
              className="w-full px-6 h-9 rounded-full"
            >
               <option value="transfer">เนเธญเธเน€เธเธดเธ (Transfer)</option>
               <option value="cash">เน€เธเธดเธเธชเธ” (Cash)</option>
               <option value="cheque">เน€เธเนเธ (Cheque)</option>
               <option value="credit_card">เธเธฑเธ•เธฃเน€เธเธฃเธ”เธดเธ• (Credit Card)</option>
            </PillSelect>
          </Field>
        </div>

        <Field label="เธญเนเธฒเธเธญเธดเธ / เธเธฑเธเธ—เธถเธเน€เธเธดเนเธกเน€เธ•เธดเธก (Reference)">
          <PillInput 
            value={header.reference}
            onChange={(e) => setHeader({...header, reference: e.target.value})}
            placeholder="เน€เธเนเธ เน€เธฅเธเธ—เธตเนเน€เธเนเธ, เธชเธฅเธดเธเนเธญเธเน€เธเธดเธ..." 
            className="w-full h-9 rounded-full" 
          />
        </Field>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-white/40" />
              <h4 className="text-[13px] font-black text-white/60 uppercase tracking-widest">เธฃเธฒเธขเธเธฒเธฃเธญเธดเธเธงเธญเธขเธเนเธ—เธตเนเธฃเธฑเธเธเธณเธฃเธฐ (Invoices)</h4>
            </div>
            <span className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">เธ•เธฃเธงเธเธชเธญเธเธขเธญเธ”เธเนเธฒเธเธเธณเธฃเธฐเนเธฅเธฐเธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธข</span>
          </div>

          {/* Advanced Invoice Grid - Similar to DocumentItemsTable */}
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40">
             {/* Table Header */}
             <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                <div className="col-span-3 text-[11px] font-black text-white/40 uppercase tracking-widest">เน€เธฅเธเธ—เธตเน INV</div>
                <div className="col-span-2 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">เธขเธญเธ”เธเนเธฒเธเธเธณเธฃเธฐ</div>
                <div className="col-span-3 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">เธฃเธฑเธเธเธณเธฃเธฐเธเธฃเธฑเนเธเธเธตเน</div>
                <div className="col-span-2 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">WHT (%)</div>
                <div className="col-span-1 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">เธขเธญเธ”เธซเธฑเธ</div>
                <div className="col-span-1 text-center text-[11px] font-black text-white/40 uppercase tracking-widest">เธฅเธ</div>
             </div>

             {/* Table Body */}
             <div className="divide-y divide-white/5">
                {invoices.length === 0 ? (
                   <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <FileText size={32} className="text-white/10" />
                      <p className="text-[12px] text-white/30 font-black uppercase tracking-widest">เธขเธฑเธเนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธญเธดเธเธงเธญเธขเธเน<br/><span className="text-[10px]">เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธฅเธนเธเธเนเธฒเนเธฅเธฐเธ”เธถเธเธขเธญเธ”เธเนเธฒเธ</span></p>
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
          <Field label="เธซเธกเธฒเธขเน€เธซเธ•เธธเธ เธฒเธขเนเธ (Internal Note)">
            <textarea 
              className="w-full h-20 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[14px] p-4 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar"
              value={header.note}
              onChange={(e) => setHeader({...header, note: e.target.value})}
              placeholder="เธเธฑเธเธ—เธถเธเธขเนเธญ..."
            />
          </Field>
        </div>

      </GlassCard>
    </div>
  );

  const rightSidebar = (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-6 sticky top-0">
      <div className="space-y-1 border-b border-white/5 pb-4">
        <h5 className="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">Receipt Allocation</h5>
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-black uppercase tracking-widest">เธขเธญเธ”เธฃเธฑเธเธเธณเธฃเธฐเธฃเธงเธก</span>
          <span className="text-[14px] font-mono font-bold text-white">{formatCurrency(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-danger/60 font-black uppercase tracking-widest">เธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธขเธฃเธงเธก (WHT)</span>
          <span className="text-[14px] font-mono font-bold text-danger">-{formatCurrency(summary.wht)}</span>
        </div>
        <div className="flex justify-between items-end pt-2">
          <span className="text-[12px] text-white/80 font-black uppercase tracking-widest">เธขเธญเธ”เธฃเธฑเธเธชเธธเธ—เธเธด</span>
          <span className="text-xl font-mono font-black text-cyan-400 drop-shadow-neon tracking-tight text-right">{formatCurrency(summary.total)}</span>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5">
        <PillButton className="w-full h-11 rounded-full font-black uppercase tracking-[0.2em] shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-[12px]" onClick={handleSave}>
          <ShieldCheck size={18} className="mr-2" />
          เธเธฑเธเธ—เธถเธเธฃเธฑเธเน€เธเธดเธ
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

