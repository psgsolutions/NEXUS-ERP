import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { auditServer } from "@/services/audit.server";
import { notifyInTx } from "@/lib/notifications.server";

/**
 * [API-SERVER] อนุมัติ / ตีกลับใบเสนอราคาที่รออนุมัติ
 * Endpoint: POST /api/quotations/{id}/approval  { companyId, decision: "approve" | "reject", comment? }
 * - เฉพาะ ADMIN / MANAGER / SUPERADMIN และเฉพาะใบที่สถานะรออนุมัติ
 * - อนุมัติ -> ส่งลูกค้าแล้ว (SENT), ตีกลับ -> REJECTED (ผู้ขายแก้แล้วส่งใหม่)
 */

const APPROVER_ROLES = ["ADMIN", "MANAGER", "SUPERADMIN"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId || !id) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!APPROVER_ROLES.includes(String(apiUser.role || "").toUpperCase())) throw new ApiAuthError(403, "เฉพาะผู้จัดการหรือผู้ดูแลระบบที่อนุมัติใบเสนอราคาได้");
    const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : "";
    if (!decision) throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
    const comment = String(body.comment || "").trim().slice(0, 500);

    const ref = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบเสนอราคา");
      const q = snap.data()!;
      const docNo = q.documentNo || q.quotationNumber || id;
      if (String(q.status || "").toUpperCase() !== "PENDING_APPROVAL") throw new ApiAuthError(409, `${docNo} ไม่ได้อยู่ในสถานะรออนุมัติ`);
      const status = decision === "approve" ? "SENT" : "REJECTED";
      tx.update(ref, {
        status,
        ...(decision === "approve" ? { approvedBy: apiUser.uid, approvedAt: now, sentAt: now, sentBy: apiUser.uid } : { rejectedBy: apiUser.uid, rejectedAt: now, rejectReason: comment }),
        updatedAt: now,
        updatedBy: apiUser.uid,
      });
      tx.set(ref.collection("audit_logs").doc(), {
        userId: apiUser.uid,
        userName: apiUser.email || apiUser.uid,
        action: decision === "approve" ? "APPROVE" : "REJECT",
        channel: "SYSTEM",
        timestamp: new Date().toISOString(),
        details: decision === "approve" ? "อนุมัติใบเสนอราคา" : `ตีกลับให้แก้ไข${comment ? `: ${comment}` : ""}`,
      });
      const owner = q.salesPersonId || q.createdBy;
      if (owner) {
        notifyInTx(tx, companyId, {
          type: decision === "approve" ? "QUOTATION_APPROVED" : "QUOTATION_REJECTED",
          title: decision === "approve" ? `ใบเสนอราคา ${docNo} อนุมัติแล้ว` : `ใบเสนอราคา ${docNo} ถูกตีกลับให้แก้ไข`,
          message: decision === "approve" ? `${q.customerName || "ลูกค้า"} · ส่งให้ลูกค้าได้` : comment || "ไม่ได้ระบุเหตุผล",
          link: `/sales/quotations/${id}`,
          targetUserId: owner,
          documentNo: docNo,
        }, apiUser.uid);
      }
      return { docNo, status };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "SALES_QUOTATION", result.docNo, { status: "PENDING_APPROVAL" }, { status: result.status, comment });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[QUOTATION_APPROVAL_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ทำรายการไม่สำเร็จ" }, { status: 500 });
  }
}
