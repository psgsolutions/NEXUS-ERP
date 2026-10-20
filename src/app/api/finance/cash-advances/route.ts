import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canAny } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { ADVANCE_ACCOUNT, CASH_ACCOUNTS, clearingJournal, normalizeClearItems } from "@/lib/cash-advance";
import { EXPENSE_ACCOUNTS } from "@/lib/payables";

/**
 * [API-SERVER] เงินทดรองจ่าย (companies/{c}/cash_advances/{ADV...})
 * Endpoint: POST /api/finance/cash-advances
 *  - { action: "request", amount, purpose, projectId?, neededDate? }          ขอเบิก (วิศวกร/พนักงานที่ทำงานหน้างาน)
 *  - { action: "pay", id, method: CASH|TRANSFER, paymentDate }                 แอดมินจ่ายเงิน: Dr เงินทดรองจ่าย / Cr เงินสด-ธนาคาร (ร่าง)
 *  - { action: "reject", id, reason }                                          แอดมินไม่อนุมัติ (ยังไม่จ่าย)
 *  - { action: "clear", id, items: [{ description, amount, vat, taxInvoiceNo? }], method, clearDate }
 *        ผู้เบิกหรือแอดมินเคลียร์: Dr ค่าใช้จ่าย/งานระหว่างทำของโครงการ + ภาษีซื้อ / Cr เงินทดรองจ่าย ± ส่วนต่างเงินสด (ร่าง)
 * เลข ADV ออกในทรานแซกชัน, รายการบัญชีเป็นร่างรอฝ่ายบัญชีอนุมัติ, งวดที่ปิดแล้วบันทึกไม่ได้
 */

