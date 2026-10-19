import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { introsForRoles, tasksForRoles } from "@/lib/help/onboarding";

/**
 * [API-SERVER] การเริ่มใช้งานของผู้ใช้ (ต้อนรับครั้งแรก + รายการเริ่มต้นใช้งาน)
 * Endpoint: POST /api/onboarding
 *  - { action: "status" }                         งานตามตำแหน่งของผู้ใช้ พร้อมสถานะเสร็จ (ตรวจจากเอกสารที่ผู้ใช้สร้างจริง)
 *  - { action: "mark", welcomed?, dismissed?, helpOpened?, visit?, advanced? }   บันทึกความคืบหน้าใน users/{uid}.onboarding
 *      advanced = แสดงเครื่องมือขั้นสูงในแท็บ (ค่าเริ่มต้น: ซ่อน)
 * ผู้ใช้แก้เอกสาร users ของตัวเองไม่ได้ (กฎ Firestore) จึงเขียนผ่าน API เฉพาะฟิลด์ onboarding
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const userRef = adminDb.doc(`users/${apiUser.uid}`);
    const action = str(body.action, 20);

    if (action === "mark") {
      const patch: Record<string, any> = { "onboarding.updatedAt": admin.firestore.FieldValue.serverTimestamp() };
      if (body.welcomed === true) patch["onboarding.welcomed"] = true;
      if (typeof body.dismissed === "boolean") patch["onboarding.dismissed"] = body.dismissed;
      if (body.helpOpened === true) patch["onboarding.helpOpened"] = true;
      if (typeof body.advanced === "boolean") patch["onboarding.advanced"] = body.advanced;
      const visit = str(body.visit, 80);
      if (visit && /^\/[a-z0-9/-]*$/.test(visit)) patch["onboarding.visited"] = admin.firestore.FieldValue.arrayUnion(visit);
      // update อย่างเดียว: ผู้ใช้ที่ไม่มีเอกสาร users (เช่น บัญชีผู้ดูแลสูงสุดแบบกำหนดในระบบ) ไม่สร้างใหม่
      await userRef.update(patch).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (action === "status") {
      const [userSnap, groupId] = await Promise.all([userRef.get(), groupIdOfCompany(companyId)]);
      const state = (userSnap.data()?.onboarding || {}) as Record<string, any>;
      const visited = new Set<string>(Array.isArray(state.visited) ? state.visited : []);
      const tasks = tasksForRoles(apiUser.roles);
      const done = await Promise.all(tasks.map(async (t) => {
        const c = t.check;
        if (c.kind === "help") return !!state.helpOpened;
        if (c.kind === "visit") return visited.has(c.path);
        const base = c.scope === "group" ? `groups/${groupId}/${c.col}` : `companies/${companyId}/${c.col}`;
        const ids = c.byEmail && apiUser.email ? [apiUser.uid, apiUser.email] : [apiUser.uid];
        const snap = await adminDb.collection(base).where(c.field, "in", ids).limit(1).get().catch(() => null);
        return !!snap && !snap.empty;
      }));
      return NextResponse.json({
        success: true,
        welcomed: !!state.welcomed,
        dismissed: !!state.dismissed,
        advanced: !!state.advanced,
        intros: introsForRoles(apiUser.roles),
        tasks: tasks.map((t, i) => ({ id: t.id, label: t.label, href: t.href, kind: t.check.kind, path: t.check.kind === "visit" ? t.check.path : undefined, done: done[i] })),
      });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[ONBOARDING_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "โหลดข้อมูลการเริ่มใช้งานไม่สำเร็จ" }, { status: 500 });
  }
}
