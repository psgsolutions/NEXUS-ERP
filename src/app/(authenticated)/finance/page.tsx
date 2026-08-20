"use client";

import React, { useState } from "react";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
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
  Percent,
  Landmark,
  CreditCard
} from "lucide-react";
import { 
  PillButton,
  PillTabs, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  GlassCard,
  PillSelect,
  NexusDataField,
  NexusSearchInput
} from "@/components/ui/Base";
import { DocumentFlowStepper } from "@/components/ui/DocumentFlowStepper";
import { JournalEntryModal } from "@/components/finance/JournalEntryModal";
import { PeriodCloseModal } from "@/components/finance/PeriodCloseModal";
import { ReceiptModal } from "@/components/finance/ReceiptModal";
import { PaymentModal } from "@/components/finance/PaymentModal";
import { TaxFilingModal } from "@/components/finance/TaxFilingModal";
import { AssetDepreciationModal } from "@/components/finance/AssetDepreciationModal";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { saveToFirestore } from "@/lib/firebaseUtils";
import { useSystemDialog } from "@/context/DialogContext";
import Link from "next/link";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useRouter } from "next/navigation";


const MOCK_RV = [
  { id: 'RV-2606-001', customer: 'โรงพยาบาลตากสิน', date: '25 มิ.ย. 2026', total: '฿500,000', status: 'Completed' }
];

const MOCK_PV = [
  { id: 'PV-2606-001', vendor: 'บริษัท ซิสโก้ ซิสเต็มส์', date: '28 มิ.ย. 2026', total: '฿450,000', status: 'Pending' }
];


type FinanceSubModule = "overview" | "ar" | "ap" | "gl" | "tax" | "assets" | "bank" | "cheques";

