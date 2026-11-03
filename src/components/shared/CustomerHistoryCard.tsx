"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { History, RefreshCw } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillTabs } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

/**
 * ประวัติการค้าขายกับลูกค้า: โครงการ งานบริการ ใบเสนอราคา ใบสั่งขาย ใบกำกับภาษี ใบเสร็จ (ของบริษัทที่เลือก)
 * ข้อมูลจาก /api/customers/history — ส่วนที่ผู้ใช้ไม่มีสิทธิ์ดูจะไม่แสดง
 */
interface Row { id: string; no: string; date: string; title: string; amount: number | null; status: string; href: string; extra?: string }
interface History {
  summary: { projects: number; quotations: number; won: number; salesTotal: number; outstanding: number; lastDealDate: string; truncated: boolean };
  projects: Row[]; quotations: Row[]; orders: Row[]; invoices: Row[]; receipts: Row[]; service: Row[];
}

const SECTIONS: { id: keyof Omit<History, "summary">; label: string }[] = [
  { id: "projects", label: "โครงการ" },
  { id: "service", label: "งานบริการ" },
  { id: "quotations", label: "ใบเสนอราคา" },
  { id: "orders", label: "ใบสั่งขาย" },
  { id: "invoices", label: "ใบกำกับ/ใบแจ้งหนี้" },
  { id: "receipts", label: "ใบเสร็จ" },
];

/** สถานะภาษาอังกฤษในข้อมูล → ข้อความไทย */
const STATUS_TH: Record<string, string> = {
  DRAFT: "ร่าง", CONFIRMED: "ยืนยันแล้ว", COMPLETED: "ออกใบกำกับแล้ว", CANCELLED: "ยกเลิก", DELIVERED: "ส่งของแล้ว",
  "PENDING APPROVAL": "รออนุมัติ", ACTIVE: "ดำเนินการ", "IN PROGRESS": "ดำเนินการ", APPROVED: "อนุมัติแล้ว", CLOSED: "ปิดงาน",
  NEW: "ใหม่", OPEN: "รอจ่ายงาน", ASSIGNED: "จ่ายงานแล้ว", SCHEDULED: "นัดหมายแล้ว", ACCEPTED: "รับงานแล้ว", RESOLVED: "แก้ไขแล้ว", DONE: "เสร็จ",
};
const statusTh = (s: string) => STATUS_TH[String(s || "").toUpperCase()] || s || "-";
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustomerHistoryCard({ customerId }: { customerId: string }) {
  const { companyId } = useAuth();
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>("projects");

  const load = async () => {
    if (!companyId || !customerId) return;
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/customers/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, customerId }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "โหลดไม่สำเร็จ");
      setData(d);
      // เปิดแท็บแรกที่มีข้อมูล
      const first = SECTIONS.find((s) => (d[s.id] || []).length);
      if (first) setTab(first.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [companyId, customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = data ? (data as any)[tab] || [] : [];
  const s = data?.summary;

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-white"><History size={17} className="text-nexus-teal" /> ประวัติงานและการค้าขาย</h2>
        <PillButton variant="ghost" onClick={load} disabled={loading} className="h-8 px-3 text-xs"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> โหลดใหม่</PillButton>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["โครงการ", String(s.projects)],
            ["ใบเสนอราคา (ได้งาน)", `${s.quotations} (${s.won})`],
            ["ยอดขายรวม (บาท)", money(s.salesTotal)],
            ["ค้างชำระ (บาท)", money(s.outstanding)],
            ["ค้าขายล่าสุด", s.lastDealDate || "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[11px] text-white/50">{label}</p>
              <p className="text-[14px] font-bold text-white font-mono">{value}</p>
            </div>
          ))}
        </div>
      )}
      {data && (
        <>
          <PillTabs className="w-full" tabs={SECTIONS.map((x) => ({ id: x.id, label: `${x.label} · ${(data as any)[x.id]?.length || 0}` }))} activeTab={tab} onTabChange={setTab} />
          {rows.length ? (
            <NexusTable headers={["เลขที่", "วันที่", "รายละเอียด", "สถานะ", "จำนวนเงิน"]} itemCount={rows.length}>
              {rows.map((r) => (
                <NexusTableRow key={`${tab}-${r.id}`}>
                  <NexusTableCell className="font-mono text-[12px]"><Link href={r.href} className="text-nexus-blue hover:underline">{r.no}</Link></NexusTableCell>
                  <NexusTableCell className="font-mono text-[12px] text-white/70">{r.date || "-"}</NexusTableCell>
                  <NexusTableCell className="text-[12px] text-white/85" title={r.extra ? `${r.title} · ${r.extra}` : r.title}>{r.title}{r.extra ? <span className="text-white/50"> · {r.extra}</span> : null}</NexusTableCell>
                  <NexusTableCell className="text-[12px] text-white/70">{statusTh(r.status)}</NexusTableCell>
                  <NexusTableCell className="font-mono text-[12px] text-right">{r.amount === null ? "-" : money(r.amount)}</NexusTableCell>
                </NexusTableRow>
              ))}
            </NexusTable>
          ) : (
            <p className="text-[12px] text-white/50 py-4 text-center">ยังไม่มี{SECTIONS.find((x) => x.id === tab)?.label}กับลูกค้านี้</p>
          )}
          {s?.truncated && <p className="text-[11px] text-white/40">แสดงล่าสุดไม่เกิน 100 รายการต่อประเภท</p>}
        </>
      )}
    </GlassCard>
  );
}
