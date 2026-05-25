"use client";

<<<<<<< HEAD
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
  ClipboardList,
  ChevronDown,
  CreditCard,
  MapPin,
  UserCheck,
  ShieldCheck,
  Receipt,
  Trash2,
  Filter
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
import { OpportunityScorer } from "@/components/sales/OpportunityScorer";
import { CustomerModal } from "@/components/commerce/CustomerModal";
import { QuotationModal } from "@/components/commerce/QuotationModal";
import { SalesOrderModal } from "@/components/commerce/SalesOrderModal";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { createQuotation, convertToSalesOrder } from "@/lib/sales-service";

type SalesSubModule = "crm" | "opportunities" | "quotations" | "orders";

export default function SalesPage() {
  const { user, companyId, role: userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<SalesSubModule>("crm");
  const [activeModal, setActiveModal] = useState<"customer" | "quotation" | "order" | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "crm", label: "ข้อมูลลูกค้า (CRM)", icon: <Users size={14} /> },
    { id: "opportunities", label: "โอกาสการขาย (AI)", icon: <Target size={14} /> },
    { id: "quotations", label: "ใบเสนอราคา", icon: <FileText size={14} /> },
    { id: "orders", label: "ใบสั่งขาย (SO)", icon: <ClipboardList size={14} /> },
  ];

  const initialCustomers = [
    { id: "CUS-260003", name: "โรงพยาบาลตากสิน", type: "GOVERNMENT", taxId: "2341345326243", status: "active" as const },
    { id: "CUS-260001", name: "โรงพยาบาลธรรมศาสตร์", type: "GOVERNMENT", taxId: "2453765886898", status: "active" as const },
    { id: "CUS-260002", name: "โรงพยาบาลภูมิพล", type: "GOVERNMENT", taxId: "2356357875878", status: "active" as const },
  ];

  const initialQuotations = [
    { id: "QT-2604-001", customer: "Hospital A", title: "Upgrade LED Wall", value: "฿450,000", status: "pending" },
    { id: "QT-2604-002", customer: "Gov Office B", title: "Maintenance Contract", value: "฿120,000", status: "active" },
    { id: "QT-2604-003", customer: "Private Site C", title: "New Network Infrastructure", value: "฿2,100,000", status: "danger" },
  ];

  const initialOrders = [
    { id: "SO-2604-001", customer: "PSG Solutions", date: "2026-04-20", total: "฿2,400,000", status: "paid" },
    { id: "SO-2604-002", customer: "Retail Chain X", date: "2026-04-22", total: "฿850,000", status: "partial" },
  ];

  const [customersList, setCustomersList] = useState<any[]>(initialCustomers);
  const [quotationsList, setQuotationsList] = useState<any[]>(initialQuotations);
  const [ordersList, setOrdersList] = useState<any[]>(initialOrders);

  useEffect(() => {
    if (!companyId) return;

    // Real-time listener for Customers
    const qCust = query(
      collection(db, `companies/${companyId}/customers`),
      where("isDeleted", "==", false)
    );
    const unsubCust = onSnapshot(qCust, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setCustomersList(list.length > 0 ? list : initialCustomers);
    });

    // Real-time listener for Quotations
    const qQuote = query(
      collection(db, `companies/${companyId}/quotations`),
      where("isDeleted", "==", false)
    );
    const unsubQuote = onSnapshot(qQuote, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customer: d.customerId || d.customer || "Hospital A",
          title: d.subject || d.title || "Upgrade LED Wall",
          value: `฿${(d.totalRevenue || 0).toLocaleString()}`,
          status: d.status === "Approved" ? "active" : d.status === "Draft" ? "pending" : "danger",
          ...d
        });
      });
      setQuotationsList(list.length > 0 ? list : initialQuotations);
    });

    // Real-time listener for Sales Orders
    const qOrder = query(
      collection(db, `companies/${companyId}/sales_orders`),
      where("isDeleted", "==", false)
    );
    const unsubOrder = onSnapshot(qOrder, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({ 
          id: doc.id, 
          customer: d.customer || "PSG Solutions",
          date: d.convertedAt ? new Date(d.convertedAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          total: `฿${(d.totalRevenue || 0).toLocaleString()}`,
          status: d.status === "Confirmed" ? "paid" : "partial",
          ...d
        });
      });
      setOrdersList(list.length > 0 ? list : initialOrders);
    });

    return () => {
      unsubCust();
      unsubQuote();
      unsubOrder();
    };
  }, [companyId]);

  const filteredCustomers = customersList.filter(c => 
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuotations = quotationsList.filter(q => 
    (q.customer || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (q.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = ordersList.filter(o => 
    (o.customer || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );


=======
import React from "react";
import { 
  Receipt, 
  TrendingUp, 
  Users, 
  CreditCard,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  Monitor
} from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
>>>>>>> e3043f99d23bda02971284e389327f5248699605

export default function SalesPage() {
  return (
<<<<<<< HEAD
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">ทะเบียนลูกค้าและการขาย</h1>
            <p className="text-[10px] font-black text-white/30 uppercase mt-1.5 tracking-widest leading-none">CRM &amp; Sales Management System</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <Target size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">ยอดขายเป้าหมาย</span>
              <span className="text-[17px] font-black text-nexus-teal mt-1 mono-numbers leading-none">฿2.4M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Win Rate</span>
              <span className="text-[17px] font-black text-nexus-blue mt-1 mono-numbers leading-none">68%</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-white/20 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">กิจกรรมวันนี้</span>
              <span className="text-[17px] font-black text-white mt-1 mono-numbers leading-none">12</span>
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
        <div className="lg:col-span-3 space-y-6">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Users className="text-nexus-teal" size={24} />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ทะเบียนฐานข้อมูลลูกค้าองค์กร (COMP-26-0001)</p>
                    <h2 className="text-xl font-black text-white uppercase">ทะเบียนข้อมูล</h2>
                 </div>
              </div>
              <div className="flex gap-3">
                  {activeTab === "crm" && (
                    <PillButton onClick={() => setActiveModal("customer")} className="px-6 rounded-full shadow-neon-teal">
                      <Plus size={18} />
                      เพิ่มลูกค้าใหม่
                    </PillButton>
                  )}
                  {activeTab === "quotations" && (
                    <PillButton onClick={() => setActiveModal("quotation")} className="px-6 rounded-full shadow-neon-teal">
                      <FileText size={18} />
                      สร้างใบเสนอราคา
                    </PillButton>
                  )}
                  {activeTab === "orders" && (
                    <PillButton onClick={() => setActiveModal("order")} className="px-6 rounded-full shadow-neon-teal">
                      <Receipt size={18} />
                      เปิดใบสั่งขาย (SO)
                    </PillButton>
                  )}
               </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder="ค้นหาข้อมูลในระบบ (ลูกค้า, ใบเสนอราคา, SO)..." 
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
                    <NexusTable headers={["รหัสลูกค้า", "ชื่อนิติบุคคล / ลูกค้า (ชื่อทางการ)", "ประเภท", "เลขผู้เสียภาษี", "การจัดการ"]}>
                      {filteredCustomers.map(cus => (
                        <CustomerRow 
                          key={cus.id}
                          id={cus.id} 
                          name={cus.name} 
                          type={cus.type} 
                          taxId={cus.taxId} 
                          status={cus.status} 
                          role={userRole} 
                          onClick={() => { setSelectedItem(cus); setActiveModal("customer"); }} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "opportunities" && (
                  <OpportunityScorer leads={[
                    { id: "1", customerName: "โรงพยาบาลตากสิน", projectValue: 4200000, lastContact: "2 ชั่วโมงที่แล้ว", aiScore: 92, sentiment: "Positive", nextStep: "ส่งใบเสนอราคาตัวปรับปรุง" },
                    { id: "2", customerName: "Retail Chain X", projectValue: 1250000, lastContact: "1 วันที่แล้ว", aiScore: 78, sentiment: "Neutral", nextStep: "นัดสาธิตสินค้า (Demo)" },
                    { id: "3", customerName: "Global IT Hub", projectValue: 8500000, lastContact: "3 วันที่แล้ว", aiScore: 45, sentiment: "Neutral", nextStep: "ติดตามการขออนุมัติงบ" },
                  ].filter(l => l.customerName.toLowerCase().includes(searchQuery.toLowerCase()))} />
                )}

                {activeTab === "quotations" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["เลขที่ใบเสนอราคา", "ลูกค้า / ไซต์งาน", "หัวข้อโครงการ", "มูลค่าสุทธิ", "สถานะ"]}>
                      {filteredQuotations.map(q => (
                        <QuotationRow 
                          key={q.id}
                          id={q.id} 
                          customer={q.customer} 
                          title={q.title} 
                          value={q.value} 
                          status={q.status} 
                          onClick={() => { setSelectedItem(q); setActiveModal("quotation"); }} 
                        />
                      ))}
                    </NexusTable>
                  </div>
                )}

                {activeTab === "orders" && (
                  <div className="animate-in fade-in duration-500">
                    <NexusTable headers={["Sales Order ID", "ลูกค้า", "ความคืบหน้าการส่งงาน", "ยอดชำระ", "สถานะ"]}>
                      {filteredOrders.map(so => (
                        <SalesOrderRow 
                          key={so.id}
                          id={so.id} 
                          customer={so.customer} 
                          date={so.date} 
                          total={so.total} 
                          status={so.status} 
                          onClick={() => setActiveModal("order")} 
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

        <div className="space-y-6">
           <GlassCard className="p-6 border-white/10 bg-nexus-blue/5">
              <h4 className="text-[11px] font-black text-nexus-blue uppercase tracking-widest mb-6">ขั้นตอนการปิดการขาย (Sales Pipeline)</h4>
              <div className="space-y-6">
                 <PipelineStage label="ร่าง (Draft)" count={5} value="฿1.2M" />
                 <PipelineStage label="ส่งแล้ว (Sent)" count={12} value="฿4.5M" color="bg-nexus-blue" />
                 <PipelineStage label="อนุมัติแล้ว (Approved)" count={8} value="฿2.8M" color="bg-nexus-teal" />
              </div>
           </GlassCard>

           <GlassCard className="p-6 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Bell size={14} className="text-warning animate-pulse" />
                 แจ้งเตือนการติดตามงาน
              </h4>
              <div className="space-y-4">
                 <ReminderItem name="PSG Solutions" detail="QT-2604-0001 (เกิน 7 วัน)" />
                 <ReminderItem name="Hospital A" detail="ต้องการอัปเดตสเปกทางเทคนิค" />
              </div>
           </GlassCard>
=======
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-2">งานขายและลูกค้า (Sales Hub)</h1>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Commerce Control Center</p>
        </div>
        <div className="flex gap-4">
          <PillButton variant="glass" className="gap-2">
            <Monitor size={18} />
            เปิดเครื่อง POS
          </PillButton>
          <PillButton className="gap-2">
            <Plus size={18} />
            สร้างใบเสนอราคา
          </PillButton>
>>>>>>> e3043f99d23bda02971284e389327f5248699605
        </div>
      </div>
      </div>
      </div>

<<<<<<< HEAD
      <CustomerModal 
        isOpen={activeModal === "customer"} 
        onClose={() => setActiveModal(null)} 
        onSave={async (data) => {
          if (!companyId || !user) return;
          try {
            const custId = data.id || `CUS-${Date.now().toString().slice(-6)}`;
            const custRef = doc(db, `companies/${companyId}/customers`, custId);
            const docData = {
              ...data,
              id: custId,
              companyId,
              isDeleted: false,
              createdBy: user.uid,
              createdAt: new Date().toISOString()
            };
            await setDoc(custRef, docData);
            await auditService.logCreate(user.uid, companyId, "CRM", custId, docData);
            setActiveModal(null);
            showToast("ลงทะเบียนลูกค้าใหม่สำเร็จ");
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
              customerId: data.customer || "CUS-001",
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
        onClose={() => setActiveModal(null)}
        onSave={async (data) => {
          console.log("Saving Sales Order:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "SALES_ORDER", "NEW", data);
          }
          setActiveModal(null);
          showToast("เปิดใบสั่งขายสำเร็จ (SO-2604-XXXX)");
        }}
      />

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}

function CustomerRow({ id, name, type, taxId, status, role, onClick }: { id: string, name: string, type: string, taxId: string, status: "active" | "inactive", role: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[12px] text-nexus-blue font-black tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-black text-white/80 group-hover:text-white transition-colors">{name}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[12px] font-black text-white/40 uppercase tracking-widest">{type}</NexusTableCell>
      <NexusTableCell className="w-[180px] font-mono text-xs text-white/30">{taxId}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <div className="flex items-center justify-between">
           <StatusBadge status={status} label={status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
           {role === "ADMIN" && (
             <button className="text-white/10 hover:text-danger transition-colors p-1" title="ลบข้อมูล (ADMIN ONLY)">
                <Trash2 size={14} />
             </button>
           )}
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function QuotationRow({ id, customer, title, value, status, onClick }: { id: string, customer: string, title: string, value: string, status: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] text-nexus-teal tracking-tighter" mono>{id}</NexusTableCell>
      <NexusTableCell className="font-black text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="text-[14px] font-bold text-white/40 whitespace-nowrap">{title}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{value}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status as any} label={status === "pending" ? "รออนุมัติ" : status === "active" ? "ส่งแล้ว" : "ยกเลิก"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function SalesOrderRow({ id, customer, date, total, status, onClick }: { id: string, customer: string, date: string, total: string, status: string, onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px] font-mono text-[12px] text-nexus-blue font-black tracking-tighter">{id}</NexusTableCell>
      <NexusTableCell className="font-black text-white/80">{customer}</NexusTableCell>
      <NexusTableCell className="w-[180px] text-[12px] font-black text-white/40 uppercase tracking-widest">{date}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right text-white" mono>{total}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status as any} label={status === "paid" ? "ชำระเงินแล้ว" : "รอดำเนินการ"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PipelineStage({ label, count, value, color = "bg-white/10" }: { label: string, count: number, value: string, color?: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[12px] font-black uppercase tracking-widest">
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
          <p className="text-xs font-black text-white truncate">{name}</p>
          <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.1em] mt-0.5">{detail}</p>
       </div>
=======
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SalesMetric icon={<TrendingUp size={20} />} label="ยอดขายวันนี้" value="฿45,200.00" growth="+12%" />
        <SalesMetric icon={<Receipt size={20} />} label="จำนวนบิล" value="24" growth="+5%" />
        <SalesMetric icon={<Users size={20} />} label="ลูกค้าใหม่" value="3" growth="0%" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <PillInput placeholder="ค้นหาเลขอ้างอิง, ชื่อลูกค้า, หรือเบอร์โทร..." className="w-full pl-12 h-12 bg-white/[0.03]" />
        </div>
        <PillButton variant="glass" className="h-12 px-6 border-white/5">
          <Filter size={18} className="mr-2 opacity-50" />
          ตัวกรอง
        </PillButton>
      </div>

      {/* Sales Table Section */}
      <GlassCard className="p-0 overflow-hidden border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">ประวัติการขายล่าสุด</h3>
          <button className="text-[10px] font-black text-nexus-teal uppercase tracking-widest hover:underline">ดูทั้งหมด</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">เลขอ้างอิง</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ชื่อลูกค้า</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ช่องทาง</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] text-right">ยอดสุทธิ</th>
              <th className="p-4 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <SalesRow id="SO-24-001" customer="บริษัท ทดสอบ จำกัด" channel="POS" amount="฿12,500.00" status="Paid" />
            <SalesRow id="SO-24-002" customer="คุณสมศักดิ์ รักดี" channel="Online" amount="฿3,200.00" status="Pending" />
            <SalesRow id="SO-24-003" customer="PSG Solutions" channel="Direct" amount="฿250,000.00" status="Quoted" />
          </tbody>
        </table>
      </GlassCard>
>>>>>>> e3043f99d23bda02971284e389327f5248699605
    </div>
  );
}

function SalesMetric({ icon, label, value, growth }: { icon: any, label: string, value: string, growth: string }) {
  return (
    <GlassCard className="p-6 border-white/5 hover:border-nexus-teal/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-nexus-teal border border-white/10 group-hover:bg-nexus-teal group-hover:text-black transition-all">
          {icon}
        </div>
        <span className="text-[10px] font-black text-nexus-teal bg-nexus-teal/10 px-2 py-1 rounded-full">{growth}</span>
      </div>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h4 className="text-2xl font-black text-white tracking-tighter mono-numbers">{value}</h4>
    </GlassCard>
  );
}

function SalesRow({ id, customer, channel, amount, status }: { id: string, customer: string, channel: string, amount: string, status: string }) {
  const statusColors: any = {
    Paid: "text-nexus-teal bg-nexus-teal/10 border-nexus-teal/20",
    Pending: "text-warning bg-warning/10 border-warning/20",
    Quoted: "text-nexus-blue bg-nexus-blue/10 border-nexus-blue/20",
  };

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
      <td className="p-4 font-mono text-xs text-nexus-blue">{id}</td>
      <td className="p-4 text-xs font-bold text-white/80">{customer}</td>
      <td className="p-4 text-xs text-white/40">{channel}</td>
      <td className="p-4 text-right font-black text-white mono-numbers">{amount}</td>
      <td className="p-4">
        <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase border", statusColors[status])}>
          {status}
        </span>
      </td>
    </tr>
  );
}
