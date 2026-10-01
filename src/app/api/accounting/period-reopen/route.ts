import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { auditServer } from "@/services/audit.server";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const ENG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function parseYearMonth(yearInput: any, monthInput: any): { targetYear: number; targetMonthNum: number; monthNameEn: string; monthNameTh: string } {
  const targetYear = Number(yearInput) || new Date().getFullYear();
  let targetMonthNum = 1;

  if (typeof monthInput === "number") {
    targetMonthNum = monthInput;
  } else if (typeof monthInput === "string") {
    const engIdx = ENG_MONTHS.findIndex(m => m.toLowerCase() === monthInput.trim().toLowerCase());
    const thaiIdx = THAI_MONTHS.findIndex(m => m === monthInput.trim());
    if (engIdx !== -1) {
      targetMonthNum = engIdx + 1;
    } else if (thaiIdx !== -1) {
      targetMonthNum = thaiIdx + 1;
    } else {
      const parsed = parseInt(monthInput, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
        targetMonthNum = parsed;
      }
    }
  }

  return {
    targetYear,
    targetMonthNum,
    monthNameEn: ENG_MONTHS[targetMonthNum - 1] || "January",
    monthNameTh: THAI_MONTHS[targetMonthNum - 1] || "มกราคม"
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, year, month, reopenReason } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userRole = apiUser.role;
    const userId = apiUser.email || apiUser.uid;

    // 1. Tenant & Field Validation
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }
    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] year and month are required!" },
        { status: 400 }
      );
    }

    // 2. Strict Role-Based Access Control: SUPERADMIN ONLY
    if (userRole?.toUpperCase() !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "เฉพาะ SUPERADMIN เท่านั้นที่สามารถปลดล็อกงวดบัญชีได้" },
        { status: 403 }
      );
    }

    // 3. Mandate Reopen Reason
    if (!reopenReason || typeof reopenReason !== "string" || !reopenReason.trim()) {
      return NextResponse.json(
        { success: false, error: "ต้องระบุเหตุผลในการปลดล็อกปิดงวดบัญชี" },
        { status: 400 }
      );
    }

    const { targetYear, targetMonthNum, monthNameEn, monthNameTh } = parseYearMonth(year, month);
    const periodDocId = `${companyId}_${targetYear}_${String(targetMonthNum).padStart(2, "0")}`;
    const closeRef = adminDb.collection("periodClosings").doc(periodDocId);

    const updateData = {
      companyId,
      year: String(targetYear),
      month: monthNameEn,
      monthThai: monthNameTh,
      periodYear: targetYear,
      periodMonth: targetMonthNum,
      status: "open",
      reopenedAt: new Date().toISOString(),
      reopenedBy: userId,
      reopenReason: reopenReason.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isDeleted: false
    };

    await closeRef.set(updateData, { merge: true });

    // 4. Audit Log Entry
    await auditServer.logUpdate(
      userId,
      companyId,
      "FINANCE_PERIOD_REOPEN",
      periodDocId,
      { status: "closed" },
      updateData
    );

    return NextResponse.json({
      success: true,
      message: `ปลดล็อกงวดบัญชี ${monthNameTh} ${targetYear} สำเร็จ`,
      periodId: periodDocId
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PERIOD_REOPEN_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "เกิดข้อผิดพลาดในการปลดล็อกงวดบัญชี" },
      { status: 500 }
    );
  }
}
