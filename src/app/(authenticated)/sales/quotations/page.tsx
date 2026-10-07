"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { PillButton, NexusTable, NexusTableRow, NexusTableCell, NexusSearchInput, StatusBadge, GlassCard } from "@/components/ui/Base";
import { Plus, FileText, Calendar, Building2, Search, DollarSign, Clock, CheckCircle2, XCircle, FileClock, AlertCircle } from "lucide-react";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

export default function QuotationDashboardPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  // ใบเสนอราคาอยู่ใต้บริษัท; รองรับรูปแบบเก่า (quoteId / date / totalRevenue / สถานะตัวพิมพ์เล็ก)
  const { data: rawQuotations = [], loading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/quotations` : '');
  const { data: customers = [] } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/customers` : '');
  const customerNameById = React.useMemo(
    () => new Map(customers.map((c: any) => [c.id, c.customerName || c.name || c.companyName || ''])),
    [customers]
  );
  const quotations = React.useMemo(() => rawQuotations.map((q: any) => ({
    ...q,
    documentNo: q.documentNo || q.quotationNumber || q.quoteId || q.id,
    docDate: q.docDate || q.date || '',
    customerName: q.customerName || q.customerSnapshot?.customerName || customerNameById.get(q.customerId) || q.customerId || '',
    projectName: q.projectName || q.subject || '',
    grandTotal: q.grandTotal ?? q.totalRevenue ?? 0,
    status: String(q.status || 'DRAFT').toUpperCase(),
  })), [rawQuotations, customerNameById]);

  const todayStr = new Date().toISOString().split('T')[0];

  const isExpired = (q: any) => {
    return Boolean(q.validUntil && q.validUntil < todayStr && q.status !== 'APPROVED' && q.status !== 'REJECTED');
  };

  const getComputedStatus = (q: any) => {
    if (isExpired(q)) return 'EXPIRED';
    return q.status || 'DRAFT';
  };

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
  const draftCount = quotations.filter(q => q.status === 'DRAFT' && !isExpired(q)).length;
  const pendingCount = quotations.filter(q => q.status === 'PENDING' && !isExpired(q)).length;
  const approvedCount = quotations.filter(q => q.status === 'APPROVED').length;
  const rejectedCount = quotations.filter(q => q.status === 'REJECTED').length;
  const expiredCount = quotations.filter(q => isExpired(q)).length;

  const totalValue = quotations
    .filter(q => q.status !== 'REJECTED' && !isExpired(q))
    .reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);

  const approvedValue = quotations
    .filter(q => q.status === 'APPROVED')
    .reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'ACCEPTED':
      case 'CONVERTED_TO_SO':
      case 'ORDERED': return 'active';
      case 'REJECTED': return 'danger';
      case 'EXPIRED': return 'warning';
      case 'PENDING': 
      case 'PENDING_APPROVAL':
      case 'SENT': return 'pending';
      case 'SUPERSEDED':
      case 'DRAFT':
      default: return 'inactive';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'ACCEPTED': return 'อนุมัติแล้ว';
      case 'CONVERTED_TO_SO':
      case 'ORDERED': return 'แปลงเป็นใบสั่งขายแล้ว';
      case 'REJECTED': return 'ปฏิเสธ';
      case 'EXPIRED': return 'หมดอายุ';
      case 'PENDING': return 'รอพิจารณา';
      case 'PENDING_APPROVAL': return 'รออนุมัติ';
      case 'SENT': return 'ส่งแล้ว';
      case 'SUPERSEDED': return 'ฉบับเก่า';
      case 'DRAFT': return 'ฉบับร่าง';
      default: return status || 'ฉบับร่าง';
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, qId: string) => {
    e.stopPropagation();
    if (!qId) return;
    if (!confirm("คุณต้องการคัดลอกใบเสนอราคานี้เป็นใบใหม่หรือไม่?")) return;
    
    try {
      const res = await apiFetch(`/api/quotations/${qId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId })
      });
      const data = await res.json();
      if (data.success && data.newQuotationId) {
        alert(`คัดลอกเอกสารสำเร็จ (${data.newDocumentNo})`);
        router.push(`/sales/quotations/${data.newQuotationId}`);
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถคัดลอกได้"}`);
      }
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
          <FileText size={20} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ใบเสนอราคา</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              QUOTATIONS
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">จัดการใบเสนอราคา ติดตามสถานะ และยอดขายที่คาดหวังในระบบ</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton 
          variant="confirm"
          onClick={() => router.push('/sales/quotations/new')}
          className="h-8 px-5 font-bold text-xs"
        >
          <Plus size={14} className="mr-1.5" /> สร้างใบเสนอราคา
        </PillButton>
      </div>
    </div>
  );

  const leftContent = (
    <div className="space-y-4">
      <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-96 relative">
          <NexusSearchInput 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขที่, ชื่อลูกค้า, ชื่อโครงการ..."
          />
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden border-white/5">
        <NexusTable headers={["เลขที่เอกสาร", "วันที่ / ยืนราคา", "ติดตามถัดไป", "ลูกค้า / โครงการ", "ยอดรวมทั้งสิ้น", "สถานะ", "จัดการ"]} minWidth="min-w-[1000px]">
            {loading ? (
              <NexusTableRow>
                <NexusTableCell colSpan={7} className="text-center py-12 text-white/40">
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-nexus-teal border-t-transparent rounded-full animate-spin"></div>
                    กำลังโหลดข้อมูล...
                  </div>
                </NexusTableCell>
              </NexusTableRow>
            ) : filteredQuotations.length === 0 ? (
              <NexusTableRow>
                <NexusTableCell colSpan={7} className="text-center py-12 text-white/40">
                  <FileText size={32} className="mx-auto mb-3 opacity-20" />
                  {searchTerm ? 'ไม่พบใบเสนอราคาที่ค้นหา' : 'ไม่มีใบเสนอราคาในระบบ'}
                </NexusTableCell>
              </NexusTableRow>
            ) : (
              filteredQuotations.map((qt, idx) => (
                <NexusTableRow key={qt.id || idx} onClick={() => router.push(`/sales/quotations/${encodeURIComponent(qt.id)}`)}>
                  <NexusTableCell align="right" className="w-[1%] whitespace-nowrap font-mono text-nexus-teal text-[12px] uppercase tracking-tight font-bold pr-6">
                    <div className="flex flex-col items-end">
                      <span>{qt.documentNo || '-'}</span>
                      {qt.revisionNumber && qt.revisionNumber > 1 && (
                        <span className="text-[12px] font-mono font-normal text-nexus-blue bg-nexus-blue/10 border border-nexus-blue/30 px-1.5 py-0.5 rounded-full mt-0.5">
                          Rev {qt.revisionNumber}
                        </span>
                      )}
                    </div>
                  </NexusTableCell>

                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap">
                    <div className="text-[12px] text-white font-mono flex items-center justify-center gap-1.5">
                      <Calendar size={12} className="text-white/40" /> {qt.docDate || qt.date}
                    </div>
                    <div className="text-[12px] text-warning/70 font-mono mt-1 flex items-center justify-center gap-1.5">
                      <Clock size={12} /> ถึง {qt.validUntil}
                    </div>
                  </NexusTableCell>

                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap">
                    {qt.nextFollowUpDate ? (
                      <span className="text-[12px] font-mono text-nexus-teal font-semibold bg-nexus-teal/10 border border-nexus-teal/30 px-2 py-0.5 rounded-full">
                        {qt.nextFollowUpDate}
                      </span>
                    ) : (
                      <span className="text-[12px] font-mono text-white/20">-</span>
                    )}
                  </NexusTableCell>
                  
                  <NexusTableCell className="w-full">
                    <div className="font-bold text-white text-[13px]">{qt.customerName || qt.customerInfo?.name || '-'}</div>
                    {qt.projectName && (
                      <div className="text-[12px] text-white/40 mt-1 flex items-center gap-1 font-semibold uppercase tracking-wider truncate max-w-[200px]">
                        <Building2 size={12} /> {qt.projectName}
                      </div>
                    )}
                  </NexusTableCell>
                  
                  <NexusTableCell align="right" className="w-[1%] whitespace-nowrap">
                    <div className="font-mono text-[14px] font-bold text-white tracking-tight">
                      {Number(qt.grandTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </div>
                  </NexusTableCell>
                  
                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap">
                    <StatusBadge status={getStatusColor(getComputedStatus(qt))} label={getStatusLabel(getComputedStatus(qt))} />
                  </NexusTableCell>
                  
                  <NexusTableCell align="center" className="w-[1%] whitespace-nowrap">
                    <div className="flex justify-center gap-1.5">
                      <PillButton 
                        className="h-8 px-3 text-[12px] text-nexus-blue border-nexus-blue/20 hover:bg-transparent"
                        onClick={() => router.push(`/sales/quotations/${encodeURIComponent(qt.id)}`)}
                      >
                        เปิดดู
                      </PillButton>
                      <PillButton 
                        className="h-8 px-3 text-[12px] text-white/70 border-white/10 hover:bg-white/10"
                        onClick={(e) => handleDuplicate(e, qt.id)}
                        title="คัดลอกเป็นใบเสนอราคาใหม่"
                      >
                        คัดลอก
                      </PillButton>
                    </div>
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
            <DollarSign size={16} className="text-nexus-teal" /> สรุปใบเสนอราคา
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-2xl p-4 text-center border border-white/10">
              <div className="text-[12px] font-semibold text-white/60 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <FileText size={12} /> เอกสารทั้งหมด
              </div>
              <div className="text-2xl font-mono text-white">{total}</div>
            </div>
            <div className="bg-transparent rounded-2xl p-4 text-center border border-emerald-500/20">
              <div className="text-[12px] font-semibold text-emerald-400/80 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 size={12} /> อนุมัติแล้ว
              </div>
              <div className="text-2xl font-mono text-emerald-400">{approvedCount}</div>
            </div>
          </div>

          <div className="bg-nexus-teal/5 rounded-2xl p-4 text-center border border-nexus-teal/10 mt-2">
            <div className="text-[12px] font-semibold text-nexus-teal/80 uppercase tracking-widest mb-1">มูลค่ารวมที่คาดหวัง</div>
            <div className="text-xl font-mono text-nexus-teal font-bold truncate">
              ฿{totalValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="bg-emerald-500/5 rounded-2xl p-4 text-center border border-emerald-500/10 mt-2">
            <div className="text-[12px] font-semibold text-emerald-400/80 uppercase tracking-widest mb-1">ยอดขายที่ปิดได้</div>
            <div className="text-xl font-mono text-emerald-400 font-bold truncate">
              ฿{approvedValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest flex items-center gap-2">
                <FileClock size={14} className="text-white/40" /> ร่างเอกสาร
              </span>
              <span className="font-mono text-white/70 text-sm">{draftCount}</span>
            </div>
            <div className="flex justify-between items-center bg-warning/5 p-3 rounded-xl border border-warning/10">
              <span className="text-[12px] font-semibold text-warning/90 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} /> รอพิจารณา
              </span>
              <span className="font-mono text-warning text-sm">{pendingCount}</span>
            </div>
            <div className="flex justify-between items-center bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
              <span className="text-[12px] font-semibold text-amber-400/90 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle size={14} /> หมดอายุ
              </span>
              <span className="font-mono text-amber-400 text-sm">{expiredCount}</span>
            </div>
            <div className="flex justify-between items-center bg-danger/5 p-3 rounded-xl border border-danger/10">
              <span className="text-[12px] font-semibold text-danger/90 uppercase tracking-widest flex items-center gap-2">
                <XCircle size={14} /> ปฏิเสธ
              </span>
              <span className="font-mono text-danger text-sm">{rejectedCount}</span>
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
