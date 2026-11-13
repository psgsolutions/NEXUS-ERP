"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Save, Tags, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect } from "@/components/ui/Base";
import { ChoiceInput } from "@/components/ui/ChoiceInput";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { DEFAULT_PRICING, PRICE_BASES, priceSuggestions, type MarkupRule, type PricingSettings } from "@/lib/price-bases";
import { SKU_CATEGORIES, SKU_OTHER } from "@/lib/sku-scheme";

/**
 * กฎราคาขาย: markup ตั้งต้น · markup ตามหมวด/ยี่ห้อ (ยี่ห้อมาก่อนหมวด) · GP% เป้าหมาย · ฐานราคาตั้งต้น
 * ตัวอย่างการคำนวณแสดงด้วยตัวเลขจากเอกสารออกแบบ (Lot A 3×1,000 + Lot B 2×1,200)
 */
export function PricingRulesSettings() {
  const { companyId, roles } = useAuth();
  const { showAlert } = useSystemDialog();
  const { data: products = [] } = useProducts<any>();
  const [p, setP] = useState<PricingSettings>(DEFAULT_PRICING);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = can(roles, "settings:manage");
  const brands = useMemo(() => Array.from(new Set(products.map((x: any) => String(x.brand || "").trim()).filter(Boolean))).sort(), [products]);
  const cats = [...SKU_CATEGORIES.map((c) => ({ code: c.code, label: c.label })), SKU_OTHER];

  useEffect(() => {
    if (!companyId) return;
    apiFetch("/api/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "settings" }) })
      .then((r) => r.json()).then((d) => { if (d.success) { setP(d.pricing); setSaved(JSON.stringify(d.pricing)); } }).catch(() => {});
  }, [companyId]);

  const setRule = (i: number, patch: Partial<MarkupRule>) => setP((x) => ({ ...x, rules: x.rules.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "saveSettings", pricing: p }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      setP(d.pricing); setSaved(JSON.stringify(d.pricing));
      showAlert("บันทึกกฎราคาขายแล้ว — ใช้กับราคาแนะนำในใบเสนอราคาทันที", "บันทึกแล้ว", "info");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };
  const example = priceSuggestions({ fifoCost: 5400, pickedUnitCosts: [1000, 1200], newestLotCost: 1200, oldestLotCost: 1000, lastPurchaseCost: 1200, listPrice: null, lastSoldPrice: null, qty: 5 }, p.defaultMarkupPct, p.targetGpPct)
    .filter((s) => s.available);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4" data-pricing-settings>
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Tags size={16} className="text-nexus-teal" />
          <h3 className="text-[14px] font-bold text-white flex-1">กฎราคาขาย</h3>
          {canEdit && <PillButton variant="primary" className="h-9 px-4 text-xs" disabled={busy || JSON.stringify(p) === saved} onClick={save}><Save size={14} /> บันทึกกฎราคา</PillButton>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">markup ตั้งต้น (%)</span>
            <PillInput inputMode="decimal" value={String(p.defaultMarkupPct)} disabled={!canEdit} onChange={(e) => setP({ ...p, defaultMarkupPct: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-9 w-full text-right font-mono" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">GP% เป้าหมาย</span>
            <PillInput inputMode="decimal" value={String(p.targetGpPct)} disabled={!canEdit} onChange={(e) => setP({ ...p, targetGpPct: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-9 w-full text-right font-mono" />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">ฐานราคาตั้งต้น</span>
            <PillSelect value={p.defaultBase} disabled={!canEdit} onChange={(e) => setP({ ...p, defaultBase: e.target.value as any })} className="h-9 w-full text-[12px]">
              {PRICE_BASES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </PillSelect>
          </label>
        </div>
        <div className="space-y-2">
          <p className="text-[12px] font-bold text-white/70">markup ตามหมวด / ยี่ห้อ (ยี่ห้อมาก่อนหมวด)</p>
          {p.rules.length === 0 && <p className="text-[12px] text-white/45">ยังไม่มีกฎ — ทุกสินค้าใช้ markup ตั้งต้น</p>}
          {p.rules.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <PillSelect value={r.type} disabled={!canEdit} onChange={(e) => setRule(i, { type: e.target.value as any, key: "" })} className="h-9 w-[110px] text-[12px]">
                <option value="category">หมวด</option><option value="brand">ยี่ห้อ</option>
              </PillSelect>
              <div className="flex-1 min-w-0">
                {r.type === "category" ? (
                  <PillSelect value={r.key} disabled={!canEdit} onChange={(e) => setRule(i, { key: e.target.value })} className="h-9 w-full text-[12px]">
                    <option value="">เลือกหมวด</option>
                    {cats.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
                  </PillSelect>
                ) : (
                  <ChoiceInput value={r.key} onChange={(v) => setRule(i, { key: v })} options={brands} placeholder="ยี่ห้อ" disabled={!canEdit} className="w-full" />
                )}
              </div>
              <PillInput inputMode="decimal" value={String(r.markupPct)} disabled={!canEdit} aria-label="markup %" onChange={(e) => setRule(i, { markupPct: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-9 w-[90px] text-right font-mono" />
              <span className="text-[12px] text-white/50">%</span>
              {canEdit && <PillButton variant="ghost" className="h-9 w-9 px-0 text-danger/80" aria-label="ลบกฎ" onClick={() => setP({ ...p, rules: p.rules.filter((_, k) => k !== i) })}><Trash2 size={14} /></PillButton>}
            </div>
          ))}
          {canEdit && <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={() => setP({ ...p, rules: [...p.rules, { type: "category", key: "", markupPct: p.defaultMarkupPct }] })}><Plus size={14} /> เพิ่มกฎ</PillButton>}
        </div>
      </GlassCard>
      <GlassCard className="p-5 space-y-2">
        <p className="text-[12px] font-bold text-white/80">ตัวอย่าง: ขาย 5 ชิ้น = Lot A 3 × 1,000 + Lot B 2 × 1,200 (ทุนจริง 5,400)</p>
        {example.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[12px]">
            <span className="flex-1 text-white/70 truncate" title={s.hint}>{s.label}</span>
            <span className="font-mono text-white/50">{s.base?.toLocaleString("th-TH")}</span>
            <span className="font-mono font-bold text-white w-[70px] text-right">{s.price?.toLocaleString("th-TH")}</span>
            <span className="font-mono text-white/55 w-[52px] text-right">{s.gpPct}%</span>
          </div>
        ))}
        <p className="text-[11px] text-white/45 leading-relaxed">ในใบเสนอราคา กดขยายบรรทัดสินค้าจะเห็นราคาแนะนำทุกฐาน คลิกเพื่อใช้ ราคาที่พิมพ์เองไม่ถูกเขียนทับ</p>
      </GlassCard>
    </div>
  );
}
