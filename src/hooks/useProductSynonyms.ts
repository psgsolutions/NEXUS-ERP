"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { normalizeSynonyms } from "@/lib/product-match";

/** คำพ้องสินค้าของบริษัท (ตรวจสินค้าซ้ำ) — โหลดครั้งเดียวต่อบริษัท · บันทึกแล้วทุกหน้าที่ใช้เห็นทันที */
const cache = new Map<string, string[][]>();
const listeners = new Set<() => void>();

export function useProductSynonyms() {
  const { companyId } = useAuth();
  const [synonyms, setSynonyms] = useState<string[][]>(() => (companyId && cache.get(companyId)) || []);
  const [loaded, setLoaded] = useState(() => !!(companyId && cache.has(companyId)));
  useEffect(() => {
    if (!companyId) return;
    const sync = () => { if (cache.has(companyId)) { setSynonyms(cache.get(companyId)!); setLoaded(true); } };
    listeners.add(sync);
    if (cache.has(companyId)) sync();
    else {
      apiFetch("/api/inventory/product-match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get" }) })
        .then((r) => r.json()).then((d) => { cache.set(companyId, d?.success ? normalizeSynonyms(d.synonyms) : []); listeners.forEach((f) => f()); })
        .catch(() => { cache.set(companyId, []); listeners.forEach((f) => f()); });
    }
    return () => { listeners.delete(sync); };
  }, [companyId]);
  const save = useCallback(async (next: string[][]) => {
    if (!companyId) return;
    const r = await apiFetch("/api/inventory/product-match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "save", synonyms: next }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) throw new Error(d.error || "บันทึกคำพ้องไม่สำเร็จ");
    cache.set(companyId, normalizeSynonyms(d.synonyms));
    listeners.forEach((f) => f());
  }, [companyId]);
  return { synonyms, loaded, save };
}
