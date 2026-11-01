"use client";

import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { GlassCard, PillButton, PillInput } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

/** สรุปผลประกอบการรายเดือนภาษาไทย (ตัวเลขจากระบบ · AI เรียบเรียง หรือสรุปแบบกฎเมื่อไม่มี AI) */
export function MonthlySummaryCard() {
  const { companyId } = useAuth();
  const prev = (() => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const [month, setMonth] = useState(prev);
  const [res, setRes] = useState<{ monthLabel: string; text: string; source: "ai" | "rule"; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true); setError("");
    try {
      const r = await apiFetch("/api/ai/monthly-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, month }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "สรุปไม่สำเร็จ");
      setRes(d);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <GlassCard accentColor="teal" className="p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Sparkles size={18} className="text-nexus-teal" />
          <h3 className="text-[15px] font-bold text-white">สรุปผลประกอบการรายเดือน</h3>
        </div>
        <PillInput type="month" value={month} max={new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-[160px] text-sm font-mono" aria-label="เดือน" />
        <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={busy || !companyId} onClick={run}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} สรุปเดือนนี้</PillButton>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {res ? (
        <div className="space-y-2">
          <p className="text-[12px] text-white/45">{res.monthLabel} · {res.source === "ai" ? "เรียบเรียงโดย AI จากตัวเลขในระบบ" : "สรุปจากตัวเลขในระบบ"}{res.note ? ` (AI ไม่พร้อม: ${res.note})` : ""}</p>
          <div className="text-[14px] leading-[1.9] text-white/85 whitespace-pre-line">{res.text}</div>
        </div>
      ) : (
        <p className="text-[13px] text-white/45">เลือกเดือนแล้วกด &quot;สรุปเดือนนี้&quot; — ยอดขาย กำไร เงินสด ลูกหนี้ค้าง ลูกค้า/สินค้าหลัก และรายการผิดปกติ ในไม่กี่บรรทัด</p>
      )}
    </GlassCard>
  );
}
