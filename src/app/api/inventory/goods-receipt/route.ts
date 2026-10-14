import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { processStockMovements, StockMovement } from "@/lib/stock-service";
import { auditServer } from "@/services/audit.server";
import { normalizePoStatus } from "@/lib/procurement-status";

/**
 * [API-SERVER] Goods Receipt & Real-time WAC / GL Posting API
 * Project: NEXUS ERP (Intelligence OS)
 * Endpoint: POST /api/inventory/goods-receipt
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      poRef,
      supplier,
      receiptDate,
      deliveryNote,
      receivedBy,
      warehouse,
      warehouseCode,
      poDocPath,
      items = []
    } = body;
    const apiUser = await requireApiUser(request, companyId);
    const userId = apiUser.email || apiUser.uid;

    // 1. Tenant & Field Validation
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "[Tenant Isolation Violation] companyId is required!" },
        { status: 400 }
      );
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] Goods receipt items are required." },
        { status: 400 }
      );
    }

    const postingDate = receiptDate || new Date().toISOString();

    // 2. Period Lock Check
    await assertPeriodOpen(companyId, postingDate);

    // 3. Collect Stock Movements for all received items
    let totalReceiptAmount = 0;
    const movements: StockMovement[] = [];
    for (const item of items) {
      const qty = Number(item.qtyReceived || item.qty || 0);
      const unitPrice = Number(item.unitPrice || item.price || item.cost || 0);
      if (qty > 0 && item.productId) {
        totalReceiptAmount += qty * unitPrice;
        movements.push({
          companyId,
          productId: item.productId,
          type: "IN",
          quantity: qty,
          unitCost: unitPrice,
          // ไม่ระบุตำแหน่ง (ยังไม่มีผังชั้นวาง) = สต็อกเข้าระดับคลัง ไม่สร้างยอดตามตำแหน่ง
          ...(warehouse ? { toLocation: warehouse } : {}),
          referenceId: poRef || deliveryNote,
          userId
        });
      }
    }
    if (movements.length === 0) {
      return NextResponse.json(
        { success: false, error: "[Validation Error] No receivable items (productId and qty > 0 required)." },
        { status: 400 }
      );
    }

    // 3.1 รับตามใบสั่งซื้อ: ใบต้องเป็นของบริษัทและอนุมัติแล้ว รับไม่เกินจำนวนคงค้าง
    let poDocRef: FirebaseFirestore.DocumentReference | null = null;
    if (poDocPath) {
      const p = String(poDocPath);
      const m = p.match(/^companies\/([^/]+)\/purchase_orders\/([^/]+)$/) || p.match(/^purchase_orders\/([^/]+)$/);
      if (!m || (m.length === 3 && m[1] !== companyId)) {
        return NextResponse.json({ success: false, error: "ใบสั่งซื้อไม่ถูกต้อง" }, { status: 400 });
      }
      poDocRef = adminDb.doc(p);
    }
    let poUpdate: Record<string, any> | null = null;
    const readPO = async (transaction: FirebaseFirestore.Transaction) => {
      poUpdate = null;
      if (!poDocRef) return;
      const snap = await transaction.get(poDocRef);
      const po: any = snap.data();
      if (!snap.exists || (po.companyId && po.companyId !== companyId)) throw new Error("ไม่พบใบสั่งซื้อ");
      if (!["APPROVED", "PARTIAL_RECEIVED"].includes(normalizePoStatus(po.status))) throw new Error("ใบสั่งซื้อนี้ยังไม่อนุมัติหรือรับสินค้าครบแล้ว");
      const poItems = (po.items || []).map((pi: any, idx: number) => {
        const got = items.filter((l: any) => Number(l.poLineIndex) === idx && l.poLineIndex !== null && l.poLineIndex !== undefined)
          .reduce((sum: number, l: any) => sum + (Number(l.qtyReceived || l.qty) || 0), 0);
        const ordered = Number(pi.qty ?? pi.qtyOrdered) || 0;
        const prev = Number(pi.qtyReceived) || 0;
        if (got > 0 && prev + got > ordered + 1e-9) throw new Error(`รับเกินจำนวนคงค้างในใบสั่งซื้อ (${pi.name || pi.description || "รายการ " + (idx + 1)})`);
        return { ...pi, qtyReceived: prev + got };
      });
      const allReceived = poItems.every((pi: any) => (Number(pi.qtyReceived) || 0) >= (Number(pi.qty ?? pi.qtyOrdered) || 0));
      poUpdate = { items: poItems, status: allReceived ? "RECEIVED" : "PARTIAL_RECEIVED", updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid };
    };

    // 4. Goods Receipt Document
    const grRef = adminDb.collection(`companies/${companyId}/goods_receipts`).doc();
    const grData = {
      grId: grRef.id,
      companyId,
      poRef: poRef || "",
      supplier: supplier || "",
      receiptDate: postingDate,
      deliveryNote: deliveryNote || "",
      receivedBy,
      warehouse: warehouseCode || warehouse || "",
      location: warehouse || "",
      items,
      totalAmount: totalReceiptAmount,
      status: "received",
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false
    };

    // 5. Stock/WAC updates, GR document and its GL entry commit in one transaction (all-or-nothing)
    //    Journal: Dr สินค้าคงเหลือ / Cr เจ้าหนี้การค้า (โครงสร้างเดียวกับ AccountingEngine.postGoodsReceipt แบบ Non-VAT)
    await processStockMovements(movements, (transaction) => {
      transaction.set(grRef, grData);
      if (poDocRef && poUpdate) transaction.update(poDocRef, poUpdate);
      if (totalReceiptAmount > 0) {
        const now = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(adminDb.collection(`companies/${companyId}/journal_entries`).doc(), {
          companyId,
          date: now,
          bookType: "PV_INTERNAL",
          description: `[AUTO] Goods Receipt ${grRef.id} (Non-VAT Purchase) from ${supplier || "Vendor"} to ${warehouse || "คลังสินค้า (ไม่ระบุตำแหน่ง)"}`,
          totalDebit: totalReceiptAmount,
          totalCredit: totalReceiptAmount,
          isOfficialTax: false,
          status: "draft", // Requires accountant review
          items: [
            { accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: totalReceiptAmount, credit: 0 },
            { accountCode: "2111-00", accountName: "เจ้าหนี้การค้า", debit: 0, credit: totalReceiptAmount }
          ],
          createdAt: now,
          updatedAt: now
        });
      }
    }, readPO);

    // 6. Write Audit Log
    await auditServer.logCreate(
      userId,
      companyId,
      "PROCURE_GR",
      grRef.id,
      grData
    );

    return NextResponse.json({
      success: true,
      message: `บันทึกการรับสินค้าเรียบร้อยแล้ว (เลขที่: ${grRef.id})`,
      grId: grRef.id,
      totalAmount: totalReceiptAmount
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[GOODS_RECEIPT_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "เกิดข้อผิดพลาดในการบันทึกรับสินค้า" },
      { status: 500 }
    );
  }
}
