import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { ATTACHMENT_MAX, ATTACHMENT_OWNERS, ATTACHMENT_TYPES, type AttachmentOwner } from "@/lib/attachments";

/**
 * [API-SERVER] ไฟล์แนบ (รูปใบเสร็จ บิล เอกสารประกอบ) — POST /api/attachments
 *  - { companyId, action: "upload", ownerType, ownerId, file: { name, mime, data } }  ทีละไฟล์ (รูปย่อในเบราว์เซอร์ก่อนส่ง)
 *  - { companyId, action: "list", ownerType, ownerId }                                 รายการ (ไม่มีเนื้อไฟล์)
 *  - { companyId, action: "get", id }                                                  เนื้อไฟล์ (data URL)
 *  - { companyId, action: "remove", id }                                               ลบ (ผู้อัปโหลด หรือฝ่ายบัญชี)
 * เก็บที่ companies/{id}/attachments (client อ่าน/เขียนตรงไม่ได้) — ย้ายไป Cloud Storage ได้ภายหลังโดยไม่ต้องแก้หน้าจอ
 * ดูได้: ผู้อัปโหลด และฝ่ายบัญชี/การเงิน (เอกสารประกอบการเบิก/จ่าย)
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const col = adminDb.collection(`companies/${companyId}/attachments`);
    const finance = can(apiUser.roles, "finance:view");

    if (action === "upload") {
      const ownerType = str(body.ownerType, 30) as AttachmentOwner;
      const ownerId = str(body.ownerId, 120);
      if (!ATTACHMENT_OWNERS.includes(ownerType) || !/^[A-Za-z0-9_.-]{1,120}$/.test(ownerId)) throw new ApiAuthError(400, "ไม่ระบุว่าแนบกับรายการไหน");
      const f = body.file || {};
      const mime = str(f.mime, 60), data = String(f.data || "");
      if (!ATTACHMENT_TYPES.includes(mime)) throw new ApiAuthError(400, "รองรับเฉพาะรูป JPG/PNG/WebP และ PDF");
      if (!data.startsWith(`data:${mime};base64,`) || data.length > ATTACHMENT_MAX) throw new ApiAuthError(400, `ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(ATTACHMENT_MAX / 1024 / 1.37)} KB หลังย่อ)`);
      const count = await col.where("ownerType", "==", ownerType).where("ownerId", "==", ownerId).count().get();
      if (count.data().count >= 20) throw new ApiAuthError(400, "แนบได้สูงสุด 20 ไฟล์ต่อรายการ");
      const ref = await col.add({
        ownerType, ownerId, name: str(f.name, 120) || "ไฟล์แนบ", mime, size: Math.round(data.length * 0.74), data,
        companyId, uploadedBy: apiUser.uid, uploadedByName: str((apiUser as any).name || (apiUser as any).email, 80), createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, id: ref.id });
    }

    if (action === "list") {
      const ownerType = str(body.ownerType, 30), ownerId = str(body.ownerId, 120);
      const snap = await col.where("ownerType", "==", ownerType).where("ownerId", "==", ownerId).limit(40).get();
      const files = snap.docs.filter((d) => finance || d.get("uploadedBy") === apiUser.uid)
        .map((d) => ({ id: d.id, name: d.get("name"), mime: d.get("mime"), size: d.get("size"), uploadedByName: d.get("uploadedByName") || "", createdAt: d.get("createdAt")?.toDate?.()?.toISOString?.() || "" }));
      return NextResponse.json({ success: true, files });
    }

    const id = str(body.id, 60);
    if (!/^[A-Za-z0-9]{1,60}$/.test(id)) throw new ApiAuthError(400, "รหัสไฟล์ไม่ถูกต้อง");
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบไฟล์");
    const mine = snap.get("uploadedBy") === apiUser.uid;
    if (action === "get") {
      if (!mine && !finance) throw new ApiAuthError(403, "ไม่มีสิทธิ์ดูไฟล์นี้");
      return NextResponse.json({ success: true, file: { id, name: snap.get("name"), mime: snap.get("mime"), data: snap.get("data") } });
    }
    if (action === "remove") {
      if (!mine && !can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ลบได้เฉพาะผู้อัปโหลดหรือฝ่ายบัญชี");
      await ref.delete();
      return NextResponse.json({ success: true });
    }
    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[ATTACHMENTS]", err);
    return NextResponse.json({ success: false, error: err.message || "จัดการไฟล์แนบไม่สำเร็จ" }, { status: 500 });
  }
}
