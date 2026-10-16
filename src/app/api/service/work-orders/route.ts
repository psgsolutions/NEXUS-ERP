import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { sanitizeLines } from "@/lib/doc-totals";

/**
 * [API-SERVER] สร้างใบสั่งงานบริการ (WO) อ้างอิงใบสั่งขาย
 * Endpoint: POST /api/service/work-orders
 * body: { companyId, soId, technicianUid, scheduleDate?, remarks?, items }
 * - ใบสั่งขายและช่างต้องเป็นของบริษัท, เลข WO ออกในทรานแซกชัน (ไม่ข้าม)
 *
 * งานหน้างาน (ช่างที่รับผิดชอบ หรือผู้มีสิทธิ์แก้ไขงาน):
 * body: { companyId, action: "checkin", woId, gps?, withoutGps? }  รอเริ่มงาน -> กำลังทำงาน
 * body: { companyId, action: "complete", woId, gps? }              ต้องเช็คอินแล้ว มีรูปหลังทำงานและลายเซ็นลูกค้า
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const EDIT_PERMS = ["projects:edit", "sales:edit", "inventory:edit"];
const cleanGps = (g: any) => {
  const lat = Number(g?.lat), lng = Number(g?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, accuracy: Math.max(0, Math.round(Number(g?.accuracy) || 0)) };
};

async function fieldAction(companyId: string, action: "checkin" | "complete", body: any, apiUser: { uid: string; roles: string[] }) {
  const woId = str(body.woId, 120);
  if (!woId || woId.includes("/")) throw new ApiAuthError(400, "ไม่พบใบสั่งงาน");
  const ref = adminDb.doc(`companies/${companyId}/work_orders/${woId}`);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const gps = cleanGps(body.gps);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งงาน");
    const w = snap.data()!;
    if (w.technicianUid !== apiUser.uid && !EDIT_PERMS.some((p) => can(apiUser.roles, p as any))) throw new ApiAuthError(403, "ใบสั่งงานนี้ไม่ได้มอบหมายให้คุณ");
    const st = String(w.status || "").toUpperCase();
    if (action === "checkin") {
      if (st !== "ASSIGNED") throw new ApiAuthError(409, "ใบสั่งงานนี้เริ่มงานไปแล้ว");
      tx.update(ref, {
        status: "IN_PROGRESS",
        checkIn: { at: now, by: apiUser.uid, gps, ...(body.withoutGps || !gps ? { note: "ไม่มีพิกัด GPS" } : {}) },
        updatedAt: now, updatedBy: apiUser.uid,
      });
      return "IN_PROGRESS";
    }
    if (st !== "IN_PROGRESS" || !w.checkIn) throw new ApiAuthError(409, "ต้องเช็คอินก่อนปิดงาน");
    const [after, signature] = await Promise.all(["after", "signature"].map((t) => tx.get(ref.collection("attachments").doc(t))));
    if (!after.exists || !signature.exists) throw new ApiAuthError(409, "ต้องมีรูปหลังทำงานและลายเซ็นลูกค้าก่อนปิดงาน");
    tx.update(ref, {
      status: "COMPLETED",
      checkOut: { at: now, by: apiUser.uid, gps },
      completedAt: now, completedBy: apiUser.uid,
      updatedAt: now, updatedBy: apiUser.uid,
    });
    return "COMPLETED";
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (body.action === "checkin" || body.action === "complete") {
      const status = await fieldAction(companyId, body.action, body, apiUser);
      await auditServer.logUpdate(apiUser.uid, companyId, "WORK_ORDER", str(body.woId, 120), null, { action: body.action, status });
      return NextResponse.json({ success: true, status });
    }
    if (!EDIT_PERMS.some((p) => can(apiUser.roles, p as any))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const items = sanitizeLines(body.items);
    if (!items.length) throw new ApiAuthError(400, "ต้องมีรายการอย่างน้อย 1 รายการ");
    const soRef = adminDb.doc(`companies/${companyId}/sales_orders/${str(body.soId, 120)}`);
    const techRef = adminDb.doc(`users/${str(body.technicianUid, 128)}`);
    const take = await prepareSequence("WO", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const woCode = await adminDb.runTransaction(async (tx) => {
      const [so, tech] = await Promise.all([tx.get(soRef), tx.get(techRef)]);
      if (!so.exists) throw new ApiAuthError(400, "กรุณาเลือกใบสั่งขายที่อ้างอิง");
      if (!tech.exists || tech.data()!.companyId !== companyId) throw new ApiAuthError(400, "กรุณาเลือกช่างผู้รับผิดชอบ");
      const s = so.data()!; const t = tech.data()!;
      const seq = await take(tx); const code = seq.number; seq.commit();
      tx.create(adminDb.doc(`companies/${companyId}/work_orders/${code}`), {
        woCode: code, documentNo: code, companyId,
        soId: so.id, soCode: s.documentNo || s.soId || so.id,
        customerId: s.customerId || "", customerName: s.customerName || "", projectId: s.projectId || null,
        technicianUid: tech.id, technicianName: str(t.name || t.displayName || t.email || tech.id, 120),
        scheduleDate: /^\d{4}-\d{2}-\d{2}/.test(String(body.scheduleDate || "")) ? String(body.scheduleDate).slice(0, 16) : "",
        remarks: str(body.remarks, 2000), items,
        status: "ASSIGNED",
        createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      return code;
    });
    await auditServer.logCreate(apiUser.uid, companyId, "WORK_ORDER", woCode, { so: soRef.id });
    return NextResponse.json({ success: true, woCode });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[WORK_ORDER_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบสั่งงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
