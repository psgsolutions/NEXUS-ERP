"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { HardHat, Loader2, Plus, Save } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { ChoiceInput } from "@/components/ui/ChoiceInput";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { can } from "@/lib/permissions";
import { isLaborItem, suggestServicePrice } from "@/lib/service-recipe";
import { createLaborRate, updateLaborRate } from "@/lib/labor-rate-client";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => Number(String(v).replace(/[^\d.]/g, "")) || 0;
const UNITS = ["จุด", "งาน", "ระบบ", "เมตร", "ตัว", "เครื่อง", "วัน", "ครั้ง"];
const rateOf = (p: any) => Number(p?.costPrice ?? p?.pricing?.costWAC ?? 0) || 0;
const sellOf = (p: any) => Number(p?.pricing?.priceProject ?? p?.price ?? p?.unitPrice ?? 0) || 0;

/**
 * อัตราค่าแรงของช่าง/ผู้รับเหมาที่มีอยู่แล้ว (ผู้ขายและผู้รับเหมาใช้รหัสเดียวกัน)
 * เพิ่มอัตราใหม่ / แก้อัตราและราคาขาย — ใช้เลือกในสูตรงานบริการ ใบเสนอราคา และ BOQ
 * ผูก "รหัสค่าแรงกลาง" (ราคากลาง LAB-…) → ใบเสนอราคาแบบ BOM เทียบต้นทุนจริงของช่างกับค่าแรงที่เสนอ
 */