const REQUESTERS = ["finance:edit", "projects:edit", "inventory:edit", "sales:edit", "hr:edit"] as const;
const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const base = `companies/${companyId}`;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const finance = can(apiUser.roles, "finance:edit");

    if (action === "request") {
      if (!canAny(apiUser.roles, [...REQUESTERS])) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const amount = r2(Number(body.amount) || 0);
      const purpose = str(body.purpose, 500);
      if (!(amount > 0) || amount > 1_000_000) throw new ApiAuthError(400, "ระบุจำนวนเงินที่ขอเบิก");
      if (!purpose) throw new ApiAuthError(400, "ระบุว่าจะนำไปใช้ทำอะไร");
      const projectId = str(body.projectId, 120);
      const project = projectId && !projectId.includes("/") ? await adminDb.doc(`${base}/projects/${projectId}`).get() : null;
      if (projectId && !project?.exists) throw new ApiAuthError(400, "ไม่พบโครงการที่เลือก");
      const take = await prepareSequence("ADV", companyId);
      const no = await adminDb.runTransaction(async (tx) => {
        const seq = await take(tx);
        seq.commit();
        tx.create(adminDb.doc(`${base}/cash_advances/${seq.number}`), {
          companyId, advanceNo: seq.number, amount, purpose, status: "REQUESTED",
          neededDate: isDate(body.neededDate) ? body.neededDate : todayBkk(),
          projectId: project ? projectId : "", projectName: project ? str(project.data()?.projectName || project.data()?.name, 200) : "",
          requesterUid: apiUser.uid, requesterName: str(body.requesterName || apiUser.email || apiUser.uid, 120),
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        return seq.number;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "CASH_ADVANCE", no, { amount, projectId });
      return NextResponse.json({ success: true, advanceNo: no });
    }

    const id = str(body.id, 60);
    if (!id || id.includes("/")) throw new ApiAuthError(400, "ไม่พบรายการเงินทดรอง");
    const ref = adminDb.doc(`${base}/cash_advances/${id}`);

    if (action === "pay" || action === "reject") {
      if (!finance) throw new ApiAuthError(403, "จ่ายเงินทดรองได้เฉพาะฝ่ายการเงิน");
      const method = body.method === "TRANSFER" ? "TRANSFER" : "CASH";
      const date = isDate(body.paymentDate) ? body.paymentDate : todayBkk();
      if (action === "pay") await assertPeriodOpen(companyId, date);
      const journalRef = adminDb.collection(`${base}/journal_entries`).doc();
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบรายการเงินทดรอง");
        const a = snap.data()!;
        if (a.status !== "REQUESTED") throw new ApiAuthError(409, `${id} ไม่ได้อยู่ในสถานะรอจ่ายเงิน`);
        if (action === "reject") {
          tx.update(ref, { status: "REJECTED", rejectReason: str(body.reason, 300), rejectedBy: apiUser.uid, updatedAt: now });
          return { status: "REJECTED" };
        }
        const cash = CASH_ACCOUNTS[method];
        tx.update(ref, { status: "PAID", paidAmount: a.amount, paidDate: date, paidMethod: method, paidBy: apiUser.uid, payJournalId: journalRef.id, updatedAt: now });
        tx.set(journalRef, {
          companyId, date, bookType: "PV", status: "draft", reference: id, projectId: a.projectId || "",
          description: `[AUTO] จ่ายเงินทดรอง ${id} ให้ ${a.requesterName} · ${a.purpose}`,
          items: [
            { accountCode: ADVANCE_ACCOUNT.code, accountName: ADVANCE_ACCOUNT.name, debit: a.amount, credit: 0 },
            { accountCode: cash.code, accountName: cash.name, debit: 0, credit: a.amount },
          ],
          totalDebit: a.amount, totalCredit: a.amount, createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        return { status: "PAID" };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "CASH_ADVANCE", id, { status: "REQUESTED" }, result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "clear") {
      const items = normalizeClearItems(body.items);
      if (!items.length) throw new ApiAuthError(400, "เพิ่มรายการใบเสร็จอย่างน้อย 1 รายการ");
      const method = body.method === "TRANSFER" ? "TRANSFER" : "CASH";
      const date = isDate(body.clearDate) ? body.clearDate : todayBkk();
      await assertPeriodOpen(companyId, date);
      const journalRef = adminDb.collection(`${base}/journal_entries`).doc();
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบรายการเงินทดรอง");
        const a = snap.data()!;
        if (a.requesterUid !== apiUser.uid && !finance) throw new ApiAuthError(403, "เคลียร์ได้เฉพาะผู้เบิกหรือฝ่ายการเงิน");
        if (a.status !== "PAID") throw new ApiAuthError(409, `${id} ยังไม่ได้จ่ายเงิน หรือเคลียร์ไปแล้ว`);
        // ของโครงการ -> งานระหว่างทำ (นับเป็นต้นทุนจริงของโครงการ), ทั่วไป -> ค่าใช้จ่ายเบ็ดเตล็ด
        const expense = a.projectId ? { code: "1161-00", name: "งานระหว่างทำ (WIP)" } : EXPENSE_ACCOUNTS[0];
        const j = clearingJournal(Number(a.paidAmount ?? a.amount) || 0, items, expense, method);
        if (!j.balanced) throw new Error(`บัญชีไม่สมดุล ${j.totalDebit}/${j.totalCredit}`);
        tx.update(ref, { status: "CLEARED", clearItems: items, spent: j.spent, vat: j.vat, difference: j.diff, clearDate: date, clearMethod: method, clearedBy: apiUser.uid, clearJournalId: journalRef.id, updatedAt: now });
        tx.set(journalRef, {
          companyId, date, bookType: "JV", status: "draft", reference: id, projectId: a.projectId || "",
          description: `[AUTO] เคลียร์เงินทดรอง ${id} (${a.requesterName})${j.diff > 0 ? ` คืนเงิน ${j.diff}` : j.diff < 0 ? ` จ่ายเพิ่ม ${-j.diff}` : ""}`,
          items: j.lines, totalDebit: j.totalDebit, totalCredit: j.totalCredit,
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        return { status: "CLEARED", spent: j.spent, difference: j.diff };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "CASH_ADVANCE", id, { status: "PAID" }, result);
      return NextResponse.json({ success: true, ...result });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[CASH_ADVANCE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกเงินทดรองไม่สำเร็จ" }, { status: 500 });
  }
}
