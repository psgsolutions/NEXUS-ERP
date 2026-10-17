import { adminDb } from "@/lib/firebase-admin";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { listLocations, locationsForCompany, type LocationOption, type WarehouseDoc } from "@/lib/warehouse-location";

/**
 * คลังที่บริษัทใช้ได้ฝั่ง server
 *  - คลังของเครือ: groups/{groupId}/warehouses/{code}       (id = "group:{code}")
 *  - คลังรุ่นเก่า: root warehouses/{companyId}_{code}         (id = เอกสารเดิม)
 * รหัสคลังห้ามซ้ำกันภายในเครือ (เป็นส่วนหนึ่งของรหัสตำแหน่ง/QR)
 */
export type ServerWarehouse = WarehouseDoc & { source: "group" | "legacy"; path: string };

export const GROUP_PREFIX = "group:";

export async function loadWarehouses(companyId: string, groupId?: string): Promise<ServerWarehouse[]> {
  const g = groupId || (await groupIdOfCompany(companyId));
  const [shared, legacy] = await Promise.all([
    adminDb.collection(`groups/${g}/warehouses`).get(),
    adminDb.collection("warehouses").where("companyId", "==", companyId).get(),
  ]);
  const out: ServerWarehouse[] = [];
  const codes = new Set<string>();
  for (const d of shared.docs) {
    if (d.data().isDeleted === true) continue;
    const w = d.data() as any;
    out.push({ ...w, id: GROUP_PREFIX + d.id, code: w.code || d.id, source: "group", path: d.ref.path });
    codes.add(w.code || d.id);
  }
  for (const d of legacy.docs) {
    const w = d.data() as any;
    if (w.isDeleted === true || codes.has(w.code || d.id)) continue;
    out.push({ ...w, id: d.id, source: "legacy", path: d.ref.path });
  }
  return out;
}

/** ตำแหน่งทั้งหมดของคลังที่บริษัทเห็น (รวมช่องของบริษัทอื่นในเครือ ใช้แสดงผัง) และเฉพาะที่ใช้ได้ */
export async function companyLocations(companyId: string, groupId?: string): Promise<{ all: LocationOption[]; mine: LocationOption[]; warehouses: ServerWarehouse[] }> {
  const warehouses = await loadWarehouses(companyId, groupId);
  const all = listLocations(warehouses);
  return { all, mine: locationsForCompany(all, companyId), warehouses };
}

/** เอกสารคลังจาก id ที่หน้าจอส่งมา (ต้องเป็นของบริษัทนี้หรือของเครือเดียวกัน) */
export async function warehouseRef(companyId: string, groupId: string, id: string) {
  if (!id || id.includes("/")) return null;
  if (id.startsWith(GROUP_PREFIX)) return adminDb.doc(`groups/${groupId}/warehouses/${id.slice(GROUP_PREFIX.length)}`);
  const ref = adminDb.doc(`warehouses/${id}`);
  const snap = await ref.get();
  return snap.exists && snap.data()!.companyId === companyId ? ref : null;
}
