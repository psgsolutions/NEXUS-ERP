"use client";

import React, { useState } from "react";
import { 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Building2,
  Receipt,
  Trash2
} from "lucide-react";
import { GlassCard, PillButton, PillInput, MasterMetricCard, cn } from "@/components/ui/Base";
import { ExpenseScanner } from "@/components/shared/ExpenseScanner";

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<"scan" | "pending" | "history">("scan");

  return (
    <div className="p-5 space-y-3 animate-in fade-in duration-700 max-w-[1200px] mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
            <Receipt size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">จัดการค่าใช้จ่ายหน้างาน</h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                EXPENSES
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">สแกนใบเสร็จค่าใช้จ่าย ตรวจสอบและส่งขออนุมัติค่าใช้จ่ายหน้างาน</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton variant="glass" className="h-8 px-4 text-xs font-bold flex items-center gap-1.5">
             <Receipt size={14} />
             สรุปรายงานเดือนนี้
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Scan & Processing Area */}
        <div className="lg:col-span-2 space-y-3">
           {/* Tab Navigation */}
           <div className="flex gap-2 p-1 bg-white/5 rounded-full w-fit border border-white/5 shadow-inner h-11">
              <button 
                onClick={() => setActiveTab("scan")}
                className={cn("px-6 h-full rounded-full text-sm font-medium uppercase transition-all", activeTab === "scan" ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-neon-teal font-bold" : "text-white/40")}
              >
                สแกนใบเสร็จ
              </button>
              <button 
                onClick={() => setActiveTab("pending")}
                className={cn("px-6 h-full rounded-full text-sm font-medium uppercase transition-all", activeTab === "pending" ? "bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 backdrop-blur-md shadow-neon-blue font-bold" : "text-white/40")}
              >
                รออนุมัติ (3)
              </button>
           </div>

           {activeTab === "scan" && (
             <div className="space-y-3 animate-in slide-in-from-left duration-500">
                <ExpenseScanner />
                
                <GlassCard className="p-4 bg-nexus-teal/5 border-nexus-teal/20">
                   <h4 className="tactical-label !text-nexus-teal mb-4 flex items-center gap-2">
                      <Sparkles size={16} />
                      AI Intelligence Note
                   </h4>
                   <p className="text-sm text-white/70 leading-relaxed italic">
                     "ระบบจะพยายามเดารหัสโครงการ ให้อัตโนมัติจากตำแหน่ง GPS และตารางงานที่คุณลงทะเบียนไว้ เพื่อนำค่าใช้จ่ายไปตัดงบประมาณทันทีเมื่อมีการอนุมัติ"
                   </p>
                </GlassCard>
             </div>
           )}

           {activeTab === "pending" && <PendingExpenseList />}
        </div>

        {/* Status & Stats Sidebar */}
        <div className="space-y-3">
           <GlassCard className="p-4 space-y-3">
              <h4 className="tactical-label">My Expense Summary</h4>
              <div className="space-y-3">
                 <StatItem label="ยอดเงินที่รอรับคืน" value="฿4,250" color="text-nexus-teal" />
                 <StatItem label="โครงการที่ใช้งบเยอะสุด" value="PRJ-26-001" color="text-nexus-blue" />
                 <StatItem label="โควต้าเบิกรายเดือน" value="72%" color="text-white" />
              </div>
           </GlassCard>

           <div className="p-5 rounded-3xl bg-warning/10 border border-warning/20 flex gap-4">
              <AlertCircle className="text-warning shrink-0" size={24} />
              <div className="space-y-1">
                 <p className="text-sm font-medium text-warning uppercase">Compliance Check</p>
                 <p className="text-xs text-white/60 leading-relaxed">
                   ใบเสร็จต้องมีความคมชัดและเห็นเลขผู้เสียภาษี 13 หลัก เพื่อใช้ในการขอคืนภาษีมูลค่าเพิ่ม
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function PendingExpenseList() {
  return (
    <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
       <ExpenseItem 
         id="EXP-2604-0012" 
         merchant="Shell Thailand" 
         amount="1,200.00" 
         project="PRJ-26-001" 
         category="ค่าน้ำมัน" 
       />
       <ExpenseItem 
         id="EXP-2604-0015" 
         merchant="7-Eleven (Catering)" 
         amount="450.50" 
         project="PRJ-26-002" 
         category="ค่ารับรอง" 
       />
    </div>
  );
}

function ExpenseItem({ id, merchant, amount, project, category }: { id: string, merchant: string, amount: string, project: string, category: string }) {
  return (
    <div className="group flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
       <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-nexus-teal transition-colors">
             <Receipt size={24} />
          </div>
          <div className="space-y-0.5">
             <p className="text-sm font-bold text-white">{merchant}</p>
             <p className="text-[12px] text-white/30 uppercase font-medium">{id} • {category}</p>
          </div>
       </div>
       <div className="flex items-center gap-5">
          <div className="text-right">
             <p className="text-sm font-bold text-white">฿{amount}</p>
             <p className="text-[12px] text-nexus-blue font-medium tracking-widest">{project}</p>
          </div>
          <div className="flex gap-2">
             <button className="p-2 text-white/10 hover:text-nexus-teal transition-colors">
                <CheckCircle2 size={18} />
             </button>
             <button className="p-2 text-white/10 hover:text-danger transition-colors">
                <Trash2 size={18} />
             </button>
          </div>
       </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex justify-between items-center">
       <span className="text-xs text-white/30">{label}</span>
       <span className={cn("text-sm font-bold uppercase", color)}>{value}</span>
    </div>
  );
}
