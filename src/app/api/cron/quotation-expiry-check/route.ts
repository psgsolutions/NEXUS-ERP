import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { isCronRequest } from '@/lib/api-auth';
import { quotationStage, quotationValidUntil } from '@/lib/quotation-status';

/**
 * [CRON] แจ้งเตือนใบเสนอราคาที่จะหมดอายุภายใน 3 วัน (รันวันละครั้งจาก Vercel Cron)
 * - ตรวจทีละบริษัท (ไม่ใช้ collectionGroup จึงไม่ต้องสร้าง index เพิ่ม)
 * - นับเฉพาะใบที่ยังไม่ปิด (รออนุมัติ / ส่งลูกค้าแล้ว) วันที่คิดตามเวลาไทย
 * - เอกสารแจ้งเตือนใช้ ID คงที่ต่อใบต่อวันหมดอายุ รันซ้ำทุกวันก็ไม่สร้างซ้ำ
 */
export async function GET(request: Request) {
  // ตรวจทุกบริษัท จึงอนุญาตเฉพาะ Vercel Cron ที่ส่ง CRON_SECRET มา
  if (!isCronRequest(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bkk = (offsetDays: number) => new Date(Date.now() + 7 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
    const todayStr = bkk(0);
    const targetDateStr = bkk(3);

    const companies = await adminDb.collection('companies').select().get();
    let checkedCount = 0;
    const notifications: any[] = [];

    for (const company of companies.docs) {
      const companyId = company.id;
      const snap = await adminDb.collection(`companies/${companyId}/quotations`).get();
      checkedCount += snap.size;
      const pending: Promise<unknown>[] = [];

      snap.forEach((docSnap) => {
        const q = docSnap.data();
        if (q.isDeleted === true || q.isSample) return;
        const stage = quotationStage(q, todayStr);
        if (stage !== 'pending' && stage !== 'sent') return;
        const validUntil = quotationValidUntil(q);
        if (!validUntil || validUntil < todayStr || validUntil > targetDateStr) return;

        const docNo = q.documentNo || q.quotationNumber || docSnap.id;
        const notifRef = adminDb.doc(`companies/${companyId}/notifications/QEXP-${docSnap.id}-${validUntil}`);
        // create: มีอยู่แล้ว (แจ้งไปเมื่อวาน) ไม่ทับ — สถานะอ่านแล้วไม่ถูกรีเซ็ต
        pending.push(notifRef.create({
          id: notifRef.id,
          companyId,
          type: 'QUOTATION_EXPIRING_SOON',
          title: `ใบเสนอราคาใกล้หมดอายุ (${docNo})`,
          message: `ใบเสนอราคา ${docNo} ของลูกค้า ${q.customerName || 'ไม่ระบุชื่อ'} จะหมดอายุวันที่ ${validUntil}`,
          targetUserId: q.salesPersonId || q.createdBy || '',
          targetDocId: docSnap.id,
          documentNo: docNo,
          validUntil,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isDeleted: false,
        }).then(() => true, (e: any) => { if (e?.code !== 6) throw e; return false; }));
        notifications.push({ companyId, id: docSnap.id, documentNo: docNo, validUntil });
      });

      await Promise.all(pending);
    }

    return NextResponse.json({ success: true, checkedCount, expiringCount: notifications.length, notifications });
  } catch (error: any) {
    console.error("Error running quotation expiry check cron:", error);
    return NextResponse.json({ success: false, error: 'ตรวจใบเสนอราคาใกล้หมดอายุไม่สำเร็จ' }, { status: 500 });
  }
}
