import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { processPOSBatchCheckout, POSCheckoutPayload } from "@/services/posBatch.service";

/**
 * [API-SERVER] POS Batch Checkout API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/pos/checkout
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, items, paymentMethod, cashReceived, discount, paymentRef, customer } = body as POSCheckoutPayload;
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:billing")) throw new ApiAuthError(403, "ขายหน้าร้านได้เฉพาะผู้มีสิทธิ์ออกใบเสร็จ");
    const userId = apiUser.email || apiUser.uid;

    // 1. Tenant & Field Validation
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] Cart items are required for checkout." },
        { status: 400 }
      );
    }

    // 2. Period Lock Check
    await assertPeriodOpen(companyId, new Date().toISOString());

    // 3. Execute Batch Checkout
    const result = await processPOSBatchCheckout({
      companyId,
      userId,
      items,
      paymentMethod,
      cashReceived,
      discount,
      paymentRef,
      customer,
    });

    return NextResponse.json({
      ...result,
      message: "ชำระเงินและตัดสต็อก POS สำเร็จ",
      cashier: apiUser.email || apiUser.uid,
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[POS_CHECKOUT_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "เกิดข้อผิดพลาดในการชำระเงิน POS" },
      { status: 500 }
    );
  }
}
