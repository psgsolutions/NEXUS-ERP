import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { notifyInTx } from "@/lib/notifications.server";
import { APPROVAL_STEPS, approverRolesForStep, canApproveStep, normalizeProjectStatus, type ProjectAction, type ProjectStatus } from "@/lib/project-status";

/**
 * [API-SERVER] ดำเนินการกับโครงการ
 * Endpoint: POST /api/projects/action { companyId, projectDocId, action, comment?, progress? }
 *  - approve / reject : อนุมัติหรือตีกลับขั้นปัจจุบัน (ตามบทบาทของแต่ละขั้น)
 *  - start            : อนุมัติครบแล้ว -> เริ่มดำเนินการ
 *  - progress         : อัปเดตความคืบหน้า 0-100%
 *  - complete         : ปิดโครงการ
 *  - cancel           : ยกเลิก (ก่อนเริ่มดำเนินการ)
 */

const ACTIONS: ProjectAction[] = ["approve", "reject", "start", "progress", "complete", "cancel"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const docId = String(body.projectDocId || "").trim();
    const action = String(body.action || "") as ProjectAction;
    const comment = String(body.comment || "").trim().slice(0, 1000);
    if (!companyId || !docId || !ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const apiUser = await requireApiUser(request, companyId);
    const userDoc = (await adminDb.doc(`users/${apiUser.uid}`).get()).data();
    const actorName = String(userDoc?.name || userDoc?.displayName || apiUser.email || apiUser.uid);
    const ref = adminDb.doc(`companies/${companyId}/projects/${docId}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
      const cur = snap.data()!;
      const status = normalizeProjectStatus(cur.status);
      const nowIso = new Date().toISOString();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const need = (ok: boolean, msg: string, code = 409) => { if (!ok) throw new ApiAuthError(code, msg); };
      const update: Record<string, any> = { updatedAt: now, updatedBy: apiUser.uid };
      let next: ProjectStatus = status;

      if (action === "approve" || action === "reject") {
        need(status === "Pending Approval", "โครงการไม่ได้อยู่ในสถานะรออนุมัติ");
        const step = Number(cur.currentApprovalStep) || 1;
        // นโยบายบริษัท (ยืนยัน 2026-10-09): คนเดียวอนุมัติหลายขั้นได้ ตรวจเฉพาะบทบาทที่มีสิทธิ์ในขั้นนั้น
        // ไม่ตรวจว่าเคยอนุมัติขั้นก่อนหน้าแล้วหรือไม่
        need(canApproveStep(apiUser.roles, step), `บทบาทของคุณอนุมัติขั้นที่ ${step} ไม่ได้`, 403);
        if (action === "reject") need(comment.length > 0, "กรุณาระบุเหตุผลที่ไม่อนุมัติ", 400);
        const approvals = (Array.isArray(cur.approvals) ? cur.approvals : APPROVAL_STEPS).map((a: any) => ({ ...a }));
        const idx = approvals.findIndex((a: any) => Number(a.stepOrder) === step);
        need(idx >= 0, "ไม่พบขั้นอนุมัติ");
        approvals[idx] = {
          ...approvals[idx],
          status: action === "approve" ? "Approved" : "Rejected",
          byUid: apiUser.uid,
          byName: actorName,
          at: nowIso,
          ...(comment ? { comment } : {}),
        };
        update.approvals = approvals;
        if (action === "reject") {
          next = "Rejected";
          update.currentApprovalStep = 0;
        } else if (step >= APPROVAL_STEPS.length) {
          next = "Approved";
          update.currentApprovalStep = 0;
          update.approvedAt = now;
        } else {
          update.currentApprovalStep = step + 1;
        }
      } else {
        need(can(apiUser.roles, "projects:edit"), "สิทธิ์การใช้งานไม่เพียงพอ", 403);
        if (action === "start") {
          need(status === "Approved", "เริ่มดำเนินการได้เมื่ออนุมัติครบทุกขั้นแล้ว");
          next = "In Progress";
          update.startedAt = now;
        } else if (action === "progress") {
          need(status === "In Progress", "อัปเดตความคืบหน้าได้เฉพาะโครงการที่กำลังดำเนินการ");
          need(!(Array.isArray(cur.milestones) && cur.milestones.length), "โครงการนี้คำนวณความคืบหน้าจากงวดงาน กรุณาอัปเดตที่หน้างวดงาน");
          update.progress = Math.min(100, Math.max(0, Math.round(Number(body.progress) || 0)));
        } else if (action === "complete") {
          need(status === "In Progress", "ปิดได้เฉพาะโครงการที่กำลังดำเนินการ");
          next = "Completed";
          update.progress = 100;
          update.completedAt = now;
        } else if (action === "cancel") {
          need(["Draft", "Pending Approval", "Rejected", "Approved"].includes(status), "ยกเลิกได้เฉพาะโครงการที่ยังไม่เริ่มดำเนินการ");
          need(comment.length > 0, "กรุณาระบุเหตุผลที่ยกเลิก", 400);
          const isOwner = cur.createdBy === apiUser.uid;
          need(isOwner || can(apiUser.roles, "projects:approve"), "ยกเลิกได้เฉพาะผู้สร้างโครงการหรือผู้บริหาร", 403);
          next = "Cancelled";
          update.cancelledAt = now;
          update.cancelReason = comment;
        }
      }
      update.status = next;

      // ประวัติการดำเนินการ (เก็บล่าสุด 100 รายการ)
      const history = Array.isArray(cur.history) ? cur.history.slice(-99) : [];
      history.push({ action, byUid: apiUser.uid, byName: actorName, at: nowIso, from: status, to: next, ...(comment ? { comment } : {}), ...(action === "progress" ? { progress: update.progress } : {}) });
      update.history = history;

      tx.update(ref, update);

      // แจ้งเตือน: ขั้นถัดไปถึงผู้อนุมัติ, ผลอนุมัติ/ไม่อนุมัติถึงผู้สร้าง
      const pNo = cur.projectId || docId;
      const pName = cur.projectName || cur.title || cur.name || "";
      const link = `/projects/${docId}`;
      if (action === "approve" && next === "Pending Approval") {
        const nextStep = Number(update.currentApprovalStep);
        notifyInTx(tx, companyId, { type: "PROJECT_PENDING_APPROVAL", title: `โครงการ ${pNo} รออนุมัติขั้นที่ ${nextStep}`, message: pName, link, targetRoles: approverRolesForStep(nextStep), documentNo: pNo }, apiUser.uid);
      } else if ((action === "approve" && next === "Approved") || action === "reject") {
        if (cur.createdBy) notifyInTx(tx, companyId, {
          type: action === "approve" ? "PROJECT_APPROVED" : "PROJECT_REJECTED",
          title: action === "approve" ? `โครงการ ${pNo} อนุมัติครบทุกขั้นแล้ว` : `โครงการ ${pNo} ไม่ได้รับอนุมัติ`,
          message: action === "approve" ? `${pName} · เริ่มดำเนินการได้` : comment || pName,
          link, targetUserId: cur.createdBy, documentNo: pNo,
        }, apiUser.uid);
      }
      return { projectId: pNo, from: status, to: next };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "PROJECTS", result.projectId, { status: result.from }, { status: result.to, action });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SERVER_PROJECT_ACTION_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
