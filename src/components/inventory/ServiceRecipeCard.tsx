"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ListTree, Plus, Save, Trash2, Wrench } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { normalizeRecipe, recipeCost, recipeDetails, recipeMargin, type RecipeMaterial, type ServiceRecipe } from "@/lib/service-recipe";
import { ChoiceInput } from "@/components/ui/ChoiceInput";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const costOfProduct = (p: any) => Number(p?.pricing?.costWAC ?? p?.costPrice ?? p?.cost ?? 0) || 0;
const UNITS = ["จุด", "งาน", "ชุด", "ตัว", "เครื่อง", "เมตร", "ครั้ง"];

/**
 * สูตรงานบริการ (เฉพาะสินค้าประเภทงานบริการ): วัสดุจากรายการสินค้า × จำนวนต่อ 1 หน่วยงาน + ค่าแรงต่อหน่วย
 * ต้นทุนคิดจากต้นทุนเฉลี่ยล่าสุดของวัสดุ · ราคาขายคงที่ (ราคาของงานบริการ) แสดง % กำไร
 */
export function ServiceRecipeCard({ companyId, product, canEdit }: { companyId: string; product: any; canEdit: boolean }) {
  const { showAlert } = useSystemDialog();
  const { data: products = [] } = useProducts<any>();
  const saved = useMemo(() => normalizeRecipe(product?.serviceRecipe), [product?.serviceRecipe]);
  const [unit, setUnit] = useState(saved?.unit || "จุด");
  const [labor, setLabor] = useState(String(saved?.laborCost ?? ""));
  const [mats, setMats] = useState<RecipeMaterial[]>(saved?.materials || []);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUnit(saved?.unit || "จุด"); setLabor(String(saved?.laborCost ?? "")); setMats(saved?.materials || []); }, [saved]);

  const byId = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);
  const draft: ServiceRecipe = { unit, laborCost: Number(labor) || 0, materials: mats };
  const cost = recipeCost(draft, (id) => costOfProduct(byId.get(id)));
  const price = Number(product?.pricing?.priceProject ?? product?.pricing?.pricePOS ?? product?.price ?? 0) || 0;
  const margin = recipeMargin(price, cost.total);
  const dirty = JSON.stringify(normalizeRecipe(draft)) !== JSON.stringify(saved);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p: any) => p.id !== product?.id && String(p.itemType || "PRODUCT").toUpperCase() !== "SERVICE" && !mats.some((m) => m.productId === p.id)
      && `${p.sku || ""} ${p.name || ""}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, products, mats, product?.id]);

  const add = (p: any) => { setMats((m) => [...m, { productId: p.id, sku: p.sku || "", name: p.name || p.id, unit: p.unit || "", qty: 1 }]); setQ(""); };
  const save = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "products", id: product.id, scope: "company", changes: { serviceRecipe: normalizeRecipe(draft) || null } }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      showAlert("บันทึกสูตรงานบริการแล้ว — เลือกงานนี้ในใบเสนอราคา/โครงการ ระบบคิดต้นทุนจากวัสดุให้", "บันทึกแล้ว", "info");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  return (
    <div data-service-recipe>
    <GlassCard className="p-4 border-white/5 space-y-3">
      <div className="flex items-center gap-2">
        <ListTree size={14} className="text-nexus-teal" />
        <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">สูตรงานบริการ (วัสดุ + ค่าแรง)</h4>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 block"><span className="text-[11px] text-white/55">คิดราคาต่อ</span>
          <ChoiceInput value={unit} onChange={setUnit} options={UNITS} disabled={!canEdit} className="w-full" />
        </label>
        <label className="space-y-1 block"><span className="text-[11px] text-white/55">ค่าแรงต่อ 1 {unit || "หน่วย"} (บาท)</span>
          <PillInput inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value.replace(/[^\d.]/g, ""))} disabled={!canEdit} placeholder="0.00" className="h-9 w-full text-right font-mono" />
        </label>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] text-white/55">วัสดุต่อ 1 {unit || "หน่วย"} (ดึงจากรายการสินค้า)</p>
        {mats.length ? mats.map((m, i) => {
          const c = costOfProduct(byId.get(m.productId));
          return (
            <div key={m.productId} className="rounded-lg px-2 py-1.5 bg-white/[0.03] space-y-1">
              <p className="truncate text-[12px] text-white/85" title={`${m.sku || ""} ${m.name}`}>{m.name}</p>
              <div className="flex items-center gap-2">
              <span className="flex-1 text-[11px] text-white/45">ทุน {money(c)} / {m.unit || "หน่วย"}</span>
              <PillInput inputMode="decimal" value={String(m.qty)} disabled={!canEdit} aria-label={`จำนวน ${m.name}`}
                onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "")) || 0; setMats((x) => x.map((y, k) => (k === i ? { ...y, qty: v } : y))); }} className="h-8 w-[72px] text-right font-mono text-[12px]" />
              <span className="w-10 text-[11px] text-white/50 truncate">{m.unit}</span>
              <span className="w-[76px] text-right font-mono text-[12px] text-white/70" title={`ทุนเฉลี่ย ${money(c)} ต่อ${m.unit || "หน่วย"}`}>{money(c * m.qty)}</span>
              {canEdit && <PillButton variant="ghost" className="h-8 w-8 px-0 text-danger/80" aria-label="ลบวัสดุ" onClick={() => setMats((x) => x.filter((_, k) => k !== i))}><Trash2 size={12} /></PillButton>}
              </div>
            </div>
          );
        }) : <p className="text-[12px] text-white/45 px-1">ยังไม่มีวัสดุ — ค้นหาสินค้าด้านล่างเพื่อเพิ่ม</p>}
        {canEdit && (
          <div className="relative">
            <PillInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาวัสดุ เช่น สายแลน หัว RJ45 รางขาว" className="h-9 w-full text-[12px]" />
            {hits.length > 0 && (
              <div className="mt-1 rounded-xl border border-white/10 bg-surface-1 max-h-56 overflow-y-auto">
                {hits.map((p: any) => (
                  <PillButton key={p.id} variant="ghost" onClick={() => add(p)} className="h-8 w-full justify-start rounded-none px-3 text-[12px] normal-case tracking-normal font-normal">
                    <Plus size={12} className="text-nexus-teal shrink-0" /><span className="truncate flex-1 text-left">{p.name}</span><span className="font-mono text-white/50">{money(costOfProduct(p))}</span>
                  </PillButton>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 p-2.5 space-y-1 text-[12px]">
        <div className="flex justify-between text-white/70"><span>ค่าวัสดุ</span><span className="font-mono">{money(cost.material)}</span></div>
        <div className="flex justify-between text-white/70"><span>ค่าแรง</span><span className="font-mono">{money(cost.labor)}</span></div>
        <div className="flex justify-between font-bold text-white"><span>ต้นทุนต่อ 1 {unit || "หน่วย"}</span><span className="font-mono">{money(cost.total)}</span></div>
        <div className="flex justify-between text-white/70"><span>ราคาขาย (ตั้งที่ราคาของสินค้านี้)</span><span className="font-mono">{money(price)}</span></div>
        <div className={cn("flex justify-between font-bold", margin === null ? "text-white/50" : margin < 15 ? "text-danger" : "text-success")}>
          <span>กำไรขั้นต้น</span><span>{margin === null ? "ยังไม่ตั้งราคาขาย" : `${margin}% (${money(price - cost.total)} บาท)`}</span>
        </div>
      </div>
      {mats.length > 0 && <p className="text-[11px] text-white/50 flex gap-1"><Wrench size={12} className="shrink-0 mt-0.5" />ในเอกสารลูกค้าแสดง: {recipeDetails(draft)}</p>}
      {canEdit && dirty && <PillButton variant="primary" className="h-9 px-4 text-xs w-full" disabled={busy} onClick={save}><Save size={13} /> บันทึกสูตรงานบริการ</PillButton>}
    </GlassCard>
    </div>
  );
}
