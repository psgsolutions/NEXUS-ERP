"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Link2, Package, Star, Trash2 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { useProducts } from "@/hooks/useProducts";

/**
 * สินค้าที่ผู้ขายรายนี้ขายให้บริษัท (ผูกที่สินค้า: supplierConfig ของบริษัท)
 *  - สินค้าหนึ่งตัวมีผู้ขายได้หลายราย (เทียบราคา/สำรองแหล่งซื้อ) · แต่ละบริษัทในเครือผูกของตัวเอง
 *  - ผู้ขายหลัก (isPrimary) ใช้ตั้งต้นตอนเสนอสั่งซื้อ/จุดสั่งซื้อ
 */
interface Cfg { supplierId: string; supplierSku?: string; mpn?: string; latestCost: number; leadTimeDays: number; moq?: number; isPrimary: boolean }

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SupplierProductsCard({ supplierId }: { supplierId: string }) {
  const { companyId, roles } = useAuth();
  const { showConfirm, showAlert } = useSystemDialog();
  const { data: products, loading } = useProducts<any>();
  const canEdit = can(roles, "inventory:edit");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<any>(null);
  const [form, setForm] = useState({ supplierSku: "", latestCost: "", leadTimeDays: "7", isPrimary: false });
  const [busy, setBusy] = useState(false);

  const cfgOf = (p: any): Cfg[] => (Array.isArray(p?.supplierConfig) ? p.supplierConfig.filter((c: any) => c && c.supplierId) : []);
  const linked = useMemo(() => products
    .map((p: any) => ({ p, c: cfgOf(p).find((c) => c.supplierId === supplierId) }))
    .filter((x) => x.c)
    .sort((a, b) => String(a.p.sku || "").localeCompare(String(b.p.sku || ""))), [products, supplierId]);
  const candidates = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p: any) => !cfgOf(p).some((c) => c.supplierId === supplierId) && `${p.sku || ""} ${p.name || ""} ${p.brand || ""} ${p.model || ""}`.toLowerCase().includes(t)).slice(0, 8);
  }, [products, q, supplierId]);

  const save = async (product: any, next: Cfg[]) => {
    const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "products", id: product.id, scope: "company", changes: { supplierConfig: next } }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
  };
  // ผู้ขายหลักมีได้รายเดียวต่อสินค้า
  const withPrimary = (list: Cfg[], primaryId?: string) => {
    const out = list.map((c) => ({ ...c, isPrimary: primaryId ? c.supplierId === primaryId : c.isPrimary }));
    if (out.length && !out.some((c) => c.isPrimary)) out[0].isPrimary = true;
    return out;
  };

  const add = async () => {
    if (!pick || busy) return;
    setBusy(true);
    try {
      const entry: Cfg = { supplierId, supplierSku: form.supplierSku.trim(), latestCost: Math.max(0, Number(form.latestCost) || 0), leadTimeDays: Math.max(0, Number(form.leadTimeDays) || 0), moq: 1, isPrimary: form.isPrimary };
      await save(pick, withPrimary([...cfgOf(pick), entry], form.isPrimary ? supplierId : undefined));
      setPick(null); setQ(""); setForm({ supplierSku: "", latestCost: "", leadTimeDays: "7", isPrimary: false });
    } catch (e: any) { await showAlert(e.message, "เชื่อมสินค้าไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };
  const remove = async (p: any) => {
    if (!(await showConfirm(`เลิกเชื่อม "${p.name}" กับผู้ขายรายนี้? (สินค้าและผู้ขายอื่นของสินค้ายังอยู่)`))) return;
    setBusy(true);
    try { await save(p, withPrimary(cfgOf(p).filter((c) => c.supplierId !== supplierId))); } catch (e: any) { await showAlert(e.message, "ไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };
  const makePrimary = async (p: any) => {
    setBusy(true);
    try { await save(p, withPrimary(cfgOf(p), supplierId)); } catch (e: any) { await showAlert(e.message, "ไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-white"><Package size={17} className="text-nexus-teal" /> สินค้าที่ขาย ({linked.length})</h2>
        <p className="text-[11px] text-white/50">สินค้าหนึ่งตัวมีผู้ขายได้หลายราย · ผู้ขายหลักใช้ตั้งต้นตอนสั่งซื้อ</p>
      </div>

      {canEdit && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
          <div className="relative">
            <PillInput value={pick ? `${pick.sku || ""} ${pick.name}` : q} onChange={(e) => { setPick(null); setQ(e.target.value); }} placeholder="ค้นหาสินค้าเพื่อเชื่อมกับผู้ขายรายนี้ (รหัส ชื่อ ยี่ห้อ รุ่น)" className="w-full h-9 text-sm" />
            {!pick && candidates.length > 0 && (
              <div className="mt-1 rounded-xl border border-white/10 bg-surface-2 divide-y divide-white/5">
                {candidates.map((p: any) => (
                  <PillButton key={p.id} variant="ghost" onClick={() => { setPick(p); setForm((f) => ({ ...f, latestCost: String(p.costPrice ?? p.pricing?.costWAC ?? "") })); }} className="w-full h-8 !justify-start rounded-none px-3 text-[12px] font-medium normal-case tracking-normal text-white/85">
                    <span className="font-mono text-nexus-blue shrink-0">{p.sku || p.id}</span><span className="truncate">{p.name}</span>
                    {cfgOf(p).length > 0 && <span className="ml-auto text-[11px] text-white/40 shrink-0">มีผู้ขาย {cfgOf(p).length} ราย</span>}
                  </PillButton>
                ))}
              </div>
            )}
          </div>
          {pick && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <label className="space-y-1 block"><span className="text-[12px] font-bold text-white/70">รหัสสินค้าของผู้ขาย</span><PillInput value={form.supplierSku} onChange={(e) => setForm({ ...form, supplierSku: e.target.value })} className="w-full h-9 text-sm font-mono" /></label>
              <label className="space-y-1 block"><span className="text-[12px] font-bold text-white/70">ราคาทุนล่าสุด (บาท)</span><PillInput inputMode="decimal" value={form.latestCost} onChange={(e) => setForm({ ...form, latestCost: e.target.value.replace(/[^\d.]/g, "") })} className="w-full h-9 text-sm font-mono text-right" /></label>
              <label className="space-y-1 block"><span className="text-[12px] font-bold text-white/70">รอสินค้า (วัน)</span><PillInput inputMode="numeric" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value.replace(/\D/g, "") })} className="w-full h-9 text-sm font-mono text-right" /></label>
              <PillCheckbox label="เป็นผู้ขายหลัก" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
              <PillButton variant="confirm" onClick={add} disabled={busy} className="h-9 px-4 text-xs"><Link2 size={13} /> เชื่อมสินค้า</PillButton>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-white/50 py-4 text-center">กำลังโหลด…</p>
      ) : linked.length ? (
        <NexusTable headers={["รหัสสินค้า", "ชื่อสินค้า", "รหัสของผู้ขาย", "ราคาทุนล่าสุด", "รอสินค้า (วัน)", "ผู้ขายหลัก", "ผู้ขายทั้งหมด", ""]} itemCount={linked.length}>
          {linked.map(({ p, c }) => (
            <NexusTableRow key={p.id}>
              <NexusTableCell className="font-mono text-[12px]"><Link href={`/inventory/${encodeURIComponent(p.id)}`} className="text-nexus-blue hover:underline">{p.sku || p.id}</Link></NexusTableCell>
              <NexusTableCell className="text-[12px] text-white/85">{p.name}</NexusTableCell>
              <NexusTableCell className="font-mono text-[12px] text-white/70">{c!.supplierSku || "-"}</NexusTableCell>
              <NexusTableCell className="font-mono text-[12px] text-right">{money(Number(c!.latestCost) || 0)}</NexusTableCell>
              <NexusTableCell className="font-mono text-[12px] text-right">{Number(c!.leadTimeDays) || 0}</NexusTableCell>
              <NexusTableCell className="text-[12px]">
                {c!.isPrimary
                  ? <span className="text-amber-300 inline-flex items-center gap-1"><Star size={12} /> หลัก</span>
                  : canEdit ? <PillButton variant="ghost" onClick={() => makePrimary(p)} disabled={busy} className="h-8 px-3 text-[11px] normal-case tracking-normal">ตั้งเป็นหลัก</PillButton> : "-"}
              </NexusTableCell>
              <NexusTableCell className={cn("font-mono text-[12px] text-right", cfgOf(p).length > 1 ? "text-white" : "text-white/50")}>{cfgOf(p).length}</NexusTableCell>
              <NexusTableCell>{canEdit && <PillButton variant="ghost" onClick={() => remove(p)} disabled={busy} className="h-8 px-3 text-[11px] text-danger normal-case tracking-normal"><Trash2 size={12} /> เลิกเชื่อม</PillButton>}</NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      ) : (
        <p className="text-[12px] text-white/50 py-4 text-center">ยังไม่ได้เชื่อมสินค้ากับผู้ขายรายนี้{canEdit ? " — ค้นหาสินค้าด้านบนเพื่อเชื่อม" : ""}</p>
      )}
    </GlassCard>
  );
}
