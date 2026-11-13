"use client";

import React, { useEffect, useState } from "react";
import { Calculator, Check, Loader2 } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { BaseSuggestion, PriceBaseKey } from "@/lib/price-bases";

const money = (v: number | null | undefined) => (v === null || v === undefined ? "-" : Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * ราคาแนะนำทุกฐานของบรรทัดขาย (คลิกเพื่อใช้) — คิดจาก Lot ที่จะถูกตัดแบบเข้าก่อนออกก่อนตามจำนวนที่ขาย
 * ใช้แล้วบันทึกฐานที่ใช้ไว้ในบรรทัด (priceBase) · ต้นทุนของบรรทัดเปลี่ยนเป็นต้นทุนจริงของ Lot ที่หยิบ (ผู้เห็นต้นทุน)
 * ราคาที่ผู้ขายพิมพ์เองไม่ถูกเขียนทับ จนกว่าจะคลิกฐานใหม่
 */
export function PriceBasePanel({ productId, qty, customerId, currentPrice, currentBase, disabled, onApply }: {
  productId: string; qty: number; customerId?: string; currentPrice: number; currentBase?: string; disabled?: boolean;
  onApply: (v: { price: number; priceBase: PriceBaseKey; cost?: number }) => void;
}) {
  const { companyId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!companyId || !productId) return;
    let off = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiFetch("/api/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "bases", productId, qty: Math.max(1, Number(qty) || 1), customerId: customerId || "" }) });
        const d = await r.json().catch(() => ({}));
        if (!off) setData(d.success ? d : null);
      } finally { if (!off) setLoading(false); }
    }, 350);
    return () => { off = true; clearTimeout(t); };
  }, [companyId, productId, qty, customerId]);

  if (!productId) return null;
  if (loading && !data) return <p className="text-[11px] text-white/50 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> กำลังคำนวณราคาแนะนำ…</p>;
  if (!data) return null;
  const list: BaseSuggestion[] = data.suggestions || [];
  const seeCost = data.unitCost !== undefined;
  const below = seeCost && data.unitCost !== null && currentPrice > 0 && currentPrice < data.unitCost;
  return (
    <div className="space-y-1.5 pt-2 border-t border-white/5" data-price-bases>
      <div className="flex items-center gap-1.5 text-[12px] text-white/70">
        <Calculator size={12} className="text-nexus-teal" />
        <span className="flex-1">ราคาแนะนำ · markup {data.markupPct}% ({data.markupSource})</span>
        {seeCost && data.unitCost !== null && <span className="font-mono text-[11px] text-white/55">ทุนจริง {money(data.unitCost)}</span>}
      </div>
      {below && <p className="text-[11px] font-bold text-danger">ราคาขายต่ำกว่าต้นทุนจริงของ Lot ที่จะถูกตัด</p>}
      {data.shortQty > 0 && <p className="text-[11px] text-warning">สต็อกไม่พอ {data.shortQty} — ส่วนที่ขาดคิดจากราคาซื้อล่าสุด/ต้นทุนเฉลี่ย</p>}
      <div className="grid grid-cols-1 gap-1">
        {list.filter((s) => s.available).map((s) => {
          const on = currentBase === s.key && Math.abs((s.price || 0) - currentPrice) < 0.005;
          return (
            <PillButton key={s.key} variant="ghost" disabled={disabled || s.price === null} title={s.hint}
              onClick={() => onApply({ price: s.price!, priceBase: s.key, ...(seeCost && data.unitCost !== null ? { cost: data.unitCost } : {}) })}
              className={cn("h-8 w-full justify-between px-2.5 rounded-lg normal-case tracking-normal font-normal text-[12px]", on ? "bg-nexus-teal/15 text-nexus-teal" : "bg-white/[0.03] text-white/80")}>
              <span className="flex items-center gap-1.5 truncate">{on && <Check size={11} />}{s.label}{s.key === "lastSold" && data.lastSoldDoc ? ` (${data.lastSoldDoc})` : ""}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold">{money(s.price)}</span>
                {s.gpPct !== null && <span className={cn("font-mono text-[11px] w-[52px] text-right", s.gpPct < 0 ? "text-danger" : s.gpPct < 10 ? "text-warning" : "text-white/55")}>{s.gpPct}%</span>}
              </span>
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}
