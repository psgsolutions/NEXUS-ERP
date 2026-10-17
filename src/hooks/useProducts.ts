import { useMasterRecords } from "./useMasterRecords";

/**
 * สินค้าของบริษัทปัจจุบัน (ใช้แทน useRealtimeCollection("products"))
 * ข้อมูลกลางของเครือ + ราคา/สต็อก/ชื่อเฉพาะของบริษัท หรือ root products ก่อนย้ายข้อมูล
 */
export function useProducts<T = any>(opts: { includeGroupOnly?: boolean } = {}) {
  return useMasterRecords<T>("products", opts);
}
