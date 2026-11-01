"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PackagePlus, RefreshCw } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import type { ReorderLine } from "@/lib/reorder";

/**
 * สั่งซื้อตามจุดสั่งซื้อ: ระบบแนะนำสินค้าที่ (พร้อมใช้ + กำลังสั่ง) ไม่เกินจุดสั่งซื้อ พร้อมจำนวนที่ควรสั่งให้ถึงสต็อกสูงสุด
 * เลือก/แก้จำนวน แล้วสร้างใบขอซื้อ (รออนุมัติตามขั้นตอนเดิม)
 */
const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });

export default function ReorderPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const [lines, setLines] = useState<ReorderLine[] | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = useCallback(async (body: Record<string, any>) => {
    const res = await apiFetch("/api/procurement/purchase-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setError("");
    try {
      const d = await call({ action: "reorderPreview" });
      setLines(d.lines);
      setPick(Object.fromEntries(d.lines.map((l: ReorderLine) => [l.productId, String(l.qty)])));
    } catch (e: any) { setError(e.message); setLines([]); }
  }, [companyId, call]);
  useEffect(() => { load(); }, [load]);

  const chosen = useMemo(() => (lines || []).filter((l) => Number(pick[l.productId]) > 0), [lines, pick]);
  const total = chosen.reduce((s, l) => s + Number(pick[l.productId]) * l.unitCost, 0);

  const create = async () => {
    if (!chosen.length) return;
    if (!(await showConfirm(`สร้างใบขอซื้อ ${chosen.length} รายการ ประมาณ ${money(total)} บาท (ก่อน VAT)?\nใบขอซื้อจะรออนุมัติตามขั้นตอนปกติ`))) return;
    setBusy(true);
    try {
      const d = await call({ action: "reorderCreate", items: chosen.map((l) => ({ productId: l.productId, qty: Number(pick[l.productId]) })) });
      showAlert(`สร้างใบขอซื้อ ${d.prCode} แล้ว — รออนุมัติ`);
      await load();
    } catch (e: any) { showAlert(e.message, "สร้างใบขอซื้อไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-wrap items-center gap-3 bg-black/20 shrink-0">
        <PillButton variant="glass" onClick={() => router.back()} className="w-9 h-9 p-0 flex items-center justify-center" aria-label="กลับ"><ArrowLeft size={18} /></PillButton>
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><PackagePlus size={20} /></div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">สั่งซื้อตามจุดสั่งซื้อ</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">สินค้าที่พร้อมใช้ + กำลังสั่ง ไม่เกินจุดสั่งซื้อ · จำนวนแนะนำ = เติมให้ถึงสต็อกสูงสุด</p>
        </div>
        <span className="text-[12px] text-white/60">เลือก <b className="font-mono text-white">{chosen.length}</b> · ประมาณ <b className="font-mono text-white">{money(total)}</b></span>
        <PillButton variant="glass" className="h-9 px-3 text-xs" onClick={load}><RefreshCw size={13} /> โหลดใหม่</PillButton>
        <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!chosen.length || busy} onClick={create}>{busy ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />} สร้างใบขอซื้อ</PillButton>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}
        <GlassCard className="p-0 overflow-hidden">
          {!lines ? (
            <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังตรวจสต็อก…</div>
          ) : (
            <NexusTable headers={["", "รหัส", "สินค้า", "พร้อมใช้", "กำลังสั่ง", "จุดสั่งซื้อ", "สต็อกสูงสุด", "สั่ง", "ราคาทุน", "มูลค่า"]} itemCount={lines.length}>
              {lines.length === 0 && <NexusTableRow className="cursor-default"><NexusTableCell colSpan={10} className="text-center text-[12px] text-white/40 py-10">ไม่มีสินค้าที่ถึงจุดสั่งซื้อ (สินค้าที่ไม่ได้ตั้งจุดสั่งซื้อ/สต็อกขั้นต่ำจะไม่ถูกตรวจ)</NexusTableCell></NexusTableRow>}
              {lines.map((l) => {
                const on = Number(pick[l.productId]) > 0;
                return (
                  <NexusTableRow key={l.productId} className="cursor-default">
                    <NexusTableCell><PillCheckbox aria-label={`เลือก ${l.name}`} checked={on} onChange={(e) => setPick((m) => ({ ...m, [l.productId]: e.target.checked ? String(l.qty) : "0" }))} /></NexusTableCell>
                    <NexusTableCell mono>{l.sku || "-"}</NexusTableCell>
                    <NexusTableCell title={l.supplierName ? `ผู้จำหน่ายหลัก: ${l.supplierName}` : l.name}>{l.name}</NexusTableCell>
                    <NexusTableCell mono className={l.available <= 0 ? "text-danger" : "text-warning"}>{qty(l.available)}</NexusTableCell>
                    <NexusTableCell mono>{l.onOrder ? qty(l.onOrder) : "-"}</NexusTableCell>
                    <NexusTableCell mono>{qty(l.reorderPoint)}</NexusTableCell>
                    <NexusTableCell mono>{qty(l.maxStock)}</NexusTableCell>
                    <NexusTableCell><PillInput inputMode="decimal" value={pick[l.productId] ?? ""} onChange={(e) => setPick((m) => ({ ...m, [l.productId]: e.target.value.replace(/[^\d]/g, "") }))} aria-label={`จำนวนสั่ง ${l.name}`} className="h-8 w-[90px] text-right font-mono text-sm" /></NexusTableCell>
                    <NexusTableCell mono>{money(l.unitCost)}</NexusTableCell>
                    <NexusTableCell mono>{on ? money(Number(pick[l.productId]) * l.unitCost) : "-"}</NexusTableCell>
                  </NexusTableRow>
                );
              })}
            </NexusTable>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
