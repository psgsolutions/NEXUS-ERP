import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { normalizeProjectStatus } from "@/lib/project-status";
import { OWNERS, isMyTask, stateOf, taskBlockers, type SnapTask, type TaskState, type TaskStatus } from "@/lib/project-plan";
import { planStatusUpdate } from "@/lib/project-plan.server";

/**
 * [API-SERVER] ติดตามแผนงานโครงการ — POST /api/projects/plan { companyId, action, ... }
 *  setStatus { projectDocId, taskId, status: todo|doing|done, note? }
 *     - เริ่ม/เสร็จได้เมื่องานก่อนหน้าเสร็จแล้ว (จุดตรวจ เช่น อนุมัติแบบ) · ย้อนกลับไม่ได้ถ้างานถัดไปเริ่มแล้ว
 *     - ส่งมอบงวด n เสร็จ → งวดงานที่ n ความคืบหน้า 100% (พร้อมวางบิล) · ตรวจรับงวดสุดท้ายเสร็จ → บันทึกวันเริ่มประกันจริง
 *  assign { projectDocId, taskId, uid }    มอบหมายงานให้ผู้ใช้ในบริษัท (uid ว่าง = ตามตำแหน่ง)
 *  mine                                     งานตามแผนของฉัน (ทุกโครงการที่ยังดำเนินอยู่)
 * สิทธิ์แก้: projects:edit · ผู้จัดการ/ทีมโครงการ · ผู้ที่ได้รับมอบหมาย · ตำแหน่งตรงกับผู้รับผิดชอบงาน
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
// ยกเลิก/ไม่อนุมัติ = ไม่ติดตาม · ปิดงานแล้วยังมีงานช่วงประกัน (PM คืนหลักประกัน) ให้ติดตามต่อ
const CLOSED = ["Cancelled", "Rejected"];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const col = adminDb.collection(`companies/${companyId}/projects`);

    if (action === "mine") {
      const snaps = await col.get();
      const today = todayBkk();
      const rows: any[] = [];
      for (const d of snaps.docs) {
        const p = d.data();
        if (p.isDeleted || p.isSample || CLOSED.includes(normalizeProjectStatus(p.status)) || !Array.isArray(p.plan?.tasks)) continue;
        const tasks = p.plan.tasks as SnapTask[];
        for (const t of tasks) {
          const st = stateOf(p.planStatus, t.id);
          if (t.skipped || st.status === "done" || !isMyTask(t, p, user.uid, user.roles, st)) continue;
          const blockers = taskBlockers(t, tasks, p.planStatus);
          rows.push({
            projectDocId: d.id, projectId: p.projectId || d.id, projectName: p.projectName || "", customerName: p.customerName || "",
            task: t, state: st, blockers: blockers.map((b) => ({ id: b.id, name: b.name })), overdue: t.end < today,
          });
        }
      }
      rows.sort((a, b) => (a.task.start < b.task.start ? -1 : a.task.start > b.task.start ? 1 : 0));
      return NextResponse.json({ success: true, tasks: rows.slice(0, 300), today });
    }

    const docId = str(body.projectDocId, 120), taskId = str(body.taskId, 40);
    if (!docId || !taskId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const ref = col.doc(docId);

    if (action === "setStatus" || action === "assign") {
      let assignee: { uid: string; name: string } | null = null;
      if (action === "assign" && str(body.uid, 128)) {
        const u = await adminDb.doc(`users/${str(body.uid, 128)}`).get();
        if (!u.exists || u.get("companyId") !== companyId) throw new ApiAuthError(400, "ผู้ใช้นี้ไม่ได้อยู่ในบริษัท");
        assignee = { uid: u.id, name: str(u.get("name") || u.get("email"), 120) };
      }
      const status = str(body.status, 10) as TaskStatus;
      if (action === "setStatus" && !["todo", "doing", "done"].includes(status)) throw new ApiAuthError(400, "สถานะไม่ถูกต้อง");

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
        const p = snap.data()!;
        if (CLOSED.includes(normalizeProjectStatus(p.status))) throw new ApiAuthError(409, "โครงการถูกยกเลิก/ไม่อนุมัติ");
        const tasks = (p.plan?.tasks || []) as SnapTask[];
        const t = tasks.find((x) => x.id === taskId);
        if (!t) throw new ApiAuthError(404, "ไม่พบงานนี้ในแผน (บันทึกโครงการใหม่เพื่อสร้างแผนล่าสุด)");
        if (t.skipped) throw new ApiAuthError(409, "งานนี้ถูกข้ามในแผน");
        const cur = stateOf(p.planStatus, t.id);
        const member = p.createdBy === user.uid || p.projectManagerUid === user.uid || (p.teamUids || []).includes(user.uid);
        const roleOwner = !!OWNERS[t.owner]?.role && user.roles.includes(OWNERS[t.owner].role!);
        const manager = can(user.roles, "projects:edit") || can(user.roles, "projects:approve") || member;
        if (action === "assign" ? !manager : !(manager || roleOwner || cur.assigneeUid === user.uid)) throw new ApiAuthError(403, "ไม่มีสิทธิ์แก้งานนี้");

        let next: TaskState;
        let update: Record<string, any>;
        if (action === "assign") {
          next = { ...cur, ...(assignee ? { assigneeUid: assignee.uid, assigneeName: assignee.name } : { assigneeUid: "", assigneeName: "" }) };
          update = { planStatus: { ...(p.planStatus || {}), [t.id]: next }, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: user.uid };
        } else {
          const r = planStatusUpdate(p, t, status, { uid: user.uid, name: str(user.email || user.uid, 120) }, str(body.note, 500));
          if ("error" in r) throw new ApiAuthError(409, r.error);
          next = r.next; update = r.update;
        }
        tx.update(ref, update);
        return { projectId: p.projectId || docId, state: next };
      });
      await auditServer.logUpdate(user.uid, companyId, "PROJECT_PLAN", result.projectId, {}, { taskId, ...(action === "assign" ? { assignee: assignee?.uid || "" } : { status }) });
      return NextResponse.json({ success: true, ...result });
    }
    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PROJECT_PLAN_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "บันทึกสถานะงานไม่สำเร็จ" }, { status: 500 });
  }
}
