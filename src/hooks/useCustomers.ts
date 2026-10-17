import { useMasterRecords } from "./useMasterRecords";

/**
 * ทะเบียนลูกค้าของบริษัทปัจจุบัน — ข้อมูลกลางของเครือ + ของบริษัท (companies/{companyId}/customers)
 * เอกสารขายทั้งหมดอ้างอิง id เดียวกัน; root `customers` เป็นสำเนารุ่นเก่า ไม่ใช้แล้ว
 */
export function useCustomers<T = any>(opts: { includeGroupOnly?: boolean } = {}) {
  return useMasterRecords<T>("customers", opts);
}

/** ผู้ขายของบริษัทปัจจุบัน (ใช้แทน useRealtimeCollection("suppliers")) */
export function useSuppliers<T = any>(opts: { includeGroupOnly?: boolean } = {}) {
  return useMasterRecords<T>("suppliers", opts);
}

/** ผู้รับเหมา/ช่างของบริษัทปัจจุบัน (ใช้แทน useRealtimeCollection("contractors")) */
export function useContractors<T = any>(opts: { includeGroupOnly?: boolean } = {}) {
  return useMasterRecords<T>("contractors", opts);
}
