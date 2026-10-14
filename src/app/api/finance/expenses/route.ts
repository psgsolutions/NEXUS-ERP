import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { EXPENSE_ACCOUNTS } from "@/lib/payables";

/**
 * [API-SERVER] ตั้งค่าใช้จ่ายรอจ่าย (companies/{id}/expenses) — จ่ายจริงผ่าน /api/finance/payments
 * Endpoint: POST /api/finance/expenses
 *  - { action: "claim", employeeId, expenseAccountCode, description, hasVat, subtotal }      เบิกพนักงาน
 *  - { action: "fromPO", poId }                                                              ตั้งเบิกจากใบสั่งซื้อที่อนุมัติแล้ว (ครั้งเดียว)
 *  - { action: "subcontract", soId, soCode, subcontractorName, subcontractorTaxId, remarks, items: [{ description, payoutAmount }] }
 *                                                                                            ค่าแรงช่าง/ผู้รับเหมาช่วง (หัก ณ ที่จ่าย 3% ตอนจ่าย)
 * เลข EXP ออกในทรานแซกชันเดียวกับการบันทึก (ไม่ข้าม); ยอดคำนวณที่ server
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const base = { companyId, createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, updatedAt: now, isDeleted: false, status: "Awaiting Payment" };
    const take = await prepareSequence("EXP", companyId);

    if (action === "claim") {
      if (!["finance:edit", "projects:edit", "inventory:edit", "sales:edit", "hr:edit"].some((p) => can(apiUser.role, p as any))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const subtotal = r2(Math.max(0, Number(body.subtotal) || 0));
      if (!(subtotal > 0)) throw new ApiAuthError(400, "กรุณาระบุยอดเงินเบิก");
      if (!str(body.description)) throw new ApiAuthError(400, "กรุณาระบุรายละเอียดการเบิก");
      const account = EXPENSE_ACCOUNTS.find((a) => a.code === str(body.expenseAccountCode)) || EXPENSE_ACCOUNTS[0];
      const empRef = adminDb.doc(`employees/${str(body.employeeId, 120)}`);
      const vat = body.hasVat ? r2(subtotal * 0.07) : 0;
      const id = await adminDb.runTransaction(async (tx) => {
        const emp = await tx.get(empRef);
        if (!emp.exists || emp.data()!.companyId !== companyId) throw new ApiAuthError(400, "กรุณาเลือกพนักงานผู้เบิก");
        const e = emp.data()!;
        const name = str(e.name || [e.firstName, e.lastName].filter(Boolean).join(" ") || e.fullName || emp.id, 200);
        const seq = await take(tx); const code = seq.number; seq.commit();
        tx.create(adminDb.doc(`companies/${companyId}/expenses/${code}`), {
          ...base, id: code, expenseId: code, documentType: "ExpenseClaim",
          employeeId: emp.id, employeeName: name, supplierName: name, vendor: name,
          expenseAccountCode: account.code, description: str(body.description, 1000), hasVat: !!body.hasVat,
          subTotal: subtotal, vatAmount: vat, totalAmount: r2(subtotal + vat), dueDate: todayBkk(),
        });
        return code;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "EXPENSE_CLAIM", id, { total: r2(subtotal + vat) });
      return NextResponse.json({ success: true, expenseId: id });
    }

    if (action === "fromPO") {
      if (!["finance:edit", "inventory:edit"].some((p) => can(apiUser.role, p as any))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const poRef = adminDb.doc(`companies/${companyId}/purchase_orders/${str(body.poId, 120)}`);
      const id = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(poRef);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งซื้อ");
        const po = snap.data()!;
        const st = String(po.status || "").toUpperCase();
        if (po.expenseId) throw new ApiAuthError(409, `ใบสั่งซื้อนี้ตั้งเบิกแล้ว (${po.expenseId})`);
        if (!["APPROVED", "RECEIVED", "COMPLETED"].includes(st)) throw new ApiAuthError(409, "ตั้งเบิกได้เฉพาะใบสั่งซื้อที่อนุมัติแล้ว");
        const seq = await take(tx); const code = seq.number; seq.commit();
        const term = Number(String(po.paymentTerm || "").match(/\d+/)?.[0]) || 30;
        tx.create(adminDb.doc(`companies/${companyId}/expenses/${code}`), {
          ...base, id: code, expenseId: code, documentType: "Expense", poRef: snap.id,
          supplierId: po.supplierId || "", supplierName: po.supplierName || "", vendor: po.supplierName || "",
          projectId: po.projectId || "", items: po.items || [],
          subTotal: r2(Number(po.subTotal) || 0), vatAmount: r2(Number(po.vatAmount) || 0), totalAmount: r2(Number(po.totalAmount) || 0),
          issuedAt: now, dueDate: addDays(todayBkk(), term),
        });
        tx.update(poRef, { expenseId: code, updatedAt: now, updatedBy: apiUser.uid });
        return code;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "EXPENSE", id, { po: poRef.id });
      return NextResponse.json({ success: true, expenseId: id });
    }

    if (action === "subcontract") {
      if (!["finance:edit", "projects:edit"].some((p) => can(apiUser.role, p as any))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const name = str(body.subcontractorName, 200);
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 100)
        .map((it: any) => ({ description: str(it.description || it.name, 300), payoutAmount: r2(Math.max(0, Number(it.payoutAmount) || 0)) }))
        .filter((it: any) => it.description && it.payoutAmount > 0);
      if (!name) throw new ApiAuthError(400, "กรุณาระบุชื่อช่าง/ผู้รับเหมาช่วง");
      if (!items.length) throw new ApiAuthError(400, "ต้องมีรายการค่าแรงอย่างน้อย 1 รายการ");
      const soRef = adminDb.doc(`companies/${companyId}/sales_orders/${str(body.soId, 120)}`);
      const subTotal = r2(items.reduce((s: number, it: any) => s + it.payoutAmount, 0));
      const id = await adminDb.runTransaction(async (tx) => {
        const so = await tx.get(soRef);
        if (!so.exists) throw new ApiAuthError(400, "กรุณาเลือกใบสั่งขายที่อ้างอิง");
        const seq = await take(tx); const code = seq.number; seq.commit();
        tx.create(adminDb.doc(`companies/${companyId}/expenses/${code}`), {
          ...base, id: code, expenseId: code, documentType: "Subcontract",
          supplierName: name, vendor: name, taxId: str(body.subcontractorTaxId, 20), vendorType: "INDIVIDUAL",
          soId: so.id, soCode: str(so.data()!.documentNo || body.soCode, 60), projectId: so.data()!.projectId || "",
          expenseAccountCode: "5121-00", description: str(body.remarks, 1000) || `ค่าแรงช่าง ${name}`, items,
          subTotal, vatAmount: 0, totalAmount: subTotal, defaultWhtRate: 3, dueDate: todayBkk(),
        });
        return code;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "EXPENSE_SUBCONTRACT", id, { total: subTotal });
      return NextResponse.json({ success: true, expenseId: id, subTotal });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[EXPENSE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกค่าใช้จ่ายไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
