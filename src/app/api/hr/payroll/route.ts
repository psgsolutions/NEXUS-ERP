import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { voidOrReverseJournal } from "@/lib/journal-reversal.server";
import { auditServer } from "@/services/audit.server";
import { employeeName } from "@/lib/hr";
import { computeLine, payrollTotals, periodEnd, periodLabel, type PayrollInput } from "@/lib/payroll";

/**
 * [API-SERVER] เงินเดือนประจำงวด (หนึ่งเอกสารต่อเดือน: companies/{c}/payrolls/{YYYY-MM})
 * Endpoint: POST /api/hr/payroll  { companyId, period: "YYYY-MM", action, ... }
 *  - save    { lines: PayrollInput[] }  บันทึกร่าง (คำนวณใหม่จากข้อมูลพนักงานในระบบเสมอ)
 *  - approve                            ตั้งค่าใช้จ่ายเงินเดือน ลงวันสิ้นงวด:
 *        Dr 5211 เงินเดือน (รวมเงินได้)  Dr 5212 ประกันสังคมส่วนนายจ้าง
 *        Cr 2133 ประกันสังคมค้างจ่าย (ลูกจ้าง+นายจ้าง)  Cr 2131 ภาษีหัก ณ ที่จ่าย ภ.ง.ด.1
 *        Cr 1132 ลูกหนี้อื่น (รายการหักอื่น)  Cr 2142 เงินเดือนค้างจ่าย (ยอดสุทธิ)
 *  - pay     { payDate, bankAccount }   จ่ายเงินเดือน: Dr 2142 / Cr 1112 เงินฝากธนาคาร
 *  - cancel  { reason }                 ยกเลิกงวดที่ยังไม่จ่าย (ยกเลิก/กลับรายการบัญชีตั้งค่าใช้จ่าย)
 * รายการบัญชีที่สร้างเป็น draft รออนุมัติลงบัญชีเหมือนเอกสารอื่น
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "hr:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับเงินเดือน");
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.period || "")) ? body.period : "";
    if (!period) throw new ApiAuthError(400, "งวดเงินเดือนไม่ถูกต้อง");
    const action = String(body.action || "");
    const ref = adminDb.doc(`companies/${companyId}/payrolls/${period}`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const label = periodLabel(period);

    if (action === "save") {
      const inputs: PayrollInput[] = (Array.isArray(body.lines) ? body.lines : []).slice(0, 500);
      if (!inputs.length) throw new ApiAuthError(400, "ไม่มีพนักงานในงวดนี้");
      const ids = Array.from(new Set(inputs.map((l) => str(l.employeeDocId, 120)).filter(Boolean)));
      if (ids.length !== inputs.length) throw new ApiAuthError(400, "รายชื่อพนักงานซ้ำหรือไม่ครบ");
      const result = await adminDb.runTransaction(async (tx) => {
        const cur = await tx.get(ref);
        if (cur.exists && !["draft", "cancelled"].includes(cur.data()!.status)) throw new ApiAuthError(409, `งวด ${label} อนุมัติแล้ว แก้ไขไม่ได้`);
        const emps = await tx.getAll(...ids.map((id) => adminDb.doc(`employees/${id}`)));
        const lines = emps.map((s, i) => {
          const e = s.exists ? s.data()! : null;
          if (!e || e.companyId !== companyId) throw new ApiAuthError(404, `ไม่พบพนักงาน ${ids[i]}`);
          return computeLine(e, { ...inputs.find((l) => l.employeeDocId === ids[i])!, employeeDocId: ids[i] }, employeeName);
        });
        const totals = payrollTotals(lines);
        tx.set(ref, {
          companyId, period, periodLabel: label, status: "draft",
          lines, employeeCount: lines.length,
          totalGross: totals.gross, totalSso: totals.sso, totalEmployerSso: totals.employerSso, totalWht: totals.wht, totalOtherDeduction: totals.otherDeduction, totalNet: totals.net,
          updatedBy: apiUser.uid, updatedAt: now,
          ...(cur.exists ? {} : { createdBy: apiUser.uid, createdAt: now }),
          isDeleted: false,
        }, { merge: false });
        return { totals, count: lines.length };
      });
      return NextResponse.json({ success: true, period, ...result });
    }

    // ขั้นตอนบัญชีต้องมีสิทธิ์การเงินด้วย
    if (!can(apiUser.role, "finance:edit")) throw new ApiAuthError(403, "การอนุมัติและจ่ายเงินเดือนต้องมีสิทธิ์ฝ่ายบัญชี");

    if (action === "approve") {
      const date = periodEnd(period);
      await assertPeriodOpen(companyId, date);
      const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, `ยังไม่ได้บันทึกเงินเดือนงวด ${label}`);
        const p = snap.data()!;
        if (p.status !== "draft") throw new ApiAuthError(409, `งวด ${label} ไม่ได้อยู่ในสถานะร่าง`);
        if (!(p.totalGross > 0)) throw new ApiAuthError(400, "ยอดเงินเดือนเป็นศูนย์");
        if (p.lines.some((l: any) => l.net < 0)) throw new ApiAuthError(400, "มีพนักงานที่ยอดสุทธิติดลบ กรุณาตรวจสอบรายการหัก");
        const items = [
          { accountCode: "5211-00", accountName: "เงินเดือนและค่าจ้าง", debit: r2(p.totalGross), credit: 0 },
          ...(p.totalEmployerSso > 0 ? [{ accountCode: "5212-00", accountName: "ประกันสังคม", debit: r2(p.totalEmployerSso), credit: 0 }] : []),
          ...(p.totalSso + p.totalEmployerSso > 0 ? [{ accountCode: "2133-00", accountName: "เงินประกันสังคมค้างจ่าย", debit: 0, credit: r2(p.totalSso + p.totalEmployerSso) }] : []),
          ...(p.totalWht > 0 ? [{ accountCode: "2131-00", accountName: "ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.1)", debit: 0, credit: r2(p.totalWht) }] : []),
          ...(p.totalOtherDeduction > 0 ? [{ accountCode: "1132-00", accountName: "ลูกหนี้อื่น", debit: 0, credit: r2(p.totalOtherDeduction) }] : []),
          { accountCode: "2142-00", accountName: "เงินเดือนค้างจ่าย", debit: 0, credit: r2(p.totalNet) },
        ];
        const dr = r2(items.reduce((s, l) => s + l.debit, 0));
        const cr = r2(items.reduce((s, l) => s + l.credit, 0));
        if (Math.abs(dr - cr) > 0.01) throw new Error(`บัญชีไม่สมดุล ${dr}/${cr}`);
        tx.set(journalRef, {
          companyId, date, bookType: "JV",
          description: `[AUTO] ตั้งค่าใช้จ่ายเงินเดือนงวด ${label} (${p.employeeCount} คน)`,
          reference: `PAYROLL-${period}`, items, totalDebit: dr, totalCredit: cr,
          status: "draft", createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        tx.update(ref, { status: "approved", approvedBy: apiUser.uid, approvedAt: now, accrualJournalId: journalRef.id, updatedAt: now });
        return { journalId: journalRef.id, total: p.totalNet };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "HR_PAYROLL", period, { status: "draft" }, { status: "approved", totalNet: result.total });
      return NextResponse.json({ success: true, period, ...result });
    }

    if (action === "pay") {
      const payDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.payDate || "")) ? body.payDate : todayBkk();
      const bankAccount = str(body.bankAccount, 120);
      if (!bankAccount) throw new ApiAuthError(400, "กรุณาระบุบัญชีธนาคารที่จ่าย");
      await assertPeriodOpen(companyId, payDate);
      const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const p = snap.exists ? snap.data()! : null;
        if (!p || p.status !== "approved") throw new ApiAuthError(409, `งวด ${label} ต้องอนุมัติก่อนจ่าย`);
        const net = r2(p.totalNet);
        tx.set(journalRef, {
          companyId, date: payDate, bookType: "PV",
          description: `[AUTO] จ่ายเงินเดือนงวด ${label} ผ่าน ${bankAccount}`,
          reference: `PAYROLL-${period}`,
          items: [
            { accountCode: "2142-00", accountName: "เงินเดือนค้างจ่าย", debit: net, credit: 0 },
            { accountCode: "1112-00", accountName: "เงินฝากธนาคาร", debit: 0, credit: net },
          ],
          totalDebit: net, totalCredit: net,
          status: "draft", createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        tx.update(ref, { status: "paid", payDate, payBankAccount: bankAccount, paidBy: apiUser.uid, paidAt: now, paymentJournalId: journalRef.id, updatedAt: now });
        return { journalId: journalRef.id, total: net };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "HR_PAYROLL", period, { status: "approved" }, { status: "paid", payDate });
      return NextResponse.json({ success: true, period, ...result });
    }

    if (action === "cancel") {
      const reason = str(body.reason, 300);
      if (!reason) throw new ApiAuthError(400, "กรุณาระบุเหตุผลการยกเลิก");
      const cancelDate = todayBkk();
      await assertPeriodOpen(companyId, cancelDate);
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const p = snap.exists ? snap.data()! : null;
        if (!p) throw new ApiAuthError(404, `ไม่พบเงินเดือนงวด ${label}`);
        if (p.status === "paid") throw new ApiAuthError(409, "จ่ายเงินเดือนแล้ว ยกเลิกไม่ได้");
        if (p.status === "cancelled") throw new ApiAuthError(409, "ยกเลิกไปแล้ว");
        const jSnap = p.accrualJournalId ? await tx.get(adminDb.doc(`companies/${companyId}/journal_entries/${p.accrualJournalId}`)) : null;
        const j = voidOrReverseJournal(tx, companyId, jSnap, { date: cancelDate, description: `[AUTO] ยกเลิกเงินเดือนงวด ${label}: ${reason}`, reference: `PAYROLL-${period}`, uid: apiUser.uid, reason });
        tx.update(ref, { status: "cancelled", cancelReason: reason, cancelledBy: apiUser.uid, cancelledAt: now, journalAction: j.mode, ...(j.reversalId ? { reversalJournalId: j.reversalId } : {}), updatedAt: now });
        return { journal: j.mode };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "HR_PAYROLL", period, {}, { status: "cancelled", reason });
      return NextResponse.json({ success: true, period, ...result });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[HR_PAYROLL_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ดำเนินการเงินเดือนไม่สำเร็จ" }, { status: 500 });
  }
}
