import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { nexusSequenceServer } from "./sequence-server";
import { Product } from "@/types";
import { auditServer } from "@/services/audit.server";
import { assertPeriodOpen } from "./period-close-service";
import { getProductTx } from "./product-store.server";
import { groupIdOfCompany } from "./company-group.server";
import { allocateLots, allocationCost, costMethodOf, type LotAllocation, type LotPick } from "./stock-lots";

type DocumentReference = admin.firestore.DocumentReference;
type Transaction = admin.firestore.Transaction;
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const increment = (n: number) => admin.firestore.FieldValue.increment(n);


/**
 * [INV-STRATEGY-V2.1] [SERVER-ONLY: Admin SDK]
 * Double-Entry Stock Movement & Real-time WAC Calculation Engine
 * Project: NEXUS ERP (Intelligence OS)
 */

export interface StockMovement {
  productId: string;
  type: "IN" | "OUT" | "TRANSFER";
  quantity: number;
  unitCost?: number; // Incoming purchase cost for real-time WAC calculation
  fromLocation?: string;
  toLocation?: string;
  referenceId?: string; // PRJ-XX or PO-XX
  snList?: string[];
  userId: string;
  companyId: string;
  /** OUT ของสินค้าที่จองไว้แล้ว (เช่น ใบสั่งขายที่แปลงจากใบเสนอราคา): ลดยอดจอง ไม่ลดยอดพร้อมใช้ซ้ำ */
  fromReserved?: boolean;
  /** ผู้เรียกบันทึกบัญชีเอง (เช่น ตรวจนับสต็อก: ผลต่างไม่ใช่ต้นทุนขาย) — OUT ไม่ลงต้นทุนขายอัตโนมัติ */
  skipGl?: boolean;
  /** ผู้ขาย/ผู้รับ (เก็บไว้ในประวัติการเคลื่อนไหว — หน้าประวัติราคาทุนรายล็อต) */
  partyName?: string;
  /** OUT: Lot ที่เลือกเอง (ที่เหลือระบบเติมแบบ FIFO) */
  lots?: LotPick[];
  /** IN: ข้อมูลของ Lot ที่สร้าง (ผู้ขาย เอกสารต้นทาง โปรเจกต์) — ผู้เรียกเติม grNo ในช่วงอ่านของทรานแซกชันได้ */
  lotInfo?: { supplierId?: string; supplierName?: string; poRef?: string; grNo?: string; projectId?: string; projectName?: string; receivedDate?: string; source?: "GR" | "OPENING" | "RETURN" | "ADJUST" };
}

const bangkokToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
type LotState = { ref: DocumentReference; lotNo: string; remaining: number; unitCost: number; receivedDate: string; dirty: boolean; fresh?: Record<string, any> };

/**
 * [WAC-CALC-V1.0] Real-time Weighted Average Cost (WAC) Formula
 * Formula: newWAC = (oldOnHand * oldWAC + receivedQty * receivedCost) / (oldOnHand + receivedQty)
 */
export function calculateWAC(
  oldOnHand: number,
  oldWAC: number,
  receivedQty: number,
  receivedCost: number
): number {
  if (receivedQty <= 0) return oldWAC;
  const safeOldOnHand = Math.max(0, oldOnHand);
  const totalQty = safeOldOnHand + receivedQty;
  if (totalQty <= 0) return Math.max(0, receivedCost);

  const totalValue = (safeOldOnHand * oldWAC) + (receivedQty * receivedCost);
  const newWAC = totalValue / totalQty;
  return Number(newWAC.toFixed(4));
}

export async function processStockMovement(movement: StockMovement) {
  const [transactionId] = await processStockMovements([movement]);
  return transactionId;
}

/**
 * Applies several stock movements in ONE Firestore transaction (all-or-nothing).
 * `extraReads` runs first inside the transaction (before any write) so callers can read
 * and validate related documents; `extraWrites` runs inside the same transaction after all reads, so callers can
 * commit related documents (e.g. the GR document and its journal entry) atomically.
 * IN movements do not post to the GL here: the caller that owns the source document
 * (e.g. Goods Receipt) posts the Inventory/AP entry, so it is never booked twice.
 */
