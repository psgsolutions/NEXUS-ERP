import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { THAI_MONTHS, periodIdOf, periodOf } from "@/lib/period-close-service";

/**
 * [API-SERVER] ปิดงวดบัญชีรายเดือน
 * GET  /api/accounting/period-close?companyId&year&month  -> ประวัติงวด + ผลตรวจความพร้อมของงวดที่เลือก
 * POST /api/accounting/period-close { companyId, year, month } -> ปิดงวด (ล็อกการบันทึกบัญชีลงวันที่ในงวดนั้น)
 *
 * ปิดไม่ได้เมื่อ: เป็นงวดในอนาคต, ปิดไปแล้ว, มีรายการบัญชีรออนุมัติ (draft) หรือรายการที่ลงบัญชีแล้วไม่สมดุลในงวด
 */

const ENG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parsePeriod(yearInput: any, monthInput: any) {
  const year = Number(yearInput);
  let month = Number(monthInput);
  if (!Number.isInteger(month)) {
    const s = String(monthInput || "").trim();
    const idx = ENG_MONTHS.findIndex((m) => m.toLowerCase() === s.toLowerCase());
    month = idx >= 0 ? idx + 1 : THAI_MONTHS.indexOf(s) + 1;
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !(month >= 1 && month <= 12)) throw new ApiAuthError(400, "งวดบัญชีไม่ถูกต้อง");
  return { year, month, label: `${THAI_MONTHS[month - 1]} ${year + 543}` };
}

function assertCanClose(role?: string) {
  const r = String(role || "").toUpperCase();
  if (!(["SUPERADMIN", "ADMIN", "ACCOUNTANT"].includes(r) || can(role, "finance:edit"))) {
    throw new ApiAuthError(403, "ไม่มีสิทธิ์ปิดงวดบัญชี (ต้องเป็นผู้ดูแลระบบหรือนักบัญชี)");
  }
}

