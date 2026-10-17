import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { mergeRecord, type MasterEntity } from "@/lib/master-data";
import { groupIdOfCompany } from "@/lib/company-group.server";

/**
 * อ่านข้อมูลหลัก (สินค้า ลูกค้า ผู้ขาย ผู้รับเหมา) ของบริษัทฝั่ง server — รองรับช่วงเปลี่ยนผ่าน
 *  - ย้ายแล้ว (มีข้อมูลกลาง groups/{g}/{entity}/{id}): ข้อมูล = กลาง + ของบริษัท, เอกสารของบริษัทคือที่เก็บสต็อก/ยอด
 *  - ยังไม่ย้าย: ข้อมูลจากที่เดิม
 *      สินค้า/ผู้ขาย/ผู้รับเหมา: root {entity}/{id} (companyId ต้องตรง) + ค่าที่บริษัทตั้งทับ
 *      ลูกค้า: companies/{c}/customers/{id} อยู่แล้ว
 * ref ที่คืนให้ = เอกสารที่ต้องอัปเดตข้อมูลของบริษัท (เช่น สต็อก)
 */
export interface RecordHandle {
  id: string;
  data: Record<string, any>;
  ref: admin.firestore.DocumentReference;
  migrated: boolean;
}

/** collection รุ่นเก่าที่ root (ลูกค้าไม่มี — อยู่ใต้บริษัทอยู่แล้ว) */
export const LEGACY_ROOT: Partial<Record<MasterEntity, string>> = { products: "products", suppliers: "suppliers", contractors: "contractors" };

export const recordRefs = (entity: MasterEntity, companyId: string, groupId: string, id: string) => ({
  master: adminDb.doc(`groups/${groupId}/${entity}/${id}`),
  local: adminDb.doc(`companies/${companyId}/${entity}/${id}`),
  legacy: LEGACY_ROOT[entity] ? adminDb.doc(`${LEGACY_ROOT[entity]}/${id}`) : null,
});

const nonEmpty = (o: Record<string, any> | undefined) =>
  Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

function resolve(entity: MasterEntity, companyId: string, id: string, refs: ReturnType<typeof recordRefs>,
  master: admin.firestore.DocumentSnapshot, local: admin.firestore.DocumentSnapshot, legacy: admin.firestore.DocumentSnapshot | null): RecordHandle | null {
  if (master.exists) {
    // รายการกลางของเครือที่บริษัทนี้ยังไม่ได้ใช้ = ไม่พบในบริษัทนี้
    if (!local.exists || local.data()!.isDeleted === true) return null;
    return { id, data: { ...mergeRecord(entity, master.data(), local.data()), id, companyId }, ref: refs.local, migrated: true };
  }
  if (legacy?.exists && legacy.data()!.companyId === companyId) {
    return { id, data: { ...legacy.data(), ...nonEmpty(local.data()), id, companyId }, ref: refs.legacy!, migrated: false };
  }
  if (!LEGACY_ROOT[entity] && local.exists) return { id, data: { ...local.data(), id, companyId }, ref: refs.local, migrated: false };
  return null;
}

const snaps = (refs: ReturnType<typeof recordRefs>) => [refs.master, refs.local, ...(refs.legacy ? [refs.legacy] : [])];

/** อ่านในทรานแซกชัน (เรียกก่อนการเขียนทั้งหมด) */
export async function getRecordTx(tx: admin.firestore.Transaction, entity: MasterEntity, companyId: string, groupId: string, id: string): Promise<RecordHandle | null> {
  const refs = recordRefs(entity, companyId, groupId, id);
  const [master, local, legacy] = await tx.getAll(...snaps(refs));
  return resolve(entity, companyId, id, refs, master, local, legacy || null);
}

export async function getRecord(entity: MasterEntity, companyId: string, id: string, groupId?: string): Promise<RecordHandle | null> {
  if (!id || id.includes("/")) return null;
  const g = groupId || (await groupIdOfCompany(companyId));
  const refs = recordRefs(entity, companyId, g, id);
  const [master, local, legacy] = await adminDb.getAll(...snaps(refs));
  return resolve(entity, companyId, id, refs, master, local, legacy || null);
}

/** อ่านหลายรายการพร้อมกัน คืน Map id -> ข้อมูล (ไม่พบ = ไม่มีใน Map) */
export async function getRecords(entity: MasterEntity, companyId: string, ids: string[], groupId?: string): Promise<Map<string, Record<string, any>>> {
  const g = groupId || (await groupIdOfCompany(companyId));
  const uniq = Array.from(new Set(ids.filter((x) => x && !x.includes("/"))));
  const out = new Map<string, Record<string, any>>();
  await Promise.all(uniq.map(async (id) => { const r = await getRecord(entity, companyId, id, g); if (r) out.set(id, r.data); }));
  return out;
}

/** ทั้งหมดของบริษัท (ที่ย้ายแล้ว + ที่ยังอยู่ที่เดิม) ไม่รวมที่ถูกลบ */
export async function listRecords(entity: MasterEntity, companyId: string, groupId?: string): Promise<Record<string, any>[]> {
  const g = groupId || (await groupIdOfCompany(companyId));
  const root = LEGACY_ROOT[entity];
  const [masters, locals, legacy] = await Promise.all([
    adminDb.collection(`groups/${g}/${entity}`).get(),
    adminDb.collection(`companies/${companyId}/${entity}`).get(),
    root ? adminDb.collection(root).where("companyId", "==", companyId).get() : Promise.resolve(null),
  ]);
  const masterById = new Map(masters.docs.map((d) => [d.id, d.data()]));
  const localById = new Map(locals.docs.map((d) => [d.id, d.data()]));
  const out = new Map<string, Record<string, any>>();
  for (const d of legacy?.docs || []) if (!masterById.has(d.id)) out.set(d.id, { ...d.data(), ...nonEmpty(localById.get(d.id)), id: d.id });
  for (const [id, l] of Array.from(localById.entries())) {
    const m = masterById.get(id);
    if (m) out.set(id, { ...mergeRecord(entity, m, l), id, companyId });
    else if (!root) out.set(id, { ...l, id });
  }
  return Array.from(out.values()).filter((p) => p.isDeleted !== true);
}
