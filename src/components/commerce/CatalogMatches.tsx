"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

const money = (v: number) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ผลค้นจากแคตตาล็อกราคาผู้ขาย (ใต้รายการสินค้าในระบบ) — คลิก = สร้างเป็นสินค้า (หรือใช้สินค้าที่ผูกไว้แล้ว) แล้วลงบรรทัด
 * ค้นเมื่อพิมพ์ ≥ 3 ตัวอักษร · ไม่ค้นซ้ำกับสินค้าที่มีในระบบแล้ว (ผลที่มีแล้วแสดงป้าย "มีในระบบ")
 */
export function CatalogMatches({ q, onPick }: { q: string; onPick: (product: any) => void }) {
  const { companyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const term = q.trim();

  useEffect(() => {
    setError("");
    if (!companyId || term.replace(/\s/g, "").length < 3) { setItems([]); return; }
    let off = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiFetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "search", q: term }) });
        const d = await r.json().catch(() => ({}));
        if (!off) setItems(d.success ? d.items : []);
      } finally { if (!off) setLoading(false); }
    }, 400);
    return () => { off = true; clearTimeout(t); };
  }, [companyId, term]);

  const pick = async (x: any) => {
    setBusy(x.code); setError("");
    try {
      const r = await apiFetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "adopt", key: x.key, code: x.code }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "เพิ่มสินค้าไม่สำเร็จ");
      onPick(d.product);
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  };

  if (term.replace(/\s/g, "").length < 3 || (!loading && !items.length && !error)) return null;
  return (
    <div className="border-t border-white/10 mt-1" data-catalog-matches>
      <div className="p-2 text-[12px] font-bold text-amber-300/90 flex items-center gap-1.5">
        <BookOpen size={12} /> <span className="flex-1">จากแคตตาล็อกผู้ขาย — คลิกเพื่อเพิ่มเป็นสินค้า</span>
        {loading && <Loader2 size={12} className="animate-spin" />}
      </div>
      {error && <p className="px-3 pb-2 text-[12px] text-danger font-bold">{error}</p>}
      <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1 space-y-1">
        {items.map((x) => (
          <div key={`${x.key}:${x.code}`} role="button" tabIndex={0}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) pick(x); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) pick(x); }}
            className={cn("w-full px-3 py-2 rounded-xl text-[12px] border border-transparent hover:bg-amber-400/10 hover:border-amber-400/30 flex items-center gap-2 cursor-pointer", busy === x.code && "opacity-60")}>
            <div className="w-[110px] shrink-0 font-mono text-[12px] text-amber-300 font-bold break-all">{x.model || x.code}</div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-white block truncate" title={x.name}>{x.name}</span>
              <span className="text-[11px] text-white/45">{x.catalog} · {x.category}{x.productId ? " · มีในระบบแล้ว" : ""}</span>
            </div>
            <div className="text-right shrink-0 font-mono text-[12px]">
              <div className="font-bold text-white/90">{money(x.price)}</div>
              {x.cost !== undefined && <div className="text-[11px] text-white/45">ทุน {money(x.cost)}</div>}
            </div>
            {busy === x.code && <Loader2 size={12} className="animate-spin text-amber-300" />}
          </div>
        ))}
      </div>
    </div>
  );
}
