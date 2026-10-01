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
    const { changeSummary = '', companyId = 'COM-NEXUS-01' } = body;
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
    const currentStatus = String(origData.status || '').toLowerCase();

    if (currentStatus === 'draft') {
      return NextResponse.json(
        { success: false, error: 'ใบเสนอราคาที่อยู่ในสถานะแบบร่าง (Draft) ไม่สามารถสร้างฉบับแก้ไขได้ ให้แก้ไขบนใบเดิม' },
        { status: 400 }
      );
    }

    const currentRev = Number(origData.revisionNumber) || 1;
    const newRevNumber = currentRev + 1;
    
    // Base document number (strip existing -R{n} if present)
    const rawDocNo = origData.documentNo || origData.quotationNumber || `QT-0000`;
    const baseDocNo = rawDocNo.split('-R')[0];
    const newDocNo = `${baseDocNo}-R${newRevNumber}`;

    const newRevEntry = {
      revisionNumber: newRevNumber,
      documentNumber: newDocNo,
      grandTotal: origData.grandTotal || 0,
      createdAt: new Date().toISOString(),
      createdBy: userUid || origData.createdBy || '',
      changeSummary: changeSummary.trim() || `ปรับปรุงแก้ไขฉบับที่ ${newRevNumber}`
    };

    const existingHistory = Array.isArray(origData.revisionHistory) ? origData.revisionHistory : [];
    
    // Include initial rev 1 if history was empty
    let updatedHistory = [...existingHistory];
    if (updatedHistory.length === 0) {
      updatedHistory.push({
        revisionNumber: currentRev,
        documentNumber: rawDocNo,
        grandTotal: origData.grandTotal || 0,
        createdAt: origData.createdAt ? (origData.createdAt.toDate ? origData.createdAt.toDate().toISOString() : String(origData.createdAt)) : new Date().toISOString(),
        createdBy: origData.createdBy || '',
        changeSummary: 'ฉบับเริ่มต้น'
      });
    }
    updatedHistory.push(newRevEntry);

    const batch = adminDb.batch();

    // 1. Mark original quote as superseded
    batch.update(origSnap.ref, {
      status: 'superseded',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: userUid
    });

    // 2. Create new revision document
    const newDocRef = adminDb.collection(`companies/${companyId}/quotations`).doc();
    
    const newPayload = {
      ...origData,
      id: newDocRef.id,
      companyId,
      documentNo: newDocNo,
      quotationNumber: newDocNo,
      revisionNumber: newRevNumber,
      parentQuotationId: origData.parentQuotationId || origSnap.id,
      revisionHistory: updatedHistory,
      status: 'draft',
      createdBy: userUid || origData.createdBy || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isDeleted: false
    };

    batch.set(newDocRef, newPayload);

    // 3. Copy line items
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
      revisionNumber: newRevNumber,
      message: `สร้างฉบับแก้ไข ${newDocNo} สำเร็จ`
    });

  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("Error creating quotation revision:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
