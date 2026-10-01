import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { isCronRequest } from '@/lib/api-auth';

export async function GET(request: Request) {
  // ตรวจทุกบริษัท (collectionGroup) จึงอนุญาตเฉพาะ Vercel Cron ที่ส่ง CRON_SECRET มา
  if (!isCronRequest(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const todayStr = today.toISOString().split('T')[0];
    const targetDateStr = threeDaysLater.toISOString().split('T')[0];

    const quotationsSnap = await adminDb.collectionGroup('quotations')
      .where('isDeleted', '==', false)
      .get();

    const notificationsCreated: any[] = [];

    const batch = adminDb.batch();

    quotationsSnap.forEach(docSnap => {
      const q = docSnap.data();
      const statusLower = String(q.status || '').toLowerCase();
      
      // Check active pending/sent quotes only
      if (['sent', 'pending', 'pending_approval'].includes(statusLower)) {
        const validUntil = q.validUntil || q.dueDate;
        if (validUntil && validUntil >= todayStr && validUntil <= targetDateStr) {
          const companyId = q.companyId || 'COM-NEXUS-01';
          const notifRef = adminDb.collection(`companies/${companyId}/notifications`).doc();
          
          const notifPayload = {
            id: notifRef.id,
            companyId,
            type: 'QUOTATION_EXPIRING_SOON',
            title: `⏰ ใบเสนอราคาใกล้หมดอายุ (${q.documentNo || q.quotationNumber})`,
            message: `ใบเสนอราคา ${q.documentNo || q.quotationNumber} ของลูกค้า ${q.customerName || q.customerInfo?.name || 'ไม่ระบุชื่อ'} กำลังจะหมดอายุในวันที่ ${validUntil}`,
            targetUserId: q.salesPersonId || q.createdBy || '',
            targetDocId: docSnap.id,
            documentNo: q.documentNo || q.quotationNumber,
            validUntil,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isDeleted: false
          };

          batch.set(notifRef, notifPayload);
          notificationsCreated.push({
            id: docSnap.id,
            documentNo: q.documentNo || q.quotationNumber,
            validUntil,
            salesPersonId: q.salesPersonId || q.createdBy
          });
        }
      }
    });

    if (notificationsCreated.length > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      checkedCount: quotationsSnap.size,
      expiringCount: notificationsCreated.length,
      notifications: notificationsCreated
    });

  } catch (error: any) {
    console.error("Error running quotation expiry check cron:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
