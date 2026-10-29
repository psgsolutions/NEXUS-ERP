import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ชุดอุปกรณ์สำเร็จรูป (BOM kit) — POST /api/inventory/kits
 *  - { companyId, action: "create", kit: { name, description?, components: [{ productId, name, qty, type, cost, price }] } }
 * เขียนผ่าน server เท่านั้น (rules ปิดการเขียน root kits จากหน้าจอ) · ต้องมีสิทธิ์ inventory:edit
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "inventory:edit")) throw new ApiAuthError(403, "ไม่มีสิทธิ์สร้างชุดอุปกรณ์");
    if (str(body.action, 20) !== "create") throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");

    const k = body.kit || {};
    const name = str(k.name);
    if (!name) throw new ApiAuthError(400, "กรุณาระบุชื่อชุดอุปกรณ์");
    const money = (v: any) => Math.round(Math.max(0, Number(v) || 0) * 100) / 100;
    const components = (Array.isArray(k.components) ? k.components : []).slice(0, 200)
      .map((c: any) => ({ productId: str(c?.productId, 120), name: str(c?.name), qty: Math.max(0, Number(c?.qty) || 0), type: str(c?.type, 60), cost: money(c?.cost), price: money(c?.price) }))
      .filter((c: any) => c.productId && c.qty > 0);
    if (!components.length) throw new ApiAuthError(400, "ชุดอุปกรณ์ต้องมีสินค้าอย่างน้อย 1 รายการ");
    const sum = (key: "cost" | "price") => Math.round(components.reduce((t: number, c: any) => t + c[key] * c.qty, 0) * 100) / 100;

    const ref = adminDb.collection("kits").doc();
    const data = {
      id: ref.id, companyId, name, description: str(k.description, 2000), components,
      aggregateCost: sum("cost"), aggregatePrice: sum("price"), status: "active",
      isDeleted: false, createdBy: apiUser.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (JSON.stringify(data).length > 200_000) throw new ApiAuthError(400, "ข้อมูลใหญ่เกินไป");
    await ref.set(data);
    await auditServer.logCreate(apiUser.uid, companyId, "INVENTORY_KIT", ref.id, { name, components: components.length });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[KITS_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "บันทึกชุดอุปกรณ์ไม่สำเร็จ" }, { status: 500 });
  }
}
