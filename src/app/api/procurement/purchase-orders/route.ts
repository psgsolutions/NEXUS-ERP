import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, purchaseApprovalLimit } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { computeDocTotals, normalizeVatMode, sanitizeLines } from "@/lib/doc-totals";
import { getRecord } from "@/lib/master-store.server";
import { getProduct } from "@/lib/product-store.server";
import { loadReorder } from "@/lib/reorder.server";
import type { ReorderLine } from "@/lib/reorder";

/**
 * [API-SERVER] ใบสั่งซื้อ (PO)
 * Endpoint: POST /api/procurement/purchase-orders
 *  - { companyId, action: "create", header: {...}, items: [...], prId? }
 *      เลข PO ออกในทรานแซกชัน (ไม่ข้าม) ยอดคำนวณที่ server (บาทตามอัตราแลกเปลี่ยน)
 *      สร้างจากใบขอซื้อ: ใบขอซื้อต้องอนุมัติแล้วและยังไม่ถูกแปลง -> CONVERTED ในทรานแซกชันเดียวกัน
 *  - { companyId, action: "reorderCreate", groups: [{ supplierId, items: [{ productId, qty }] }], setPrimary? }
 *      สินค้าถึงจุดสั่งซื้อ → ใบสั่งซื้อแยกใบละผู้ขาย (รออนุมัติตามปกติ)
 *  - { companyId, action: "approve", poId }  ยอดเกิน 50,000 บาทต้อง SUPERADMIN
 *  - { companyId, action: "cancel", poId }   ยกเลิกไม่ได้เมื่อรับสินค้าแล้ว
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const EDIT = ["procurement:edit", "finance:edit"] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const allowed = action === "approve" ? can(apiUser.roles, "procurement:approve") : EDIT.some((p) => can(apiUser.roles, p)) || can(apiUser.roles, "procurement:approve");
    if (!allowed) throw new ApiAuthError(403, action === "approve" ? "อนุมัติใบสั่งซื้อได้เฉพาะฝ่ายบัญชีหรือผู้บริหาร" : "สิทธิ์การใช้งานไม่เพียงพอ");
    const approvalLimit = purchaseApprovalLimit(apiUser.roles);

    const createPo = async (h: any, rawItems: any, prId: string) => {
      const items = sanitizeLines(rawItems).map((it) => ({ ...it, qtyReceived: 0 }));
      if (!str(h.supplierId)) throw new ApiAuthError(400, "กรุณาระบุคู่ค้า");
      if (!items.length) throw new ApiAuthError(400, "กรุณาเพิ่มรายการสั่งซื้อ");
      const orderType = str(h.orderType, 20) || "STOCK";
      if (orderType === "PROJECT" && !str(h.projectId)) throw new ApiAuthError(400, "กรุณาเลือกโครงการ");
      const currency = str(h.currency, 5) || "THB";
      const rate = currency === "THB" ? 1 : Math.max(0.0001, Number(h.exchangeRate) || 1);
      const vatType = normalizeVatMode(h.vatType);
      // หัก ณ ที่จ่ายรายบรรทัด (ค่าบริการ/ค่าแรงในใบสั่งซื้อ) — ใช้ตั้งเบิกและจ่ายเงิน
      const t = computeDocTotals(items, vatType, "lines");
      const sup = (await getRecord("suppliers", companyId, str(h.supplierId, 120)))?.data || null;
      const take = await prepareSequence("PO", companyId);

      const poCode = await adminDb.runTransaction(async (tx) => {
        let prRef: admin.firestore.DocumentReference | null = null;
        if (prId) {
          prRef = adminDb.doc(`companies/${companyId}/purchase_requests/${prId}`);
          const prSnap = await tx.get(prRef);
          if (!prSnap.exists) throw new ApiAuthError(404, "ไม่พบใบขอซื้อที่อ้างอิง");
          const st = String(prSnap.data()!.status || "").toUpperCase();
          if (st === "CONVERTED") throw new ApiAuthError(409, `ใบขอซื้อ ${prId} ถูกแปลงเป็นใบสั่งซื้อแล้ว (${prSnap.data()!.poCode || ""})`);
          if (st !== "APPROVED") throw new ApiAuthError(409, `ใบขอซื้อ ${prId} ยังไม่อนุมัติ`);
        }
        const seq = await take(tx);
        const code = seq.number;
        seq.commit();
        tx.create(adminDb.doc(`companies/${companyId}/purchase_orders/${code}`), {
          poCode: code, documentNo: code, companyId,
          orderType, supplierId: str(h.supplierId, 120), supplierName: str(sup?.name || sup?.supplierName || h.supplierName, 200),
          reference: str(h.reference, 120), prRef: prId,
          projectId: str(h.projectId, 120), projectName: str(h.projectName, 200),
          department: str(h.department, 120), warehouseCode: orderType === "STOCK" ? str(h.warehouseCode, 40) : "",
          date: isDate(h.date) ? h.date : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
          expectedDate: isDate(h.expectedDate) ? h.expectedDate : "",
          vatType: vatType === "exclusive" ? "Exclusive" : vatType === "inclusive" ? "Inclusive" : "None",
          currency, exchangeRate: rate,
          incoterm: str(h.incoterm, 20), incotermPlace: str(h.incotermPlace, 120), paymentTerm: str(h.paymentTerm, 60),
          shippingMethod: str(h.shippingMethod, 60), terms: str(h.terms, 2000),
          deliveryAddress: str(h.deliveryAddress, 1000), contactPerson: str(h.contactPerson, 120), contactPhone: str(h.contactPhone, 40), remark: str(h.remark, 2000),
          // ผู้ขาย ณ วันออกใบสั่งซื้อ (พิมพ์ซ้ำตรงเดิมแม้แก้ข้อมูลผู้ขายภายหลัง)
          supplierSnapshot: sup ? {
            name: str(sup.taxInvoiceName || sup.name || sup.supplierName, 200), taxId: str(sup.taxId || sup.tax_id, 20), branchCode: str(sup.branchCode || sup.branch_code, 20),
            address: str(sup.address || [sup.addressNo, sup.subDistrict, sup.district, sup.province, sup.zipCode].filter(Boolean).join(" "), 1000),
            phone: str(sup.phone || sup.phoneNumber, 40), email: str(sup.email, 160), contactName: str(sup.contactPerson || sup.contactName || sup.contact_name, 120),
          } : null,
          items,
          subTotal: r2(t.subTotal * rate), vatAmount: r2(t.vatAmount * rate), totalAmount: r2(t.grandTotal * rate),
          totalAmountForeign: t.grandTotal, discountTotal: r2(t.discount * rate),
          whtAmount: r2(t.whtAmount * rate), netPayable: r2(t.netPayable * rate),
          status: "PENDING_APPROVAL",
          createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, updatedAt: now, isDeleted: false,
        });
        if (prRef) tx.update(prRef, { status: "CONVERTED", poCode: code, updatedAt: now, updatedBy: apiUser.uid });
        return code;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "PURCHASE_ORDER", poCode, { total: r2(t.grandTotal * rate), prId, ...(h.source ? { source: str(h.source, 40) } : {}) });
      return { poCode, total: r2(t.grandTotal * rate) };
    };

    if (action === "create") {
      const { poCode } = await createPo(body.header || {}, body.items, str(body.prId, 120));
      return NextResponse.json({ success: true, poCode });
    }

    // ---------- จุดสั่งซื้อ → ใบสั่งซื้อ แยกใบละผู้ขาย ----------
    // groups: [{ supplierId, items: [{ productId, qty }] }] — ราคา/รายการคิดใหม่ที่ server จากรายการแนะนำ (สินค้าต้องยังอยู่ในรายการ)
    // setPrimary: ผู้ขายที่เลือกเองบันทึกเป็นผู้ขายหลักของสินค้า (ครั้งหน้าระบบจัดกลุ่มให้เอง)
    if (action === "reorderCreate") {
      if (!EDIT.some((p) => can(apiUser.roles, p))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const groups = (Array.isArray(body.groups) ? body.groups : []).slice(0, 50);
      if (!groups.length) throw new ApiAuthError(400, "เลือกสินค้าที่ต้องการสั่งซื้ออย่างน้อย 1 รายการ");
      const lines = new Map((await loadReorder(companyId, { includeUnset: true })).map((l) => [l.productId, l]));
      const today = new Date(Date.now() + 7 * 3600e3);
      const plan: { supplierId: string; items: { l: ReorderLine; qty: number }[] }[] = [];
      const seen = new Set<string>();
      for (const g of groups) {
        const supplierId = str(g?.supplierId, 120);
        const items: { l: ReorderLine; qty: number }[] = [];
        for (const x of Array.isArray(g?.items) ? g.items : []) {
          const id = str(x?.productId, 120), qty = Math.min(1_000_000, Math.max(0, Math.ceil(Number(x?.qty) || 0)));
          const l = lines.get(id);
          if (!qty || seen.has(id)) continue;
          if (!l) throw new ApiAuthError(409, `สินค้า ${id} ไม่อยู่ในรายการแนะนำแล้ว (อาจมีของหรือสั่งไปแล้ว) — โหลดรายการใหม่`);
          seen.add(id); items.push({ l, qty });
        }
        if (!items.length) continue;
        if (!supplierId) throw new ApiAuthError(400, `เลือกผู้ขายให้สินค้า ${items[0].l.name}${items.length > 1 ? ` และอีก ${items.length - 1} รายการ` : ""}`);
        if (!(await getRecord("suppliers", companyId, supplierId))) throw new ApiAuthError(404, `ไม่พบผู้ขาย ${supplierId}`);
        const same = plan.find((p) => p.supplierId === supplierId);
        if (same) same.items.push(...items); else plan.push({ supplierId, items });
      }
      if (!plan.length) throw new ApiAuthError(400, "เลือกสินค้าที่ต้องการสั่งซื้ออย่างน้อย 1 รายการ");
      const created: { poCode: string; supplierId: string; items: number; total: number }[] = [];
      for (const g of plan) {
        const lead = Math.max(7, ...g.items.map((x) => x.l.leadTimeDays || 0));
        const r = await createPo({
          supplierId: g.supplierId, orderType: "STOCK", vatType: "exclusive", source: "REORDER",
          date: today.toISOString().slice(0, 10), expectedDate: new Date(today.getTime() + lead * 86_400_000).toISOString().slice(0, 10),
          remark: `สั่งซื้อตามจุดสั่งซื้อ: สินค้า ${g.items.length} รายการ (สร้างจากรายการแนะนำของระบบ)`,
        }, g.items.map(({ l, qty }) => ({ productId: l.productId, sku: l.sku, name: l.name, qty, unit: l.unit, price: l.unitCost, cost: l.unitCost, itemType: "PRODUCT" })), "");
        created.push({ poCode: r.poCode, supplierId: g.supplierId, items: g.items.length, total: r.total });
      }
      // ผู้ขายหลักของสินค้า: เพิ่มผู้ขายที่เลือกไว้ใน supplierConfig และตั้งเป็นหลัก (เฉพาะสินค้าที่ผู้ขายต่างจากผู้ขายหลักเดิม)
      let primarySet = 0;
      if (body.setPrimary === true) {
        for (const g of plan) for (const { l } of g.items) {
          if (l.supplierSource === "primary" && l.supplierId === g.supplierId) continue;
          const h = await getProduct(companyId, l.productId);
          if (!h) continue;
          const list: any[] = Array.isArray(h.data.supplierConfig) ? h.data.supplierConfig.filter((c: any) => c && c.supplierId) : [];
          const has = list.some((c) => c.supplierId === g.supplierId);
          const next = (has ? list : [...list, { supplierId: g.supplierId, leadTimeDays: 7, latestCost: l.unitCost || 0 }]).map((c) => ({ ...c, isPrimary: c.supplierId === g.supplierId }));
          await h.ref.update({ supplierConfig: next, updatedAt: now });
          primarySet++;
        }
      }
      return NextResponse.json({ success: true, created, primarySet });
    }

    if (action === "approve" || action === "cancel") {
      const poId = str(body.poId, 120);
      if (!poId) throw new ApiAuthError(400, "ไม่พบใบสั่งซื้อ");
      const ref = adminDb.doc(`companies/${companyId}/purchase_orders/${poId}`);
      // เคยรับสินค้าแล้ว (อ้างอิงใบสั่งซื้อนี้) -> ยกเลิกไม่ได้
      const received = action === "cancel" ? !(await adminDb.collection(`companies/${companyId}/goods_receipts`).where("poRef", "==", poId).limit(1).get()).empty : false;
      const status = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบสั่งซื้อ");
        const po = snap.data()!;
        const st = String(po.status || "").toUpperCase();
        if (action === "approve") {
          if (!["PENDING_APPROVAL", "PENDING", "DRAFT"].includes(st)) throw new ApiAuthError(409, "ใบสั่งซื้อนี้อนุมัติไปแล้วหรือถูกยกเลิก");
          if (Number(po.totalAmount) > approvalLimit) throw new ApiAuthError(403, `ยอดเกินวงเงินอนุมัติของคุณ (${approvalLimit.toLocaleString("th-TH")} บาท) ต้องให้ผู้บริหารอนุมัติ`);
          tx.update(ref, { status: "Approved", approvedBy: apiUser.uid, approvedAt: now, updatedAt: now, updatedBy: apiUser.uid });
          return "Approved";
        }
        if (["CANCELLED", "RECEIVED", "COMPLETED", "CLOSED"].includes(st) || received || po.expenseId) throw new ApiAuthError(409, "ใบสั่งซื้อนี้รับสินค้า/ตั้งเบิกแล้ว หรือถูกยกเลิกแล้ว ยกเลิกไม่ได้");
        const prRef = po.prRef ? adminDb.doc(`companies/${companyId}/purchase_requests/${po.prRef}`) : null;
        const prSnap = prRef ? await tx.get(prRef) : null;
        tx.update(ref, { status: "CANCELLED", cancelReason: str(body.reason, 300), cancelledAt: now, cancelledBy: apiUser.uid, updatedAt: now, updatedBy: apiUser.uid });
        // ใบขอซื้อที่แปลงมา กลับเป็น "อนุมัติแล้ว" เพื่อออกใบสั่งซื้อใหม่ได้
        if (prRef && prSnap?.exists && prSnap.data()!.poCode === poId) tx.update(prRef, { status: "APPROVED", poCode: "", cancelledPoCode: poId, updatedAt: now, updatedBy: apiUser.uid });
        return "CANCELLED";
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "PURCHASE_ORDER", poId, {}, { status });
      return NextResponse.json({ success: true, poId, status });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PURCHASE_ORDER_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบสั่งซื้อไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
