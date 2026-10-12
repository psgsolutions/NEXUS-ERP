"use client";

/** การเงิน › ลูกหนี้: ใบกำกับที่ค้างคืนเงินลูกค้า + ใบคืนเงินล่าสุด */

import React, { useMemo } from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { GlassCard, StatusBadge } from "@/components/ui/Base";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CustomerRefundsPanel({ companyId }: { companyId: string }) {
  const { data: invoices } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/invoices` : "");
  const { data: refunds } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/customer_refunds` : "");
  const due = useMemo(() => invoices.filter((i: any) => Number(i.refundDue) > 0.009 && !i.isSample), [invoices]);
  const recent = useMemo(() => [...refunds].sort((a, b) => String(b.refundNo).localeCompare(String(a.refundNo))).slice(0, 5), [refunds]);
  if (!due.length && !recent.length) return null;
  const total = due.reduce((s: number, i: any) => s + (Number(i.refundDue) || 0), 0);

  return (
    <GlassCard className="p-4 mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Banknote size={16} className="text-warning" /> ค้างคืนเงินลูกค้า ({due.length} ใบ · {baht(total)})</h3>
        <Link href="/finance/refunds/new" className="h-8 px-3 rounded-full border border-warning/40 text-warning text-[12px] font-bold flex items-center hover:bg-warning/10">คืนเงินลูกค้า</Link>
      </div>
      {due.length > 0 && (
        <div className="space-y-1">
          {due.map((i: any) => (
            <div key={i.id} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_120px_80px] gap-2 items-center px-3 py-1.5 rounded-xl border border-white/5 text-[13px]">
              <span className="font-mono text-nexus-blue truncate">{i.invoiceNo || i.id}</span>
              <span className="text-white/80 truncate" title={i.customerName}>{i.customerName || "-"}</span>
              <span className="font-mono text-warning text-right">{baht(i.refundDue)}</span>
              <Link href={`/finance/refunds/new?invoice=${encodeURIComponent(i.id)}`} className="h-7 px-3 rounded-full border border-warning/40 text-warning text-[12px] font-bold flex items-center justify-center hover:bg-warning/10">คืนเงิน</Link>
            </div>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-1">
          <p className="text-[11px] font-bold text-white/40 px-1">ใบคืนเงินล่าสุด</p>
          {recent.map((r: any) => (
            <Link key={r.id} href={`/finance/refunds/${encodeURIComponent(r.refundNo)}`} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_120px_80px] gap-2 items-center px-3 py-1.5 rounded-xl hover:bg-white/5 text-[13px]">
              <span className="font-mono text-nexus-teal truncate">{r.refundNo}</span>
              <span className="text-white/70 truncate">{r.customerName} · {r.invoiceNo}</span>
              <span className="font-mono text-white/80 text-right">{baht(r.amount)}</span>
              <span className="text-right">{r.status === "cancelled" ? <StatusBadge status="danger" label="ยกเลิก" /> : <StatusBadge status="active" label="คืนแล้ว" />}</span>
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
