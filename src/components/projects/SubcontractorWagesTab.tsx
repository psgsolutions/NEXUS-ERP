"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { nexusSequenceEngine } from "@/lib/sequence-engine";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { db } from "@/lib/firebase-client";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { 
  Wrench, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText,
  DollarSign,
  Briefcase,
  ChevronRight,
  Calculator,
  ShieldCheck
} from "lucide-react";
import { 
  cn,
  GlassCard, 
  PillButton, 
  PillInput, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  Toast, 
  Modal,
  CreatableCombobox
} from "@/components/ui/Base";

// Type Definitions
type PayoutMilestone = {
  milestoneNo: number;
  description: string;
  percentage: number;
  amount: number;
  status: "PENDING" | "APPROVED" | "PAID";
};

type WorkOrder = {
  id: string;
  woNo: string;
  companyId: string;
  contractorId: string;
  contractorName: string;
  projectName: string;
  referenceQuotationNo: string;
  totalLaborCost: number;
  payoutMilestones: PayoutMilestone[];
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  isDeleted: boolean;
  createdAt: any;
};

export function SubcontractorWagesTab() {
  const { user, companyId } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Realtime Data
  const { data: contractors } = useRealtimeCollection("contractors");
  
  // Form State
  const [newWOForm, setNewWOForm] = useState({
    contractorName: "",
    projectName: "",
    refDoc: "",
    totalLaborCost: ""
  });
  
  // Quotation Selector State
  const [quotations, setQuotations] = useState<any[]>([]);
  const [isQuotationSelectorOpen, setIsQuotationSelectorOpen] = useState(false);
  
  // Modal States
  const [isNewWOModalOpen, setIsNewWOModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  useEffect(() => {
    if (user && companyId) {
      fetchWorkOrders();
    }
  }, [user, companyId]);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const woRef = collection(db, "subcontractor_work_orders");
      const q = query(
        woRef,
        where("companyId", "==", companyId),
        where("isDeleted", "==", false)
      );
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkOrder[];
      
      setWorkOrders(data);
    } catch (error) {
      console.error("Error fetching WOs:", error);
      showToast("ไม่สามารถดึงข้อมูลใบสั่งจ้างได้", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async () => {
    try {
      const qRef = collection(db, "quotations");
      const q = query(qRef, where("companyId", "==", companyId), where("isDeleted", "==", false));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuotations(data);
    } catch (e) {
      console.error("Error fetching quotations", e);
    }
  };

  const handleCreateWO = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const contractorName = newWOForm.contractorName;
    const projectName = newWOForm.projectName;
    const totalLaborCost = parseFloat(newWOForm.totalLaborCost);
    const refDoc = newWOForm.refDoc;
    
    if (!contractorName || !totalLaborCost) return;

    try {
      if (!companyId) throw new Error("ไม่พบรหัสบริษัทของผู้ใช้");
      const woNo = await nexusSequenceEngine("WO", companyId);
      
      const newWO = {
        woNo: woNo,
        contractorName,
        projectName,
        referenceQuotationNo: refDoc,
        totalLaborCost,
        payoutMilestones: [
          { milestoneNo: 1, description: "เริ่มงาน (Advance)", percentage: 30, amount: totalLaborCost * 0.3, status: "PENDING" },
          { milestoneNo: 2, description: "งานโครงสร้างแล้วเสร็จ", percentage: 40, amount: totalLaborCost * 0.4, status: "PENDING" },
          { milestoneNo: 3, description: "ส่งมอบงาน", percentage: 30, amount: totalLaborCost * 0.3, status: "PENDING" },
        ],
        status: "ACTIVE",
        companyId,
        isDeleted: false,
        createdBy: user?.email,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "subcontractor_work_orders"), newWO);
      showToast("สร้างใบสั่งจ้างงานเรียบร้อยแล้ว", "success");
      setIsNewWOModalOpen(false);
      setIsAddModalOpen(false);
      setNewWOForm({ contractorName: "", projectName: "", refDoc: "", totalLaborCost: "" });
      fetchWorkOrders();
    } catch (error) {
      console.error("Create WO error:", error);
      showToast("เกิดข้อผิดพลาดในการสร้าง WO", "error");
    }
  };

  const handleApproveMilestone = async (woId: string, milestoneIndex: number) => {
    try {
      const wo = workOrders.find(w => w.id === woId);
      if (!wo) return;

      const updatedMilestones = [...wo.payoutMilestones];
      updatedMilestones[milestoneIndex].status = "APPROVED";
      
      await updateDoc(doc(db, "subcontractor_work_orders", woId), {
        payoutMilestones: updatedMilestones
      });

      const payoutAmt = updatedMilestones[milestoneIndex].amount;
      const whtAmt = payoutAmt * 0.03;
      
      await addDoc(collection(db, "subcontractor_payout_logs"), {
        woId,
        milestoneNo: updatedMilestones[milestoneIndex].milestoneNo,
        amountApproved: payoutAmt,
        whtAmount: whtAmt,
        associatedPVNo: await nexusSequenceEngine("PV", companyId!),
        companyId,
        createdBy: user?.email,
        createdAt: serverTimestamp()
      });

      showToast(`อนุมัติงวดที่ ${updatedMilestones[milestoneIndex].milestoneNo} เรียบร้อยแล้ว`, "success");
      setIsEvaluationModalOpen(false);
      fetchWorkOrders();
    } catch (error) {
      console.error("Approve error:", error);
      showToast("ไม่สามารถอนุมัติได้", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredWOs = workOrders.filter(wo => 
    wo.woNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
    wo.contractorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wo.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-nexus-teal/20 rounded-xl flex items-center justify-center border border-nexus-teal/30 shadow-neon-teal">
              <Wrench className="text-nexus-teal" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
                จัดการจ่ายเงินค่าแรงช่าง
              </h1>
              <div className="flex items-center gap-2 text-xs font-bold text-nexus-teal uppercase tracking-widest mt-1">
                <span>SUBCONTRACTOR PAYOUT</span>
                <div className="w-1 h-1 rounded-full bg-nexus-teal" />
                <span>DATA BINDING SYSTEM</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-white/50 max-w-xl font-medium mt-3">
            เชื่อมต่อ Sales BOM และข้อมูลช่างในทะเบียน เพื่อประเมินผลงานและสั่งเบิกจ่ายแบบอัตโนมัติ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PillButton 
            variant="primary"
            className="h-9 px-6 shadow-neon-teal"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} /> สร้างใบสั่งจ้างงานช่าง (WO)
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
        <div className="lg:col-span-3 space-y-6">
          <GlassCard accentColor="teal" className="p-0 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
               <div className="flex items-center gap-3">
                 <div className="w-7 h-7 rounded-lg bg-nexus-teal/20 border border-nexus-teal/40 flex items-center justify-center text-nexus-teal font-mono font-bold text-xs">01</div>
                 <h3 className="text-sm font-bold text-white flex items-center gap-2">
                   <Briefcase size={16} className="text-nexus-teal" /> ใบสั่งจ้างงานทั้งหมด
                 </h3>
               </div>
               <div className="w-64">
                 <PillInput 
                   placeholder="ค้นหาชื่อผู้รับเหมา, เลขประจำตัว, หรือเบอร์โทร..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
               </div>
            </div>

            <div className="overflow-x-auto">
              <NexusTable headers={["Work Order", "ผู้รับเหมา / โครงการ", "ยอดรวมค่าแรง (฿)", "ความคืบหน้า", "สถานะ", "จัดการ"]}>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-white/40 text-sm">กำลังโหลดข้อมูลใบสั่งจ้าง...</td>
                    </tr>
                  ) : filteredWOs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-white/40 text-sm">ไม่พบข้อมูลใบสั่งจ้างในระบบ</td>
                    </tr>
                  ) : (
                    filteredWOs.map((wo) => {
                      const approvedCount = wo.payoutMilestones.filter(m => m.status === 'APPROVED' || m.status === 'PAID').length;
                      const progressPct = (approvedCount / wo.payoutMilestones.length) * 100;

                      return (
                        <NexusTableRow key={wo.id}>
                          <NexusTableCell>
                             <div className="flex flex-col">
                               <span className="font-mono not-italic text-sm font-bold text-nexus-teal">{wo.woNo}</span>
                               <span className="text-[10px] text-white/40 mt-1">อ้างอิง: <span className="font-mono not-italic">{wo.referenceQuotationNo || '-'}</span></span>
                             </div>
                          </NexusTableCell>
                          <NexusTableCell>
                             <p className="text-sm font-bold text-white">{wo.contractorName}</p>
                             <p className="text-[11px] text-white/40 mt-0.5">{wo.projectName}</p>
                          </NexusTableCell>
                          <NexusTableCell className="text-right">
                             <span className="font-mono not-italic text-sm font-bold text-white">
                               {wo.totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </span>
                          </NexusTableCell>
                          <NexusTableCell>
                             <div className="flex items-center gap-2">
                               <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden w-24">
                                  <div 
                                    className="h-full bg-nexus-teal shadow-[0_0_10px_rgba(45,212,191,0.5)] transition-all duration-1000 opacity-50"
                                    style={{ width: `${progressPct}%` }}
                                  />
                               </div>
                               <span className="text-[10px] font-mono not-italic text-white/60">{Math.round(progressPct)}%</span>
                             </div>
                          </NexusTableCell>
                          <NexusTableCell>
                            <StatusBadge status={wo.status === "ACTIVE" ? "active" : "inactive"} label={wo.status === "ACTIVE" ? "ทำงานอยู่" : "ยกเลิกแล้ว"} />
                          </NexusTableCell>
                          <NexusTableCell className="text-center">
                            <button 
                              onClick={() => { setSelectedWO(wo); setIsEvaluationModalOpen(true); }}
                              className="text-xs font-bold text-nexus-teal bg-transparent hover:bg-nexus-teal/20 px-3 py-1.5 rounded-full transition-colors"
                            >
                              ตรวจรับงาน
                            </button>
                          </NexusTableCell>
                        </NexusTableRow>
                      );
                    })
                  )}
              </NexusTable>
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard accentColor="amber" className="p-5">
             <div className="w-10 h-10 bg-nexus-teal/20 rounded-xl flex items-center justify-center text-nexus-teal mb-4">
                <Calculator size={20} />
             </div>
             <p className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-1">Total Payout Pending</p>
             <h3 className="text-3xl font-mono not-italic font-black text-white">
               {loading ? '...' : workOrders.reduce((sum, wo) => {
                 const pendingAmt = wo.payoutMilestones.filter(m => m.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
                 return sum + pendingAmt;
               }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
               <span className="text-lg text-white/40 ml-1">THB</span>
             </h3>
             <p className="text-xs text-white/40 mt-3 font-medium">รอการตรวจรับและตั้งเบิกจ่ายในรอบบิลถัดไป</p>
          </GlassCard>
        </div>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="เพิ่มผู้รับเหมา/ทีมช่างใหม่" maxWidth="max-w-2xl">
        <form onSubmit={handleCreateWO} className="flex flex-col md:flex-row h-full divide-x divide-white/5 bg-surface-0 min-h-[600px] w-full">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
               <div className="space-y-1 border-b border-white/5 pb-6">
                 <p className="text-[12px] font-semibold text-nexus-teal uppercase tracking-[0.2em]">SUBCONTRACTOR PAYOUT MODULE</p>
                 <h4 className="text-xl font-semibold text-white uppercase tracking-tight">สร้างใบสั่งจ้างงานช่าง (WORK ORDER)</h4>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[12px] font-semibold text-white/60 uppercase tracking-widest ml-1">ชื่อผู้รับเหมา / บริษัทช่าง <span className="text-nexus-teal">*</span></label>
                    <CreatableCombobox 
                      options={contractors?.map((c: any) => ({ value: c.name, label: c.name })) || []}
                      placeholder="ค้นหาหรือสร้างใหม่..." 
                      className="w-full text-white font-bold bg-white/[0.02]" 
                      value={newWOForm.contractorName} 
                      onChange={(val) => setNewWOForm({...newWOForm, contractorName: val})} 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[12px] font-semibold text-white/60 uppercase tracking-widest ml-1">ชื่อโครงการ (Project Ref.) <span className="text-nexus-teal">*</span></label>
                    <PillInput name="projectName" required placeholder="เช่น งานวางระบบเครือข่าย" className="w-full text-white font-bold bg-white/[0.02]" value={newWOForm.projectName} onChange={(e) => setNewWOForm({...newWOForm, projectName: e.target.value})} />
                  </div>
               </div>

               <div className="p-8 rounded-[2rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={16} className="text-nexus-teal" /> 
                      ข้อมูลทางการเงินและการผูก Data
                    </h3>
                    <button 
                      type="button" 
                      onClick={() => { fetchQuotations(); setIsQuotationSelectorOpen(true); }} 
                      className="flex items-center gap-2 px-4 py-2 bg-nexus-teal/15 hover:bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-neon-teal cursor-pointer"
                    >
                      <Search size={14} /> ค้นหาจาก Sales BOM
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[12px] font-semibold text-white/60 uppercase tracking-widest ml-1">อ้างอิงใบเสนอราคา (Ref. SQ)</label>
                      <PillInput name="refDoc" placeholder="SQ-..." className="w-full font-mono not-italic bg-black/15 border-white/10 text-nexus-blue" value={newWOForm.refDoc} onChange={(e) => setNewWOForm({...newWOForm, refDoc: e.target.value})} />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[12px] font-semibold text-white/60 uppercase tracking-widest ml-1">มูลค่าค่าแรงรวม (THB) <span className="text-nexus-teal">*</span></label>
                      <PillInput name="totalLaborCost" type="number" required placeholder="0.00" className="w-full font-mono not-italic bg-black/15 border-white/10 text-white font-bold" value={newWOForm.totalLaborCost} onChange={(e) => setNewWOForm({...newWOForm, totalLaborCost: e.target.value})} />
                    </div>
                  </div>
               </div>
            </div>
          </div>

          {/* RIGHT: Strategic Sidebar */}
          <div className="w-full md:w-[380px] flex flex-col bg-surface-1 p-8 flex-shrink-0 shadow-2xl relative z-10 border-t md:border-t-0 md:border-l border-white/5">
             <div className="flex-1 space-y-8">
                <div className="space-y-1 border-b border-white/5 pb-4">
                  <p className="text-[12px] font-semibold text-white/60 uppercase tracking-[0.2em]">สรุปรายการ</p>
                  <h5 className="text-sm font-semibold text-white uppercase tracking-tight flex items-center gap-2">
                    <Wrench size={16} className="text-nexus-teal" /> การจัดสรรงบประมาณ
                  </h5>
                </div>

                <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/10 space-y-6 relative overflow-hidden group shadow-2xl">
                  <div className="relative z-10 space-y-2 text-center">
                     <span className="text-[10px] font-black text-nexus-teal uppercase tracking-[0.2em]">Total Labor Cost</span>
                     <div className="text-3xl font-black text-white font-mono drop-shadow-neon mt-2">
                       {newWOForm.totalLaborCost ? parseFloat(newWOForm.totalLaborCost).toLocaleString(undefined, {minimumFractionDigits: 2}) : "0.00"}
                     </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-teal/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
                </div>

                <div className="bg-nexus-teal/5 p-5 rounded-2xl border border-nexus-teal/20 flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal flex-shrink-0 mt-0.5">
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold text-white uppercase tracking-widest">ระบบปันส่วนงวดงานอัตโนมัติ</h4>
                    <p className="text-[10px] text-white/40 mt-1.5 font-bold leading-relaxed uppercase tracking-wider">
                      เมื่อบันทึกข้อมูล ระบบจะสร้างแผนการจ่ายมาตรฐาน 3 งวด (30% / 40% / 30%) อัตโนมัติ เพื่อนำไปใช้เป็นเกณฑ์ตรวจรับงานในขั้นตอนถัดไป
                    </p>
                  </div>
                </div>
             </div>

             <div className="space-y-4 pt-8 border-t border-white/5 mt-8">
                <PillButton type="submit" variant="save" className="w-full h-10 shadow-neon-teal flex items-center justify-center gap-2">
                  <ShieldCheck size={18} /> สร้างใบสั่งจ้างงาน
                </PillButton>
                <PillButton type="button" onClick={() => setIsNewWOModalOpen(false)} variant="glass" className="w-full h-10 px-6 rounded-full text-white/60 hover:text-white uppercase tracking-widest font-black">
                  ยกเลิก
                </PillButton>
             </div>
          </div>
        </form>
      </Modal>

      {/* Evaluation Modal */}
      <Modal isOpen={isEvaluationModalOpen} onClose={() => setIsEvaluationModalOpen(false)} title="ตรวจรับงานและสั่งจ่าย" maxWidth="max-w-2xl">
        {selectedWO && (
          <div className="space-y-6">
            <div className="flex items-start justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5">
               <div>
                 <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">WORK ORDER REF</p>
                 <h2 className="text-lg font-mono not-italic font-black text-nexus-teal">{selectedWO.woNo}</h2>
                 <p className="text-sm font-bold text-white mt-1">{selectedWO.projectName}</p>
                 <p className="text-xs text-white/60 mt-0.5">{selectedWO.contractorName}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">TOTAL LABOR COST</p>
                 <p className="text-xl font-mono not-italic font-black text-white">{selectedWO.totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
               </div>
            </div>

            <div>
               <h3 className="text-sm font-bold text-white mb-4 border-b border-white/10 pb-2">แผนการจ่ายเงิน (Payout Milestones)</h3>
               <div className="space-y-3">
                 {selectedWO.payoutMilestones.map((milestone, idx) => (
                   <div key={idx} className={cn(
                     "flex items-center justify-between p-4 rounded-xl border transition-all",
                     milestone.status === 'APPROVED' || milestone.status === 'PAID'
                       ? "bg-nexus-teal/5 border-nexus-teal/20"
                       : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                   )}>
                     <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-mono not-italic font-bold text-xs",
                          milestone.status === 'APPROVED' || milestone.status === 'PAID' ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40" : "bg-white/15 text-white/40"
                        )}>
                           {milestone.milestoneNo}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{milestone.description}</p>
                          <div className="flex gap-3 text-xs mt-1">
                             <span className="text-nexus-teal font-mono not-italic">{milestone.percentage}%</span>
                             <span className="text-white/40 font-mono not-italic">{milestone.amount.toLocaleString()} THB</span>
                          </div>
                        </div>
                     </div>
                     <div>
                        {milestone.status === 'PENDING' ? (
                          <PillButton 
                            className="h-8 px-4 text-[11px] rounded-full"
                            onClick={() => handleApproveMilestone(selectedWO.id, idx)}
                          >
                            อนุมัติจ่าย (Approve)
                          </PillButton>
                        ) : (
                          <div className="flex items-center gap-2 text-nexus-teal text-xs font-bold bg-transparent px-3 py-1.5 rounded-full">
                            <CheckCircle2 size={14} /> อนุมัติแล้ว
                          </div>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Quotation Selector Modal */}
      <Modal isOpen={isQuotationSelectorOpen} onClose={() => setIsQuotationSelectorOpen(false)} title="เลือกใบเสนอราคาอ้างอิง (Sales BOM Data Binding)" maxWidth="max-w-4xl">
        <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
          <NexusTable headers={["Quotation ID", "หัวข้อ / โครงการ", "ยอดรวม (฿)", "จัดการ"]}>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/40 text-sm">ไม่พบเอกสารใบเสนอราคาในระบบ</td>
                </tr>
              ) : quotations.map(q => (
                <NexusTableRow key={q.id}>
                  <NexusTableCell className="font-mono not-italic text-nexus-teal text-sm font-bold">{q.id}</NexusTableCell>
                  <NexusTableCell className="text-white font-bold text-sm">
                    {q.title || q.subject || "-"}
                    <div className="text-[10px] text-white/40 mt-0.5 uppercase tracking-widest">{q.customerId || q.customer || "ลูกค้าทั่วไป"}</div>
                  </NexusTableCell>
                  <NexusTableCell className="text-right font-mono not-italic text-white font-bold">{q.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</NexusTableCell>
                  <NexusTableCell className="text-center">
                    <button 
                      onClick={() => {
                         setNewWOForm({
                           ...newWOForm,
                           refDoc: q.id,
                           projectName: q.title || q.subject || newWOForm.projectName,
                           // Using 15% of total revenue as estimated labor cost if not specifically detailed
                           totalLaborCost: String(Math.round((q.totalRevenue || 0) * 0.15)) 
                         });
                         setIsQuotationSelectorOpen(false);
                      }} 
                      className="text-[11px] font-bold text-black bg-nexus-teal px-4 py-2 rounded-full hover:bg-nexus-teal/80 transition-colors shadow-neon-teal"
                    >
                      ดึงข้อมูล (Bind)
                    </button>
                  </NexusTableCell>
                </NexusTableRow>
              ))}
            </NexusTable>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <Toast isVisible={true} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
