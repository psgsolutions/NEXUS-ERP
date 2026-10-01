import { NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { companyId = 'COM-NEXUS-01' } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userUid = apiUser.uid;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID เอกสารเป็นค่าว่าง' }, { status: 400 });
    }

    const docPath = `companies/${companyId}/quotations/${id}`;
    const origSnap = await adminDb.doc(docPath).get();

    if (!origSnap.exists) {
      return NextResponse.json({ success: false, error: 'ไม่พบใบเสนอราคาต้นฉบับ' }, { status: 404 });
    }

    const origData = origSnap.data() || {};
    const todayStr = new Date().toISOString().split('T')[0];

    // Auto-generate new sequence number
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const monthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const newDocNo = `QT-${yearShort}${monthStr}-${randomSeq}`;

    const newDocRef = adminDb.collection(`companies/${companyId}/quotations`).doc();

    const batch = adminDb.batch();

    const duplicatePayload = {
      ...origData,
      id: newDocRef.id,
      companyId,
      documentNo: newDocNo,
      quotationNumber: newDocNo,
      docDate: todayStr,
      date: todayStr,
      status: 'draft',
      
      // RESET CUSTOMER FIELDS
      customerId: '',
      customerName: '',
      customerTaxId: '',
      customerAddress: '',
      customerBranch: 'สำนักงานใหญ่',
      customerInfo: {
        customerId: '',
        name: '',
        taxId: '',
        branch: 'สำนักงานใหญ่',
        address: ''
      },
      customerSnapshot: null,

      // RESET PROJECT FIELD (IMPORTANT: Never copy projectId)
      projectId: '',
      projectName: '',

      // RESET REVISION FIELDS
      revisionNumber: 1,
      parentQuotationId: null,
      revisionHistory: [],

      // AUDIT METADATA
      createdBy: userUid || origData.createdBy || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isDeleted: false
    };

    batch.set(newDocRef, duplicatePayload);

    // Copy line items
    const linesSnap = await adminDb.collection(`${docPath}/lines`).get();
    linesSnap.forEach(lineDoc => {
      const newLineRef = newDocRef.collection('lines').doc();
      batch.set(newLineRef, {
        ...lineDoc.data(),
        id: newLineRef.id
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      newQuotationId: newDocRef.id,
      newDocumentNo: newDocNo,
      message: `คัดลอกใบเสนอราคาสำเร็จ (${newDocNo})`
    });

  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("Error duplicating quotation:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
