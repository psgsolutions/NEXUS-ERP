import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "./useRealtimeCollection";
import { useRealtimeDocument } from "./useRealtimeDocument";
import { groupIdOf } from "@/lib/master-data";
import { listLocations, locationsForCompany } from "@/lib/warehouse-location";

/**
 * คลังที่บริษัทใช้ได้ (ใช้แทน useRealtimeCollection("warehouses"))
 * - คลังของเครือ groups/{g}/warehouses (id = "group:{code}") — ช่องแต่ละช่องมีเจ้าของ
 * - คลังรุ่นเก่า root warehouses ของบริษัท
 * locations = ทุกตำแหน่ง (ใช้แสดงผัง), myLocations = ตำแหน่งที่บริษัทนี้รับเข้า/จัดเก็บ/เบิกได้
 */
export function useWarehouses() {
  const { companyId } = useAuth();
  const { data: company, loading: companyLoading } = useRealtimeDocument<any>(companyId ? `companies/${companyId}` : null);
  const groupId = companyId && !companyLoading ? groupIdOf(company, companyId) : "";
  const { data: shared, loading: sharedLoading } = useRealtimeCollection<any>(groupId ? `groups/${groupId}/warehouses` : "", [], false);
  const { data: legacy, loading: legacyLoading } = useRealtimeCollection<any>("warehouses");

  const warehouses = useMemo(() => {
    const out: any[] = [];
    const codes = new Set<string>();
    for (const w of shared) { const code = w.code || w.id; out.push({ ...w, id: `group:${w.id}`, code, source: "group" }); codes.add(code); }
    for (const w of legacy) if (!codes.has(w.code || w.id)) out.push({ ...w, source: "legacy" });
    return out;
  }, [shared, legacy]);
  const locations = useMemo(() => listLocations(warehouses), [warehouses]);
  const myLocations = useMemo(() => locationsForCompany(locations, companyId || ""), [locations, companyId]);

  return { data: warehouses, warehouses, locations, myLocations, groupId, loading: companyLoading || sharedLoading || legacyLoading };
}
