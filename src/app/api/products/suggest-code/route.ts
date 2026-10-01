import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { NumberingService } from '@/services/numberingService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, brandId, categoryId } = body;
    await requireApiUser(req, companyId);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const suggestedCode = await NumberingService.suggestProductCode(
      companyId,
      brandId,
      categoryId
    );

    return NextResponse.json({ suggestedCode });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('Error in suggest-code API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
