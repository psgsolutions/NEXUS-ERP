import { NextRequest, NextResponse } from "next/server";
import { processExpiringWarrantyMAProposals } from "@/lib/warranty-cron-service";
import { isCronRequest, requireApiUser, authErrorResponse } from "@/lib/api-auth";

/**
 * [CRON-ENDPOINT] Daily Warranty & MA Proposal Cron Job
 * Triggered daily via Vercel Cron at 01:00 AM UTC
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "COMP-001";

    // Vercel Cron (CRON_SECRET) หรือผู้ใช้ที่ล็อกอินและมีสิทธิ์ในบริษัทนั้น
    if (!isCronRequest(req)) {
      await requireApiUser(req, companyId);
    }

    const results = await processExpiringWarrantyMAProposals(companyId);
    
    const createdCount = results.filter(r => r.status === "CREATED").length;
    const skippedCount = results.filter(r => r.status === "SKIPPED_ALREADY_DRAFTED").length;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      companyId,
      summary: {
        totalEvaluated: results.length,
        createdDrafts: createdCount,
        skippedAlreadyDrafted: skippedCount
      },
      details: results
    });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[CRON_WARRANTY_CHECK_FAILED]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed running warranty MA cron" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
