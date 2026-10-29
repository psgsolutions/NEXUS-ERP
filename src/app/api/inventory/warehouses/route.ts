import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { companiesInGroup, groupIdOfCompany } from "@/lib/company-group.server";
import { GROUP_PREFIX, loadWarehouses, warehouseRef } from "@/lib/warehouse.server";
import { isValidPartCode, listLocations, MAX_BINS, MAX_LEVELS, type WarehouseDoc, type ZoneDef } from "@/lib/warehouse-location";

/**
 * [API-SERVER] คลังสินค้าและผังชั้นวาง
 * Endpoint: POST /api/inventory/warehouses
 *  - { companyId, action: "list" }                                  -> คลัง + ตำแหน่ง (พร้อมเจ้าของช่อง) + ยอดคงเหลือตามตำแหน่งของบริษัท + บริษัทในเครือ
 *  - { companyId, action: "create", code, name }                    -> เพิ่มคลังของเครือ groups/{g}/warehouses/{code} (เจ้าของเริ่มต้น = บริษัทที่สร้าง)
 *  - { companyId, action: "saveLayout", warehouseId, name?, zones } -> บันทึกผัง โซน › ชั้นวาง (ชั้น × ช่อง) และเจ้าของช่อง
 *  - { companyId, action: "save3d", docId, code, name, gridCols, gridRows, racks } -> ผังคลังแบบ 3 มิติรุ่นเดิม (root warehouses ของบริษัทนี้เท่านั้น)
 * - คลังของเครือใช้ร่วมกันได้ แต่ละช่องมีเจ้าของได้บริษัทเดียว (zone.owner / rack.owner / rack.binOwners)
 * - บันทึกผังไม่ได้ถ้าตำแหน่งที่ถูกลบ หรือช่องที่เปลี่ยนเจ้าของ ยังมีสินค้าคงเหลืออยู่ (ของบริษัทใดก็ตามในเครือ)
 * - คลังรุ่นเก่า root warehouses/{companyId}_{code} ยังใช้ได้จนกว่าจะย้ายข้อมูล
 */

const str = (v: any, max = 80) => String(v ?? "").trim().slice(0, max);
const up = (v: any) => str(v, 12).toUpperCase().replace(/\s+/g, "");
const BIN_KEY = /^L\d{1,2}(-B\d{2})?$/;

function cleanZones(raw: any, members: Set<string>): ZoneDef[] {
  const owner = (v: any) => {
    const o = str(v, 80);
    if (o && !members.has(o)) throw new ApiAuthError(400, `บริษัท ${o} ไม่ได้อยู่ในเครือเดียวกัน`);
    return o;
  };
  const zones: ZoneDef[] = (Array.isArray(raw) ? raw : []).slice(0, 50).map((z: any) => ({
    code: up(z?.code), name: str(z?.name, 60), color: /^#[0-9a-fA-F]{6}$/.test(String(z?.color || "")) ? String(z.color) : "",
    ...(owner(z?.owner) ? { owner: owner(z?.owner) } : {}),
    racks: (Array.isArray(z?.racks) ? z.racks : []).slice(0, 200).map((r: any) => {
      const binOwners = Object.fromEntries(Object.entries(r?.binOwners && typeof r.binOwners === "object" ? r.binOwners : {})
        .filter(([k, v]) => BIN_KEY.test(k) && str(v)).slice(0, 2000).map(([k, v]) => [k, owner(v)]));
      return {
        code: up(r?.code), name: str(r?.name, 60), note: str(r?.note, 120),
        levels: Math.min(MAX_LEVELS, Math.max(1, Math.round(Number(r?.levels) || 1))),
        bins: Math.min(MAX_BINS, Math.max(1, Math.round(Number(r?.bins) || 1))),
        ...(owner(r?.owner) ? { owner: owner(r?.owner) } : {}),
        ...(Object.keys(binOwners).length ? { binOwners } : {}),
      };
    }),
  }));
  const zoneCodes = new Set<string>();
  for (const z of zones) {
    if (!isValidPartCode(z.code)) throw new ApiAuthError(400, `รหัสโซน "${z.code || "(ว่าง)"}" ไม่ถูกต้อง (ตัวอักษรอังกฤษ/ตัวเลข 1-6 ตัว)`);
    if (z.code === "RECV") throw new ApiAuthError(400, "RECV สงวนไว้สำหรับพื้นที่รับสินค้า");
    if (zoneCodes.has(z.code)) throw new ApiAuthError(400, `รหัสโซน ${z.code} ซ้ำ`);
    zoneCodes.add(z.code);
    const rackCodes = new Set<string>();
    for (const r of z.racks) {
      if (!isValidPartCode(r.code)) throw new ApiAuthError(400, `รหัสชั้นวาง "${r.code || "(ว่าง)"}" ในโซน ${z.code} ไม่ถูกต้อง`);
      if (rackCodes.has(r.code)) throw new ApiAuthError(400, `รหัสชั้นวาง ${r.code} ในโซน ${z.code} ซ้ำ`);
      rackCodes.add(r.code);
    }
  }
  return zones;
}

