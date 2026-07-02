// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Plus,
  Search,
  FileText, 
  Target, 
  TrendingUp,
  MessageSquare, 
  Bell, 
  Sparkles,
  Building2,
  ClipboardList,
  ChevronDown,
  CreditCard,
  MapPin,
  UserCheck,
  ShieldCheck,
  Receipt,
  Trash2,
  Filter,
  Landmark,
  User,
  RefreshCw,
  CalendarDays,
  Percent,
  Printer
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect,
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
  NexusDataField,
  NexusSearchInput
} from "@/components/ui/Base";
import { DocumentFlowStepper } from "@/components/ui/DocumentFlowStepper";
import { OpportunityScorer } from "@/components/sales/OpportunityScorer";
import { CustomerModal } from "@/components/commerce/CustomerModal";
import { QuotationModal } from "@/components/commerce/QuotationModal";
import { SalesOrderModal } from "@/components/commerce/SalesOrderModal";
import { DocumentViewerModal } from "@/components/commerce/DocumentViewerModal";
import { BillingNoteModal } from "@/components/commerce/BillingNoteModal";
import { CNDNModal } from "@/components/commerce/CNDNModal";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { SecureDeleteAction } from "@/components/ui/SecureDeleteAction";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase-client";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { createQuotation, convertToSalesOrder, createSalesOrder, autoGenerateOrdersFromSO, createInvoiceFromSO, createReceiptFromInvoice } from "@/lib/sales-service";
import { nexusSequenceEngine } from "@/lib/sequence-engine";


const MOCK_QUOTATIONS = [
  { id: 'QT-2606-0001', customerNameRaw: 'โรงพยาบาลตากสิน', title: 'ระบบเครือข่ายไร้สาย (Wi-Fi 6)', total: '฿1,250,000', status: 'Approved' },
  { id: 'QT-2606-0002', customerNameRaw: 'บริษัท พีเอสจี โซลูชั่นส์ จำกัด', title: 'ติดตั้งกล้องวงจรปิด AI', total: '฿850,000', status: 'Draft' },
  { id: 'QT-2606-0003', customerNameRaw: 'ศูนย์ประชุมแห่งชาติ', title: 'ระบบจัดการอาคารอัจฉริยะ (BMS)', total: '฿3,400,000', status: 'Approved' }
];

const MOCK_ORDERS = [
  { id: 'SO-2606-0001', customerNameRaw: 'โรงพยาบาลตากสิน', date: '15 มิ.ย. 2026', total: '฿1,250,000', status: 'Confirmed' },
  { id: 'SO-2606-0002', customerNameRaw: 'ศูนย์ประชุมแห่งชาติ', date: '18 มิ.ย. 2026', total: '฿3,400,000', status: 'Pending' }
];

const MOCK_INVOICES = [
  { id: 'INV-2606-001', soRef: 'SO-2606-0001', customerNameRaw: 'โรงพยาบาลตากสิน', date: '20 มิ.ย. 2026', dueDate: '20 ก.ค. 2026', total: '฿500,000', status: 'Pending' }
];

const MOCK_BILLING = [
  { id: 'BL-2606-001', customerNameRaw: 'โรงพยาบาลตากสิน', date: '25 มิ.ย. 2026', dueDate: '25 ก.ค. 2026', total: '฿500,000', status: 'Active' }
];

const MOCK_RECEIPTS = [
  { id: 'REC-2605-089', customerNameRaw: 'บริษัท เอบีซี จำกัด', date: '10 พ.ค. 2026', total: '฿200,000', status: 'Paid' }
];

const MOCK_CNDN = [];


type SalesSubModule = "crm" | "opportunities" | "quotations" | "orders" | "invoices" | "billing" | "receipts" | "cndn";

