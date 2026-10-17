import { useMemo } from "react";
import { useRealtimeCollection } from "./useRealtimeCollection";
import { useMasterData } from "./useMasterData";

/**
 * สินค้าของบริษัทปัจจุบัน (ใช้แทน useRealtimeCollection("products"))
 * - ย้ายแล้ว: ข้อมูลกลางของเครือ + ราคา/สต็อก/ชื่อเฉพาะของบริษัท
 * - ยังไม่ย้าย: root products (companyId = บริษัทนี้) + ค่าที่บริษัทตั้งทับ
 * ทุกแถวมี id เดิม จึงใช้กับเอกสารและ API เดิมได้
 */
export function useProducts<T = any>(opts: { includeGroupOnly?: boolean } = {}) {
  const { data: modern, loading: modernLoading, groupId } = useMasterData<any>("products", opts);
  const { data: legacy, loading: legacyLoading } = useRealtimeCollection<any>("products");

  const data = useMemo(() => {
    const byId = new Map<string, any>();
    for (const p of legacy) byId.set(p.id, { ...p, _legacy: true, _inCompany: true });
    for (const p of modern) {
      if (p._hasMaster) byId.set(p.id, p);
      else if (byId.has(p.id)) {
        // ค่าที่บริษัทตั้งทับบนสินค้ารุ่นเก่า (เช่น ราคาจากใบเสนอราคา)
        const base = byId.get(p.id);
        const extra = Object.fromEntries(Object.entries(p).filter(([k, v]) => !k.startsWith("_") && v !== "" && v !== null && v !== undefined));
        byId.set(p.id, { ...base, ...extra });
      }
    }
    return Array.from(byId.values()).filter((p) => p.isDeleted !== true) as (T & { id: string; _legacy?: boolean; _inCompany: boolean })[];
  }, [legacy, modern]);

  return { data, loading: modernLoading || legacyLoading, groupId };
}
