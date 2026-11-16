"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Wrench } from "lucide-react";
import { GlassCard, PillBackButton, PillButton, PillInput } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { normalizeRecipe } from "@/lib/service-recipe";
import { ServiceRecipeEditor, recipeFromDraft, type RecipeDraft } from "@/components/inventory/ServiceRecipeEditor";

/**
 * สร้างงานบริการ/งานติดตั้งในหน้าเดียว: ชื่อ รายละเอียด หน่วย ค่าแรง (เลือกช่าง) วัสดุ/ชุดอุปกรณ์ ราคาขาย (กำไรมาตรฐาน 20%)
 * บันทึกเป็นสินค้าประเภทงานบริการ — เลือกลงใบเสนอราคา/ใบสั่งขาย/โครงการได้เหมือนสินค้า
 */
export default function NewServicePage() {
  const router = useRouter();
  const { companyId, roles } = useAuth() as any;
  const { showAlert } = useSystemDialog();
  const canEdit = can(roles, "inventory:edit");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<RecipeDraft>({ unit: "จุด", labors: [], materials: [] });
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return void showAlert("กรุณาระบุชื่องาน เช่น เดินสายแลน แบบที่ 1");
    setBusy(true);
    try {
      const recipe = normalizeRecipe(recipeFromDraft(draft));
      const data = {
        name: name.trim(), productName: name.trim(), description: description.trim(), details: description.trim(),
        category: "งานบริการ", itemType: "SERVICE", productType: "SERVICE", type: "SERVICE", lifecycleStatus: "ACTIVE", isActive: true,
        unit: draft.unit || "จุด", baseUnit: draft.unit || "จุด", taxType: "VAT_7", vatType: "VAT_7", whtRate: 3,
        pricing: { priceProject: price, pricePOS: price }, unitPrice: price,
        serviceRecipe: recipe,
      };
      const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "create", entity: "products", autoSku: true, data }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      // ไปหน้าสินค้าของงานนี้ (การ์ดสูตรงานบริการ) — เลือกลงใบเสนอราคาได้เหมือนสินค้า
      router.push(`/inventory/${d.id}#service-recipe`);
    } catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };

  if (!canEdit) return <div className="p-6 text-white/60 text-sm">ต้องมีสิทธิ์แก้ไขคลังสินค้าจึงสร้างงานบริการได้</div>;

  return (
    <div className="p-4 xl:p-6 max-w-[1100px] mx-auto space-y-4" data-new-service>
      <div className="flex items-center gap-3">
        <PillBackButton onClick={() => router.back()} />
        <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal flex items-center justify-center"><Wrench size={20} /></div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white leading-none">สร้างงานบริการ / งานติดตั้ง</h1>
          <p className="text-xs text-white/55 mt-1">ค่าแรง + วัสดุต่อ 1 หน่วยงาน → ต้นทุน กำไร ราคาขาย · เลือกลงใบเสนอราคาได้เหมือนสินค้า</p>
        </div>
        <span className="flex-1" />
        <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" disabled={busy} onClick={save} data-save-service>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึกงานบริการ
        </PillButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-start">
        <GlassCard className="p-5 space-y-3">
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">ชื่องาน *</span>
            <PillInput value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เดินสายแลน แบบที่ 1 (ตั้ง Outlet)" className="h-9 w-full" data-service-name />
          </label>
          <label className="space-y-1 block"><span className="text-[12px] text-white/60">รายละเอียด (แสดงในเอกสารลูกค้า)</span>
            <PillInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="เช่น ต้นทางเข้า Patch Panel + ปลายทางตั้ง Outlet" className="h-9 w-full" data-service-desc />
          </label>
          <div className="rounded-xl bg-white/[0.03] p-3 text-[12px] text-white/55 leading-relaxed space-y-1">
            <p className="font-bold text-white/70">วิธีใช้</p>
            <p>1. ค่าแรง: เลือกช่าง แล้วกดอัตราค่าแรงของช่าง · ถ้ายังไม่มี พิมพ์ชื่อค่าแรงแล้วกรอกอัตราเอง (ผูกช่างทีหลังได้)</p>
            <p>2. วัสดุ: ค้นหาสินค้าแล้วใส่จำนวนต่อ 1 หน่วยงาน · หรือเพิ่มจากชุดอุปกรณ์ เช่น &quot;ชุดเดินสายแบบตั้ง Outlet&quot; · ไม่มีในระบบให้สร้างเป็นสินค้าแบบร่างได้ทันที</p>
            <p>3. ราคาขาย: แก้เองได้ หรือกดราคามาตรฐาน (กำไร 20%)</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <ServiceRecipeEditor companyId={companyId} draft={draft} onChange={setDraft} canEdit price={price} onPriceChange={setPrice} canCreateProducts={canEdit} />
        </GlassCard>
      </div>
    </div>
  );
}
