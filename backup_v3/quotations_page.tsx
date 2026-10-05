"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { PillButton, NexusTable, NexusTableRow, NexusTableCell, NexusSearchInput, StatusBadge, GlassCard } from "@/components/ui/Base";
import { Plus, FileText, Calendar, Building2, Search, DollarSign, Clock, CheckCircle2, XCircle, FileClock } from "lucide-react";

export default function QuotationDashboardPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: quotations, loading } = useRealtimeCollection("quotations");

  // Filter logic
  const filteredQuotations = quotations.filter(q => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      q.documentNo?.toLowerCase().includes(term) ||
      q.customerName?.toLowerCase().includes(term) ||
      q.projectName?.toLowerCase().includes(term)
    );
  });

  // Statistics
  const total = quotations.length;
  const draftCount = quotations.filter(q => q.status === 'DRAFT').length;
  const pendingCount = quotations.filter(q => q.status === 'PENDING').length;
  const approvedCount = quotations.filter(q => q.status === 'APPROVED').length;
  const rejectedCount = quotations.filter(q => q.status === 'REJECTED').length;

  const totalValue = quotations
    .filter(q => q.status !== 'REJECTED')
    .reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);

  const approvedValue = quotations
    .filter(q => q.status === 'APPROVED')
    .reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'active';
      case 'REJECTED': return 'danger';
      case 'PENDING': return 'pending';
      case 'DRAFT':
      default: return 'inactive';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'อนุมัติแล้ว';
      case 'REJECTED': return 'ไม่อนุมัติ';
      case 'PENDING': return 'รอพิจารณา';
      case 'DRAFT': return 'ฉบับร่าง';
      default: return status || 'DRAFT';
    }
  };

  return (
    <div className="p-5 lg:p-10 xl:flex xl:flex-row gap-4 min-h-[calc(100vh-64px)] animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1600px] mx-auto">
      
      {/* ── Main Content (Left) ── */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-nexus-teal/15 flex items-center justify-center text-nexus-teal shadow-neon-teal/20">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-widest uppercase">ใบเสนอราคา (Quotations)</h1>
              <p className="text-white/40 text-[13px] mt-1">จัดการใบเสนอราคา, ติดตามสถานะ และยอดขายที่คาดหวัง</p>
            </div>
          </div>
          
          <PillButton 
            onClick={() => router.push('/sales/quotations/new')}
            
            className="text-nexus-teal border-nexus-teal/20 hover:bg-transparent shadow-neon-teal/10 px-6 h-11"
          >
            <Plus size={16} className="mr-2" /> สร้างใบเสนอราคา
          </PillButton>
        </div>

        {/* Control Bar */}
        <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-96 relative">
            <NexusSearchInput 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลขที่, ชื่อลูกค้า, ชื่อโครงการ..."
            />
          </div>
        </GlassCard>

        {/* Data Table */}
        <GlassCard className="p-0 overflow-hidden flex-1 border-white/5">
          <NexusTable headers={["เลขที่เอกสาร", "วันที่ / ยืนราคาถึง", "ลูกค้า / โครงการ", "ยอดรวมทั้งสิ้น", "สถานะ", "จัดการ"]} minWidth="min-w-[900px]">
            {loading ? (
              <NexusTableRow>
                <NexusTableCell colSpan={6} className="text-center py-12 text-white/40">
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-nexus-teal border-t-transparent rounded-full animate-spin"></div>
                    กำลังโหลดข้อมูล...
                  </div>
                </NexusTableCell>
              </NexusTableRow>
            ) : filteredQuotations.length === 0 ? (
              <NexusTableRow>
                <NexusTableCell colSpan={6} className="text-center py-12 text-white/40">
                  <FileText size={32} className="mx-auto mb-3 opacity-20" />
                  {searchTerm ? 'ไม่พบใบเสนอราคาที่ค้นหา' : 'ไม่มีใบเสนอราคาในระบบ'}
                </NexusTableCell>
              </NexusTableRow>
            ) : (
              filteredQuotations.map((qt, idx) => (
                <NexusTableRow key={qt.id || idx}>
                  <NexusTableCell className="font-mono text-nexus-teal text-[12px] uppercase tracking-wider font-bold">
                    {qt.documentNo || '-'}
                  </NexusTableCell>

                  <NexusTableCell>
                    <div className="text-[12px] text-white font-mono flex items-center gap-1.5">
                      <Calendar size={12} className="text-white/40" /> {qt.date}
                    </div>
                    <div className="text-[10px] text-warning/70 font-mono mt-1 flex items-center gap-1.5">
                      <Clock size={10} /> ถึง {qt.validUntil}
                    </div>
                  </NexusTableCell>
                  
                  <NexusTableCell>
                    <div className="font-bold text-white text-[13px]">{qt.customerName || '-'}</div>
                    {qt.projectName && (
                      <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1 font-black uppercase tracking-wider truncate max-w-[200px]">
                        <Building2 size={10} /> {qt.projectName}
                      </div>
                    )}
                  </NexusTableCell>
                  
                  <NexusTableCell className="text-right">
                    <div className="font-mono text-[14px] font-bold text-white">
                      ฿{Number(qt.grandTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </div>
                  </NexusTableCell>
                  
                  <NexusTableCell>
                    <StatusBadge status={getStatusColor(qt.status)} label={getStatusLabel(qt.status)} />
                  </NexusTableCell>
                  
                  <NexusTableCell>
                    <div className="flex gap-2">
                      <PillButton 
                         
                        className="h-8 px-4 text-[10px] text-nexus-blue border-nexus-blue/20 hover:bg-transparent"
                        onClick={() => router.push(`/sales/quotations/${qt.id}`)}
                      >
                        เปิดดู
                      </PillButton>
                    </div>
                  </NexusTableCell>
                </NexusTableRow>
              ))
            )}
          </NexusTable>
        </GlassCard>
      </div>

      {/* ── Summary Column (Right) ── */}
      <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
            <DollarSign size={16} className="text-nexus-teal" /> สรุปใบเสนอราคา
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-2xl p-4 text-center border border-white/10">
              <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <FileText size={10} /> เอกสารทั้งหมด
              </div>
              <div className="text-2xl font-mono text-white">{total}</div>
            </div>
            <div className="bg-transparent rounded-2xl p-4 text-center border border-emerald-500/20">
              <div className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 size={10} /> อนุมัติแล้ว
              </div>
              <div className="text-2xl font-mono text-emerald-400">{approvedCount}</div>
            </div>
          </div>

          <div className="bg-nexus-teal/5 rounded-2xl p-4 text-center border border-nexus-teal/10 mt-2">
            <div className="text-[10px] font-black text-nexus-teal/60 uppercase tracking-widest mb-1">มูลค่ารวม (Pipeline)</div>
            <div className="text-xl font-mono text-nexus-teal font-bold truncate">
              ฿{totalValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="bg-emerald-500/5 rounded-2xl p-4 text-center border border-emerald-500/10 mt-2">
            <div className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mb-1">ยอดขายที่ปิดได้ (Won)</div>
            <div className="text-xl font-mono text-emerald-400 font-bold truncate">
              ฿{approvedValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <span className="text-[11px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
                <FileClock size={12} className="text-white/40" /> ร่างเอกสาร
              </span>
              <span className="font-mono text-white/60 text-sm">{draftCount}</span>
            </div>
            <div className="flex justify-between items-center bg-warning/5 p-3 rounded-xl border border-warning/10">
              <span className="text-[11px] font-black text-warning/80 uppercase tracking-widest flex items-center gap-2">
                <Clock size={12} /> รอพิจารณา
              </span>
              <span className="font-mono text-warning text-sm">{pendingCount}</span>
            </div>
            <div className="flex justify-between items-center bg-danger/5 p-3 rounded-xl border border-danger/10">
              <span className="text-[11px] font-black text-danger/80 uppercase tracking-widest flex items-center gap-2">
                <XCircle size={12} /> ไม่อนุมัติ
              </span>
              <span className="font-mono text-danger text-sm">{rejectedCount}</span>
            </div>
          </div>
        </GlassCard>
      </div>

    </div>
  );
}
