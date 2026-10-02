import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { processStockMovements, StockMovement } from "@/lib/stock-service";
import { listLocations, UNASSIGNED, WarehouseDoc } from "@/lib/warehouse-location";
import { soPickRemaining } from "@/lib/picking";

/**
 * [API-SERVER] Picking: เบิกสินค้าออกจากตำแหน่งจัดเก็บตามใบสั่งขาย
 * Endpoint: POST /api/inventory/pick
 * Body: { companyId, soId, lines: [{ productId, location: "WH-01-A1-L2" | "WH-01-RECV" | "UNASSIGNED", qty }] }
 *
 * - ตัดสต็อกจากตำแหน่ง (OUT) + ลงต้นทุนขาย (Dr 5111-00 / Cr 1141-00) ใน transaction เดียวกับการอัปเดตใบสั่งขาย
 * - ใบสั่งขายที่จองสต็อกไว้แล้ว (แปลงจากใบเสนอราคา) จะลดยอดจองแทนยอดพร้อมใช้
 * - เบิกครบทุกรายการ → สถานะ DELIVERED (พร้อมออกใบกำกับภาษี)
 */
const BLOCKED_STATUSES = ["DRAFT", "CANCELLED", "COMPLETED", "DELIVERED"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, soId, lines = [] } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;

    if (!companyId || !soId) {
      return NextResponse.json({ success: false, error: "companyId และ soId จำเป็นต้องระบุ" }, { status: 400 });
    }

    const soRef = adminDb.doc(`companies/${companyId}/sales_orders/${soId}`);
    const soSnap = await soRef.get();
    if (!soSnap.exists) return NextResponse.json({ success: false, error: `ไม่พบใบสั่งขาย ${soId}` }, { status: 404 });
    const so = soSnap.data() || {};
    const status = String(so.status || "").toUpperCase();
    if (BLOCKED_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: `ใบสั่งขายสถานะ ${so.status} เบิกสินค้าไม่ได้ (ต้องอนุมัติแล้วและยังไม่ส่งมอบ)` }, { status: 400 });
    }

    // รวมรายการตาม (สินค้า, ตำแหน่ง) และตรวจไม่ให้เกินจำนวนที่ยังค้างเบิก
    const remaining = soPickRemaining(so);
    const byKey = new Map<string, { productId: string; location: string; qty: number }>();
    const byProduct = new Map<string, number>();
    for (const line of lines) {
      const qty = Math.floor(Number(line?.qty) || 0);
      if (!line?.productId || !line?.location || qty <= 0) continue;
      const key = `${line.location}|${line.productId}`;
      const prev = byKey.get(key);
      byKey.set(key, { productId: line.productId, location: line.location, qty: (prev?.qty || 0) + qty });
      byProduct.set(line.productId, (byProduct.get(line.productId) || 0) + qty);
    }
    if (byKey.size === 0) return NextResponse.json({ success: false, error: "ไม่มีรายการที่จะเบิก" }, { status: 400 });
    for (const [productId, qty] of Array.from(byProduct.entries())) {
      const left = remaining.get(productId) || 0;
      if (qty > left) {
        return NextResponse.json({ success: false, error: `สินค้า ${productId} เบิกเกินใบสั่งขาย (ค้างเบิก ${left}, จะเบิก ${qty})` }, { status: 400 });
      }
    }

    // ตำแหน่งต้องมีในผังคลัง (ยกเว้นสต็อกเดิมที่ยังไม่ระบุตำแหน่ง)
    const warehouses = (await adminDb.collection("warehouses").where("companyId", "==", companyId).get())
      .docs.map((d) => ({ id: d.id, ...d.data() } as WarehouseDoc));
    const validCodes = new Set(listLocations(warehouses).map((l) => l.code));
    for (const { location } of Array.from(byKey.values())) {
      if (location !== UNASSIGNED && !validCodes.has(location)) {
        return NextResponse.json({ success: false, error: `ไม่พบตำแหน่ง ${location} ในผังคลัง` }, { status: 400 });
      }
    }

    // สต็อกที่ยังไม่ระบุตำแหน่ง: เบิกได้ไม่เกิน onHand - ผลรวมยอดทุกตำแหน่ง
    for (const { productId, location, qty } of Array.from(byKey.values())) {
      if (location !== UNASSIGNED) continue;
      const product = (await adminDb.collection("products").doc(productId).get()).data();
      const located = (await adminDb.collection(`companies/${companyId}/inventory_balance`).where("productId", "==", productId).get())
        .docs.reduce((sum, d) => sum + (Number(d.data().quantity) || 0), 0);
      const free = Math.max(0, (Number(product?.stockStatus?.onHand) || 0) - located);
      if (qty > free) {
        return NextResponse.json({ success: false, error: `${product?.name || productId}: สต็อกที่ยังไม่ระบุตำแหน่งเหลือ ${free}` }, { status: 400 });
      }
    }

    const fromReserved = so.stockReserved ?? Boolean(so.quoteId);
    const movements: StockMovement[] = Array.from(byKey.values()).map(({ productId, location, qty }) => ({
      companyId,
      productId,
      type: "OUT",
      quantity: qty,
      ...(location === UNASSIGNED ? {} : { fromLocation: location }),
      referenceId: soId,
      userId,
      fromReserved,
    }));

    // จำนวนที่เบิกสะสมในใบสั่งขาย
    const picked: Record<string, number> = { ...(so.picked || {}) };
    byProduct.forEach((qty, productId) => { picked[productId] = (Number(picked[productId]) || 0) + qty; });
    const allPicked = soPickRemaining({ ...so, picked }).size === 0;

    const transactionIds = await processStockMovements(movements, (tx) => {
      tx.update(soRef, {
        picked,
        fulfillmentStatus: allPicked ? "fulfilled" : "partial",
        status: allPicked ? "DELIVERED" : "PROCESSING",
        ...(allPicked ? { deliveredAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
        updatedBy: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, transactionIds, allPicked });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PICK_API_ERROR]", err);
    return NextResponse.json({ success: false, error: err.message || "เบิกสินค้าไม่สำเร็จ" }, { status: 500 });
  }
}
