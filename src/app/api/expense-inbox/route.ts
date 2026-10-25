import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { createExpenseClaim } from "@/lib/expenses.server";
import { analyzeInbox } from "@/lib/expense-ai.server";
import { claimDescription, needsSubstitute, normalizeInboxData } from "@/lib/expense-inbox";

export const maxDuration = 60;

/**
 * [API-SERVER] กล่องรูปบิลรอยืนยัน — POST /api/expense-inbox
 *  - { action: "create", note? }                       เปิดรายการใหม่ (แล้วแนบรูปผ่าน /api/attachments ownerType "photo_inbox")
 *  - { action: "analyze", id }                         ให้ AI อ่านรูปที่แนบ → รอยืนยัน
 *  - { action: "list", scope: "mine" | "all", status? } รายการ (ทั้งหมด = ฝ่ายบัญชี)
 *  - { action: "update", id, data }                    แก้ข้อมูลที่อ่านได้ (ก่อนยืนยัน — ผู้ส่งหรือฝ่ายบัญชี)
 *  - { action: "confirm", id, employeeId, expenseAccountCode, projectId? }  ฝ่ายบัญชียืนยัน → สร้างใบเบิก (ย้ายรูปไปแนบใบเบิก)
 *  - { action: "reject", id, reason }
 * ยังไม่ยืนยัน = ยังไม่เป็นรายจ่ายของบริษัท · บิลที่ไม่มีใบเสร็จได้ใบรับรองแทนใบเสร็จ (เอกสาร substitute_receipt)
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const CLAIM_ROLES = ["finance:edit", "projects:edit", "inventory:edit", "sales:edit", "hr:edit", "service:field"];
const canClaim = (u: ApiUser) => CLAIM_ROLES.some((p) => can(u.roles, p as any));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const col = adminDb.collection(`companies/${companyId}/photo_inbox`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const finance = can(apiUser.roles, "finance:view");

    if (action === "create") {
      if (!canClaim(apiUser)) throw new ApiAuthError(403, "ไม่มีสิทธิ์ส่งบิลเบิกค่าใช้จ่าย");
      const ref = await col.add({ companyId, status: "DRAFT", source: "web", note: str(body.note, 500), createdBy: apiUser.uid, createdByName: str((apiUser as any).name || apiUser.email, 80), createdAt: now, updatedAt: now });
      return NextResponse.json({ success: true, id: ref.id });
    }
    if (action === "list") {
      const all = body.scope === "all" && finance;
      // ของฉัน: กรองผู้ส่งแล้วเรียงในหน่วยความจำ (ไม่ต้องสร้างดัชนีเพิ่ม)
      const snap = all ? await col.orderBy("createdAt", "desc").limit(100).get() : await col.where("createdBy", "==", apiUser.uid).limit(200).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.get("createdAt")?.toDate?.()?.toISOString?.() || "", analyzedAt: undefined, updatedAt: undefined, confirmedAt: d.get("confirmedAt")?.toDate?.()?.toISOString?.() || "" }))
        .filter((x: any) => !body.status || x.status === body.status)
        .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100);
      return NextResponse.json({ success: true, items, canConfirm: can(apiUser.roles, "finance:edit") });
    }

    const id = str(body.id, 60);
    if (!/^[A-Za-z0-9]{1,60}$/.test(id)) throw new ApiAuthError(400, "รหัสรายการไม่ถูกต้อง");
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบรายการ");
    const cur = snap.data()!;
    const mine = cur.createdBy === apiUser.uid;
    if (!mine && !finance) throw new ApiAuthError(403, "ไม่มีสิทธิ์ดูรายการนี้");
    const open = cur.status === "DRAFT" || cur.status === "REVIEW";

    if (action === "analyze") {
      if (!open) throw new ApiAuthError(400, "รายการนี้ยืนยันหรือปิดแล้ว");
      const r = await analyzeInbox(companyId, id);
      return NextResponse.json({ success: true, ...r });
    }
    if (action === "update") {
      if (!open) throw new ApiAuthError(400, "รายการนี้ยืนยันหรือปิดแล้ว แก้ไม่ได้");
      if (!mine && !can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "แก้ได้เฉพาะผู้ส่งหรือฝ่ายบัญชี");
      const data = normalizeInboxData(body.data);
      await ref.update({ data, status: "REVIEW", editedBy: apiUser.uid, updatedAt: now });
      return NextResponse.json({ success: true, data });
    }
    if (action === "reject") {
      if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ไม่อนุมัติได้เฉพาะฝ่ายบัญชี");
      if (!open) throw new ApiAuthError(400, "รายการนี้ยืนยันหรือปิดแล้ว");
      await ref.update({ status: "REJECTED", rejectReason: str(body.reason, 300), decidedBy: apiUser.uid, updatedAt: now });
      await auditServer.logUpdate(apiUser.uid, companyId, "PHOTO_INBOX", id, { status: cur.status }, { status: "REJECTED", reason: str(body.reason, 300) });
      return NextResponse.json({ success: true });
    }
    if (action === "confirm") {
      // ยืนยันก่อนเป็นรายจ่ายของบริษัท: ฝ่ายบัญชีเท่านั้น
      if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ยืนยันเป็นรายจ่ายได้เฉพาะฝ่ายบัญชี");
      if (!open) throw new ApiAuthError(400, "รายการนี้ยืนยันหรือปิดแล้ว");
      const data = normalizeInboxData(cur.data);
      if (!(data.total > 0)) throw new ApiAuthError(400, "ยังไม่มียอดเงิน — แก้ข้อมูลก่อนยืนยัน");
      // ทำเครื่องหมายก่อนสร้างใบเบิก (กันกดยืนยันซ้ำพร้อมกัน)
      await adminDb.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!["DRAFT", "REVIEW"].includes(s.data()!.status)) throw new ApiAuthError(409, "รายการนี้ถูกยืนยันไปแล้ว");
        tx.update(ref, { status: "CONFIRMING", updatedAt: now });
      });
      let expenseId = "";
      try {
        expenseId = await createExpenseClaim(apiUser, companyId, {
          employeeId: str(body.employeeId, 120), expenseAccountCode: str(body.expenseAccountCode, 10) || data.suggestedAccount,
          description: claimDescription(data), hasVat: data.docType === "TAX_INVOICE" && data.vat > 0,
          subtotal: data.docType === "TAX_INVOICE" ? data.subtotal : data.total, projectId: str(body.projectId, 120),
          source: { kind: "photo_inbox", id, docType: data.docType },
        });
      } catch (e) { await ref.update({ status: cur.status, updatedAt: now }); throw e; }
      // ย้ายรูปไปแนบใบเบิก (ฝ่ายบัญชีเห็นตอนจ่าย/ส่งสำนักบัญชี)
      const att = await adminDb.collection(`companies/${companyId}/attachments`).where("ownerType", "==", "photo_inbox").where("ownerId", "==", id).get();
      const batch = adminDb.batch();
      att.docs.forEach((d) => batch.update(d.ref, { ownerType: "expense", ownerId: expenseId, movedFrom: `photo_inbox/${id}` }));
      batch.update(ref, { status: "CONFIRMED", expenseId, data, substitute: needsSubstitute(data), decidedBy: apiUser.uid, confirmedAt: now, updatedAt: now });
      await batch.commit();
      await auditServer.logUpdate(apiUser.uid, companyId, "PHOTO_INBOX", id, { status: cur.status }, { status: "CONFIRMED", expenseId, total: data.total, docType: data.docType });
      return NextResponse.json({ success: true, expenseId, substitute: needsSubstitute(data) });
    }
    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[EXPENSE_INBOX]", err);
    return NextResponse.json({ success: false, error: err.message || "จัดการรูปบิลไม่สำเร็จ" }, { status: 500 });
  }
}
