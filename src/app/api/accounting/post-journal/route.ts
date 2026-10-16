import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] Server-Side Journal Entry Posting API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/accounting/post-journal
 *
 * สร้างรายการบัญชีเป็นฉบับร่าง (draft) เสมอ — ลงบัญชีผ่าน /api/accounting/journal-post โดยผู้อื่นในฝ่ายบัญชี
 * ต้องมีสิทธิ์ finance:edit
 */

import { assertPeriodOpen } from "@/lib/period-close-service";
export { assertPeriodOpen };


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, description, reference, items, bookType = "JV", date } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;
    if (!can(apiUser.roles, "finance:edit")) {
      return NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอสำหรับการบันทึกบัญชี" }, { status: 403 });
    }

    // 1. Tenant & Field Validation
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] Journal items (lines) are required." },
        { status: 400 }
      );
    }

    // 2. Debit MUST Equal Credit Validation
    const totalDebit = items.reduce((sum: number, line: any) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = items.reduce((sum: number, line: any) => sum + (Number(line.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return NextResponse.json(
        { 
          success: false, 
          error: `[Accounting Rule Violation] Debit (฿${totalDebit}) must equal Credit (฿${totalCredit})` 
        },
        { status: 400 }
      );
    }

    // วันที่รายการเป็น YYYY-MM-DD ตามเวลาไทย (ใช้จัดเข้างวดบัญชี/ภาษี)
    const postingDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

    // 3. Period Lock Check
    await assertPeriodOpen(companyId, postingDate);

    // 4. Create Journal Entry Document (Tenant Scoped)
    const journalData = {
      companyId,
      date: postingDate,
      bookType,
      description: description || "[AUTO] General Journal Entry",
      reference: reference || "",
      // รับทั้งรูปแบบ { accountCode } , { code } (ACCOUNTS ใน financeEngine) และ { account_code }
      lines: items.map(line => ({
        accountCode: line.accountCode || line.accountId || line.code || line.account_code || "",
        accountName: line.accountName || line.name || line.account_name || "",
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || ""
      })),
      totalDebit,
      totalCredit,
      status: "draft",
      createdBy: apiUser.uid,
      createdByEmail: apiUser.email || "",
      updatedBy: userId,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to tenant subcollection & root collection
    const docRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    await docRef.set(journalData);

    // 5. Audit Log Entry
    await auditServer.logCreate(
      userId,
      companyId,
      "FINANCE_GL",
      docRef.id,
      journalData
    );

    return NextResponse.json({
      success: true,
      journalId: docRef.id,
      totalDebit,
      totalCredit
    });

  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[POST_JOURNAL_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to post Journal Entry" },
      { status: 500 }
    );
  }
}
