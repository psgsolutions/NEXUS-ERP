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
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { saveToFirestore } from "@/lib/firebaseUtils";
import { useSystemDialog } from "@/context/DialogContext";
import Link from "next/link";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

type FinanceSubModule = "overview" | "ar" | "ap" | "gl" | "tax" | "assets";

export default function FinancePage() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceSubModule>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
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
              <span className="text-[17px] font-black text-nexus-teal mt-1 font-mono leading-none">฿4.2M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">กำไร (P&amp;L)</span>
              <span className="text-[17px] font-black text-nexus-blue mt-1 font-mono leading-none">+฿842k</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-danger/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">ลูกหนี้ค้างชำระ</span>
              <span className="text-[17px] font-black text-danger mt-1 font-mono leading-none">฿2.1M</span>
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
                    <NexusTable headers={["ลูกหนี้ (Customer)", "เลขที่ INV", "ครบกำหนด", "ยอดค้างชำระ", "สถานะ"]}>
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
                    <NexusTable headers={["เจ้าหนี้ (Supplier)", "เลขที่ PO", "กำหนดชำระ", "ยอดต้องจ่าย", "สถานะ"]}>
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
                    <NexusTable headers={["Asset ID / ชื่อสินทรัพย์", "หมวดหมู่", "มูลค่าซื้อ", "มูลค่าทางบัญชี", "สถานะ"]}>
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
      </div>
      </div>
      </div>

      {/* Finance Management Modals */}
      <JournalEntryModal 
        isOpen={activeModal === "gl"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          if (!user || !companyId) return;
          try {
            const saveOp = async () => {
              const jvRef = doc(collection(db, "journalEntries"));
              await setDoc(jvRef, {
                ...data.header,
                companyId,
                totalDebit: data.totals.dr,
                totalCredit: data.totals.cr,
                entries: data.entries,
                status: "active",
                createdAt: serverTimestamp()
              });
              await auditService.logCreate(user.uid, companyId, "FINANCE_GL", "NEW", data);
            };
            
            await saveToFirestore(saveOp());
            setActiveModal(null);
            showAlert("บันทึกรายการรายวันสำเร็จ", "System Notification", "info");
          } catch (err: any) {
            console.error(err);
            showAlert(`ซิงค์ข้อมูลล้มเหลว: ${err.message}`, "System Notification", "error");
          }
        }}
      />

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

      <ReceiptModal 
        isOpen={activeModal === "ar"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          if (!user || !companyId) return;
          try {
            const saveOp = async () => {
              const rvRef = doc(collection(db, "receivables"));
              await setDoc(rvRef, {
                ...data,
                companyId,
                status: "completed",
                createdAt: serverTimestamp()
              });
              await auditService.logCreate(user.uid, companyId, "FINANCE_AR", "NEW", data);
            };
            
            await saveToFirestore(saveOp());
            setActiveModal(null);
            showAlert("บันทึกรับชำระเงินสำเร็จ", "System Notification", "info");
          } catch (err: any) {
            console.error(err);
            showAlert(`ซิงค์ข้อมูลล้มเหลว: ${err.message}`, "System Notification", "error");
          }
        }}
      />

      <PaymentModal 
        isOpen={activeModal === "ap"} 
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          if (!user || !companyId) return;
          try {
            const saveOp = async () => {
              const pvRef = doc(collection(db, "payables"));
              await setDoc(pvRef, {
                ...data,
                companyId,
                status: "paid",
                createdAt: serverTimestamp()
              });
              await auditService.logCreate(user.uid, companyId, "FINANCE_AP", "NEW", data);
            };
            await saveToFirestore(saveOp());
            setActiveModal(null);
            showAlert("บันทึกการจ่ายชำระเงินสำเร็จ", "System Notification", "info");
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
      <NexusTableCell className="w-[150px] text-right font-black text-white/60 font-mono">{dr}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white/60 font-mono">{cr}</NexusTableCell>
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
    </div>
  );
}
