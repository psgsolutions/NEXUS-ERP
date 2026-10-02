import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { processStockMovements, StockMovement } from "@/lib/stock-service";
import { listLocations, UNASSIGNED, WarehouseDoc } from "@/lib/warehouse-location";

/**
 * [API-SERVER] Put-away: ย้ายสินค้าจากพื้นที่รับสินค้า (หรือสต็อกที่ยังไม่มีตำแหน่ง) เข้าชั้นวาง
 * Endpoint: POST /api/inventory/putaway
 * Body: { companyId, fromLocation: "WH-01-RECV" | "UNASSIGNED" | <location>, toLocation, lines: [{ productId, qty }] }
 * เป็นการโอนย้ายภายใน: ไม่เปลี่ยนยอดรวม/ต้นทุนเฉลี่ย และไม่ลงบัญชี
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, fromLocation, toLocation, lines = [] } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;

    if (!companyId || !fromLocation || !toLocation) {
      return NextResponse.json({ success: false, error: "companyId, fromLocation และ toLocation จำเป็นต้องระบุ" }, { status: 400 });
    }
    if (fromLocation === toLocation) {
      return NextResponse.json({ success: false, error: "ตำแหน่งต้นทางและปลายทางต้องไม่ซ้ำกัน" }, { status: 400 });
    }

    // รวมจำนวนตามสินค้า (ยิงสินค้าเดียวกันหลายครั้ง)
    const qtyByProduct = new Map<string, number>();
    for (const line of lines) {
      const qty = Number(line?.qty) || 0;
      if (line?.productId && qty > 0) qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) || 0) + qty);
    }
    if (qtyByProduct.size === 0) {
      return NextResponse.json({ success: false, error: "ไม่มีรายการสินค้าที่จะจัดเก็บ" }, { status: 400 });
    }

    // ตำแหน่งต้องมีอยู่จริงในผังคลังของบริษัท
    const warehouses = (await adminDb.collection("warehouses").where("companyId", "==", companyId).get())
      .docs.map((d) => ({ id: d.id, ...d.data() } as WarehouseDoc));
    const validCodes = new Set(listLocations(warehouses).map((l) => l.code));
    if (!validCodes.has(toLocation)) {
      return NextResponse.json({ success: false, error: `ไม่พบตำแหน่ง ${toLocation} ในผังคลัง` }, { status: 400 });
    }
    if (fromLocation !== UNASSIGNED && !validCodes.has(fromLocation)) {
      return NextResponse.json({ success: false, error: `ไม่พบตำแหน่งต้นทาง ${fromLocation} ในผังคลัง` }, { status: 400 });
    }

    // สต็อกที่ยังไม่มีตำแหน่ง: ย้ายได้ไม่เกิน onHand - ผลรวมยอดทุกตำแหน่ง
    if (fromLocation === UNASSIGNED) {
      for (const [productId, qty] of Array.from(qtyByProduct.entries())) {
        const product = (await adminDb.collection("products").doc(productId).get()).data();
        if (!product || product.companyId !== companyId) {
          return NextResponse.json({ success: false, error: `ไม่พบสินค้า ${productId}` }, { status: 400 });
        }
        const located = (await adminDb.collection(`companies/${companyId}/inventory_balance`).where("productId", "==", productId).get())
          .docs.reduce((sum, d) => sum + (Number(d.data().quantity) || 0), 0);
        const unassigned = Math.max(0, (Number(product.stockStatus?.onHand) || 0) - located);
        if (qty > unassigned) {
          return NextResponse.json({
            success: false,
            error: `${product.name || productId}: สต็อกที่ยังไม่มีตำแหน่งเหลือ ${unassigned} แต่จะจัดเก็บ ${qty}`
          }, { status: 400 });
        }
      }
    }

    const movements: StockMovement[] = Array.from(qtyByProduct.entries()).map(([productId, quantity]) => ({
      companyId,
      productId,
      type: "TRANSFER",
      quantity,
      // Firestore ไม่รับค่า undefined: ใส่ fromLocation เฉพาะเมื่อมีตำแหน่งต้นทางจริง
      ...(fromLocation === UNASSIGNED ? {} : { fromLocation }),
      toLocation,
      referenceId: `PUTAWAY ${fromLocation} -> ${toLocation}`,
      userId,
    }));

    // ตรวจยอดต้นทางพอ + อัปเดตยอดตามตำแหน่ง + บันทึกประวัติ ใน transaction เดียว
    const transactionIds = await processStockMovements(movements);

    return NextResponse.json({ success: true, transactionIds, items: movements.length });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PUTAWAY_API_ERROR]", err);
    return NextResponse.json({ success: false, error: err.message || "จัดเก็บสินค้าไม่สำเร็จ" }, { status: 500 });
  }
}
