import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { canWriteBackToProductMaster } from "@/lib/erp-logic";
import { auditServer } from "@/services/audit.server";

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
const PROTECTED = ["companyId", "documentNo", "quotationNumber", "revisionNumber", "parentQuotationId", "previousRevisionId",
  "revisionHistory", "supersededBy", "supersededByNo", "supersededAt", "linkedSo", "status", "createdAt", "createdBy",
  "isDeleted", "isSample", "approvedAt", "approvedBy", "updatedAt", "updatedBy"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: any, max = 500) => String(v ?? "").slice(0, max);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const companyId = str(body.companyId, 80).trim();
    if (!companyId || !id) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const rawHeader = body.header && typeof body.header === "object" ? body.header : {};
    const header: Record<string, any> = Object.fromEntries(Object.entries(rawHeader).filter(([k, v]) => !PROTECTED.includes(k) && v !== undefined));
    const rawLines: any[] = Array.isArray(body.lines) ? body.lines.slice(0, 500) : [];
    const lines = rawLines.map((l, i) => {
      const qty = num(l.qty);
      const unitPrice = num(l.unitPrice);
      const costPrice = num(l.costPrice);
      return {
        sequence: i + 1,
        productId: str(l.productId, 120),
        sku: str(l.sku, 120),
        productName: str(l.productName, 300),
        description: str(l.description, 2000),
        details: str(l.details, 4000),
        qty,
        uom: str(l.uom || "ชิ้น", 40),
        uomConversionFactor: 1,
        costPrice,
        unitPrice,
        discountString: str(l.discountString, 40),
        discountType: l.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT",
        discountValue: num(l.discountValue),
        lineTotal: r2(qty * unitPrice),
        isVatable: true,
        whtApplicable: false,
        glAccountId: str(l.glAccountId || "411100", 20),
        isOptional: !!l.isOptional,
        margin: r2(unitPrice - costPrice),
      };
    });

    const ref = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const companyRef = adminDb.doc(`companies/${companyId}`);
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
      const company = (await tx.get(companyRef)).data() || {};
      const existingLines = await tx.get(ref.collection("lines"));

      // ---- สถานะใหม่ ----
      let nextStatus = curStatus;
      let gp: number | null = null;
      if (body.submit === true) {
        const revenue = lines.reduce((s, l) => s + l.lineTotal, 0) - num(header.docDiscountAmount);
        const cost = lines.reduce((s, l) => s + l.costPrice * l.qty, 0);
        gp = revenue > 0 ? r2(((revenue - cost) / revenue) * 100) : 0;
        const threshold = num(company.settings?.minGpPercentForAutoSend ?? 15);
        nextStatus = body.requiresApproval === true || gp < threshold ? "PENDING_APPROVAL" : "SENT";
      }

      // ---- เขียน ----
      let customerId = header.customerId || "";
      if (!customerId && body.newCustomer?.name) {
        const cRef = adminDb.collection("customers").doc();
        tx.set(cRef, {
          customerName: str(body.newCustomer.name, 200), name: str(body.newCustomer.name, 200),
          address: str(body.newCustomer.address, 500), taxId: str(body.newCustomer.taxId, 20),
          companyId, isDeleted: false, createdAt: now, updatedAt: now,
        });
        customerId = cRef.id;
        header.customerId = customerId;
        if (header.customerSnapshot && typeof header.customerSnapshot === "object") header.customerSnapshot = { ...header.customerSnapshot, customerId };
      }

      tx.update(ref, { ...header, status: nextStatus, updatedBy: apiUser.uid, updatedAt: now, ...(nextStatus === "SENT" && curStatus !== "SENT" ? { sentAt: now, sentBy: apiUser.uid, sentChannel: str(body.sendChannel || "SYSTEM", 20) } : {}) });
      existingLines.forEach((d) => tx.delete(d.ref));
      lines.forEach((l) => tx.set(ref.collection("lines").doc(), l));

      if (canWriteBackToProductMaster(apiUser.role, true)) {
        (Array.isArray(body.productWritebacks) ? body.productWritebacks : []).slice(0, 100).forEach((w: any) => {
          const pid = str(w.productId, 120);
          const patch: Record<string, any> = {};
          if (str(w.technicalSpecs).trim()) patch.technicalSpecs = str(w.technicalSpecs, 4000).trim();
          if (str(w.datasheetUrl).trim()) patch.datasheetUrl = str(w.datasheetUrl, 500).trim();
          if (pid && Object.keys(patch).length) tx.set(adminDb.doc(`companies/${companyId}/products/${pid}`), { ...patch, updatedAt: now }, { merge: true });
        });
      }

      tx.set(ref.collection("audit_logs").doc(), {
        userId: apiUser.uid,
        userName: apiUser.email || apiUser.uid,
        action: body.submit !== true ? "SAVE_DRAFT" : nextStatus === "PENDING_APPROVAL" ? "SUBMIT_APPROVAL" : `SEND_${str(body.sendChannel || "MANUAL", 20)}`,
        channel: str(body.sendChannel || (body.submit ? "SYSTEM" : "DRAFT"), 20),
        timestamp: new Date().toISOString(),
        details: body.submit !== true
          ? "บันทึกข้อมูลแก้ไขใบเสนอราคา"
          : nextStatus === "PENDING_APPROVAL"
            ? (gp !== null && body.requiresApproval !== true ? `ส่งขออนุมัติเนื่องจาก GP (${gp}%) ต่ำกว่าเกณฑ์` : "ส่งขออนุมัติ (เกินวงเงินเครดิตหรือเงื่อนไขพิเศษ)")
            : "บันทึกและส่งเอกสารให้ลูกค้า",
      });
      return { docNo, status: nextStatus, gp, customerId };
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
