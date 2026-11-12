import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { processStockMovements, StockMovement } from "@/lib/stock-service";
import { auditServer } from "@/services/audit.server";
import { normalizePoStatus } from "@/lib/procurement-status";
import { companyLocations } from "@/lib/warehouse.server";
import { prepareSequence } from "@/lib/sequence-server";
import { can } from "@/lib/permissions";
import { lineDiscount } from "@/lib/doc-totals";
import { afterGoodsReceipt, costsBefore } from "@/lib/price-alerts.server";
import { spreadOtherCosts } from "@/lib/stock-lots";

/** ราคาทุนต่อหน่วยตามใบสั่งซื้อ (หลังส่วนลดบรรทัด ก่อน VAT เป็นบาท) — ไม่เชื่อราคาที่หน้าจอส่งมา */
function poUnitCost(po: any, idx: number): number | null {
  const pi = (po?.items || [])[idx];
  if (!pi) return null;
  const qty = Number(pi.qty ?? pi.qtyOrdered) || 0;
  if (qty <= 0) return null;
  const net = (qty * (Number(pi.price ?? pi.unitPrice) || 0) - lineDiscount(pi)) / qty;
  const inclusive = String(po.vatType || "").toLowerCase().startsWith("incl");
  const rate = Number(po.exchangeRate) || 1;
  return Math.round((inclusive ? net / 1.07 : net) * rate * 10000) / 10000;
}
const isStockLine = (pi: any) => !!pi?.productId && !["SERVICE", "LABOR"].includes(String(pi?.itemType || "PRODUCT").toUpperCase());

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
    // รับสินค้าเข้าคลัง: เฉพาะฝ่ายคลัง/จัดซื้อ
    if (!can(apiUser.roles, "inventory:edit") && !can(apiUser.roles, "procurement:edit")) {
      return NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอสำหรับการรับสินค้า" }, { status: 403 });
    }
    const supplierIdIn = String(body.supplierId || "").slice(0, 120);

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

    const postingDate = /^\d{4}-\d{2}-\d{2}/.test(String(receiptDate || "")) ? String(receiptDate).slice(0, 10) : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    // ใบสั่งซื้อที่อ้างอิง (อ่านก่อนเพื่อใช้ราคาทุนตามใบสั่งซื้อ · ตรวจสถานะ/จำนวนซ้ำในทรานแซกชัน)
    const poPath = String(poDocPath || "");
    const poPre = /^companies\/[^/]+\/purchase_orders\/[^/]+$/.test(poPath) && poPath.split("/")[1] === companyId ? (await adminDb.doc(poPath).get()).data() || null : null;

    // 2. Period Lock Check
    await assertPeriodOpen(companyId, postingDate);

    // ตำแหน่งรับเข้าในคลังที่ใช้ร่วมกันในเครือ ต้องเป็นช่องของบริษัทนี้ (หรือพื้นที่รับสินค้า)
    if (warehouse) {
      const { all } = await companyLocations(companyId);
      const loc = all.find((l) => l.code === warehouse);
      if (loc && loc.owner && loc.owner !== companyId) {
        return NextResponse.json({ success: false, error: `ช่อง ${warehouse} เป็นของบริษัทอื่นในเครือ รับเข้าไม่ได้` }, { status: 400 });
      }
    }

    // 3. Collect Stock Movements for all received items
    let totalReceiptAmount = 0;
    const movements: StockMovement[] = [];
    // ราคาซื้อต่อหน่วย: ราคาในใบสั่งซื้อก่อน แล้วจึงราคาที่กรอก
    for (const item of items) {
      const fromPo = poPre && item.poLineIndex !== null && item.poLineIndex !== undefined ? poUnitCost(poPre, Number(item.poLineIndex)) : null;
      item.buyPrice = fromPo ?? Math.max(0, Number(item.unitPrice || item.price || item.cost || 0));
      item.priceSource = fromPo !== null ? "PO" : "MANUAL";
    }
    // ต้นทุนอื่นๆ ของบิล (ค่าส่ง ค่าขนย้าย ก่อน VAT): กระจายเข้าต้นทุนต่อหน่วยตามสัดส่วนมูลค่าของรายการที่เข้าคลัง
    const otherCosts = Math.round(Math.max(0, Number(body.otherCosts) || 0) * 100) / 100;
    const stockIdx = items.map((it: any, i: number) => i).filter((i: number) => items[i].productId && Number(items[i].qtyReceived || items[i].qty || 0) > 0);
    const landed = spreadOtherCosts(stockIdx.map((i: number) => ({ qty: Number(items[i].qtyReceived || items[i].qty || 0), unitCost: items[i].buyPrice })), otherCosts);
    stockIdx.forEach((i: number, k: number) => { items[i].landedCost = landed[k]; });
    const lotBase = { supplierId: String(poPre?.supplierId || supplierIdIn), supplierName: String(poPre?.supplierName || supplier || "").slice(0, 200), poRef: String(poRef || "").slice(0, 120),
      projectId: String(body.projectId || poPre?.projectId || "").slice(0, 120), projectName: String(body.projectName || poPre?.projectName || "").slice(0, 200), receivedDate: postingDate, source: "GR" as const };
    for (const item of items) {
      const qty = Number(item.qtyReceived || item.qty || 0);
      const unitPrice = item.landedCost ?? item.buyPrice;
      item.unitCost = unitPrice;
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
          ...(supplier ? { partyName: String(supplier).slice(0, 200) } : {}),
          lotInfo: { ...lotBase },
          userId
        });
      }
    }
    totalReceiptAmount = Math.round(totalReceiptAmount * 100) / 100;
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
    let supplierFromPo: { id: string; name: string } | null = null;
    // เลขที่ใบรับสินค้า (GR) ออกในทรานแซกชันเดียวกับสต็อก: บันทึกไม่สำเร็จ = ไม่เสียเลข
    const takeNo = await prepareSequence("GR", companyId);
    let grNo = "";
    let seqCommit: (() => void) | null = null;
    const readPO = async (transaction: FirebaseFirestore.Transaction) => {
      poUpdate = null;
      const seq = await takeNo(transaction);
      grNo = seq.number;
      seqCommit = seq.commit;
      // Lot ที่สร้างอ้างถึงใบรับสินค้าใบนี้
      for (const m of movements) if (m.lotInfo) m.lotInfo.grNo = grNo;
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
      // ครบ = รายการสินค้าที่คุมสต็อกรับครบทุกตัว (ค่าบริการ/ค่าแรงไม่ต้องรับเข้าคลัง)
      const stockItems = poItems.filter(isStockLine);
      const allReceived = (stockItems.length ? stockItems : poItems).every((pi: any) => (Number(pi.qtyReceived) || 0) >= (Number(pi.qty ?? pi.qtyOrdered) || 0));
      supplierFromPo = { id: String(po.supplierId || ""), name: String(po.supplierName || "") };
      poUpdate = { items: poItems, status: allReceived ? "RECEIVED" : "PARTIAL_RECEIVED", updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid };
    };

    // 4. Goods Receipt Document
    const grDataOf = (no: string) => ({
      grId: no,
      grNo: no,
      companyId,
      poRef: poRef || "",
      supplierId: supplierFromPo?.id || supplierIdIn,
      supplier: supplierFromPo?.name || supplier || "",
      receiptDate: postingDate,
      deliveryNote: deliveryNote || "",
      receivedBy: String(receivedBy || userId).slice(0, 200),
      warehouse: warehouseCode || warehouse || "",
      location: warehouse || "",
      // เก็บเฉพาะฟิลด์ที่ใช้ (ไม่เก็บข้อมูลดิบจากหน้าจอ)
      items: items.map((it: any) => ({
        productId: String(it.productId || ""), sku: String(it.sku || "").slice(0, 120), name: String(it.name || "").slice(0, 300), unit: String(it.unit || "").slice(0, 40),
        qtyReceived: Number(it.qtyReceived || it.qty || 0), unitCost: Number(it.unitCost) || 0,
        // ราคาซื้อก่อนกระจายต้นทุนอื่น และที่มาของราคา (PO = ตามใบสั่งซื้อ)
        buyPrice: Number(it.buyPrice) || 0, priceSource: String(it.priceSource || "MANUAL"),
        poLineIndex: it.poLineIndex === null || it.poLineIndex === undefined ? null : Number(it.poLineIndex),
      })),
      totalAmount: Math.round(totalReceiptAmount * 100) / 100,
      otherCosts,
      projectId: lotBase.projectId, projectName: lotBase.projectName,
      status: "received",
      createdBy: userId,
      createdByUid: apiUser.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isDeleted: false
    });

    // 5. Stock/WAC updates, GR document and its GL entry commit in one transaction (all-or-nothing)
    //    Journal: Dr สินค้าคงเหลือ / Cr เจ้าหนี้การค้า (โครงสร้างเดียวกับ AccountingEngine.postGoodsReceipt แบบ Non-VAT)
    let grData: ReturnType<typeof grDataOf> | null = null;
    // ต้นทุนเฉลี่ยก่อนรับเข้า — ใช้เทียบราคาล็อตใหม่ (แจ้งเตือนราคาเปลี่ยน)
    const costBefore = await costsBefore(companyId, movements.map((m) => m.productId)).catch(() => new Map<string, number>());
    await processStockMovements(movements, (transaction) => {
      seqCommit?.();
      grData = grDataOf(grNo);
      transaction.set(adminDb.doc(`companies/${companyId}/goods_receipts/${grNo}`), grData);
      if (poDocRef && poUpdate) transaction.update(poDocRef, poUpdate);
      if (totalReceiptAmount > 0) {
        const now = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(adminDb.collection(`companies/${companyId}/journal_entries`).doc(), {
          companyId,
          date: postingDate,
          bookType: "PV_INTERNAL",
          reference: grNo,
          description: `[AUTO] รับสินค้า ${grNo}${poRef ? ` ตามใบสั่งซื้อ ${poRef}` : ""} จาก ${supplier || "ผู้ขาย"} เข้า ${warehouse || "คลังสินค้า (ไม่ระบุตำแหน่ง)"}`,
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

    // 5.1 ราคาทุนล่าสุดของผู้ขาย + แจ้งเตือนเมื่อราคาล็อตใหม่ต่างจากเดิมเกินเกณฑ์ (ไม่ทำให้การรับสินค้าล้มเหลว)
    const gr: any = grData;
    await afterGoodsReceipt(
      { companyId, grNo, supplierId: String(gr?.supplierId || ""), supplierName: String(gr?.supplier || ""), userUid: apiUser.uid },
      (gr?.items || []).filter((it: any) => it.productId && it.qtyReceived > 0).map((it: any) => ({ productId: it.productId, name: it.name, unitCost: Number(it.unitCost) || 0 })),
      costBefore,
    ).catch((err) => console.error("[PRICE_ALERT]", err));

    // 6. Write Audit Log
    await auditServer.logCreate(
      userId,
      companyId,
      "PROCURE_GR",
      grNo,
      grData
    );

    return NextResponse.json({
      success: true,
      message: `บันทึกการรับสินค้าเรียบร้อยแล้ว (เลขที่: ${grNo})`,
      grId: grNo,
      grNo,
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