export async function processStockMovements(
  movements: StockMovement[],
  extraWrites?: (transaction: Transaction) => void | Promise<void>,
  extraReads?: (transaction: Transaction) => Promise<void>
): Promise<string[]> {
  if (movements.length === 0) return [];

  const companyId = movements[0].companyId;
  if (!companyId) {
    throw new Error("[Tenant Isolation Violation] companyId is required for processStockMovement");
  }
  for (const m of movements) {
    if (m.companyId !== companyId) {
      throw new Error("[Tenant Isolation Violation] all movements must belong to the same companyId");
    }
    if (!m.productId) {
      throw new Error("[Validation Violation] productId is required for processStockMovement");
    }
    if (!(m.quantity > 0)) {
      throw new Error("[Validation Violation] quantity must be greater than 0");
    }
  }

  await assertPeriodOpen(companyId);
  const groupId = await groupIdOfCompany(companyId);

  // 1. Generate Transaction IDs (NXI-YYMM-XXXX)
  const transactionIds: string[] = [];
  for (let i = 0; i < movements.length; i++) {
    transactionIds.push(await nexusSequenceServer("INV", companyId));
  }

  // เลข Lot ของรายการรับเข้า (LOT-YYMM-0001) และวิธีคิดต้นทุนของบริษัท
  const lotNos: string[] = [];
  for (const m of movements) lotNos.push(m.type === "IN" ? await nexusSequenceServer("LOT", companyId) : "");
  const costMethod = costMethodOf((await adminDb.doc(`companies/${companyId}`).get()).data());
  const lotCol = adminDb.collection(`companies/${companyId}/stock_lots`);

  const auditEntries: Array<{ userId: string; productId: string; before: any; after: any }> = [];

  await adminDb.runTransaction(async (transaction) => {
    auditEntries.length = 0; // transaction callback may be retried
    await extraReads?.(transaction);

    // 2. Read phase (Firestore requires every read before any write)
    const products = new Map<string, {
      ref: DocumentReference;
      data: Product;
      onHand: number;
      wac: number;
      onHandDelta: number;
      reservedDelta: number;
      availableDelta: number;
      wacChanged: boolean;
      lots: LotState[];
    }>();
    for (const productId of Array.from(new Set(movements.map(m => m.productId)))) {
      // สินค้าของบริษัท (ข้อมูลกลาง+ของบริษัท หรือ root รุ่นเก่า) — ref = เอกสารที่เก็บสต็อก
      const handle = await getProductTx(transaction, companyId, groupId, productId);
      if (!handle) throw new Error(`Product not found (ID: ${productId})`);
      const ref = handle.ref;
      const data = handle.data as Product;
      products.set(productId, {
        ref,
        data,
        onHand: data.stockStatus?.onHand ?? 0,
        wac: data.pricing?.costWAC ?? (data as any).costPrice ?? 0,
        onHandDelta: 0,
        reservedDelta: 0,
        availableDelta: 0,
        wacChanged: false,
        lots: []
      });
    }
    // Lot ที่ยังมีของ ของสินค้าที่มีการตัดออก (อ่านในทรานแซกชัน: สองรายการตัด Lot เดียวกันพร้อมกันไม่ได้)
    for (const productId of Array.from(new Set(movements.filter((m) => m.type === "OUT").map((m) => m.productId)))) {
      const snap = await transaction.get(lotCol.where("productId", "==", productId).where("status", "==", "open"));
      products.get(productId)!.lots = snap.docs.map((d) => ({ ref: d.ref, lotNo: d.id, remaining: Number(d.get("qtyRemaining")) || 0, unitCost: Number(d.get("unitCost")) || 0, receivedDate: String(d.get("receivedDate") || ""), dirty: false }))
        .filter((l) => l.remaining > 0);
    }

    const balanceKeys = new Map<string, { location: string; productId: string }>();
    for (const m of movements) {
      if (m.fromLocation) balanceKeys.set(`${m.fromLocation}_${m.productId}`, { location: m.fromLocation, productId: m.productId });
      if (m.toLocation) balanceKeys.set(`${m.toLocation}_${m.productId}`, { location: m.toLocation, productId: m.productId });
    }
    const balances = new Map<string, { ref: DocumentReference; quantity: number; location: string; productId: string }>();
    for (const [key, info] of Array.from(balanceKeys.entries())) {
      const ref = adminDb.collection(`companies/${companyId}/inventory_balance`).doc(key);
      const snap = await transaction.get(ref);
      balances.set(key, { ref, quantity: snap.exists ? (snap.data()?.quantity ?? 0) : 0, ...info });
    }

    // 3. Apply movements in order against the in-memory state
    movements.forEach((movement, index) => {
      const { productId, type, quantity, unitCost, fromLocation, toLocation, snList, userId } = movement;
      const transactionId = transactionIds[index];
      const product = products.get(productId)!;
      const previousOnHand = product.onHand;
      const previousWAC = product.wac;

      // ตัดออก: จัดสรร Lot (ที่เลือกเอง + FIFO) — FIFO ใช้ต้นทุนจริงของ Lot · ส่วนที่ไม่มี Lot (สต็อกเดิม) ใช้ต้นทุนเฉลี่ย
      let allocations: LotAllocation[] = [];
      let lotCostUnit: number | null = null;
      if (type === "OUT") {
        const r = allocateLots(product.lots.filter((l) => l.remaining > 0), quantity, movement.lots);
        allocations = r.allocations;
        for (const a of allocations) { const l = product.lots.find((x) => x.lotNo === a.lotNo)!; l.remaining = Math.round((l.remaining - a.qty) * 10000) / 10000; l.dirty = true; }
        if (costMethod === "FIFO") lotCostUnit = (allocationCost(allocations) + r.short * previousWAC) / quantity;
      }
      const currentUnitCost = unitCost !== undefined ? unitCost : lotCostUnit ?? previousWAC;
      const totalValue = currentUnitCost * quantity;

      // 3.1 Source / Destination Location Balance
      if (fromLocation) {
        const from = balances.get(`${fromLocation}_${productId}`)!;
        if (from.quantity < quantity) throw new Error(`สต็อกไม่เพียงพอในคลังต้นทาง (${fromLocation})`);
        from.quantity -= quantity;
      }
      if (toLocation) {
        balances.get(`${toLocation}_${productId}`)!.quantity += quantity;
      }

      // 3.2 Product Master Balance & Real-time WAC
      if (type === "OUT") {
        if (product.onHand < quantity) throw new Error(`สต็อกไม่พอสำหรับ ${product.data.name} (คงเหลือ ${product.onHand})`);
        product.onHand -= quantity;
        product.onHandDelta -= quantity;
        if (movement.fromReserved) product.reservedDelta -= quantity; // ยอดพร้อมใช้ถูกหักไปแล้วตอนจอง
        else product.availableDelta -= quantity;
        if (costMethod === "FIFO" && product.onHand > 0) {
          // ต้นทุนเฉลี่ยของที่เหลือ (ใช้อ้างอิงตอนเสนอราคา): Lot ที่เหลือ + สต็อกเดิมที่ไม่มี Lot
          const lotQty = product.lots.reduce((t, l) => t + l.remaining, 0), lotVal = product.lots.reduce((t, l) => t + l.remaining * l.unitCost, 0);
          const legacy = Math.max(0, product.onHand - lotQty);
          product.wac = Number(((lotVal + legacy * previousWAC) / (lotQty + legacy)).toFixed(4));
          product.wacChanged = true;
        }
      } else if (type === "IN") {
        product.wac = calculateWAC(previousOnHand, previousWAC, quantity, currentUnitCost);
        product.wacChanged = true;
        product.onHand += quantity;
        product.onHandDelta += quantity;
        product.availableDelta += quantity;
        // รับเข้า 1 รายการ = 1 Lot
        const info = movement.lotInfo || {};
        const receivedDate = /^\d{4}-\d{2}-\d{2}/.test(String(info.receivedDate || "")) ? String(info.receivedDate).slice(0, 10) : bangkokToday();
        product.lots.push({
          ref: lotCol.doc(lotNos[index]), lotNo: lotNos[index], remaining: quantity, unitCost: currentUnitCost, receivedDate, dirty: false,
          fresh: {
            lotNo: lotNos[index], companyId, productId, sku: String((product.data as any).sku || ""), name: String(product.data.name || ""), unit: String((product.data as any).unit || ""),
            unitCost: currentUnitCost, qtyReceived: quantity, receivedDate, info, movementId: transactionId,
            location: toLocation || "", referenceId: movement.referenceId || "", partyName: movement.partyName || "", createdBy: userId || "SYSTEM",
          },
        });
      }

      // 3.3 Automated Double-Entry GL Posting (stock issue -> COGS)
      //     ผังบัญชีเดียวกับ AccountingEngine / การรับสินค้า: Dr ต้นทุนขาย 5111-00 / Cr สินค้าคงเหลือ 1141-00
      if (type === "OUT" && totalValue > 0 && !movement.skipGl) {
        const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
        const amount = Math.round(totalValue * 100) / 100;
        transaction.set(journalRef, {
          companyId: companyId,
          date: serverTimestamp(),
          bookType: "JV",
          description: `[AUTO] เบิกสินค้า ${product.data.name} x${quantity} [Ref: ${movement.referenceId || transactionId}]`,
          reference: movement.referenceId || transactionId,
          totalDebit: amount,
          totalCredit: amount,
          status: "draft", // Requires accountant review
          items: [
            { accountCode: "5111-00", accountName: "ต้นทุนขาย", debit: amount, credit: 0 },
            { accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: 0, credit: amount }
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDeleted: false
        });
      }

      // 3.4 Update Serial Number Statuses
      if (snList && snList.length > 0) {
        for (const sn of snList) {
          const snRef = adminDb.collection(`companies/${companyId}/serial_numbers`).doc(sn);
          const snStatus = type === "OUT" ? "deployed" : "available";
          transaction.set(snRef, {
            productId,
            companyId,
            status: snStatus,
            lastReference: movement.referenceId || "",
            lastLocation: toLocation || fromLocation || "",
            updatedAt: serverTimestamp(),
            isDeleted: false
          }, { merge: true });
        }
      }

      // 3.5 Log Movement Record (Tenant Isolated)
      const moveRef = adminDb.collection(`companies/${companyId}/stock_movements`).doc(transactionId);
      transaction.set(moveRef, {
        // Firestore ไม่รับค่า undefined (เช่น fromLocation/snList ที่ไม่ได้ส่งมา)
        ...Object.fromEntries(Object.entries(movement).filter(([k, v]) => v !== undefined && k !== "lotInfo" && k !== "lots")),
        transactionId,
        unitCost: currentUnitCost,
        totalValue,
        costMethod,
        ...(type === "IN" ? { lotNo: lotNos[index] } : {}),
        // Lot ที่ตัดออก (ติดตามไปข้างหน้า: Lot นี้ขายให้ใคร) — lotNos ใช้ค้นแบบ array-contains
        ...(allocations.length ? { lots: allocations, lotNos: allocations.map((a) => a.lotNo) } : {}),
        oldWAC: previousWAC,
        newWAC: product.wac,
        previousOnHand,
        newOnHand: product.onHand,
        timestamp: serverTimestamp(),
        isDeleted: false
      });

      auditEntries.push({
        userId: userId || "SYSTEM",
        productId,
        before: { onHand: previousOnHand, costWAC: previousWAC },
        after: { onHand: product.onHand, costWAC: product.wac }
      });
    });

    // 4. Write location balances and product masters
    for (const balance of Array.from(balances.values())) {
      // companyId/location/productId ให้หน้าผังคลัง query ตามบริษัทและจัดกลุ่มตามตำแหน่งได้
      transaction.set(balance.ref, {
        companyId,
        location: balance.location,
        productId: balance.productId,
        quantity: balance.quantity,
        updatedAt: serverTimestamp(),
        isDeleted: false
      }, { merge: true });
    }

    const updatedBy = movements[movements.length - 1].userId || "SYSTEM";
    for (const product of Array.from(products.values())) {
      const update: Record<string, any> = {
        "stockStatus.onHand": increment(product.onHandDelta),
        "stockStatus.available": increment(product.availableDelta),
        "stockStatus.reserved": increment(product.reservedDelta),
        updatedAt: serverTimestamp(),
        updatedBy
      };
      if (product.wacChanged) {
        update["pricing.costWAC"] = product.wac;
        update.costPrice = product.wac;
      }
      transaction.update(product.ref, update);
    }

    // 4.1 Lot: สร้าง Lot ใหม่ของรายการรับเข้า · อัปเดตคงเหลือของ Lot ที่ถูกตัด (หมด = ปิด)
    for (const product of Array.from(products.values())) {
      for (const l of product.lots) {
        if (l.fresh) {
          // lotInfo อ่านตอนเขียน: ผู้เรียกเติมเลขใบรับ (grNo) ในช่วงอ่านของทรานแซกชัน
          const { info, ...rest } = l.fresh;
          const clean = Object.fromEntries(Object.entries({ supplierId: "", supplierName: rest.partyName || "", poRef: "", grNo: "", projectId: "", projectName: "", source: "GR", ...info }).filter(([k]) => k !== "receivedDate").map(([k, v]) => [k, String(v ?? "").slice(0, 300)]));
          transaction.set(l.ref, { ...rest, ...clean, qtyRemaining: l.remaining, status: l.remaining > 0 ? "open" : "closed", receivedAt: serverTimestamp(), updatedAt: serverTimestamp(), isDeleted: false });
        } else if (l.dirty) {
          transaction.update(l.ref, { qtyRemaining: l.remaining, status: l.remaining > 0 ? "open" : "closed", updatedAt: serverTimestamp() });
        }
      }
    }

    await extraWrites?.(transaction);
  });

  // 5. Audit Log Activity (Tenant Scoped & Strict Action Logging)
  for (const entry of auditEntries) {
    await auditServer.logUpdate(entry.userId, companyId, "INVENTORY_WAC", entry.productId, entry.before, entry.after);
  }

  return transactionIds;
}
