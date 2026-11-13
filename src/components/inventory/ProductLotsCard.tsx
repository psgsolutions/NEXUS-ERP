"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Layers, Loader2 } from "lucide-react";
import { GlassCard, PillTabs, cn } from "@/components/ui/Base";
import { apiFetch } from "@/lib/api-client";
import { lotAgeDays } from "@/lib/stock-lots";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: string) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T00:00:00+07:00" : d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

/**
 * Lot ของสินค้า (หน้ารายสินค้า): สรุปรับ/จ่าย · Lot ที่ยังมีของ (เรียงเข้าก่อนออกก่อน) / ทั้งหมด
 * คลิก Lot = ติดตามไปข้างหน้า: ตัดออกให้เอกสาร/ลูกค้าใดไปกี่ชิ้น (ใช้ตอนผู้ขายเรียกคืนหรือเคลม)
 */
export function ProductLotsCard({ companyId, productId, unit }: { companyId: string; productId: string; unit?: string }) {
  const [tab, setTab] = useState("open");
  const [lots, setLots] = useState<any[] | null>(null);
  const [sum, setSum] = useState<any>(null);
  const [openLot, setOpenLot] = useState("");
  const [trace, setTrace] = useState<Record<string, any[]>>({});
  const call = (body: any) => apiFetch("/api/inventory/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) }).then((r) => r.json());

  useEffect(() => {
    if (!companyId || !productId) return;
    let off = false;
    setLots(null);
    Promise.all([call({ action: tab === "open" ? "open" : "product", productId }), call({ action: "summary", productId })])
      .then(([a, b]) => { if (off) return; setLots(a.success ? a.lots || [] : []); if (b.success) setSum(b.summary); })
      .catch(() => { if (!off) setLots([]); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, productId, tab]);

  const toggle = async (lotNo: string) => {
    setOpenLot((x) => (x === lotNo ? "" : lotNo));
    if (trace[lotNo]) return;
    const d = await call({ action: "trace", lotNo }).catch(() => ({}));
    setTrace((t) => ({ ...t, [lotNo]: d.success ? d.issues || [] : [] }));
  };
  const seeCost = sum && sum.inValue !== undefined;
  const kpis: [string, string][] = sum ? [
    ["Lot ที่มีของ", `${sum.openLots}`],
    ["Lot เก่าสุด", sum.oldestLotDate ? `${lotAgeDays(sum.oldestLotDate)} วัน` : "-"],
    ["รับเข้ารวม", `${sum.inQty.toLocaleString("th-TH")} ${unit || ""}`],
    ["จ่ายออกรวม", `${sum.outQty.toLocaleString("th-TH")} ${unit || ""}`],
    ...(seeCost ? [["มูลค่ารับเข้า", money(sum.inValue)], ["ต้นทุนจ่ายออก", money(sum.outCost)]] as [string, string][] : []),
  ] : [];

  return (
    <div data-product-lots>
      <GlassCard className="p-4 border-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-nexus-teal" />
          <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest flex-1">Lot สินค้า</h4>
          <Link href={`/inventory/stock-card?product=${encodeURIComponent(productId)}`} className="text-[11px] text-nexus-teal hover:underline">บัตรคุมสินค้า</Link>
        </div>
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {kpis.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                <p className="text-[11px] text-white/45">{k}</p>
                <p className="text-[12px] font-bold text-white font-mono">{v}</p>
              </div>
            ))}
          </div>
        )}
        <PillTabs tabs={[{ id: "open", label: "ที่มีของ" }, { id: "all", label: "ทั้งหมด" }]} activeTab={tab} onTabChange={setTab} />
        {lots === null ? <p className="text-[12px] text-white/50 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> กำลังโหลด…</p>
          : !lots.length ? <p className="text-[12px] text-white/50">{tab === "open" ? "ไม่มี Lot ที่ยังมีของ" : "ยังไม่มีการรับเข้า"}</p> : (
          <div className="space-y-1">
            {lots.map((l) => (
              <div key={l.lotNo} className="rounded-lg bg-white/[0.03]">
                <div role="button" tabIndex={0} onClick={() => toggle(l.lotNo)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(l.lotNo); } }} className="w-full text-left px-2 py-1.5 space-y-0.5 cursor-pointer rounded-lg hover:bg-white/5">
                  <div className="flex items-center gap-1.5 text-[12px]">
                    {openLot === l.lotNo ? <ChevronDown size={12} className="text-white/50 shrink-0" /> : <ChevronRight size={12} className="text-white/50 shrink-0" />}
                    <span className="font-mono text-white/90 flex-1 truncate">{l.lotNo}</span>
                    <span className={cn("font-mono", l.qtyRemaining > 0 ? "text-nexus-teal" : "text-white/40")}>{l.qtyRemaining}/{l.qtyReceived}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50 pl-[18px]">
                    <span className="truncate flex-1">{day(l.receivedDate)} · {[l.supplierName, l.source === "OPENING" ? "ยอดยกมา" : l.grNo].filter(Boolean).join(" · ")}</span>
                    {l.unitCost !== undefined && <span className="font-mono shrink-0">{money(l.unitCost)}</span>}
                  </div>
                </div>
                {openLot === l.lotNo && (
                  <div className="px-2 pb-2 pl-[26px] space-y-0.5 text-[11px]">
                    {l.projectName && <p className="text-white/55">โปรเจกต์: {l.projectName}</p>}
                    {l.poRef && <p className="text-white/45 truncate" title={l.poRef}>อ้างอิง: {l.poRef}</p>}
                    {!trace[l.lotNo] ? <p className="text-white/45">กำลังโหลด…</p> : !trace[l.lotNo].length ? <p className="text-white/45">ยังไม่มีการตัดออกจาก Lot นี้</p>
                      : trace[l.lotNo].map((t, i) => (
                        <p key={i} className="text-white/70 flex gap-1.5"><span className="text-white/45">{day(t.at)}</span><span className="font-mono">{t.ref}</span><span className="truncate flex-1">{t.party}</span><span className="font-mono">−{t.qty}</span></p>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
