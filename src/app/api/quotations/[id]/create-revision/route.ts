import { NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { revisionBlockReason, writeQuotationRevision } from "@/lib/quotation-revision.server";

/**
 * [API-SERVER] สร้างฉบับแก้ไข (Revision) ของใบเสนอราคา
 * Endpoint: POST /api/quotations/{id}/create-revision  { companyId, changeSummary }
 *
 * กติกา:
 *  - ออกได้เฉพาะใบที่ส่งลูกค้าแล้ว (SENT / ACCEPTED) และเป็นฉบับล่าสุด (ยังไม่ถูกแทนที่)
 *  - ใบที่ได้งานแล้ว (แปลงเป็นใบสั่งขาย) ออกไม่ได้ — แก้ที่ใบสั่งขาย / ใบลดหนี้-เพิ่มหนี้
 *  - ร่าง / รออนุมัติ / ตีกลับ แก้บนใบเดิมได้ ไม่ต้องออก Revision
 *  - ต้องระบุสรุปการเปลี่ยนแปลง
 * ทำในทรานแซกชันเดียว: ใบเดิมเป็น superseded + สร้างใบใหม่ (-R{n}, ร่าง) + คัดลอกรายการ
 * ถ้ากดพร้อมกัน ทรานแซกชันที่สองจะเห็นว่าใบเดิมถูกแทนที่แล้วและถูกปฏิเสธ (เลขไม่ซ้ำ)
 */

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || '').trim();
    const changeSummary = String(body.changeSummary || '').trim().slice(0, 500);
    if (!companyId) throw new ApiAuthError(400, 'ไม่พบรหัสบริษัท');
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, 'sales:edit')) throw new ApiAuthError(403, 'สิทธิ์การใช้งานไม่เพียงพอ');
    if (!id) throw new ApiAuthError(400, 'ID เอกสารเป็นค่าว่าง');
    if (!changeSummary) throw new ApiAuthError(400, 'กรุณาระบุสรุปการเปลี่ยนแปลงของฉบับแก้ไข');

    const origRef = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const newRef = adminDb.collection(`companies/${companyId}/quotations`).doc();

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const origSnap = await tx.get(origRef);
      if (!origSnap.exists) throw new ApiAuthError(404, 'ไม่พบใบเสนอราคาต้นฉบับ');
      const orig = origSnap.data() || {};
      const docNo = orig.documentNo || orig.quotationNumber || orig.quoteId || origSnap.id;
      const blocked = revisionBlockReason(orig, docNo);
      if (blocked) throw new ApiAuthError(blocked.includes("ตัวอย่าง") ? 400 : 409, blocked);
      const linesSnap = await tx.get(origRef.collection('lines'));
      return writeQuotationRevision(tx, {
        companyId, origRef, orig, origId: origSnap.id, newRef,
        oldLines: linesSnap.docs.map((d) => d.data()), uid: apiUser.uid, changeSummary,
      });
    });

    await auditServer.logCreate(apiUser.uid, companyId, 'SALES_QUOTATION', result.newDocNo, { revisionOf: result.docNo, revisionNumber: result.newRev, changeSummary });

    return NextResponse.json({
      success: true,
      newQuotationId: newRef.id,
      newDocumentNo: result.newDocNo,
      revisionNumber: result.newRev,
      message: `สร้างฉบับแก้ไข ${result.newDocNo} สำเร็จ`,
    });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("Error creating quotation revision:", error);
    return NextResponse.json({ success: false, error: 'สร้างฉบับแก้ไขไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
