import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
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
    const { companyId, items, paymentMethod, cashReceived } = body as POSCheckoutPayload;
    const apiUser = await requireApiUser(request, companyId);
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
      cashReceived
    });

    return NextResponse.json({
      success: true,
      message: "ชำระเงินและตัดสต็อก POS สำเร็จ",
      transactionId: result.transactionId,
      transactionNo: result.transactionNo,
      grandTotal: result.grandTotal,
      change: result.change
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
