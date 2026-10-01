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
  Building
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

export default function NewPaymentPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useSystemDialog();

  const [header, setHeader] = useState({
    supplier: "",
    date: new Date().toISOString().split('T')[0],
    bankAccount: "KBank - XXX-XXXX-XXX",
    paymentMethod: "transfer",
    reference: "",
    note: ""
  });
  
  const [orders, setOrders] = useState<any[]>([]);

  const [summary, setSummary] = useState({
    subtotal: 0,
    wht: 0,
    total: 0
  });

  useEffect(() => {
    const sub = orders.reduce((acc, order) => acc + (order.amountToPay || 0), 0);
    const wht = orders.reduce((acc, order) => acc + (order.whtAmount || 0), 0);
    setSummary({ subtotal: sub, wht, total: sub - wht });
  }, [orders]);

  const loadSupplierOrders = () => {
    if (!header.supplier) return void showAlert("เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธทเนเธญเน€เธเนเธฒเธซเธเธตเน");
    setOrders([
      { id: 1, orderNo: "PO-2604-012", total: 125000, balance: 125000, amountToPay: 125000, whtRate: "0", whtAmount: 0 },
      { id: 2, orderNo: "PO-2604-088", total: 42000, balance: 42000, amountToPay: 42000, whtRate: "3", whtAmount: 1177 }
    ]);
  };

  const updateOrder = (id: number, field: string, value: any) => {
    setOrders(orders.map(order => {
      if (order.id === id) {
        const newOrder = { ...order, [field]: value };
        if (field === "whtRate" || field === "amountToPay") {
          // Recalculate WHT
          const rate = parseFloat(newOrder.whtRate) || 0;
          newOrder.whtAmount = (newOrder.amountToPay / 1.07) * (rate / 100);
        }
        return newOrder;
      }
      return order;
    }));
  };

  const handleBack = async () => {
    const isDirty = orders.length > 0 || header.supplier !== "";
    if (isDirty) {
      if (await showConfirm("เธเธธเธ“เธกเธตเธเธฒเธฃเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธเนเธฒเธเนเธงเน เธ•เนเธญเธเธเธฒเธฃเธขเนเธญเธเธเธฅเธฑเธเนเธ”เธขเนเธกเนเธเธฑเธเธ—เธถเธเนเธเนเธซเธฃเธทเธญเนเธกเน?")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    if (orders.length === 0) return void showAlert("เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเธเนเธฒเธขเธเธณเธฃเธฐ", "System Notification", "warning");
    showAlert("เธเธฑเธเธ—เธถเธเธเนเธฒเธขเธเธณเธฃเธฐเน€เธเธดเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง");
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
              บันทึกการจ่ายเงิน
            </h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              PAYMENT
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">
            บันทึกการชำระเงินเจ้าหนี้การค้า อ้างอิงใบสั่งซื้อ และตัดยอดค้างจ่าย
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={handleBack}>
          ยกเลิก
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={handleSave}>
          <ShieldCheck size={14} className="mr-1.5" /> บันทึกจ่ายเงิน
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-8 space-y-8 animate-in fade-in duration-500 min-h-[60vh] border-white/5 bg-black/20">
        
        <div className="grid grid-cols-2 gap-6">
          <Field label="เน€เธเนเธฒเธซเธเธตเน / เธเธนเนเธเธณเธซเธเนเธฒเธข (Supplier) *">
             <div className="flex gap-2">
                <PillSelect 
                  value={header.supplier}
                  onChange={(e) => setHeader({...header, supplier: e.target.value})}
                  className="flex-1 px-6 font-bold"
                >
                   <option value="">เธเนเธเธซเธฒเน€เธเนเธฒเธซเธเธตเน...</option>
                   <option value="SUP-01">CommScope Thailand</option>
                   <option value="SUP-02">Aruba Networks</option>
                   <option value="SUP-03">Cisco Systems</option>
                </PillSelect>
                <PillButton onClick={loadSupplierOrders} className="px-6 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                  <Search size={16} className="mr-2" /> เธ”เธถเธเธขเธญเธ”เธเนเธฒเธ
                </PillButton>
             </div>
          </Field>
          <Field label="เธงเธฑเธเธ—เธตเนเธเนเธฒเธขเธเธณเธฃเธฐ (Date) *">
            <NexusDatePicker 
              value={header.date}
              onChange={(e) => setHeader({...header, date: e.target.value})}
              className="w-full" 
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="เธเนเธฒเธขเธเธฒเธเธเธฑเธเธเธต (Bank Account) *">
            <PillSelect 
              value={header.bankAccount}
              onChange={(e) => setHeader({...header, bankAccount: e.target.value})}
              className="w-full px-6"
            >
               <option>KBank - 789-0-XXXXX-X (Main)</option>
               <option>SCB - 123-4-XXXXX-X (Payroll)</option>
               <option>เน€เธเธดเธเธชเธ”</option>
            </PillSelect>
          </Field>
          <Field label="เธเนเธญเธเธ—เธฒเธเธเธณเธฃเธฐเน€เธเธดเธ (Payment Method)">
            <PillSelect 
              value={header.paymentMethod}
              onChange={(e) => setHeader({...header, paymentMethod: e.target.value})}
              className="w-full px-6"
            >
               <option value="transfer">เนเธญเธเน€เธเธดเธ (Transfer)</option>
               <option value="cash">เน€เธเธดเธเธชเธ” (Cash)</option>
               <option value="cheque">เน€เธเนเธ (Cheque)</option>
            </PillSelect>
          </Field>
        </div>

        <Field label="เน€เธฅเธเธ—เธตเนเธญเนเธฒเธเธญเธดเธ (เน€เธเนเธ เน€เธฅเธเน€เธเนเธ / เน€เธฅเธเธชเธฅเธดเธ) (Reference)">
          <PillInput 
            value={header.reference}
            onChange={(e) => setHeader({...header, reference: e.target.value})}
            placeholder="เธฃเธฐเธเธธเน€เธฅเธเธ—เธตเนเน€เธญเธเธชเธฒเธฃเธเธฒเธฃเธเนเธฒเธข..." 
            className="w-full" 
          />
        </Field>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-white/40" />
              <h4 className="text-[13px] font-semibold text-white/60 uppercase tracking-widest">เธฃเธฒเธขเธเธฒเธฃเธชเธฑเนเธเธเธทเนเธญเธ—เธตเนเธเนเธฒเธขเธเธณเธฃเธฐ (Orders)</h4>
            </div>
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest">เธ•เธฃเธงเธเธชเธญเธเธขเธญเธ”เธเนเธฒเธเธเนเธฒเธขเนเธฅเธฐเธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธข</span>
          </div>

          {/* Advanced Order Grid - Similar to DocumentItemsTable */}
          <div className="border border-white/10 rounded-3xl overflow-hidden bg-black/40">
             {/* Table Header */}
             <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                <div className="col-span-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest">เน€เธฅเธเธ—เธตเน PO</div>
                <div className="col-span-2 text-right text-[11px] font-semibold text-white/40 uppercase tracking-widest">เธขเธญเธ”เธเนเธฒเธเธเนเธฒเธข</div>
                <div className="col-span-3 text-right text-[11px] font-semibold text-white/40 uppercase tracking-widest">เธเนเธฒเธขเธเธณเธฃเธฐเธเธฃเธฑเนเธเธเธตเน</div>
                <div className="col-span-2 text-right text-[11px] font-black text-white/40 uppercase tracking-widest">WHT (%)</div>
                <div className="col-span-1 text-right text-[11px] font-semibold text-white/40 uppercase tracking-widest">เธขเธญเธ”เธซเธฑเธ</div>
                <div className="col-span-1 text-center text-[11px] font-semibold text-white/40 uppercase tracking-widest">เธฅเธ</div>
             </div>

             {/* Table Body */}
             <div className="divide-y divide-white/5">
                {orders.length === 0 ? (
                   <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <Building size={32} className="text-white/10" />
                      <p className="text-[12px] text-white/30 font-semibold uppercase tracking-widest">เธขเธฑเธเนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธเนเธฒเธเธเนเธฒเธข<br/><span className="text-[10px]">เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเน€เธเนเธฒเธซเธเธตเนเนเธฅเธฐเธ”เธถเธเธขเธญเธ”เธเนเธฒเธ</span></p>
                   </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="grid grid-cols-12 gap-2 px-4 py-1 items-center min-h-[36px] hover:bg-white/[0.02] transition-colors">
                      <div className="col-span-3 font-mono text-[13px] text-white/80">{order.orderNo}</div>
                      <div className="col-span-2 text-right font-mono text-[13px] text-white/40">{formatCurrency(order.balance)}</div>
                      <div className="col-span-3">
                         <input 
                           type="text"
                           value={order.amountToPay}
                           onChange={(e) => updateOrder(order.id, "amountToPay", e.target.value)}
                           onFocus={(e) => e.target.select()}
                           className="w-full bg-black/50 border border-white/10 rounded-lg px-2 h-7 text-right font-mono text-[13px] text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 py-0 leading-relaxed transition-all" 
                         />
                      </div>
                      <div className="col-span-2">
                         <select 
                           value={order.whtRate}
                           onChange={(e) => updateOrder(order.id, "whtRate", e.target.value)}
                           className="w-full bg-black/50 border border-white/10 rounded-lg px-2 h-7 text-right text-[13px] text-white appearance-none focus:border-cyan-400 focus:outline-none py-0 transition-all" 
                         >
                            <option value="0">0%</option>
                            <option value="1">1%</option>
                            <option value="3">3%</option>
                            <option value="5">5%</option>
                         </select>
                      </div>
                      <div className="col-span-1 text-right font-mono text-[12px] text-red-400/80 pt-1">
                         {order.whtAmount > 0 ? formatCurrency(order.whtAmount) : "-"}
                      </div>
                      <div className="col-span-1 flex justify-center">
                         <button onClick={() => setOrders(orders.filter(i => i.id !== order.id))} className="w-5 h-7 flex items-center justify-center text-white/20 hover:text-danger transition-colors">
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
              className="w-full h-20 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-[14px] p-4 focus:outline-none focus:border-cyan-400/40 transition-all custom-scrollbar"
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
        <h5 className="text-[13px] font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2">Payment Allocation</h5>
      </div>

      <div className="p-6 rounded-3xl bg-black/40 border border-white/5 space-y-4 relative z-10">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-white/60 font-semibold uppercase tracking-widest">เธขเธญเธ”เธเนเธฒเธขเธเธณเธฃเธฐเธฃเธงเธก</span>
          <span className="text-[14px] font-mono font-bold text-white">{formatCurrency(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <span className="text-[11px] text-danger/60 font-black uppercase tracking-widest">เธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธขเธฃเธงเธก (WHT)</span>
          <span className="text-[14px] font-mono font-bold text-danger">-{formatCurrency(summary.wht)}</span>
        </div>
        <div className="flex justify-between items-end pt-2">
          <span className="text-[12px] text-white/80 font-semibold uppercase tracking-widest">เธขเธญเธ”เธเนเธฒเธขเธชเธธเธ—เธเธด</span>
          <span className="text-xl font-mono font-black text-cyan-400 drop-shadow-neon text-right tracking-tight">{formatCurrency(summary.total)}</span>
        </div>
      </div>

      <div className="space-y-4 pt-4 relative z-10">
        <PillButton className="w-full h-11 px-6 rounded-full font-black uppercase tracking-[0.2em] shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-[12px]" onClick={handleSave}>
          <ShieldCheck size={18} className="mr-2" />
          เธเธฑเธเธ—เธถเธเธเนเธฒเธขเน€เธเธดเธ
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

