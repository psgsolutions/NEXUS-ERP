"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, PackagePlus, RefreshCw, ShoppingCart, Truck } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useSuppliers } from "@/hooks/useCustomers";
import { apiFetch } from "@/lib/api-client";
import { groupBySupplier, type ReorderLine } from "@/lib/reorder";

/**
 * สั่งซื้อตามจุดสั่งซื้อ: ระบบแนะนำสินค้าที่ (พร้อมใช้ + กำลังสั่ง) ไม่เกินจุดสั่งซื้อ พร้อมจำนวนที่ควรสั่งให้ถึงสต็อกสูงสุด
 * จัดกลุ่มตามผู้ขาย (ผู้ขายหลักของสินค้า → ผู้ขายของ Lot ล่าสุด) — เลือก/แก้จำนวน/เปลี่ยนผู้ขาย แล้ว
 *  - สร้างใบสั่งซื้อแยกใบละผู้ขาย (รออนุมัติตามขั้นตอนเดิม) หรือ
 *  - สร้างใบขอซื้อรวมใบเดียว (ให้ผู้อนุมัติเลือกผู้ขายภายหลัง)
 */
const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
const keyOf = (g: { supplierId: string; supplierName: string }) => (g.supplierId ? `id:${g.supplierId}` : `name:${g.supplierName}`);

