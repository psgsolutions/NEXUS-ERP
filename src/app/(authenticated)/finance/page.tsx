"use client";

<<<<<<< HEAD
import React, { useState } from "react";
=======
import React from "react";
>>>>>>> e3043f99d23bda02971284e389327f5248699605
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
<<<<<<< HEAD
  FileText, 
  BarChart3, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  Activity,
  DollarSign,
  Plus,
  ArrowRight,
  ShieldCheck,
  Search,
  Box,
  Calculator,
  Filter,
  Percent
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  PillTabs,
  GlassCard,
  PillSelect,
  NexusDataField,
  NexusSearchInput
} from "@/components/ui/Base";
import { JournalEntryModal } from "@/components/finance/JournalEntryModal";
import { PeriodCloseModal } from "@/components/finance/PeriodCloseModal";
import { ReceiptModal } from "@/components/finance/ReceiptModal";
import { PaymentModal } from "@/components/finance/PaymentModal";
import { TaxFilingModal } from "@/components/finance/TaxFilingModal";
import { AssetDepreciationModal } from "@/components/finance/AssetDepreciationModal";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import Link from "next/link";

type FinanceSubModule = "overview" | "ar" | "ap" | "gl" | "tax" | "assets";
=======
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";
>>>>>>> e3043f99d23bda02971284e389327f5248699605

