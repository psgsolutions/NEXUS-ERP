import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "./useRealtimeCollection";

/**
 * ทะเบียนลูกค้าของบริษัทปัจจุบัน — ที่เก็บหลักคือ companies/{companyId}/customers
 * (เอกสารขายทั้งหมดอ้างอิง id จากที่นี่; root `customers` เป็นสำเนารุ่นเก่า ไม่ใช้แล้ว)
 */
export function useCustomers<T = any>() {
  const { companyId } = useAuth();
  return useRealtimeCollection<T>(companyId ? `companies/${companyId}/customers` : "");
}
