import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { DEFAULT_SPEC_TEMPLATES, normalizeSpecTemplate } from "@/lib/spec-library";

/**
 * [API-SERVER] จัดการคลังคุณลักษณะเฉพาะ (สเปก TOR) ของบริษัท
 * Endpoint: POST /api/settings/spec-templates
 * body: { companyId, action: "save" | "delete" | "reset", template?, id? }
 *  - save: บันทึกแม่แบบ (id ตรงกับแม่แบบมาตรฐาน = ใช้แทนแม่แบบมาตรฐาน)
 *  - delete: แม่แบบมาตรฐาน = ซ่อน, แม่แบบของบริษัท = ลบ
 *  - reset: ลบฉบับของบริษัท กลับไปใช้แม่แบบมาตรฐาน
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "แก้ไขคลังสเปกได้เฉพาะผู้ดูแลระบบ");

    const col = adminDb.collection(`companies/${companyId}/spec_templates`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const action = String(body.action || "");

    if (action === "save") {
      const t = normalizeSpecTemplate(body.template);
      if (!t) throw new ApiAuthError(400, "กรุณาระบุรหัสและชื่อแม่แบบ");
      if (!t.variants.length) throw new ApiAuthError(400, "ต้องมีรูปแบบการเขียนอย่างน้อย 1 รูปแบบ (มีชื่อและข้อความ)");
      if (t.variants.some((v, i) => t.variants.findIndex((x) => x.id === v.id) !== i)) throw new ApiAuthError(400, "รหัสรูปแบบซ้ำกัน");
      await col.doc(t.id).set({ ...t, isDeleted: false, companyId, updatedAt: now, updatedBy: apiUser.uid });
      await auditServer.logUpdate(apiUser.uid, companyId, "SPEC_TEMPLATES", t.id, {}, { name: t.name, variants: t.variants.length });
      return NextResponse.json({ success: true, id: t.id });
    }

    const id = String(body.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    if (!id) throw new ApiAuthError(400, "ไม่พบรหัสแม่แบบ");
    const isBuiltIn = DEFAULT_SPEC_TEMPLATES.some((t) => t.id === id);

    if (action === "delete") {
      if (isBuiltIn) await col.doc(id).set({ id, isDeleted: true, companyId, updatedAt: now, updatedBy: apiUser.uid });
      else await col.doc(id).delete();
      await auditServer.logDelete(apiUser.uid, companyId, "SPEC_TEMPLATES", id);
      return NextResponse.json({ success: true });
    }
    if (action === "reset") {
      if (!isBuiltIn) throw new ApiAuthError(400, "แม่แบบนี้ไม่มีค่ามาตรฐาน");
      await col.doc(id).delete();
      return NextResponse.json({ success: true });
    }
    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SPEC_TEMPLATES_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกคลังสเปกไม่สำเร็จ" }, { status: 500 });
  }
}
