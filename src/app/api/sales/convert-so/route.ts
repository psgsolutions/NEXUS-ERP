import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { convertToSalesOrder } from "@/lib/sales-order.server";

/**
 * [API-SERVER] Sales Order Conversion API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/sales/convert-so
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, companyId } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;

    // 1. Tenant & Field Validation
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }
    if (!quoteId) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] quoteId is required!" },
        { status: 400 }
      );
    }

    // 2. Period Lock Check
    await assertPeriodOpen(companyId, new Date().toISOString());

    // 3. Convert Quotation to SO (Server Execution)
    const soId = await convertToSalesOrder(quoteId, companyId);

    return NextResponse.json({
      success: true,
      message: `แปลงใบเสนอราคาเป็นใบสั่งขายเลขที่ ${soId} สำเร็จ`,
      soId
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[CONVERT_SO_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "เกิดข้อผิดพลาดในการแปลงใบสั่งขาย" },
      { status: 500 }
    );
  }
}
