import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { NumberingService } from '@/services/numberingService';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  try {
    const { docType } = await params;
    const body = await req.json();
    const { companyId, template, prefix, resetPolicy, seqPadding, yearBasis, reserveOn, allowManualOverride } = body;
    const apiUser = await requireApiUser(req, companyId);
    const userId = apiUser.email || apiUser.uid;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    if (!template || !/\{SEQ(?::\d+)?\}/.test(template)) {
      return NextResponse.json(
        { error: 'รูปแบบตัวเลข (Template) ต้องมีตัวแปร {SEQ} หรือ {SEQ:n} อย่างน้อย 1 ตัว เพื่อป้องกันเลขซ้ำ' },
        { status: 400 }
      );
    }

    const updatedScheme = await NumberingService.saveScheme(
      companyId,
      docType.toUpperCase(),
      {
        template,
        prefix,
        resetPolicy,
        seqPadding: Number(seqPadding) || 4,
        yearBasis,
        reserveOn,
        allowManualOverride: Boolean(allowManualOverride),
      },
      userId || 'SYSTEM'
    );

    return NextResponse.json({ scheme: updatedScheme });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('Error saving numbering scheme:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
