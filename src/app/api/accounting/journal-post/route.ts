import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { journalDateStr, journalTotals, isOwnJournal } from "@/lib/journal-posting";
import { can } from "@/lib/permissions";

/**
 * [API-SERVER] อนุมัติลงบัญชีรายการบัญชี (draft -> posted)
 * Endpoint: POST /api/accounting/journal-post  { companyId, journalId }
 *
 * - ผู้อนุมัติ: SUPERADMIN / ADMIN / ACCOUNTANT
 * - ห้ามอนุมัติรายการที่ตัวเองสร้าง (แบ่งแยกหน้าที่) ยกเว้น SUPERADMIN
 * - งวดบัญชีของวันที่รายการต้องยังเปิดอยู่, เดบิตรวม = เครดิตรวม, ต้องเป็นฉบับร่างและยังไม่ถูกยกเลิก
 * - ลงบัญชีแล้วแก้ไขไม่ได้ (isImmutable) — แก้ด้วยรายการกลับบัญชีเท่านั้น
 */

const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const journalId = str(body.journalId);
    if (!companyId || !journalId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    const role = apiUser.role;
    if (!can(apiUser.roles, "finance:post")) throw new ApiAuthError(403, "อนุมัติลงบัญชีได้เฉพาะฝ่ายบัญชี");

    const ref = adminDb.doc(`companies/${companyId}/journal_entries/${journalId}`);
    const pre = await ref.get();
    if (!pre.exists) throw new ApiAuthError(404, "ไม่พบรายการบัญชี");
    // ตรวจงวดก่อนเข้าทรานแซกชัน (อ่านการปิดงวด) — ตรวจซ้ำว่าวันที่ไม่ถูกเปลี่ยนในทรานแซกชัน
    const date = journalDateStr(pre.data()!.date || pre.data()!.createdAt);
    if (!date) throw new ApiAuthError(400, "รายการบัญชีไม่มีวันที่");
    await assertPeriodOpen(companyId, date);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const j = snap.data()!;
      const ref_ = j.reference || journalId;
      if (j.isDeleted === true || String(j.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, "รายการนี้ถูกยกเลิกแล้ว");
      if (String(j.status || "posted").toLowerCase() !== "draft") throw new ApiAuthError(409, "รายการนี้ลงบัญชีไปแล้ว");
      if (journalDateStr(j.date || j.createdAt) !== date) throw new ApiAuthError(409, "วันที่รายการเปลี่ยนไป กรุณาลองใหม่");
      if (isOwnJournal(j, apiUser.uid, apiUser.email) && role !== "SUPERADMIN") {
        throw new ApiAuthError(403, "ห้ามอนุมัติรายการที่ตัวเองสร้าง กรุณาให้ผู้อื่นในฝ่ายบัญชีเป็นผู้อนุมัติ");
      }
      const { debit, credit, lineCount } = journalTotals(j);
      if (!lineCount) throw new ApiAuthError(400, "รายการบัญชีไม่มีบรรทัด");
      if (Math.abs(debit - credit) > 0.009) throw new ApiAuthError(400, `เดบิต (${debit.toLocaleString("th-TH")}) ไม่เท่ากับเครดิต (${credit.toLocaleString("th-TH")})`);
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(ref, {
        status: "posted",
        isImmutable: true,
        postedBy: apiUser.email || apiUser.uid,
        postedByUid: apiUser.uid,
        postedAt: now,
        updatedAt: now,
      });
      return { journalId, reference: ref_, date, debit };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "JOURNAL_ENTRY", journalId, { status: "draft" }, { status: "posted", reference: result.reference });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[JOURNAL_POST_ERROR]:", error);
    return NextResponse.json({ success: false, error: "อนุมัติลงบัญชีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
