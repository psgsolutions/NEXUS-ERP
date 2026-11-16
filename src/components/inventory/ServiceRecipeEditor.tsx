"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { HardHat, Package, Plus, Sparkles, Trash2, Boxes, Loader2 } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { ChoiceInput } from "@/components/ui/ChoiceInput";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { useContractors } from "@/hooks/useCustomers";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { addKitMaterials, isLaborItem, recipeCost, recipeDetails, recipeMargin, suggestServicePrice, SERVICE_MARGIN, type RecipeLabor, type RecipeMaterial, type ServiceRecipe } from "@/lib/service-recipe";

export const SERVICE_UNITS = ["จุด", "งาน", "ระบบ", "ชุด", "ตัว", "เครื่อง", "เมตร", "ครั้ง"];
const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const costOfProduct = (p: any) => Number(p?.pricing?.costWAC ?? p?.costPrice ?? p?.cost ?? 0) || 0;
const laborRateOf = (p: any) => Number(p?.costPrice ?? p?.pricing?.costWAC ?? p?.cost ?? 0) || 0;
const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;

export interface RecipeDraft { unit: string; labors: RecipeLabor[]; materials: RecipeMaterial[] }

/** สูตรที่บันทึกไว้ → ร่างสำหรับแก้ (สูตรเก่าที่มีแต่ค่าแรงรวม → 1 บรรทัด "ค่าแรง") */
export function draftFromRecipe(r: ServiceRecipe | null | undefined, fallbackUnit = "จุด"): RecipeDraft {
  const labors = r?.labors?.length ? r.labors : r?.laborCost ? [{ name: "ค่าแรง", qty: 1, rate: r.laborCost, unit: r.unit || fallbackUnit }] : [];
  return { unit: r?.unit || fallbackUnit, labors: labors.map((l) => ({ ...l })), materials: (r?.materials || []).map((m) => ({ ...m })) };
}
export const recipeFromDraft = (d: RecipeDraft): ServiceRecipe => ({ unit: d.unit, laborCost: d.labors.reduce((t, l) => t + l.qty * l.rate, 0), labors: d.labors, materials: d.materials });

/**
 * ตัวแก้สูตรงานบริการ/งานติดตั้ง (ใช้ทั้งหน้าสร้างงานบริการและการ์ดในหน้าสินค้า)
 *  - ค่าแรง: เลือกช่าง → เลือกอัตราค่าแรงของช่างที่สร้างไว้ หรือพิมพ์ค่าแรงใหม่ (ยังไม่ผูกช่าง)
 *  - วัสดุ: ค้นจากรายการสินค้า · เพิ่มจากชุดอุปกรณ์สำเร็จรูป · ไม่มีในระบบ → สร้างสินค้าใหม่แบบร่าง (ชื่อ + หน่วย)
 *  - ราคาขาย: แก้เองได้ · ปุ่มราคามาตรฐาน = กำไร 20% ของราคาขาย
 */
