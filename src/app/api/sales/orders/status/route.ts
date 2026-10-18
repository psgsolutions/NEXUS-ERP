import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { soPickRemaining } from "@/lib/picking";
import { getCompanyCustomer, assertCreditAvailable } from "@/lib/credit-limit.server";
import { getProductTx } from "@/lib/product-store.server";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { prepareSequence } from "@/lib/sequence-server";
import { sellerSnapshot } from "@/lib/documents/seller.server";
import { soAllLines, writeDeliveryNote } from "@/lib/delivery-note.server";

/**
 * [API-SERVER] เปลี่ยนสถานะใบสั่งขาย
 * Endpoint: POST /api/sales/orders/status
 * body: { companyId, soId, action: "confirm" | "deliver" | "cancel" }
 * - confirm: ร่าง -> อนุมัติ (ตรวจวงเงินเครดิตจากยอดค้างจริง)
 * - deliver: อนุมัติ -> ส่งมอบ เฉพาะใบที่ไม่มีสินค้าต้องเบิกจากคลัง (สินค้าส่งมอบผ่านการเบิก)
 * - cancel: ร่าง/อนุมัติที่ยังไม่เบิกสินค้า -> ยกเลิก และคืนยอดจองสินค้าที่จองไว้ตอนแปลงจากใบเสนอราคา
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const ACTIONS = ["confirm", "deliver", "cancel"] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const action = str(body.action, 20) as (typeof ACTIONS)[number];
    const soId = str(body.soId, 120);
    if (!ACTIONS.includes(action) || !soId || soId.includes("/")) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");

    const soRef = adminDb.doc(`companies/${companyId}/sales_orders/${soId}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    // วงเงินเครดิตตรวจก่อนเข้าทรานแซกชัน (อ่านใบกำกับหลายใบ)
    if (action === "confirm") {
      const pre = await soRef.get();
      if (!pre.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งขาย");
      const so = pre.data()!;
      const cust = so.customerId ? await getCompanyCustomer(companyId, String(so.customerId)) : null;
      if (cust) await assertCreditAvailable(companyId, String(so.customerId), cust.data(), Number(so.grandTotal ?? so.totalAmount) || 0);
    }

    const groupId = await groupIdOfCompany(companyId);
    // ส่งมอบงานที่ไม่ต้องเบิกสินค้า: ออกใบส่งของ (DN) ทุกรายการ
    const [takeDn, seller] = action === "deliver" ? await Promise.all([prepareSequence("DN", companyId), sellerSnapshot(companyId)]) : [null, null];
    let dnNo = "";
    const next = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(soRef);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งขาย");
      const so = snap.data()!;
      const st = String(so.status || "").toUpperCase();
      const docNo = so.documentNo || so.soId || soId;

      if (action === "confirm") {
        if (st !== "DRAFT") throw new ApiAuthError(409, `${docNo} ไม่ใช่ใบร่าง`);
        tx.update(soRef, { status: "Confirmed", confirmedBy: apiUser.uid, confirmedAt: now, updatedBy: apiUser.uid, updatedAt: now });
        return "Confirmed";
      }
      if (["DELIVERED", "COMPLETED", "CANCELLED"].includes(st) || st === "DRAFT" && action === "deliver") {
        throw new ApiAuthError(409, `${docNo} อยู่ในสถานะที่${action === "deliver" ? "ส่งมอบ" : "ยกเลิก"}ไม่ได้`);
      }
      if (so.invoiceNo || so.invoiceDocId) throw new ApiAuthError(409, `${docNo} ออกใบกำกับภาษีแล้ว`);

      if (action === "deliver") {
        if (soPickRemaining(so).size > 0) throw new ApiAuthError(409, `${docNo} มีสินค้าที่ต้องเบิกจากคลัง ส่งมอบผ่านหน้าเบิกสินค้า`);
        const seq = await takeDn!(tx);
        dnNo = seq.number; seq.commit();
        const dnUpdate = writeDeliveryNote(tx, { companyId, dnNo, soId, so, lines: soAllLines(so), seller, uid: apiUser.uid, source: "deliver" });
        tx.update(soRef, { ...dnUpdate, status: "DELIVERED", deliveredAt: now, updatedBy: apiUser.uid, updatedAt: now });
        return "DELIVERED";
      }

      // cancel: เบิกสินค้าออกไปแล้วบางส่วน -> ต้องรับคืนก่อน
      const picked = so.picked || {};
      if (Object.values(picked).some((q: any) => (Number(q) || 0) > 0)) throw new ApiAuthError(409, `${docNo} เบิกสินค้าออกจากคลังแล้ว ยกเลิกไม่ได้`);
      const fromReserved = st !== "DRAFT" && (so.stockReserved ?? Boolean(so.quoteId));
      const release = fromReserved ? Array.from(soPickRemaining(so).entries()) : [];
      const products = await Promise.all(release.map(([pid]) => getProductTx(tx, companyId, groupId, pid)));
      products.forEach((p, i) => {
        if (!p) return;
        const reserved = Number(p.data.stockStatus?.reserved) || 0;
        const back = Math.min(release[i][1], reserved);
        if (back <= 0) return;
        tx.update(p.ref, {
          "stockStatus.reserved": admin.firestore.FieldValue.increment(-back),
          "stockStatus.available": admin.firestore.FieldValue.increment(back),
          updatedAt: now, updatedBy: apiUser.uid,
        });
      });
      tx.update(soRef, { status: "CANCELLED", stockReserved: false, cancelledBy: apiUser.uid, cancelledAt: now, updatedBy: apiUser.uid, updatedAt: now });
      return "CANCELLED";
    });

    await auditServer.logUpdate(apiUser.uid, companyId, "SALES_ORDER", soId, null, { action, status: next });
    return NextResponse.json({ success: true, status: next, ...(dnNo ? { deliveryNoteNo: dnNo } : {}) });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SO_STATUS_ERROR]:", error);
    return NextResponse.json({ success: false, error: "เปลี่ยนสถานะใบสั่งขายไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
