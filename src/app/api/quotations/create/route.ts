import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import {
  auditEntry, cleanHeader, companyGpThreshold, createCustomerInTx, grossProfitPercent, normalizeLines,
  notifyPendingApproval, str, submitStatus, writeProductWritebacks,
} from "@/lib/quotation.server";

/**
 * [API-SERVER] สร้างใบเสนอราคาใหม่
 * Endpoint: POST /api/quotations/create
 * body: { companyId, submit, requiresApproval?, sendChannel?, header, lines, newCustomer?, productWritebacks? }
 * - เลขที่เอกสาร (QT) ออกในทรานแซกชันเดียวกับการบันทึก (ไม่ซ้ำ ไม่ข้าม)
 * - submit: ตรวจ GP กับเกณฑ์บริษัทฝั่งเซิร์ฟเวอร์ -> รออนุมัติ (แจ้งผู้อนุมัติ) หรือส่งลูกค้าแล้ว
 * - ไม่ submit: ฉบับร่าง
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80).trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const header = cleanHeader(body.header);
    const lines = normalizeLines(body.lines);
    if (!lines.some((l) => l.itemType !== "GROUP_HEADER")) throw new ApiAuthError(400, "กรุณาเพิ่มรายการสินค้าหรือบริการอย่างน้อย 1 รายการ");
    if (!header.customerId && !str(body.newCustomer?.name).trim() && !str(header.customerName).trim()) throw new ApiAuthError(400, "กรุณาระบุลูกค้า");

    const take = await prepareSequence("QT", companyId);
    const ref = adminDb.collection(`companies/${companyId}/quotations`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const submit = body.submit === true;
    const requiresApproval = body.requiresApproval === true;

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const seq = await take(tx);
      const threshold = submit ? await companyGpThreshold(tx, companyId) : 0;

      // ---- คำนวณ ----
      const gp = submit ? grossProfitPercent(lines, header.docDiscountAmount) : null;
      const status = submit ? submitStatus(gp!, threshold, requiresApproval) : "DRAFT";
      const docNo = seq.number;

      // ---- เขียน ----
      seq.commit();
      if (!header.customerId && body.newCustomer?.name) {
        header.customerId = createCustomerInTx(tx, companyId, body.newCustomer);
        if (header.customerSnapshot && typeof header.customerSnapshot === "object") header.customerSnapshot = { ...header.customerSnapshot, customerId: header.customerId };
      }
      tx.create(ref, {
        ...header,
        id: ref.id,
        companyId,
        documentNo: docNo,
        quotationNumber: docNo,
        revision: 0,
        revisionNumber: 1,
        parentQuotationId: null,
        revisionHistory: [],
        status,
        salesPersonId: header.salesPersonId || apiUser.uid,
        createdBy: apiUser.uid,
        createdAt: now,
        updatedBy: apiUser.uid,
        updatedAt: now,
        isDeleted: false,
        ...(status === "SENT" ? { sentAt: now, sentBy: apiUser.uid, sentChannel: str(body.sendChannel || "SYSTEM", 20) } : {}),
      });
      lines.forEach((l) => tx.set(ref.collection("lines").doc(), l));
      writeProductWritebacks(tx, companyId, apiUser.roles, body.productWritebacks);
      tx.set(ref.collection("audit_logs").doc(), auditEntry(apiUser.uid, apiUser.email || apiUser.uid, submit, status, body.sendChannel, gp, requiresApproval, true));
      if (status === "PENDING_APPROVAL") notifyPendingApproval(tx, companyId, ref.id, docNo, header.customerName, header.grandTotal, gp, apiUser.uid);
      return { docNo, status, gp, customerId: String(header.customerId || "") };
    });

    await auditServer.logCreate(apiUser.uid, companyId, "SALES_QUOTATION", result.docNo, { status: result.status, grandTotal: header.grandTotal, customerName: header.customerName });
    return NextResponse.json({ success: true, id: ref.id, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[QUOTATION_CREATE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "สร้างใบเสนอราคาไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
