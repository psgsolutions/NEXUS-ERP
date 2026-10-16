import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { bankBook, matchStatement, type BankAccount, type StatementRow } from "@/lib/subledgers";
import { monthEnd } from "@/lib/financial-reports";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] กระทบยอดเงินฝากธนาคารกับ statement (นำเข้า CSV ที่หน้าจอ)
 * Endpoint: POST /api/finance/bank-reconcile
 *  - { companyId, action: "match", bookId, month, rows: [{date, description, amount}] }  -> จับคู่อัตโนมัติ
 *  - { companyId, action: "save", bookId, month, rows, matches: [{bookKey,rowIndex}], statementClosing } -> บันทึกผล
 *  - { companyId, action: "get", bookId, month } -> ผลที่บันทึกไว้
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;

function cleanRows(raw: any): StatementRow[] {
  const rows = (Array.isArray(raw) ? raw : []).slice(0, 2000).map((r: any) => ({
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(r?.date || "")) ? String(r.date) : "",
    description: str(r?.description, 200),
    amount: r2(Number(r?.amount) || 0),
  }));
  if (rows.some((r) => !r.date || !r.amount)) throw new ApiAuthError(400, "ข้อมูล statement ไม่ครบ (ต้องมีวันที่และจำนวนเงินทุกแถว)");
  return rows;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:view")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const action = str(body.action, 20);
    const bookId = str(body.bookId, 120);
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.month || "")) ? String(body.month) : "";
    if (!bookId || bookId.includes("/") || !month) throw new ApiAuthError(400, "กรุณาเลือกบัญชีและเดือน");
    const recRef = adminDb.doc(`companies/${companyId}/bank_reconciliations/${bookId}_${month}`);

    if (action === "get") {
      const snap = await recRef.get();
      return NextResponse.json({ success: true, saved: snap.exists ? snap.data() : null });
    }

    const col = (c: string) => adminDb.collection(`companies/${companyId}/${c}`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    const [accountsRaw, receipts, payments, refunds] = await Promise.all([col("bank_accounts"), col("receipts"), col("payments"), col("customer_refunds")]);
    const accounts: BankAccount[] = accountsRaw.filter((a) => a.isDeleted !== true).map((a) => ({ id: a.id, name: a.name, accountNo: a.accountNo, openingBalance: a.openingBalance, openingDate: a.openingDate, legacyLabels: a.legacyLabels }));
    const book = bankBook(bookId, accounts, { receipts, payments, refunds }, `${month}-01`, monthEnd(month));
    const rows = cleanRows(body.rows);

    if (action === "match") {
      return NextResponse.json({ success: true, book, rows, ...matchStatement(book.entries, rows) });
    }

    if (action === "save") {
      if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "บันทึกการกระทบยอดได้เฉพาะฝ่ายบัญชี");
      const keys = new Set(book.entries.map((e) => e.key));
      const matches = (Array.isArray(body.matches) ? body.matches : []).map((m: any) => ({ bookKey: str(m?.bookKey), rowIndex: Number(m?.rowIndex) }))
        .filter((m: any) => keys.has(m.bookKey) && Number.isInteger(m.rowIndex) && m.rowIndex >= 0 && m.rowIndex < rows.length);
      const usedB = new Set(matches.map((m: any) => m.bookKey)), usedR = new Set(matches.map((m: any) => m.rowIndex));
      if (usedB.size !== matches.length || usedR.size !== matches.length) throw new ApiAuthError(400, "จับคู่ซ้ำ: แต่ละรายการจับคู่ได้ครั้งเดียว");
      const statementClosing = r2(Number(body.statementClosing) || 0);
      const outstandingBook = book.entries.filter((e) => !usedB.has(e.key));
      const unrecordedRows = rows.filter((_, i) => !usedR.has(i));
      // ยอดตามสมุด ปรับด้วยรายการที่ธนาคารยังไม่ผ่าน และรายการในธนาคารที่ยังไม่บันทึก -> ควรเท่ายอด statement
      const adjusted = r2(book.closing - outstandingBook.reduce((s, e) => s + e.inAmount - e.outAmount, 0) + unrecordedRows.reduce((s, r) => s + r.amount, 0));
      const doc = {
        companyId, bookId, month, rows, matches, statementClosing,
        bookClosing: book.closing, adjustedBookBalance: adjusted, difference: r2(statementClosing - adjusted),
        outstandingCount: outstandingBook.length, unrecordedCount: unrecordedRows.length,
        reconciledBy: apiUser.uid, reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await recRef.set(doc);
      await auditServer.logUpdate(apiUser.uid, companyId, "BANK_RECONCILIATION", `${bookId}_${month}`, null, { matched: matches.length, difference: doc.difference });
      return NextResponse.json({ success: true, ...doc, reconciledAt: new Date().toISOString() });
    }
    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[BANK_RECONCILE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "กระทบยอดไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
