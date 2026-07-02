import { db } from "@/lib/firebase-client";
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Nexus Inventory Control V3.0
 * Handles stock reservations and project-based movements.
 */
export const InventoryService = {
  /**
   * Reserves stock when a Sales Order is approved.
   * Increments 'reservedQty' and decrements 'availableQty' (calculated field).
   */
  async softReserve(productId: string, qty: number, orderId: string) {
    const productRef = doc(db, "products", productId);
    
    // We update the reserved quantity. 
    // In V3.0, currentQty remains same until actual delivery.
    return await updateDoc(productRef, {
      reservedQty: increment(qty),
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Moves stock to Work-In-Progress (WIP) for project sites.
   * Used when items are picked and sent to job site but not yet 'consumed'.
   */
  async moveToWIP(productId: string, qty: number, projectId: string) {
    const productRef = doc(db, "products", productId);
    
    // Decrement actual stock and increment WIP stock
    await updateDoc(productRef, {
      currentQty: increment(-qty),
      wipQty: increment(qty),
      updatedAt: serverTimestamp()
    });

    // Log the movement
    return await addDoc(collection(db, "stock_movements"), {
      productId,
      projectId,
      type: 'WIP_MOVE',
      qty,
      timestamp: serverTimestamp()
    });
  },

  /**
   * Consumes WIP stock once project phase is signed off.
   * Decrements WIP stock permanently.
   */
  async consumeWIP(productId: string, qty: number, projectId: string) {
     const productRef = doc(db, "products", productId);
     return await updateDoc(productRef, {
       wipQty: increment(-qty),
       updatedAt: serverTimestamp()
     });
  },

  /**
   * AI-Driven Auto-Replenishment Engine
   * Scans for products where availableQty < reorderPoint and generates PRs.
   */
  async checkAndAutoReplenish() {
     // In a real system, we would query Firestore for products below threshold.
     // For this V4.0 implementation, we simulate the logic.
     const lowStockItems = [
       { id: 'prod-001', name: 'Aruba AP-505', current: 2, threshold: 10, supplierId: 'cis-01' }
     ];

     const prEntries = [];
     for (const item of lowStockItems) {
        const prData = {
           requestDate: serverTimestamp(),
           status: 'pending',
           requesterId: 'SYSTEM-AI',
           items: [{
              productId: item.id,
              name: item.name,
              requestedQty: item.threshold * 2, // Auto-stock 2x threshold
              purpose: '[AUTO-AI] Low stock replenishment detected.'
           }],
           createdAt: serverTimestamp()
        };
        
        const prRef = await addDoc(collection(db, "purchase_requests"), prData);
        prEntries.push(prRef.id);
     }
     
     return prEntries;
  },

  /**
   * Issues Free of Charge (FOC) items permanently from stock.
   */
  async issueFOCItems(productId: string, qty: number, orderId: string, focReason: string) {
    const productRef = doc(db, "products", productId);
    
    // Decrement stock status
    await updateDoc(productRef, {
      'stockStatus.onHand': increment(-qty),
      updatedAt: serverTimestamp()
    });

    // Log the movement as an FOC ISSUE
    return await addDoc(collection(db, "stock_movements"), {
      productId,
      referenceNo: orderId,
      type: 'FOC_ISSUE',
      qty,
      isFOC: true,
      focReason: focReason,
      timestamp: serverTimestamp()
    });
  }
};
