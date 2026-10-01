import { NextRequest, NextResponse } from "next/server";
import { processExpiringWarrantyMAProposals } from "@/lib/warranty-cron-service";
import { isCronRequest, requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * [CRON-ENDPOINT] Daily Warranty & MA Proposal Cron Job
 * Triggered daily via Vercel Cron at 01:00 AM UTC
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let companyIds: string[];

    if (isCronRequest(req)) {
      // Vercel Cron: ระบุ companyId ได้ ถ้าไม่ระบุให้ตรวจทุกบริษัท
      const requested = searchParams.get("companyId");
      companyIds = requested
        ? [requested]
        : (await adminDb.collection("companies").get()).docs.map(d => d.id);
    } else {
      // ผู้ใช้ที่ล็อกอิน: ตรวจได้เฉพาะบริษัทที่มีสิทธิ์
      const apiUser = await requireApiUser(req, searchParams.get("companyId"));
      const companyId = searchParams.get("companyId") || apiUser.companyId;
      if (!companyId) {
        return NextResponse.json({ success: false, error: "companyId is required" }, { status: 400 });
      }
      companyIds = [companyId];
    }

    const results = [];
    for (const id of companyIds) {
      results.push(...await processExpiringWarrantyMAProposals(id));
    }
    const companyId = companyIds.join(",");
    
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
