import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { processStockMovements, StockMovement } from "@/lib/stock-service";
import { auditServer } from "@/services/audit.server";

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
          toLocation: warehouse || "Main Warehouse",
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
      warehouse: warehouse || "",
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
      if (totalReceiptAmount > 0) {
        const now = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(adminDb.collection(`companies/${companyId}/journal_entries`).doc(), {
          companyId,
          date: now,
          bookType: "PV_INTERNAL",
          description: `[AUTO] Goods Receipt ${grRef.id} (Non-VAT Purchase) from ${supplier || "Vendor"} to ${warehouse || "Main Warehouse"}`,
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
    });

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
