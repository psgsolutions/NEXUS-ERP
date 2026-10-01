import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { db } from "@/lib/firebase-client";
import { doc, getDoc, updateDoc, collection, setDoc, serverTimestamp } from "firebase/firestore";
import { auditService } from "@/services/audit.service";
import { assertPeriodOpen } from "@/lib/period-close-service";

/**
 * [API-SERVER] Work In Progress (WIP) Site Expense & GL Posting API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/projects/wip-expense
 */

export const ACCOUNTS_WIP = {
  WIP_ASSET: { code: "114100", name: "งานระหว่างก่อสร้าง (WIP Asset)" },
  CASH: { code: "111100", name: "เงินสด" },
  BANK: { code: "111200", name: "เงินฝากธนาคาร" },
  ACCOUNTS_PAYABLE: { code: "211100", name: "เจ้าหนี้การค้า" }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      companyId, 
      projectId, 
      amount, 
      paymentMethod = "cash", 
      note = "", 
      receiptUrl = ""
    } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;

    // 1. Validations
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] projectId is required!" },
        { status: 400 }
      );
    }
    const expenseAmount = Number(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] Expense amount must be greater than 0!" },
        { status: 400 }
      );
    }

    const postingDate = new Date().toISOString();

    // 2. Period Lock Check
    await assertPeriodOpen(companyId, postingDate);

    // 3. Determine Credit Account based on Payment Method
    let creditAccount = ACCOUNTS_WIP.CASH;
    if (paymentMethod === "ap") {
      creditAccount = ACCOUNTS_WIP.ACCOUNTS_PAYABLE;
    } else if (paymentMethod === "bank") {
      creditAccount = ACCOUNTS_WIP.BANK;
    }

    // 4. Construct Balanced Double-Entry Journal Lines (Debit = Credit)
    const journalLines = [
      {
        accountCode: ACCOUNTS_WIP.WIP_ASSET.code,
        accountName: ACCOUNTS_WIP.WIP_ASSET.name,
        debit: expenseAmount,
        credit: 0,
        description: `ต้นทุน WIP โครงการ: ${projectId}`
      },
      {
        accountCode: creditAccount.code,
        accountName: creditAccount.name,
        debit: 0,
        credit: expenseAmount,
        description: `ชำระโดย: ${creditAccount.name}`
      }
    ];

    // Double-check Debit === Credit
    const totalDebit = journalLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = journalLines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`[GL Violation] Debit (${totalDebit}) does not equal Credit (${totalCredit})`);
    }

    // Save Journal Entry (Server-Side)
    const journalDocRef = doc(collection(db, `companies/${companyId}/journal_entries`));
    const journalData = {
      companyId,
      projectId,
      date: postingDate,
      bookType: "JV",
      description: `[WIP ASSET] บันทึกต้นทุนงานระหว่างก่อสร้าง โครงการ: ${projectId}${note ? ' (' + note + ')' : ''}`,
      reference: `WIP-${projectId}-${Date.now().toString().slice(-4)}`,
      receiptUrl,
      lines: journalLines,
      totalDebit,
      totalCredit,
      status: "posted",
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false,
      createdAt: postingDate,
      updatedAt: postingDate
    };
    await setDoc(journalDocRef, journalData);

    // 5. Update Project.actualCost and WIP Accumulation in Firestore
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);

    let oldActualCost = 0;
    let oldWipValue = 0;

    if (projectSnap.exists()) {
      const pData = projectSnap.data();
      oldActualCost = pData.actualCost || pData.budgetSummary?.actualCost || 0;
      oldWipValue = pData.wipValue || 0;

      const newActualCost = oldActualCost + expenseAmount;
      const newWipValue = oldWipValue + expenseAmount;
      const totalBudget = pData.budget || pData.budgetSummary?.totalBudget || 0;
      const newGrossProfit = totalBudget - newActualCost;
      const newGpPercent = totalBudget > 0 ? (newGrossProfit / totalBudget) * 100 : 0;

      await updateDoc(projectRef, {
        actualCost: newActualCost,
        wipValue: newWipValue,
        grossProfit: newGrossProfit,
        gpPercent: Number(newGpPercent.toFixed(2)),
        updatedAt: serverTimestamp(),
        updatedBy: userId
      });

      // Audit Log Activity
      await auditService.logUpdate(
        userId,
        companyId,
        "PROJECT_WIP",
        projectId,
        { actualCost: oldActualCost, wipValue: oldWipValue },
        { actualCost: newActualCost, wipValue: newWipValue, journalId: journalDocRef.id }
      );
    }

    return NextResponse.json({
      success: true,
      journalId: journalDocRef.id,
      projectId,
      postedAmount: expenseAmount,
      totalDebit,
      totalCredit,
      updatedActualCost: oldActualCost + expenseAmount
    });

  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[WIP_EXPENSE_POSTING_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to post WIP Expense" },
      { status: 500 }
    );
  }
}
