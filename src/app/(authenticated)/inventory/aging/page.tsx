"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Hourglass, Loader2 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

/** สินค้าเคลื่อนไหวช้า และมูลค่าสต็อกตามอายุ (นับจากวันเบิกออกล่าสุด) */
const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
const dateTh = (d: string) => { if (!d) return "-"; const [y, m, dd] = d.split("-").map(Number); return `${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`; };
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export default function StockAgingPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [asOf, setAsOf] = useState(todayBkk);
  const [slowDays, setSlowDays] = useState(90);
  const [onlySlow, setOnlySlow] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/reports/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, report: "aging", asOf, slowDays }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "สร้างรายงานไม่สำเร็จ");
      setData(d);
    } catch (e: any) { setError(e.message); setData(null); } finally { setLoading(false); }
  }, [companyId, asOf, slowDays]);
  useEffect(() => { load(); }, [load]);

  const rows = (data?.rows || []).filter((r: any) => !onlySlow || r.slow);
  const exportCsv = () => {
    if (!data) return;
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["สินค้าเคลื่อนไหวช้า / มูลค่าสต็อกตามอายุ"], [`ณ ${dateTh(data.asOf)}`], [], ["รหัส", "สินค้า", "หน่วย", "คงเหลือ", "ต้นทุนเฉลี่ย", "มูลค่า", "รับเข้าล่าสุด", "เบิกออกล่าสุด", "ไม่เคลื่อนไหว (วัน)", "ช่วงอายุ"],
      ...rows.map((r: any) => [r.sku, r.name, r.unit, r.onHand, r.unitCost, r.value, r.lastIn, r.lastOut, r.days ?? "", data.buckets.find((b: any) => b.key === r.bucket)?.label || ""])];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `stock-aging_${data.asOf}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-wrap items-center gap-3 bg-black/20 shrink-0">
        <PillButton variant="glass" onClick={() => router.push("/inventory")} className="w-9 h-9 p-0 flex items-center justify-center" aria-label="กลับ"><ArrowLeft size={18} /></PillButton>
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><Hourglass size={20} /></div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">สินค้าเคลื่อนไหวช้า · อายุสต็อก</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">อายุนับจากวันเบิกออกล่าสุด (ไม่เคยเบิก = นับจากรับเข้าล่าสุด) · มูลค่าตามต้นทุนเฉลี่ย</p>
        </div>
        <PillInput type="date" value={asOf} max={todayBkk()} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="h-9 w-[170px] text-sm font-mono" aria-label="ณ วันที่" />
        <div className="w-[170px]">
          <PillSelect value={String(slowDays)} onChange={(e) => setSlowDays(Number(e.target.value))} className="h-9 w-full text-sm">
            {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>ช้า = ไม่เบิกเกิน {d} วัน</option>)}
          </PillSelect>
        </div>
        <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" onClick={exportCsv} disabled={!data}><Download size={14} /> ส่งออก Excel</PillButton>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <GlassCard className="p-3"><p className="text-[12px] text-white/50">มูลค่าสต็อกรวม</p><p className="text-[16px] font-bold font-mono text-white">{money(data.total)}</p></GlassCard>
            {data.buckets.map((b: any) => (
              <GlassCard key={b.key} className="p-3"><p className="text-[12px] text-white/50">{b.label} · {b.items} รายการ</p><p className={cn("text-[16px] font-bold font-mono", b.key === "0-30" ? "text-nexus-teal" : b.key === "365+" ? "text-danger" : "text-white")}>{money(b.value)}</p></GlassCard>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <PillCheckbox label={`เฉพาะสินค้าเคลื่อนไหวช้า${data ? ` (${data.slowItems} รายการ · ${money(data.slowValue)} บาท)` : ""}`} checked={onlySlow} onChange={(e) => setOnlySlow(e.target.checked)} />
        </div>
        <GlassCard className="p-0 overflow-hidden">
          {loading && !data ? (
            <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังสร้างรายงาน…</div>
          ) : (
            <NexusTable headers={["รหัส", "สินค้า", "คงเหลือ", "หน่วย", "ต้นทุนเฉลี่ย", "มูลค่า", "รับเข้าล่าสุด", "เบิกออกล่าสุด", "ไม่เคลื่อนไหว (วัน)"]} itemCount={rows.length}>
              {rows.length === 0 && <NexusTableRow className="cursor-default"><NexusTableCell colSpan={9} className="text-center text-[12px] text-white/40 py-10">{onlySlow ? "ไม่มีสินค้าเคลื่อนไหวช้า" : "ไม่มีสินค้าคงเหลือ"}</NexusTableCell></NexusTableRow>}
              {rows.map((r: any) => (
                <NexusTableRow key={r.productId} className="cursor-default">
                  <NexusTableCell mono>{r.sku || "-"}</NexusTableCell>
                  <NexusTableCell title={r.name}>{r.name}</NexusTableCell>
                  <NexusTableCell mono>{qty(r.onHand)}</NexusTableCell>
                  <NexusTableCell>{r.unit}</NexusTableCell>
                  <NexusTableCell mono>{money(r.unitCost)}</NexusTableCell>
                  <NexusTableCell mono>{money(r.value)}</NexusTableCell>
                  <NexusTableCell mono>{dateTh(r.lastIn)}</NexusTableCell>
                  <NexusTableCell mono>{dateTh(r.lastOut)}</NexusTableCell>
                  <NexusTableCell mono className={cn(r.days === null || r.days > 365 ? "text-danger" : r.slow ? "text-warning" : "")}>{r.days === null ? "ไม่ทราบ" : r.days}</NexusTableCell>
                </NexusTableRow>
              ))}
            </NexusTable>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
