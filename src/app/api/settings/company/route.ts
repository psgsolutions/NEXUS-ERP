import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { normalizePromptPayId } from "@/lib/promptpay";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ตั้งค่าบริษัทที่หน้าเว็บเขียนตรงไม่ได้แล้ว (กฎฐานข้อมูลปิด companies/{id} และ settings/*)
 * POST /api/settings/company
 *  - { companyId, action: "sequenceFormats", formats: { QT: "QT-[YYMM]-[0000]", ... } }   รูปแบบเลขที่เอกสาร
 *  - { companyId, action: "promptPay", promptPayId }                                       รหัสพร้อมเพย์หน้าร้าน (ว่าง = ใช้เลขผู้เสียภาษี)
 * สิทธิ์: settings:manage
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ตั้งค่าได้เฉพาะผู้ดูแลระบบ");
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (body.action === "sequenceFormats") {
      const raw = body.formats && typeof body.formats === "object" ? body.formats : {};
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw).slice(0, 60)) {
        if (!/^[A-Z]{2,5}$/.test(k)) continue;
        const f = str(v, 60);
        // ว่าง = ใช้ค่าเริ่มต้น / ต้องมีช่องลำดับ [000…] และไม่มีอักขระที่ใช้เป็นรหัสเอกสารไม่ได้
        if (f && (!/\[0{2,8}\]/.test(f) || /[\/\\#?%\s]/.test(f))) throw new ApiAuthError(400, `รูปแบบเลขที่ ${k} ต้องมีช่องลำดับ เช่น [0000] และห้ามมีช่องว่างหรือ / \\ # ? %`);
        clean[k] = f;
      }
      const ref = adminDb.doc(`companies/${companyId}/settings/sequence_formats`);
      const before = (await ref.get()).data() || {};
      await ref.set({ ...clean, updatedAt: now, updatedBy: apiUser.uid }, { merge: true });
      const changed = Object.fromEntries(Object.entries(clean).filter(([k, v]) => (before[k] || "") !== v));
      if (Object.keys(changed).length) await auditServer.logUpdate(apiUser.uid, companyId, "SEQUENCE_FORMATS", companyId, Object.fromEntries(Object.keys(changed).map((k) => [k, before[k] || ""])), changed);
      return NextResponse.json({ success: true, changed: Object.keys(changed) });
    }

    if (body.action === "promptPay") {
      const id = str(body.promptPayId, 20).replace(/\D/g, "");
      if (id && !normalizePromptPayId(id)) throw new ApiAuthError(400, "รหัสพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัวผู้เสียภาษี 13 หลัก");
      const ref = adminDb.doc(`companies/${companyId}`);
      const before = (await ref.get()).data()?.promptPayId || "";
      await ref.update({ promptPayId: id, updatedAt: now, updatedBy: apiUser.uid });
      await auditServer.logUpdate(apiUser.uid, companyId, "COMPANY_PROMPTPAY", companyId, { promptPayId: before }, { promptPayId: id });
      return NextResponse.json({ success: true });
    }

    if (body.action === "costMethod") {
      // วิธีคิดต้นทุนสินค้า: FIFO (ราย Lot) หรือ WAC — เปลี่ยนได้เฉพาะตอนยังไม่มีการเคลื่อนไหวสต็อก (เปลี่ยนกลางทางทำให้ต้นทุนขายไม่ต่อเนื่อง)
      const method = String(body.method || "").toUpperCase() === "WAC" ? "WAC" : "FIFO";
      const ref = adminDb.doc(`companies/${companyId}`);
      const before = (await ref.get()).data()?.settings?.costMethod || "FIFO";
      if (before !== method) {
        const used = await adminDb.collection(`companies/${companyId}/stock_movements`).limit(1).get();
        if (!used.empty && body.confirmChange !== true) throw new ApiAuthError(409, "มีการเคลื่อนไหวสต็อกแล้ว การเปลี่ยนวิธีคิดต้นทุนกระทบต้นทุนขายตั้งแต่วันนี้ และต้องปรึกษาผู้ทำบัญชีก่อน");
        await ref.update({ "settings.costMethod": method, updatedAt: now, updatedBy: apiUser.uid });
        await auditServer.logUpdate(apiUser.uid, companyId, "COMPANY_COST_METHOD", companyId, { costMethod: before }, { costMethod: method });
      }
      return NextResponse.json({ success: true, costMethod: method });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[SETTINGS_COMPANY]", err);
    return NextResponse.json({ success: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
