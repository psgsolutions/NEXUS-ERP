import { useMemo } from "react";
import { useRealtimeCollection } from "./useRealtimeCollection";
import { useMasterData } from "./useMasterData";
import { deepMerge, type MasterEntity } from "@/lib/master-data";

/** collection รุ่นเก่าที่ root (ลูกค้าอยู่ใต้บริษัทอยู่แล้ว) — ตรงกับ LEGACY_ROOT ใน master-store.server */
const LEGACY_ROOT: Partial<Record<MasterEntity, string>> = { products: "products", suppliers: "suppliers", contractors: "contractors" };

/**
 * ข้อมูลหลักของบริษัทปัจจุบันแบบเรียลไทม์ ใช้ได้ทั้งก่อนและหลังย้ายข้อมูล
 * - ย้ายแล้ว: ข้อมูลกลางของเครือ + ค่าของบริษัท
 * - ยังไม่ย้าย: root {entity} (companyId = บริษัทนี้) หรือ companies/{c}/customers + ค่าที่บริษัทตั้งทับ
 * ทุกแถวคง id เดิม จึงใช้กับเอกสารและ API เดิมได้
 */
export function useMasterRecords<T = any>(entity: MasterEntity, opts: { includeGroupOnly?: boolean } = {}) {
  const { data: modern, loading: modernLoading, groupId } = useMasterData<any>(entity, opts);
  const root = LEGACY_ROOT[entity] || "";
  const { data: legacy, loading: legacyLoading } = useRealtimeCollection<any>(root);

  const data = useMemo(() => {
    const byId = new Map<string, any>();
    for (const r of legacy) byId.set(r.id, { ...r, _legacy: true, _inCompany: true });
    for (const r of modern) {
      if (r._hasMaster || !root) byId.set(r.id, { ...r, ...(r._hasMaster ? {} : { _legacy: true }) });
      else if (byId.has(r.id)) {
        // ค่าที่บริษัทตั้งทับบนรายการรุ่นเก่า (เช่น ราคาจากใบเสนอราคา)
        const extra = Object.fromEntries(Object.entries(r).filter(([k, v]) => !k.startsWith("_") && v !== "" && v !== null && v !== undefined));
        byId.set(r.id, deepMerge(byId.get(r.id), extra));
      }
    }
    return Array.from(byId.values()).filter((r) => r.isDeleted !== true) as (T & { id: string; _legacy?: boolean; _inCompany: boolean })[];
  }, [legacy, modern, root]);

  return { data, loading: modernLoading || (!!root && legacyLoading), groupId };
}
