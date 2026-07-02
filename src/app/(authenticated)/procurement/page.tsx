"use client";

import React, { useState } from "react";
import { 
  ShoppingBag, 
  ShoppingCart,
  Truck, 
  FileCheck, 
  Plus, 
  Search, 
  Building2, 
  Clock, 
  TrendingDown,
  BarChart2,
  AlertCircle,
  Activity,
  Box,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
  UserPlus,
  Filter
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
import { DocumentFlowStepper } from "@/components/ui/DocumentFlowStepper";
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";


import { doc, setDoc, query, collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { createExpenseFromPO, createWHTFromExpense } from "@/lib/procurement-service";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { SecureDeleteAction } from "@/components/ui/SecureDeleteAction";

import { SupplierModal } from "@/components/commerce/SupplierModal";
import { PurchaseRequestModal } from "@/components/commerce/PurchaseRequestModal";
import { PurchaseOrderModal } from "@/components/commerce/PurchaseOrderModal";
import { GoodsReceiptModal } from "@/components/commerce/GoodsReceiptModal";
import { ExpenseModal } from "@/components/commerce/ExpenseModal";
import { WHTModal } from "@/components/commerce/WHTModal";

type ProcSubModule = "suppliers" | "pr" | "po" | "receipt" | "expense" | "wht";

export default function ProcurementPage() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<ProcSubModule>("pr");
  const [modalActiveTab, setModalActiveTab] = useState("header");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isPROpen, setIsPROpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isWHTOpen, setIsWHTOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const { data: initialSuppliers } = useRealtimeCollection<any>('suppliers');
  const { data: initialPRs } = useRealtimeCollection<any>('purchase_requests');
  const { data: initialGRs } = useRealtimeCollection<any>('goods_receipts');
  const { data: initialPOs } = useRealtimeCollection<any>('purchase_orders');
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [whtList, setWhtList] = useState<any[]>([]);

  React.useEffect(() => {
    if (!companyId) return;

    const qExp = query(collection(db, `companies/${companyId}/expenses`));
    const unsubExp = onSnapshot(qExp, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setExpensesList(list);
    });

    const qWht = query(collection(db, `companies/${companyId}/withholding_taxes`));
    const unsubWht = onSnapshot(qWht, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setWhtList(list);
    });

    return () => {
      unsubExp();
      unsubWht();
    };
  }, [companyId]);

  const filteredSuppliers = (initialSuppliers || []).filter(s => 
    (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPRs = (initialPRs || []).filter(p => 
    (p.requester || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.dept || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGRs = (initialGRs || []).filter(g => 
    (g.supplier || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (g.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.po || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPOs = (initialPOs || []).filter(p => 
    (p.vendor || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExpenses = expensesList.filter(e => 
    (e.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.poRef || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWHTs = whtList.filter(w => 
    (w.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.expenseId || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "pr", label: "ใบขอซื้อ", icon: <ClipboardList size={14} /> },
    { id: "po", label: "ใบสั่งซื้อ", icon: <ShoppingCart size={14} /> },
    { id: "receipt", label: "รับสินค้า", icon: <Truck size={14} /> },
    { id: "expense", label: "บันทึกรายจ่าย", icon: <Activity size={14} /> },
    { id: "wht", label: "ภาษีหัก ณ ที่จ่าย", icon: <ShieldCheck size={14} /> },
    { id: "suppliers", label: "ข้อมูลคู่ค้า", icon: <Building2 size={14} /> },
  ];

  const procurementFlowSteps = [
    { id: "pr", label: "ใบขอซื้อ", icon: <ClipboardList size={14} /> },
    { id: "po", label: "ใบสั่งซื้อ", icon: <ShoppingCart size={14} /> },
    { id: "receipt", label: "รับสินค้า", icon: <Truck size={14} /> },
    { id: "expense", label: "บันทึกรายจ่าย", icon: <Activity size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <ShoppingCart size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ระบบบริหารงานจัดซื้อ</h1>
            <p className="text-sm font-medium text-white/30 uppercase mt-1.5 tracking-widest leading-none">Purchasing &amp; Procurement System</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">ยอดสั่งซื้อเดือนนี้</span>
              <span className="text-[17px] font-bold text-nexus-teal mt-1 mono-numbers leading-none">฿1.8M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">Avg. Lead Time</span>
              <span className="text-[17px] font-bold text-nexus-blue mt-1 mono-numbers leading-none">4.2 Days</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-warning/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-medium text-white/30 uppercase tracking-widest leading-none">รออนุมัติพิเศษ</span>
              <span className="text-[17px] font-bold text-warning mt-1 mono-numbers leading-none">2 ฉบับ</span>
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

      <div className="flex flex-col lg:flex-row items-start gap-4">
        <div className="flex-1 w-full space-y-10">
          
          <div className="space-y-3">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              <div className="flex items-center gap-4 shrink-0">
                 <Activity className="text-nexus-teal" size={24} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white/20 uppercase tracking-widest">ทะเบียนการจัดซื้อองค์กร (PRC-MASTER-V3)</p>
                    <h2 className="text-xl font-bold text-white uppercase">ทะเบียนข้อมูลจัดซื้อ</h2>
                  </div>
              </div>
              {/* Document Sequence Visualizer */}
              {procurementFlowSteps.some(s => s.id === activeTab) && (
                <div className="flex-1 w-full max-w-3xl px-6 py-2 hidden xl:block overflow-hidden">
                   <DocumentFlowStepper activeTab={activeTab} onStepClick={(id) => setActiveTab(id as any)} steps={procurementFlowSteps} />
                </div>
              )}
              <div className="flex gap-3 shrink-0">
                 <PillButton 
                    onClick={() => {
                       if (activeTab === "suppliers") setIsSupplierOpen(true);
                       else if (activeTab === "pr") setIsPROpen(true);
                       else if (activeTab === "receipt") setIsReceiptOpen(true);
                       else setIsCreateOpen(true);
                    }} 
                 >
                    {activeTab === "suppliers" ? <UserPlus size={20} /> : 
                     activeTab === "pr" ? <ClipboardList size={20} /> : 
                     activeTab === "receipt" ? <Truck size={20} /> : 
                     <ShoppingCart size={20} />}
                    {
                       activeTab === "suppliers" ? "ลงทะเบียนคู่ค้าใหม่" : 
                       activeTab === "pr" ? "เปิดใบขอซื้อ" : 
                       activeTab === "receipt" ? "บันทึกรับสินค้า" :
                       "ออกใบสั่งซื้อ"
                    }
                 </PillButton>
              </div>
            </div>

            {/* Tactical Command Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/[0.01] p-1.5 rounded-full border border-white/5 backdrop-blur-md">
               <NexusSearchInput 
                 placeholder={
                    activeTab === "suppliers" ? "ค้นหาชื่อคู่ค้า, เลขผู้เสียภาษี..." : 
                    activeTab === "pr" ? "ค้นหาใบขอซื้อ, ผู้ขอ, แผนก..." :
                    activeTab === "receipt" ? "ค้นหาเลขใบรับสินค้า, ใบสั่งซื้อ..." :
                    "ค้นหาเลขที่เอกสาร หรือข้อมูลในตารางนี้..."
                 }
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

            <GlassCard className="p-0 overflow-hidden border-white/5 min-h-[640px] flex flex-col justify-between bg-black/40">
               <div className="overflow-x-auto custom-scrollbar flex-1 w-full">
                 {activeTab === "suppliers" ? (
                    <NexusTable headers={["รหัสคู่ค้า", "ชื่อคู่ค้า / นิติบุคคล", "หมวดหมู่", "เบอร์โทรศัพท์", "สถานะ"]}>
                       {filteredSuppliers.map(s => (
                         <SupplierRow key={s.id} {...s} onClick={() => setIsSupplierOpen(true)} />
                       ))}
                    </NexusTable>
                 ) : activeTab === "pr" ? (
                    <NexusTable headers={["เลขที่ PR", "ผู้ขอซื้อ", "แผนก", "โครงการอ้างอิง", "ยอดโดยประมาณ", "สถานะ"]}>
                       {filteredPRs.map(pr => (
                         <PRRow key={pr.id} {...pr} onClick={() => setIsPROpen(true)} />
                       ))}
                    </NexusTable>
                 ) : activeTab === "receipt" ? (
                    <NexusTable headers={["เลขที่ GR", "อ้างอิง PO", "ชื่อคู่ค้า", "วันที่รับ", "คลังสินค้า", "สถานะ"]}>
                       {filteredGRs.map(gr => (
                         <GRRow key={gr.id} {...gr} onClick={() => setIsReceiptOpen(true)} />
                       ))}
                    </NexusTable>
                 ) : activeTab === "po" ? (
                    <NexusTable headers={["เลขที่ PO", "ชื่อคู่ค้า", "ยอดรวมสุทธิ", "การอนุมัติ", "สถานะ", "จัดการ"]}>
                       {filteredPOs.length === 0 ? (
                         <NexusTableRow>
                           <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ไม่มีข้อมูลใบสั่งซื้อ</NexusTableCell>
                         </NexusTableRow>
                       ) : filteredPOs.map(po => (
                         <PORow key={po.id} {...po} companyId={companyId || "COM-NEXUS-01"} onExpenseCreate={async () => {
                            try {
                              const expId = await createExpenseFromPO(po.id, companyId || "COM-NEXUS-01");
                              showToast(`สร้างใบสำคัญจ่ายสำเร็จ (${expId})`);
                              setActiveTab("expense");
                            } catch (e: any) {
                              showToast(e.message || "เกิดข้อผิดพลาด");
                            }
                         }} onClick={() => setIsCreateOpen(true)} />
                       ))}
                    </NexusTable>
                 ) : activeTab === "expense" ? (
                    <NexusTable headers={["เลขที่ EXP", "อ้างอิง PO", "ชื่อคู่ค้า", "ยอดสุทธิ", "สถานะ", "จัดการ"]}>
                       {filteredExpenses.length === 0 ? (
                         <NexusTableRow>
                           <NexusTableCell colSpan={6} className="text-center text-white/50 py-8">ไม่มีข้อมูลบันทึกรายจ่าย</NexusTableCell>
                         </NexusTableRow>
                       ) : filteredExpenses.map(exp => (
                         <ExpenseRow key={exp.id} {...exp} companyId={companyId || "COM-NEXUS-01"} 
                           onClick={() => { setSelectedItem(exp); setIsExpenseOpen(true); }}
                           onWhtCreate={async () => {
                            try {
                              const whtId = await createWHTFromExpense(exp.id, companyId || "COM-NEXUS-01");
                              showToast(`ออกภาษีหัก ณ ที่จ่ายสำเร็จ (${whtId})`);
                              setActiveTab("wht");
                            } catch (e: any) {
                              showToast(e.message || "เกิดข้อผิดพลาด");
                            }
                         }} />
                       ))}
                    </NexusTable>
                 ) : (
                    <NexusTable headers={["เลขที่ WHT", "อ้างอิง EXP", "ชื่อคู่ค้า", "ยอดฐานภาษี", "ยอดหักภาษี", "สถานะ", "จัดการ"]}>
                       {filteredWHTs.length === 0 ? (
                         <NexusTableRow>
                           <NexusTableCell colSpan={7} className="text-center text-white/50 py-8">ไม่มีข้อมูลภาษีหัก ณ ที่จ่าย</NexusTableCell>
                         </NexusTableRow>
                       ) : filteredWHTs.map(wht => (
                         <WHTRow key={wht.id} {...wht} companyId={companyId || "COM-NEXUS-01"} 
                           onClick={() => { setSelectedItem(wht); setIsWHTOpen(true); }}
                         />
                       ))}
                    </NexusTable>
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
        <div className="space-y-3">
           <GlassCard className="p-4 border-white/10 bg-nexus-teal/5 rounded-lg">
              <h4 className="text-sm font-medium text-nexus-teal uppercase tracking-widest mb-6">ดัชนีชี้วัดประสิทธิภาพคู่ค้า</h4>
              <div className="space-y-3">
                 <PerformanceItem label="Cisco Thailand" score={98} />
                 <PerformanceItem label="Aruba Solutions" score={85} />
                 <PerformanceItem label="Local Vendor A" score={42} />
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10 rounded-lg">
              <h4 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-6">แนวโน้มราคาตลาด</h4>
              <div className="space-y-3">
                 <PriceTrendItem item="CAT6 Cable 305m" change="-2.4%" trend="down" />
                 <PriceTrendItem item="Core Switch 24P" change="+5.1%" trend="up" />
              </div>
           </GlassCard>
        </div>
      </div>
      </div>
      </div>

      {/* Procurement Management Modal */}
      <GoodsReceiptModal 
        isOpen={isReceiptOpen} 
        onClose={() => setIsReceiptOpen(false)}
        onSave={async (data) => {
          console.log("Saving GR:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "PROCUREMENT_GR", "NEW", data);
          }
          setIsReceiptOpen(false);
          showToast("บันทึกรับสินค้าสำเร็จ (GR-2604-XXXX)");
        }}
      />

      <PurchaseOrderModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)}
        onSave={async (data) => {
          console.log("Saving PO:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "PROCUREMENT_PO", "NEW", data);
          }
          setIsCreateOpen(false);
          showToast(`ออกใบสั่งซื้อสำเร็จ (${data.id || "PO-2604-XXXX"})`);
        }}
      />

      <PurchaseRequestModal 
        isOpen={isPROpen} 
        onClose={() => setIsPROpen(false)}
        onSave={async (data) => {
          console.log("Saving PR:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "PROCUREMENT_PR", "NEW", data);
          }
          setIsPROpen(false);
          showToast("ส่งใบขอซื้อสำเร็จ (PR-2604-XXXX)");
        }}
      />

      <SupplierModal 
        isOpen={isSupplierOpen} 
        onClose={() => setIsSupplierOpen(false)}
        onSave={async (data) => {
          console.log("Saving Supplier:", data);
          if (user && companyId) {
            await auditService.logCreate(user.uid, companyId, "PROCUREMENT_SUPPLIER", "NEW", data);
          }
          setIsSupplierOpen(false);
          showToast("เพิ่มคู่ค้าสำเร็จ (VEN-2604-XXXX)");
        }}
      />

      <ExpenseModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId) return;
          try {
            await setDoc(doc(db, `companies/${companyId}/expenses`, data.id), data, { merge: true });
            setIsExpenseOpen(false);
          } catch (e: any) {
            showToast(e.message || "เกิดข้อผิดพลาด");
          }
        }}
      />

      <WHTModal
        isOpen={isWHTOpen}
        onClose={() => setIsWHTOpen(false)}
        initialData={selectedItem}
        onSave={async (data) => {
          if (!companyId) return;
          try {
            await setDoc(doc(db, `companies/${companyId}/withholding_taxes`, data.id), data, { merge: true });
            setIsWHTOpen(false);
          } catch (e: any) {
            showToast(e.message || "เกิดข้อผิดพลาด");
          }
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

function SupplierRow({ id, name, category, phone, status, onClick }: { id: string, name: string, category: string, phone: string, status: "active" | "inactive", onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-sm text-nexus-blue font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 group-hover:text-white transition-colors">{name}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-sm font-medium text-white/60 uppercase tracking-[0.1em]">{category}</NexusTableCell>
      <NexusTableCell className="w-[150px] font-mono text-[12px] text-white/60">{phone}</NexusTableCell>
      <NexusTableCell className="w-[120px]">
        <StatusBadge status={status} label={status === "active" ? "ใช้งาน" : "ระงับ"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function GRRow({ id, po, supplier, date, warehouse, status, onClick }: { id: string, po: string, supplier: string, date: string, warehouse: string, status: "active" | "pending" | "danger", onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-sm text-nexus-teal font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[150px] font-mono text-[10px] text-white/60 uppercase tracking-widest">{po}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 group-hover:text-white transition-colors">{supplier}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-white/60 font-bold">{date}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-sm font-medium text-white/40 uppercase">{warehouse}</NexusTableCell>
      <NexusTableCell className="w-[120px]">
        <StatusBadge status={status} label={status === "active" ? "รับครบ" : "รับบางส่วน"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PRRow({ id, requester, dept, project, amount, status, onClick }: { id: string, requester: string, dept: string, project: string, amount: string, status: "active" | "pending" | "danger", onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-sm text-nexus-purple font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-bold text-white/80 group-hover:text-white transition-colors">{requester}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-sm font-medium text-white/60 uppercase tracking-[0.1em]">{dept}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-white/60 font-bold">{project}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[120px]">
        <StatusBadge status={status} label={status === "active" ? "อนุมัติแล้ว" : "รออนุมัติ"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PORow({ id, vendor, totalAmount, amount, approval, status, companyId, onExpenseCreate, onClick }: any) {
  const displayAmount = totalAmount ? `฿${totalAmount.toLocaleString()}` : (amount ? `฿${amount}` : "฿0.00");
  const isApproved = approval === "อนุมัติแล้ว" || status === "Approved" || status === "Received";
  
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-[12px] text-purple-400 font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{vendor}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{displayAmount}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <div className="flex items-center gap-2">
           <div className={cn("w-1.5 h-1.5 rounded-full", isApproved ? "bg-nexus-teal" : "bg-amber-400")} />
           <span className="text-[11px] font-medium text-white/60">{approval || status}</span>
        </div>
      </NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status={isApproved ? "active" : "pending"} label={isApproved ? "รอดำเนินการ" : "รออนุมัติ"} />
      </NexusTableCell>
      <NexusTableCell className="w-[140px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-end gap-2">
          {onExpenseCreate && isApproved && (
             <button onClick={onExpenseCreate} className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500 hover:text-white transition-colors">รับ+ตั้งหนี้</button>
          )}
          <SecureDeleteAction collectionName="purchase_orders" documentId={id} displayName={id} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function ExpenseRow({ id, poRef, vendor, supplier, totalAmount, amount, status, companyId, onWhtCreate, onClick }: any) {
  const displayVendor = vendor || supplier || "-";
  const displayAmount = totalAmount ? `฿${totalAmount.toLocaleString()}` : (amount ? `฿${amount}` : "฿0.00");
  const isPaid = status?.includes("Paid") || status === "paid";
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-[12px] text-nexus-teal font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[11px] text-white/40">{poRef || "-"}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{displayVendor}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white mono-numbers">{displayAmount}</NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status={isPaid ? "active" : "pending"} label={isPaid ? "ชำระแล้ว" : "รอจ่ายเงิน"} />
      </NexusTableCell>
      <NexusTableCell className="w-[140px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-end gap-2">
          {onWhtCreate && !isPaid && (
             <button onClick={onWhtCreate} className="px-2 py-1 text-[10px] bg-nexus-blue/20 text-nexus-blue rounded hover:bg-nexus-blue hover:text-white transition-colors">จ่าย+หัก WHT</button>
          )}
          <SecureDeleteAction collectionName="expenses" documentId={id} displayName={id} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function WHTRow({ id, expenseId, expRef, vendor, baseAmount, taxAmount, status, companyId, onClick }: any) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-[12px] text-amber-500 font-medium tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[140px] font-mono text-[11px] text-white/40">{expRef || expenseId || "-"}</NexusTableCell>
      <NexusTableCell className="font-bold text-white/80">{vendor || "-"}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-white/60 mono-numbers">฿{baseAmount?.toLocaleString() || "0.00"}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-bold text-warning mono-numbers">฿{taxAmount?.toLocaleString() || "0.00"}</NexusTableCell>
      <NexusTableCell className="text-center w-[120px]">
        <StatusBadge status="active" label={status === 'filed' ? "ยื่นแบบแล้ว" : "ออกเอกสารแล้ว"} />
      </NexusTableCell>
      <NexusTableCell className="w-[100px] text-right">
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
          <SecureDeleteAction collectionName="withholding_taxes" documentId={id} displayName={id} compact />
        </div>
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PerformanceItem({ label, score }: { label: string, score: number }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-sm font-medium uppercase tracking-widest">
          <span className="text-white/60">{label}</span>
          <span className={cn("text-white/80", score < 50 ? "text-danger" : "text-nexus-teal")}>{score}%</span>
       </div>
       <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className={cn("h-full", score < 50 ? "bg-danger" : "bg-nexus-teal")} style={{ width: score + "%" }} />
       </div>
    </div>
  );
}

function PriceTrendItem({ item, change, trend }: { item: string, change: string, trend: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all">
       <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            trend === "down" ? "bg-nexus-teal/10 text-nexus-teal" : "bg-danger/10 text-danger"
          )}>
             {trend === "down" ? <TrendingDown size={14} /> : <TrendingDown size={14} className="rotate-180" />}
          </div>
          <span className="text-xs font-bold text-white">{item}</span>
       </div>
       <span className={cn("text-xs font-bold", trend === "down" ? "text-nexus-teal" : "text-danger")}>{change}</span>
    </div>
  );
}