/** ตรวจความพร้อมของงวด: รายการรออนุมัติ / ไม่สมดุล / งวดก่อนหน้ายังเปิด */
async function inspect(companyId: string, year: number, month: number) {
  const [jSnap, pSnap] = await Promise.all([
    adminDb.collection(`companies/${companyId}/journal_entries`).select("date", "createdAt", "status", "totalDebit", "totalCredit", "description", "journalNo", "isDeleted").get(),
    adminDb.collection("periodClosings").where("companyId", "==", companyId).get(),
  ]);

  const drafts: any[] = [];
  const unbalanced: any[] = [];
  let posted = 0;
  let totalDebit = 0;
  jSnap.docs.forEach((d) => {
    const j = d.data();
    if (j.isDeleted) return;
    const p = periodOf(j.date || j.createdAt);
    if (!p || p.year !== year || p.month !== month) return;
    const row = { id: d.id, path: d.ref.path, journalNo: j.journalNo || d.id, date: typeof j.date === "string" ? j.date.slice(0, 10) : "", description: j.description || "", amount: Number(j.totalDebit) || 0 };
    const status = String(j.status || "posted").toLowerCase();
    if (status === "draft") return void drafts.push(row);
    if (status !== "posted") return;
    posted++;
    totalDebit += Number(j.totalDebit) || 0;
    if (Math.abs((Number(j.totalDebit) || 0) - (Number(j.totalCredit) || 0)) > 0.01) unbalanced.push({ ...row, diff: (Number(j.totalDebit) || 0) - (Number(j.totalCredit) || 0) });
  });

  const periods = pSnap.docs
    .map((d) => {
      const x = d.data();
      const y = Number(x.periodYear ?? x.year);
      const m = Number(x.periodMonth) || ENG_MONTHS.indexOf(x.month) + 1 || THAI_MONTHS.indexOf(x.month) + 1 || Number(x.month);
      return { id: d.id, year: y, month: m, status: x.status, closedAt: x.closedAt || null, closedBy: x.closedByName || x.closedBy || "", reopenedAt: x.reopenedAt || null, reopenedBy: x.reopenedByName || x.reopenedBy || "", reopenReason: x.reopenReason || "" };
    })
    .filter((p) => p.year && p.month >= 1 && p.month <= 12)
    .sort((a, b) => b.year - a.year || b.month - a.month);

  const now = periodOf(new Date())!;
  const isFuture = year > now.year || (year === now.year && month > now.month);
  const current = periods.find((p) => p.year === year && p.month === month);
  const prevY = month === 1 ? year - 1 : year;
  const prevM = month === 1 ? 12 : month - 1;
  const prevClosed = periods.some((p) => p.year === prevY && p.month === prevM && p.status === "closed");
  const anyClosedBefore = periods.some((p) => p.status === "closed" && (p.year < year || (p.year === year && p.month < month)));

  return {
    period: { year, month, label: `${THAI_MONTHS[month - 1]} ${year + 543}` },
    status: current?.status === "closed" ? "closed" : "open",
    isFuture,
    drafts: drafts.sort((a, b) => a.date.localeCompare(b.date)),
    unbalanced,
    posted,
    totalDebit: Math.round(totalDebit * 100) / 100,
    // เตือนเมื่อเคยปิดงวดก่อนหน้ามาแล้วแต่ข้ามเดือนก่อนหน้า (ไม่บังคับ)
    previousOpen: anyClosedBefore && !prevClosed ? { year: prevY, month: prevM, label: `${THAI_MONTHS[prevM - 1]} ${prevY + 543}` } : null,
    periods,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = String(url.searchParams.get("companyId") || "");
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "finance:view") && !can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const { year, month } = parsePeriod(url.searchParams.get("year"), url.searchParams.get("month"));
    return NextResponse.json({ success: true, ...(await inspect(companyId, year, month)) });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PERIOD_CLOSE_GET_ERROR]", err);
    return NextResponse.json({ success: false, error: "ตรวจสอบงวดบัญชีไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "");
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    assertCanClose(apiUser.role);
    const { year, month, label } = parsePeriod(body.year, body.month);

    const r = await inspect(companyId, year, month);
    if (r.isFuture) throw new ApiAuthError(400, `งวด ${label} ยังไม่สิ้นสุด ปิดงวดไม่ได้`);
    if (r.status === "closed") throw new ApiAuthError(409, `งวด ${label} ปิดไปแล้ว`);
    if (r.drafts.length) {
      return NextResponse.json({ success: false, error: `มีรายการบัญชีรออนุมัติ ${r.drafts.length} รายการในงวด ${label} กรุณาอนุมัติหรือยกเลิกก่อนปิดงวด`, pendingItems: r.drafts }, { status: 409 });
    }
    if (r.unbalanced.length) throw new ApiAuthError(409, `มีรายการบัญชีไม่สมดุล ${r.unbalanced.length} รายการในงวด ${label}`);

    const periodId = periodIdOf(companyId, year, month);
    const data = {
      companyId,
      year: String(year),
      month: ENG_MONTHS[month - 1],
      monthThai: THAI_MONTHS[month - 1],
      periodYear: year,
      periodMonth: month,
      status: "closed",
      closedAt: new Date().toISOString(),
      closedBy: apiUser.uid,
      closedByName: apiUser.email || apiUser.uid,
      postedCount: r.posted,
      totalDebit: r.totalDebit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isDeleted: false,
    };
    await adminDb.collection("periodClosings").doc(periodId).set({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await auditServer.logCreate(apiUser.uid, companyId, "FINANCE_CLOSE", periodId, { year, month, postedCount: r.posted });

    return NextResponse.json({ success: true, message: `ปิดงวดบัญชี ${label} แล้ว`, periodId });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PERIOD_CLOSE_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "ปิดงวดบัญชีไม่สำเร็จ" }, { status: 500 });
  }
}
