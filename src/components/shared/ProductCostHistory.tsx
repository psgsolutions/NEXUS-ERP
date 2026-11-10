"use client";

import React, { useEffect, useState } from "react";
import { History, TrendingDown, TrendingUp } from "lucide-react";
import { GlassCard, cn } from "@/components/ui/Base";
import { apiFetch } from "@/lib/api-client";
import { changePct, PRICE_ALERT_THRESHOLD_PCT } from "@/lib/price-alerts";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

/** ประวัติราคาทุนรายล็อต (การรับเข้าแต่ละครั้ง): วันที่ ผู้ขาย จำนวน ราคาต่อหน่วย เทียบต้นทุนเฉลี่ยก่อนรับ และต้นทุนเฉลี่ยหลังรับ */
export function ProductCostHistory({ companyId, productId }: { companyId: string; productId: string }) {
  const [lots, setLots] = useState<any[] | null>(null);
  useEffect(() => {
    if (!companyId || !productId) return;
    let off = false;
    apiFetch("/api/price-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "history", productId }) })
      .then((r) => r.json()).then((d) => { if (!off) setLots(d.success ? d.lots || [] : []); }).catch(() => { if (!off) setLots([]); });
    return () => { off = true; };
  }, [companyId, productId]);

  return (
    <div data-cost-history>
    <GlassCard className="p-4 border-white/5 space-y-3">
      <div className="flex items-center gap-2">
        <History size={14} className="text-nexus-teal" />
        <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">ประวัติราคาทุนรายล็อต</h4>
      </div>
      {lots === null ? <p className="text-[12px] text-white/50">กำลังโหลด…</p> : !lots.length ? (
        <p className="text-[12px] text-white/50">ยังไม่มีการรับสินค้าเข้า</p>
      ) : (
        <div className="space-y-1">
          {lots.slice(0, 12).map((l, i) => {
            const p = changePct(l.wacBefore, l.unitCost);
            const big = p !== null && Math.abs(p) >= PRICE_ALERT_THRESHOLD_PCT;
            return (
              <div key={i} className="rounded-lg px-2 py-1.5 hover:bg-white/5 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 w-[72px] shrink-0">{day(l.at)}</span>
                  <span className="truncate flex-1 text-white/80">{l.party || l.ref || "-"}</span>
                  <span className="font-mono text-white/90 shrink-0">{money(l.unitCost)}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/50 whitespace-nowrap">
                  <span className="w-[72px] shrink-0">รับ {l.qty.toLocaleString("th-TH")}</span>
                  <span className="truncate flex-1" title="ต้นทุนเฉลี่ยก่อน → หลังรับล็อตนี้">เฉลี่ย {money(l.wacBefore)} → {money(l.wacAfter)}</span>
                  {p !== null && <span className={cn("inline-flex items-center gap-0.5 shrink-0", big ? (p > 0 ? "text-danger font-bold" : "text-success font-bold") : "")} title="ราคาล็อตนี้เทียบต้นทุนเฉลี่ยก่อนรับ">{p > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{p > 0 ? "+" : ""}{p.toFixed(1)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
    </div>
  );
}