export default function SalesPage() {
  const { user, companyId, role: userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<SalesSubModule>("quotations");
  const [activeModal, setActiveModal] = useState<"customer" | "quotation" | "order" | "print" | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "quotations", label: "ใบเสนอราคา", icon: <FileText size={14} /> },
    { id: "orders", label: "ใบสั่งขาย", icon: <ClipboardList size={14} /> },
    { id: "invoices", label: "ใบแจ้งหนี้", icon: <Receipt size={14} /> },
    { id: "billing", label: "ใบวางบิล", icon: <FileText size={14} /> },
    { id: "receipts", label: "ใบเสร็จรับเงิน", icon: <Landmark size={14} /> },
    { id: "cndn", label: "ใบลดหนี้/เพิ่มหนี้", icon: <Receipt size={14} /> },
    { id: "crm", label: "ข้อมูลลูกค้า", icon: <Users size={14} /> },
    { id: "opportunities", label: "โอกาสการขาย", icon: <Target size={14} /> },
  ];

  const salesFlowSteps = [
    { id: "quotations", label: "ใบเสนอราคา", icon: <FileText size={14} /> },
    { id: "orders", label: "ใบสั่งขาย", icon: <ClipboardList size={14} /> },
    { id: "invoices", label: "ใบแจ้งหนี้", icon: <Receipt size={14} /> },
    { id: "billing", label: "ใบวางบิล", icon: <FileText size={14} /> },
    { id: "receipts", label: "ใบเสร็จรับเงิน", icon: <Landmark size={14} /> },
  ];

  const [customersList, setCustomersList] = useState<any[]>([]);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [billingList, setBillingList] = useState<any[]>([]);
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [cndnList, setCndnList] = useState<any[]>([]);
  const [opportunitiesList, setOpportunitiesList] = useState<any[]>([]);

  useEffect(() => {
    if (customersList.length > 0) {
      const applyFallbacks = (raw: any) => ({
        ...raw,
        displayId: raw.customer_code || raw.customerId || raw.id,
        displayTaxId: raw.tax_id || raw.taxId || "-",
        industry: raw.industry || raw.business_group || raw.businessType || "อื่นๆ",
        status: raw.status || "active",
        credit_term_days: parseInt(String(raw.credit_term_days ?? raw.creditTermDays ?? raw.credit_term ?? raw.paymentTerms ?? raw.payment_term ?? 0).match(/\d+/)?.[0] || "0", 10)
      });

      if (!selectedCustomer) {
        setSelectedCustomer(applyFallbacks(customersList[0]));
      } else {
        const updated = customersList.find(c => c.id === selectedCustomer.id);
        if (updated) {
          const mappedUpdated = applyFallbacks(updated);
          if (JSON.stringify(mappedUpdated) !== JSON.stringify(selectedCustomer)) {
            setSelectedCustomer(mappedUpdated);
          }
        }
      }
    }
  }, [customersList, selectedCustomer]);

  useEffect(() => {
    if (!companyId) return;

    // Real-time listener for Customers
    const qCust = query(
      collection(db, `companies/${companyId}/customers`)
    );
    const unsubCust = onSnapshot(qCust, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setCustomersList(list);
    });

    // Real-time listener for Quotations
    const qQuote = query(
      collection(db, `companies/${companyId}/quotations`)
    );
    const unsubQuote = onSnapshot(qQuote, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customerNameRaw: d.customerId || d.customer || "Hospital A",
          title: d.subject || d.title || "Upgrade LED Wall",
          value: `฿${(d.totalRevenue || 0).toLocaleString()}`,
          status: d.status === "Approved" ? "active" : d.status === "Draft" ? "pending" : "danger",
          ...d
        });
      });
      setQuotationsList(list.length > 0 ? list : MOCK_QUOTATIONS);
    });

    // Real-time listener for Sales Orders
    const qOrder = query(
      collection(db, `companies/${companyId}/sales_orders`)
    );
    const unsubOrder = onSnapshot(qOrder, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customerNameRaw: d.customer || d.customerId || "PSG Solutions",
          date: d.convertedAt ? new Date(d.convertedAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          total: `฿${(d.totalRevenue || 0).toLocaleString()}`,
          status: d.status === "Confirmed" ? "paid" : d.status === "Pending" ? "partial" : "partial",
          ...d
        });
      });
      setOrdersList(list.length > 0 ? list : MOCK_ORDERS);
    });

    // Real-time listener for Invoices
    const qInv = query(
      collection(db, `companies/${companyId}/invoices`)
    );
    const unsubInv = onSnapshot(qInv, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customerNameRaw: d.customer || d.customerId || "Unknown",
          date: d.issuedAt ? new Date(d.issuedAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          total: `฿${(d.totalRevenue || 0).toLocaleString()}`,
          status: d.status === "Paid" ? "paid" : "pending",
          ...d
        });
      });
      setInvoicesList(list.length > 0 ? list : MOCK_INVOICES);
    });

    // Real-time listener for Receipts
    const qRec = query(
      collection(db, `companies/${companyId}/receipts`)
    );
    const unsubRec = onSnapshot(qRec, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customerNameRaw: d.customer || d.customerId || "Unknown",
          date: d.paymentDate ? new Date(d.paymentDate.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          total: `฿${(d.totalRevenue || 0).toLocaleString()}`,
          status: "paid",
          ...d
        });
      });
      setReceiptsList(list.length > 0 ? list : MOCK_RECEIPTS);
    });

    // Real-time listener for Billing Notes
    const qBill = query(
      collection(db, `companies/${companyId}/billing_notes`)
    );
    const unsubBill = onSnapshot(qBill, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customerNameRaw: d.customer || d.customerId || "Unknown",
          date: d.issueDate ? new Date(d.issueDate.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          dueDate: d.dueDate ? new Date(d.dueDate.seconds * 1000).toISOString().split('T')[0] : "-",
          total: `฿${(d.totalAmount || 0).toLocaleString()}`,
          status: d.status || "active",
          ...d
        });
      });
      setBillingList(list.length > 0 ? list : MOCK_BILLING);
    });

    // Real-time listener for CN/DN
    const qCndn = query(
      collection(db, `companies/${companyId}/cndn`)
    );
    const unsubCndn = onSnapshot(qCndn, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customerNameRaw: d.customer || d.customerId || "Unknown",
          date: d.issueDate ? new Date(d.issueDate.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          total: `฿${(d.totalAmount || 0).toLocaleString()}`,
          type: d.type || "CN",
          status: d.status || "active",
          ...d
        });
      });
      setCndnList(list.length > 0 ? list : MOCK_CNDN);
    });

    // Real-time listener for Opportunities
    const qOpp = query(
      collection(db, `companies/${companyId}/opportunities`)
    );
    const unsubOpp = onSnapshot(qOpp, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id,
          customerName: d.customerName || d.customer || "Unknown",
          projectValue: d.projectValue || d.value || 0,
          lastContact: d.lastContact || "ไม่ทราบ",
          aiScore: d.aiScore || d.score || 0,
          sentiment: d.sentiment || "Neutral",
          nextStep: d.nextStep || "N/A",
          ...d
        });
      });
      setOpportunitiesList(list);
    });

    return () => {
      unsubCust();
      unsubQuote();
      unsubOrder();
      unsubInv();
      unsubRec();
      unsubBill();
      unsubCndn();
      unsubOpp();
    };
  }, [companyId]);

  const filteredCustomers = customersList.filter(c => 
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.customerId || c.customer_code || c.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(c => ({
    ...c,
    displayId: c.customer_code || c.customerId || c.id,
    displayTaxId: c.tax_id || c.taxId || "-",
    industry: c.industry || c.business_group || c.businessType || "อื่นๆ",
    status: c.status || "active",
    credit_term_days: parseInt(String(c.credit_term_days ?? c.creditTermDays ?? c.credit_term ?? c.paymentTerms ?? c.payment_term ?? 0).match(/\d+/)?.[0] || "0", 10)
  }));

  const getCustomerName = (id: string) => {
    if (!id) return "-";
    const cust = customersList.find(c => c.id === id || c.customerId === id);
    return cust ? (cust.name || cust.displayId) : id;
  };

  const filteredQuotations = quotationsList.filter(q => 
    (q.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (q.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(q => ({
    ...q,
    customer: getCustomerName(q.customerNameRaw)
  }));

  const filteredOrders = ordersList.filter(o => 
    (o.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(o => ({
    ...o,
    customer: getCustomerName(o.customerNameRaw)
  }));

  const filteredInvoices = invoicesList.filter(inv => 
    (inv.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (inv.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(inv => ({
    ...inv,
    customer: getCustomerName(inv.customerNameRaw)
  }));

  const filteredReceipts = receiptsList.filter(rec => 
    (rec.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (rec.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(rec => ({
    ...rec,
    customer: getCustomerName(rec.customerNameRaw)
  }));

  const filteredBilling = billingList.filter(b => 
    (b.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(b => ({
    ...b,
    customer: getCustomerName(b.customerNameRaw)
  }));

  const filteredCndn = cndnList.filter(c => 
    (c.customerNameRaw || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  ).map(c => ({
    ...c,
    customer: getCustomerName(c.customerNameRaw)
  }));



  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ทะเบียนลูกค้าและการขาย</h1>
            <p className="text-[11px] font-medium text-white/30 uppercase mt-1.5 tracking-widest leading-none">CRM &amp; Sales Management System</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Target size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">ยอดขายเป้าหมาย</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-1 mono-numbers leading-none">฿2.4M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">Win Rate</span>
              <span className="text-[17px] font-bold text-nexus-blue mt-1 mono-numbers leading-none">68%</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-white/20 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">กิจกรรมวันนี้</span>
              <span className="text-[17px] font-bold text-white mt-1 mono-numbers leading-none">12</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation (Stepper) */}
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
      
      <div className="flex flex-col lg:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-3">
          <div className="space-y-3">

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
               <div className="flex items-center gap-4 shrink-0 min-w-[250px]">
                  <div className="w-12 h-12 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 flex items-center justify-center text-nexus-teal">
                    {activeTab === "crm" ? <Users size={24} /> : 
                     activeTab === "opportunities" ? <Target size={24} /> :
                     activeTab === "quotations" ? <FileText size={24} /> :
                     activeTab === "orders" ? <ClipboardList size={24} /> :
                     activeTab === "invoices" ? <Receipt size={24} /> :
                     activeTab === "billing" ? <FileText size={24} /> :
                     activeTab === "receipts" ? <Landmark size={24} /> : <FileText size={24} />}
                  </div>
                  <div className="space-y-0.5">
                     <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">
                       {activeTab === "crm" ? "ระบบบริหารจัดการความสัมพันธ์ลูกค้า" : "ระบบจัดการงานขายและรายได้"}
                     </p>
                     <h2 className="text-xl font-bold text-white uppercase">
                        {activeTab === "crm" && "ข้อมูลลูกค้า"}
                        {activeTab === "opportunities" && "โอกาสการขาย"}
                        {activeTab === "quotations" && "ใบเสนอราคา"}
                        {activeTab === "orders" && "ใบสั่งขาย"}
                        {activeTab === "invoices" && "ใบแจ้งหนี้"}
                        {activeTab === "billing" && "ใบวางบิล"}
                        {activeTab === "receipts" && "ใบเสร็จรับเงิน"}
                        {activeTab === "cndn" && "ลดหนี้ / เพิ่มหนี้"}
                     </h2>
                  </div>
               </div>

               {/* Document Sequence Visualizer */}
              {salesFlowSteps.some(s => s.id === activeTab) && (
                <div className="flex-1 w-full max-w-3xl px-6 py-2 hidden xl:block overflow-hidden">
                   <DocumentFlowStepper activeTab={activeTab} onStepClick={(id) => setActiveTab(id as any)} steps={salesFlowSteps} />
                </div>
              )}

               <div className="flex gap-3 shrink-0">
                  {activeTab === "crm" && (
                    <PillButton onClick={() => { setSelectedItem(null); setSelectedCustomer(null); setActiveModal("customer"); }} className="px-6 rounded-full shadow-neon-teal">
                      <Plus size={18} />
                      เพิ่มลูกค้าใหม่
                    </PillButton>
                  )}
                  {activeTab === "quotations" && (
                    <PillButton onClick={() => { setSelectedItem(null); setActiveModal("quotation"); }} className="px-6 rounded-full shadow-neon-teal">
                      <FileText size={18} />
                      สร้างใบเสนอราคา
                    </PillButton>
                  )}
                  {activeTab === "orders" && (
                    <PillButton onClick={() => { setSelectedItem(null); setActiveModal("order"); }} className="px-6 rounded-full shadow-neon-teal">
                      <Receipt size={18} />
                      เปิดใบสั่งขาย
                    </PillButton>
                  )}
                  {activeTab === "invoices" && (
                    <PillButton onClick={() => { showToast("เลือกใบสั่งขายที่ต้องการสร้างใบแจ้งหนี้จากแท็บ SO"); setActiveTab("orders"); }} className="px-6 rounded-full shadow-neon-blue">
                      <Receipt size={18} />
                      ดึงจาก SO
                    </PillButton>
                  )}
                  {activeTab === "receipts" && (
                    <PillButton onClick={() => { showToast("เลือกใบแจ้งหนี้ที่ต้องการรับชำระเงินจากแท็บ INV"); setActiveTab("invoices"); }} className="px-6 rounded-full shadow-neon-teal">
                      <Landmark size={18} />
                      รับชำระจาก INV
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
                  <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full border-white/5 hover:border-nexus-teal/30 hover:bg-nexus-teal/5">
                    <Filter size={18} className="text-white/40" />
                  </PillButton>
               </div>
            </div>

            {/* CRM / Quotation / Order Content - Conditional Rendering wrapped in standard GlassCard viewport */}
            <GlassCard className="p-0 overflow-hidden border-white/5 min-h-[640px] flex flex-col justify-between bg-black/40">
              <div className="overflow-x-auto custom-scrollbar flex-1 w-full p-2">
                {activeTab === "crm" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["รหัสลูกค้า", "ชื่อนิติบุคคล / ลูกค้า (ชื่อทางการ)", "ประเภทธุรกิจ", "เลขผู้เสียภาษี", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[120px]", "w-auto", "w-[160px]", "w-[160px]", "w-[100px]", "w-[80px]"]}
                    >
                      {filteredCustomers.map(cus => (
                        <CustomerRow 
                          key={cus.id}
                          id={cus.displayId} 
                          name={cus.name || "-"} 
                          industry={cus.industry || "-"}
                          taxId={cus.displayTaxId} 
                          status={cus.status || "active"} 
                          role={userRole || ""} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedCustomer(cus)} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "opportunities" && (
                  <OpportunityScorer leads={opportunitiesList.filter(l => (l.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()))} />
                )}

                {activeTab === "quotations" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["เลขที่ใบเสนอราคา", "ลูกค้า / ไซต์งาน", "หัวข้อโครงการ", "มูลค่าสุทธิ", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[140px]", "w-auto", "w-auto", "w-[150px]", "w-[140px]", "w-[100px]"]}
                    >
                      {filteredQuotations.map(q => (
                        <QuotationRow 
                          key={q.id}
                          id={q.id} 
                          customer={q.customer} 
                          title={q.title} 
                          value={q.value} 
                          status={q.status} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedItem(q)} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "orders" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["เลขที่ใบสั่งขาย", "ลูกค้า", "สืบหน้าจากงาน", "ยอดรวม", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[140px]", "w-auto", "w-[180px]", "w-[150px]", "w-[140px]", "w-[100px]"]}
                    >
                      {filteredOrders.map(so => (
                        <SalesOrderRow 
                          key={so.id}
                          id={so.id} 
                          customer={so.customer} 
                          date={so.date} 
                          total={so.total} 
                          status={so.status} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedItem(so)} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "invoices" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["เลขที่ใบแจ้งหนี้", "อ้างอิง SO", "ลูกค้า", "วันที่ออก", "ครบกำหนด", "ยอดรวม", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[140px]", "w-[140px]", "w-auto", "w-[120px]", "w-[120px]", "w-[150px]", "w-[120px]", "w-[100px]"]}
                    >
                      {filteredInvoices.map(inv => (
                        <InvoiceRow 
                          key={inv.id}
                          id={inv.id} 
                          soRef={inv.soId || "-"}
                          customer={inv.customer} 
                          date={inv.date} 
                          dueDate={inv.dueDate || "-"}
                          total={inv.total} 
                          status={inv.status} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedItem(inv)} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "billing" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["เลขที่ใบวางบิล", "ลูกค้า", "วันที่ออก", "นัดรับชำระ", "ยอดรวม", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[140px]", "w-auto", "w-[120px]", "w-[120px]", "w-[150px]", "w-[120px]", "w-[100px]"]}
                    >
                      {filteredBilling.map(bill => (
                        <BillingNoteRow 
                          key={bill.id}
                          id={bill.id} 
                          customer={bill.customer} 
                          date={bill.date} 
                          dueDate={bill.dueDate}
                          total={bill.total} 
                          status={bill.status} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedItem(bill)} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "cndn" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["รหัสเอกสาร", "ลูกค้า", "ประเภท", "วันที่ออก", "ยอดรวม", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[140px]", "w-auto", "w-[100px]", "w-[120px]", "w-[150px]", "w-[120px]", "w-[100px]"]}
                    >
                      {filteredCndn.map(cndn => (
                        <CndnRow 
                          key={cndn.id}
                          id={cndn.id} 
                          customer={cndn.customer} 
                          type={cndn.type}
                          date={cndn.date} 
                          total={cndn.total} 
                          status={cndn.status} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedItem(cndn)} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "receipts" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable 
                      headers={["เลขที่ใบเสร็จ", "อ้างอิง INV", "ลูกค้า", "วันที่รับชำระ", "ยอดรวม", "สถานะ", "จัดการ"]}
                      columnWidths={["w-[140px]", "w-[140px]", "w-auto", "w-[120px]", "w-[150px]", "w-[120px]", "w-[100px]"]}
                    >
                      {filteredReceipts.map(rec => (
                        <ReceiptRow 
                          key={rec.id}
                          id={rec.id} 
                          invRef={rec.invoiceId || "-"}
                          customer={rec.customer} 
                          date={rec.date} 
                          total={rec.total} 
                          status={rec.status} 
                          companyId={companyId || "COM-NEXUS-01"}
                          onClick={() => setSelectedItem(rec)} 
                        />
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

        <div className="space-y-3">
           {activeTab === "crm" && selectedCustomer ? (
             <GlassCard className="p-4 border-white/10 bg-nexus-blue/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{selectedCustomer.name}</h4>
                    <p className="text-[11px] text-white/50">{selectedCustomer.displayId}</p>
                  </div>
                  <StatusBadge status={selectedCustomer.status || "active"} label={selectedCustomer.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
                </div>
                
                <div className="space-y-3 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <Building2 size={16} className="text-nexus-blue shrink-0" />
                     <span>
                       ประเภท: {selectedCustomer.type === "person" ? "บุคคลธรรมดา" : selectedCustomer.type === "government" ? "หน่วยงานราชการ" : "นิติบุคคล"} 
                       {" "}•{" "} 
                       {selectedCustomer.branch_type === "branch" ? `สาขา ${selectedCustomer.branch_code || "-"}` : "สำนักงานใหญ่"}
                     </span>
                   </div>
                   <div className="flex items-start gap-3">
                     <MapPin size={16} className="text-nexus-teal shrink-0 mt-0.5" />
                     <span>
                       {selectedCustomer.addresses?.[0] 
                         ? `${selectedCustomer.addresses[0].addressNo || ""} ${selectedCustomer.addresses[0].moo ? `ม.${selectedCustomer.addresses[0].moo}` : ""} ${selectedCustomer.addresses[0].subDistrict || ""} ${selectedCustomer.addresses[0].district || ""} ${selectedCustomer.addresses[0].province || ""} ${selectedCustomer.addresses[0].zipCode || ""}`
                         : "ไม่ได้ระบุที่อยู่"
                       }
                     </span>
                   </div>
                   <div className="flex items-center gap-3">
                     <Target size={16} className="text-nexus-blue shrink-0" />
                     <span>กลุ่มธุรกิจ: {selectedCustomer.industry || selectedCustomer.business_group || selectedCustomer.businessType || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <FileText size={16} className="text-white/40 shrink-0" />
                     <span className="font-mono">TAX ID: {selectedCustomer.tax_id || selectedCustomer.taxId || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CreditCard size={16} className="text-nexus-purple shrink-0" />
                     <span>เครดิตเทอม: {parseInt(String(selectedCustomer.credit_term_days ?? selectedCustomer.creditTermDays ?? selectedCustomer.credit_term ?? selectedCustomer.paymentTerms ?? selectedCustomer.payment_term ?? 0).match(/\d+/)?.[0] || "0", 10)} วัน (วงเงิน {parseInt(String(selectedCustomer.credit_limit ?? selectedCustomer.creditLimit ?? 0).match(/\d+/)?.[0] || "0", 10).toLocaleString()} ฿)</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <RefreshCw size={16} className="text-nexus-teal shrink-0" />
                     <span>รอบวางบิล: {selectedCustomer.billing_cycle || selectedCustomer.billingCycle || "ตามรอบเครดิต"}</span>
                   </div>
                   {(selectedCustomer.bank_name || selectedCustomer.bankName || selectedCustomer.bank_account || selectedCustomer.bankAccount) && (
                     <div className="flex items-center gap-3">
                       <Landmark size={16} className="text-warning shrink-0" />
                       <span>{selectedCustomer.bank_name || selectedCustomer.bankName || "-"} • <span className="font-mono text-white">{selectedCustomer.bank_account || selectedCustomer.bankAccount || selectedCustomer.accountNo || "-"}</span></span>
                     </div>
                   )}
                   {(selectedCustomer.phone || selectedCustomer.email || selectedCustomer.website) && (
                     <div className="flex items-start gap-3">
                       <MessageSquare size={16} className="text-white/40 shrink-0 mt-0.5" />
                       <div className="flex flex-col gap-1">
                         {selectedCustomer.phone && <span>โทร: {selectedCustomer.phone}</span>}
                         {selectedCustomer.email && <span>อีเมล: {selectedCustomer.email}</span>}
                         {selectedCustomer.website && <span>เว็บไซต์: {selectedCustomer.website}</span>}
                       </div>
                     </div>
                   )}
                   {selectedCustomer.contacts && selectedCustomer.contacts.length > 0 && (
                     <div className="flex items-start gap-3 pt-3 border-t border-white/5">
                       <User size={16} className="text-nexus-blue shrink-0 mt-0.5" />
                       <div className="flex flex-col gap-1">
                         <span className="text-white/40 text-[11px] uppercase tracking-wider">ผู้ติดต่อหลัก</span>
                         <span>{selectedCustomer.contacts[0].name || "-"} {selectedCustomer.contacts[0].position ? `(${selectedCustomer.contacts[0].position})` : ""}</span>
                         <span className="font-mono text-nexus-teal">{selectedCustomer.contacts[0].phone || "-"}</span>
                       </div>
                     </div>
                   )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => { setSelectedItem(selectedCustomer); setActiveModal("customer"); }} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <FileText size={14} className="mr-2" />
                     ดู / แก้ไขข้อมูลทั้งหมด
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedCustomer(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : activeTab === "quotations" && selectedItem ? (
             <GlassCard className="p-4 border-white/10 bg-nexus-teal/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{selectedItem.title}</h4>
                    <p className="text-[11px] text-white/50">{selectedItem.id}</p>
                  </div>
                  <StatusBadge status={selectedItem.status === "Approved" ? "active" : selectedItem.status === "Draft" ? "pending" : "danger"} label={selectedItem.status === "Approved" ? "ส่งแล้ว" : selectedItem.status === "Draft" ? "ร่าง" : selectedItem.status} />
                </div>
                
                <div className="space-y-3 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <Building2 size={16} className="text-nexus-teal shrink-0" />
                     <span>ลูกค้า: <span className="text-white">{selectedItem.customer || selectedItem.customerNameRaw || selectedItem.customerId || "-"}</span></span>
                   </div>
                   <div className="flex items-center gap-3">
                     <User size={16} className="text-nexus-blue shrink-0" />
                     <span>พนักงานขาย: {selectedItem.salesPerson || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CalendarDays size={16} className="text-white/40 shrink-0" />
                     <span>วันที่เอกสาร: {selectedItem.date || selectedItem.issueDate || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <ShieldCheck size={16} className="text-warning shrink-0" />
                     <span>ยืนราคาถึง: {selectedItem.validUntil || selectedItem.expiryDate || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <RefreshCw size={16} className="text-nexus-purple shrink-0" />
                     <span>เครดิตเทอม: {selectedItem.paymentTerms || selectedItem.credit_term || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <Percent size={16} className="text-white/40 shrink-0" />
                     <span>รูปแบบภาษี: {selectedItem.taxMode || selectedItem.vat_type || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <ClipboardList size={16} className="text-nexus-teal shrink-0" />
                     <span>จำนวนรายการ: {selectedItem.items?.length || 0} รายการ</span>
                   </div>
                   <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                     <CreditCard size={16} className="text-nexus-blue shrink-0" />
                     <span className="font-mono text-[14px] text-white">ยอดสุทธิ: {selectedItem.financials?.total ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format : (selectedItem.value || "฿ 0.00")}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => setActiveModal("quotation")} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <FileText size={14} className="mr-2" />
                     ดู / แก้ไขใบเสนอราคา
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setActiveModal("print")} className="w-full border-white/20 hover:border-nexus-blue shadow-none">
                     <Printer size={14} className="mr-2" />
                     พิมพ์ / ดูภาพก่อนพิมพ์
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedItem(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : activeTab === "orders" && selectedItem ? (
             <GlassCard className="p-4 border-white/10 bg-nexus-blue/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{selectedItem.customer}</h4>
                    <p className="text-[11px] text-white/50">{selectedItem.id}</p>
                  </div>
                  <StatusBadge status={selectedItem.status === "Confirmed" ? "paid" : "partial"} label={selectedItem.status === "Confirmed" ? "ชำระเงินแล้ว" : "รอดำเนินการ"} />
                </div>
                
                <div className="space-y-3 text-xs font-medium text-white/70">
                   <div className="flex items-center gap-3">
                     <FileText size={16} className="text-nexus-blue shrink-0" />
                     <span>อ้างอิง: {selectedItem.linkedQuotation || "-"}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <CreditCard size={16} className="text-nexus-teal shrink-0" />
                     <span className="font-mono text-white">ยอดรวม: {selectedItem.total || "0.00"}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                   <PillButton size="sm" variant="glass" onClick={() => setActiveModal("order")} className="w-full border-white/20 hover:border-nexus-blue shadow-none">
                     <Receipt size={14} className="mr-2" />
                     ดู / แก้ไขใบสั่งขาย
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setActiveModal("print")} className="w-full border-white/20 hover:border-nexus-teal shadow-none">
                     <Printer size={14} className="mr-2" />
                     พิมพ์ / ดูภาพก่อนพิมพ์
                   </PillButton>
                   <PillButton size="sm" variant="glass" onClick={() => setSelectedItem(null)} className="w-full border-white/20 text-white/40 shadow-none">
                     ปิดหน้าต่าง
                   </PillButton>
                </div>
             </GlassCard>
           ) : (
             <>
               <GlassCard className="p-4 border-white/10 bg-nexus-blue/5">
                  <h4 className="text-[12px] font-medium text-nexus-blue uppercase tracking-widest mb-6">ขั้นตอนการปิดการขาย</h4>
                  <div className="space-y-3">
                     <PipelineStage label="ร่าง" count={5} value="฿1.2M" />
                     <PipelineStage label="ส่งแล้ว" count={12} value="฿4.5M" color="bg-nexus-blue" />
                     <PipelineStage label="อนุมัติแล้ว" count={8} value="฿2.8M" color="bg-nexus-teal" />
                  </div>
               </GlassCard>

               <GlassCard className="p-4 border-white/10">
                  <h4 className="text-[12px] font-medium text-white/20 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <Bell size={14} className="text-warning animate-pulse" />
                     แจ้งเตือนการติดตามงาน
                  </h4>
                  <div className="space-y-3">
                     <ReminderItem name="PSG Solutions" detail="QT-2604-0001 (เกิน 7 วัน)" />
                     <ReminderItem name="Hospital A" detail="ต้องการอัปเดตสเปกทางเทคนิค" />
                  </div>
               </GlassCard>
             </>
           )}
        </div>
      </div>
      </div>
      </div>

      <CustomerModal 
        isOpen={activeModal === "customer"} 
        onClose={() => { setActiveModal(null); setSelectedItem(null); }} 
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId || !user) return;
          try {
            const isEdit = !!data.id;
            const custId = data.id || await nexusSequenceEngine("CUS", companyId);
            const custRef = doc(db, `companies/${companyId}/customers`, custId);
            const docData = {
              ...data,
              id: custId,
              customerId: data.customer_code || data.customerId || custId,
              customer_code: data.customer_code || data.customerId || custId,
              companyId,
              isDeleted: data.isDeleted ?? false,
              createdBy: data.createdBy || user.uid,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedBy: user.uid,
              updatedAt: new Date().toISOString()
            };
            await setDoc(custRef, docData, { merge: true });
            
            if (isEdit) {
              await auditService.logUpdate(user.uid, companyId, "CRM", custId, { status: "edited" }, docData);
            } else {
              await auditService.logCreate(user.uid, companyId, "CRM", custId, docData);
            }
            
            setActiveModal(null);
            showToast(isEdit ? "อัปเดตข้อมูลลูกค้าสำเร็จ" : "ลงทะเบียนลูกค้าใหม่สำเร็จ");
          } catch (err) {
            console.error("Error creating customer:", err);
            showToast("ล้มเหลวในการลงทะเบียนลูกค้า");
          }
        }}
      />

      <QuotationModal 
        isOpen={activeModal === "quotation"} 
        onClose={() => { setActiveModal(null); setSelectedItem(null); }}
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId || !user) return;
          try {
            const items = (data.items || []).map((i: any) => ({
              productId: i.productId || `prod_${Date.now()}`,
              name: i.name,
              quantity: i.qty || 1,
              price: i.price || 0,
              cost: i.cost || 0
            }));
            
            const quoteId = await createQuotation({
              id: data.id,
              customerId: data.customer || "CUS-001",
              subject: data.subject,
              date: data.date,
              validUntil: data.validUntil,
              taxMode: data.taxMode,
              paymentTerms: data.paymentTerms,
              items,
              companyId,
              discount: data.discount || 0
            });
            
            await auditService.logCreate(user.uid, companyId, "SALES_QUOTATION", quoteId, data);
            setActiveModal(null);
            setSelectedItem(null);
            showToast(`สร้างใบเสนอราคาสำเร็จ (${quoteId})`);
          } catch (err: any) {
            console.error("Error creating quotation:", err);
            showToast(err.message || "ล้มเหลวในการสร้างใบเสนอราคา");
          }
        }}
        onApprove={async (quoteId) => {
          if (!companyId || !user) return;
          try {
            const soId = await convertToSalesOrder(quoteId, companyId);
            await auditService.logUpdate(user.uid, companyId, "SALES_QUOTATION", quoteId, { status: "pending" }, { status: "Approved", linkedSo: soId });
            setActiveModal(null);
            setSelectedItem(null);
            showToast(`อนุมัติใบเสนอราคา & เปิดใบสั่งขายสำเร็จ (${soId}) ⚡`);
          } catch (err: any) {
            console.error("Error converting quotation to SO:", err);
            showToast(err.message || "การตัดสต็อกหรือระบบบัญชีขัดข้อง");
          }
        }}
      />

      <SalesOrderModal 
        isOpen={activeModal === "order"} 
        onClose={() => { setActiveModal(null); setSelectedItem(null); }}
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId || !user) return;
          try {
            const soId = await createSalesOrder(data, companyId);
            await auditService.logCreate(user.uid, companyId, "SALES_ORDER", soId, data);
            
            if (data.autoGenerate) {
              await autoGenerateOrdersFromSO(soId, companyId);
              showToast(`เปิดใบสั่งขายสำเร็จ (${soId}) และสร้างเอกสารต่อเนื่องอัตโนมัติ ⚡`);
            } else {
              showToast(`เปิดใบสั่งขายสำเร็จ (${soId})`);
            }
            setActiveModal(null);
          } catch (err: any) {
            console.error("Error creating SO:", err);
            showToast(err.message || "ล้มเหลวในการสร้างใบสั่งขาย");
          }
        }}
      />

      <BillingNoteModal 
        isOpen={activeModal === "billing"}
        onClose={() => { setActiveModal(null); setSelectedItem(null); }}
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId || !user) return;
          try {
            const billId = data.id || await nexusSequenceEngine("BN", companyId);
            const docRef = doc(db, `companies/${companyId}/billing_notes`, billId);
            await setDoc(docRef, { ...data, id: billId, companyId, createdAt: serverTimestamp() });
            setActiveModal(null);
            showToast(`สร้างใบวางบิลสำเร็จ (${billId})`);
          } catch (err: any) {
            console.error(err);
            showToast("ล้มเหลวในการสร้างใบวางบิล");
          }
        }}
      />

      <CNDNModal 
        isOpen={activeModal === "cndn"}
        onClose={() => { setActiveModal(null); setSelectedItem(null); }}
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId || !user) return;
          try {
            const cndnId = data.id || await nexusSequenceEngine(data.type, companyId);
            const docRef = doc(db, `companies/${companyId}/cndn`, cndnId);
            await setDoc(docRef, { ...data, id: cndnId, companyId, createdAt: serverTimestamp() });
            setActiveModal(null);
            showToast(`สร้าง${data.type === "CN" ? "ใบลดหนี้" : "ใบเพิ่มหนี้"}สำเร็จ (${cndnId})`);
          } catch (err: any) {
            console.error(err);
            showToast("ล้มเหลวในการสร้าง CN/DN");
          }
        }}
      />

      <DocumentViewerModal 
        isOpen={activeModal === "print"} 
        onClose={() => setActiveModal(null)} 
        data={selectedItem ? {
          ...selectedItem,
          customerAddress: selectedItem.customerAddress || customersList.find(c => c.id === selectedItem.customerId || c.name === selectedItem.customer)?.address || "-",
          customerTaxId: selectedItem.customerTaxId || customersList.find(c => c.id === selectedItem.customerId || c.name === selectedItem.customer)?.tax_id || customersList.find(c => c.id === selectedItem.customerId || c.name === selectedItem.customer)?.taxId || "-",
          customerBranch: selectedItem.customerBranch || customersList.find(c => c.id === selectedItem.customerId || c.name === selectedItem.customer)?.branch || "สำนักงานใหญ่"
        } : null} 
        type={activeTab === "quotations" ? "quotation" : "invoice"} 
      />

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}

function CustomerRow({ id, name, industry, taxId, status, role, companyId, onClick }: { id: string, name: string, industry: string, taxId: string, status: "active" | "inactive", role: string, companyId: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[120px] font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 group-hover:text-white transition-colors">{name}</NexusTableCell>
      <NexusTableCell className="w-[160px] text-[13px] font-medium text-white/60">{industry}</NexusTableCell>
      <NexusTableCell className="w-[160px] font-mono text-xs text-white/30 text-left">{taxId}</NexusTableCell>
      <NexusTableCell className="text-center w-[100px]">
        <StatusBadge status={status} label={status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
      </NexusTableCell>
      <NexusTableCell className="w-[80px] text-right">
         {(role === "ADMIN" || role === "SUPERADMIN") && (
           <div onClick={(e) => e.stopPropagation()} className="inline-block">
             <SecureDeleteAction 
               collectionName={`companies/${companyId || "COM-NEXUS-01"}/customers`}
               documentId={id}
               displayName={name}
               compact
             />
           </div>
         )}
      </NexusTableCell>
    </NexusTableRow>
  );
}

function QuotationRow({ id, customer, title, value, status, companyId, onClick }: { id: string, customer: string, title: string, value: string, status: string, companyId: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] text-nexus-teal tracking-tighter" mono>{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="text-[14px] font-bold text-white/40 whitespace-nowrap">{title}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{value}</NexusTableCell>
      <NexusTableCell className="text-center w-[140px]">
        <StatusBadge status={status === "Approved" || status === "active" ? "active" : status === "Draft" || status === "pending" ? "pending" : "danger"} label={status === "Approved" || status === "active" ? "ส่งแล้ว" : status === "Draft" || status === "pending" ? "ร่าง" : "ยกเลิก"} />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName={`companies/${companyId}/quotations`} documentId={id} displayName={title} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function SalesOrderRow({ id, customer, date, total, status, companyId, onClick }: { id: string, customer: string, date: string, total: string, status: string, companyId: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[13px] font-medium text-white/40 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="text-center w-[140px]">
        <StatusBadge status={status === "Confirmed" || status === "paid" ? "paid" : "partial"} label={status === "Confirmed" || status === "paid" ? "ชำระเงินแล้ว" : "รอดำเนินการ"} />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName={`companies/${companyId}/sales_orders`} documentId={id} displayName={customer} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function InvoiceRow({ id, soRef, customer, date, dueDate, total, status, companyId, onClick }: { id: string, soRef: string, customer: string, date: string, dueDate: string, total: string, status: string, companyId: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-white/40">{soRef}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[13px] font-medium text-warning">{dueDate}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status={status === "Paid" || status === "paid" ? "paid" : "pending"} label={status === "Paid" || status === "paid" ? "ชำระแล้ว" : "รอชำระ"} />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName={`companies/${companyId}/invoices`} documentId={id} displayName={customer} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function BillingNoteRow({ id, customer, date, dueDate, total, status, companyId, onClick }: any) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-warning font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[13px] font-medium text-warning">{dueDate}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status={status === "Paid" ? "paid" : "pending"} label={status === "Paid" ? "รับชำระแล้ว" : "รอดำเนินการ"} />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName={`companies/${companyId}/billing_notes`} documentId={id} displayName={id} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function CndnRow({ id, customer, type, date, total, status, companyId, onClick }: any) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-nexus-blue font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="w-[100px] font-bold text-[11px] uppercase tracking-widest text-white/40">{type}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status={status === "Applied" ? "active" : "pending"} label={status === "Applied" ? "ใช้สิทธิ์แล้ว" : "ยังไม่ได้ใช้"} />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName={`companies/${companyId}/cndn`} documentId={id} displayName={id} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ReceiptRow({ id, invRef, customer, date, total, status, companyId, onClick }: any) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-emerald-400 font-medium tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[13px] text-white/40">{invRef}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[13px] font-medium text-white/40">{date}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-emerald-400" mono>{total}</NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status="paid" label="รับชำระแล้ว" />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName={`companies/${companyId}/receipts`} documentId={id} displayName={id} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}


function PipelineStage({ label, count, value, color = "bg-white/10" }: { label: string, count: number, value: string, color?: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[13px] font-medium uppercase tracking-widest">
          <span className="text-white/30">{label} ({count})</span>
          <span className="text-white/80 mono-numbers">{value}</span>
       </div>
       <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className={cn("h-full", color)} style={{ width: (count / 20 * 100) + "%" }} />
       </div>
    </div>
  );
}

function ReminderItem({ name, detail }: { name: string, detail: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all">
       <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning group-hover:shadow-neon-warning transition-all">
          <Bell size={16} />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          <p className="text-[12px] text-white/30 uppercase font-medium tracking-[0.1em] mt-0.5">{detail}</p>
       </div>
    </div>
  );
}



