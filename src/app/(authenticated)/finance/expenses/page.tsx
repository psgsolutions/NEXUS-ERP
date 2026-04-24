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
    <div className="p-6 space-y-6 animate-in fade-in duration-700 max-w-[1200px] mx-auto">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="tactical-label !text-nexus-teal drop-shadow-neon">Paypers AI Integration</p>
          <h1 className="text-3xl font-black text-white tracking-tight">จัดการค่าใช้จ่ายหน้างาน</h1>
        </div>
        <div className="flex gap-3">
          <PillButton variant="glass" className="px-6">
             <Receipt size={18} />
             สรุปรายงานเดือนนี้
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Scan & Processing Area */}
        <div className="lg:col-span-2 space-y-6">
           {/* Tab Navigation */}
           <div className="flex gap-2 p-1 bg-white/5 rounded-full w-fit border border-white/5 shadow-inner h-11">
              <button 
                onClick={() => setActiveTab("scan")}
                className={cn("px-6 h-full rounded-full text-xs font-black uppercase transition-all", activeTab === "scan" ? "bg-nexus-teal text-black shadow-neon-teal" : "text-white/40")}
              >
                สแกนใบเสร็จ
              </button>
              <button 
                onClick={() => setActiveTab("pending")}
                className={cn("px-6 h-full rounded-full text-xs font-black uppercase transition-all", activeTab === "pending" ? "bg-nexus-blue text-white shadow-neon-blue" : "text-white/40")}
              >
                รออนุมัติ (3)
              </button>
           </div>

           {activeTab === "scan" && (
             <div className="space-y-6 animate-in slide-in-from-left duration-500">
                <ExpenseScanner />
                
                <GlassCard className="p-6 bg-nexus-teal/5 border-nexus-teal/20">
                   <h4 className="tactical-label !text-nexus-teal mb-4 flex items-center gap-2">
                      <Sparkles size={16} />
                      AI Intelligence Note
                   </h4>
                   <p className="text-sm text-white/70 leading-relaxed italic">
                     "ระบบจะพยายามเดารหัสโครงการ (Project ID) ให้อัตโนมัติจากตำแหน่ง GPS และตารางงานที่คุณลงทะเบียนไว้ เพื่อนำค่าใช้จ่ายไปตัดงบประมาณทันทีเมื่อมีการอนุมัติ"
                   </p>
                </GlassCard>
             </div>
           )}

           {activeTab === "pending" && <PendingExpenseList />}
        </div>

        {/* Status & Stats Sidebar */}
        <div className="space-y-6">
           <GlassCard className="p-6 space-y-6">
              <h4 className="tactical-label">My Expense Summary</h4>
              <div className="space-y-4">
                 <StatItem label="ยอดเงินที่รอรับคืน" value="฿4,250" color="text-nexus-teal" />
                 <StatItem label="โครงการที่ใช้งบเยอะสุด" value="PRJ-26-001" color="text-nexus-blue" />
                 <StatItem label="โควต้าเบิกรายเดือน" value="72%" color="text-white" />
              </div>
           </GlassCard>

           <div className="p-6 rounded-3xl bg-warning/10 border border-warning/20 flex gap-4">
              <AlertCircle className="text-warning shrink-0" size={24} />
              <div className="space-y-1">
                 <p className="text-xs font-black text-warning uppercase">Compliance Check</p>
                 <p className="text-xs text-white/60 leading-relaxed">
                   ใบเสร็จต้องมีความคมชัดและเห็นเลขผู้เสียภาษี 13 หลัก เพื่อใช้ในการขอคืนภาษีมูลค่าเพิ่ม (Input VAT)
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
    <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
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
             <p className="text-[10px] text-white/30 uppercase font-black">{id} • {category}</p>
          </div>
       </div>
       <div className="flex items-center gap-6">
          <div className="text-right">
             <p className="text-sm font-black text-white">฿{amount}</p>
             <p className="text-[10px] text-nexus-blue font-black tracking-widest">{project}</p>
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
       <span className={cn("text-sm font-black uppercase", color)}>{value}</span>
    </div>
  );
}
