import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from '@/lib/firebase-admin';
import { NumberingService } from '@/services/numberingService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  try {
    const { docType } = await params;
    const body = await req.json();
    const { companyId, contextOpts } = body;
    await requireApiUser(req, companyId);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is strictly required' }, { status: 400 });
    }

    const upperDocType = docType.toUpperCase();
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const result = await adminDb.runTransaction(async (tx) => {
          return await NumberingService.generateDocumentNumber(companyId, upperDocType, tx, contextOpts);
        });

        return NextResponse.json(result);
      } catch (err: any) {
        lastError = err;
        console.warn(`Transaction collision on generateDocumentNumber (${upperDocType}), attempt ${attempt}/${maxRetries}:`, err.message);
        // Small exponential delay before retry
        await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt)));
      }
    }

    return NextResponse.json(
      { error: 'High concurrency conflict: Unable to generate unique document number after 3 retries.', details: lastError?.message },
      { status: 409 }
    );
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('Error in generate-number API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
