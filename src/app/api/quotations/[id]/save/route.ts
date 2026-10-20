import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import {
  auditEntry, cleanHeader, companyGpThreshold, createCustomerInTx, grossProfitPercent, normalizeLines,
  notifyPendingApproval, overQuoteLimit, quoteLimitAmount, str, submitStatus, writeProductWritebacks,
} from "@/lib/quotation.server";

/**
 * [API-SERVER] บันทึกการแก้ไขใบเสนอราคา (แทนการเขียนจากเบราว์เซอร์โดยตรง)
 * Endpoint: POST /api/quotations/{id}/save
 * body: { companyId, submit: boolean, requiresApproval?: boolean, sendChannel?, header: {...}, lines: [...],
 *         newCustomer?: { name, address, taxId }, productWritebacks?: [{ productId, technicalSpecs?, datasheetUrl? }] }
 *
 * กติกาที่บังคับฝั่งเซิร์ฟเวอร์:
 *  - แก้ได้เฉพาะสถานะ ร่าง / รออนุมัติ / ตีกลับ (ส่งลูกค้าแล้ว = ต้องออกฉบับแก้ไข, ได้งาน/ถูกแทนที่ = แก้ไม่ได้)
 *  - submit: GP ต่ำกว่าเกณฑ์บริษัท หรือหน้าจอแจ้งว่าต้องขออนุมัติ (เช่น เกินวงเงินเครดิต) -> รออนุมัติ มิฉะนั้น -> ส่งลูกค้าแล้ว
 *  - ไม่ submit: คงสถานะเดิม (ตีกลับแก้ไขแล้วบันทึก = ยังเป็นตีกลับ)
 *  - ฟิลด์ระบบ (เลขที่, ฉบับแก้ไข, ประวัติ, ใบสั่งขาย, ผู้สร้าง) ไม่รับจากหน้าจอ
 */

const EDITABLE = ["DRAFT", "PENDING_APPROVAL", "REJECTED"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const companyId = str(body.companyId, 80).trim();
    if (!companyId || !id) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const header = cleanHeader(body.header);
    const lines = normalizeLines(body.lines);
    const submit = body.submit === true;
    const requiresApproval = body.requiresApproval === true;
    const ref = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบเสนอราคา");
      const cur = snap.data()!;
      const docNo = cur.documentNo || cur.quotationNumber || cur.quoteId || id;
      const curStatus = String(cur.status || "DRAFT").toUpperCase();
      if (cur.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง`);
      if (!EDITABLE.includes(curStatus)) {
        const reason = curStatus === "SENT" || curStatus === "ACCEPTED"
          ? "ส่งลูกค้าแล้ว แก้ไขได้โดยสร้างฉบับแก้ไข (Revision)"
          : "แก้ไขไม่ได้แล้ว (ได้งานหรือถูกแทนที่)";
        throw new ApiAuthError(409, `${docNo} ${reason}`);
      }
      const threshold = submit ? await companyGpThreshold(tx, companyId) : 0;
      const existingLines = await tx.get(ref.collection("lines"));

      // ---- สถานะใหม่ ----
      const gp = submit ? grossProfitPercent(lines, header.docDiscountAmount) : null;
      const nextStatus = submit ? submitStatus(gp!, threshold, requiresApproval, overQuoteLimit(apiUser.roles, quoteLimitAmount(header, lines))) : curStatus;

      // ---- เขียน ----
      if (!header.customerId && body.newCustomer?.name) {
        header.customerId = createCustomerInTx(tx, companyId, body.newCustomer);
        if (header.customerSnapshot && typeof header.customerSnapshot === "object") header.customerSnapshot = { ...header.customerSnapshot, customerId: header.customerId };
      }
      tx.update(ref, {
        ...header,
        status: nextStatus,
        updatedBy: apiUser.uid,
        updatedAt: now,
        ...(nextStatus === "SENT" && curStatus !== "SENT" ? { sentAt: now, sentBy: apiUser.uid, sentChannel: str(body.sendChannel || "SYSTEM", 20) } : {}),
      });
      existingLines.forEach((d) => tx.delete(d.ref));
      lines.forEach((l) => tx.set(ref.collection("lines").doc(), l));
      writeProductWritebacks(tx, companyId, apiUser.roles, body.productWritebacks);
      tx.set(ref.collection("audit_logs").doc(), auditEntry(apiUser.uid, apiUser.email || apiUser.uid, submit, nextStatus, body.sendChannel, gp, requiresApproval, false));
      if (nextStatus === "PENDING_APPROVAL" && curStatus !== "PENDING_APPROVAL") {
        notifyPendingApproval(tx, companyId, id, docNo, header.customerName || cur.customerName, header.grandTotal ?? cur.grandTotal, gp, apiUser.uid);
      }
      return { docNo, status: nextStatus, gp, customerId: header.customerId || "" };
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "SALES_QUOTATION", result.docNo, {}, { status: result.status, grandTotal: header.grandTotal });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[QUOTATION_SAVE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบเสนอราคาไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
