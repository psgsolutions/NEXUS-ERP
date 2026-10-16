import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { getCompanyCustomer, assertCreditAvailable } from "@/lib/credit-limit.server";
import { computeDocTotals, normalizeVatMode, sanitizeLines } from "@/lib/doc-totals";

/**
 * [API-SERVER] สร้างใบสั่งขาย (SO)
 * Endpoint: POST /api/sales/orders
 * body: { companyId, status: "Draft" | "Confirmed", header: { customerId, docDate, projectId?, paymentTermDays, vatType, billingAddress, deliveryAddress }, items }
 *
 * - เลข SO ออกในทรานแซกชัน (ไม่ข้าม), ยอดคำนวณที่ server
 * - ยืนยัน (Confirmed): ตรวจวงเงินเครดิตลูกค้าจากยอดค้างของใบกำกับภาษีจริง — เกินวงเงินบันทึกได้เฉพาะร่าง
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const VAT_LABEL = { exclusive: "Exclude VAT", inclusive: "Include VAT", none: "Non-VAT" } as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const h = body.header || {};
    const status = body.status === "Confirmed" ? "Confirmed" : "Draft";
    const items = sanitizeLines(body.items);
    if (!items.length) throw new ApiAuthError(400, "กรุณาเพิ่มรายการสินค้าหรือบริการอย่างน้อย 1 รายการ");
    const vatMode = normalizeVatMode(h.vatType);
    const t = computeDocTotals(items, vatMode);
    const customerId = str(h.customerId, 120);
    if (!customerId) throw new ApiAuthError(400, "กรุณาเลือกลูกค้า");

    // ลูกค้า (ที่เก็บหลักของบริษัท หรือ root รุ่นเก่าของบริษัทเดียวกัน)
    const cust = await getCompanyCustomer(companyId, customerId);
    if (!cust) throw new ApiAuthError(400, "ไม่พบลูกค้านี้ในบริษัท");
    const c = cust.data()!;
    const name = str(c.name || c.customerName || c.companyName || customerId, 200);

    // วงเงินเครดิต: ยอดค้างของใบกำกับภาษีที่ยังไม่ชำระครบ
    if (status === "Confirmed") await assertCreditAvailable(companyId, customerId, c, t.grandTotal);

    const projectId = str(h.projectId, 120);
    const project = projectId ? await adminDb.doc(`companies/${companyId}/projects/${projectId}`).get() : null;
    const take = await prepareSequence("SO", companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const billing = str(h.billingAddress, 1000);

    const soId = await adminDb.runTransaction(async (tx) => {
      const seq = await take(tx); const code = seq.number; seq.commit();
      tx.create(adminDb.doc(`companies/${companyId}/sales_orders/${code}`), {
        soId: code, documentNo: code, companyId,
        docDate: isDate(h.docDate) ? h.docDate : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
        customerId, customerName: name,
        customerSnapshot: { name, taxId: str(c.taxId, 20), branch: str(c.branch || c.branchCode, 20), address: billing },
        billingAddress: billing, deliveryAddress: str(h.deliveryAddress, 1000) || billing,
        projectId: project?.exists ? projectId : "", projectName: project?.exists ? str(project.data()!.projectName || project.data()!.title, 200) : "",
        paymentTermDays: Math.max(0, Math.min(365, Number(h.paymentTermDays) || 0)),
        vatType: VAT_LABEL[vatMode], taxMode: VAT_LABEL[vatMode], isVatRegistered: vatMode !== "none",
        items,
        subTotal: t.subTotal, totalDiscount: t.discount, vatAmount: t.vatAmount, grandTotal: t.grandTotal, totalAmount: t.grandTotal, totalRevenue: t.grandTotal,
        status, fulfillmentStatus: "pending",
        createdBy: apiUser.uid, createdByEmail: apiUser.email || "", updatedBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      return code;
    });
    await auditServer.logCreate(apiUser.uid, companyId, "SALES_ORDER", soId, { total: t.grandTotal, status });
    return NextResponse.json({ success: true, soId, totals: t });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SALES_ORDER_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบสั่งขายไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
