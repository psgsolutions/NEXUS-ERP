import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { db } from "@/lib/firebase-client";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { can } from "@/lib/permissions";
import { auditService } from "@/services/audit.service";

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
    const { companyId, year, month } = body;
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

    // 2. Role-Based Access Control (RBAC)
    // Only ADMIN, SUPERADMIN, or ACCOUNTANT allowed
    const isAllowedRole =
      userRole?.toUpperCase() === "SUPERADMIN" ||
      userRole?.toUpperCase() === "ADMIN" ||
      userRole?.toUpperCase() === "ACCOUNTANT" ||
      can(userRole, "finance:edit");

    if (!isAllowedRole) {
      return NextResponse.json(
        { success: false, error: "ไม่มีสิทธิ์ในการปิดงวดบัญชี (ต้องการสิทธิ์ ADMIN, SUPERADMIN หรือ ACCOUNTANT)" },
        { status: 403 }
      );
    }

    const { targetYear, targetMonthNum, monthNameEn, monthNameTh } = parseYearMonth(year, month);

    // 3. Pre-Close Check: Reject if there are draft journal entries in this month
    let draftEntries: any[] = [];
    try {
      const q = query(
        collection(db, `companies/${companyId}/journal_entries`),
        where("status", "==", "draft")
      );
      const snap = await getDocs(q);
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const rawDate = data.date || data.createdAt;
        if (!rawDate) return;
        const d = new Date(rawDate.seconds ? rawDate.seconds * 1000 : rawDate);
        if (d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonthNum) {
          draftEntries.push({
            id: docSnap.id,
            description: data.description || "Unposted Journal Entry",
            date: d.toISOString().split("T")[0]
          });
        }
      });
    } catch {
      // Ignore query error if subcollection is empty
    }

    if (draftEntries.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `มีรายการรอดำเนินการ (Draft) ค้างอยู่ ${draftEntries.length} รายการในงวด ${monthNameTh} ${targetYear} ไม่สามารถปิดงวดบัญชีได้`,
          pendingItems: draftEntries
        },
        { status: 400 }
      );
    }

    // 4. Save/Update Period Close Record
    const periodDocId = `${companyId}_${targetYear}_${String(targetMonthNum).padStart(2, "0")}`;
    const closeRef = doc(collection(db, "periodClosings"), periodDocId);

    const periodData = {
      companyId,
      year: String(targetYear),
      month: monthNameEn,
      monthThai: monthNameTh,
      periodYear: targetYear,
      periodMonth: targetMonthNum,
      status: "closed",
      closedAt: new Date().toISOString(),
      closedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false
    };

    await setDoc(closeRef, periodData, { merge: true });

    // 5. Write Audit Log
    await auditService.logCreate(
      userId,
      companyId,
      "FINANCE_CLOSE",
      periodDocId,
      periodData
    );

    return NextResponse.json({
      success: true,
      message: `ปิดงวดบัญชี ${monthNameTh} ${targetYear} สำเร็จและล็อกข้อมูลแล้ว`,
      periodId: periodDocId
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PERIOD_CLOSE_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "เกิดข้อผิดพลาดในการปิดงวดบัญชี" },
      { status: 500 }
    );
  }
}
