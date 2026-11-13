import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { computeDocTotals, normalizeVatMode, sanitizeLines } from "@/lib/doc-totals";
import { loadReorder } from "@/lib/reorder.server";

/**
 * [API-SERVER] ใบขอซื้อ (PR)
 * Endpoint: POST /api/procurement/purchase-requests
 *  - { companyId, action: "create", header: {...}, items: [...] }  -> เลข PR ออกในทรานแซกชัน (ไม่ข้าม) ยอดคำนวณที่ server
 *  - { companyId, action: "approve" | "reject" | "cancel", prId, note? }
 *  - { companyId, action: "reorderPreview", includeUnset? }  สินค้าที่ถึงจุดสั่งซื้อ (หักที่กำลังขอซื้อ/สั่งซื้ออยู่แล้ว) พร้อมจำนวนที่ควรสั่ง
 *  - { companyId, action: "reorderCreate", items: [{ productId, qty }] }  สร้างใบขอซื้อจากรายการที่เลือก (รออนุมัติตามปกติ)
 * ผู้ขอซื้ออนุมัติใบของตัวเองไม่ได้ (ยกเว้น SUPERADMIN)
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const EDIT = ["procurement:edit", "inventory:edit", "projects:edit", "finance:edit", "sales:edit"] as const;
const APPROVE = ["procurement:approve"] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const role = apiUser.role;

    // ---------- จุดสั่งซื้อ → ใบขอซื้อ ----------
    let reorder: { h: any; items: any[] } | null = null;
    if (action === "reorderPreview" || action === "reorderCreate") {
      if (!EDIT.some((p) => can(apiUser.roles, p))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const lines = await loadReorder(companyId, { includeUnset: action === "reorderCreate" || body.includeUnset === true });
      if (action === "reorderPreview") return NextResponse.json({ success: true, lines });
      const pick = new Map<string, number>((Array.isArray(body.items) ? body.items : []).map((x: any) => [str(x?.productId, 120), Math.min(1_000_000, Math.max(0, Math.ceil(Number(x?.qty) || 0)))]));
      const chosen = lines.filter((l) => (pick.get(l.productId) || 0) > 0);
      if (!chosen.length) throw new ApiAuthError(400, "เลือกสินค้าที่ต้องการขอซื้ออย่างน้อย 1 รายการ (สินค้าต้องยังต่ำกว่าจุดสั่งซื้อ)");
      const today = new Date(Date.now() + 7 * 3600e3);
      const lead = Math.max(7, ...chosen.map((l) => l.leadTimeDays || 0));
      const suppliers = [...new Set(chosen.map((l) => l.supplierId).filter(Boolean))];
      reorder = {
        h: {
          requester: str((apiUser as any).name || apiUser.email || "", 120), department: "คลังสินค้า", priority: "ปกติ",
          requestDate: today.toISOString().slice(0, 10), requiredDate: new Date(today.getTime() + lead * 86_400_000).toISOString().slice(0, 10),
          reason: `สั่งซื้อตามจุดสั่งซื้อ: สินค้า ${chosen.length} รายการต่ำกว่าจุดสั่งซื้อ (สร้างจากรายการแนะนำของระบบ)`,
          ...(suppliers.length === 1 ? { suggestedSupplierId: suppliers[0], suggestedSupplierName: chosen.find((l) => l.supplierId === suppliers[0])?.supplierName || "" } : {}),
          vatMode: "exclusive",
        },
        items: chosen.map((l) => ({ productId: l.productId, sku: l.sku, name: l.name, qty: pick.get(l.productId), unit: l.unit, price: l.unitCost, cost: l.unitCost, itemType: "PRODUCT" })),
      };
    }

    if (action === "create" || action === "reorderCreate") {
      if (!EDIT.some((p) => can(apiUser.roles, p))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const h = reorder?.h || body.header || {};
      const items = sanitizeLines(reorder?.items || body.items);
      if (!items.length) throw new ApiAuthError(400, "กรุณาเพิ่มรายการที่ต้องการขอซื้อ");
      if (!isDate(h.requiredDate)) throw new ApiAuthError(400, "กรุณาระบุวันที่ต้องการใช้งาน");
      if (!str(h.reason)) throw new ApiAuthError(400, "กรุณาระบุวัตถุประสงค์ / ความจำเป็น");
      const vatMode = normalizeVatMode(h.vatMode);
      const whtRate = [0, 1, 2, 3, 5].includes(Number(h.whtRate)) ? Number(h.whtRate) : 0;
      const t = computeDocTotals(items, vatMode, whtRate);
      const take = await prepareSequence("PR", companyId);

      const prCode = await adminDb.runTransaction(async (tx) => {
        const seq = await take(tx);
        const code = seq.number;
        seq.commit();
        tx.create(adminDb.doc(`companies/${companyId}/purchase_requests/${code}`), {
          prCode: code, documentNo: code, companyId,
          requester: str(h.requester, 120), requesterUid: apiUser.uid,
          department: str(h.department, 120),
          requestDate: isDate(h.requestDate) ? h.requestDate : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
          requiredDate: isDate(h.requiredDate) ? h.requiredDate : "", priority: str(h.priority, 30),
          projectId: str(h.projectId, 120), projectName: str(h.projectName, 200),
          reason: str(h.reason, 1000),
          suggestedSupplierId: str(h.suggestedSupplierId, 120), suggestedSupplierName: str(h.suggestedSupplierName, 200),
          vatMode: vatMode === "exclusive" ? "exclude" : vatMode === "inclusive" ? "include" : "none", whtRate,
          items,
          subTotal: t.subTotal, vatAmount: t.vatAmount, whtAmount: t.whtAmount, totalAmount: t.netPayable, grandTotal: t.grandTotal,
          status: "PENDING_APPROVAL",
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        return code;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "PURCHASE_REQUEST", prCode, { total: t.netPayable });
      return NextResponse.json({ success: true, prCode, totals: t });
    }

    if (["approve", "reject", "cancel"].includes(action)) {
      const prId = str(body.prId, 120);
      if (!prId) throw new ApiAuthError(400, "ไม่พบใบขอซื้อ");
      const ref = adminDb.doc(`companies/${companyId}/purchase_requests/${prId}`);
      const next = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "CANCELLED";
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบขอซื้อ");
        const pr = snap.data()!;
        const status = String(pr.status || "PENDING_APPROVAL").toUpperCase();
        if (action === "cancel") {
          if (!["PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(status)) throw new ApiAuthError(409, "ใบขอซื้อนี้ยกเลิกไม่ได้แล้ว");
          const isOwner = pr.requesterUid === apiUser.uid || pr.createdBy === apiUser.uid;
          if (!isOwner && !APPROVE.some((p) => can(apiUser.roles, p))) throw new ApiAuthError(403, "ยกเลิกได้เฉพาะผู้ขอซื้อหรือผู้อนุมัติ");
        } else {
          if (status !== "PENDING_APPROVAL") throw new ApiAuthError(409, "ใบขอซื้อนี้พิจารณาไปแล้ว");
          if (!APPROVE.some((p) => can(apiUser.roles, p))) throw new ApiAuthError(403, "สิทธิ์การอนุมัติไม่เพียงพอ");
          if ((pr.requesterUid === apiUser.uid || pr.createdBy === apiUser.uid) && role !== "SUPERADMIN") throw new ApiAuthError(403, "ผู้ขอซื้ออนุมัติใบของตัวเองไม่ได้");
        }
        tx.update(ref, {
          status: next,
          ...(action === "approve" ? { approvedBy: apiUser.uid, approvedAt: now } : {}),
          ...(action === "reject" ? { rejectedBy: apiUser.uid, rejectedAt: now, rejectReason: str(body.note, 500) } : {}),
          ...(action === "cancel" ? { cancelledBy: apiUser.uid, cancelledAt: now } : {}),
          updatedBy: apiUser.uid, updatedAt: now,
        });
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "PURCHASE_REQUEST", prId, {}, { status: next });
      return NextResponse.json({ success: true, prId, status: next });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PURCHASE_REQUEST_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกใบขอซื้อไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
