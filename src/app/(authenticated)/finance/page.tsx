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
  Unlock,
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
import { apiFetch } from "@/lib/api-client";


type FinanceSubModule = "overview" | "ar" | "ap" | "gl" | "tax" | "assets" | "bank" | "cheques";

export default function FinancePage() {
  const router = useRouter();

  const { user, companyId, role } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceSubModule>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const [modalActiveTab, setModalActiveTab] = useState("basic");
  const { showAlert } = useSystemDialog();
  const [toast, setToast] = useState({ message: "", isVisible: false });

  // สมุดรายวัน: ใต้บริษัท (AccountingEngine / API / stock engine) + root เดิม (เอกสารเก่า)
  const { data: companyJournals, loading: glLoading } = useRealtimeCollection<any>(`companies/${companyId}/journal_entries`);
  const { data: legacyJournals } = useRealtimeCollection<any>('journal_entries');
  // ลูกหนี้ = ใบกำกับภาษีที่ยังไม่ชำระ, เจ้าหนี้ = ใบสำคัญจ่ายที่ยังไม่จ่าย
  const { data: companyInvoices, loading: arLoading } = useRealtimeCollection<any>(`companies/${companyId}/invoices`);
  const { data: companyExpenses, loading: apLoading } = useRealtimeCollection<any>(`companies/${companyId}/expenses`);

  const toMs = (v: any) => !v ? 0 : v.seconds ? v.seconds * 1000 : new Date(v).getTime() || 0;
  const thDate = (v: any) => { const ms = toMs(v); return ms ? new Date(ms).toLocaleDateString('th-TH') : "-"; };
  const journalLines = (f: any) => (f.items || f.lines || []) as any[];
  const dbFinancials = [
    ...companyJournals.map((j: any) => ({ ...j, _path: `companies/${companyId}/journal_entries/${j.id}` })),
    ...legacyJournals.map((j: any) => ({ ...j, _path: `journal_entries/${j.id}` })),
  ].filter((j: any) => j.isDeleted !== true).sort((x: any, y: any) => toMs(y.date || y.createdAt) - toMs(x.date || x.createdAt));

  const dbARs = companyInvoices
    .filter((inv: any) => inv.paymentStatus !== "paid" && inv.status !== "Paid" && inv.isDeleted !== true)
    .map((inv: any) => ({
      ...inv,
      // รับชำระบางส่วนแล้ว: ใช้ยอดค้างคงเหลือ
      amount: Number(inv.balance ?? inv.grandTotal ?? inv.totalAmount ?? 0),
      status: toMs(inv.dueDate) && toMs(inv.dueDate) < Date.now() ? "overdue" : "pending",
    }));
  const dbAPs = companyExpenses
    .filter((e: any) => !String(e.status || "").toLowerCase().startsWith("paid") && e.isDeleted !== true)
    .map((e: any) => ({
      ...e,
      // จ่ายบางส่วนแล้ว: ใช้ยอดค้างคงเหลือ
      amount: Number(e.balance ?? e.totalAmount ?? 0),
      payDate: e.dueDate,
      poNo: e.poRef || e.expenseId || e.id,
      status: "pending",
    }));
  const { data: dbTaxes, loading: taxLoading } = useRealtimeCollection<any>('taxFilings');
  const { data: dbAssets, loading: assetsLoading } = useRealtimeCollection<any>('assets');
  const { data: dbBankAccounts, loading: bankLoading } = useRealtimeCollection<any>('bankAccounts');
  const { data: dbCheques, loading: chequesLoading } = useRealtimeCollection<any>('cheques');

  // Real-time Dashboard Calculations
  const totalAR = dbARs.reduce((sum: number, ar: any) => sum + (ar.amount || 0), 0);
  const totalAP = dbAPs.reduce((sum: number, ap: any) => sum + (ap.amount || 0), 0);
  const netCashflow = totalAR - totalAP;
  // กำไร(ขาดทุน) = รายได้ (หมวด 4: เครดิต-เดบิต) - ค่าใช้จ่าย/ต้นทุน (หมวด 5: เดบิต-เครดิต)
  const totalPL = dbFinancials.reduce((sum: number, f: any) => sum + journalLines(f).reduce((acc: number, l: any) => {
    const code = String(l.accountCode || l.accountId || l.code || "");
    const dr = Number(l.debit) || 0, cr = Number(l.credit) || 0;
    if (code.startsWith("4")) return acc + (cr - dr);
    if (code.startsWith("5")) return acc - (dr - cr);
    return acc;
  }, 0), 0);

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

  const financialsList = dbFinancials.map((f: any) => {
    const dr = Number(f.totalDebit ?? journalLines(f).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0));
    const cr = Number(f.totalCredit ?? journalLines(f).reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0));
    return {
      id: f.jvId || f.journalNo || f.documentNo || f.id,
      path: f._path,
      date: thDate(f.date || f.createdAt),
      desc: f.description || "-",
      dr: dr.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
      cr: cr.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
      status: (String(f.status || "posted").toLowerCase() === "draft" ? "pending" : "active") as "pending" | "active"
    };
  });

  const arList = dbARs.map(ar => ({
    customer: ar.customerName || ar.customerId || "Unknown",
    inv: ar.invoiceNo || ar.documentNo || ar.invoiceId || ar.id || "-",
    due: thDate(ar.dueDate),
    amount: `฿${Number(ar.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
    status: ar.status || "pending"
  }));

  const apList = dbAPs.map(ap => ({
    supplier: ap.supplierName || ap.supplierId || "Unknown",
    po: ap.poNo || ap.documentNo || ap.poId || ap.id || "-",
    payDate: thDate(ap.payDate),
    amount: `฿${Number(ap.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
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
    id: a.assetCode || a.assetNo || a.code || a.id || "AST-UNKNOWN",
    name: a.name || "Unknown Asset",
    cat: a.category || "UNKNOWN",
    purchase: `฿${Number(a.purchasePrice ?? a.purchaseValue ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
    bookValue: `฿${Number(a.netBookValue ?? a.bookValue ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
    status: a.status || "active"
  }));

  const bankList = dbBankAccounts.map(b => ({
    id: b.bankCode || b.bankId || b.code || b.id || "BNK-UNKNOWN",
    bankName: b.bankName || "Unknown Bank",
    accountNo: b.accountNo || "-",
    balance: b.balance ? `฿${b.balance.toLocaleString()}` : "฿0",
    status: b.status || "active"
  }));

  const chequesList = dbCheques.map(c => ({
    id: c.chequeCode || c.code || c.id || "CHQ-UNKNOWN",
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
    { id: "gl", label: "สมุดรายวัน", icon: <FileText size={14} /> },
    { id: "tax", label: "ภาษี", icon: <Percent size={14} /> },
    { id: "bank", label: "สมุดธนาคาร", icon: <Landmark size={14} /> },
    { id: "cheques", label: "เช็ค", icon: <CreditCard size={14} /> },
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
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue shadow-lg border border-nexus-blue/10">
            <Wallet size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ศูนย์บริหารการเงิน</h1>
            <p className="text-sm font-medium text-white/30 uppercase mt-1 tracking-widest leading-none">Finance &amp; Accounting Hub</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Wallet size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">กระแสเงินสดสุทธิ</span>
              <span className={cn("text-[17px] font-bold mt-0.5 font-mono leading-none", netCashflow >= 0 ? "text-nexus-teal" : "text-danger")}>
                ฿{netCashflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">กำไร (P&amp;L)</span>
              <span className={cn("text-[17px] font-bold mt-0.5 font-mono leading-none", totalPL >= 0 ? "text-nexus-blue" : "text-danger")}>
                ฿{totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-danger/30 hover:bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center text-danger border border-danger/20 shrink-0">
              <AlertCircle size={16} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">ลูกหนี้ค้างชำระ</span>
              <span className="text-[17px] font-bold text-danger mt-0.5 font-mono leading-none">
                ฿{totalAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation & Actions */}
      <section className="px-6 min-h-[56px] py-2 bg-black/10 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <PillTabs className="flex-1 min-w-[min(100%,520px)]"
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id: any) => setActiveTab(id)}
        />
        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
           <PillButton variant="confirm" className="h-8 px-5 rounded-full text-[11px] uppercase tracking-widest font-black" onClick={() => router.push("/finance/period-close/new")}>
             <ShieldCheck size={14} className="mr-1.5" />
             ปิดงวดบัญชี
           </PillButton>

           {(activeTab === "overview" || activeTab === "gl") && (
             <PillButton variant="primary" onClick={() => router.push("/finance/journal-entries/new")} className="h-8 px-5 rounded-full shadow-neon-teal text-[11px] uppercase tracking-widest font-black">
               <Plus size={14} className="mr-1.5" />
               บันทึกรายวัน
             </PillButton>
           )}
           {activeTab === "ar" && (
             <PillButton variant="save" onClick={() => router.push("/finance/receipts/new")} className="h-8 px-5 rounded-full shadow-neon-teal text-[11px] uppercase tracking-widest font-black">
               <Plus size={14} className="mr-1.5" />
               รับชำระเงิน
             </PillButton>
           )}
           {activeTab === "ap" && (
             <PillButton variant="primary" onClick={() => router.push("/finance/payments/new")} className="h-8 px-5 rounded-full shadow-neon-teal text-[11px] uppercase tracking-widest font-black">
               <Plus size={14} className="mr-1.5" />
               จ่ายชำระเงิน
             </PillButton>
           )}
           {activeTab === "tax" && (
             <PillButton variant="confirm" onClick={() => router.push("/finance/tax-filing/new")} className="h-8 px-5 rounded-full shadow-neon-blue text-[11px] uppercase tracking-widest font-black">
               <FileText size={14} className="mr-1.5" />
               ยื่นแบบภาษี
             </PillButton>
           )}
           {activeTab === "assets" && (
             <PillButton variant="warning" onClick={() => router.push("/finance/assets/depreciation/new")} className="h-8 px-5 rounded-full shadow-neon-warning text-[11px] uppercase tracking-widest font-black">
               <Calculator size={14} className="mr-1.5" />
               ประมวลผลค่าเสื่อม
             </PillButton>
           )}
        </div>
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
                <div className="hidden xl:block">
                   <DocumentFlowStepper activeTab={activeTab} onStepClick={(id) => setActiveTab(id as any)} steps={financeFlowSteps} />
                </div>
              )}
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
            <GlassCard accentColor="emerald" className="p-0 overflow-hidden min-h-[640px] flex flex-col justify-between">
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
                        <FinancialRow key={f.path || i} {...f} />
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
                    <NexusTable headers={["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "หมวดหมู่", "ราคาประเมิน", "ราคาทางบัญชี", "สถานะ"]}>
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
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px] space-y-7 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
           <GlassCard accentColor="blue" className="p-5">
              <h4 className="text-xs font-bold text-nexus-blue uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-nexus-blue/10 border border-nexus-blue/30 text-[10px] text-nexus-blue font-mono font-bold">01</span>
                ประมาณการกระแสเงินสด
              </h4>
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
         <p className="font-mono text-xs text-warning font-medium tracking-tighter text-center w-full">{id}</p>
         <p className="w-full font-bold text-white/80">{name}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest">{cat}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers">{purchase}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-warning mono-numbers">{bookValue}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center"><StatusBadge status={status} label="ปกติ" /></NexusTableCell>
    </NexusTableRow>
  );
}

function FinancialRow({ id, path, date, desc, dr, cr, status }: { id: string, path: string, date: string, desc: string, dr: string, cr: string, status: "active" | "pending" }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <Link href={`/finance/journal/${encodeURIComponent(path)}`} className="block">
           <p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter text-center w-full">{id}</p>
        </Link>
      </NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="w-full font-bold text-white/80 group-hover:text-white transition-colors">{desc}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white/60 font-mono">{dr}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white/60 font-mono">{cr}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <StatusBadge status={status} label={status === "pending" ? "รอตรวจ (ร่าง)" : "ลงบัญชีแล้ว"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ARRow({ customer, inv, due, amount, status }: { customer: string, inv: string, due: string, amount: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-full font-bold text-white">{customer}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-[10px] text-nexus-teal tracking-tighter">{inv}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest">{due}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center"><StatusBadge status={status === "overdue" ? "danger" : "pending"} label={status === "pending" ? "รอชำระ" : "เกินกำหนด"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function APRow({ supplier, po, payDate, amount, status }: { supplier: string, po: string, payDate: string, amount: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-full font-bold text-white">{supplier}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-[10px] text-nexus-blue tracking-tighter">{po}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest">{payDate}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center"><StatusBadge status="pending" label="รอจ่าย" /></NexusTableCell>
    </NexusTableRow>
  );
}

function TaxRow({ type, month, base, tax, status }: { type: string, month: string, base: string, tax: string, status: any }) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-full font-bold text-white">{type}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest">{month}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white/20 mono-numbers">{base}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-nexus-teal mono-numbers">{tax}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center"><StatusBadge status={status} label="สมบูรณ์" /></NexusTableCell>
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
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
         <p className="font-mono text-xs text-nexus-blue font-medium tracking-tighter text-center w-full">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="w-full font-bold text-white/80">{bankName}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-mono text-[11px] text-white/40 tracking-widest">{accountNo}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers">{balance}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center"><StatusBadge status={status} label={status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} /></NexusTableCell>
    </NexusTableRow>
  );
}

function ChequeRow({ id, chequeNo, type, dueDate, amount, status }: any) {
  return (
    <NexusTableRow>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
         <p className="font-mono text-xs text-warning font-medium tracking-tighter text-center w-full">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="w-full font-bold text-white/80">{chequeNo}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center font-bold text-[11px] uppercase tracking-widest text-white/40">{type}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center text-sm font-medium text-white/40 uppercase tracking-widest">{dueDate}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[1%] whitespace-nowrap text-center">
        <StatusBadge status={status === "Cleared" ? "active" : "pending"} label={status === "Cleared" ? "ผ่านเช็คแล้ว" : "รอขึ้นเงิน"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}
