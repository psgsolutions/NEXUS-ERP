import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { fifoOrder } from "@/lib/stock-lots";
import { processStockMovements, type StockMovement } from "@/lib/stock-service";
import { auditServer } from "@/services/audit.server";

/**
 * Lot สินค้า — POST /api/inventory/lots { companyId, action, ... }
 *  open    { productId }  Lot ที่ยังมีของ เรียงเข้าก่อนออกก่อน (ใช้ตอนเบิก/ขาย)
 *  product { productId }  ทุก Lot ของสินค้า (รวมที่หมดแล้ว)
 *  summary { productId }  รับเข้า/จ่ายออกรวม Lot ที่มีของ และอายุ Lot เก่าสุด
 *  trace   { lotNo }      ติดตาม Lot: ที่มา (ผู้ขาย ใบรับ ใบสั่งซื้อ) และตัดออกให้ใครไปเท่าไร
 *  importOpening { ref, lots: [{ productId, qty, unitCost, receivedDate, supplierName, projectName, sourceRef }] }
 *          ยอดยกมาเป็น Lot (คงวันที่รับเดิม → FIFO ถูกลำดับ) · ไม่ลงบัญชี (มูลค่าอยู่ในงบทดลองยกมา) · ต้องมี inventory:edit
 * ต้นทุนของ Lot แสดงเฉพาะผู้มีสิทธิ์ดูต้นทุน (inventory:edit / procurement:view / sales:cost)
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (v: any) => (v?.toDate ? v.toDate().toISOString() : "");

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || "");
    const user = await requireApiUser(request, companyId);
    if (!can(user.roles, "inventory:view") && !can(user.roles, "sales:view") && !can(user.roles, "procurement:view")) {
      return NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอ" }, { status: 403 });
    }
    const seeCost = can(user.roles, "inventory:edit") || can(user.roles, "procurement:view") || can(user.roles, "sales:cost");
    const col = adminDb.collection(`companies/${companyId}/stock_lots`);
    const view = (id: string, d: any) => ({
      lotNo: id, productId: d.productId, sku: d.sku || "", name: d.name || "", unit: d.unit || "",
      qtyReceived: Number(d.qtyReceived) || 0, qtyRemaining: Number(d.qtyRemaining) || 0, status: d.status, receivedDate: d.receivedDate || "",
      supplierId: d.supplierId || "", supplierName: d.supplierName || "", poRef: d.poRef || "", grNo: d.grNo || "", projectId: d.projectId || "", projectName: d.projectName || "", source: d.source || "GR", location: d.location || "",
      ...(seeCost ? { unitCost: Number(d.unitCost) || 0, value: r2((Number(d.qtyRemaining) || 0) * (Number(d.unitCost) || 0)) } : {}),
    });
    const action = String(body.action || "");
    const productId = String(body.productId || "");

    if (action === "open" || action === "product") {
      if (!productId || productId.includes("/")) return NextResponse.json({ success: false, error: "ไม่ระบุสินค้า" }, { status: 400 });
      let q = col.where("productId", "==", productId);
      if (action === "open") q = q.where("status", "==", "open");
      const lots = fifoOrder((await q.limit(500).get()).docs.filter((d) => d.get("isDeleted") !== true).map((d) => view(d.id, d.data())));
      return NextResponse.json({ success: true, lots: action === "open" ? lots.filter((l) => l.qtyRemaining > 0) : lots.reverse() });
    }

    if (action === "summary") {
      // สรุปรายสินค้า: รับเข้า/จ่ายออกรวม (จำนวน มูลค่า/ต้นทุน) จากสมุดความเคลื่อนไหว
      if (!productId || productId.includes("/")) return NextResponse.json({ success: false, error: "ไม่ระบุสินค้า" }, { status: 400 });
      const moves = (await adminDb.collection(`companies/${companyId}/stock_movements`).where("productId", "==", productId).limit(2000).get()).docs.map((d) => d.data()).filter((m) => !m.isDeleted);
      const sum = (t: string, k: "quantity" | "totalValue") => r2(moves.filter((m) => m.type === t).reduce((a, m) => a + (Number(m[k]) || 0), 0));
      const lots = (await col.where("productId", "==", productId).where("status", "==", "open").get()).docs.map((d) => d.data());
      const oldest = lots.map((l) => String(l.receivedDate || "")).filter(Boolean).sort()[0] || "";
      return NextResponse.json({ success: true, summary: {
        inQty: sum("IN", "quantity"), outQty: sum("OUT", "quantity"), openLots: lots.length, oldestLotDate: oldest,
        ...(seeCost ? { inValue: sum("IN", "totalValue"), outCost: sum("OUT", "totalValue"), lotValue: r2(lots.reduce((a, l) => a + (Number(l.qtyRemaining) || 0) * (Number(l.unitCost) || 0), 0)) } : {}),
      } });
    }

    if (action === "trace") {
      const lotNo = String(body.lotNo || "");
      if (!lotNo || lotNo.includes("/")) return NextResponse.json({ success: false, error: "ไม่ระบุ Lot" }, { status: 400 });
      const snap = await col.doc(lotNo).get();
      if (!snap.exists) return NextResponse.json({ success: false, error: `ไม่พบ Lot ${lotNo}` }, { status: 404 });
      const moves = await adminDb.collection(`companies/${companyId}/stock_movements`).where("lotNos", "array-contains", lotNo).limit(500).get();
      const issues = moves.docs.map((d) => d.data()).filter((m) => !m.isDeleted).map((m) => ({
        at: iso(m.timestamp), ref: String(m.referenceId || ""), party: String(m.partyName || ""),
        qty: Number((m.lots || []).find((a: any) => a.lotNo === lotNo)?.qty) || 0, movementId: String(m.transactionId || ""),
      })).sort((a, b) => (a.at < b.at ? -1 : 1));
      return NextResponse.json({ success: true, lot: view(snap.id, snap.data()), issues });
    }

    if (action === "importOpening") {
      if (!can(user.roles, "inventory:edit")) return NextResponse.json({ success: false, error: "นำเข้ายอดยกมาได้เฉพาะผู้มีสิทธิ์คลังสินค้า" }, { status: 403 });
      const ref = String(body.ref || "OPENING").replace(/[^\w-]/g, "").slice(0, 60) || "OPENING";
      const raw: any[] = Array.isArray(body.lots) ? body.lots.slice(0, 300) : [];
      const s = (v: any, n = 200) => String(v ?? "").trim().slice(0, n);
      const moves: StockMovement[] = raw.map((l) => ({
        companyId, productId: s(l.productId, 120), type: "IN" as const, quantity: Math.round((Number(l.qty) || 0) * 10000) / 10000,
        unitCost: Math.max(0, Math.round((Number(l.unitCost) || 0) * 10000) / 10000), referenceId: ref, partyName: s(l.supplierName), userId: user.email || user.uid,
        lotInfo: { supplierId: s(l.supplierId, 120), supplierName: s(l.supplierName), projectName: s(l.projectName), poRef: s(l.sourceRef, 300), receivedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(l.receivedDate)) ? String(l.receivedDate) : undefined, source: "OPENING" as const },
      })).filter((m) => m.productId && !m.productId.includes("/") && m.quantity > 0);
      if (!moves.length) return NextResponse.json({ success: false, error: "ไม่มีรายการยกมา" }, { status: 400 });
      // นำเข้าซ้ำด้วยเลขอ้างอิงเดิม = ปฏิเสธ (กันยอดยกมาเบิ้ล)
      const dup = await adminDb.collection(`companies/${companyId}/stock_movements`).where("referenceId", "==", ref).limit(1).get();
      if (!dup.empty) return NextResponse.json({ success: false, error: `นำเข้ายอดยกมา ${ref} ไปแล้ว` }, { status: 409 });
      const ids = await processStockMovements(moves);
      await auditServer.logCreate(user.uid, companyId, "OPENING_LOTS", ref, { lots: moves.length, qty: moves.reduce((t, m) => t + m.quantity, 0), value: r2(moves.reduce((t, m) => t + m.quantity * (m.unitCost || 0), 0)) });
      return NextResponse.json({ success: true, imported: ids.length });
    }

    return NextResponse.json({ success: false, error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[LOTS_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ทำรายการไม่สำเร็จ" }, { status: 500 });
  }
}
