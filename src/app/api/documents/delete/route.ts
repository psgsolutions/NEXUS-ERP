import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { auditServer } from "@/services/audit.server";
import { normalizePoStatus } from "@/lib/procurement-status";
import { journalDateStr } from "@/lib/journal-posting";
import { can, type Permission } from "@/lib/permissions";

/**
 * [API-SERVER] ลบเอกสารที่ยังไม่มีผลต่อเนื่อง (ฝ่ายบัญชี: เอกสารจัดซื้อ/ค่าใช้จ่าย, ฝ่ายขาย: ใบสั่งขายร่าง)
 * Endpoint: POST /api/documents/delete
 * body: { companyId, kind: "purchase_order" | "expense" | "wht" | "sales_order" | "quotation" | "sample_invoice", id, reason? }
 *
 * - ใบสั่งซื้อ: ยังไม่รับสินค้า ยังไม่ตั้งเบิก -> ลบ และคืนสถานะใบขอซื้อเป็นอนุมัติแล้ว
 * - รายการค่าใช้จ่าย: ยังไม่จ่าย ยังไม่บันทึกภาษีซื้อ/ตั้งหนี้ ยังไม่ออกหนังสือรับรอง -> ลบ และปลดล็อกใบสั่งซื้อ
 * - หนังสือรับรองหัก ณ ที่จ่าย: รายการยังไม่จ่าย และงวดภาษียังไม่ยื่น -> ยกเลิก (เก็บเอกสารไว้ เลขที่ไม่หาย) และปลดจากรายการค่าใช้จ่าย
 * - ใบสั่งขาย: ร่าง/ยกเลิก ยังไม่ออกใบกำกับ ไม่มีใบสั่งงานหรือค่าใช้จ่ายอ้างอิง -> ลบ
 * - ใบเสนอราคา: ร่าง/ไม่อนุมัติ เท่านั้น · ใบแจ้งหนี้ตัวอย่าง (isSample): ลบจริงได้ (ไม่ใช่เอกสารจริง)
 * ตรวจในทรานแซกชันเดียว · เอกสารจริงไม่ถูกลบออกจากฐานข้อมูล: เปลี่ยนเป็น VOID + isDeleted (ซ่อนจากรายการ)
 * พร้อมเหตุผล ผู้ทำ และเวลา เลขที่เอกสารจึงไม่หายและไม่ถูกนำกลับมาใช้
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const KINDS = {
  purchase_order: { col: "purchase_orders", label: "ใบสั่งซื้อ", audit: "PURCHASE_ORDER" },
  expense: { col: "expenses", label: "รายการค่าใช้จ่าย", audit: "EXPENSE" },
  wht: { col: "withholding_taxes", label: "หนังสือรับรองหัก ณ ที่จ่าย", audit: "WHT_CERTIFICATE" },
  sales_order: { col: "sales_orders", label: "ใบสั่งขาย", audit: "SALES_ORDER" },
  quotation: { col: "quotations", label: "ใบเสนอราคา", audit: "QUOTATION" },
  sample_invoice: { col: "invoices", label: "ใบแจ้งหนี้ตัวอย่าง", audit: "SAMPLE_INVOICE" },
} as const;
type Kind = keyof typeof KINDS;
const DELETE_PERMISSION: Record<Kind, Permission> = {
  purchase_order: "finance:delete",
  expense: "finance:delete",
  wht: "finance:delete",
  sales_order: "sales:delete",
  quotation: "sales:delete",
  sample_invoice: "finance:delete",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const kind = str(body.kind, 40) as Kind;
    const id = str(body.id, 120);
    if (!(kind in KINDS) || !id || id.includes("/")) throw new ApiAuthError(400, "ไม่พบเอกสารที่ต้องการลบ");
    if (!can(apiUser.roles, DELETE_PERMISSION[kind])) throw new ApiAuthError(403, "ไม่มีสิทธิ์ลบเอกสารประเภทนี้");
    const { col, label, audit } = KINDS[kind];
    const ref = adminDb.doc(`companies/${companyId}/${col}/${id}`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const base = `companies/${companyId}`;

    // เอกสารปลายทางที่อ้างถึง (query นอกทรานแซกชัน; ตรวจสถานะเอกสารหลักซ้ำในทรานแซกชัน)
    const exists = async (c: string, field: string, value: string) =>
      !(await adminDb.collection(`${base}/${c}`).where(field, "==", value).limit(1).get()).empty;

    const before = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiAuthError(404, `ไม่พบ${label} ${id}`);
      const d = snap.data()!;
      if (d.isDeleted === true && kind !== "sample_invoice") throw new ApiAuthError(409, `${label} ${id} ถูกยกเลิกไปแล้ว`);
      const own = { purchase_order: d.poCode, expense: d.expenseId, wht: d.whtId, sales_order: d.soId, quotation: d.documentNo || d.quotationNumber, sample_invoice: d.invoiceNo }[kind];
      const docNo = String(own || d.documentNo || id);
      // ยกเลิกแทนการลบ: เก็บเอกสารไว้ตรวจสอบย้อนหลัง
      const voidIt = () => tx.update(ref, { status: "VOID", statusBeforeVoid: d.status ?? null, isDeleted: true, voidReason: str(body.reason, 300) || "ลบโดยผู้ใช้", voidedBy: apiUser.uid, voidedAt: now, updatedAt: now, updatedBy: apiUser.uid });

      if (kind === "purchase_order") {
        const st = normalizePoStatus(d.status);
        if (st === "RECEIVED" || st === "PARTIAL_RECEIVED") throw new ApiAuthError(409, `${docNo} รับสินค้าแล้ว ลบไม่ได้`);
        if (d.expenseId) throw new ApiAuthError(409, `${docNo} ตั้งเบิกค่าใช้จ่ายแล้ว (${d.expenseId}) ลบไม่ได้`);
        if (await exists("goods_receipts", "poRef", docNo) || (docNo !== id && await exists("goods_receipts", "poRef", id))) {
          throw new ApiAuthError(409, `${docNo} มีใบรับสินค้าอ้างอิง ลบไม่ได้`);
        }
        const prRef = d.prRef ? adminDb.doc(`${base}/purchase_requests/${str(d.prRef, 120)}`) : null;
        const pr = prRef ? await tx.get(prRef) : null;
        voidIt();
        if (prRef && pr?.exists && pr.data()!.status === "CONVERTED" && pr.data()!.poCode === docNo) {
          tx.update(prRef, { status: "APPROVED", poCode: admin.firestore.FieldValue.delete(), updatedAt: now, updatedBy: apiUser.uid });
        }
      }

      if (kind === "expense") {
        if ((Number(d.paidAmount) || 0) > 0 || ["paid", "partially paid"].includes(String(d.status || "").toLowerCase())) {
          throw new ApiAuthError(409, `${docNo} มีการจ่ายเงินแล้ว ลบไม่ได้ (ยกเลิกใบสำคัญจ่ายก่อน)`);
        }
        if (d.apPosted) throw new ApiAuthError(409, `${docNo} บันทึกภาษีซื้อ/ตั้งหนี้แล้ว ลบไม่ได้`);
        if (d.whtId || (Array.isArray(d.paymentWhtIds) && d.paymentWhtIds.length)) throw new ApiAuthError(409, `${docNo} ออกหนังสือรับรองหัก ณ ที่จ่ายแล้ว ลบหนังสือรับรองก่อน`);
        const poRef = d.poRef ? adminDb.doc(`${base}/purchase_orders/${str(d.poRef, 120)}`) : null;
        const po = poRef ? await tx.get(poRef) : null;
        voidIt();
        if (poRef && po?.exists && po.data()!.expenseId === docNo) {
          tx.update(poRef, { expenseId: admin.firestore.FieldValue.delete(), updatedAt: now, updatedBy: apiUser.uid });
        }
      }

      if (kind === "wht") {
        const period = journalDateStr(d.filingDate || d.issuedAt || d.createdAt).slice(0, 7);
        const lockRefs = ["PND3", "PND53"].map((t) => adminDb.doc(`${base}/tax_filing_locks/${companyId}_${t}_${period}`));
        const expRef = d.expenseId ? adminDb.doc(`${base}/expenses/${str(d.expenseId, 120)}`) : null;
        const [locks, exp] = await Promise.all([Promise.all(lockRefs.map((r) => tx.get(r))), expRef ? tx.get(expRef) : Promise.resolve(null)]);
        if (period && locks.some((l) => l.exists)) throw new ApiAuthError(409, `ยื่นภาษีหัก ณ ที่จ่ายงวด ${period} แล้ว ลบ ${docNo} ไม่ได้`);
        if (exp?.exists && (Number(exp.data()!.paidAmount) || 0) > 0) throw new ApiAuthError(409, `รายการค่าใช้จ่าย ${exp.id} จ่ายเงินแล้ว ลบ ${docNo} ไม่ได้`);
        if (String(d.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, `${docNo} ยกเลิกไปแล้ว`);
        // หนังสือรับรองมีเลขที่ต่อเนื่อง: ยกเลิกแทนการลบ (ไม่ส่งยื่น ภ.ง.ด. แต่ยังตรวจสอบย้อนหลังได้)
        tx.update(ref, { status: "Cancelled", isDeleted: true, cancelReason: str(body.reason, 300) || "ยกเลิกโดยผู้ใช้", cancelledBy: apiUser.uid, cancelledAt: now, updatedAt: now });
        if (expRef && exp?.exists && exp.data()!.whtId === docNo) {
          const del = admin.firestore.FieldValue.delete();
          tx.update(expRef, { whtId: del, whtRate: del, whtAmount: del, updatedAt: now, updatedBy: apiUser.uid });
        }
      }

      if (kind === "sales_order") {
        const st = String(d.status || "").toUpperCase();
        if (!["DRAFT", "CANCELLED"].includes(st)) throw new ApiAuthError(409, `${docNo} อนุมัติแล้ว ลบไม่ได้ (ยกเลิกแทน)`);
        if (d.invoiceNo || d.invoiceDocId) throw new ApiAuthError(409, `${docNo} ออกใบกำกับภาษีแล้ว ลบไม่ได้`);
        if (await exists("work_orders", "soId", id)) throw new ApiAuthError(409, `${docNo} มีใบสั่งงานอ้างอิง ลบไม่ได้`);
        if (await exists("expenses", "soId", id)) throw new ApiAuthError(409, `${docNo} มีรายการค่าใช้จ่ายอ้างอิง ลบไม่ได้`);
        voidIt();
      }

      if (kind === "quotation") {
        // ลบได้เฉพาะใบที่ยังไม่ส่งออกไปภายนอก (ร่าง/ไม่อนุมัติ) ตรงกับปุ่มลบในหน้างานขาย
        if (!["DRAFT", "REJECTED"].includes(String(d.status || "DRAFT").toUpperCase())) throw new ApiAuthError(409, `${docNo} ส่งหรืออนุมัติแล้ว ลบไม่ได้`);
        voidIt();
      }

      if (kind === "sample_invoice") {
        if (d.isSample !== true) throw new ApiAuthError(409, "ลบได้เฉพาะเอกสารตัวอย่าง ใบกำกับภาษีจริงต้องออกใบลดหนี้");
        tx.delete(ref);
      }
      return d;
    });

    await auditServer.logDelete(apiUser.uid, companyId, audit, id);
    return NextResponse.json({ success: true, id, status: before.status || null });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[DOCUMENT_DELETE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ลบเอกสารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
