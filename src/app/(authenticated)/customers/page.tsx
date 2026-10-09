"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { PillButton, NexusTable, NexusTableRow, NexusTableCell, NexusSearchInput, StatusBadge, GlassCard, PillTabs } from "@/components/ui/Base";
import { Building2, Plus, Users, Phone, Mail, MapPin, Crown, ShieldCheck, UserCheck } from "lucide-react";
import NexusPageLayout from "@/components/layout/NexusPageLayout";

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  const { data: customers, loading } = useRealtimeCollection("customers");

  // Filter logic
  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.customerName?.toLowerCase().includes(term) ||
      c.taxId?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term)
    );
  });

  // Statistics
  const total = customers.length;
  const vipCount = customers.filter(c => c.grade === 'VIP').length;
  const govCount = customers.filter(c => c.grade === 'Government').length;
  const privateCount = customers.filter(c => c.grade === 'Private' || !c.grade).length;

  const tabs = [
    { id: "all", label: "รายชื่อลูกค้าทั้งหมด", icon: <Users size={14} /> },
  ];


  const headerContent = (
    <>
      {/* Compact Module Header */}
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-black/15 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-nexus-teal/15 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none uppercase">ระบบบริหารลูกค้าสัมพันธ์</h1>
            <p className="text-[11px] font-medium text-white/30 uppercase mt-1 tracking-widest leading-none">Customer Relationship Management</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-4 py-1.5 bg-black/15 border border-white/5 rounded-xl flex items-center gap-2.5 min-w-[130px] transition-all hover:border-purple-500/30 hover:bg-white/[0.03]">
             <div className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center text-purple-400 border border-purple-500/20 shrink-0">
                <Crown size={16} />
             </div>
             <div className="flex flex-col justify-center">
                <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">VIP Customers</span>
                <span className="text-[17px] font-bold text-purple-400 mt-0.5 mono-numbers leading-none">{vipCount}</span>
             </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      {/* Tab Navigation */}
      <section className="px-6 min-h-[56px] py-2 bg-black/10 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <PillTabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={(id: any) => setActiveTab(id)} 
        />
        <div className="flex gap-3 shrink-0">
          <PillButton 
            variant="primary"
            onClick={() => router.push('/customers/new')}
            className="px-5 h-9 text-[12px]"
          >
            <Plus size={16} className="mr-2" /> สร้างลูกค้าใหม่
          </PillButton>
        </div>
      </section>
    </>
  );

  const leftContent = (
        <div className="space-y-4">
        {/* Control Bar */}
        <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-96 relative">
            <NexusSearchInput 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า, เลขผู้เสียภาษี, เบอร์โทร..."
            />
          </div>
        </GlassCard>

        {/* Data Table */}
        <GlassCard className="p-0 overflow-hidden flex-1 border-white/5">
          <NexusTable headers={["รหัส", "ชื่อลูกค้า / องค์กร", "เลข 13 หลัก", "ช่องทางการติดต่อ", "เกรด", "สถานะเครดิต", "จัดการ"]} minWidth="min-w-[900px]">
            {loading ? (
              <NexusTableRow>
                <NexusTableCell colSpan={7} className="text-center py-12 text-white/40">
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-nexus-teal border-t-transparent rounded-full animate-spin"></div>
                    กำลังโหลดข้อมูล...
                  </div>
                </NexusTableCell>
              </NexusTableRow>
            ) : filteredCustomers.length === 0 ? (
              <NexusTableRow>
                <NexusTableCell colSpan={7} className="text-center py-12 text-white/40">
                  <Building2 size={32} className="mx-auto mb-3 opacity-20" />
                  {searchTerm ? 'ไม่พบข้อมูลลูกค้าที่ค้นหา' : 'ไม่มีข้อมูลลูกค้าในระบบ'}
                </NexusTableCell>
              </NexusTableRow>
            ) : (
              filteredCustomers.map((customer, idx) => (
                <NexusTableRow key={customer.id || idx}>
                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap font-mono text-nexus-teal text-[11px] uppercase tracking-wider">
                    {customer.customerCode || '-'}
                  </NexusTableCell>

                  <NexusTableCell className="w-full">
                    <div className="font-bold text-white text-[13px]">{customer.customerName}</div>
                    {customer.customerBranch && (
                      <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                        <Building2 size={10} /> {customer.customerBranch}
                      </div>
                    )}
                  </NexusTableCell>
                  
                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap font-mono text-white/70 text-[12px] tracking-tight">
                    {customer.taxId || "-"}
                  </NexusTableCell>
                  
                  <NexusTableCell className="w-[1%] whitespace-nowrap">
                    <div className="space-y-1">
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-mono">
                          <Phone size={10} className="text-nexus-teal" /> {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                          <Mail size={10} className="text-blue-400" /> {customer.email}
                        </div>
                      )}
                    </div>
                  </NexusTableCell>
                  
                  <NexusTableCell className="w-[1%] whitespace-nowrap">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest inline-flex items-center gap-1 ${
                      customer.grade === 'VIP' ? 'bg-transparent border border-purple-500/20 text-purple-400' :
                      customer.grade === 'Government' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                      'bg-white/15 border border-white/10 text-white/60'
                    }`}>
                      {customer.grade === 'VIP' && <Crown size={10} />}
                      {customer.grade === 'Government' && <ShieldCheck size={10} />}
                      {customer.grade || 'Private'}
                    </span>
                  </NexusTableCell>
                  
                  <NexusTableCell align="right" className="w-[1%] whitespace-nowrap font-mono pr-6">
                    <div className="text-[11px] font-black text-white/80 uppercase tracking-widest">{customer.creditTerm || 0} วัน</div>
                  </NexusTableCell>
                  
                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap">
                    <PillButton 
                       
                      className="h-8 px-4 text-[10px] text-nexus-blue border-nexus-blue/20 hover:bg-transparent"
                      onClick={() => console.log('View customer', customer.id)}
                    >
                      ดูข้อมูล
                    </PillButton>
                  </NexusTableCell>
                </NexusTableRow>
              ))
            )}
          </NexusTable>
        </GlassCard>
      </div>
  );

  const rightSidebarContent = (
      <div className="space-y-4">
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
            <Building2 size={16} className="text-nexus-teal" /> ภาพรวมฐานข้อมูล
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-2xl p-4 text-center border border-white/10">
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">รวมทั้งหมด</div>
              <div className="text-2xl font-mono text-white">{total}</div>
            </div>
            <div className="bg-transparent rounded-2xl p-4 text-center border border-purple-500/20">
              <div className="text-[10px] font-semibold text-purple-400/60 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <Crown size={10} /> VIP
              </div>
              <div className="text-2xl font-mono text-purple-400">{vipCount}</div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <span className="text-[11px] font-black text-white/60 uppercase tracking-widest">เอกชน (Private)</span>
              <span className="font-mono text-nexus-teal text-sm">{privateCount}</span>
            </div>
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={12} /> ราชการ (Gov)
              </span>
              <span className="font-mono text-blue-400 text-sm">{govCount}</span>
            </div>
          </div>
        </GlassCard>
      </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebarContent}
    />
  );
}
