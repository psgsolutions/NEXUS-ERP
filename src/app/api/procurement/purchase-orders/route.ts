import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { computeDocTotals, normalizeVatMode, sanitizeLines } from "@/lib/doc-totals";

/**
 * [API-SERVER] ใบสั่งซื้อ (PO)
 * Endpoint: POST /api/procurement/purchase-orders
 *  - { companyId, action: "create", header: {...}, items: [...], prId? }
 *      เลข PO ออกในทรานแซกชัน (ไม่ข้าม) ยอดคำนวณที่ server (บาทตามอัตราแลกเปลี่ยน)
 *      สร้างจากใบขอซื้อ: ใบขอซื้อต้องอนุมัติแล้วและยังไม่ถูกแปลง -> CONVERTED ในทรานแซกชันเดียวกัน
 *  - { companyId, action: "approve", poId }  ยอดเกิน 50,000 บาทต้อง SUPERADMIN
 *  - { companyId, action: "cancel", poId }   ยกเลิกไม่ได้เมื่อรับสินค้าแล้ว
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const EDIT = ["inventory:edit", "finance:edit"] as const;
const APPROVAL_LIMIT = 50000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!EDIT.some((p) => can(apiUser.role, p))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const action = str(body.action, 20);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const role = String(apiUser.role || "").toUpperCase();

    if (action === "create") {
      const h = body.header || {};
      const items = sanitizeLines(body.items).map((it) => ({ ...it, qtyReceived: 0 }));
      if (!str(h.supplierId)) throw new ApiAuthError(400, "กรุณาระบุคู่ค้า");
      if (!items.length) throw new ApiAuthError(400, "กรุณาเพิ่มรายการสั่งซื้อ");
      const orderType = str(h.orderType, 20) || "STOCK";
      if (orderType === "PROJECT" && !str(h.projectId)) throw new ApiAuthError(400, "กรุณาเลือกโครงการ");
      const currency = str(h.currency, 5) || "THB";
      const rate = currency === "THB" ? 1 : Math.max(0.0001, Number(h.exchangeRate) || 1);
      const vatType = normalizeVatMode(h.vatType);
      const t = computeDocTotals(items, vatType);
      const prId = str(body.prId, 120);
      const supRef = adminDb.doc(`suppliers/${str(h.supplierId, 120)}`);
      const take = await prepareSequence("PO", companyId);

      const poCode = await adminDb.runTransaction(async (tx) => {
        const supSnap = await tx.get(supRef);
        const sup = supSnap.exists && supSnap.data()!.companyId === companyId ? supSnap.data()! : null;
        let prRef: admin.firestore.DocumentReference | null = null;
        if (prId) {
          prRef = adminDb.doc(`companies/${companyId}/purchase_requests/${prId}`);
          const prSnap = await tx.get(prRef);
          if (!prSnap.exists) throw new ApiAuthError(404, "ไม่พบใบขอซื้อที่อ้างอิง");
          const st = String(prSnap.data()!.status || "").toUpperCase();
          if (st === "CONVERTED") throw new ApiAuthError(409, `ใบขอซื้อ ${prId} ถูกแปลงเป็นใบสั่งซื้อแล้ว (${prSnap.data()!.poCode || ""})`);
          if (st !== "APPROVED") throw new ApiAuthError(409, `ใบขอซื้อ ${prId} ยังไม่อนุมัติ`);
        }
        const seq = await take(tx);
        const code = seq.number;
        seq.commit();
        tx.create(adminDb.doc(`companies/${companyId}/purchase_orders/${code}`), {
          poCode: code, documentNo: code, companyId,
          orderType, supplierId: supRef.id, supplierName: str(sup?.name || sup?.supplierName || h.supplierName, 200),
          reference: str(h.reference, 120), prRef: prId,
          projectId: str(h.projectId, 120), projectName: str(h.projectName, 200),
          department: str(h.department, 120), warehouseCode: orderType === "STOCK" ? str(h.warehouseCode, 40) : "",
          date: isDate(h.date) ? h.date : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
          expectedDate: isDate(h.expectedDate) ? h.expectedDate : "",
          vatType: vatType === "exclusive" ? "Exclusive" : vatType === "inclusive" ? "Inclusive" : "None",
          currency, exchangeRate: rate,
          incoterm: str(h.incoterm, 20), incotermPlace: str(h.incotermPlace, 120), paymentTerm: str(h.paymentTerm, 60),
          shippingMethod: str(h.shippingMethod, 60), terms: str(h.terms, 2000),
          items,
          subTotal: r2(t.subTotal * rate), vatAmount: r2(t.vatAmount * rate), totalAmount: r2(t.grandTotal * rate),
          totalAmountForeign: t.grandTotal, discountTotal: r2(t.discount * rate),
          status: "PENDING_APPROVAL",
          createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, updatedAt: now, isDeleted: false,
        });
        if (prRef) tx.update(prRef, { status: "CONVERTED", poCode: code, updatedAt: now, updatedBy: apiUser.uid });
        return code;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "PURCHASE_ORDER", poCode, { total: r2(t.grandTotal * rate), prId });
      return NextResponse.json({ success: true, poCode });
    }

    if (action === "approve" || action === "cancel") {
      const poId = str(body.poId, 120);
      if (!poId) throw new ApiAuthError(400, "ไม่พบใบสั่งซื้อ");
      const ref = adminDb.doc(`companies/${companyId}/purchase_orders/${poId}`);
      // เคยรับสินค้าแล้ว (อ้างอิงใบสั่งซื้อนี้) -> ยกเลิกไม่ได้
      const received = action === "cancel" ? !(await adminDb.collection(`companies/${companyId}/goods_receipts`).where("poRef", "==", poId).limit(1).get()).empty : false;
      const status = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งซื้อ");
        const po = snap.data()!;
        const st = String(po.status || "").toUpperCase();
        if (action === "approve") {
          if (!["PENDING_APPROVAL", "PENDING", "DRAFT"].includes(st)) throw new ApiAuthError(409, "ใบสั่งซื้อนี้อนุมัติไปแล้วหรือถูกยกเลิก");
          if (Number(po.totalAmount) > APPROVAL_LIMIT && role !== "SUPERADMIN") throw new ApiAuthError(403, `ยอดเกิน ${APPROVAL_LIMIT.toLocaleString("th-TH")} บาท ต้องให้ Superadmin อนุมัติเท่านั้น`);
          tx.update(ref, { status: "Approved", approvedBy: apiUser.uid, approvedAt: now, updatedAt: now, updatedBy: apiUser.uid });
          return "Approved";
        }
        if (["CANCELLED", "RECEIVED", "COMPLETED", "CLOSED"].includes(st) || received || po.expenseId) throw new ApiAuthError(409, "ใบสั่งซื้อนี้รับสินค้า/ตั้งเบิกแล้ว หรือถูกยกเลิกแล้ว ยกเลิกไม่ได้");
        tx.update(ref, { status: "CANCELLED", cancelledAt: now, cancelledBy: apiUser.uid, updatedAt: now, updatedBy: apiUser.uid });
        return "CANCELLED";
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "PURCHASE_ORDER", poId, {}, { status });
      return NextResponse.json({ success: true, poId, status });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PURCHASE_ORDER_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบสั่งซื้อไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
