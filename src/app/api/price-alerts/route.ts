import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { applyAlert } from "@/lib/price-alerts.server";
import { auditServer } from "@/services/audit.server";

/**
 * แจ้งเตือนราคาทุนเปลี่ยน — POST { companyId, action, ... }
 *  list    { docType, docId }  รายการที่ยังเปิดของเอกสาร
 *  apply   { alertId }         ใช้ราคาซื้อล่าสุดเป็นต้นทุนในเอกสาร (ราคาขายคงเดิม)
 *  dismiss { alertId }         รับทราบ (ไม่เปลี่ยนต้นทุน)
 *  history { productId }       ประวัติราคาทุนรายล็อต (รับเข้า) ของสินค้า
 * ต้นทุน/GP: ใบเสนอราคาต้องมีสิทธิ์ดูต้นทุน (sales:cost) · โครงการ projects:view
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const tsIso = (v: any) => (v?.toDate ? v.toDate().toISOString() : typeof v === "string" ? v : "");

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || "");
    const user = await requireApiUser(request, companyId);
    const action = String(body.action || "");
    const col = adminDb.collection(`companies/${companyId}/price_alerts`);
    const canSee = (docType: string) => (docType === "project" ? can(user.roles, "projects:view") : can(user.roles, "sales:cost"));
    const canEdit = (docType: string) => (docType === "project" ? can(user.roles, "projects:edit") : can(user.roles, "sales:edit") && can(user.roles, "sales:cost"));
    const deny = () => NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอ" }, { status: 403 });

    if (action === "list") {
      const docType = body.docType === "project" ? "project" : "quotation";
      if (!canSee(docType)) return NextResponse.json({ success: true, alerts: [] });
      const snap = await col.where("docId", "==", String(body.docId || "")).limit(50).get();
      const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsIso(d.data().createdAt) }))
        .filter((a: any) => a.docType === docType && a.status === "open");
      return NextResponse.json({ success: true, alerts });
    }

    if (action === "apply" || action === "dismiss") {
      const alertId = String(body.alertId || "");
      if (!/^(quotation|project)_[^/]+$/.test(alertId)) return NextResponse.json({ success: false, error: "รายการไม่ถูกต้อง" }, { status: 400 });
      const snap = await col.doc(alertId).get();
      const a = snap.data();
      if (!a) return NextResponse.json({ success: false, error: "ไม่พบรายการแจ้งเตือน" }, { status: 404 });
      if (!canEdit(a.docType)) return deny();
      if (action === "dismiss") {
        if (a.status !== "open") return NextResponse.json({ success: false, error: "รายการนี้จัดการไปแล้ว" }, { status: 409 });
        await col.doc(alertId).update({ status: "dismissed", resolution: "acknowledged", resolvedAt: admin.firestore.FieldValue.serverTimestamp(), resolvedBy: user.uid });
        await auditServer.logUpdate(user.uid, companyId, "PRICE_ALERT", alertId, { status: "open" }, { status: "dismissed" });
        return NextResponse.json({ success: true });
      }
      const r = await applyAlert(companyId, alertId, user.uid);
      await auditServer.logUpdate(user.uid, companyId, "PRICE_ALERT", alertId, { lineCost: a.lineCost, status: "open" }, { lineCost: a.newCost, status: "applied", gpAfter: r.gpAfter });
      return NextResponse.json({ success: true, gpAfter: r.gpAfter });
    }

    if (action === "history") {
      if (!can(user.roles, "inventory:view") && !can(user.roles, "procurement:view")) return deny();
      const productId = String(body.productId || "");
      if (!productId || productId.includes("/")) return NextResponse.json({ success: false, error: "ไม่ระบุสินค้า" }, { status: 400 });
      const snap = await adminDb.collection(`companies/${companyId}/stock_movements`).where("productId", "==", productId).limit(500).get();
      const lots = snap.docs.map((d) => d.data()).filter((m) => m.type === "IN" && !m.isDeleted)
        .map((m) => ({ at: tsIso(m.timestamp), qty: Number(m.quantity) || 0, unitCost: r2(Number(m.unitCost) || 0), wacBefore: r2(Number(m.oldWAC) || 0), wacAfter: r2(Number(m.newWAC) || 0), ref: String(m.referenceId || ""), party: String(m.partyName || "") }))
        .sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 100);
      return NextResponse.json({ success: true, lots });
    }

    return NextResponse.json({ success: false, error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PRICE_ALERTS_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ทำรายการไม่สำเร็จ" }, { status: 500 });
  }
}
