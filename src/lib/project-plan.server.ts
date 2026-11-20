import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { milestoneStatus, weightedProgress } from "./project-milestones";
import { normalizeProjectStatus } from "./project-status";
import { startedDependents, stateOf, taskBlockers, type SnapTask, type TaskState, type TaskStatus } from "./project-plan";

/**
 * เปลี่ยนสถานะงานในแผนของโครงการ (ใช้ร่วม: แท็บแผนงาน/งานตามแผน และปิดใบสั่งงานช่าง)
 * - เริ่ม/เสร็จได้เมื่องานก่อนหน้าเสร็จแล้ว · ย้อนกลับไม่ได้ถ้างานถัดไปเริ่มแล้ว
 * - ส่งมอบงวด n เสร็จ → งวดงานที่ n 100% · ตรวจรับงวดสุดท้ายเสร็จ → วันเริ่มประกันจริง
 * คืนข้อความผิดพลาด (ภาษาไทย) แทนการโยน เพื่อให้ผู้เรียกเลือกได้ว่าจะแจ้งหรือข้าม
 */
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export const PLAN_CLOSED = ["Cancelled", "Rejected"];

export function planStatusUpdate(p: any, t: SnapTask, status: TaskStatus, actor: { uid: string; name: string }, note = ""): { error: string } | { update: Record<string, any>; next: TaskState } {
  const tasks = (p.plan?.tasks || []) as SnapTask[];
  const cur = stateOf(p.planStatus, t.id);
  if (status !== "todo") {
    const wait = taskBlockers(t, tasks, p.planStatus);
    if (wait.length) return { error: `ต้องรอ ${wait.slice(0, 3).map((w) => `${w.id} ${w.name}`).join(", ")} เสร็จก่อน` };
  }
  if (cur.status === "done" && status !== "done") {
    const started = startedDependents(t.id, tasks, p.planStatus);
    if (started.length) return { error: `งานถัดไปเริ่มแล้ว (${started.slice(0, 2).map((x) => x.name).join(", ")}) — ย้อนสถานะไม่ได้` };
  }
  const next: TaskState = { ...cur, status, at: new Date().toISOString(), by: actor.uid, byName: actor.name.slice(0, 120), note: note.slice(0, 500) };
  // รหัสงานมีจุด (P4.1) — เขียนทั้งก้อน planStatus (ถ้าใช้ path "planStatus.P4.1" จะกลายเป็นฟิลด์ซ้อน)
  const update: Record<string, any> = { planStatus: { ...(p.planStatus || {}), [t.id]: next }, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.uid };
  const m = t.id.match(/^P5\.(\d+)\.handover$/);
  const idx = m ? Number(m[1]) - 1 : t.id === "P6.5" ? (p.milestones || []).length - 1 : -1;
  if (idx >= 0 && Array.isArray(p.milestones) && p.milestones[idx]) {
    const ms = p.milestones.map((x: any, i: number) => {
      if (i !== idx) return x;
      const progress = status === "done" ? 100 : Number(x.progress) >= 100 ? 0 : Number(x.progress) || 0;
      const y = { ...x, progress };
      return { ...y, status: milestoneStatus(y) };
    });
    update.milestones = ms;
    const prog = weightedProgress(ms);
    if (prog !== null) update.progress = prog;
  }
  if (t.id === "P6.5") update["plan.warrantyStartActual"] = status === "done" ? todayBkk() : admin.firestore.FieldValue.delete();
  return { update, next };
}

/**
 * ใบสั่งงานช่างที่สร้างจากแผน (links.projectId + links.planTaskId) เปลี่ยนสถานะ → งานในแผนตามไปด้วย
 *  - ช่างเริ่มงาน → งานในแผน "กำลังทำ" (ถ้ายังไม่เริ่ม)
 *  - ใบสั่งงานของงานนี้ปิดครบทุกใบ (ไม่นับที่ยกเลิก) → งานในแผน "เสร็จ"
 * คืนข้อความผลลัพธ์ไว้บันทึกในประวัติใบสั่งงาน ("" = ไม่มีอะไรเปลี่ยน)
 */
export async function syncPlanFromJob(companyId: string, job: any, event: "start" | "complete", actor: { uid: string; name: string }): Promise<string> {
  const projectDocId = String(job?.links?.projectId || ""), taskId = String(job?.links?.planTaskId || "");
  if (!projectDocId || !taskId || projectDocId.includes("/")) return "";
  const ref = adminDb.doc(`companies/${companyId}/projects/${projectDocId}`);
  let pending = 0;
  if (event === "complete") {
    const sibs = await adminDb.collection(`companies/${companyId}/jobs`).where("links.planTaskId", "==", taskId).get();
    pending = sibs.docs.filter((d) => d.get("links.projectId") === projectDocId && d.id !== job.jobNo && !["DONE", "CANCELLED"].includes(String(d.get("status")))).length;
  }
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "";
    const p = snap.data()!;
    if (PLAN_CLOSED.includes(normalizeProjectStatus(p.status))) return "";
    const t = ((p.plan?.tasks || []) as SnapTask[]).find((x) => x.id === taskId);
    if (!t || t.skipped) return "";
    const cur = stateOf(p.planStatus, t.id).status;
    const want: TaskStatus | null = event === "start" ? (cur === "todo" ? "doing" : null) : pending > 0 ? (cur === "todo" ? "doing" : null) : cur === "done" ? null : "done";
    if (!want) return pending > 0 ? `แผนงาน ${t.id}: รอใบสั่งงานอื่นของงานนี้อีก ${pending} ใบ` : "";
    const r = planStatusUpdate(p, t, want, actor, `${event === "complete" ? "ปิด" : "เริ่ม"}ใบสั่งงาน ${job.jobNo}`);
    if ("error" in r) return `แผนงาน ${t.id} ยังไม่ปิดอัตโนมัติ: ${r.error}`;
    tx.update(ref, r.update);
    return want === "done" ? `แผนงาน ${t.id} "${t.name}" เสร็จแล้ว (อัตโนมัติ)` : `แผนงาน ${t.id} "${t.name}" กำลังทำ`;
  });
}