/** ยอดคงเหลือ > 0 ตามตำแหน่ง ของทุกบริษัทในเครือ: location -> Set(companyId) */
async function stockedLocations(companyIds: string[]) {
  const out = new Map<string, Set<string>>();
  const snaps = await Promise.all(companyIds.map((c) => adminDb.collection(`companies/${c}/inventory_balance`).get().then((s) => [c, s] as const)));
  for (const [c, s] of snaps) {
    for (const d of s.docs) {
      const b = d.data() as any;
      if (!b.location || (Number(b.quantity) || 0) <= 0) continue;
      if (!out.has(b.location)) out.set(b.location, new Set());
      out.get(b.location)!.add(c);
    }
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const groupId = await groupIdOfCompany(companyId);

    if (action === "list") {
      if (!can(apiUser.roles, "inventory:view")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const [warehouses, bals, memberIds] = await Promise.all([
        loadWarehouses(companyId, groupId),
        adminDb.collection(`companies/${companyId}/inventory_balance`).get(),
        companiesInGroup(groupId),
      ]);
      const stock: Record<string, { qty: number; items: number }> = {};
      bals.docs.forEach((d) => {
        const b = d.data() as any;
        const qty = Number(b.quantity) || 0;
        if (!b.location || qty <= 0) return;
        const s = (stock[b.location] ||= { qty: 0, items: 0 });
        s.qty += qty; s.items += 1;
      });
      const companySnaps = memberIds.length ? await adminDb.getAll(...memberIds.map((id) => adminDb.doc(`companies/${id}`))) : [];
      const companies = companySnaps.map((s) => ({ id: s.id, name: String(s.data()?.name || s.id), shortName: String(s.data()?.shortName || s.data()?.name || s.id).slice(0, 24) }));
      return NextResponse.json({
        success: true,
        groupId,
        companies,
        multiCompany: companies.length > 1,
        warehouses: warehouses.map((w) => ({ id: w.id, code: w.code || w.id, name: w.name || w.code, zones: w.zones || [], racks: w.racks || [], source: w.source, ownerCompanyId: w.ownerCompanyId || w.companyId || companyId })),
        locations: listLocations(warehouses as WarehouseDoc[]),
        stock,
      });
    }

    if (!can(apiUser.roles, "inventory:edit")) throw new ApiAuthError(403, "แก้ไขผังคลังได้เฉพาะฝ่ายคลังสินค้า");
    const members = await companiesInGroup(groupId);

    if (action === "create") {
      const code = up(body.code).replace(/[^A-Z0-9-]/g, "");
      const name = str(body.name, 80);
      if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(code)) throw new ApiAuthError(400, "รหัสคลังไม่ถูกต้อง (เช่น WH-02)");
      if (!name) throw new ApiAuthError(400, "กรุณาระบุชื่อคลัง");
      const ref = adminDb.doc(`groups/${groupId}/warehouses/${code}`);
      await adminDb.runTransaction(async (tx) => {
        // รหัสคลังห้ามซ้ำทั้งคลังของเครือและคลังรุ่นเก่าของทุกบริษัทในเครือ (รหัสอยู่ในบาร์โค้ด/QR)
        const legacy = await Promise.all(members.map((c) => tx.get(adminDb.doc(`warehouses/${c}_${code}`))));
        if ((await tx.get(ref)).exists || legacy.some((s) => s.exists && s.data()!.isDeleted !== true)) throw new ApiAuthError(409, `มีคลังรหัส ${code} อยู่แล้วในเครือ`);
        tx.create(ref, { code, name, groupId, ownerCompanyId: companyId, zones: [], isActive: true, isDeleted: false, createdBy: apiUser.uid, createdByCompany: companyId, createdAt: now, updatedAt: now });
      });
      await auditServer.logCreate(apiUser.uid, companyId, "WAREHOUSE", ref.path, { code, name, groupId });
      return NextResponse.json({ success: true, id: GROUP_PREFIX + code });
    }

    if (action === "save3d") {
      // ผังคลังแบบ 3 มิติ (root warehouses/{docId}) — เดิมหน้าจอเขียนตรง ตอนนี้ rules ปิดแล้ว
      const docId = str(body.docId, 120);
      if (!/^[A-Za-z0-9_.-]{1,120}$/.test(docId)) throw new ApiAuthError(400, "รหัสคลังไม่ถูกต้อง");
      const ref = adminDb.doc(`warehouses/${docId}`);
      const snap = await ref.get();
      if (snap.exists && snap.data()!.companyId !== companyId) throw new ApiAuthError(403, "คลังนี้เป็นของบริษัทอื่น");
      const n = (v: any, max: number) => Math.max(0, Math.min(max, Number(v) || 0));
      const racks = (Array.isArray(body.racks) ? body.racks : []).slice(0, 500).map((r: any) => ({
        id: str(r?.id, 40), x: n(r?.x, 1000), y: n(r?.y, 1000), width: n(r?.width, 1000), height: n(r?.height, 1000), level: n(r?.level, 50), capacity: n(r?.capacity, 1_000_000),
      })).filter((r: any) => r.id);
      await ref.set({ companyId, code: str(body.code, 40), name: str(body.name, 80), gridCols: n(body.gridCols, 200), gridRows: n(body.gridRows, 200), racks, updatedBy: apiUser.uid, updatedAt: now }, { merge: true });
      await auditServer.logUpdate(apiUser.uid, companyId, "WAREHOUSE_3D", ref.path, null, { racks: racks.length });
      return NextResponse.json({ success: true });
    }

    if (action === "saveLayout") {
      const warehouseId = str(body.warehouseId, 120);
      const ref = await warehouseRef(companyId, groupId, warehouseId);
      if (!ref) throw new ApiAuthError(404, "ไม่พบคลัง");
      const snap = await ref.get();
      if (!snap.exists || snap.data()!.isDeleted === true) throw new ApiAuthError(404, "ไม่พบคลัง");
      const w = snap.data() as any;
      const zones = cleanZones(body.zones, new Set(members));
      const beforeLocs = listLocations([{ id: snap.id, ...w }]);
      const afterLocs = listLocations([{ id: snap.id, ...w, zones }]);
      const afterByCode = new Map(afterLocs.map((l) => [l.code, l]));
      const removed = beforeLocs.filter((l) => !afterByCode.has(l.code)).map((l) => l.code);
      const reowned = beforeLocs.filter((l) => afterByCode.has(l.code) && afterByCode.get(l.code)!.owner !== l.owner);
      if (removed.length || reowned.length) {
        const stocked = await stockedLocations(ref.path.startsWith("groups/") ? members : [companyId]);
        const busy = removed.filter((c) => stocked.has(c));
        if (busy.length) throw new ApiAuthError(409, `ลบตำแหน่งที่ยังมีสินค้าไม่ได้: ${busy.slice(0, 5).join(", ")}${busy.length > 5 ? ` และอีก ${busy.length - 5} ตำแหน่ง` : ""} (ย้ายสินค้าออกก่อน)`);
        const ownedBusy = reowned.filter((l) => Array.from(stocked.get(l.code) || []).some((c) => c !== afterByCode.get(l.code)!.owner)).map((l) => l.code);
        if (ownedBusy.length) throw new ApiAuthError(409, `เปลี่ยนเจ้าของช่องที่ยังมีสินค้าของบริษัทเดิมไม่ได้: ${ownedBusy.slice(0, 5).join(", ")}${ownedBusy.length > 5 ? ` และอีก ${ownedBusy.length - 5} ช่อง` : ""}`);
      }
      const name = str(body.name, 80) || w.name;
      await ref.update({ zones, name, updatedBy: apiUser.uid, updatedByCompany: companyId, updatedAt: now });
      await auditServer.logUpdate(apiUser.uid, companyId, "WAREHOUSE_LAYOUT", ref.path, { locations: beforeLocs.length }, { locations: afterLocs.length, zones: zones.length, reowned: reowned.length });
      return NextResponse.json({ success: true, locations: afterLocs.length, removed: removed.length, reowned: reowned.length });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[WAREHOUSE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกผังคลังไม่สำเร็จ" }, { status: 500 });
  }
}
