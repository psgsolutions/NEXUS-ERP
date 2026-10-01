import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { NumberingService } from '@/services/numberingService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    await requireApiUser(req, companyId);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const schemes = await NumberingService.getAllSchemes(companyId);
    return NextResponse.json({ schemes });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('Error fetching numbering schemes:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
