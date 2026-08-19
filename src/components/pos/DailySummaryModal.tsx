"use client";

import React, { useState } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  CreditCard, 
  Banknote, 
  ArrowRightLeft,
  Calendar,
  ShieldCheck,
  Printer,
  X
} from "lucide-react";
import { 
  PillButton, 
  Modal, 
  NexusDataField,
  cn 
} from "@/components/ui/Base";

interface DailySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailySummaryModal({ isOpen, onClose }: DailySummaryModalProps) {
  const [activeTab, setActiveTab] = useState("sales");

  const mockData = {
    revenue: 125400,
    orders: 48,
    payments: {
      cash: 45000,
      creditCard: 55400,
      transfer: 25000
    },
    topProducts: [
      { name: "Cisco Catalyst 9200", qty: 2, total: 170000 },
      { name: "Patch Cord 1m", qty: 24, total: 3600 },
      { name: "Aruba AP-505", qty: 5, total: 62500 }
    ]
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="สรุปยอดขายรายวัน (DAILY SALES SUMMARY)"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-[#0D0D0D]">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-black text-nexus-teal uppercase tracking-[0.2em]">โหมดสรุปผลการขาย (POS_REP_V3.0)</p>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">สรุปประจำวัน (Daily Briefing)</h4>
              </div>
              <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
                 <button onClick={() => setActiveTab("sales")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "sales" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Sales</button>
                 <button onClick={() => setActiveTab("products")} className={cn("px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === "products" ? "bg-nexus-teal text-white shadow-neon-teal" : "text-white/20 hover:text-white/40")}>Top Items</button>
              </div>
            </div>

            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
              {activeTab === "sales" && (
                <div className="space-y-10">
                  <div className="grid grid-cols-3 gap-6">
                    <SummaryCard icon={<TrendingUp size={18} />} label="ยอดขายรวม" value={`฿${mockData.revenue.toLocaleString()}`} color="text-nexus-teal" />
                    <SummaryCard icon={<Package size={18} />} label="จำนวนออเดอร์" value={mockData.orders.toString()} color="text-nexus-blue" />
                    <SummaryCard icon={<Calendar size={18} />} label="สถานะเครื่อง" value="ONLINE" color="text-nexus-teal" />
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">สัดส่วนการชำระเงิน (Payment Breakdown)</h5>
                    <div className="grid grid-cols-1 gap-4">
                       <PaymentRow icon={<Banknote size={16} />} label="เงินสด (Cash)" value={mockData.payments.cash} total={mockData.revenue} color="bg-nexus-teal" />
                       <PaymentRow icon={<CreditCard size={16} />} label="บัตรเครดิต (Credit Card)" value={mockData.payments.creditCard} total={mockData.revenue} color="bg-nexus-blue" />
                       <PaymentRow icon={<ArrowRightLeft size={16} />} label="เงินโอน (Transfer)" value={mockData.payments.transfer} total={mockData.revenue} color="bg-white/20" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "products" && (
                <div className="space-y-6">
                   <h5 className="text-[12px] font-black text-white/30 uppercase tracking-widest ml-1">สินค้าขายดี (Top Performing Items)</h5>
                   <div className="space-y-3">
                      {mockData.topProducts.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 font-black text-[10px]">{i+1}</div>
                              <div>
                                 <p className="text-sm font-bold text-white">{p.name}</p>
                                 <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">จำนวน: {p.qty} หน่วย</p>
                              </div>
                           </div>
                           <p className="text-sm font-black text-nexus-teal mono-numbers">฿{p.total.toLocaleString()}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[380px] flex flex-col bg-[#0F0F12] p-10 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">สถานะรอบการขาย</p>
              <h5 className="text-sm font-black text-white uppercase tracking-tight">Intelligence Reporting</h5>
            </div>

            <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 space-y-6">
              <NexusDataField label="วันที่" value="26/04/2026" />
              <NexusDataField label="รหัสเครื่อง (POS ID)" value="POS-TERM-01" />
              <NexusDataField label="พนักงานประจำกะ" value="Kriangkrai M." />
            </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-white/5">
            <PillButton variant="glass" className="w-full text-white/40 hover:text-white uppercase tracking-widest" onClick={() => window.print()}>
              <Printer size={18} />
              พิมพ์รายงานสรุป
            </PillButton>
            <PillButton className="w-full px-8 shadow-neon-teal uppercase tracking-[0.2em]" onClick={onClose}>
              รับทราบ
            </PillButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
       <div className="text-white/20">{icon}</div>
       <div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</p>
          <p className={cn("text-xl font-black mt-1", color)}>{value}</p>
       </div>
    </div>
  );
}

function PaymentRow({ icon, label, value, total, color }: { icon: React.ReactNode, label: string, value: number, total: number, color: string }) {
  const percent = (value / total * 100).toFixed(1);
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-2 text-white/60">
             {icon}
             <span>{label}</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-white/20">฿{value.toLocaleString()}</span>
             <span className="text-white">{percent}%</span>
          </div>
       </div>
       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${percent}%` }} />
       </div>
    </div>
  );
}
