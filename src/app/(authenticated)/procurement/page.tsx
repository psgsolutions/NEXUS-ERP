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
import { useAuth } from "@/context/AuthContext";
import { auditService } from "@/services/audit.service";


import { SupplierModal } from "@/components/commerce/SupplierModal";
import { PurchaseRequestModal } from "@/components/commerce/PurchaseRequestModal";
import { PurchaseOrderModal } from "@/components/commerce/PurchaseOrderModal";
import { GoodsReceiptModal } from "@/components/commerce/GoodsReceiptModal";

type ProcSubModule = "suppliers" | "pr" | "po" | "receipt";

export default function ProcurementPage() {
  const { user, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<ProcSubModule>("po");
  const [modalActiveTab, setModalActiveTab] = useState("header");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isPROpen, setIsPROpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const initialSuppliers = [
    { id: "VEN-2604-001", name: "Aruba Global (Thailand)", category: "HARDWARE", phone: "02-XXX-XXXX", status: "active" as const },
    { id: "VEN-2604-002", name: "Cisco Systems", category: "HARDWARE", phone: "02-XXX-XXXX", status: "active" as const },
    { id: "VEN-2604-003", name: "Dell Technologies", category: "HARDWARE", phone: "02-XXX-XXXX", status: "active" as const },
  ];

  const initialPRs = [
    { id: "PR-2604-001", requester: "Kriangkrai M.", dept: "ENGINEERING", project: "PRJ-26-001", amount: "฿45,000", status: "pending" as const },
    { id: "PR-2604-002", requester: "Somchai J.", dept: "SALES", project: "PRJ-26-002", amount: "฿12,500", status: "active" as const },
    { id: "PR-2604-003", requester: "Admin User", dept: "HR", project: "-", amount: "฿2,500", status: "active" as const },
  ];

  const initialGRs = [
    { id: "GR-2604-001", po: "PO-2604-001", supplier: "Aruba Global", date: "24/04/2026", warehouse: "MAIN", status: "active" as const },
    { id: "GR-2604-002", po: "PO-2604-005", supplier: "Cisco Systems", date: "25/04/2026", warehouse: "MAIN", status: "active" as const },
  ];

  const initialPOs = [
    { id: "PO-2604-0012", vendor: "Aruba Global (Thailand)", amount: "฿125,000", approval: "รอการอนุมัติระดับสูง", status: "pending" as const },
    { id: "PO-2604-0008", vendor: "Cisco Systems", amount: "฿2,450,000", approval: "อนุมัติแล้ว", status: "active" as const },
    { id: "PO-2603-0942", vendor: "Local Vendor A", amount: "฿12,500", approval: "อนุมัติแล้ว", status: "active" as const },
  ];

  const filteredSuppliers = initialSuppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPRs = initialPRs.filter(p => 
    p.requester.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.dept.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGRs = initialGRs.filter(g => 
    g.supplier.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.po.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPOs = initialPOs.filter(p => 
    p.vendor.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };


  const tabs = [
    { id: "suppliers", label: "ข้อมูลคู่ค้า (VENDORS)", icon: <Building2 size={14} /> },
    { id: "pr", label: "ใบขอซื้อ (REQUISITION)", icon: <ClipboardList size={14} /> },
    { id: "po", label: "ใบสั่งซื้อ (ORDERS)", icon: <ShoppingCart size={14} /> },
    { id: "receipt", label: "รับสินค้า (RECEIVING)", icon: <Truck size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}
      <header className="p-6 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-black/20 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <ShoppingCart size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none">ระบบบริหารงานจัดซื้อ</h1>
            <p className="text-[10px] font-black text-white/30 uppercase mt-1.5 tracking-widest leading-none">Purchasing &amp; Procurement System</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">ยอดสั่งซื้อเดือนนี้</span>
              <span className="text-[17px] font-black text-nexus-teal mt-1 mono-numbers leading-none">฿1.8M</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-blue/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Avg. Lead Time</span>
              <span className="text-[17px] font-black text-nexus-blue mt-1 mono-numbers leading-none">4.2 Days</span>
            </div>
          </div>
          <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-warning/30 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">รออนุมัติพิเศษ</span>
              <span className="text-[17px] font-black text-warning mt-1 mono-numbers leading-none">2 ฉบับ</span>
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
                 <Activity className="text-nexus-teal" size={24} />
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">ทะเบียนการจัดซื้อองค์กร (PRC-MASTER-V3)</p>
                    <h2 className="text-xl font-black text-white uppercase">ทะเบียนข้อมูลจัดซื้อ</h2>
                  </div>
              </div>
              <div className="flex gap-3">
                 <PillButton 
                    onClick={() => {
                       if (activeTab === "suppliers") setIsSupplierOpen(true);
                       else if (activeTab === "pr") setIsPROpen(true);
                       else if (activeTab === "receipt") setIsReceiptOpen(true);
                       else setIsCreateOpen(true);
                    }} 
                    className={cn(
                       "h-9 px-6 font-black uppercase tracking-[0.15em] shadow-neon-teal transition-all active:scale-95 flex items-center gap-3 rounded-full", 
                       activeTab === "suppliers" && "shadow-neon-blue bg-nexus-blue border-nexus-blue",
                       activeTab === "pr" && "shadow-neon-purple bg-purple-500 border-purple-500",
                       activeTab === "receipt" && "shadow-neon-teal bg-nexus-teal border-nexus-teal"
                    )}
                 >
                    {activeTab === "suppliers" ? <UserPlus size={20} /> : 
                     activeTab === "pr" ? <ClipboardList size={20} /> : 
                     activeTab === "receipt" ? <Truck size={20} /> : 
                     <ShoppingCart size={20} />}
                    {
                       activeTab === "suppliers" ? "ลงทะเบียนคู่ค้าใหม่" : 
                       activeTab === "pr" ? "เปิดใบขอซื้อ (PR)" : 
                       activeTab === "receipt" ? "บันทึกรับสินค้า (GR)" :
                       "ออกใบสั่งซื้อ (PO)"
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
                 ) : (
                    <NexusTable headers={["เลขที่ PO", "ชื่อคู่ค้า", "ยอดรวมสุทธิ", "การอนุมัติ", "สถานะ"]}>
                       {filteredPOs.map(po => (
                         <PORow key={po.id} {...po} onClick={() => setIsCreateOpen(true)} />
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
        <div className="space-y-6">
           <GlassCard className="p-6 border-white/10 bg-nexus-teal/5 rounded-lg">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-6">ดัชนีชี้วัดประสิทธิภาพคู่ค้า</h4>
              <div className="space-y-6">
                 <PerformanceItem label="Cisco Thailand" score={98} />
                 <PerformanceItem label="Aruba Solutions" score={85} />
                 <PerformanceItem label="Local Vendor A" score={42} />
              </div>
           </GlassCard>

           <GlassCard className="p-6 border-white/10 rounded-lg">
              <h4 className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-6">แนวโน้มราคาตลาด (AI)</h4>
              <div className="space-y-4">
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
         <p className="font-mono text-[11px] text-nexus-blue font-black tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-black text-white/80 group-hover:text-white transition-colors">{name}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[10px] font-black text-white/60 uppercase tracking-[0.1em]">{category}</NexusTableCell>
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
         <p className="font-mono text-[11px] text-nexus-teal font-black tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="w-[150px] font-mono text-[10px] text-white/60 uppercase tracking-widest">{po}</NexusTableCell>
      <NexusTableCell className="font-black text-white/80 group-hover:text-white transition-colors">{supplier}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-white/60 font-bold">{date}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[10px] font-black text-white/40 uppercase">{warehouse}</NexusTableCell>
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
         <p className="font-mono text-[11px] text-nexus-purple font-black tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-black text-white/80 group-hover:text-white transition-colors">{requester}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-[10px] font-black text-white/60 uppercase tracking-[0.1em]">{dept}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-white/60 font-bold">{project}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[120px]">
        <StatusBadge status={status} label={status === "active" ? "อนุมัติแล้ว" : "รออนุมัติ"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PORow({ id, vendor, amount, approval, status, onClick }: { id: string, vendor: string, amount: string, approval: string, status: "active" | "pending" | "danger", onClick?: () => void }) {
  return (
    <NexusTableRow onClick={onClick}>
      <NexusTableCell className="w-[140px]">
         <p className="font-mono text-[11px] text-nexus-blue font-black tracking-tighter">{id}</p>
      </NexusTableCell>
      <NexusTableCell className="font-black text-white/80 group-hover:text-white transition-colors">{vendor}</NexusTableCell>
      <NexusTableCell className="w-[150px] text-right font-black text-white mono-numbers">{amount}</NexusTableCell>
      <NexusTableCell className="w-[120px] text-[10px] font-black text-white/60 uppercase text-center tracking-widest">{approval}</NexusTableCell>
      <NexusTableCell className="w-[180px]">
        <StatusBadge status={status} label={status === "active" ? "สั่งซื้อแล้ว" : "รออนุมัติ"} />
      </NexusTableCell>
    </NexusTableRow>
  );
}

function PerformanceItem({ label, score }: { label: string, score: number }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
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
       <span className={cn("text-xs font-black", trend === "down" ? "text-nexus-teal" : "text-danger")}>{change}</span>
    </div>
  );
}
