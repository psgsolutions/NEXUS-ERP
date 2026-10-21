import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { documentProfileOf } from "@/lib/documents/profile";
import { normalizeDesign } from "@/lib/documents/design";

/**
 * [API-SERVER] ข้อมูลนิติบุคคลและหัวเอกสาร — POST /api/settings/document-profile
 *  - { companyId, action: "get" }
 *  - { companyId, action: "saveDesign", design: { theme, perDoc } }   การออกแบบหน้าเอกสาร (ธีม/ปรับรายเอกสาร/ผังลากวาง) — ตรวจค่าที่ server
 *  - { companyId, action: "save", profile: { name, nameEn, address, taxId, branchCode, branchName, phone, email, website, logo, brandColor, footerNote, paymentInfo } }
 * ชื่อ/ที่อยู่/เลขผู้เสียภาษี/สาขา เก็บบน companies/{id} (ใช้ทุกเอกสาร), หน้าตาเอกสารเก็บที่ companies/{id}.documentProfile
 */
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const ref = adminDb.doc(`companies/${companyId}`);

    if (body.action === "get") {
      return NextResponse.json({ success: true, profile: documentProfileOf((await ref.get()).data()) });
    }
    if (body.action === "saveDesign") {
      if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ออกแบบเอกสารได้เฉพาะผู้ดูแลระบบ");
      const current = documentProfileOf((await ref.get()).data());
      const design = normalizeDesign(body.design, current.brandColor);
      // เอกสารบริษัทเก็บได้ ~1MB: การออกแบบ + โลโก้ รวมกันต้องไม่เกิน
      if (JSON.stringify(design).length + (current.logo || "").length > 950_000) throw new ApiAuthError(400, "รูปภาพในผังเอกสารรวมกับโลโก้ใหญ่เกินที่เก็บได้ ลดขนาดรูปในผังก่อน");
      await ref.update({ documentDesign: design, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
      await auditServer.logUpdate(apiUser.uid, companyId, "DOCUMENT_DESIGN", companyId, { templateId: current.design?.theme.templateId }, { templateId: design.theme.templateId, font: design.theme.font, perDoc: Object.keys(design.perDoc) });
      return NextResponse.json({ success: true, design });
    }
    if (body.action !== "save") throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
    if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "แก้ข้อมูลบริษัทได้เฉพาะผู้ดูแลระบบ");

    const p = body.profile || {};
    const taxId = str(p.taxId, 20).replace(/\D/g, "");
    if (taxId && taxId.length !== 13) throw new ApiAuthError(400, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
    const branchCode = str(p.branchCode, 10).replace(/\D/g, "") || "00000";
    if (branchCode.length > 5) throw new ApiAuthError(400, "รหัสสาขาต้องไม่เกิน 5 หลัก");
    const name = str(p.name, 200);
    if (!name) throw new ApiAuthError(400, "กรุณาระบุชื่อบริษัท");
    const logo = str(p.logo, 650_000);
    if (logo && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)) throw new ApiAuthError(400, "ไฟล์โลโก้ต้องเป็น PNG หรือ JPEG");
    const brandColor = /^#[0-9a-fA-F]{6}$/.test(str(p.brandColor)) ? str(p.brandColor) : "#1f6f5c";

    const before = documentProfileOf((await ref.get()).data());
    if (logo.length + JSON.stringify(before.design || {}).length > 950_000) throw new ApiAuthError(400, "โลโก้รวมกับรูปภาพในผังเอกสารใหญ่เกินที่เก็บได้ ลองโลโก้ไฟล์เล็กลง");
    await ref.set({
      name, address: str(p.address, 500), taxId, branchCode: branchCode.padStart(5, "0"), branchName: str(p.branchName, 100),
      phone: str(p.phone, 60), email: str(p.email, 120), website: str(p.website, 160),
      documentProfile: { nameEn: str(p.nameEn, 200), logo, brandColor, footerNote: str(p.footerNote, 500), paymentInfo: str(p.paymentInfo, 500) },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid,
    }, { merge: true });
    const { logo: _a, design: _d, ...beforeLog } = before; void _a; void _d;
    await auditServer.logUpdate(apiUser.uid, companyId, "COMPANY_PROFILE", companyId, beforeLog, { name, taxId, branchCode, address: str(p.address, 500) });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_PROFILE]", err);
    return NextResponse.json({ success: false, error: err.message || "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
