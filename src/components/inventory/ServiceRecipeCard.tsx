"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ListTree, Save } from "lucide-react";
import { GlassCard, PillButton } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { normalizeRecipe } from "@/lib/service-recipe";
import { ServiceRecipeEditor, draftFromRecipe, recipeFromDraft, type RecipeDraft } from "@/components/inventory/ServiceRecipeEditor";

const priceOf = (p: any) => Number(p?.pricing?.priceProject ?? p?.pricing?.pricePOS ?? p?.price ?? 0) || 0;

/**
 * สูตรงานบริการ (เฉพาะสินค้าประเภทงานบริการ) ในหน้าสินค้า: ค่าแรง (ผูกช่าง) + วัสดุ + ราคาขาย
 * ต้นทุนคิดจากต้นทุนเฉลี่ยล่าสุดของวัสดุ + อัตราค่าแรง · ราคาขายแก้ได้ (ปุ่มราคามาตรฐาน กำไร 20%)
 */
export function ServiceRecipeCard({ companyId, product, canEdit }: { companyId: string; product: any; canEdit: boolean }) {
  const { showAlert } = useSystemDialog();
  const saved = useMemo(() => normalizeRecipe(product?.serviceRecipe), [product?.serviceRecipe]);
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
