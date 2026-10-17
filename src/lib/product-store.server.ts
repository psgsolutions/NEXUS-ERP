import * as admin from "firebase-admin";
import { getRecord, getRecordTx, listRecords, recordRefs, type RecordHandle } from "@/lib/master-store.server";

/**
 * สินค้าของบริษัทฝั่ง server (ตัวช่วยเฉพาะสินค้าของ master-store.server)
 * ref ที่คืนให้คือเอกสารที่ต้องอัปเดตสต็อก (stockStatus, pricing.costWAC):
 * ย้ายแล้ว = companies/{c}/products/{id}, ยังไม่ย้าย = root products/{id}
 */
export type ProductHandle = RecordHandle;

export const productRefs = (companyId: string, groupId: string, id: string) => recordRefs("products", companyId, groupId, id);

export const getProductTx = (tx: admin.firestore.Transaction, companyId: string, groupId: string, id: string) =>
  getRecordTx(tx, "products", companyId, groupId, id);

export const getProduct = (companyId: string, id: string, groupId?: string) => getRecord("products", companyId, id, groupId);

export const listProducts = (companyId: string, groupId?: string) => listRecords("products", companyId, groupId);
