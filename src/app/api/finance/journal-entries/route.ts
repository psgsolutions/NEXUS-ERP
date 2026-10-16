import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { BOOK_TYPES, findAccount } from "@/lib/chart-of-accounts";

/**
 * [API-SERVER] บันทึกบัญชีด้วยมือ (สมุดรายวัน)
 * Endpoint: POST /api/finance/journal-entries
 * body: { companyId, date (YYYY-MM-DD), bookType, description, reference?, lines: [{ accountCode, debit, credit, description? }] }
 *
 * - รหัสบัญชีต้องอยู่ในผังบัญชีของระบบ, แต่ละบรรทัดมีเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง
 * - เดบิตรวม = เครดิตรวม > 0, งวดต้องยังไม่ปิด
 * - เลขที่ใบสำคัญ (FIN) ออกใน transaction เดียวกับการบันทึก, สถานะ draft รออนุมัติลงบัญชี
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับการบันทึกบัญชี");

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : "";
    const bookType = BOOK_TYPES.some((b) => b.code === body.bookType) ? body.bookType : "JV";
    const description = str(body.description, 500);
    if (!date) throw new ApiAuthError(400, "กรุณาระบุวันที่");
    if (!description) throw new ApiAuthError(400, "กรุณาระบุคำอธิบายรายการ");

    const rawLines: any[] = Array.isArray(body.lines) ? body.lines : [];
    const lines = rawLines
      .map((l, i) => {
        const debit = round2(Math.max(0, Number(l.debit) || 0));
        const credit = round2(Math.max(0, Number(l.credit) || 0));
        return { i, accountCode: str(l.accountCode, 20), debit, credit, description: str(l.description, 300) };
      })
      .filter((l) => l.accountCode || l.debit || l.credit);
    if (lines.length < 2) throw new ApiAuthError(400, "ต้องมีรายการบัญชีอย่างน้อย 2 บรรทัด");
    const items = lines.map((l, n) => {
      const acct = findAccount(l.accountCode);
      if (!acct) throw new ApiAuthError(400, `บรรทัดที่ ${n + 1}: ไม่พบรหัสบัญชี ${l.accountCode || "(ว่าง)"} ในผังบัญชี`);
      if ((l.debit > 0) === (l.credit > 0)) throw new ApiAuthError(400, `บรรทัดที่ ${n + 1}: ต้องระบุเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง`);
      return { accountCode: acct.code, accountName: acct.name, debit: l.debit, credit: l.credit, ...(l.description ? { description: l.description } : {}) };
    });
    const totalDebit = round2(items.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(items.reduce((s, l) => s + l.credit, 0));
    if (totalDebit <= 0) throw new ApiAuthError(400, "ยอดรวมต้องมากกว่า 0");
    if (Math.abs(totalDebit - totalCredit) > 0.001) throw new ApiAuthError(400, `ยอดเดบิต (${totalDebit.toLocaleString("th-TH")}) ไม่เท่ากับเครดิต (${totalCredit.toLocaleString("th-TH")})`);

    await assertPeriodOpen(companyId, date);

    const take = await prepareSequence("FIN", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const journalNo = await adminDb.runTransaction(async (tx) => {
      const seq = await take(tx);
      const ref = adminDb.doc(`companies/${companyId}/journal_entries/${seq.number}`);
      seq.commit();
      tx.create(ref, {
        companyId,
        journalNo: seq.number,
        jvId: seq.number,
        date,
        bookType,
        description,
        reference: str(body.reference, 120),
        items,
        totalDebit,
        totalCredit,
        source: "manual",
        status: "draft",
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      });
      return seq.number;
    });

    await auditServer.logCreate(apiUser.uid, companyId, "FINANCE_JOURNAL", journalNo, { date, bookType, totalDebit });
    return NextResponse.json({ success: true, journalNo, path: `companies/${companyId}/journal_entries/${journalNo}` });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[JOURNAL_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกบัญชีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
