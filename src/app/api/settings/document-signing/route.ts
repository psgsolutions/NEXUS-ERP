import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { normalizeSigning } from "@/lib/documents/esign";

/**
 * [API-SERVER] ลายเซ็นและตราประทับอิเล็กทรอนิกส์ — POST /api/settings/document-signing (ผู้ดูแลระบบเท่านั้น)
 *  - { companyId, action: "get" }
 *  - { companyId, action: "save", signing: { stamp, stampSize, signers: [{ id, name, position, image, consent? }], assign } }
 * เก็บที่ companies/{id}/document_assets/signing (กฎฐานข้อมูล: client อ่าน/เขียนไม่ได้)
 * ลายเซ็นใหม่/เปลี่ยนรูปต้องยืนยันว่าได้รับความยินยอมจากเจ้าของลายเซ็น — บันทึกผู้ยืนยันและเวลาไว้
 */
const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ตั้งค่าลายเซ็นและตราประทับได้เฉพาะผู้ดูแลระบบ");
    const ref = adminDb.doc(`companies/${companyId}/document_assets/signing`);

    if (body.action === "get") return NextResponse.json({ success: true, signing: normalizeSigning((await ref.get()).data()) });
    if (body.action !== "save") throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");

    const before = normalizeSigning((await ref.get()).data());
    const raw = body.signing || {};
    const who = str((apiUser as any).name || (apiUser as any).email || apiUser.uid, 80);
    const now = new Date().toISOString();
    // ลายเซ็นใหม่หรือเปลี่ยนรูป: ต้องติ๊กยืนยันความยินยอม (ลายเซ็นเดิมคงข้อมูลความยินยอมเดิม)
    const signers = (Array.isArray(raw.signers) ? raw.signers : []).map((s: any) => {
      const old = before.signers.find((o) => o.id === s?.id);
      if (old && old.image === s?.image) return { ...s, consentAt: old.consentAt, consentBy: old.consentBy };
      if (s?.consent !== true) throw new ApiAuthError(400, `ยืนยันว่าได้รับความยินยอมจาก "${str(s?.name, 80) || "เจ้าของลายเซ็น"}" ให้ใช้ลายเซ็นบนเอกสารก่อนบันทึก`);
      return { ...s, consentAt: now, consentBy: who };
    });
    const signing = normalizeSigning({ ...raw, signers });
    if (signers.length !== signing.signers.length) throw new ApiAuthError(400, "ลายเซ็นต้องมีชื่อและรูปลายเซ็น (PNG/JPG ไม่เกิน 150 KB)");
    if (raw.stamp && !signing.stamp) throw new ApiAuthError(400, "ตราประทับต้องเป็น PNG/JPG ไม่เกิน 300 KB");
    if (JSON.stringify(signing).length > 900_000) throw new ApiAuthError(400, "รูปลายเซ็นและตราประทับรวมกันใหญ่เกินที่เก็บได้ ลองลดจำนวนหรือขนาดรูป");

    await ref.set({ ...signing, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
    const summary = (s: typeof signing) => ({ stamp: !!s.stamp, signers: s.signers.map((x) => `${x.name} (${x.position || "-"})`), assign: s.assign });
    await auditServer.logUpdate(apiUser.uid, companyId, "DOCUMENT_SIGNING", companyId, summary(before), summary(signing));
    return NextResponse.json({ success: true, signing });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_SIGNING]", err);
    return NextResponse.json({ success: false, error: err.message || "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
