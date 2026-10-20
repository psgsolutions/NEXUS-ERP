"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { PillButton, NexusTable, NexusTableRow, NexusTableCell, NexusSearchInput, StatusBadge, GlassCard } from "@/components/ui/Base";
import { Plus, FileCheck, Calendar, Building2, Search, DollarSign, Clock, CheckCircle2, Truck, PackageCheck, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { useSystemDialog } from "@/context/DialogContext";

// สถานะจากหลายแหล่ง (Draft/Confirmed/COMPLETED/delivered) → OPEN / DELIVERED / COMPLETED / DRAFT / CANCELLED
function normalizeSoStatus(status: string) {
  const st = String(status || "").toUpperCase();
  if (st === "DRAFT") return "DRAFT";
  if (st === "DELIVERED") return "DELIVERED";
  if (st === "COMPLETED") return "COMPLETED";
  if (st === "CANCELLED") return "CANCELLED";
  return "OPEN";
}

export default function SalesOrderDashboardPage() {
  const router = useRouter();
  const { companyId, user, roles } = useAuth();
  const canBill = can(roles, "sales:billing") || can(roles, "finance:edit");
  const { showAlert } = useSystemDialog();
  const [searchTerm, setSearchTerm] = useState("");
  // ใบสั่งขายจริงเก็บที่ companies/{companyId}/sales_orders; ปรับชื่อฟิลด์ที่ต่างกันตามแหล่งที่สร้างให้เป็นแบบเดียว
  const { data: rawOrders, loading } = useRealtimeCollection(`companies/${companyId}/sales_orders`);
  const orders = rawOrders.map((so: any) => ({
    ...so,
    soCode: so.soCode || so.documentNo || so.soId || so.id,
    netTotal: so.grandTotal ?? so.netTotal ?? so.totalAmount ?? so.totalRevenue ?? 0,
    poNumber: so.poNumber || so.customerPoNo || "",
    customerName: so.customerName || so.customerSnapshot?.name || so.customerInfo?.name || so.customerId || "",
    status: normalizeSoStatus(so.status),
  }));

  // Filter logic
  const filteredOrders = orders.filter(so => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      so.soCode?.toLowerCase().includes(term) ||
      so.poNumber?.toLowerCase().includes(term) ||
      so.customerName?.toLowerCase().includes(term)
    );
  });

  // Statistics
  const total = orders.length;
  const openCount = orders.filter(so => so.status === 'OPEN').length;
  const deliveryCount = orders.filter(so => so.status === 'DELIVERED').length;
  const completedCount = orders.filter(so => so.status === 'COMPLETED').length;

  const totalValue = orders
    .reduce((sum, so) => sum + (Number(so.netTotal) || 0), 0);
    
  const pendingValue = orders
    .filter(so => so.status === 'OPEN')
    .reduce((sum, so) => sum + (Number(so.netTotal) || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'active';
      case 'DELIVERED': return 'pending';
      case 'CANCELLED': return 'danger';
      case 'DRAFT':
      case 'OPEN':
      default: return 'inactive';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'ออกใบกำกับแล้ว';
      case 'DELIVERED': return 'ส่งมอบแล้ว';
      case 'DRAFT': return 'ร่าง';
      case 'CANCELLED': return 'ยกเลิก';
      case 'OPEN': return 'กำลังดำเนินการ';
      default: return status || 'OPEN';
    }
  };

  return (
    <div className="p-5 lg:p-10 xl:flex xl:flex-row gap-4 min-h-[calc(100vh-64px)] animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1600px] mx-auto">
      
      {/* ── Main Content (Left) ── */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
              <FileCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ใบสั่งขาย</h1>
                <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                  SALES-ORDERS
                </span>
              </div>
              <p className="text-sm text-white/60 font-medium mt-1">ติดตามสถานะการจัดส่ง การเปิดบิล และงวดงานของลูกค้า</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <PillButton 
              variant="confirm"
              onClick={() => router.push('/sales/orders/new')}
              className="h-8 px-5 font-bold text-xs"
            >
              <Plus size={14} className="mr-1.5" /> สร้างใบสั่งขาย
            </PillButton>
          </div>
        </div>

        {/* Control Bar */}
        <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-96 relative">
            <NexusSearchInput 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลขที่ SO, เลขที่ PO ลูกค้า, ชื่อลูกค้า..."
            />
          </div>
        </GlassCard>

        {/* Data Table */}
        <GlassCard className="p-0 overflow-hidden flex-1 border-white/5">
          <NexusTable headers={["เลขที่เอกสาร", "วันที่", "ลูกค้า / PO ลูกค้า", "ยอดสุทธิ", "สถานะ", "จัดการ"]} minWidth="min-w-[900px]">
            {loading ? (
              <NexusTableRow>
                <NexusTableCell colSpan={6} className="text-center py-12 text-white/40">
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-nexus-teal border-t-transparent rounded-full animate-spin"></div>
                    กำลังโหลดข้อมูล...
                  </div>
                </NexusTableCell>
              </NexusTableRow>
            ) : filteredOrders.length === 0 ? (
              <NexusTableRow>
                <NexusTableCell colSpan={6} className="text-center py-12 text-white/40">
                  <FileCheck size={32} className="mx-auto mb-3 opacity-20" />
                  {searchTerm ? 'ไม่พบใบสั่งขายที่ค้นหา' : 'ไม่มีใบสั่งขายในระบบ'}
                </NexusTableCell>
              </NexusTableRow>
            ) : (
              filteredOrders.map((so, idx) => {
                const dateStr = so.createdAt ? new Date(so.createdAt.seconds * 1000).toLocaleDateString('th-TH') : '-';
                return (
                  <NexusTableRow key={so.id || idx}>
                    <NexusTableCell className="font-mono text-nexus-teal text-[12px] uppercase tracking-wider font-bold">
                      {so.soCode || '-'}
                    </NexusTableCell>

                    <NexusTableCell>
                      <div className="text-[12px] text-white font-mono flex items-center gap-1.5">
                        <Calendar size={12} className="text-white/40" /> {dateStr}
                      </div>
                    </NexusTableCell>
                    
                    <NexusTableCell>
                      <div className="font-bold text-white text-[13px]">{so.customerName || '-'}</div>
                      {so.poNumber && (
                        <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1 font-mono uppercase tracking-wider">
                          <Building2 size={10} /> PO: {so.poNumber}
                        </div>
                      )}
                    </NexusTableCell>
                    
                    <NexusTableCell className="text-right">
                      <div className="font-mono text-[14px] font-bold text-white">
                        ฿{Number(so.netTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                    </NexusTableCell>
                    
                    <NexusTableCell>
                      <StatusBadge status={getStatusColor(so.status)} label={getStatusLabel(so.status)} />
                    </NexusTableCell>
                    
                    <NexusTableCell>
                      <div className="flex gap-2">
                        <PillButton 
                          className="h-8 px-4 text-[10px] text-nexus-blue border-nexus-blue/20 hover:bg-transparent"
                          onClick={() => router.push(`/sales/orders/${so.id}`)}
                        >
                          เปิดดู
                        </PillButton>
                        {canBill && (so.status === 'DELIVERED' || so.status === 'delivered') && (
                          <PillButton 
                            variant="save"
                            className="h-8 px-4 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md hover:bg-emerald-500/30"
                            onClick={async () => {
                              try {
                                const result = await issueTaxInvoice(companyId || "", so.id);
                                showAlert(`ออกใบกำกับภาษี (${result.taxInvoiceNo}) และใบวางบิล (${result.billingNoteNo}) เรียบร้อยแล้ว`);
                              } catch (err: any) {
                                showAlert(`เกิดข้อผิดพลาด: ${err.message}`);
                              }
                            }}
                          >
                            <FileText size={12} className="mr-1" /> ออกใบกำกับภาษี
                          </PillButton>
                        )}
                      </div>
                    </NexusTableCell>
                  </NexusTableRow>
                );
              })
            )}
          </NexusTable>
        </GlassCard>
      </div>

      {/* ── Summary Column (Right) ── */}
      <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-base font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
            <DollarSign size={16} className="text-nexus-teal" /> สรุปใบสั่งขาย
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-2xl p-4 text-center border border-white/10">
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <FileCheck size={10} /> ออเดอร์ทั้งหมด
              </div>
              <div className="text-2xl font-mono text-white">{total}</div>
            </div>
            <div className="bg-transparent rounded-2xl p-4 text-center border border-nexus-blue/20">
              <div className="text-[10px] font-semibold text-nexus-blue/60 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <Clock size={10} /> กำลังดำเนินการ
              </div>
              <div className="text-2xl font-mono text-nexus-blue">{openCount}</div>
            </div>
          </div>

          <div className="bg-nexus-teal/5 rounded-2xl p-4 text-center border border-nexus-teal/10 mt-2">
            <div className="text-[10px] font-semibold text-nexus-teal/60 uppercase tracking-widest mb-1">ยอดขายสุทธิทั้งหมด</div>
            <div className="text-xl font-mono text-nexus-teal font-bold truncate">
              ฿{totalValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="bg-white/15 rounded-2xl p-4 text-center border border-white/5 mt-2">
            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">ยอดค้างดำเนินการ (Pending Value)</div>
            <div className="text-lg font-mono text-white/80 font-bold truncate">
              ฿{pendingValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Clock size={12} className="text-white/40" /> รอส่งมอบ (Open)
              </span>
              <span className="font-mono text-white/60 text-sm">{openCount}</span>
            </div>
            <div className="flex justify-between items-center bg-warning/5 p-3 rounded-xl border border-warning/10">
              <span className="text-[11px] font-semibold text-warning/80 uppercase tracking-widest flex items-center gap-2">
                <Truck size={12} /> ส่งมอบแล้ว (Delivered)
              </span>
              <span className="font-mono text-warning text-sm">{deliveryCount}</span>
            </div>
            <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
              <span className="text-[11px] font-semibold text-emerald-400/80 uppercase tracking-widest flex items-center gap-2">
                <PackageCheck size={12} /> ปิดจ๊อบ (Completed)
              </span>
              <span className="font-mono text-emerald-400 text-sm">{completedCount}</span>
            </div>
          </div>
        </GlassCard>
      </div>

    </div>
  );
}

/** ออกใบกำกับภาษี + ใบวางบิลจากใบสั่งขาย ผ่านเซิร์ฟเวอร์ (เลขเรียงต่อเนื่อง ออกได้ครั้งเดียว) */
async function issueTaxInvoice(companyId: string, salesOrderId: string) {
  const res = await apiFetch("/api/sales/tax-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, salesOrderId }) });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "ออกใบกำกับภาษีไม่สำเร็จ");
  return json as { taxInvoiceNo: string; billingNoteNo: string };
}
