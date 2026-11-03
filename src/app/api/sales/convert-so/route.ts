import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { convertToSalesOrder } from "@/lib/sales-order.server";
import { assertCreditAvailable, getCompanyCustomer } from "@/lib/credit-limit.server";
import { adminDb } from "@/lib/firebase-admin";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] แปลงใบเสนอราคา (ส่งลูกค้าแล้ว) เป็นใบสั่งขาย
 * Endpoint: POST /api/sales/convert-so { companyId, quoteId }
 * - สิทธิ์ sales:edit · ตรวจวงเงินเครดิตลูกค้าเหมือนการยืนยันใบสั่งขาย
 * - รายละเอียดการแปลง: src/lib/sales-order.server.ts
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const quoteId = String(body.quoteId || "").trim();
    if (!companyId || !quoteId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    // วงเงินเครดิต (ยอดค้างจริง + ยอดใบนี้)
    const q = (await adminDb.doc(`companies/${companyId}/quotations/${quoteId}`).get()).data();
    if (q?.customerId) {
      const cust = await getCompanyCustomer(companyId, q.customerId);
      if (cust) await assertCreditAvailable(companyId, q.customerId, cust.data(), Number(q.grandTotal) || 0);
    }

    const r = await convertToSalesOrder(quoteId, companyId, { uid: apiUser.uid, email: apiUser.email || "" });
    await auditServer.logCreate(apiUser.uid, companyId, "SALES_ORDER", r.soId, { fromQuotation: r.quotationNo, total: r.grandTotal });
    return NextResponse.json({ success: true, ...r, message: `แปลงเป็นใบสั่งขาย ${r.soId} แล้ว` });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    if (String(err?.message || "").includes("ปิดงบ") || String(err?.message || "").includes("วงเงิน")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    console.error("[CONVERT_SO_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "แปลงเป็นใบสั่งขายไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
