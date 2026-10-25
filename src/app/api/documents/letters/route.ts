import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { LETTER_LABELS, type LetterKind } from "@/lib/letters";

/**
 * [API-SERVER] หนังสือที่ออกแล้ว (ขอเข้าพื้นที่ · ส่งมอบงาน · ขอคืนหลักประกัน) — POST /api/documents/letters
 *  - { companyId, action: "save", letter: { kind, number, date, to, subject, refs[], attachments[], body[], signerName, signerTitle, projectId? } }
 * เก็บที่ companies/{id}/letters (บันทึกผ่าน API เท่านั้น) — ดูย้อนหลัง/พิมพ์ซ้ำได้ที่ประวัติเอกสาร · เลขที่ซ้ำไม่ได้
 */
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const list = (v: any, n: number, max: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    if (body.action !== "save") throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
    if (!can(apiUser.roles, "projects:edit")) throw new ApiAuthError(403, "บันทึกหนังสือได้เฉพาะผู้ที่แก้ไขโครงการได้");
    const l = body.letter || {};
    const kind = str(l.kind, 30) as LetterKind;
    if (!LETTER_LABELS[kind]) throw new ApiAuthError(400, "ไม่รู้จักชนิดหนังสือ");
    const number = str(l.number, 60);
    if (!number) throw new ApiAuthError(400, "กรุณาระบุเลขที่หนังสือก่อนบันทึก");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(l.date, 10)) ? str(l.date, 10) : new Date().toISOString().slice(0, 10);
    const to = str(l.to, 200), subject = str(l.subject, 300);
    if (!to || !subject) throw new ApiAuthError(400, "กรุณาระบุผู้รับ (เรียน) และเรื่อง");
    const col = adminDb.collection(`companies/${companyId}/letters`);
    const dup = await col.where("number", "==", number).limit(1).get();
    if (!dup.empty) throw new ApiAuthError(409, `เลขที่หนังสือ ${number} มีในระบบแล้ว`);
    const doc = {
      kind, title: LETTER_LABELS[kind], number, date, to, subject,
      refs: list(l.refs, 10, 200), attachments: list(l.attachments, 10, 200), body: list(l.body, 40, 2000),
      signerName: str(l.signerName, 100), signerTitle: str(l.signerTitle, 100), projectId: str(l.projectId, 80),
      companyId, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: apiUser.uid,
    };
    const ref = await col.add(doc);
    await auditServer.logCreate(apiUser.uid, companyId, "LETTER", ref.id, { kind, number, to, subject });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[LETTERS]", err);
    return NextResponse.json({ success: false, error: err.message || "บันทึกหนังสือไม่สำเร็จ" }, { status: 500 });
  }
}
