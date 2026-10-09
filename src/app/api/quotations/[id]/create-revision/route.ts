import { NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";

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

const REVISABLE = ['SENT', 'ACCEPTED'];
// ข้อมูลของรอบการส่ง/อนุมัติเดิม ไม่ติดไปฉบับใหม่
const RESET_FIELDS = ['linkedSo', 'approvedAt', 'approvedBy', 'sentAt', 'sentBy', 'sentChannel', 'supersededBy', 'supersededAt', 'lastSentAt'];

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
    if (!can(apiUser.role, 'sales:edit')) throw new ApiAuthError(403, 'สิทธิ์การใช้งานไม่เพียงพอ');
    if (!id) throw new ApiAuthError(400, 'ID เอกสารเป็นค่าว่าง');
    if (!changeSummary) throw new ApiAuthError(400, 'กรุณาระบุสรุปการเปลี่ยนแปลงของฉบับแก้ไข');

    const origRef = adminDb.doc(`companies/${companyId}/quotations/${id}`);
    const newRef = adminDb.collection(`companies/${companyId}/quotations`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const origSnap = await tx.get(origRef);
      if (!origSnap.exists) throw new ApiAuthError(404, 'ไม่พบใบเสนอราคาต้นฉบับ');
      const orig = origSnap.data() || {};
      const status = String(orig.status || 'DRAFT').toUpperCase();
      const docNo = orig.documentNo || orig.quotationNumber || orig.quoteId || origSnap.id;
      if (orig.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง`);
      if (status === 'SUPERSEDED' || orig.supersededBy) throw new ApiAuthError(409, `${docNo} ถูกแทนที่ด้วยฉบับใหม่แล้ว กรุณาออกฉบับแก้ไขจากฉบับล่าสุด`);
      if (orig.linkedSo || ['APPROVED', 'WON', 'CONVERTED'].includes(status)) {
        throw new ApiAuthError(409, `${docNo} แปลงเป็นใบสั่งขายแล้ว ออกฉบับแก้ไขไม่ได้ ให้แก้ที่ใบสั่งขายหรือออกใบลดหนี้/เพิ่มหนี้`);
      }
      if (!REVISABLE.includes(status)) {
        throw new ApiAuthError(409, `${docNo} ยังไม่ได้ส่งลูกค้า แก้ไขบนใบเดิมได้โดยไม่ต้องออกฉบับแก้ไข`);
      }
      const linesSnap = await tx.get(origRef.collection('lines'));

      // ---- คำนวณ ----
      const currentRev = Number(orig.revisionNumber) || 1;
      const newRev = currentRev + 1;
      const baseDocNo = String(docNo).replace(/-R\d+$/, '');
      const newDocNo = `${baseDocNo}-R${newRev}`;
      const createdIso = orig.createdAt?.toDate ? orig.createdAt.toDate().toISOString() : String(orig.createdAt || new Date().toISOString());
      const history: any[] = Array.isArray(orig.revisionHistory) && orig.revisionHistory.length
        ? orig.revisionHistory.map((h: any) => (h.revisionNumber === currentRev && !h.quotationId ? { ...h, quotationId: origSnap.id } : h))
        : [{ revisionNumber: currentRev, documentNumber: docNo, quotationId: origSnap.id, grandTotal: orig.grandTotal || 0, createdAt: createdIso, createdBy: orig.createdBy || '', changeSummary: 'ฉบับเริ่มต้น' }];
      history.push({
        revisionNumber: newRev,
        documentNumber: newDocNo,
        quotationId: newRef.id,
        grandTotal: orig.grandTotal || 0,
        createdAt: new Date().toISOString(),
        createdBy: apiUser.uid,
        changeSummary,
      });

      // ---- เขียน ----
      tx.update(origRef, { status: 'SUPERSEDED', supersededBy: newRef.id, supersededByNo: newDocNo, supersededAt: now, revisionHistory: history, updatedAt: now, updatedBy: apiUser.uid });
      const payload: Record<string, any> = { ...orig };
      RESET_FIELDS.forEach((f) => delete payload[f]);
      tx.set(newRef, {
        ...payload,
        id: newRef.id,
        companyId,
        documentNo: newDocNo,
        quotationNumber: newDocNo,
        revisionNumber: newRev,
        parentQuotationId: orig.parentQuotationId || origSnap.id,
        previousRevisionId: origSnap.id,
        revisionHistory: history,
        status: 'DRAFT',
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
        updatedBy: apiUser.uid,
        isDeleted: false,
      });
      linesSnap.forEach((line) => {
        const ref = newRef.collection('lines').doc();
        tx.set(ref, { ...line.data(), id: ref.id });
      });
      return { docNo, newDocNo, newRev };
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