export default function FinancePage() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceSubModule>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const initialFinancials = [
    { id: "FIN-JV-26001", date: "26/04/2026", desc: "รับชำระค่าสินค้า QT-2604-0042", dr: "450,000.00", cr: "450,000.00", status: "active" as const },
    { id: "FIN-IV-26012", date: "24/04/2026", desc: "ขายสินค้าให้ Hospital A (INV)", dr: "12,500.00", cr: "-", status: "active" as const },
    { id: "FIN-PV-26008", date: "22/04/2026", desc: "ชำระค่าสินค้า PO-2604-0012", dr: "-", cr: "125,000.00", status: "active" as const },
  ];

  const initialARs = [
    { customer: "Hospital A", inv: "INV-2604-001", due: "15/05/2026", amount: "฿450,000", status: "pending" as const },
    { customer: "Site X", inv: "INV-2604-042", due: "20/04/2026", amount: "฿12,500", status: "danger" as const },
  ];

  const initialAPs = [
    { supplier: "CommScope Thailand", po: "PO-2604-012", payDate: "30/04/2026", amount: "฿125,000", status: "active" as const },
    { supplier: "Aruba Networks", po: "PO-2604-088", payDate: "05/05/2026", amount: "฿42,000", status: "pending" as const },
  ];

  const initialTaxes = [
    { type: "ภาษีขาย (Output VAT)", month: "เมษายน 2569", base: "฿2,035,000", tax: "฿142,450", status: "active" as const },
    { type: "ภาษีซื้อ (Input VAT)", month: "เมษายน 2569", base: "฿1,174,000", tax: "฿82,180", status: "active" as const },
  ];

  const initialAssets = [
    { id: "AST-2604-001", name: "LED Display Wall", cat: "EQUIPMENT", purchase: "฿4,200,000", bookValue: "฿3,850,000", status: "active" as const },
    { id: "AST-2604-042", name: "MacBook Pro M3 Max", cat: "IT_HARDWARE", purchase: "฿125,000", bookValue: "฿112,000", status: "active" as const },
  ];

  const filteredFinancials = initialFinancials.filter(f => 
    f.desc.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredARs = initialARs.filter(ar => 
    ar.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ar.inv.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAPs = initialAPs.filter(ap => 
    ap.supplier.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ap.po.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTaxes = initialTaxes.filter(t => 
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = initialAssets.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.id.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "overview", label: "ภาพรวม (OVERVIEW)", icon: <BarChart3 size={14} /> },
    { id: "ar", label: "ลูกหนี้ (AR)", icon: <ArrowDownLeft size={14} /> },
    { id: "ap", label: "เจ้าหนี้ (AP)", icon: <ArrowUpRight size={14} /> },
    { id: "gl", label: "สมุดรายวัน (GL)", icon: <FileText size={14} /> },
    { id: "tax", label: "ภาษี (TAX Hub)", icon: <Percent size={14} /> },
    { id: "assets", label: "สินทรัพย์ (Assets)", icon: <Box size={14} /> },
  ];

  return (
<<<<<<< HEAD
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue shadow-lg border border-nexus-blue/10">
            <Wallet size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">ศูนย์บริหารการเงิน</h1>
            <p className="text-[10px] font-black text-white/30 uppercase mt-1.5 tracking-widest leading-none">Finance &amp; Accounting Hub</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[140px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Wallet size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">กระแสเงินสดสุทธิ</span>
              <span className="text-[17px] font-black text-nexus-teal mt-1 mono-numbers leading-none">฿4.2M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">กำไร (P&amp;L)</span>
              <span className="text-[17px] font-black text-nexus-blue mt-1 mono-numbers leading-none">+฿842k</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-danger/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">ลูกหนี้ค้างชำระ</span>
              <span className="text-[17px] font-black text-danger mt-1 mono-numbers leading-none">฿2.1M</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <section className="px-6 py-4 bg-black/10 border-b border-white/5 shrink-0">
        <PillTabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={(id: any) => setActiveTab(id)} 
        />
      </section>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-6 space-y-6 max-w-[1800px] mx-auto">

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-10">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Activity className="text-nexus-blue" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">การดำเนินงานทางบัญชี (2026-ปัจจุบัน)</p>
                    <h2 className="text-xl font-black text-white uppercase">Operational Journal</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                 <PillButton variant="glass" className="px-8" onClick={() => setIsCloseOpen(true)}>
                   <ShieldCheck size={18} />
                   ปิดงวดบัญชี
                 </PillButton>
                 
                 {(activeTab === "overview" || activeTab === "gl") && (
                   <PillButton onClick={() => setActiveModal("gl")} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     บันทึกรายวัน (JV)
                   </PillButton>
                 )}
                 {activeTab === "ar" && (
                   <PillButton onClick={() => setActiveModal("ar")} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     รับชำระเงิน (AR)
                   </PillButton>
                 )}
                 {activeTab === "ap" && (
                   <PillButton onClick={() => setActiveModal("ap")} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     จ่ายชำระเงิน (AP)
                   </PillButton>
                 )}
                 {activeTab === "tax" && (
                   <PillButton onClick={() => setIsTaxModalOpen(true)} className="px-8 shadow-neon-blue">
                     <FileText size={18} />
                     ยื่นแบบภาษี (Tax Filing)
                   </PillButton>
                 )}
                 {activeTab === "assets" && (
                   <PillButton onClick={() => setIsAssetModalOpen(true)} className="px-8 shadow-neon-warning">
                     <Calculator size={18} />
                     ประมวลผลค่าเสื่อม
                   </PillButton>
                 )}
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="ค้นหารายการบัญชี, เลขที่เอกสาร, หรือข้อมูลลูกค้า..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1"
                 kbd="F"
               />
               <div className="flex items-center gap-2 pr-1.5">
                  <PillButton variant="glass" className="h-11 w-11 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            {/* Finance Content - Conditional Rendering wrapped in standard GlassCard viewport */}
            <GlassCard className="p-0 overflow-hidden border-white/5 min-h-[640px] flex flex-col justify-between bg-black/40">
              <div className="overflow-x-auto custom-scrollbar flex-1 w-full p-2">
                {(activeTab === "overview" || activeTab === "gl") && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["เลขที่เอกสาร", "วันที่", "รายการ", "เดบิต (DR)", "เครดิต (CR)", "สถานะ"]}>
                      {filteredFinancials.map(f => (
                        <FinancialRow key={f.id} {...f} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "ar" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["ลูกหนี้ (Customer)", "เลขที่ INV", "ครบกำหนด", "ยอดค้างชำระ", "สถานะ"]}>
                      {filteredARs.map((ar, i) => (
                        <ARRow key={i} {...ar} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "ap" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["เจ้าหนี้ (Supplier)", "เลขที่ PO", "กำหนดชำระ", "ยอดต้องจ่าย", "สถานะ"]}>
                      {filteredAPs.map((ap, i) => (
                        <APRow key={i} {...ap} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "tax" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["ประเภทภาษี", "งวดเดือน", "ยอดฐานภาษี", "ยอดภาษี", "สถานะ"]}>
                      {filteredTaxes.map((tax, i) => (
                        <TaxRow key={i} {...tax} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "assets" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["Asset ID / ชื่อสินทรัพย์", "หมวดหมู่", "มูลค่าซื้อ", "มูลค่าทางบัญชี", "สถานะ"]}>
                      {filteredAssets.map(asset => (
                        <AssetRow key={asset.id} {...asset} />
                      ))}
                    </NexusTable>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/10 flex items-center justify-between text-xs text-white/30 font-bold">
                <span>สตรีมข้อมูลคลาวด์สด • NEXUS Real-time Engine</span>
                <span>PSG Master UI Standard V3.1</span>
              </div>
            </GlassCard>
          </div>

        </div>

        {/* Right Sidebar Status */}
        <div className="space-y-6">
           <GlassCard className="p-6 border-white/10 bg-nexus-blue/5">
              <h4 className="text-[11px] font-black text-nexus-blue uppercase tracking-widest mb-6">ประมาณการกระแสเงินสด (AI)</h4>
              <div className="space-y-6">
                 <CashFlowBar label="May 2026" inAmount={1.2} outAmount={0.8} />
                 <CashFlowBar label="Jun 2026" inAmount={2.5} outAmount={1.2} />
                 <CashFlowBar label="Jul 2026" inAmount={0.8} outAmount={1.5} isRisk />
              </div>
              <p className="text-[9px] text-white/30 text-center mt-6 uppercase font-black tracking-widest">
                * พยากรณ์จาก Invoice และ PO ล่วงหน้า
              </p>
           </GlassCard>
        </div>
=======
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">การเงินและบัญชี (Finance Center)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">General Ledger & Cash Flow Strategy</p>
        </div>
        <div className="flex gap-4">
          <PillButton variant="glass" className="gap-2 border-white/5">
            <Download size={18} />
            Export Report
          </PillButton>
          <PillButton className="gap-2 shadow-nexus-glow">
            <FileSpreadsheet size={18} />
            ลงบัญชีใหม่ (GL)
          </PillButton>
        </div>
      </div>

      {/* Financial Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FinanceCard 
          label="กระแสเงินสดสุทธิ" 
          value="฿2,450,000.00" 
          change="+฿125,000" 
          isPositive={true} 
          icon={<Wallet className="text-nexus-teal" />} 
        />
        <FinanceCard 
          label="รายได้รวม (Revenue)" 
          value="฿8,120,500.00" 
          change="+15.2%" 
          isPositive={true} 
          icon={<TrendingUp className="text-nexus-blue" />} 
        />
        <FinanceCard 
          label="ค่าใช้จ่ายรวม (Expense)" 
          value="฿5,670,500.00" 
          change="+8.4%" 
          isPositive={false} 
          icon={<TrendingDown className="text-danger" />} 
        />
      </div>

      {/* Chart & Breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <GlassCard className="p-8 border-white/5 bg-[#0a0a0c] h-[400px] relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-nexus-teal" />
              Cash Flow Trend
            </h3>
          </div>
          {/* Mock Visualization Placeholder */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-nexus-blue/5 to-transparent" />
          <div className="w-full h-full flex items-center justify-center border border-white/5 border-dashed rounded-2xl">
             <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Real-time Visualization Engine</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 border-white/5 bg-[#0a0a0c]">
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-8 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-nexus-blue" />
            Expense Breakdown
          </h3>
          <div className="space-y-6">
            <ExpenseItem label="ต้นทุนขาย (COGS)" value="฿4,100,000" percent={72} color="bg-nexus-blue" />
            <ExpenseItem label="เงินเดือนพนักงาน" value="฿850,000" percent={15} color="bg-nexus-teal" />
            <ExpenseItem label="ค่าเช่าและสาธารณูปโภค" value="฿420,000" percent={7} color="bg-warning" />
            <ExpenseItem label="ค่าใช้จ่ายเบ็ดเตล็ด" value="฿300,500" percent={6} color="bg-white/20" />
          </div>
        </GlassCard>
>>>>>>> e3043f99d23bda02971284e389327f5248699605
      </div>
      </div>
      </div>

      {/* Finance Management Modals */}
      <JournalEntryModal 
        isOpen={activeModal === "gl"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          console.log("Saving JV:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "FINANCE_GL", "NEW", data);
          }
          setActiveModal(null);
          showToast("บันทึกรายการรายวันสำเร็จ (JV-2604-XXXX)");
        }}
      />

      <PeriodCloseModal 
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        onConfirm={async (data) => {
          console.log("Closing Period:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "FINANCE_CLOSE", "NEW", data);
          }
          setIsCloseOpen(false);
          showToast(`ปิดงวดบัญชี ${data.month} ${data.year} สำเร็จและล็อกข้อมูลแล้ว`);
        }}
      />

      <ReceiptModal 
        isOpen={activeModal === "ar"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          console.log("Saving RV:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "FINANCE_AR", "NEW", data);
          }
          setActiveModal(null);
          showToast("บันทึกรับชำระเงินสำเร็จ (RV-2604-XXXX)");
        }}
      />

      <PaymentModal 
        isOpen={activeModal === "ap"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          console.log("Saving PV:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "FINANCE_AP", "NEW", data);
          }
          setActiveModal(null);
          showToast("บันทึกการจ่ายชำระเงินสำเร็จ (PV-2604-XXXX)");
        }}
      />

      <TaxFilingModal 
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        onConfirm={async (data) => {
          console.log("Filing Tax:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "FINANCE_TAX", "NEW", data);
          }
          setIsTaxModalOpen(false);
          showToast(`ยื่นแบบ ${data.type} งวดเมษายน 2569 สำเร็จ`);
        }}
      />

      <AssetDepreciationModal 
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onConfirm={async (data) => {
          console.log("Depreciation Posted:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "FINANCE_ASSETS", "NEW", data);
          }
          setIsAssetModalOpen(false);
          showToast(`ประมวลผลค่าเสื่อมราคาสำหรับงวด ${data.period} สำเร็จ (JV Posted)`);
        }}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
}

<<<<<<< HEAD
function AssetRow({ id, name, cat, purchase, bookValue, status }: { id: string, name: string, cat: string, purchase: string, bookValue: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell>
         <p className="font-mono text-[10px] text-warning font-black tracking-tighter">{id}</p>
         <p className="font-black text-white/80">{name}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{cat}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white mono-numbers">{purchase}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-warning mono-numbers">{bookValue}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label="ปกติ" /></NexusTableCell>
    </NexusTableRow>
  );
}

function FinancialRow({ id, date, desc, dr, cr, status }: { id: string, date: string, desc: string, dr: string, cr: string, status: "active" | "pending" }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[140px]">
        <Link href={`/finance/journal/${id}`} className="block">
           <p className="font-mono text-[10px] text-nexus-blue font-black tracking-tighter">{id}</p>
        </Link>
      </NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="font-black text-white/80 group-hover:text-white transition-colors whitespace-nowrap">{desc}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white/60 mono-numbers">{dr}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white/60 mono-numbers">{cr}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status} label="บันทึกแล้ว" />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ARRow({ customer, inv, due, amount, status }: { customer: string, inv: string, due: string, amount: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-black text-white">{customer}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[10px] text-nexus-teal tracking-tighter">{inv}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{due}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label={status === "pending" ? "รอชำระ" : "เกินกำหนด"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function APRow({ supplier, po, payDate, amount, status }: { supplier: string, po: string, payDate: string, amount: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-black text-white">{supplier}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[10px] text-nexus-blue tracking-tighter">{po}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{payDate}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label={status === "active" ? "อนุมัติจ่าย" : "รอตรวจรับ"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function TaxRow({ type, month, base, tax, status }: { type: string, month: string, base: string, tax: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-black text-white">{type}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[11px] font-black text-white/40 uppercase tracking-widest">{month}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white/20 mono-numbers">{base}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-nexus-teal mono-numbers">{tax}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label="สมบูรณ์" /></NexusTableCell>
    </NexusTableRow>
  );
}

function CashFlowBar({ label, inAmount, outAmount, isRisk }: { label: string, inAmount: number, outAmount: number, isRisk?: boolean }) {
  const max = Math.max(inAmount, outAmount, 3);
  return (
    <div className="space-y-2">
       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-white/40">{label}</span>
          <span className={isRisk ? "text-danger" : "text-nexus-teal"}>{isRisk ? "เสี่ยง" : "ปกติ"}</span>
       </div>
       <div className="flex items-center gap-1 h-2">
          <div className="bg-nexus-teal h-full rounded-full" style={{ width: (inAmount / max * 100) + "%" }} />
          <div className="bg-danger/40 h-full rounded-full" style={{ width: (outAmount / max * 100) + "%" }} />
       </div>
    </div>
  );
}

function VatItem({ label, amount, color }: { label: string, amount: string, color: string }) {
  return (
    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
       <span className="text-white/20">{label}</span>
       <span className={cn("text-white/80", color)}>{amount}</span>
=======
function FinanceCard({ label, value, change, isPositive, icon }: { label: string, value: string, change: string, isPositive: boolean, icon: any }) {
  return (
    <GlassCard className="p-8 border-white/5 hover:border-white/20 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          {icon}
        </div>
        <div className={cn("flex items-center gap-1 text-[10px] font-black", isPositive ? "text-nexus-teal" : "text-danger")}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
        </div>
      </div>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">{label}</p>
      <h4 className="text-3xl font-black text-white mono-numbers tracking-tighter">{value}</h4>
    </GlassCard>
  );
}

function ExpenseItem({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</p>
        <p className="text-xs font-bold text-white mono-numbers">{value} <span className="text-white/20 ml-2">({percent}%)</span></p>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
>>>>>>> e3043f99d23bda02971284e389327f5248699605
    </div>
  );
}

import { Activity } from "lucide-react";
