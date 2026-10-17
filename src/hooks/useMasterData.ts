import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "./useRealtimeCollection";
import { useRealtimeDocument } from "./useRealtimeDocument";
import { groupIdOf, mergeRecord, type MasterEntity } from "@/lib/master-data";

/**
 * ข้อมูลหลักของบริษัทปัจจุบัน = ข้อมูลกลางของเครือ (groups/{g}/{entity}) รวมกับข้อมูลของบริษัท (companies/{c}/{entity})
 * - ค่าเริ่มต้น: เฉพาะรายการที่บริษัทนี้ใช้อยู่ (มีข้อมูลของบริษัท)
 * - includeGroupOnly: รวมรายการกลางที่บริษัทอื่นในเครือสร้างไว้ แต่บริษัทนี้ยังไม่ได้ใช้ (_inCompany = false)
 * รายการเก่าที่ยังไม่มีข้อมูลกลาง (ก่อนย้ายข้อมูล) แสดงจากข้อมูลของบริษัทตามเดิม
 */
export function useMasterData<T = any>(entity: MasterEntity, opts: { includeGroupOnly?: boolean } = {}) {
  const { companyId } = useAuth();
  const { data: company, loading: companyLoading } = useRealtimeDocument<any>(companyId ? `companies/${companyId}` : null);
  const groupId = companyId && !companyLoading ? groupIdOf(company, companyId) : "";
  const { data: master, loading: masterLoading } = useRealtimeCollection<any>(groupId ? `groups/${groupId}/${entity}` : "", [], false);
  const { data: local, loading: localLoading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/${entity}` : "");

  const data = useMemo(() => {
    const masterById = new Map(master.map((m: any) => [m.id, m]));
    const out: any[] = [];
    const seen = new Set<string>();
    for (const l of local) {
      out.push({ ...mergeRecord(entity, masterById.get(l.id), l), id: l.id, _inCompany: true });
      seen.add(l.id);
    }
    if (opts.includeGroupOnly) {
      for (const m of master) if (!seen.has(m.id)) out.push({ ...mergeRecord(entity, m, null), id: m.id, _inCompany: false });
    }
    return out as (T & { id: string; _inCompany: boolean; _hasMaster: boolean; _localFields: string[] })[];
  }, [entity, master, local, opts.includeGroupOnly]);

  return { data, groupId, loading: companyLoading || masterLoading || localLoading };
}
