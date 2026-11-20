"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_BOM_SETTINGS, normalizeBomSettings, type BomSettings, type CodeResolver } from "@/lib/bom";
import { bomUnitCost } from "@/lib/ref-prices";

/** ตั้งค่า BOM ของบริษัท (โหลดครั้งเดียวต่อบริษัท) + ตัวแปลงรหัสราคากลาง → สินค้า (bomCode) พร้อมต้นทุน */
const cache = new Map<string, BomSettings>();

export function useBom() {
  const { companyId } = useAuth();
  const { data: products = [] } = useProducts<any>();
  const [settings, setSettings] = useState<BomSettings>(() => (companyId && cache.get(companyId)) || DEFAULT_BOM_SETTINGS);
  const reload = useCallback(async () => {
    if (!companyId) return;
    const r = await apiFetch("/api/inventory/ref-prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "settings" }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (d?.success) { const s = normalizeBomSettings(d.settings); cache.set(companyId, s); setSettings(s); }
  }, [companyId]);
  useEffect(() => { if (companyId && !cache.has(companyId)) reload(); else if (companyId) setSettings(cache.get(companyId)!); }, [companyId, reload]);
  const byCode = useMemo(() => new Map(products.filter((p: any) => p.bomCode && p.isDeleted !== true).map((p: any) => [String(p.bomCode), p])), [products]);
  const resolve: CodeResolver = useCallback((code: string) => {
    const p = byCode.get(code);
    if (!p) return null;
    const c = bomUnitCost(p);
    return { productId: p.id, sku: p.sku, name: p.name, unit: p.unit, cost: c.cost, status: p.refCostStatus || "" };
  }, [byCode]);
  const setLocal = (s: BomSettings) => { if (companyId) cache.set(companyId, s); setSettings(s); };
  return { settings, resolve, byCode, reload, setLocal };
}
