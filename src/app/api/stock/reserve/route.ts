import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { processStockMovement } from "@/lib/stock-service";

/**
 * [API-SERVER] Centralized Stock Reserve & Movement API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/stock/reserve
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      productId,
      type = "OUT",
      quantity,
      unitCost,
      fromLocation,
      toLocation,
      referenceId,
      snList
    } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;

    // 1. Validations
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] productId is required!" },
        { status: 400 }
      );
    }
    const safeQty = Number(quantity);
    if (isNaN(safeQty) || safeQty <= 0) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] quantity must be greater than 0!" },
        { status: 400 }
      );
    }

    // 2. Period Lock Check
    await assertPeriodOpen(companyId, new Date().toISOString());

    // 3. Stock Movement Execution (Server Context)
    const result = await processStockMovement({
      companyId,
      productId,
      type,
      quantity: safeQty,
      unitCost,
      fromLocation,
      toLocation,
      referenceId,
      snList,
      userId
    });

    return NextResponse.json({
      success: true,
      message: "ปรับปรุงสต็อกพัสดุสำเร็จ",
      result
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[STOCK_RESERVE_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "เกิดข้อผิดพลาดในการปรับปรุงสต็อก" },
      { status: 500 }
    );
  }
}