export function ServiceRecipeEditor({ companyId, draft, onChange, canEdit, excludeId, price, onPriceChange, canCreateProducts }: {
  companyId: string; draft: RecipeDraft; onChange: (d: RecipeDraft) => void; canEdit: boolean; excludeId?: string;
  price: number; onPriceChange?: (n: number) => void; canCreateProducts: boolean;
}) {
  const { showAlert } = useSystemDialog();
  const { data: products = [] } = useProducts<any>();
  const { data: contractors = [] } = useContractors<any>();
  const { data: kits = [] } = useRealtimeCollection<any>("kits");
  const byId = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);
  const [contractorId, setContractorId] = useState("");
  const [lq, setLq] = useState("");
  const [q, setQ] = useState("");
  const [kitId, setKitId] = useState("");
  const [kitSets, setKitSets] = useState("1");
  const [creating, setCreating] = useState(false);
  const set = (patch: Partial<RecipeDraft>) => onChange({ ...draft, ...patch });

  const cost = recipeCost(recipeFromDraft(draft), (id) => costOfProduct(byId.get(id)));
  const margin = recipeMargin(price, cost.total);
  const standard = suggestServicePrice(cost.total);

  // ---- ค่าแรง ----
  const laborItems = useMemo(() => products.filter(isLaborItem), [products]);
  const contractorOptions = useMemo(() => contractors.filter((c: any) => c.isDeleted !== true).map((c: any) => ({ value: c.id, label: c.name || c.id })), [contractors]);
  const laborHits = useMemo(() => {
    const t = lq.trim().toLowerCase();
    if (!t && !contractorId) return [];
    return laborItems.filter((p: any) => (!contractorId || p.subcontractorId === contractorId) && (!t || `${p.sku || ""} ${p.name || ""} ${p.subcontractorName || ""}`.toLowerCase().includes(t))
      && !draft.labors.some((l) => l.productId === p.id)).slice(0, 10);
  }, [lq, contractorId, laborItems, draft.labors]);
  const addLabor = (p: any) => {
    const cname = p.subcontractorName || contractors.find((c: any) => c.id === p.subcontractorId)?.name || "";
    set({ labors: [...draft.labors, { productId: p.id, ...(p.subcontractorId ? { contractorId: p.subcontractorId, contractorName: cname } : {}), name: String(p.name || "").replace(/^\[ค่าแรง\]\s*/, "").replace(/\s*\([^)]*\)\s*$/, "") || p.name, unit: p.unit || draft.unit, qty: 1, rate: laborRateOf(p) }] });
    setLq("");
  };
  const addLaborFree = () => {
    const name = lq.trim() || "ค่าแรง";
    const c = contractors.find((x: any) => x.id === contractorId);
    set({ labors: [...draft.labors, { name, unit: draft.unit, qty: 1, rate: 0, ...(c ? { contractorId: c.id, contractorName: c.name || "" } : {}) }] });
    setLq("");
  };
  const patchLabor = (i: number, p: Partial<RecipeLabor>) => set({ labors: draft.labors.map((l, k) => (k === i ? { ...l, ...p } : l)) });

  // ---- วัสดุ ----
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p: any) => p.id !== excludeId && String(p.itemType || "PRODUCT").toUpperCase() !== "SERVICE" && !draft.materials.some((m) => m.productId === p.id)
      && `${p.sku || ""} ${p.name || ""} ${p.brand || ""} ${p.model || ""}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, products, draft.materials, excludeId]);
  const addMat = (p: any) => { set({ materials: [...draft.materials, { productId: p.id, sku: p.sku || "", name: p.name || p.id, unit: p.unit || "", qty: 1 }] }); setQ(""); };
  const createMat = async () => {
    const name = q.trim();
    if (!name) return;
    setCreating(true);
    try {
      // สินค้าใหม่แบบร่าง: ชื่อ + หน่วย — รายละเอียด ราคา ผู้ขาย เติมทีหลังที่หน้าสินค้า
      const unit = /^(สาย|ท่อ|ราง)|flex|cable/i.test(name) ? "เมตร" : "ชิ้น";
      const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "create", entity: "products", autoSku: true, data: { name, unit, itemType: "PRODUCT", productType: "PHYSICAL", lifecycleStatus: "DRAFT", isActive: true, notes: "สร้างจากสูตรงานบริการ — รอเติมรายละเอียด" } }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "สร้างสินค้าไม่สำเร็จ");
      set({ materials: [...draft.materials, { productId: d.id, sku: d.sku || "", name, unit, qty: 1 }] });
      setQ("");
    } catch (e: any) { showAlert(e.message, "สร้างสินค้าไม่สำเร็จ", "error"); } finally { setCreating(false); }
  };
  const kitOptions = useMemo(() => kits.filter((k: any) => k.isDeleted !== true && k.companyId === companyId).map((k: any) => ({ value: k.id, label: `${k.name} (${(k.components || []).length} รายการ)` })), [kits, companyId]);
  const addKit = () => {
    const k = kits.find((x: any) => x.id === kitId);
    if (!k) return;
    const comps = (k.components || []).filter((c: any) => { const p = byId.get(c.productId); return !p || String(p.itemType || "PRODUCT").toUpperCase() !== "SERVICE"; })
      .map((c: any) => { const p = byId.get(c.productId); return { productId: c.productId, sku: p?.sku || "", name: p?.name || c.name, unit: p?.unit || "", qty: Number(c.qty) || 0 }; });
    set({ materials: addKitMaterials(draft.materials, comps, num(kitSets) || 1) });
    setKitId(""); setKitSets("1");
  };

  const head = (icon: React.ReactNode, text: string, extra?: React.ReactNode) => (
    <div className="flex items-center gap-2 pt-1"><span className="text-nexus-teal">{icon}</span><span className="text-[12px] font-bold text-white/75">{text}</span><span className="flex-1" />{extra}</div>
  );

  return (
    <div className="space-y-3" data-recipe-editor>
      <label className="space-y-1 block max-w-[220px]"><span className="text-[11px] text-white/55">คิดราคาต่อ (หน่วยงาน)</span>
        <ChoiceInput value={draft.unit} onChange={(v) => set({ unit: v })} options={SERVICE_UNITS} disabled={!canEdit} className="w-full" />
      </label>

      {/* ค่าแรง */}
      <div className="space-y-1.5" data-recipe-labor>
        {head(<HardHat size={14} />, `ค่าแรงต่อ 1 ${draft.unit || "หน่วย"}`, <Link href="/procurement/suppliers/new" className="text-[11px] text-nexus-teal hover:underline">+ เพิ่มช่างและอัตราค่าแรง</Link>)}
        {draft.labors.length ? draft.labors.map((l, i) => (
          <div key={i} className="rounded-lg px-2 py-1.5 bg-white/[0.03] space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              {canEdit && !l.productId
                ? <PillInput value={l.name} onChange={(e) => patchLabor(i, { name: e.target.value })} aria-label="ชื่อค่าแรง" className="h-8 flex-1 min-w-0 text-[12px]" />
                : <span className="truncate flex-1 text-[12px] text-white/85" title={l.name}>{l.name}</span>}
              <span className={cn("shrink-0 rounded-full px-2 text-[11px] leading-5", l.contractorId ? "bg-nexus-teal/10 text-nexus-teal" : "bg-warning/10 text-warning")} title={l.contractorId ? "ผูกกับช่างแล้ว" : "ยังไม่ผูกช่าง — สร้างช่างและอัตราค่าแรงได้ที่ \"+ เพิ่มช่างและอัตราค่าแรง\""}>
                {l.contractorId ? l.contractorName || "ช่าง" : "ยังไม่ผูกช่าง"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[11px] text-white/45">อัตรา</span>
              <PillInput inputMode="decimal" value={String(l.rate)} disabled={!canEdit} aria-label={`อัตรา ${l.name}`} onChange={(e) => patchLabor(i, { rate: num(e.target.value) })} className="h-8 w-[84px] text-right font-mono text-[12px]" />
              <span className="text-[11px] text-white/45">×</span>
              <PillInput inputMode="decimal" value={String(l.qty)} disabled={!canEdit} aria-label={`จำนวน ${l.name}`} onChange={(e) => patchLabor(i, { qty: num(e.target.value) })} className="h-8 w-[60px] text-right font-mono text-[12px]" />
              <span className="w-10 text-[11px] text-white/50 truncate">{l.unit || draft.unit}</span>
              <span className="w-[76px] text-right font-mono text-[12px] text-white/70">{money(l.rate * l.qty)}</span>
              {canEdit && <PillButton variant="ghost" className="h-8 w-8 px-0 text-danger/80" aria-label="ลบค่าแรง" onClick={() => set({ labors: draft.labors.filter((_, k) => k !== i) })}><Trash2 size={12} /></PillButton>}
            </div>
          </div>
        )) : <p className="text-[12px] text-white/45 px-1">ยังไม่มีค่าแรง — เลือกช่างหรือค้นหาอัตราค่าแรงด้านล่าง</p>}
        {canEdit && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SmartSelect options={[{ value: "", label: "ช่างทุกคน" }, ...contractorOptions]} value={contractorId} onChange={setContractorId} allowCustom={false} placeholder="เลือกช่าง/ทีมช่าง..." className="h-9" />
              <PillInput value={lq} onChange={(e) => setLq(e.target.value)} placeholder="ค้นหาค่าแรง เช่น เดินสายแลน" className="h-9 w-full text-[12px]" />
            </div>
            {(laborHits.length > 0 || lq.trim() || contractorId) && (
              <div className="rounded-xl border border-white/10 bg-surface-1 max-h-56 overflow-y-auto">
                {laborHits.map((p: any) => (
                  <PillButton key={p.id} variant="ghost" onClick={() => addLabor(p)} className="h-8 w-full justify-start rounded-none px-3 text-[12px] normal-case tracking-normal font-normal">
                    <Plus size={12} className="text-nexus-teal shrink-0" /><span className="truncate flex-1 text-left">{p.name}</span><span className="font-mono text-white/50">{money(laborRateOf(p))}/{p.unit || "หน่วย"}</span>
                  </PillButton>
                ))}
                {contractorId && !laborHits.length && !lq.trim() && <p className="px-3 py-2 text-[12px] text-white/45">ช่างคนนี้ยังไม่มีอัตราค่าแรง — เพิ่มที่ &quot;+ เพิ่มช่างและอัตราค่าแรง&quot; หรือพิมพ์ชื่อค่าแรงเพื่อใส่เอง</p>}
                {lq.trim() && (
                  <PillButton variant="ghost" onClick={addLaborFree} className="h-8 w-full justify-start rounded-none px-3 text-[12px] normal-case tracking-normal font-normal text-warning" data-add-labor-free>
                    <Plus size={12} className="shrink-0" /><span className="truncate text-left">ใส่ค่าแรงใหม่ &quot;{lq.trim()}&quot; (กรอกอัตราเอง ผูกช่างทีหลังได้)</span>
                  </PillButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* วัสดุ */}
      <div className="space-y-1.5" data-recipe-materials>
        {head(<Package size={14} />, `วัสดุต่อ 1 ${draft.unit || "หน่วย"}`)}
        {draft.materials.length ? draft.materials.map((m, i) => {
          const p = byId.get(m.productId);
          const c = costOfProduct(p);
          return (
            <div key={m.productId} className="rounded-lg px-2 py-1.5 bg-white/[0.03] space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate flex-1 text-[12px] text-white/85" title={`${m.sku || ""} ${m.name}`}>{m.name}</span>
                {String(p?.lifecycleStatus || "").toUpperCase() === "DRAFT" && <Link href={`/inventory/${m.productId}?edit=1`} className="shrink-0 rounded-full px-2 text-[11px] leading-5 bg-warning/10 text-warning" title="สินค้าใหม่แบบร่าง — กดเพื่อเติมรายละเอียด/ต้นทุน">รอเติมข้อมูล</Link>}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[11px] text-white/45">ทุน {money(c)} / {m.unit || "หน่วย"}</span>
                <PillInput inputMode="decimal" value={String(m.qty)} disabled={!canEdit} aria-label={`จำนวน ${m.name}`}
                  onChange={(e) => set({ materials: draft.materials.map((y, k) => (k === i ? { ...y, qty: num(e.target.value) } : y)) })} className="h-8 w-[72px] text-right font-mono text-[12px]" />
                <span className="w-10 text-[11px] text-white/50 truncate">{m.unit}</span>
                <span className="w-[76px] text-right font-mono text-[12px] text-white/70">{money(c * m.qty)}</span>
                {canEdit && <PillButton variant="ghost" className="h-8 w-8 px-0 text-danger/80" aria-label="ลบวัสดุ" onClick={() => set({ materials: draft.materials.filter((_, k) => k !== i) })}><Trash2 size={12} /></PillButton>}
              </div>
            </div>
          );
        }) : <p className="text-[12px] text-white/45 px-1">ยังไม่มีวัสดุ — ค้นหาสินค้า หรือเพิ่มจากชุดอุปกรณ์</p>}
        {canEdit && (
          <div className="space-y-1.5">
            <PillInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาวัสดุ เช่น สายแลน หัว RJ45 กล่อง" className="h-9 w-full text-[12px]" />
            {(hits.length > 0 || q.trim()) && (
              <div className="rounded-xl border border-white/10 bg-surface-1 max-h-56 overflow-y-auto">
                {hits.map((p: any) => (
                  <PillButton key={p.id} variant="ghost" onClick={() => addMat(p)} className="h-8 w-full justify-start rounded-none px-3 text-[12px] normal-case tracking-normal font-normal">
                    <Plus size={12} className="text-nexus-teal shrink-0" /><span className="truncate flex-1 text-left">{p.name}</span><span className="font-mono text-white/50">{money(costOfProduct(p))}</span>
                  </PillButton>
                ))}
                {q.trim() && (canCreateProducts ? (
                  <PillButton variant="ghost" disabled={creating} onClick={createMat} className="h-8 w-full justify-start rounded-none px-3 text-[12px] normal-case tracking-normal font-normal text-warning" data-create-material>
                    {creating ? <Loader2 size={12} className="animate-spin shrink-0" /> : <Plus size={12} className="shrink-0" />}<span className="truncate text-left">ไม่มีในระบบ? สร้างสินค้าใหม่ &quot;{q.trim()}&quot; (แบบร่าง เติมรายละเอียดทีหลัง)</span>
                  </PillButton>
                ) : !hits.length && <p className="px-3 py-2 text-[12px] text-white/45">ไม่พบสินค้า — ให้ฝ่ายคลังสร้างสินค้าก่อน</p>)}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Boxes size={14} className="text-white/45 shrink-0" />
              <SmartSelect options={kitOptions} value={kitId} onChange={setKitId} allowCustom={false} placeholder={kitOptions.length ? "เพิ่มจากชุดอุปกรณ์สำเร็จรูป..." : "ยังไม่มีชุดอุปกรณ์ (สร้างที่ คลัง › ชุดอุปกรณ์สำเร็จรูป)"} className="h-9 flex-1 min-w-0" />
              <PillInput inputMode="decimal" value={kitSets} onChange={(e) => setKitSets(e.target.value.replace(/[^\d.]/g, ""))} aria-label="จำนวนชุด" className="h-9 w-[56px] text-right font-mono text-[12px]" />
              <span className="text-[11px] text-white/50">ชุด</span>
              <PillButton variant="glass" className="h-9 px-3 text-xs" disabled={!kitId} onClick={addKit}>เพิ่ม</PillButton>
            </div>
          </div>
        )}
      </div>

      {/* สรุปต้นทุน กำไร ราคา */}
      <div className="rounded-xl border border-white/10 p-2.5 space-y-1 text-[12px]" data-recipe-summary>
        <div className="flex justify-between text-white/70"><span>ค่าวัสดุ</span><span className="font-mono">{money(cost.material)}</span></div>
        <div className="flex justify-between text-white/70"><span>ค่าแรง</span><span className="font-mono">{money(cost.labor)}</span></div>
        <div className="flex justify-between font-bold text-white"><span>ต้นทุนต่อ 1 {draft.unit || "หน่วย"}</span><span className="font-mono">{money(cost.total)}</span></div>
        <div className="flex items-center justify-between gap-2 text-white/80 pt-1">
          <span>ราคาขายต่อ 1 {draft.unit || "หน่วย"} (ก่อน VAT)</span>
          {onPriceChange && canEdit
            ? <PillInput inputMode="decimal" value={price ? String(price) : ""} placeholder="0.00" onChange={(e) => onPriceChange(num(e.target.value))} aria-label="ราคาขาย" className="h-8 w-[110px] text-right font-mono text-[12px]" data-recipe-price />
            : <span className="font-mono">{money(price)}</span>}
        </div>
        {onPriceChange && canEdit && standard > 0 && standard !== price && (
          <div className="flex justify-end">
            <PillButton variant="ghost" className="h-8 px-2 text-[11px] text-nexus-teal normal-case tracking-normal" onClick={() => onPriceChange(standard)} data-standard-price>
              <Sparkles size={11} /> ใช้ราคามาตรฐาน กำไร {SERVICE_MARGIN}% = {money(standard)}
            </PillButton>
          </div>
        )}
        <div className={cn("flex justify-between font-bold", margin === null ? "text-white/50" : margin < 15 ? "text-danger" : "text-success")}>
          <span>กำไรขั้นต้น</span><span>{margin === null ? "ยังไม่ตั้งราคาขาย" : `${margin}% (${money(price - cost.total)} บาท)`}</span>
        </div>
      </div>
      {draft.materials.length > 0 && <p className="text-[11px] text-white/50">ในเอกสารลูกค้าแสดง: {recipeDetails(recipeFromDraft(draft))} · ไม่แสดงค่าแรงและต้นทุน</p>}
    </div>
  );
}