export default function FinancePage() {
  const router = useRouter();

  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceSubModule>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  
  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const { showAlert } = useSystemDialog();
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const { data: dbFinancials, loading: glLoading } = useRealtimeCollection<any>('journalEntries');
  const { data: dbARs, loading: arLoading } = useRealtimeCollection<any>('receivables');
  const { data: dbAPs, loading: apLoading } = useRealtimeCollection<any>('payables');
  const { data: dbTaxes, loading: taxLoading } = useRealtimeCollection<any>('taxFilings');
  const { data: dbAssets, loading: assetsLoading } = useRealtimeCollection<any>('assets');
  const { data: dbBankAccounts, loading: bankLoading } = useRealtimeCollection<any>('bankAccounts');
  const { data: dbCheques, loading: chequesLoading } = useRealtimeCollection<any>('cheques');

  // Real-time Dashboard Calculations
  const totalAR = dbARs.filter((ar: any) => ar.status === "pending" || ar.status === "overdue").reduce((sum: number, ar: any) => sum + (ar.amount || 0), 0);
  const totalAP = dbAPs.filter((ap: any) => ap.status === "active" || ap.status === "pending").reduce((sum: number, ap: any) => sum + (ap.amount || 0), 0);
  const netCashflow = totalAR - totalAP;
  const totalPL = dbFinancials.reduce((sum: number, f: any) => sum + ((f.totalCredit || 0) - (f.totalDebit || 0)), 0);

  // AI Forecast Logic
  let riskStatus = "safe";
  let recommendations = ["สภาพคล่องปกติ สามารถใช้ชำระหนี้ระยะสั้นได้"];
  if (netCashflow < 0 && totalAP > 0) {
    const ratio = Math.abs(netCashflow) / totalAP;
    if (ratio > 0.5) {
      riskStatus = "danger";
      recommendations = [
        "กระแสเงินสดติดลบสูง เสี่ยงต่อการขาดสภาพคล่อง",
        "แนะนำให้เร่งรัดลูกหนี้ ให้เร็วขึ้น"
      ];
    } else {
      riskStatus = "warning";
      recommendations = ["ยอดหนี้ที่ต้องจ่ายใกล้เคียงกับยอดรับชำระ ควรจัดการกระแสเงินสด"];
    }
  }

  const financialsList = dbFinancials.map(f => ({
    id: f.id || f.journalId || "JV-UNKNOWN",
    date: f.date ? new Date(f.date.seconds ? f.date.seconds * 1000 : f.date).toLocaleDateString('th-TH') : "-",
    desc: f.description || "-",
    dr: f.totalDebit?.toLocaleString() || "-",
    cr: f.totalCredit?.toLocaleString() || "-",
    status: f.status || "active"
  }));

  const arList = dbARs.map(ar => ({
    customer: ar.customerName || ar.customerId || "Unknown",
    inv: ar.invoiceId || ar.id || "-",
    due: ar.dueDate ? new Date(ar.dueDate.seconds ? ar.dueDate.seconds * 1000 : ar.dueDate).toLocaleDateString('th-TH') : "-",
    amount: ar.amount ? `฿${ar.amount.toLocaleString()}` : "-",
    status: ar.status || "pending"
  }));

  const apList = dbAPs.map(ap => ({
    supplier: ap.supplierName || ap.supplierId || "Unknown",
    po: ap.poId || ap.id || "-",
    payDate: ap.payDate ? new Date(ap.payDate.seconds ? ap.payDate.seconds * 1000 : ap.payDate).toLocaleDateString('th-TH') : "-",
    amount: ap.amount ? `฿${ap.amount.toLocaleString()}` : "-",
    status: ap.status || "active"
  }));

  const taxList = dbTaxes.map(t => ({
    type: t.type || "Unknown",
    month: `${t.month || 1}/${t.year || 2026}`,
    base: t.revenue ? `฿${t.revenue.toLocaleString()}` : "-",
    tax: t.taxAmount ? `฿${t.taxAmount.toLocaleString()}` : "-",
    status: t.status || "active"
  }));

  const assetsList = dbAssets.map(a => ({
    id: a.id || "AST-UNKNOWN",
    name: a.name || "Unknown Asset",
    cat: a.category || "UNKNOWN",
    purchase: a.purchaseValue ? `฿${a.purchaseValue.toLocaleString()}` : "-",
    bookValue: a.bookValue ? `฿${a.bookValue.toLocaleString()}` : "-",
    status: a.status || "active"
  }));

  const bankList = dbBankAccounts.map(b => ({
    id: b.id || "BNK-UNKNOWN",
    bankName: b.bankName || "Unknown Bank",
    accountNo: b.accountNo || "-",
    balance: b.balance ? `฿${b.balance.toLocaleString()}` : "฿0",
    status: b.status || "active"
  }));

  const chequesList = dbCheques.map(c => ({
    id: c.id || "CHQ-UNKNOWN",
    chequeNo: c.chequeNo || "-",
    type: c.type === "in" ? "เช็ครับ" : "เช็คจ่าย",
    dueDate: c.dueDate ? new Date(c.dueDate.seconds ? c.dueDate.seconds * 1000 : c.dueDate).toLocaleDateString('th-TH') : "-",
    amount: c.amount ? `฿${c.amount.toLocaleString()}` : "-",
    status: c.status || "pending"
  }));

  const filteredFinancials = financialsList.filter(f => 
    f.desc.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredARs = arList.filter(ar => 
    ar.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ar.inv.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAPs = apList.filter(ap => 
    ap.supplier.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ap.po.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTaxes = taxList.filter(t => 
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = assetsList.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBanks = bankList.filter(b => 
    b.bankName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.accountNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCheques = chequesList.filter(c => 
    c.chequeNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "overview", label: "ภาพรวม", icon: <BarChart3 size={14} /> },
    { id: "ar", label: "ลูกหนี้", icon: <ArrowDownLeft size={14} /> },
    { id: "ap", label: "เจ้าหนี้", icon: <ArrowUpRight size={14} /> },
    { id: "bank", label: "สมุดธนาคาร", icon: <Landmark size={14} /> },
    { id: "cheques", label: "เช็ค", icon: <CreditCard size={14} /> },
    { id: "gl", label: "สมุดรายวัน", icon: <FileText size={14} /> },
    { id: "tax", label: "ภาษี", icon: <Percent size={14} /> },
    { id: "assets", label: "สินทรัพย์", icon: <Box size={14} /> },
  ];

  const financeFlowSteps = [
    { id: "ar", label: "ลูกหนี้", icon: <ArrowDownLeft size={14} /> },
    { id: "ap", label: "เจ้าหนี้", icon: <ArrowUpRight size={14} /> },
    { id: "gl", label: "สมุดรายวัน", icon: <FileText size={14} /> },
    { id: "tax", label: "ภาษี", icon: <Percent size={14} /> },
  ];


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue shadow-lg border border-nexus-blue/10">
            <Wallet size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ศูนย์บริหารการเงิน</h1>
            <p className="text-sm font-medium text-white/30 uppercase mt-1.5 tracking-widest leading-none">Finance &amp; Accounting Hub</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[140px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Wallet size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">กระแสเงินสดสุทธิ</span>
              <span className={cn("text-[17px] font-bold mt-1 font-mono leading-none", netCashflow >= 0 ? "text-nexus-teal" : "text-danger")}>
                ฿{netCashflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">กำไร (P&amp;L)</span>
              <span className={cn("text-[17px] font-bold mt-1 font-mono leading-none", totalPL >= 0 ? "text-nexus-blue" : "text-danger")}>
                ฿{totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-danger/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">ลูกหนี้ค้างชำระ</span>
              <span className="text-[17px] font-bold text-danger mt-1 font-mono leading-none">
                ฿{totalAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
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
      <div className="p-5 space-y-3 max-w-[1800px] mx-auto">

      <div className="flex flex-col xl:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-10">
          
          <div className="space-y-3">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              <div className="flex items-center gap-4 shrink-0">
                 <Activity className="text-nexus-blue" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white/20 uppercase tracking-widest">การดำเนินงานทางบัญชี (2026-ปัจจุบัน)</p>
                    <h2 className="text-xl font-bold text-white uppercase">Operational Journal</h2>
                 </div>
              </div>
              {/* Document Sequence Visualizer */}
              {financeFlowSteps.some(s => s.id === activeTab) && (
                <div className="flex-1 w-full max-w-3xl px-6 py-2 hidden xl:block overflow-hidden">
                   <DocumentFlowStepper activeTab={activeTab} onStepClick={(id) => setActiveTab(id as any)} steps={financeFlowSteps} />
                </div>
              )}
              <div className="flex gap-3 shrink-0">
                 <PillButton variant="glass" className="px-8" onClick={() => router.push("/finance/period-close/new")}>
                   <ShieldCheck size={18} />
                   ปิดงวดบัญชี
                 </PillButton>
                 
                 {(activeTab === "overview" || activeTab === "gl") && (
                   <PillButton onClick={() => router.push("/finance/journal-entries/new")} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     บันทึกรายวัน
                   </PillButton>
                 )}
                 {activeTab === "ar" && (
                   <PillButton onClick={() => router.push("/finance/receipts/new")} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     รับชำระเงิน
                   </PillButton>
                 )}
                 {activeTab === "ap" && (
                   <PillButton onClick={() => router.push("/finance/payments/new")} className="px-8 shadow-neon-teal">
                     <Plus size={18} />
                     จ่ายชำระเงิน
                   </PillButton>
                 )}
                 {activeTab === "tax" && (
                   <PillButton onClick={() => router.push("/finance/tax-filing/new")} className="px-8 shadow-neon-blue">
                     <FileText size={18} />
                     ยื่นแบบภาษี
                   </PillButton>
                 )}
                 {activeTab === "assets" && (
                   <PillButton onClick={() => router.push("/finance/assets/depreciation/new")} className="px-8 shadow-neon-warning">
                     <Calculator size={18} />
                     ประมวลผลค่าเสื่อม
                   </PillButton>
                 )}
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="พิมพ์เพื่อค้นหา..." 
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
                    <NexusTable headers={["เลขที่เอกสาร", "วันที่", "รายการ", "เดบิต", "เครดิต", "สถานะ"]}>
                      {glLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredFinancials.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredFinancials.map((f, i) => (
                        <FinancialRow key={i} {...f} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "ar" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["ลูกหนี้", "เลขที่ INV", "ครบกำหนด", "ยอดค้างชำระ", "สถานะ"]}>
                      {arLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredARs.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredARs.map((ar, i) => (
                        <ARRow key={i} {...ar} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "ap" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["เจ้าหนี้", "เลขที่ PO", "กำหนดชำระ", "ยอดต้องจ่าย", "สถานะ"]}>
                      {apLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredAPs.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredAPs.map((ap, i) => (
                        <APRow key={i} {...ap} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "tax" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["ประเภทภาษี", "งวดเดือน", "ยอดฐานภาษี", "ยอดภาษี", "สถานะ"]}>
                      {taxLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredTaxes.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredTaxes.map((tax, i) => (
                        <TaxRow key={i} {...tax} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "assets" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["รหัสสินทรัพย์", "หมวดหมู่", "ราคาประเมิน", "ราคาทางบัญชี", "สถานะ"]}>
                      {assetsLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredAssets.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredAssets.map((asset, i) => (
                        <AssetRow key={i} {...asset} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "bank" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["รหัสสมุดบัญชี", "ชื่อธนาคาร", "เลขที่บัญชี", "ยอดคงเหลือ", "สถานะ"]}>
                      {bankLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredBanks.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={5} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredBanks.map((bank, i) => (
                        <BankRow key={i} {...bank} />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "cheques" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["รหัสเช็ค", "เลขที่เช็ค", "ประเภทเช็ค", "ครบกำหนด", "ยอดเงิน", "สถานะ"]}>
                      {chequesLoading ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredCheques.length === 0 ? (
                        <NexusTableRow>
                          <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ไม่พบข้อมูลในระบบ</NexusTableCell>
                        </NexusTableRow>
                      ) : filteredCheques.map((cheq, i) => (
                        <ChequeRow key={i} {...cheq} />
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
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
           <GlassCard className="p-4 border-white/10 bg-nexus-blue/5">
              <h4 className="text-[12px] font-bold text-nexus-blue uppercase tracking-widest mb-6">ประมาณการกระแสเงินสด</h4>
              <div className="space-y-3">
                 <CashFlowBar 
                    label="กระแสเงินสดรับ" 
                    inAmount={totalAR} 
                    outAmount={0} 
                 />
                 <CashFlowBar 
                    label="กระแสเงินสดจ่าย" 
                    inAmount={0} 
                    outAmount={totalAP} 
                    isRisk={riskStatus !== "safe"}
                 />
                 <div className="p-4 rounded-xl bg-black/40 border border-white/5 mt-4">
                   <p className="text-xs font-bold text-white mb-2">คำแนะนำจาก AI:</p>
                   <ul className="list-disc pl-4 space-y-1">
                     {recommendations.map((rec, idx) => (
                       <li key={idx} className={cn("text-[11px]", riskStatus === "danger" ? "text-danger" : riskStatus === "warning" ? "text-warning" : "text-white/70")}>{rec}</li>
                     ))}
                   </ul>
                 </div>
              </div>
              <p className="text-[10px] text-white/30 text-center mt-6 uppercase font-normal tracking-widest">
                * พยากรณ์จากบัญชีลูกหนี้ และเจ้าหนี้ แบบ Real-time
              </p>
           </GlassCard>
        </div>
      </div>
      </div>
      </div>

      {/* Finance Management Modals */}
      

      <PeriodCloseModal 
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        onConfirm={async (data) => {
          if (!user || !companyId) return;
          try {
            const saveOp = async () => {
              const closeRef = doc(collection(db, "periodClosings"));
              await setDoc(closeRef, {
                ...data,
                companyId,
                status: "closed",
                createdAt: serverTimestamp()
              });
              await auditService.logCreate(user.uid, companyId, "FINANCE_CLOSE", "NEW", data);
            };
            await saveToFirestore(saveOp());
            setIsCloseOpen(false);
            showAlert(`ปิดงวดบัญชี ${data.month} ${data.year} สำเร็จและล็อกข้อมูลแล้ว`, "System Notification", "info");
          } catch (err: any) {
            console.error(err);
            showAlert(`ซิงค์ข้อมูลล้มเหลว: ${err.message}`, "System Notification", "error");
          }
        }}
      />

      

      

      <TaxFilingModal 
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        onConfirm={async (data) => {
          if (!user || !companyId) return;
          try {
            const saveOp = async () => {
              const taxRef = doc(collection(db, "taxFilings"));
              await setDoc(taxRef, {
                ...data,
                companyId,
                status: "filed",
                createdAt: serverTimestamp()
              });
              await auditService.logCreate(user.uid, companyId, "FINANCE_TAX", "NEW", data);
            };
            await saveToFirestore(saveOp());
            setIsTaxModalOpen(false);
            showAlert(`ยื่นแบบ ${data.type} งวด ${data.month || 'เดือนนี้'} สำเร็จ`, "System Notification", "info");
          } catch (err: any) {
            console.error(err);
            showAlert(`ซิงค์ข้อมูลล้มเหลว: ${err.message}`, "System Notification", "error");
          }
        }}
      />

      <AssetDepreciationModal 
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onConfirm={async (data) => {
          if (!user || !companyId) return;
          try {
            const saveOp = async () => {
              const depRef = doc(collection(db, "assetDepreciations"));
              await setDoc(depRef, {
                ...data,
                companyId,
                status: "posted",
                createdAt: serverTimestamp()
              });
              await auditService.logCreate(user.uid, companyId, "FINANCE_ASSETS", "NEW", data);
            };
            await saveToFirestore(saveOp());
            setIsAssetModalOpen(false);
            showAlert(`ประมวลผลค่าเสื่อมราคาสำเร็จ`, "System Notification", "info");
          } catch (err: any) {
            console.error(err);
            showAlert(`ซิงค์ข้อมูลล้มเหลว: ${err.message}`, "System Notification", "error");
          }
        }}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
}

function AssetRow({ id, name, cat, purchase, bookValue, status }: { id: string, name: string, cat: string, purchase: string, bookValue: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell>
         <p className="font-mono text-xs text-warning font-medium tracking-tighter">{id}</p>
         <p className="font-bold text-white/80">{name}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/40 uppercase tracking-widest">{cat}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{purchase}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-warning mono-numbers">{bookValue}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label="ปกติ" /></NexusTableCell>
    </NexusTableRow>
  );
}

function FinancialRow({ id, date, desc, dr, cr, status }: { id: string, date: string, desc: string, dr: string, cr: string, status: "active" | "pending" }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[140px]">
        <Link href={`/finance/journal/${id}`} className="block">
           <p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter">{id}</p>
        </Link>
      </NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/40 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 group-hover:text-white transition-colors whitespace-nowrap">{desc}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white/60 font-mono">{dr}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white/60 font-mono">{cr}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status} label="บันทึกแล้ว" />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ARRow({ customer, inv, due, amount, status }: { customer: string, inv: string, due: string, amount: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white">{customer}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[10px] text-nexus-teal tracking-tighter">{inv}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/40 uppercase tracking-widest">{due}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label={status === "pending" ? "รอชำระ" : "เกินกำหนด"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function APRow({ supplier, po, payDate, amount, status }: { supplier: string, po: string, payDate: string, amount: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white">{supplier}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[10px] text-nexus-blue tracking-tighter">{po}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/40 uppercase tracking-widest">{payDate}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label={status === "active" ? "อนุมัติจ่าย" : "รอตรวจรับ"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function TaxRow({ type, month, base, tax, status }: { type: string, month: string, base: string, tax: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="font-bold text-white">{type}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-sm font-medium text-white/40 uppercase tracking-widest">{month}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white/20 mono-numbers">{base}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-nexus-teal mono-numbers">{tax}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label="สมบูรณ์" /></NexusTableCell>
    </NexusTableRow>
  );
}

function CashFlowBar({ label, inAmount, outAmount, isRisk }: { label: string, inAmount: number, outAmount: number, isRisk?: boolean }) {
  const max = Math.max(inAmount, outAmount, 3);
  return (
    <div className="space-y-2">
       <div className="flex justify-between text-sm font-medium uppercase tracking-widest">
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
function BankRow({ id, bankName, accountNo, balance, status }: any) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{bankName}</NexusTableCell>
      <NexusTableCell className="w-[180px] font-mono text-[11px] text-white/40 tracking-widest">{accountNo}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{balance}</NexusTableCell>
      <NexusTableCell className="w-[180px]"><StatusBadge status={status} label={status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function ChequeRow({ id, chequeNo, type, dueDate, amount, status }: any) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-xs text-warning font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{chequeNo}</NexusTableCell>
      <NexusTableCell className="w-[150px] font-bold text-[11px] uppercase tracking-widest text-white/40">{type}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-sm font-medium text-white/40 uppercase tracking-widest">{dueDate}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status === "Cleared" ? "active" : "pending"} label={status === "Cleared" ? "ผ่านเช็คแล้ว" : "รอขึ้นเงิน"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}
