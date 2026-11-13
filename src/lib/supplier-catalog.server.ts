import { adminDb } from "@/lib/firebase-admin";
import type { CatalogItem, CatalogMeta } from "@/lib/supplier-catalog";

/**
 * ที่เก็บแคตตาล็อก: supplier_catalogs/{groupId}__{key} (meta) + parts/{0..n} ({ items: CatalogItem[] } ไม่เกิน ~2,000 รายการต่อเอกสาร)
 * อยู่ที่ root ซึ่ง rules ไม่เปิดให้ client อ่าน (มีทุนของผู้ขาย) — อ่านผ่าน /api/catalog เท่านั้น
 * แคชในหน่วยความจำของ server: ตรวจ version ทุก 10 นาที (อ่าน 1 ครั้ง) โหลดใหม่ทั้งชุดเมื่อ version เปลี่ยน
 */
const TTL = 10 * 60_000;
const cache = new Map<string, { meta: CatalogMeta; items: CatalogItem[]; checkedAt: number }>();
export const catalogRef = (groupId: string, key: string) => adminDb.doc(`supplier_catalogs/${groupId}__${key}`);

export async function listCatalogs(groupId: string): Promise<CatalogMeta[]> {
  const snap = await adminDb.collection("supplier_catalogs").where("groupId", "==", groupId).get();
  return snap.docs.map((d) => d.data() as any).filter((m) => m.isActive !== false).map((m) => ({ key: m.key, name: m.name, supplierId: m.supplierId, count: m.count, parts: m.parts, version: m.version }));
}

export async function loadCatalog(groupId: string, key: string): Promise<{ meta: CatalogMeta; items: CatalogItem[] } | null> {
  const id = `${groupId}__${key}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.checkedAt < TTL) return hit;
  const metaSnap = await catalogRef(groupId, key).get();
  if (!metaSnap.exists || metaSnap.get("isActive") === false) { cache.delete(id); return null; }
  const m = metaSnap.data() as any;
  const meta: CatalogMeta = { key: m.key, name: m.name, supplierId: m.supplierId, count: m.count, parts: m.parts, version: m.version };
  if (hit && hit.meta.version === meta.version) { hit.checkedAt = Date.now(); hit.meta = meta; return hit; }
  const parts = await Promise.all(Array.from({ length: meta.parts }, (_, i) => catalogRef(groupId, key).collection("parts").doc(String(i)).get()));
  const items = parts.flatMap((p) => (p.get("items") as CatalogItem[]) || []);
  const entry = { meta, items, checkedAt: Date.now() };
  cache.set(id, entry);
  return entry;
}
