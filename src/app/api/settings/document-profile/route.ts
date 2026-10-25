import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canAny } from "@/lib/permissions";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { auditServer } from "@/services/audit.server";
import { documentProfileOf } from "@/lib/documents/profile";
import { normalizeDesign } from "@/lib/documents/design";
import { DOC_SOURCES } from "@/lib/documents/sources.server";

/**
 * [API-SERVER] ข้อมูลนิติบุคคลและหัวเอกสาร — POST /api/settings/document-profile
 *  - { companyId, action: "get" }
 *  - { companyId, action: "saveDesign", design: { theme, perDoc } }   การออกแบบหน้าเอกสาร (ธีม/ปรับรายเอกสาร/ผังลากวาง) — ตรวจค่าที่ server
 *  - { companyId, action: "save", profile: { name, nameEn, address, taxId, branchCode, branchName, phone, email, website, logo, brandColor, footerNote, paymentInfo } }
 * ชื่อ/ที่อยู่/เลขผู้เสียภาษี/สาขา เก็บบน companies/{id} (ใช้ทุกเอกสาร), หน้าตาเอกสารเก็บที่ companies/{id}.documentProfile
 */
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

const VERSION_KEEP = 20;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const ref = adminDb.doc(`companies/${companyId}`);

    if (body.action === "get") {
      return NextResponse.json({ success: true, profile: documentProfileOf((await ref.get()).data()) });
    }
    // ---------- ประวัติเวอร์ชันการออกแบบ (ย้อนกลับได้ทั้งชุด) ----------
    if (body.action === "versions") {
      if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ดูประวัติการออกแบบได้เฉพาะผู้ดูแลระบบ");
      const snap = await ref.collection("design_versions").orderBy("savedAt", "desc").limit(VERSION_KEEP).get();
      return NextResponse.json({ success: true, versions: snap.docs.map((d) => ({ id: d.id, savedAt: d.get("savedAt")?.toDate?.()?.toISOString() || "", savedByName: d.get("savedByName") || "", templateId: d.get("templateId") || "" })) });
    }
    if (body.action === "version") {
      if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ดูประวัติการออกแบบได้เฉพาะผู้ดูแลระบบ");
      const v = await ref.collection("design_versions").doc(str(body.id, 60)).get();
      if (!v.exists) throw new ApiAuthError(404, "ไม่พบเวอร์ชันนี้");
      const current = documentProfileOf((await ref.get()).data());
      return NextResponse.json({ success: true, design: normalizeDesign(v.get("design"), current.brandColor) });
    }
    // ---------- เอกสารจริงล่าสุดของชนิดนี้ (ดูตัวอย่างการออกแบบด้วยข้อมูลจริง) ----------
    if (body.action === "sampleDocs") {
      if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ใช้ได้เฉพาะผู้ดูแลระบบ");
      const type = str(body.type, 30), src = DOC_SOURCES[type], perm = DOCUMENT_TYPES[type]?.permission;
      // แสดงเฉพาะเอกสารชนิดที่ผู้ใช้มีสิทธิ์เปิดอยู่แล้ว (หน้าออกแบบไม่ข้ามสิทธิ์การดูเอกสาร)
      if (!src || !perm || !canAny(apiUser.roles, ([] as any[]).concat(perm))) return NextResponse.json({ success: true, docs: [] });
      const snap = await ref.collection(src.col).orderBy("createdAt", "desc").limit(12).get();
      const docs = snap.docs.filter((d) => d.get("docKind") !== "opening" && String(d.get("status") || "").toUpperCase() !== "CANCELLED").slice(0, 8)
        .map((d) => ({ id: d.id, label: [src.no.map((k) => d.get(k)).find(Boolean) || d.id, src.party.map((k) => d.get(k)).find(Boolean) || ""].filter(Boolean).join(" · ") }));
      return NextResponse.json({ success: true, docs });
    }
    if (body.action === "saveDesign") {
      if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ออกแบบเอกสารได้เฉพาะผู้ดูแลระบบ");
      const current = documentProfileOf((await ref.get()).data());
      const design = normalizeDesign(body.design, current.brandColor);
      // เอกสารบริษัทเก็บได้ ~1MB: การออกแบบ + โลโก้ รวมกันต้องไม่เกิน
      if (JSON.stringify(design).length + (current.logo || "").length > 950_000) throw new ApiAuthError(400, "รูปภาพในผังเอกสารรวมกับโลโก้ใหญ่เกินที่เก็บได้ ลดขนาดรูปในผังก่อน");
      await ref.update({ documentDesign: design, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
      // เก็บเวอร์ชัน (ล่าสุด VERSION_KEEP รุ่น) ย้อนกลับทั้งชุดได้จากหน้าออกแบบ
      const versions = ref.collection("design_versions");
      await versions.add({ design, savedAt: admin.firestore.FieldValue.serverTimestamp(), savedBy: apiUser.uid, savedByName: str((apiUser as any).name || (apiUser as any).email || "", 80), templateId: design.theme.templateId });
      const old = await versions.orderBy("savedAt", "desc").offset(VERSION_KEEP).get();
      await Promise.all(old.docs.map((d) => d.ref.delete()));
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
