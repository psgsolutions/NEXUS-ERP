import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { NumberingService } from '@/services/numberingService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  try {
    const { docType } = await params;
    const body = await req.json();
    const { companyId, documentNumber } = body;
    await requireApiUser(req, companyId);

    if (!companyId || !documentNumber) {
      return NextResponse.json({ error: 'companyId and documentNumber are required' }, { status: 400 });
    }

    const isUnique = await NumberingService.validateManualNumber(
      companyId,
      docType.toUpperCase(),
      documentNumber.trim()
    );

    return NextResponse.json({ isUnique });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('Error in validate-number API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
