"use client";

/**
 * สินค้ากลาง (ราคากลาง BOM ไม่ระบุยี่ห้อ) → รุ่นที่ซื้อจริง
 *  - ใบเสนอราคา/TOR ใช้ชื่อกลาง · ขอซื้อ/ตัดสต็อกจาก BOM ใช้ "รุ่นหลัก" (แปลงหน่วย: 1 หน่วยรุ่นจริง = กี่หน่วยสินค้ากลาง เช่น 1 กล่อง = 305 ม.)
 *  - หน้าสินค้ารุ่นจริงแสดงว่าเป็นรุ่นของสินค้ากลางตัวไหน
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, Plus, Save, Trash2 } from "lucide-react";
import { GlassCard, PillButton, PillInput } from "@/components/ui/Base";
import { NumCell } from "@/components/projects/ProjectPlanEditors";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { normalizeRealModels, type RealModel } from "@/lib/bom-quote";

const isService = (p: any) => ["SERVICE", "LABOR"].includes(String(p?.itemType || "").toUpperCase());

export function RealModelsCard({ product }: { product: any }) {
  const { companyId, roles } = useAuth();
  const { showAlert } = useSystemDialog();
  const { data: products = [] } = useProducts<any>();
  const canEdit = can(roles, "inventory:edit");
  const saved = useMemo(() => normalizeRealModels(product?.realModels, product?.id), [product?.realModels, product?.id]);
  const [list, setList] = useState<RealModel[]>(saved);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setList(saved); }, [saved]);
  const byId = useMemo(() => new Map<string, any>(products.map((p: any) => [p.id, p])), [products]);
  const parents = useMemo(() => products.filter((p: any) => p.id !== product?.id && p.isDeleted !== true && normalizeRealModels(p.realModels, p.id).some((m) => m.productId === product?.id)), [products, product?.id]);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return products.filter((p: any) => p.id !== product?.id && p.isDeleted !== true && !isService(p) && !list.some((m) => m.productId === p.id)
      && `${p.sku || ""} ${p.name || ""}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, products, product?.id, list]);

  const generic = !!product?.bomCode || saved.length > 0;
  if (!product || isService(product) || (!generic && !parents.length)) return null;
  const dirty = JSON.stringify(normalizeRealModels(list, product.id)) !== JSON.stringify(saved);

  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "products", id: product.id, changes: { realModels: normalizeRealModels(list, product.id) } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      await showAlert("บันทึกรุ่นที่ซื้อจริงแล้ว");
    } catch (e: any) { await showAlert(e.message || "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  };

  return (
    <div data-real-models>
    <GlassCard className="p-4 border-white/5 bg-black/15 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/5 pb-3">
        <h3 className="text-[12px] font-medium text-nexus-teal tracking-widest flex items-center gap-2"><Link2 size={14} /> รุ่นที่ซื้อจริง</h3>
        {canEdit && generic && <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" disabled={!dirty || busy} onClick={save} data-save-real-models><Save size={13} /> บันทึก</PillButton>}
      </div>

      {parents.length > 0 && (
        <p className="text-[12px] text-white/70">เป็นรุ่นจริงของสินค้ากลาง: {parents.map((p: any, i: number) => (
          <React.Fragment key={p.id}>{i > 0 && ", "}<Link href={`/inventory/${encodeURIComponent(p.id)}`} className="text-nexus-teal hover:underline">{p.name}</Link></React.Fragment>
        ))}</p>
      )}

      {generic && (
        <>
          <p className="text-[12px] text-white/50">ใบเสนอราคาและ TOR ใช้ชื่อสินค้านี้ (ไม่ระบุยี่ห้อ) · ขอซื้อจาก BOM ใช้รุ่นหลัก · หน่วย {product.unit || "-"}</p>
          {list.length === 0 && <p className="text-[12px] text-warning">ยังไม่ผูกรุ่นจริง — ขอซื้อจาก BOM จะใช้สินค้ากลางนี้ไปก่อน</p>}
          <div className="space-y-2">
            {list.map((m, i) => {
              const p = byId.get(m.productId);
              return (
                <div key={m.productId} className="flex items-center gap-3 flex-wrap text-[12px]" data-real-model-row>
                  <label className="flex items-center gap-1.5 cursor-pointer text-white/70">
                    <input type="radio" name={`primary-${product.id}`} checked={!!m.primary} disabled={!canEdit} onChange={() => setList(list.map((x, j) => ({ ...x, primary: j === i })))} className="accent-[var(--nexus-teal,#2dd4bf)]" />
                    รุ่นหลัก
                  </label>
                  <span className="min-w-0 flex-1 text-white truncate" title={p?.name || m.productId}>{p ? <><span className="font-mono text-white/50 mr-1.5">{p.sku}</span>{p.name}</> : <span className="text-danger">ไม่พบสินค้า {m.productId}</span>}</span>
                  <span className="flex items-center gap-1.5 text-white/60">1 {p?.unit || "หน่วย"} =
                    <span className="w-[90px]"><NumCell kind="pct" value={m.per || 1} disabled={!canEdit} onChange={(v) => setList(list.map((x, j) => (j === i ? { ...x, per: v > 0 ? v : 1 } : x)))} /></span>
                    {product.unit || "หน่วย"}
                  </span>
                  {canEdit && <PillButton type="button" variant="glass" className="h-8 w-8 p-0 text-danger/80" title="เอาออก" aria-label="เอาออก" onClick={() => setList(normalizeRealModels(list.filter((_, j) => j !== i), product.id))}><Trash2 size={14} /></PillButton>}
                </div>
              );
            })}
          </div>
          {canEdit && (
            <div className="space-y-1.5">
              <PillInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารุ่นจริง (รหัส/ชื่อ อย่างน้อย 2 ตัวอักษร)" className="h-9 w-full text-sm" data-real-model-search />
              {hits.map((p: any) => (
                <PillButton key={p.id} type="button" variant="glass" className="w-full h-8 justify-start gap-2 text-left text-[12px] px-3 text-white/80" data-real-model-hit
                  onClick={() => { setList(normalizeRealModels([...list, { productId: p.id, primary: !list.length }], product.id)); setQ(""); }}>
                  <Plus size={12} className="text-nexus-teal shrink-0" /><span className="font-mono text-white/50">{p.sku}</span><span className="truncate">{p.name}</span><span className="ml-auto text-white/40 shrink-0">{p.unit}</span>
                </PillButton>
              ))}
            </div>
          )}
        </>
      )}
    </GlassCard>
    </div>
  );
}
