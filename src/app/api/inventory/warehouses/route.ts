import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { isValidPartCode, listLocations, MAX_BINS, MAX_LEVELS, type WarehouseDoc, type ZoneDef } from "@/lib/warehouse-location";

/**
 * [API-SERVER] คลังสินค้าและผังชั้นวาง (root: warehouses/{companyId}_{code})
 * Endpoint: POST /api/inventory/warehouses
 *  - { companyId, action: "list" }                                  -> คลังทั้งหมด + ตำแหน่ง + ยอดคงเหลือตามตำแหน่ง (ใช้กับแอปอื่นได้)
 *  - { companyId, action: "create", code, name }                    -> เพิ่มคลัง
 *  - { companyId, action: "saveLayout", warehouseId, name?, zones } -> บันทึกผัง โซน › ชั้นวาง (ชั้น × ช่อง)
 * - บันทึกผังไม่ได้ถ้าตำแหน่งที่ถูกลบออกยังมีสินค้าคงเหลืออยู่
 */

const str = (v: any, max = 80) => String(v ?? "").trim().slice(0, max);
const up = (v: any) => str(v, 12).toUpperCase().replace(/\s+/g, "");

function cleanZones(raw: any): ZoneDef[] {
  const zones: ZoneDef[] = (Array.isArray(raw) ? raw : []).slice(0, 50).map((z: any) => ({
    code: up(z?.code), name: str(z?.name, 60), color: /^#[0-9a-fA-F]{6}$/.test(String(z?.color || "")) ? String(z.color) : "",
    racks: (Array.isArray(z?.racks) ? z.racks : []).slice(0, 200).map((r: any) => ({
      code: up(r?.code), name: str(r?.name, 60), note: str(r?.note, 120),
      levels: Math.min(MAX_LEVELS, Math.max(1, Math.round(Number(r?.levels) || 1))),
      bins: Math.min(MAX_BINS, Math.max(1, Math.round(Number(r?.bins) || 1))),
    })),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "list") {
      if (!can(apiUser.roles, "inventory:view")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const [whs, bals] = await Promise.all([
        adminDb.collection("warehouses").where("companyId", "==", companyId).get(),
        adminDb.collection(`companies/${companyId}/inventory_balance`).get(),
      ]);
      const warehouses = whs.docs.filter((d) => d.data().isDeleted !== true).map((d) => ({ id: d.id, ...(d.data() as any) }));
      const stock: Record<string, { qty: number; items: number }> = {};
      bals.docs.forEach((d) => {
        const b = d.data() as any;
        const qty = Number(b.quantity) || 0;
        if (!b.location || qty <= 0) return;
        const s = (stock[b.location] ||= { qty: 0, items: 0 });
        s.qty += qty; s.items += 1;
      });
      return NextResponse.json({
        success: true,
        warehouses: warehouses.map((w) => ({ id: w.id, code: w.code || w.id, name: w.name || w.code, zones: w.zones || [], racks: w.racks || [] })),
        locations: listLocations(warehouses as WarehouseDoc[]),
        stock,
      });
    }

    if (!can(apiUser.roles, "inventory:edit")) throw new ApiAuthError(403, "แก้ไขผังคลังได้เฉพาะฝ่ายคลังสินค้า");

    if (action === "create") {
      const code = up(body.code).replace(/[^A-Z0-9-]/g, "");
      const name = str(body.name, 80);
      if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(code)) throw new ApiAuthError(400, "รหัสคลังไม่ถูกต้อง (เช่น WH-02)");
      if (!name) throw new ApiAuthError(400, "กรุณาระบุชื่อคลัง");
      const ref = adminDb.doc(`warehouses/${companyId}_${code}`);
      await adminDb.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) throw new ApiAuthError(409, `มีคลังรหัส ${code} อยู่แล้ว`);
        tx.create(ref, { companyId, code, name, zones: [], racks: [], isActive: true, isDeleted: false, createdBy: apiUser.uid, createdAt: now, updatedAt: now });
      });
      await auditServer.logCreate(apiUser.uid, companyId, "WAREHOUSE", ref.id, { code, name });
      return NextResponse.json({ success: true, id: ref.id });
    }

    if (action === "saveLayout") {
      const warehouseId = str(body.warehouseId, 120);
      if (!warehouseId || warehouseId.includes("/")) throw new ApiAuthError(400, "ไม่พบคลัง");
      const ref = adminDb.doc(`warehouses/${warehouseId}`);
      const zones = cleanZones(body.zones);
      const snap = await ref.get();
      const w = snap.data() as any;
      if (!snap.exists || w.companyId !== companyId) throw new ApiAuthError(404, "ไม่พบคลัง");
      // ตำแหน่งที่หายไปต้องไม่มีสินค้าคงเหลือ
      const before = new Set(listLocations([{ id: snap.id, ...w }]).map((l) => l.code));
      const after = new Set(listLocations([{ id: snap.id, ...w, zones }]).map((l) => l.code));
      const removed = Array.from(before).filter((c) => !after.has(c));
      if (removed.length) {
        const bals = await adminDb.collection(`companies/${companyId}/inventory_balance`).get();
        const busy = Array.from(new Set(bals.docs.map((d) => d.data() as any).filter((b) => removed.includes(b.location) && (Number(b.quantity) || 0) > 0).map((b) => b.location)));
        if (busy.length) throw new ApiAuthError(409, `ลบตำแหน่งที่ยังมีสินค้าไม่ได้: ${busy.slice(0, 5).join(", ")}${busy.length > 5 ? ` และอีก ${busy.length - 5} ตำแหน่ง` : ""} (ย้ายสินค้าออกก่อน)`);
      }
      const name = str(body.name, 80) || w.name;
      await ref.update({ zones, name, updatedBy: apiUser.uid, updatedAt: now });
      await auditServer.logUpdate(apiUser.uid, companyId, "WAREHOUSE_LAYOUT", warehouseId, { locations: before.size }, { locations: after.size, zones: zones.length });
      return NextResponse.json({ success: true, locations: after.size, removed: removed.length });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[WAREHOUSE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกผังคลังไม่สำเร็จ" }, { status: 500 });
  }
}
