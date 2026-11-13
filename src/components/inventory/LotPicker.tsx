"use client";

import React, { useMemo } from "react";
import { Layers, RotateCcw } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { allocateLots, lotAgeDays, type LotPick } from "@/lib/stock-lots";

export interface OpenLotView { lotNo: string; qtyRemaining: number; receivedDate: string; supplierName?: string; projectName?: string; unitCost?: number; grNo?: string; source?: string }

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: string) => (d ? new Date(d + "T00:00:00+07:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

/**
 * เลือก Lot ที่จะตัดออก: ไม่กรอก = ระบบตัดแบบเข้าก่อนออกก่อน (FIFO) · กรอกจำนวนที่ Lot ใด = ใช้ Lot นั้นก่อน ที่เหลือเติมแบบ FIFO
 * แสดงผลการจัดสรรจริง (Lot ไหน กี่ชิ้น) และต้นทุนรวม (เฉพาะผู้ที่เห็นต้นทุน)
 */
export function LotPicker({ lots, qty, value, onChange, disabled }: { lots: OpenLotView[]; qty: number; value: LotPick[]; onChange: (v: LotPick[]) => void; disabled?: boolean }) {
  const open = lots.filter((l) => l.qtyRemaining > 0);
  const result = useMemo(() => {
    try {
      const r = allocateLots(open.map((l) => ({ lotNo: l.lotNo, remaining: l.qtyRemaining, unitCost: Number(l.unitCost) || 0, receivedDate: l.receivedDate })), qty, value);
      return { ...r, error: "" };
    } catch (e: any) { return { allocations: [], short: 0, error: String(e.message || e) }; }
  }, [open, qty, value]);
  const seeCost = open.some((l) => l.unitCost !== undefined);
  const used = new Map(result.allocations.map((a) => [a.lotNo, a.qty]));
  const pickOf = (lotNo: string) => value.find((v) => v.lotNo === lotNo)?.qty;
  const setPick = (lotNo: string, raw: string) => {
    const q = Math.max(0, Math.floor(Number(raw.replace(/[^\d]/g, "")) || 0));
    const rest = value.filter((v) => v.lotNo !== lotNo);
    onChange(q > 0 ? [...rest, { lotNo, qty: q }] : rest);
  };
  const cost = result.allocations.reduce((s, a) => s + a.qty * a.unitCost, 0);

  if (!open.length) return <p className="text-[11px] text-white/45">ไม่มี Lot (สต็อกเดิมก่อนใช้ระบบ Lot — ตัดด้วยต้นทุนเฉลี่ย)</p>;
  return (
    <div className="space-y-1.5" data-lot-picker>
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        <Layers size={12} className="text-nexus-teal" />
        <span className="flex-1">{value.length ? "เลือก Lot เอง (ที่เหลือเติมแบบเข้าก่อนออกก่อน)" : "ระบบเลือก Lot ให้แบบเข้าก่อนออกก่อน (FIFO) — กรอกจำนวนที่ Lot เพื่อเลือกเอง"}</span>
        {value.length > 0 && !disabled && <PillButton variant="ghost" className="h-8 px-2 text-[11px] normal-case tracking-normal" onClick={() => onChange([])}><RotateCcw size={11} /> กลับเป็น FIFO</PillButton>}
      </div>
      {open.map((l) => {
        const u = used.get(l.lotNo) || 0;
        const age = lotAgeDays(l.receivedDate);
        return (
          <div key={l.lotNo} className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-[12px]", u > 0 ? "bg-nexus-teal/10 border border-nexus-teal/30" : "bg-white/[0.03] border border-transparent")}>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-white/90 truncate">{l.lotNo} <span className="text-white/45 font-sans">· รับ {day(l.receivedDate)}{age > 180 ? ` (${age} วัน)` : ""}</span></p>
              <p className="text-[11px] text-white/45 truncate">{[l.supplierName, l.projectName, l.source === "OPENING" ? "ยอดยกมา" : l.grNo].filter(Boolean).join(" · ")}</p>
            </div>
            {seeCost && <span className="font-mono text-[11px] text-white/55 w-[72px] text-right" title="ต้นทุนต่อหน่วยของ Lot">{money(Number(l.unitCost))}</span>}
            <span className="text-[11px] text-white/55 w-[56px] text-right">เหลือ {l.qtyRemaining}</span>
            <PillInput inputMode="numeric" value={pickOf(l.lotNo) !== undefined ? String(pickOf(l.lotNo)) : ""} placeholder={u ? String(u) : "0"} disabled={disabled}
              onChange={(e) => setPick(l.lotNo, e.target.value)} aria-label={`จำนวนจาก ${l.lotNo}`} className={cn("h-8 w-[64px] text-right font-mono text-[12px]", u > 0 && pickOf(l.lotNo) === undefined && "placeholder:text-nexus-teal")} />
          </div>
        );
      })}
      {result.error ? <p className="text-[11px] text-danger font-bold">{result.error}</p> : (
        <p className="text-[11px] text-white/60">
          ตัดจริง: {result.allocations.map((a) => `${a.lotNo} × ${a.qty}`).join(" + ") || "-"}
          {result.short > 0 ? ` + สต็อกเดิมไม่มี Lot ${result.short}` : ""}
          {seeCost && result.allocations.length ? ` · ต้นทุน ${money(cost)} บาท` : ""}
        </p>
      )}
    </div>
  );
}
