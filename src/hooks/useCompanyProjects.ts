"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

/**
 * โครงการของบริษัท: companies/{companyId}/projects (ที่เก็บหลัก)
 * รวมโครงการรุ่นเก่าที่อยู่ใน projects (root) เฉพาะที่ยังไม่มีในที่เก็บหลัก — ไม่นับซ้ำ
 */
export function useCompanyProjects() {
  const { companyId } = useAuth();
  const { data: own, loading } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/projects` : "");
  const { data: legacy } = useRealtimeCollection<any>("projects");

  const data = useMemo(() => {
    const ids = new Set(own.map((p: any) => p.id));
    return [...own, ...legacy.filter((p: any) => !ids.has(p.id))];
  }, [own, legacy]);

  return { data, loading };
}
