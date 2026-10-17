import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { mergeRecord } from "@/lib/master-data";
import { groupIdOfCompany } from "@/lib/company-group.server";

/**
 * อ่านสินค้าของบริษัทฝั่ง server — รองรับช่วงเปลี่ยนผ่าน
 *  - ย้ายแล้ว (มีข้อมูลกลาง groups/{g}/products/{id}): ข้อมูล = กลาง + ของบริษัท, สต็อก/ต้นทุนเขียนที่ companies/{c}/products/{id}
 *  - ยังไม่ย้าย: ข้อมูล = root products/{id} (ต้องเป็นของบริษัทนี้) + ค่าที่บริษัทตั้งทับ, สต็อกเขียนที่ root ตามเดิม
 * ref ที่คืนให้คือเอกสารที่ต้องอัปเดตสต็อก (stockStatus, pricing.costWAC)
 */
export interface ProductHandle {
  id: string;
  data: Record<string, any>;
  ref: admin.firestore.DocumentReference;
  migrated: boolean;
}

export const productRefs = (companyId: string, groupId: string, id: string) => ({
  master: adminDb.doc(`groups/${groupId}/products/${id}`),
  local: adminDb.doc(`companies/${companyId}/products/${id}`),
  legacy: adminDb.doc(`products/${id}`),
});

const nonEmpty = (o: Record<string, any> | undefined) =>
  Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

function resolve(companyId: string, id: string, refs: ReturnType<typeof productRefs>, master: admin.firestore.DocumentSnapshot, local: admin.firestore.DocumentSnapshot, legacy: admin.firestore.DocumentSnapshot): ProductHandle | null {
  if (master.exists) {
    // สินค้ากลางของเครือที่บริษัทนี้ยังไม่ได้ใช้ = ไม่พบในบริษัทนี้
    if (!local.exists || local.data()!.isDeleted === true) return null;
    return { id, data: { ...mergeRecord("products", master.data(), local.data()), id, companyId }, ref: refs.local, migrated: true };
  }
  if (!legacy.exists || legacy.data()!.companyId !== companyId) return null;
  return { id, data: { ...legacy.data(), ...nonEmpty(local.data()), id, companyId }, ref: refs.legacy, migrated: false };
}

/** อ่านในทรานแซกชัน (ต้องเรียกก่อนการเขียนทั้งหมด) */
export async function getProductTx(tx: admin.firestore.Transaction, companyId: string, groupId: string, id: string): Promise<ProductHandle | null> {
  const refs = productRefs(companyId, groupId, id);
  const [master, local, legacy] = await tx.getAll(refs.master, refs.local, refs.legacy);
  return resolve(companyId, id, refs, master, local, legacy);
}

export async function getProduct(companyId: string, id: string, groupId?: string): Promise<ProductHandle | null> {
  const g = groupId || (await groupIdOfCompany(companyId));
  const refs = productRefs(companyId, g, id);
  const [master, local, legacy] = await adminDb.getAll(refs.master, refs.local, refs.legacy);
  return resolve(companyId, id, refs, master, local, legacy);
}

/** สินค้าทั้งหมดของบริษัท (ที่ย้ายแล้ว + ที่ยังอยู่ root) ไม่รวมที่ถูกลบ */
export async function listProducts(companyId: string, groupId?: string): Promise<Record<string, any>[]> {
  const g = groupId || (await groupIdOfCompany(companyId));
  const [masters, locals, legacy] = await Promise.all([
    adminDb.collection(`groups/${g}/products`).get(),
    adminDb.collection(`companies/${companyId}/products`).get(),
    adminDb.collection("products").where("companyId", "==", companyId).get(),
  ]);
  const masterById = new Map(masters.docs.map((d) => [d.id, d.data()]));
  const localById = new Map(locals.docs.map((d) => [d.id, d.data()]));
  const out = new Map<string, Record<string, any>>();
  for (const d of legacy.docs) if (!masterById.has(d.id)) out.set(d.id, { ...d.data(), ...nonEmpty(localById.get(d.id)), id: d.id });
  for (const [id, l] of Array.from(localById.entries())) {
    const m = masterById.get(id);
    if (m) out.set(id, { ...mergeRecord("products", m, l), id, companyId });
  }
  return Array.from(out.values()).filter((p) => p.isDeleted !== true);
}
