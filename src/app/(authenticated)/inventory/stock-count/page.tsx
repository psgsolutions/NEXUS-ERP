"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Loader2, Save } from "lucide-react";
import { GlassCard, NexusSearchInput, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";

/**
 * ตรวจนับสต็อก: กรอกจำนวนที่นับได้ เทียบยอดในระบบ แล้วบันทึกปรับสต็อกตามผลต่าง
 * - ยอดในระบบที่ใช้เทียบ = ยอดตอนกรอกจำนวนของสินค้านั้น · มีรับ/เบิกระหว่างนับ เซิร์ฟเวอร์ปฏิเสธให้นับใหม่
 * - ผลต่างคิดมูลค่าตามต้นทุนเฉลี่ย ลงบัญชีรวมเป็นรายการรอฝ่ายบัญชีอนุมัติ
 */
const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

type CountRow = { id: string; countDate: string; note: string; lines: number; diffLines: number; shortValue: number; overValue: number; createdByName: string };

export default function StockCountPage() {
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canPost = can(roles, "inventory:edit");
  const { data: products, loading } = useProducts<any>();
  const [counted, setCounted] = useState<Record<string, { counted: string; book: number }>>({});
  const [search, setSearch] = useState("");
  const [onlyEntered, setOnlyEntered] = useState(false);
  const [countDate, setCountDate] = useState(todayBkk);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<CountRow[]>([]);

  const loadHistory = useCallback(async () => {
    if (!companyId) return;
    const res = await apiFetch("/api/inventory/stock-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "list" }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.success) setHistory(d.counts);
  }, [companyId]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // สินค้าที่นับได้ (ไม่รวมบริการ/ค่าแรง)
  const items = useMemo(() => (products || [])
    .filter((p: any) => p.isDeleted !== true && !["SERVICE", "LABOR"].includes(String(p.productType || p.itemType || "").toUpperCase()))
    .map((p: any) => ({ id: String(p.id), name: String(p.name || "-"), sku: String(p.sku || ""), unit: String(p.unit || p.uom || "ชิ้น"), onHand: Number(p.stockStatus?.onHand ?? 0), wac: Number(p.pricing?.costWAC ?? p.costPrice ?? 0) || 0 }))
    .sort((a: any, b: any) => a.sku.localeCompare(b.sku) || a.name.localeCompare(b.name, "th")), [products]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p: any) => (!onlyEntered || counted[p.id]) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  }, [items, search, onlyEntered, counted]);

  const entered = items.filter((p: any) => counted[p.id] && counted[p.id].counted !== "");
  const diffOf = (p: any) => { const c = counted[p.id]; return c && c.counted !== "" ? Number(c.counted) - c.book : null; };
  const shortValue = entered.reduce((s: number, p: any) => { const d = diffOf(p)!; return d < 0 ? s - d * p.wac : s; }, 0);
  const overValue = entered.reduce((s: number, p: any) => { const d = diffOf(p)!; return d > 0 ? s + d * p.wac : s; }, 0);

  const setCount = (p: any, v: string) => {
    const clean = v.replace(/[^\d.]/g, "");
    setCounted((m) => {
      const n = { ...m };
      if (clean === "") delete n[p.id];
      // ยอดในระบบตอนเริ่มกรอกสินค้านี้ (ใช้เทียบผลต่าง)
      else n[p.id] = { counted: clean, book: m[p.id]?.book ?? p.onHand };
      return n;
    });
  };

  const post = async () => {
    if (!entered.length) return;
    const diffs = entered.filter((p: any) => diffOf(p) !== 0).length;
    if (!(await showConfirm(`บันทึกผลตรวจนับ ${entered.length} รายการ (มีผลต่าง ${diffs} รายการ)?\nสินค้าขาด ${money(shortValue)} บาท · เกิน ${money(overValue)} บาท\nระบบจะปรับสต็อกและบันทึกบัญชีผลต่างรอฝ่ายบัญชีอนุมัติ`))) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/inventory/stock-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        companyId, action: "post", countDate, note, lines: entered.map((p: any) => ({ productId: p.id, counted: Number(counted[p.id].counted), book: counted[p.id].book })),
      }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setCounted({}); setNote("");
      showAlert(`บันทึกใบตรวจนับ ${d.id} แล้ว ปรับสต็อก ${d.diffLines} รายการ`);
      loadHistory();
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setSaving(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex flex-wrap items-center gap-3 bg-black/20 shrink-0">
        <PillButton variant="glass" onClick={() => router.push("/inventory")} className="w-9 h-9 p-0 flex items-center justify-center" aria-label="กลับ"><ArrowLeft size={18} /></PillButton>
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><ClipboardCheck size={20} /></div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">ตรวจนับสต็อก</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">กรอกจำนวนที่นับได้ ระบบเทียบยอดในระบบ ปรับสต็อก และบันทึกบัญชีผลต่าง</p>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-white/60">
          <span>กรอกแล้ว <b className="font-mono text-white">{entered.length}</b></span>
          <span>ขาด <b className="font-mono text-danger">{money(shortValue)}</b></span>
          <span>เกิน <b className="font-mono text-nexus-teal">{money(overValue)}</b></span>
          {canPost && <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!entered.length || saving} onClick={post}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึกผลตรวจนับ</PillButton>}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]"><NexusSearchInput value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="ค้นหารหัสหรือชื่อสินค้า" /></div>
          <PillInput type="date" value={countDate} max={todayBkk()} onChange={(e) => e.target.value && setCountDate(e.target.value)} className="h-9 w-[170px] text-sm font-mono" aria-label="วันที่ตรวจนับ" />
          <PillInput value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="หมายเหตุ เช่น ตรวจนับสิ้นเดือน คลังหลัก" className="h-9 w-[280px] max-w-full text-sm" />
          <PillCheckbox label="เฉพาะที่กรอกแล้ว" checked={onlyEntered} onChange={(e) => setOnlyEntered(e.target.checked)} />
        </div>
        {!canPost && <p className="text-[12px] text-warning">ดูและกรอกทดลองได้ · บันทึกผลตรวจนับได้เฉพาะผู้ดูแลคลังสินค้า</p>}

        <GlassCard className="p-0 overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลดสินค้า…</div>
          ) : (
            <NexusTable headers={["รหัส", "สินค้า", "หน่วย", "ยอดในระบบ", "นับได้", "ผลต่าง", "มูลค่าผลต่าง"]} itemCount={rows.length}>
              {rows.length === 0 && <NexusTableRow className="cursor-default"><NexusTableCell colSpan={7} className="text-center text-[13px] text-white/40 py-10">ไม่มีสินค้า</NexusTableCell></NexusTableRow>}
              {rows.map((p: any) => {
                const d = diffOf(p), c = counted[p.id];
                return (
                  <NexusTableRow key={p.id} className="cursor-default">
                    <NexusTableCell mono>{p.sku || "-"}</NexusTableCell>
                    <NexusTableCell title={p.name}>{p.name}</NexusTableCell>
                    <NexusTableCell>{p.unit}</NexusTableCell>
                    <NexusTableCell mono title={c && c.book !== p.onHand ? `ยอดเปลี่ยนเป็น ${qty(p.onHand)} หลังเริ่มนับ — ล้างแล้วกรอกใหม่` : undefined} className={c && c.book !== p.onHand ? "text-warning" : ""}>{qty(c ? c.book : p.onHand)}</NexusTableCell>
                    <NexusTableCell>
                      <PillInput inputMode="decimal" value={c?.counted ?? ""} onChange={(e) => setCount(p, e.target.value)} placeholder="–" aria-label={`จำนวนที่นับได้ ${p.name}`} className="h-8 w-[100px] text-right font-mono text-sm" />
                    </NexusTableCell>
                    <NexusTableCell mono className={cn(d === null ? "text-white/30" : d < 0 ? "text-danger" : d > 0 ? "text-nexus-teal" : "")}>{d === null ? "-" : d > 0 ? `+${qty(d)}` : qty(d)}</NexusTableCell>
                    <NexusTableCell mono className={cn(d && d < 0 ? "text-danger" : d && d > 0 ? "text-nexus-teal" : "text-white/40")}>{d ? money(d * p.wac) : "-"}</NexusTableCell>
                  </NexusTableRow>
                );
              })}
            </NexusTable>
          )}
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-[14px] font-bold text-white">ใบตรวจนับที่บันทึกแล้ว</div>
          <NexusTable headers={["เลขที่", "วันที่ตรวจนับ", "หมายเหตุ", "รายการ", "มีผลต่าง", "มูลค่าขาด", "มูลค่าเกิน", "ผู้บันทึก"]} itemCount={history.length}>
            {history.length === 0 && <NexusTableRow className="cursor-default"><NexusTableCell colSpan={8} className="text-center text-[13px] text-white/40 py-8">ยังไม่มีใบตรวจนับ</NexusTableCell></NexusTableRow>}
            {history.map((h) => (
              <NexusTableRow key={h.id} className="cursor-default">
                <NexusTableCell mono className="text-amber-300">{h.id}</NexusTableCell>
                <NexusTableCell mono>{h.countDate}</NexusTableCell>
                <NexusTableCell title={h.note}>{h.note || "-"}</NexusTableCell>
                <NexusTableCell mono>{h.lines}</NexusTableCell>
                <NexusTableCell mono>{h.diffLines}</NexusTableCell>
                <NexusTableCell mono className="text-danger">{money(h.shortValue)}</NexusTableCell>
                <NexusTableCell mono className="text-nexus-teal">{money(h.overValue)}</NexusTableCell>
                <NexusTableCell>{h.createdByName}</NexusTableCell>
              </NexusTableRow>
            ))}
          </NexusTable>
        </GlassCard>
      </div>
    </div>
  );
}