export default function ReorderPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const { data: suppliers = [] } = useSuppliers<any>();
  const [lines, setLines] = useState<ReorderLine[] | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [supOf, setSupOf] = useState<Record<string, string>>({});
  const [includeUnset, setIncludeUnset] = useState(false);
  const [setPrimary, setSetPrimary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = useCallback(async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    setError("");
    try {
      const d = await call("/api/procurement/purchase-requests", { action: "reorderPreview", includeUnset });
      setLines(d.lines);
      setPick(Object.fromEntries(d.lines.map((l: ReorderLine) => [l.productId, l.unset ? "0" : String(l.qty)])));
      setSupOf({});
    } catch (e: any) { setError(e.message); setLines([]); }
  }, [companyId, call, includeUnset]);
  useEffect(() => { load(); }, [load]);

  const activeSuppliers = useMemo(() => suppliers.filter((s: any) => s.isDeleted !== true && s.isActive !== false)
    .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), "th")), [suppliers]);
  const groups = useMemo(() => groupBySupplier(lines || []), [lines]);
  const n = (l: ReorderLine) => Number(pick[l.productId]) || 0;
  const chosen = useMemo(() => (lines || []).filter((l) => n(l) > 0), [lines, pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = chosen.reduce((s, l) => s + n(l) * l.unitCost, 0);
  // ผู้ขายที่จะใช้ของแต่ละกลุ่ม (เลือกใหม่ได้) → ใบสั่งซื้อละผู้ขาย
  const supplierFor = (g: { supplierId: string; supplierName: string }) => supOf[keyOf(g)] ?? g.supplierId;
  const poPlan = useMemo(() => {
    const m = new Map<string, { productId: string; qty: number }[]>();
    for (const g of groups) {
      const items = g.lines.filter((l) => n(l) > 0).map((l) => ({ productId: l.productId, qty: n(l) }));
      if (!items.length) continue;
      const sid = supplierFor(g);
      m.set(sid, [...(m.get(sid) || []), ...items]);
    }
    return [...m].map(([supplierId, items]) => ({ supplierId, items }));
  }, [groups, pick, supOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = poPlan.filter((g) => !g.supplierId).reduce((s, g) => s + g.items.length, 0);
  const supName = (id: string) => activeSuppliers.find((s: any) => s.id === id)?.name || id;

  const createPOs = async () => {
    if (!poPlan.length) return;
    if (missing) { showAlert(`ยังไม่ได้เลือกผู้ขายให้สินค้า ${missing} รายการ — เลือกผู้ขายที่หัวกลุ่ม หรือยกเลิกการเลือกสินค้าเหล่านั้น`, "เลือกผู้ขายก่อน", "warning"); return; }
    const list = poPlan.map((g) => `• ${supName(g.supplierId)} — ${g.items.length} รายการ`).join("\n");
    if (!(await showConfirm(`สร้างใบสั่งซื้อ ${poPlan.length} ใบ (ใบละผู้ขาย) รวมประมาณ ${money(total)} บาท ก่อน VAT\n${list}\nใบสั่งซื้อจะรออนุมัติตามขั้นตอนปกติ`))) return;
    setBusy(true);
    try {
      const d = await call("/api/procurement/purchase-orders", { action: "reorderCreate", groups: poPlan, setPrimary });
      showAlert(`สร้างใบสั่งซื้อแล้ว ${d.created.map((c: any) => c.poCode).join(", ")} — รออนุมัติ${d.primarySet ? `\nตั้งผู้ขายหลักให้สินค้า ${d.primarySet} รายการ` : ""}`, "สร้างใบสั่งซื้อแล้ว", "info");
      await load();
    } catch (e: any) { showAlert(e.message, "สร้างใบสั่งซื้อไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };
  const createPR = async () => {
    if (!chosen.length) return;
    if (!(await showConfirm(`สร้างใบขอซื้อรวม ${chosen.length} รายการ ประมาณ ${money(total)} บาท (ก่อน VAT)?\nใบขอซื้อจะรออนุมัติตามขั้นตอนปกติ`))) return;
    setBusy(true);
    try {
      const d = await call("/api/procurement/purchase-requests", { action: "reorderCreate", items: chosen.map((l) => ({ productId: l.productId, qty: n(l) })) });
      showAlert(`สร้างใบขอซื้อ ${d.prCode} แล้ว — รออนุมัติ`);
      await load();
    } catch (e: any) { showAlert(e.message, "สร้างใบขอซื้อไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent" data-reorder-page>
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-wrap items-center gap-3 bg-black/20 shrink-0">
        <PillButton variant="glass" onClick={() => router.back()} className="w-9 h-9 p-0 flex items-center justify-center" aria-label="กลับ"><ArrowLeft size={18} /></PillButton>
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><PackagePlus size={20} /></div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">สั่งซื้อตามจุดสั่งซื้อ</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">แยกตามผู้ขาย · จำนวนแนะนำ = เติมให้ถึงสต็อกสูงสุด · สร้างใบสั่งซื้อใบละผู้ขาย</p>
        </div>
        <span className="text-[12px] text-white/60">เลือก <b className="font-mono text-white">{chosen.length}</b> · ประมาณ <b className="font-mono text-white">{money(total)}</b></span>
        <PillButton variant="glass" className="h-9 px-3 text-xs" onClick={load}><RefreshCw size={13} /> โหลดใหม่</PillButton>
        <PillButton variant="glass" className="h-9 px-3 text-xs" disabled={!chosen.length || busy} onClick={createPR}><FileText size={13} /> ใบขอซื้อรวม</PillButton>
        <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!poPlan.length || busy} onClick={createPOs} data-create-pos>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />} สร้างใบสั่งซื้อ {poPlan.length ? `${poPlan.length} ใบ` : ""}
        </PillButton>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <PillCheckbox label="รวมสินค้าที่หมดสต็อกแต่ยังไม่ตั้งจุดสั่งซื้อ (เคยมีของ)" checked={includeUnset} onChange={(e) => setIncludeUnset(e.target.checked)} />
          <PillCheckbox label="บันทึกผู้ขายที่เลือกเป็นผู้ขายหลักของสินค้า" checked={setPrimary} onChange={(e) => setSetPrimary(e.target.checked)} />
        </div>
        {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}
        {!lines ? (
          <GlassCard className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังตรวจสต็อก…</GlassCard>
        ) : lines.length === 0 ? (
          <GlassCard className="py-10 px-6 text-center text-[12px] text-white/50 space-y-1">
            <p>ไม่มีสินค้าที่ถึงจุดสั่งซื้อ</p>
            <p className="text-white/40">สินค้าที่ไม่ได้ตั้งจุดสั่งซื้อ/สต็อกขั้นต่ำจะไม่ถูกตรวจ — ตั้งได้ที่หน้าสินค้า หรือติ๊ก &quot;รวมสินค้าที่หมดสต็อก&quot; ด้านบน</p>
          </GlassCard>
        ) : groups.map((g) => {
          const k = keyOf(g);
          const sid = supplierFor(g);
          const sel = g.lines.filter((l) => n(l) > 0);
          const sub = sel.reduce((s, l) => s + n(l) * l.unitCost, 0);
          const allOn = sel.length === g.lines.length;
          return (
            <div key={k} data-supplier-group={g.supplierId || "none"}><GlassCard className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
                <Truck size={15} className={sid ? "text-nexus-teal" : "text-warning"} />
                <div className="min-w-[220px] flex-1 max-w-[420px]">
                  <PillSelect value={sid} onChange={(e) => setSupOf((m) => ({ ...m, [k]: e.target.value }))} aria-label="ผู้ขาย" className={cn("h-9 w-full text-[12px]", !sid && "border-warning/40 text-warning")}>
                    <option value="">{g.supplierName ? `ยังไม่จับคู่: ${g.supplierName} — เลือกผู้ขาย` : "ยังไม่มีผู้ขาย — เลือกผู้ขาย"}</option>
                    {activeSuppliers.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ""}{s.name}</option>)}
                  </PillSelect>
                </div>
                <span className="text-[11px] text-white/45">
                  {g.lines[0]?.supplierSource === "primary" ? "ผู้ขายหลักของสินค้า" : g.lines[0]?.supplierSource === "lot" ? "จาก Lot ที่รับล่าสุด" : "ไม่มีประวัติผู้ขาย"}
                </span>
                <span className="flex-1" />
                <PillButton variant="ghost" className="h-8 px-3 text-[11px]" onClick={() => setPick((m) => ({ ...m, ...Object.fromEntries(g.lines.map((l) => [l.productId, allOn ? "0" : String(l.qty)])) }))}>{allOn ? "ไม่เลือกทั้งกลุ่ม" : "เลือกทั้งกลุ่ม"}</PillButton>
                <span className="text-[12px] text-white/60">{sel.length}/{g.lines.length} รายการ · <b className="font-mono text-white">{money(sub)}</b></span>
              </div>
              <NexusTable headers={["", "รหัส", "สินค้า", "พร้อมใช้", "กำลังสั่ง", "จุดสั่งซื้อ", "สต็อกสูงสุด", "สั่ง", "ราคาทุน", "มูลค่า"]} itemCount={g.lines.length}>
                {g.lines.map((l) => {
                  const on = n(l) > 0;
                  return (
                    <NexusTableRow key={l.productId} className="cursor-default">
                      <NexusTableCell><PillCheckbox aria-label={`เลือก ${l.name}`} checked={on} onChange={(e) => setPick((m) => ({ ...m, [l.productId]: e.target.checked ? String(l.qty) : "0" }))} /></NexusTableCell>
                      <NexusTableCell mono>{l.sku || "-"}</NexusTableCell>
                      <NexusTableCell title={l.name}>{l.name}</NexusTableCell>
                      <NexusTableCell mono className={l.available <= 0 ? "text-danger" : "text-warning"}>{qty(l.available)}</NexusTableCell>
                      <NexusTableCell mono>{l.onOrder ? qty(l.onOrder) : "-"}</NexusTableCell>
                      <NexusTableCell mono className={l.unset ? "text-white/40" : ""}>{l.unset ? "ยังไม่ตั้ง" : qty(l.reorderPoint)}</NexusTableCell>
                      <NexusTableCell mono className={l.unset ? "text-white/40" : ""}>{l.unset ? "-" : qty(l.maxStock)}</NexusTableCell>
                      <NexusTableCell><PillInput inputMode="decimal" value={pick[l.productId] ?? ""} onChange={(e) => setPick((m) => ({ ...m, [l.productId]: e.target.value.replace(/[^\d]/g, "") }))} aria-label={`จำนวนสั่ง ${l.name}`} className="h-8 w-[90px] text-right font-mono text-sm" /></NexusTableCell>
                      <NexusTableCell mono>{money(l.unitCost)}</NexusTableCell>
                      <NexusTableCell mono>{on ? money(n(l) * l.unitCost) : "-"}</NexusTableCell>
                    </NexusTableRow>
                  );
                })}
              </NexusTable>
            </GlassCard></div>
          );
        })}
      </div>
    </div>
  );
}
