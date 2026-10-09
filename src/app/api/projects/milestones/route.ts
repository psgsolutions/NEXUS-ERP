import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { normalizeProjectStatus } from "@/lib/project-status";
import { milestoneStatus, weightedProgress } from "@/lib/project-milestones";

/**
 * [API-SERVER] บันทึกงวดงานของโครงการ (แทนที่ทั้งชุด)
 * Endpoint: POST /api/projects/milestones
 * body: { companyId, projectDocId, milestones: [{ id?, name, startDate, endDate, weight, amount, progress, note? }] }
 *
 * - วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม, น้ำหนักรวมไม่เกิน 100%, ความคืบหน้า 0-100
 * - เมื่อมีงวดงาน ความคืบหน้าของโครงการ = ค่าเฉลี่ยถ่วงน้ำหนักของงวดงาน
 * - แก้ไขได้: ผู้สร้างโครงการ ผู้จัดการโครงการ ทีมงาน หรือผู้ดูแลระบบ (โครงการที่ยกเลิกแล้วแก้ไม่ได้)
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const docId = str(body.projectDocId, 120);
    if (!companyId || !docId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "projects:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const raw: any[] = Array.isArray(body.milestones) ? body.milestones : [];
    if (raw.length > 60) throw new ApiAuthError(400, "งวดงานมากเกินไป (สูงสุด 60 งวด)");
    const milestones = raw.map((m, i) => {
      const name = str(m.name);
      const n = i + 1;
      if (!name) throw new ApiAuthError(400, `งวดที่ ${n}: กรุณาระบุชื่องวดงาน`);
      if (!isDate(m.startDate) || !isDate(m.endDate)) throw new ApiAuthError(400, `งวดที่ ${n}: กรุณาระบุวันที่เริ่มและสิ้นสุด`);
      if (m.endDate < m.startDate) throw new ApiAuthError(400, `งวดที่ ${n}: วันที่สิ้นสุดอยู่ก่อนวันที่เริ่ม`);
      const weight = round2(Number(m.weight) || 0);
      const progress = Math.round(Number(m.progress) || 0);
      if (weight < 0 || weight > 100) throw new ApiAuthError(400, `งวดที่ ${n}: น้ำหนักต้องอยู่ระหว่าง 0-100%`);
      if (progress < 0 || progress > 100) throw new ApiAuthError(400, `งวดที่ ${n}: ความคืบหน้าต้องอยู่ระหว่าง 0-100%`);
      const ms = {
        id: str(m.id, 40) || `MS-${Date.now().toString(36)}-${i}`,
        seq: n,
        name,
        startDate: m.startDate,
        endDate: m.endDate,
        weight,
        amount: round2(Math.max(0, Number(m.amount) || 0)),
        progress,
        note: str(m.note, 300),
      };
      return { ...ms, status: milestoneStatus(ms) };
    });
    const totalWeight = round2(milestones.reduce((s, m) => s + m.weight, 0));
    if (totalWeight > 100.001) throw new ApiAuthError(400, `น้ำหนักรวม ${totalWeight}% เกิน 100%`);

    const ref = adminDb.doc(`companies/${companyId}/projects/${docId}`);
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
      const p = snap.data()!;
      if (p.isSample) throw new ApiAuthError(400, "โครงการตัวอย่างแก้ไขไม่ได้");
      if (normalizeProjectStatus(p.status) === "Cancelled") throw new ApiAuthError(409, "โครงการถูกยกเลิกแล้ว");
      const role = String(apiUser.role || "").toUpperCase();
      const allowed = role === "ADMIN" || role === "SUPERADMIN" || p.createdBy === apiUser.uid || p.projectManagerUid === apiUser.uid || (p.teamUids || []).includes(apiUser.uid);
      if (!allowed) throw new ApiAuthError(403, "แก้ไขงวดงานได้เฉพาะผู้สร้าง ผู้จัดการโครงการ ทีมงาน หรือผู้ดูแลระบบ");

      const progress = weightedProgress(milestones);
      tx.update(ref, {
        milestones,
        ...(progress !== null ? { progress } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: apiUser.uid,
      });
      return { projectId: p.projectId || docId, progress };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "PROJECTS", result.projectId, {}, { milestones: milestones.length, progress: result.progress });
    return NextResponse.json({ success: true, ...result, count: milestones.length });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PROJECT_MILESTONES_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกงวดงานไม่สำเร็จ" }, { status: 500 });
  }
}
