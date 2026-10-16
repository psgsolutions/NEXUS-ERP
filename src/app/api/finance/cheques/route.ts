import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] เปลี่ยนสถานะเช็คในทะเบียนเช็ค
 * Endpoint: POST /api/finance/cheques  { companyId, id, action, date?, note? }
 *  เช็ครับ (IN):  deposit (นำฝาก) -> clear (เรียกเก็บได้) / bounce (เช็คคืน)
 *  เช็คจ่าย (OUT): clear (ขึ้นเงินแล้ว)
 * - เช็คคืนไม่กลับรายการบัญชีอัตโนมัติ: ให้ยกเลิกใบเสร็จที่ผูกอยู่เพื่อคืนยอดลูกหนี้
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const NEXT: Record<"IN" | "OUT", Record<string, { from: string[]; to: string; label: string }>> = {
  IN: {
    deposit: { from: ["PENDING"], to: "DEPOSITED", label: "นำฝาก" },
    clear: { from: ["PENDING", "DEPOSITED"], to: "CLEARED", label: "เรียกเก็บได้" },
    bounce: { from: ["PENDING", "DEPOSITED"], to: "BOUNCED", label: "เช็คคืน" },
  },
  OUT: {
    clear: { from: ["PENDING"], to: "CLEARED", label: "ขึ้นเงินแล้ว" },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "จัดการเช็คได้เฉพาะฝ่ายบัญชี");
    const id = str(body.id, 120);
    const action = str(body.action, 20);
    if (!id || id.includes("/")) throw new ApiAuthError(400, "ไม่พบเช็ค");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ref = adminDb.doc(`companies/${companyId}/cheques/${id}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบเช็ค");
      const c = snap.data()!;
      const rule = NEXT[(c.direction === "OUT" ? "OUT" : "IN") as "IN" | "OUT"][action];
      if (!rule) throw new ApiAuthError(400, "คำสั่งไม่ถูกต้องสำหรับเช็คนี้");
      if (!rule.from.includes(String(c.status))) throw new ApiAuthError(409, `เช็ค ${c.chequeNo} อยู่ในสถานะที่${rule.label}ไม่ได้`);
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(ref, {
        status: rule.to,
        ...(rule.to === "DEPOSITED" ? { depositedAt: date } : {}),
        ...(rule.to === "CLEARED" ? { clearedAt: date } : {}),
        ...(rule.to === "BOUNCED" ? { bouncedAt: date } : {}),
        history: admin.firestore.FieldValue.arrayUnion({ status: rule.to, at: new Date().toISOString(), date, by: apiUser.uid, note: str(body.note, 200) }),
        updatedBy: apiUser.uid, updatedAt: now,
      });
      return { status: rule.to, docNo: c.docNo, direction: c.direction };
    });
    await auditServer.logUpdate(apiUser.uid, companyId, "CHEQUE", id, null, { action, ...result });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[CHEQUE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "อัปเดตสถานะเช็คไม่สำเร็จ" }, { status: 500 });
  }
}