export function LaborRatesCard({ contractorId, contractorName }: { contractorId: string; contractorName: string }) {
  const { companyId, roles } = useAuth();
  const { showAlert } = useSystemDialog();
  const { data: products = [] } = useProducts<any>();
  const canEdit = can(roles, "procurement:edit") && can(roles, "inventory:edit");
  const rates = useMemo(() => products.filter((p: any) => isLaborItem(p) && p.subcontractorId === contractorId && p.isDeleted !== true), [products, contractorId]);
  const [edits, setEdits] = useState<Record<string, { rate: string; sell: string }>>({});
  const [add, setAdd] = useState({ serviceType: "", unit: "จุด", rate: "", sell: "" });
  const [busy, setBusy] = useState("");
  // ค่าแรงกลางจากราคากลาง (สินค้าที่มี bomCode LAB-…)
  const labCodes = useMemo(() => products.filter((p: any) => /^LAB-/.test(String(p.bomCode || "")) && p.isDeleted !== true)
    .map((p: any) => ({ code: String(p.bomCode), name: String(p.name || ""), ref: Number(p.refCost) || 0, unit: String(p.unit || "") })).sort((a, b) => a.code.localeCompare(b.code)), [products]);
  const setCode = async (p: any, laborCode: string) => {
    setBusy(p.id);
    try { await updateLaborRate(companyId!, p.id, { laborCode }); } catch (err: any) { showAlert(err.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };

  const saveEdit = async (p: any) => {
    const e = edits[p.id]; if (!e) return;
    setBusy(p.id);
    try {
      await updateLaborRate(companyId!, p.id, { ratePerUnit: num(e.rate), standardSellingPrice: num(e.sell) });
      setEdits((x) => { const { [p.id]: _drop, ...rest } = x; void _drop; return rest; });
    } catch (err: any) { showAlert(err.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };
  const create = async () => {
    setBusy("new");
    try {
      await createLaborRate(companyId!, { id: contractorId, name: contractorName }, { serviceType: add.serviceType, unit: add.unit, ratePerUnit: num(add.rate), standardSellingPrice: num(add.sell) || undefined });
      setAdd({ serviceType: "", unit: add.unit, rate: "", sell: "" });
    } catch (err: any) { showAlert(err.message, "เพิ่มอัตราค่าแรงไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };
  const suggested = suggestServicePrice(num(add.rate));

  return (
    <div data-labor-rates>
    <GlassCard className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <HardHat size={17} className="text-nexus-teal" />
        <h2 className="text-[15px] font-bold text-white">อัตราค่าแรง (ช่าง/ผู้รับเหมา)</h2>
        <span className="text-[12px] text-white/50">{rates.length} รายการ · เลือกใช้ได้ในงานบริการ/ติดตั้ง ใบเสนอราคา และ BOQ</span>
      </div>
      {rates.length > 0 ? (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5">
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_170px_80px_130px_130px_90px_90px] gap-2 px-3 py-1.5 text-[12px] text-white/50">
            <span>งาน</span><span>รหัสค่าแรงกลาง</span><span>หน่วย</span><span className="text-right">ค่าแรง (ทุน)</span><span className="text-right">ราคาขาย</span><span className="text-right">กำไร</span><span />
          </div>
          {rates.map((p: any) => {
            const e = edits[p.id];
            const rate = e ? num(e.rate) : rateOf(p), sell = e ? num(e.sell) : sellOf(p);
            const m = sell > 0 ? Math.round(((sell - rate) / sell) * 1000) / 10 : null;
            return (
              <div key={p.id} className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_170px_80px_130px_130px_90px_90px] gap-2 px-3 py-1.5 items-center text-[14px]" data-labor-rate-row>
                <Link href={`/inventory/${p.id}`} className="col-span-2 md:col-span-1 truncate text-white/85 hover:text-nexus-teal" title={p.name}>{String(p.name || "").replace(/^\[ค่าแรง\]\s*/, "").replace(` (${contractorName})`, "")}</Link>
                {(() => {
                  const ref = labCodes.find((c) => c.code === p.laborCode);
                  return canEdit && labCodes.length ? (
                    <div className="min-w-0" title={ref ? `${ref.name} · ราคากลาง ${money(ref.ref)}/${ref.unit}` : "ผูกกับค่าแรงในราคากลาง เพื่อเทียบในใบเสนอราคาแบบ BOM"}>
                      <PillSelect value={String(p.laborCode || "")} disabled={busy === p.id} onChange={(ev) => setCode(p, ev.target.value)} className="h-8 w-full text-[12px]" aria-label={`รหัสค่าแรงกลาง ${p.name}`}>
                        <option value="">- ไม่ผูก -</option>
                        {labCodes.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </PillSelect>
                    </div>
                  ) : <span className="font-mono text-[12px] text-white/60" title={ref?.name}>{p.laborCode || "-"}{ref ? <span className="block text-[11px] text-white/40">กลาง {money(ref.ref)}</span> : null}</span>;
                })()}
                <span className="text-white/60">{p.unit || "-"}</span>
                {canEdit ? <PillInput inputMode="decimal" value={e ? e.rate : String(rateOf(p))} aria-label={`ค่าแรง ${p.name}`} onChange={(ev) => setEdits((x) => ({ ...x, [p.id]: { rate: ev.target.value, sell: x[p.id]?.sell ?? String(sellOf(p)) } }))} className="h-8 w-full text-right font-mono text-[12px]" />
                  : <span className="text-right font-mono">{money(rate)}</span>}
                {canEdit ? <PillInput inputMode="decimal" value={e ? e.sell : String(sellOf(p))} aria-label={`ราคาขาย ${p.name}`} onChange={(ev) => setEdits((x) => ({ ...x, [p.id]: { rate: x[p.id]?.rate ?? String(rateOf(p)), sell: ev.target.value } }))} className="h-8 w-full text-right font-mono text-[12px]" />
                  : <span className="text-right font-mono">{money(sell)}</span>}
                <span className={cn("text-right font-mono text-[12px]", m === null ? "text-white/40" : m < 15 ? "text-danger" : "text-success")}>{m === null ? "-" : `${m}%`}</span>
                <span className="text-right">{canEdit && e && <PillButton variant="primary" className="h-8 px-3 text-xs" disabled={busy === p.id} onClick={() => saveEdit(p)}>{busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} บันทึก</PillButton>}</span>
              </div>
            );
          })}
        </div>
      ) : <p className="text-[14px] text-white/50">ยังไม่มีอัตราค่าแรงของรายนี้</p>}
      {canEdit && (
        <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_150px_130px_130px_auto] gap-2 items-end" data-add-labor-rate>
          <label className="col-span-2 md:col-span-1 space-y-1 block"><span className="text-[12px] text-white/60">งาน</span>
            <PillInput value={add.serviceType} onChange={(e) => setAdd({ ...add, serviceType: e.target.value })} placeholder="เช่น เดินสายแลน ตั้ง Outlet" className="h-9 w-full" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">หน่วย</span>
            <ChoiceInput value={add.unit} onChange={(v) => setAdd({ ...add, unit: v })} options={UNITS} className="w-full" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">ค่าแรง (บาท)</span>
            <PillInput inputMode="decimal" value={add.rate} onChange={(e) => setAdd({ ...add, rate: e.target.value.replace(/[^\d.]/g, "") })} className="h-9 w-full text-right font-mono" aria-label="ค่าแรงใหม่" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">ราคาขาย {suggested > 0 && !add.sell ? `(กำไร 20% = ${money(suggested)})` : ""}</span>
            <PillInput inputMode="decimal" value={add.sell} onChange={(e) => setAdd({ ...add, sell: e.target.value.replace(/[^\d.]/g, "") })} placeholder={suggested ? String(suggested) : "0.00"} className="h-9 w-full text-right font-mono" aria-label="ราคาขายใหม่" />
          </label>
          <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={busy === "new" || !add.serviceType.trim() || !(num(add.rate) > 0)} onClick={create} data-add-labor-rate-btn>
            {busy === "new" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} เพิ่มอัตรา
          </PillButton>
        </div>
      )}
    </GlassCard>
    </div>
  );
}
