"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calculator, ListTree, Save } from "lucide-react";
import { GlassCard, PillButton } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { normalizeRecipe } from "@/lib/service-recipe";
import { ServiceRecipeEditor, draftFromRecipe, recipeFromDraft, type RecipeDraft } from "@/components/inventory/ServiceRecipeEditor";
import { BomCalculator } from "@/components/inventory/BomCalculator";
import { useBom } from "@/hooks/useBom";
import { bomToRecipe, defaultInputs, expandBom, salePrice, type BomInputs, type BomSpec } from "@/lib/bom";

const priceOf = (p: any) => Number(p?.pricing?.priceProject ?? p?.pricing?.pricePOS ?? p?.price ?? 0) || 0;

/**
 * สูตรงานบริการ (เฉพาะสินค้าประเภทงานบริการ) ในหน้าสินค้า: ค่าแรง (ผูกช่าง) + วัสดุ + ราคาขาย
 * ต้นทุนคิดจากต้นทุนเฉลี่ยล่าสุดของวัสดุ + อัตราค่าแรง · ราคาขายแก้ได้ (ปุ่มราคามาตรฐาน กำไร 20%)
 */
export function ServiceRecipeCard({ companyId, product, canEdit }: { companyId: string; product: any; canEdit: boolean }) {
  const saved = useMemo(() => normalizeRecipe(product?.serviceRecipe), [product?.serviceRecipe]);
  if (saved?.bom) return <BomRecipeCard companyId={companyId} product={product} canEdit={canEdit} spec={saved.bom} savedInputs={saved.bomInputs} />;
  return <ManualRecipeCard companyId={companyId} product={product} canEdit={canEdit} saved={saved} />;
}

function ManualRecipeCard({ companyId, product, canEdit, saved }: { companyId: string; product: any; canEdit: boolean; saved: ReturnType<typeof normalizeRecipe> }) {
  const { showAlert } = useSystemDialog();
  const savedPrice = priceOf(product);
  const [draft, setDraft] = useState<RecipeDraft>(() => draftFromRecipe(saved, product?.unit || "จุด"));
  const [price, setPrice] = useState(savedPrice);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(draftFromRecipe(saved, product?.unit || "จุด")); }, [saved, product?.unit]);
  useEffect(() => { setPrice(savedPrice); }, [savedPrice]);

  const next = normalizeRecipe(recipeFromDraft(draft));
  const dirty = JSON.stringify(next) !== JSON.stringify(saved) || price !== savedPrice;

  const save = async () => {
    setBusy(true);
    try {
      const changes: Record<string, any> = { serviceRecipe: next || null };
      if (price !== savedPrice) Object.assign(changes, { pricing: { priceProject: price, pricePOS: price }, unitPrice: price });
      const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "products", id: product.id, scope: "company", changes }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      showAlert("บันทึกสูตรงานบริการแล้ว — เลือกงานนี้ในใบเสนอราคา/โครงการได้เหมือนสินค้า ระบบคิดต้นทุนจากวัสดุ + ค่าแรงให้", "บันทึกแล้ว", "info");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  return (
    <div data-service-recipe>
      <GlassCard className="p-4 border-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <ListTree size={14} className="text-nexus-teal" />
          <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">สูตรงานบริการ (ค่าแรง + วัสดุ)</h4>
        </div>
        <ServiceRecipeEditor companyId={companyId} draft={draft} onChange={setDraft} canEdit={canEdit} excludeId={product?.id}
          price={price} onPriceChange={setPrice} canCreateProducts={canEdit} />
        {canEdit && dirty && <PillButton variant="primary" className="h-9 px-4 text-xs w-full" disabled={busy} onClick={save} data-save-recipe><Save size={13} /> บันทึกสูตรงานบริการ</PillButton>}
      </GlassCard>
    </div>
  );
}

const VARIANT_TH: Record<string, string> = { PB: "Patch + Box", PLUG2: "ตัวผู้ 2 ฝั่ง", PPLUG: "Patch + ตัวผู้" };

/**
 * สูตร BOM แบบมีตัวแปร (เช่น LAN): กรอกระยะสาย/ท่อ/ขนาดท่อที่ใช้บ่อย → ต้นทุน/ราคาขายต่อจุด
 * "บันทึกเป็นค่าเริ่มต้น" = เก็บค่าที่กรอก + วัสดุ/ค่าแรงที่แตกแล้ว (ใช้ตอนเลือกงานนี้ลงเอกสาร ตัดวัสดุ แจ้งเตือนราคา) + ราคาขายตาม markup
 * ใบเสนอราคากรอกระยะต่อบรรทัดได้เองในเฟส 3
 */
function BomRecipeCard({ companyId, product, canEdit, spec, savedInputs }: { companyId: string; product: any; canEdit: boolean; spec: BomSpec; savedInputs?: BomInputs }) {
  const { showAlert } = useSystemDialog();
  const { settings, resolve } = useBom();
  const init = useMemo(() => ({ ...defaultInputs(spec, settings), ...(savedInputs || {}) }), [spec, settings, savedInputs]);
  const [inputs, setInputs] = useState<BomInputs>(init);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setInputs(init); }, [init]);
  const dirty = JSON.stringify(inputs) !== JSON.stringify(init);
  const save = async () => {
    setBusy(true);
    try {
      const res = expandBom(spec, inputs, settings, resolve);
      if (res.missing.length) throw new Error(`ยังไม่มีราคากลางของ ${res.missing.join(", ")}`);
      const recipe = { ...bomToRecipe(spec, res.items, product?.unit || "จุด"), bomInputs: inputs };
      const price = Math.round(salePrice(res.costPerUnit, settings.markup) * 100) / 100;
      const r = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "products", id: product.id, scope: "company",
        changes: { serviceRecipe: recipe, pricing: { priceProject: price, pricePOS: price }, unitPrice: price } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      showAlert(`บันทึกค่าเริ่มต้นแล้ว — ราคาขาย ${price.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท/${product?.unit || "จุด"}`, "บันทึกแล้ว", "info");
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };
  return (
    <div data-service-recipe>
      <GlassCard className="p-4 border-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-nexus-teal" />
          <h4 className="text-[12px] font-bold text-white/80 uppercase tracking-widest">สูตร BOM {spec.kind}{spec.variant ? ` · ${VARIANT_TH[spec.variant] || spec.variant}` : ""}</h4>
        </div>
        <p className="text-[12px] text-white/50">กรอกระยะเฉลี่ยต่อจุดที่ใช้บ่อย ระบบแตกอุปกรณ์ ข้อต่อ ค่าแรง จากราคากลางและตั้งค่า BOM · ใบเสนอราคากรอกระยะต่อบรรทัดได้เอง</p>
        <BomCalculator spec={spec} inputs={inputs} onInputs={setInputs} settings={settings} resolve={resolve} unit={product?.unit || "จุด"} disabled={!canEdit} />
        {canEdit && <PillButton variant="primary" className="h-9 px-4 text-xs w-full" disabled={busy} onClick={save} data-save-bom><Save size={13} /> บันทึกเป็นค่าเริ่มต้นของงานนี้{dirty ? "" : " (และราคาขายตาม markup)"}</PillButton>}
      </GlassCard>
    </div>
  );
}
