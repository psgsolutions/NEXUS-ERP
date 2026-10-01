import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { nextCounterSequence } from "@/lib/sequence-server";
import { IdType } from "@/lib/utils";

/**
 * [API-SERVER] Atomic Counter Sequence API
 * Endpoint: POST /api/sequence/next
 * Body: { companyId, type, context? }  Header: Authorization: Bearer <Firebase ID token>
 */
export async function POST(request: Request) {
  try {
    const { companyId, type, context } = await request.json();
    await requireApiUser(request, companyId);

    if (!companyId || !type) {
      return NextResponse.json({ error: "companyId and type are required" }, { status: 400 });
    }

    const sequence = await nextCounterSequence(type as IdType, companyId, context);
    return NextResponse.json({ sequence });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[SEQUENCE_NEXT_API_ERROR]", err);
    return NextResponse.json({ error: err.message || "Unable to generate sequence" }, { status: 500 });
  }
}
