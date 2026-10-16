import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";

/**
 * [API-SERVER] แก้ไขหมายเหตุภายใน (ไม่พิมพ์บนเอกสาร ลูกค้าไม่เห็น) ของใบเสนอราคา
 * Endpoint: POST /api/quotations/{id}/internal-notes  { companyId, internalNotes }
 * ใช้กับใบที่ถูกล็อกแล้ว (ส่งลูกค้าแล้ว / ได้งาน) — แก้เฉพาะฟิลด์นี้ ไม่กระทบข้อมูลที่ลูกค้าเห็น
 * ฉบับที่ถูกแทนที่แก้ไม่ได้ (ให้บันทึกที่ฉบับล่าสุด)
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId || !id) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const internalNotes = String(body.internalNotes ?? "").slice(0, 4000);

    const ref = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบเสนอราคา");
      const q = snap.data()!;
      if (String(q.status || "").toUpperCase() === "SUPERSEDED") throw new ApiAuthError(409, "ฉบับนี้ถูกแทนที่แล้ว กรุณาบันทึกหมายเหตุที่ฉบับล่าสุด");
      tx.update(ref, { internalNotes, updatedAt: now, updatedBy: apiUser.uid });
      tx.set(ref.collection("audit_logs").doc(), {
        userId: apiUser.uid,
        userName: apiUser.email || apiUser.uid,
        action: "UPDATE_INTERNAL_NOTES",
        channel: "SYSTEM",
        timestamp: new Date().toISOString(),
        details: "แก้ไขหมายเหตุภายใน",
      });
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[QUOTATION_NOTES_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกหมายเหตุไม่สำเร็จ" }, { status: 500 });
  }
}
